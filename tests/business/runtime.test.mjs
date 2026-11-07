import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from './host/miniflare.mjs';
import { fromRandom, fromSecretKey, WalletType } from '@ocap/wallet';
import { types } from '@ocap/mcrypto';
import { createHash } from 'node:crypto';
import { toBase58 } from '@ocap/util';
const wallet = fromRandom();
const headers = { 'X-DIDMail-did': wallet.address, 'X-DIDMail-pk': toBase58(wallet.publicKey) };
const origin = 'https://didmail.test';
const applicationWallet = fromSecretKey(
  wallet.secretKey,
  WalletType({ role: types.RoleType.ROLE_APPLICATION, pk: types.KeyType.ED25519, hash: types.HashType.SHA3 }),
);
const challenge = createHash('sha256')
  .update(applicationWallet.address + ':example.com')
  .digest('hex')
  .slice(0, 32);

// A separate trusted service stands in for ARC's session verifier. No caller role headers are trusted.
const arcScript = `export default { async fetch(request) {
 const path=new URL(request.url).pathname;
 if(path==='/.well-known/service/api/did/session') {
  const token=request.headers.get('authorization');
  return Response.json(token==='Bearer owner' ? {authenticated:true,user:{did:'owner-did',role:'owner'}} : token==='Bearer member' ? {authenticated:true,user:{did:'member-did',role:'member'}} : {authenticated:false,user:null});
 }
 return Response.json({path,host:new URL(request.url).host,body:await request.text()});
}};`;

