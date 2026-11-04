import test from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, amountText, shortDid, didMarkup, units, toUnits, svgSource, assetData, request, canAfford, accountBalanceText } from '../../ui/shared.js';
test('token accounting keeps amounts beyond JS safe integer precision', () => {
  assert.equal(units('900719925474099312345', 18), '900.719925474099312345');
  assert.equal(toUnits('900.719925474099312345', 18), 900719925474099312345n);
  assert.equal(units('1', 18), '0.000000000000000001');
  assert.equal(units('123', 0), '123');
  for (const value of ['-1', '1e18', 'NaN', 'Infinity', '0.0001']) assert.throws(() => toUnits(value, 3));
});
test('untrusted chain values cannot inject HTML or script image URLs', () => {
  assert.equal(escapeHtml('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
  assert.equal(svgSource('javascript:alert(1)'), '');
  assert.equal(svgSource('https://other.example/template.svg'), '');
  assert.match(
    svgSource('<svg xmlns="http://www.w3.org/2000/svg"><text>名字</text></svg>'),
    /^data:image\/svg\+xml;charset=utf-8,%3Csvg/,
  );
  assert.deepEqual(assetData({ data: { value: 'not json' } }), {});
});
test('API requests preserve same-origin credentials, multipart and large wei strings', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async (_path, options) => {
    assert.equal(options.credentials, 'same-origin');
    assert.equal(options.body, '{"price":"900719925474099312345"}');
    return Response.json({ ok: true });
  });
  assert.deepEqual(await request('/api/test', { method: 'PUT', body: { price: '900719925474099312345' } }), {
    ok: true,
  });
  const form = new FormData();
  form.append('file', new Blob(['ciphertext']), 'template.svg');
  fetchMock.mock.mockImplementation(async (_path, options) => {
    assert.equal(options.body, form);
    assert.equal(options.headers['content-type'], undefined);
    return Response.json({ ok: true });
  });
  await request('/api/test', { method: 'POST', body: form });
});
test('only an explicitly optional missing stake is empty; authorization and transport errors surface', async (t) => {
  const mock = t.mock.method(globalThis, 'fetch', async () => Response.json({ message: 'No stake' }, { status: 404 }));
  assert.equal(await request('/api/stake/state', { optional404: true }), null);
  await assert.rejects(request('/api/stake/state'), /No stake/);
  mock.mock.mockImplementation(async () => Response.json({ message: 'Forbidden' }, { status: 403 }));
  await assert.rejects(request('/api/stake/state', { optional404: true }), /Forbidden/);
  mock.mock.mockImplementation(async () => new Response('<html>bad gateway</html>', { status: 502 }));
  await assert.rejects(request('/api/test'), /Invalid API response/);
});

test('API problem details explain rejected policy edits without losing legacy errors', async (t) => {
  const mock = t.mock.method(globalThis, 'fetch', async () => Response.json({
    code: 'INVALID_MAIL_POLICY', detail: 'Single-file limit exceeds total attachment limit', recoveryAction: 'none',
  }, { status: 400 }));
  await assert.rejects(request('/api/admin/mail-policy', { method: 'PUT', body: {} }), {
    message: 'Single-file limit exceeds total attachment limit', status: 400,
  });
  for (const payload of [{ message: 'Legacy message', detail: 'Other detail' }, { error: 'Legacy message' }]) {
    mock.mock.mockImplementation(async () => Response.json(payload, { status: 403 }));
    await assert.rejects(request('/api/test'), { message: 'Legacy message', status: 403 });
  }
  for (const payload of [{ detail: { internal: 'not a message' } }, { message: '', error: null }, null]) {
    mock.mock.mockImplementation(async () => Response.json(payload, { status: 400 }));
    await assert.rejects(request('/api/test'), { message: 'Request failed (400).', status: 400 });
  }
});

test('factory payment requires the matching token and exact unit balance', () => {
  const cost = { address: 'tba', symbol: 'TBA', decimal: 18, value: '9007199254740993' };
  assert.equal(canAfford([{ ...cost, value: '9007199254740992' }], cost), false);
  assert.equal(canAfford([{ ...cost, value: '9007199254740993' }], cost), true);
  assert.equal(canAfford([{ ...cost, address: 'abt', value: '999999999999999999' }], cost), false);
  assert.equal(canAfford([{ ...cost, decimal: 6 }], cost), false);
});

