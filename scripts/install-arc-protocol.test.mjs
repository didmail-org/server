import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyProtocolMembership } from './install-arc-protocol.mjs';
import fs from 'node:fs/promises';
const did = JSON.parse(await fs.readFile('test/fixtures/protocol/fixtures/account-recovery-v1.json')).body.mailboxId;
const config = {
  arcOrigin: 'http://127.0.0.1:64867',
  publicOrigin: 'http://didmail-server.localhost:8788',
  vars: { DIDMAIL_MEMBER_ACCESS: 'arc', DIDMAIL_ARC_INSTANCE_ID: 'didmail-server' },
  secrets: { ARC_MEMBERS_TOKEN: 'public-test-credential' },
};
test('migration preflight verifies the configured credential against the exact member directory scope', async () => {
  let calls = 0;
  await verifyProtocolMembership(config, {
    fetcher: async (input, options) => {
      calls++;
      const url = new URL(input);
      assert.equal(url.pathname, '/.well-known/service/api/team/members');
      assert.equal(url.searchParams.get('instance'), 'didmail-server');
      assert.equal(url.searchParams.get('blocklet'), 'didmail-server');
      assert.equal(options.headers.authorization, 'Bearer public-test-credential');
      assert.equal(options.redirect, 'manual');
      return Response.json({
        ok: true,
        users: [{ did: did.slice(8), instance_did: 'didmail-server', role: 'member', approved: 1 }],
        paging: { total: 1 },
      });
    },
  });
  assert.equal(calls, 1);
});
test('stale credentials, foreign scope and unavailable sources cannot pass migration preflight', async () => {
  for (const fetcher of [
    async () => new Response(null, { status: 401 }),
    async () => new Response(null, { status: 302, headers: { location: 'https://example.invalid' } }),
    async () =>
      Response.json({
        ok: true,
        users: [{ did: did.slice(8), instance_did: 'old-instance', role: 'owner', approved: 1 }],
        paging: { total: 1 },
      }),
    async () => {
      throw Error('private upstream diagnostic');
    },
  ]) {
    await assert.rejects(verifyProtocolMembership(config, { fetcher }), {
      message: 'ARC membership credential/site scope could not be verified; private configuration retained',
    });
  }
  await assert.rejects(verifyProtocolMembership({ ...config, vars: { DIDMAIL_MEMBER_ACCESS: 'arc' } }));
});
test('legacy or unconfigured membership does not invent a credential or make a directory request', async () => {
  const fetcher = async () => {
    throw Error('Must not query');
  };
  await verifyProtocolMembership({ ...config, vars: { DIDMAIL_MEMBER_ACCESS: 'legacy' } }, { fetcher });
  await verifyProtocolMembership({ ...config, secrets: {} }, { fetcher });
});

test('rejected live directory preflight leaves both initial and staged private configuration unwritten', async () => {
  const http = await import('node:http');
  const os = await import('node:os');
  const path = await import('node:path');
  const { installProtocol } = await import('./install-arc-protocol.mjs');
  const cwd = process.cwd(),
    directory = await fs.mkdtemp(path.join(os.tmpdir(), 'didmail-install-members-'));
  let writes = 0,
    lookups = 0,
    staged;
  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost');
    response.setHeader('content-type', 'application/json');
    if (url.pathname === '/.well-known/service/api/team/members') {
      lookups++;
      assert.equal(request.headers.host, 'didmail-server.localhost:8788');
      assert.equal(url.searchParams.get('instance'), 'retired-instance');
      response.writeHead(401).end(JSON.stringify({ code: 'UNAUTHENTICATED' }));
      return;
    }
    let body = '';
    for await (const chunk of request) body += chunk;
    const rpc = JSON.parse(body);
    if (rpc.method === 'write') writes++;
    response.end(
      JSON.stringify({
        success: true,
        data: { data: { content: JSON.stringify(staged), meta: { version: 'test-version' } } },
      }),
    );
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const origin = 'http://127.0.0.1:' + server.address().port;
    const secret = '0x' + '11'.repeat(32),
      address = 'public-fixture';
    staged = {
      schemaVersion: 1,
      enabled: false,
      arcOrigin: origin,
      publicOrigin: config.publicOrigin,
      listenHost: '127.0.0.1',
      listenPort: 8788,
      aliases: '',
      jobsIntervalSeconds: 0,
      vars: { DIDMAIL_MEMBER_ACCESS: 'arc', DIDMAIL_ARC_INSTANCE_ID: 'retired-instance' },
      secrets: { NODE_SECRET_KEY: secret, NODE_ADDRESS: address, ARC_MEMBERS_TOKEN: 'public-test-credential' },
    };
    await fs.mkdir(path.join(directory, '.data'));
    await fs.writeFile(path.join(directory, '.data/node-wallet.json'), JSON.stringify({ address, secretKey: secret }));
    await fs.writeFile(
      path.join(directory, '.dev.vars'),
      Object.entries({ ...staged.vars, ...staged.secrets })
        .map(([key, value]) => key + '=' + value)
        .join('\n'),
    );
    process.chdir(directory);
    for (const enable of [false, true])
      await assert.rejects(
        installProtocol({ arcOrigin: origin, publicOrigin: config.publicOrigin, enable }),
        /membership credential\/site scope/,
      );
    assert.equal(lookups, 2);
    assert.equal(
      writes,
      0,
      'Neither absent nor already staged configuration can be published with a rejected member source',
    );
  } finally {
    process.chdir(cwd);
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await fs.rm(directory, { recursive: true, force: true });
  }
});