test('Business HTTP fixture: REST, AFS, auth, binary compatibility and scheduled recovery', { timeout: 60000 }, async (t) => {
  const mf = new Miniflare(
    convertV4MiniflareOptions({
      workers: [
        {
          name: 'didmail',
          modules: true,
          scriptPath: 'artifacts/business-tests/test.mjs',
          compatibilityDate: '2026-10-24',
          compatibilityFlags: ['nodejs_compat'],
          bindings: {
            NODE_SECRET_KEY: wallet.secretKey,
            DIDMAIL_URL: origin,
            ARC_RENDER_UI: 'true',
            CHAIN_HOST: 'https://beta.abtnetwork.io/api/',
          },
          databaseFixtures: { DB: 'didmail-test' },
          objectFixtures: { BLOBS: 'didmail-test' },
          serviceBindings: { ARC: 'arc', ASSETS: 'assets' },
          outboundService: 'network',
        },
        { name: 'arc', modules: true, script: arcScript, compatibilityDate: '2026-10-24' },
        {
          name: 'network',
          modules: true,
          compatibilityDate: '2026-10-24',
          script: `export default {fetch(request){if(new URL(request.url).hostname!=='cloudflare-dns.com')return new Response('Unexpected external request',{status:502});return Response.json({Answer:[{data:'didmail-verify=${challenge}'}]});}}`,
        },
        {
          name: 'assets',
          modules: true,
          script: 'export default {fetch(){return new Response("Web Device asset")}}',
          compatibilityDate: '2026-10-24',
        },
      ],
    }),
  );
  try {
    const db = await mf.getDatabase('DB', 'didmail');
    const blobs = await mf.getObjects('BLOBS', 'didmail');
    for (const file of (await fs.readdir('blocklet/providers/didmail-business/migrations')).sort()) {
      const sql = await fs.readFile('blocklet/providers/didmail-business/migrations/' + file, 'utf8');
      // D1 exec accepts one statement per line; these migrations contain no semicolons in strings.
      for (const statement of sql
        .split(';')
        .map((x) => x.replace(/^--.*$/gm, '').trim())
        .filter(Boolean))
        await db.prepare(statement).run();
    }
    const fetcher = (path, init) => mf.dispatchFetch(origin + path, init);
    // The public clean-break protocol is tested separately below. Retained
    // adapters must still read the original ciphertext/signatures under workerd.
    const legacyAdapter = (path, init) => fetcher('/__legacy' + path, init);
    let mailId;
    await t.test('public probes and runtime config', async () => {
      const health = await fetcher('/api/health');
      assert.equal(health.status, 200);
      assert.equal((await health.json()).runtime, 'arc-native');
      const policy = await fetcher('/api/mail/attachment-config');
      assert.equal(policy.status, 200);
      assert.equal((await policy.json()).maxFileCount, 5);
      assert.deepEqual(await (await fetcher('/api/servers/domains')).json(), { enabled: false, domains: [] });
      const config = await (await fetcher('/runtime-config.js')).text();
      assert.ok(!config.includes(wallet.secretKey));
      assert.equal((await fetcher('/api/no-route')).status, 404);
    });
    await t.test('ARC identity, role checks, CSRF and raw RPC forwarding', async () => {
      const target = '/api/admin/attachment-config';
      const body = JSON.stringify({ maxFileCount: 3 });
      assert.equal(
        (
          await fetcher(target, {
            method: 'PUT',
            headers: { 'content-type': 'application/json', 'x-arc-role': 'owner' },
            body,
          })
        ).status,
        401,
      );
      assert.equal(
        (
          await fetcher(target, {
            method: 'PUT',
            headers: { 'content-type': 'application/json', authorization: 'Bearer member' },
            body,
          })
        ).status,
        401,
      );
      assert.equal(
        (
          await fetcher(target, {
            method: 'PUT',
            headers: {
              'content-type': 'application/json',
              authorization: 'Bearer owner',
              cookie: 'session=foo',
              origin: 'https://evil.test',
            },
            body,
          })
        ).status,
        403,
      );
      const changed = await fetcher(target, {
        method: 'PUT',
        headers: { 'content-type': 'application/json', authorization: 'Bearer owner' },
        body,
      });
      assert.equal(changed.status, 200);
      assert.equal((await (await fetcher('/api/mail/attachment-config')).json()).maxFileCount, 3);
      const raw = '{"type":"read","path":"/user/test"}';
      const rpc = await fetcher('/api/afs/rpc', { method: 'POST', body: raw });
      assert.deepEqual(await rpc.json(), { path: '/api/afs/rpc', host: 'didmail.test', body: raw });
    });
    await t.test('session exposes a no-store node cache scope only to verified administrators', async () => {
      const owner = await fetcher('/api/runtime/session', { headers: { authorization: 'Bearer owner' } });
      assert.equal(owner.headers.get('cache-control'), 'no-store');
      const data = await owner.json();
      assert.equal(data.node.address, applicationWallet.address);
      assert.equal(data.node.chainId, 'beta');
      assert.match(data.node.cacheKey, /^[a-f0-9]{64}$/);
      assert.deepEqual(Object.keys(data.node).sort(), ['address', 'cacheKey', 'chainId', 'tokenId']);
      const member = await (
        await fetcher('/api/runtime/session', { headers: { authorization: 'Bearer member' } })
      ).json();
      assert.equal(member.node, undefined);
      const anonymous = await (await fetcher('/api/runtime/session')).json();
      assert.equal(anonymous.authenticated, false);
      assert.equal(anonymous.node, undefined);
    });
    await t.test('node recharge identity survives chain failure and is independent of the ARC user', async () => {
      const response = await fetcher('/api/account/state', { headers: { authorization: 'Bearer owner' } });
      assert.equal(response.status, 200);
      const account = await response.json();
      assert.equal(account.address, applicationWallet.address);
      assert.notEqual(account.address, 'owner-did');
      assert.equal(account.chainStatus, 'unavailable');
      assert.ok(!JSON.stringify(account).includes(wallet.secretKey));
    });
    await t.test(
      'template lists persist large SVG pages in R2 and read D1 policy without contacting the chain',
      async () => {
        const auth = { authorization: 'Bearer owner' };
        for (const kind of ['envelope', 'namecard']) {
          await fetcher('/__template-cache', { method: 'POST', body: JSON.stringify({ kind }) });
          assert.equal((await fetcher(`/api/${kind}/list`)).status, 401);
          const cached = await fetcher(`/api/${kind}/list?cursor=0`, { headers: auth });
          assert.equal(cached.status, 200);
          const body = await cached.json();
          assert.equal(body.cache.source, 'cache');
          const key = kind === 'envelope' ? 'envelopes' : 'namecards';
          assert.ok(body[key][0].display.length > 2 * 1024 * 1024);
          assert.equal(body[key][0].enabled, false);
          const publish = await fetcher(`/api/${kind}/db/update`, {
            method: 'POST',
            headers: { ...auth, 'content-type': 'application/json' },
            body: JSON.stringify({
              ...body[key][0],
              display: undefined,
              token: body[key][0].token,
              svg: '<svg>published</svg>',
              enabled: true,
            }),
          });
          assert.equal(publish.status, 200);
          const changed = await (await fetcher(`/api/${kind}/list?cursor=0`, { headers: auth })).json();
          assert.equal(changed[key][0].enabled, true);
          // The test's external network deliberately rejects all chain requests.
          const fallback = await (await fetcher(`/api/${kind}/list?cursor=0&refresh=1`, { headers: auth })).json();
          assert.equal(fallback.cache.stale, true);
          assert.equal(fallback[key][0].enabled, true);
          const pointer = await db.prepare('SELECT payload FROM template_list_cache LIMIT 1').first();
          assert.ok(pointer.payload.startsWith('template-cache/'));
          assert.equal((await fetcher(`/api/${kind}/clean`, { method: 'DELETE', headers: auth })).status, 200);
        }
        const raced = await (
          await fetcher('/__template-cache', { method: 'POST', body: JSON.stringify({ race: true }) })
        ).json();
        assert.equal(raced.value, null);
        assert.equal(
          (await db.prepare("SELECT COUNT(*) AS count FROM template_list_cache WHERE scope = 'race'").first()).count,
          0,
        );
      },
    );
    await t.test('ARC serves admin deep links and cached asset MIME types', async () => {
      for (const section of ['account', 'server', 'envelope', 'namecard', 'storage', 'attachment']) {
        const page = await fetcher(`/admin/${section}?probe=1`);
        assert.equal(page.status, 200);
        assert.equal((await page.json()).path, `/en/admin-${section}/`);
      }
      assert.equal((await (await fetcher('/admin')).json()).path, '/en/admin/');
      assert.equal((await (await fetcher('/en/')).json()).path, '/');
      assert.equal((await (await fetcher('/admin/unknown')).json()).path, '/admin/unknown');
      for (const locale of ['en', 'zh', 'ar', 'ja', 'ru']) {
        for (const section of ['account', 'server', 'envelope', 'namecard', 'storage', 'attachment']) {
          const response = await fetcher(`/${locale}/admin/${section}?probe=1`);
          assert.equal((await response.json()).path, `/${locale}/admin-${section}/`);
        }
        assert.equal((await (await fetcher(`/${locale}/admin`)).json()).path, `/${locale}/admin/`);
      }
      const localized = await fetcher('/?source=bookmark', { headers: { cookie: 'arc_lang=zh' }, redirect: 'manual' });
      assert.equal(localized.status, 302);
      assert.equal(localized.headers.get('location'), origin + '/zh/?source=bookmark');
      assert.equal(localized.headers.get('cache-control'), 'no-store');
      assert.equal(localized.headers.get('vary'), 'Cookie');
      assert.equal((await fetcher('/api/health', { headers: { cookie: 'arc_lang=zh' } })).status, 200);
      assert.equal((await (await fetcher('/zh/')).json()).path, '/zh/');
      assert.equal((await (await fetcher('/fr/')).json()).path, '/fr/');
      const css = await fetcher('/assets/style.css');
      assert.equal(css.headers.get('content-type'), 'text/css');
      assert.equal((await css.json()).path, '/assets/style.css');
      const favicon = await fetcher('/favicon.ico');
      assert.equal(favicon.status, 200);
      assert.equal(favicon.headers.get('content-type'), 'image/svg+xml');
      assert.equal((await favicon.json()).path, '/assets/logo.svg');
      assert.equal((await fetcher('/admin', { method: 'POST' })).status, 405);
    });
    await t.test('domain verification uses Fetch API and preserves pricing defaults', async () => {
      const init = {
        method: 'POST',
        headers: { authorization: 'Bearer owner', 'content-type': 'application/json' },
        body: JSON.stringify({ domain: 'example.com' }),
      };
      assert.equal((await fetcher('/api/admin/domains', init)).status, 200);
      const verified = await fetcher('/api/admin/domains/verify', init);
      assert.equal(verified.status, 200);
      assert.equal((await verified.json()).status, 'verified');
      const pricing = await fetcher('/api/admin/domains/example.com', {
        ...init,
        method: 'PUT',
        body: JSON.stringify({ aliasPrice: '123' }),
      });
      assert.equal(pricing.status, 200);
      const row = await pricing.json();
      assert.equal(row.aliasPrice, '123');
      assert.equal(row.minLength, 4);
      assert.ok(row.domainKeyEnc);
      const domains = await (await fetcher('/api/servers/domains')).json();
      assert.equal(domains.enabled, true);
      assert.ok(domains.domains[0].domainKeyFingerprint);
    });
    await t.test('repository creates encrypted AFS payloads and rolls back conflicting batches', async () => {
      const seeded = await fetcher('/__fixture', { method: 'POST', body: JSON.stringify({ did: wallet.address }) });
      assert.equal(seeded.status, 200);
      const fixture = await seeded.json();
      mailId = fixture.mailId;
      assert.equal(fixture.conflict, true);
      assert.equal(fixture.rollback, true);
      assert.equal((await blobs.list()).objects.length, 2);
    });
    await t.test('retired public mail routes reject old and malformed requests without storing data', async () => {
      const before = (await blobs.list()).objects.map(item => item.key).sort();
      const beforeRows = await db.prepare('SELECT COUNT(*) AS count FROM mails').first();
      const timeStamp = String(Date.now());
      for (const [method, path] of [
        ['POST', '/api/mail/send'],
        ['POST', '/api/mail/send/sign'],
        ['GET', `/api/mail/download/${mailId}`],
        ['GET', `/api/mail/download/${mailId}/attachment/attachment-${mailId}`],
        ['GET', `/api/mail/download/${mailId}?` + new URLSearchParams({
          timeStamp, sign: wallet.sign(`${mailId}-${timeStamp}`),
        })],
      ]) {
        const response = await fetcher(path, {
          method,
          headers: { ...headers, 'content-type': 'application/json' },
          ...(method === 'POST' ? { body: '{malformed' } : {}),
        });
        assert.equal(response.status, 410);
        assert.equal(response.headers.get('cache-control'), 'no-store');
        const problem = await response.json();
        assert.equal(problem.code, 'PROTOCOL_RETIRED');
        assert.equal(problem.status, 410);
        assert.equal(problem.recoveryAction, 'upgrade_client');
        assert.match(problem.detail, /\/v1\//);
      }
      assert.deepEqual((await blobs.list()).objects.map(item => item.key).sort(), before);
      assert.deepEqual(await db.prepare('SELECT COUNT(*) AS count FROM mails').first(), beforeRows);
    });
    await t.test('retained adapter reads original signed mail and attachment ciphertext', async () => {
      const timeStamp = String(Date.now());
      const sign = wallet.sign(`${mailId}-${timeStamp}`);
      const mail = await legacyAdapter(`/api/mail/download/${mailId}?` + new URLSearchParams({ sign, timeStamp }), {
        headers,
      });
      assert.equal(mail.status, 200);
      assert.deepEqual(Buffer.from(await mail.arrayBuffer()), Buffer.from([11, 22, 33, 44]));
      assert.match(mail.headers.get('x-attachments-metadata'), /attachment-/);
      const path = `/api/mail/download/${mailId}/attachment/attachment-${mailId}?`;
      const attachment = await legacyAdapter(
        path + new URLSearchParams({ sign: wallet.sign(`${mailId}-attachment-${mailId}-${timeStamp}`), timeStamp }),
        { headers },
      );
      assert.equal(attachment.status, 200);
      assert.deepEqual(Buffer.from(await attachment.arrayBuffer()), Buffer.from([45, 67, 89, 0, 255]));
      assert.equal(
        (await legacyAdapter(path + new URLSearchParams({ sign: wallet.sign('wrong'), timeStamp }), { headers })).status,
        401,
      );
    });
    await t.test('retained HTTP adapter validates multipart', async () => {
      const data = new FormData();
      data.append('subject', new Blob([new Uint8Array([1, 2])]), 'subject.bin');
      data.append('content', new Blob([new Uint8Array([3, 4])]), 'content.bin');
      data.append('attachmentMeta', '{not-json');
      const encoded = new Request(origin, { method: 'POST', body: data });
      const r = await legacyAdapter('/api/mail/send', {
        method: 'POST',
        headers: { ...headers, 'content-type': encoded.headers.get('content-type') },
        body: await encoded.arrayBuffer(),
      });
      assert.equal(r.status, 400);
      assert.match((await r.json()).error, /attachmentMeta/i);
    });
    await t.test('AFS objects handle multi-megabyte payloads', async () => {
      const seeded = await (
        await fetcher('/__fixture', { method: 'POST', body: JSON.stringify({ did: wallet.address, large: true }) })
      ).json();
      const timeStamp = String(Date.now()),
        id = seeded.mailId,
        attachmentId = 'attachment-' + id;
      const r = await legacyAdapter(
        `/api/mail/download/${id}/attachment/${attachmentId}?` +
          new URLSearchParams({ timeStamp, sign: wallet.sign(`${id}-${attachmentId}-${timeStamp}`) }),
        { headers },
      );
      assert.equal(r.status, 200);
      const bytes = new Uint8Array(await r.arrayBuffer());
      assert.equal(bytes.length, 3 * 1024 * 1024);
      assert.ok(bytes.every((x) => x === 171));
    });
    await t.test('concurrent rate limits use atomic AFS transactions', async () => {
      const results = await Promise.all(
        Array.from({ length: 20 }, async () => await (await fetcher('/__limit')).json()),
      );
      assert.equal(results.filter(Boolean).length, 5);
    });
    await t.test('scheduled cleanup removes expired mail and encrypted AFS payloads', async () => {
      const seeded = await (
        await fetcher('/__fixture', { method: 'POST', body: JSON.stringify({ did: wallet.address, expired: true }) })
      ).json();
      const before = (await blobs.list()).objects.length;
      const result = await fetcher('/__scheduled');
      assert.equal(result.status, 200);
      assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM mails WHERE id = ?').bind(seeded.mailId).first()).n, 0);
      assert.equal((await blobs.list()).objects.length, before - 2);
    });
    await t.test('admin delete removes relational rows and encrypted AFS objects', async () => {
      const before = (await blobs.list()).objects.length;
      const r = await fetcher('/api/storage/mails/delete/' + mailId, {
        method: 'DELETE',
        headers: { authorization: 'Bearer owner' },
      });
      assert.equal(r.status, 200);
      assert.equal((await blobs.list()).objects.length, before - 2);
      assert.equal(
        (await db.prepare('SELECT COUNT(*) AS n FROM attachments WHERE mailId = ?').bind(mailId).first()).n,
        0,
      );
    });
  } finally {
    await mf.dispose();
  }
});
