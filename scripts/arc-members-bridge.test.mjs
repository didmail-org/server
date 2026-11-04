import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import createMembersForward from './arc-members-bridge.mjs';
const did = JSON.parse(fs.readFileSync('test/fixtures/protocol/fixtures/account-recovery-v1.json')).body.mailboxId;
const config = {
  origin: 'http://127.0.0.1:64867',
  publicOrigin: 'http://didmail-arc.localhost:8788',
  instanceId: 'didmail-arc',
  namespace: 'didmail-arc',
  token: 'test-only-credential',
};
const request = (query = `did=${did}&instanceId=didmail-arc`, method = 'GET') =>
  new Request('https://arc-members.internal/member?' + query, {
    method,
    headers: { cookie: 'never-forward', 'x-forwarded-host': 'attacker.invalid' },
  });
function setup(mode = 'active') {
  const calls = [];
  const handler = createMembersForward({
    ...config,
    fetcher: async (url, options) => {
      calls.push({ url: new URL(url), options });
      if (mode === 'offline') throw Error('private credential diagnostic');
      if (mode === 'unauthorized') return new Response(null, { status: 401 });
      if (mode === 'redirect')
        return new Response(null, { status: 302, headers: { location: 'https://attacker.invalid' } });
      if (mode === 'oversized') return new Response('x'.repeat(65537));
      const user = {
        did: mode === 'wrong-did' ? 'wrong' : did.slice(8),
        instance_did: mode === 'foreign' ? 'another-app' : 'didmail-arc',
        role: mode === 'guest' ? 'guest' : mode === 'unknown-role' ? 'other' : 'member',
        ...(mode === 'missing-state' ? {} : { approved: mode === 'blocked' ? 0 : mode === 'bad-state' ? 2 : 1 }),
        email: 'must-not-escape@example.invalid',
      };
      return Response.json({
        ok: true,
        paging: { total: mode === 'missing' ? 0 : mode === 'ambiguous' ? 2 : 1 },
        aggregated: mode === 'aggregate',
        users: mode === 'missing' ? [] : mode === 'ambiguous' ? [user, user] : [user],
      });
    },
  });
  return { calls, handler };
}
test('scoped exact search normalizes integer approved state and instance role without leaking profiles', async () => {
  for (const [mode, active, role] of [
    ['active', true, 'member'],
    ['blocked', false, 'member'],
    ['guest', true, 'guest'],
  ]) {
    const f = setup(mode),
      r = await f.handler(request());
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { instanceId: 'didmail-arc', did, role, active });
    assert.equal(f.calls.length, 1);
    const call = f.calls[0];
    assert.equal(call.options.method, 'GET');
    assert.equal(call.options.headers.authorization, 'Bearer ' + config.token);
    assert.equal(call.options.headers.cookie, undefined);
    assert.equal(call.options.headers['x-forwarded-host'], undefined);
    assert.equal(call.options.redirect, 'manual');
    assert.equal(call.url.origin, config.origin);
    assert.equal(call.url.pathname, '/.well-known/service/api/team/members');
    assert.equal(call.url.searchParams.get('search'), did.slice(8));
    assert.equal(call.url.searchParams.get('instance'), 'didmail-arc');
    assert.equal(call.url.searchParams.get('blocklet'), 'didmail-arc');
    assert.equal(call.url.searchParams.get('pageSize'), '2');
  }
  assert.equal((await setup('missing').handler(request())).status, 404);
});
test('unknown state, scope mismatch, ambiguity, authorization errors and redirects fail closed', async () => {
  for (const mode of [
    'wrong-did',
    'foreign',
    'unknown-role',
    'missing-state',
    'bad-state',
    'ambiguous',
    'aggregate',
    'offline',
    'unauthorized',
    'redirect',
    'oversized',
  ]) {
    const r = await setup(mode).handler(request());
    assert.equal(r.status, 503, mode);
    assert.deepEqual(await r.json(), { code: 'MEMBERSHIP_UNAVAILABLE' });
  }
});
test('only the fixed exact member lookup is exposed', async () => {
  const f = setup();
  for (const query of [
    `did=${did}&instanceId=other`,
    `did=${did}&instanceId=didmail-arc&path=/admin`,
    `did=${did}&did=${did}&instanceId=didmail-arc`,
  ])
    assert.equal((await f.handler(request(query))).status, 403);
  assert.equal((await f.handler(request(undefined, 'POST'))).status, 403);
  assert.equal((await f.handler(request('did=../../users&instanceId=didmail-arc'))).status, 400);
  assert.equal(f.calls.length, 0);
  for (const change of [
    { origin: 'http://attacker.invalid' },
    { publicOrigin: 'https://user:secret@example.invalid' },
    { namespace: '../users' },
    { instanceId: '' },
    { token: 'bad\r\nheader' },
  ])
    assert.throws(() => createMembersForward({ ...config, ...change }));
});

test('admin directory is scoped and bounded, strips profiles and rejects malformed or foreign member lists', async () => {
 const req = new Request('https://arc-members.internal/members?instanceId=didmail-arc&page=1&search=fixture');
 const good = setup();const response=await good.handler(req);assert.equal(response.status,200);
 const body=await response.json();assert.deepEqual(body.members,[{did,name:'',role:'member',active:true}]);
 assert.equal(good.calls[0].url.searchParams.get('pageSize'),'20');
 assert.equal(good.calls[0].url.searchParams.get('search'),'fixture');
 assert.equal(good.calls[0].options.headers.cookie,undefined);
 for(const mode of ['foreign','unknown-role','missing-state','bad-state','aggregate','offline','redirect','oversized','ambiguous']) {
   const r=await setup(mode).handler(req);assert.equal(r.status,503,mode);
 }
 assert.equal((await good.handler(new Request('https://arc-members.internal/members?instanceId=other&page=1&search='))).status,403);
 assert.equal((await good.handler(new Request('https://arc-members.internal/members?instanceId=didmail-arc&page=0&search='))).status,400);
});

test('directory filters map to ARC role/approved fields and fail closed if the source ignores them',async()=>{
 const req=query=>new Request('https://arc-members.internal/members?instanceId=didmail-arc&page=1&search=&'+query);
 const guest=setup('guest');assert.equal((await guest.handler(req('role=guest&active=active'))).status,200);
 assert.equal(guest.calls[0].url.searchParams.get('role'),'guest');assert.equal(guest.calls[0].url.searchParams.get('approved'),'1');
 const disabled=setup('blocked');assert.equal((await disabled.handler(req('active=inactive'))).status,200);
 assert.equal(disabled.calls[0].url.searchParams.get('approved'),'0');
 assert.equal((await setup().handler(req('role=guest'))).status,503);
 assert.equal((await setup().handler(req('active=inactive'))).status,503);
 assert.equal((await setup().handler(req('role=superadmin'))).status,400);
 assert.equal((await setup().handler(req('active=unknown'))).status,400);
});