test('concurrent identical reads share a request but completed reads and mutations are always fresh', async (t) => {
  let release;
  const pending = new Promise((resolve) => {
    release = resolve;
  });
  const mock = t.mock.method(globalThis, 'fetch', async () => {
    await pending;
    return Response.json({ ok: true });
  });
  const first = request('/api/account/state');
  const second = request('/api/account/state');
  assert.equal(mock.mock.callCount(), 1);
  release();
  await Promise.all([first, second]);
  await request('/api/account/state');
  assert.equal(mock.mock.callCount(), 2);
  await Promise.all([
    request('/api/stake/add', { method: 'POST', body: { amount: 1 } }),
    request('/api/stake/add', { method: 'POST', body: { amount: 1 } }),
  ]);
  assert.equal(mock.mock.callCount(), 4);
});

test('refresh after a write cannot reuse a read started before the write', async (t) => {
  let releaseOld,
    releaseNew,
    count = 0;
  const oldGate = new Promise((resolve) => {
    releaseOld = resolve;
  });
  const newGate = new Promise((resolve) => {
    releaseNew = resolve;
  });
  const mock = t.mock.method(globalThis, 'fetch', async (_path, options) => {
    if (options.method !== 'GET') return Response.json({ ok: true });
    const version = ++count;
    await (version === 1 ? oldGate : newGate);
    return Response.json({ version });
  });
  const oldRead = request('/api/stake/state');
  await request('/api/stake/asset', { method: 'POST', body: { assetAddress: 'fixture' } });
  const newRead = request('/api/stake/state');
  releaseOld();
  assert.deepEqual(await oldRead, { version: 1 });
  const sharedNewRead = request('/api/stake/state');
  assert.equal(mock.mock.callCount(), 3);
  releaseNew();
  assert.deepEqual(await newRead, { version: 2 });
  assert.deepEqual(await sharedNewRead, { version: 2 });
});

test('display amounts round to four places without floating point or transaction precision loss', () => {
  assert.equal(amountText(units('3995750800000000000')), '3.9958');
  assert.equal(amountText('999999999999999999.99999'), '1000000000000000000');
  assert.equal(amountText('1.200000 TBA'), '1.2 TBA');
  assert.equal(amountText('0'), '0');
  assert.equal(amountText('0.00001'), '0');
  assert.equal(toUnits('3.9957508'), 3995750800000000000n);
});
test('DID display uppercases only the abbreviated suffix and keeps original action values', () => {
  const did = 'did:abt:z1YofskF1rtZ6AHn1iwHZugN2HmSVLpH6cL';
  assert.equal(shortDid(did), 'z1Yofs...H6CL');
  const html = didMarkup(did);
  assert.ok(html.includes(`data-did-copy="${did}"`));
  assert.ok(html.includes(`data-did-show="${did}"`));
  assert.equal(didMarkup('<script>'), '&lt;script&gt;');
});


// Independent arithmetic oracle for DISPLAY tests only: no shared units/rounder
// supplies an expected result, and raw integers are never converted to Number.
function independentAccountBalance(rawText, decimal) {
  const raw = BigInt(rawText), scale = 10n ** BigInt(decimal);
  const whole = raw / scale, residue = raw % scale;
  const fraction = decimal ? residue.toString().padStart(decimal, '0').replace(/0+$/, '') : '';
  const exact = whole.toString() + (fraction ? '.' + fraction : '');
  const divisor = decimal >= 4 ? 10n ** BigInt(decimal - 4) : 1n;
  const rounded = decimal >= 4
    ? raw / divisor + (2n * (raw % divisor) >= divisor ? 1n : 0n)
    : raw * 10n ** BigInt(4 - decimal);
  const tail = (rounded % 10000n).toString().padStart(4, '0').replace(/0+$/, '');
  const summary = (rounded / 10000n).toString() + (tail ? '.' + tail : '');
  const [backWhole, backFraction = ''] = exact.split('.');
  assert.equal(BigInt(backWhole) * scale + BigInt(backFraction.padEnd(decimal, '0') || '0'), raw);
  return { exact, summary };
}
test('account exact display matches independent literals/divmod and roundtrips raw integers', () => {
  const vectors = [
    ['3049210800000000080', 18, '3.04921080000000008', '3.0492'],
    ['0', 18, '0', '0'],
    ['1', 18, '0.000000000000000001', '0'],
    ['900719925474099312345', 18, '900.719925474099312345', '900.7199'],
    ['3995750800000000000', 18, '3.9957508', '3.9958'],
    ['999999999999999999999999', 18, '999999.999999999999999999', '1000000'],
    ['123', 0, '123', '123'], ['123', 2, '1.23', '1.23'],
    ['1', 36, '0.' + '0'.repeat(35) + '1', '0'],
    ['000001', 18, '0.000000000000000001', '0'],
  ];
  for (const [raw, decimal, exact, summary] of vectors) {
    assert.deepEqual(independentAccountBalance(raw, decimal), { exact, summary });
    const token = Object.freeze({ address: 'public-native-token', symbol: 'TBA', value: raw, decimal });
    assert.deepEqual(accountBalanceText(token), { exact: exact + ' TBA', summary: summary + ' TBA' });
    assert.equal(token.value, raw); assert.equal(token.decimal, decimal);
  }
  const whole70 = '1234567890123456789012345678901234567890123456789012345678901234567890';
  const raw = whole70 + '123456789012345678';
  assert.deepEqual(independentAccountBalance(raw, 18), { exact: whole70 + '.123456789012345678', summary: whole70 + '.1235' });
  assert.deepEqual(accountBalanceText({ value: raw, decimal: 18, symbol: 'TBA' }), {
    exact: whole70 + '.123456789012345678 TBA', summary: whole70 + '.1235 TBA',
  });
});
test('account display accepts safe integer representations but tiny positive remains distinct from zero', () => {
  for (const value of [123, 123n, '123']) {
    assert.deepEqual(accountBalanceText({ value, decimal: 2, symbol: 'TBA' }), { summary: '1.23 TBA', exact: '1.23 TBA' });
  }
  for (const decimal of [18, '18']) {
    assert.deepEqual(accountBalanceText({ value: '0', decimal, symbol: 'TBA' }), { summary: '0 TBA', exact: '0 TBA' });
  }
  assert.notEqual(accountBalanceText({ value: '1', decimal: 18 }).exact, accountBalanceText({ value: '0', decimal: 18 }).exact);
});
test('malformed account amount or precision is unavailable rather than invented zero', () => {
  const unknown = { summary: '—', exact: null };
  for (const value of [undefined, null, '-1', '1.2', '1e18', ' 1', '1 ', true, false, {}, [], NaN, Infinity, -1, 9007199254740992]) {
    assert.deepEqual(accountBalanceText({ value, decimal: 18, symbol: 'TBA' }), unknown);
  }
  for (const decimal of [undefined, null, -1, 37, 18.5, '18.5', '1e1', '01', true, {}]) {
    assert.deepEqual(accountBalanceText({ value: '123', decimal, symbol: 'TBA' }), unknown);
  }
  assert.deepEqual(accountBalanceText(undefined), unknown);
  assert.deepEqual(accountBalanceText(null), unknown);
});
test('explicit successful empty balance is zero only with caller-known evidence; unavailable wins', () => {
  const unknown = { summary: '—', exact: null };
  assert.deepEqual(accountBalanceText(undefined, { knownEmpty: true, empty: '0 TBA' }), { summary: '0 TBA', exact: '0 TBA' });
  assert.deepEqual(accountBalanceText(undefined, { knownEmpty: false, empty: '0 TBA' }), unknown);
  assert.deepEqual(accountBalanceText(undefined, { unavailable: true, knownEmpty: true, empty: '0 TBA' }), unknown);
  assert.deepEqual(accountBalanceText({ value: '0', decimal: 18, symbol: 'TBA' }, { unavailable: true }), unknown);
  assert.deepEqual(accountBalanceText({ value: null, decimal: 18 }, { knownEmpty: true, empty: '0 TBA' }), unknown);
});
test('exact account text stays inert at the existing HTML sink and inputs remain unchanged', () => {
  const input = Object.freeze({ address: 'public-native-token', value: '1000000000000000001', decimal: 18, symbol: '<img src=x onerror="x">' });
  const before = JSON.stringify(input), display = accountBalanceText(input);
  assert.equal(display.exact, '1.000000000000000001 <img src=x onerror="x">');
  assert.equal(escapeHtml(display.exact), '1.000000000000000001 &lt;img src=x onerror=&quot;x&quot;&gt;');
  assert.equal(JSON.stringify(input), before);
});
