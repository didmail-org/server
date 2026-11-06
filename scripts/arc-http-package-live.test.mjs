import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fromSecretKey, fromPublicKey, fromAddress, WalletType } from '@ocap/wallet';
import { types } from '@ocap/mcrypto';
import { DmpClient, identityId, addressOf, signRequest } from '@didmail/protocol';
import { toUint8Array } from '@ocap/util';
import { toStakeAddress } from '@arcblock/did-util';
import { arcHttpTransport } from './arc-http-transport.mjs';
import { previewArcWebSocket } from './preview-arc-websocket.mjs';
import { previewRouting } from './preview-routing.mjs';
import WebSocket from 'ws';
import { createInstanceConfigClient } from '../ui/instance-config.js';
import { businessDatabase, createNativeStorageBinding, nativeStorageOperation } from './arc-native-storage-client.mjs';
import { localPolicyRoot } from './arc-mail-policy-bridge.mjs';
import { MailPolicyStore } from '../blocklet/providers/didmail-native/mail-policy.mjs';
import { initialPolicyState } from './afs-policy-fixture.mjs';

export async function freePort() {
  const server = http.createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}
test(
  'standalone dist hosts original protocol HTTP and signing inside ARC',
  { skip: process.env.DIDMAIL_ARC_HTTP_TEST !== '1', timeout: 180000 },
  async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'didmail-native-http-')),
      app = directory + '/app',
      instance = 'didmail-native-http-' + randomUUID();
    const run = promisify(execFile),
      arc = (...args) =>
        run('arc', args, {
          timeout: 45000,
          maxBuffer: 2 * 1024 * 1024,
          env: { ...process.env, AFS_TEST_ALLOW_CALLER_HEADER: '1' },
        });
    let started = false,
      platform,
      occupied;
    try {
      await fs.cp('blocklet/providers', app + '/providers', { recursive: true });
      await fs.writeFile(app + '/package.json', '{"type":"module","private":true}');
      await fs.writeFile(
        app + '/blocklet.yaml',
        'specVersion: 2\nid: didmail-server\nname: Native HTTP evidence\ndid: did:blocklet:didmail-server\nversion: 0.1.0\nscope: app\ninstance:\n  required: true\nmounts:\n' +
          ['didmail-business', 'didmail-native', 'didmail-http']
            .map(
              (name) =>
                '  - target: ./providers/' +
                name +
                '\n    path: /' +
                name +
                '\n    required: true\n    ops: [list,read,stat,explain,exec]\n',
            )
            .join('') +
          '\nnetworkRead:\n  - path: /instance/app/didmail/public/attachment-config.json\n    role: guest\n',
      );
      await arc('blocklet', 'check', app);
      await arc('blocklet', 'build', app);
      await fs.rm(app + '/providers', { recursive: true });
      started = true;
      const launch = await arc(
        'service',
        'start',
        '--instance',
        instance,
        '--home',
        directory + '/home',
        '--blocklet',
        app + '/dist',
        '--port',
        '0',
        '--purpose',
        'evidence',
        '--no-advertise',
        '--print',
        'port',
      );
      const arcPort = Number(launch.stdout.trim().split('\n').at(-1)),
        origin = 'http://127.0.0.1:' + arcPort;
      const rpc = async (body, admin = false) => {
        const response = await fetch(origin + '/api/afs/rpc?blocklet=didmail-server', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...(admin ? { 'x-caller-role': 'admin', 'x-caller-did': 'did:test:native-http' } : {}),
          },
          body: JSON.stringify(body),
        });
        return response.json();
      };
      assert.equal(
        (await rpc({ type: 'exec', path: '/didmail-business/.actions/initialize-business', args: {} }, true)).ok,
        true,
      );
      const publicPort = await freePort(),
        publicOrigin = 'http://127.0.0.1:' + publicPort;
      const wallet = fromSecretKey(
        '0x' + '11'.repeat(32),
        WalletType({ role: types.RoleType.ROLE_APPLICATION, pk: types.KeyType.ED25519, hash: types.HashType.SHA3 }),
      );
      const alice = fromSecretKey('0x' + '22'.repeat(32)),
        bob = fromSecretKey('0x' + '33'.repeat(32));
      const members = [
        identityId(fromSecretKey('0x' + '44'.repeat(32)).address),
        identityId(fromSecretKey('0x' + '55'.repeat(32)).address),
      ];
      const owners = Object.fromEntries(
        [wallet, alice, bob].map((w) => [toStakeAddress(w.address, w.address), w.address]),
      );
      let forbiddenNetwork = 0;
      // Synthetic authoritative service on loopback. No real chain/message service
      // is used, and production code contains no test settlement adapter.
      platform = http.createServer(async (incoming, outgoing) => {
        const url = new URL(incoming.url, 'http://fixture');
        const chunks = [];
        for await (const chunk of incoming) chunks.push(chunk);
        const bytes = Buffer.concat(chunks);
        const reply = (body, status = 200) => {
          outgoing.writeHead(status, { 'content-type': 'application/json' });
          outgoing.end(JSON.stringify(body));
        };
        if (
          url.pathname === '/.well-known/service/api/did/session' &&
          ['Bearer public-admin-fixture', 'Bearer public-member-fixture'].includes(incoming.headers.authorization)
        ) {
          return reply({
            authenticated: true,
            user: {
              did: 'did:test:fixture-session',
              role: incoming.headers.authorization.includes('admin') ? 'admin' : 'member',
            },
          });
        }
        if (url.pathname === '/chain') {
          forbiddenNetwork++;
          return reply({ error: 'Chain broadcasts forbidden' }, 503);
        }
        if (url.pathname === '/.well-known/service/api/team/members') {
          assert.equal(incoming.headers.authorization, 'Bearer public-native-fixture');
          const did = members.find((d) => addressOf(d) === url.searchParams.get('search'));
          return reply({
            ok: true,
            users: did ? [{ did, role: 'member', approved: 1, instance_did: 'fixture' }] : [],
            paging: { total: did ? 1 : 0 },
          });
        }
        if (url.pathname === '/afs') {
          const body = JSON.parse(bytes),
            p = body.params?.path;
          if (p?.startsWith('/dev/chain/')) {
            assert.equal(body.method, 'read');
            if (p.endsWith('/.meta/.capabilities'))
              return reply({
                success: true,
                data: {
                  data: {
                    content: { operations: { read: true, list: true } },
                    meta: { provenance: { provider: 'ocap' } },
                  },
                },
              });
            const kind = p.split('/').at(-2),
              address = p.split('/').at(-1),
              owner = owners[address];
            const content =
              kind === 'tokens'
                ? { address, decimal: 18, symbol: 'TBA' }
                : kind === 'stakes' && owner
                  ? {
                      address,
                      sender: owner,
                      receiver: owner,
                      nonce: '',
                      revokeWaitingPeriod: 31536000,
                      assets: [],
                      revokedAssets: [],
                      tokens: [{ address: 'z35n6UoHSi9MED4uaQy6ozFgKPaZj2UKrurBG', value: '1000000000000000000' }],
                      revokedTokens: [],
                    }
                  : null;
            if (!content) return reply({ success: false, error: { code: 1 } });
            return reply({
              success: true,
              data: {
                data: {
                  path: p,
                  content,
                  meta: {
                    kind: 'ocap:' + { tokens: 'token', stakes: 'stake' }[kind],
                    provenance: { provider: 'ocap' },
                  },
                },
              },
            });
          }
        }
        const response = await arcHttpTransport(origin, publicOrigin)(origin + incoming.url, {
          method: incoming.method,
          headers: incoming.headers,
          body: bytes.length ? bytes : undefined,
        });
        const headers = Object.fromEntries(response.headers);
        if (response.headers.getSetCookie().length) headers['set-cookie'] = response.headers.getSetCookie();
        outgoing.writeHead(response.status, headers);
        outgoing.end(Buffer.from(await response.arrayBuffer()));
      });
      await new Promise((resolve) => platform.listen(0, '127.0.0.1', resolve));
      const platformUpgrade = previewArcWebSocket(previewRouting({ origin: publicOrigin, arc: origin }));
      platform.on('upgrade', (request, socket, head) => {
        request.url = new URL(request.url, publicOrigin).toString();
        platformUpgrade(request, socket, head);
      });
      const platformOrigin = 'http://127.0.0.1:' + platform.address().port;
      await new MailPolicyStore(localPolicyRoot(origin)).initialize(initialPolicyState('arc'));
      const initialized = await rpc(
        {
          type: 'exec',
          path: '/didmail-native/.actions/initialize-attachment-config',
          args: { version: '!absent', config: { maxFileSizeBytes: 2000000, maxFileCount: 5, pricePerBytePerDay: '0' } },
        },
        true,
      );
      assert.equal(initialized.ok, true, JSON.stringify(initialized));
      occupied = http.createServer((_req, res) => res.end());
      await new Promise((resolve) => occupied.listen(publicPort, '127.0.0.1', resolve));
      const configuration = {
        schemaVersion: 1,
        enabled: true,
        publicOrigin,
        arcOrigin: platformOrigin,
        listenHost: '127.0.0.1',
        listenPort: publicPort,
        aliases: '',
        jobsIntervalSeconds: 5,
        vars: {
          DIDMAIL_MEMBER_ACCESS: 'arc',
          DIDMAIL_ACCOUNT_LINKS_ENABLED: '1',
          DIDMAIL_ACCOUNT_ORIGIN: publicOrigin,
          DIDMAIL_ARC_INSTANCE_ID: 'fixture',
          CHAIN_HOST: platformOrigin + '/chain',
          ARC_CHAIN_ENDPOINT: platformOrigin + '/chain',
          ARC_CHAIN_PATH: '/dev/chain/beta',
          FACTORY_OWNER: '0x73AEAc8Be08298fD383152335A182E3e307Eb95a',
        },
        secrets: {
          NODE_SECRET_KEY: wallet.secretKey,
          NODE_ADDRESS: wallet.address,
          ARC_MEMBERS_TOKEN: 'public-native-fixture',
        },
      };
      const install = () =>
        rpc({ type: 'exec', path: '/didmail-http/.actions/install-config', args: { config: configuration } }, true);
      assert.equal((await install()).ok, true);
      assert.notEqual((await install()).ok, true, 'Installation cannot replace an existing identity');
      const blocked = await rpc({ type: 'read', path: '/didmail-http/health.json' });
      assert.equal(JSON.parse(blocked.data.content).protocolIngress, false);
      await new Promise((resolve) => occupied.close(resolve));
      occupied = undefined;
      const ready = await rpc({ type: 'read', path: '/didmail-http/health.json' });
      assert.equal(ready.ok, true, JSON.stringify(ready));
      assert.equal(JSON.parse(ready.data.content).protocolIngress, true);
      const response = await fetch(publicOrigin + '/api/health');
      assert.equal(response.status, 200);
      const health = await response.json();
      assert.equal(health.runtime, 'arc-native');
      assert.equal(health.node, wallet.address);
      const discovery = await fetch(publicOrigin + '/.well-known/didmail');
      assert.equal(discovery.status, 200, await discovery.clone().text());
      const session = await fetch(publicOrigin + '/api/runtime/session');
      assert.equal(session.status, 200, await session.clone().text());
      assert.equal((await session.json()).authenticated, false);
      const wsClient = createInstanceConfigClient({
        origin: publicOrigin,
        Socket: class extends WebSocket {
          constructor(url) {
            super(url, {
              headers: { Origin: publicOrigin, 'x-caller-role': 'owner', 'x-caller-did': 'did:test:forged' },
            });
          }
        },
      });
      assert.equal((await wsClient.read()).config.maxFileCount, 5, 'Binary-safe native upgrade reaches real ARC AFS');
      assert.equal((await wsClient.session()).authenticated, false, 'Native upgrade strips synthetic owner headers');
      const rejectedOrigin = await new Promise((resolve) => {
        const ws = new WebSocket(publicOrigin.replace('http:', 'ws:') + '/?blocklet=didmail-server', {
          origin: 'https://attacker.invalid',
        });
        ws.on('unexpected-response', (_request, response) => {
          response.resume();
          resolve(response.statusCode);
        });
        ws.on('error', () => {});
      });
      assert.equal(rejectedOrigin, 403);
      const wrongHost = await new Promise((resolve, reject) => {
        const request = http.get(
          { hostname: '127.0.0.1', port: publicPort, path: '/api/health', headers: { Host: 'attacker.invalid' } },
          (response) => {
            response.resume();
            resolve(response.statusCode);
          },
        );
        request.on('error', reject);
      });
      assert.equal(wrongHost, 421);
      const usage = await fetch(publicOrigin + '/api/storage/size', {
        headers: { authorization: 'Bearer public-admin-fixture' },
      });
      assert.equal(usage.status, 200);
      const sizes = await usage.json();
      assert.equal(sizes.basis, 'afs-json');
      assert.ok(sizes.sizeBytes > 0);
      assert.equal(sizes.includesObjects, false);
      assert.equal(
        (
          await fetch(publicOrigin + '/api/storage/size', {
            headers: { authorization: 'Bearer public-member-fixture' },
          })
        ).status,
        403,
      );
      assert.equal((await fetch(publicOrigin + '/api/storage/size')).status, 401);
      const binding = createNativeStorageBinding(origin),
        db = businessDatabase({
          transaction: (statements) => nativeStorageOperation(binding, { op: 'transaction', statements }),
        });
      for (const [index, w] of [alice, bob].entries())
        await db
          .prepare(
            "INSERT INTO account_links(arc_id,mailbox_id,mailbox_public_key,revision,proof_json,created_at,updated_at) VALUES(?,?,?,1,'{}','fixture','fixture')",
          )
          .bind(members[index], identityId(w.address), 'fixture')
          .run();
      const client = (w) =>
        new DmpClient({
          endpoint: publicOrigin,
          identityId: identityId(w.address),
          secretKey: toUint8Array(w.secretKey),
          matches: (pk, did) => {
            const address = addressOf(did);
            return fromPublicKey(pk, fromAddress(address).type).address === address;
          },
          pinService: async () => {},
          store: { put: async () => {}, get: async () => {}, remove: async () => {} },
          transport: async (url, method, headers, body) => {
            const r = await fetch(url, { method, headers, ...(method === 'GET' ? {} : { body }), redirect: 'manual' });
            return { status: r.status, headers: r.headers, body: new Uint8Array(await r.arrayBuffer()) };
          },
        });
      const a = client(alice),
        b = client(bob);
      await a.connect();
      await b.connect();
      await b.ownKey();
      const attachment = new Uint8Array(1100000).map((_, i) => i % 251);
      const delivery = await a.create({
        recipientId: identityId(bob.address),
        subject: 'Native ARC fixture',
        body: 'Encrypted source-only package',
        attachments: [{ fileName: 'fixture.bin', mediaType: 'application/octet-stream', bytes: attachment }],
      });
      const prepared = await a.prepare(delivery);
      assert.equal(prepared.mode, 'server');
      await db
        .prepare("UPDATE dmp_messages SET lease_owner='restart-fixture',lease_expires_at=? WHERE id=?")
        .bind(Date.now() + 60000, delivery.manifest.messageId)
        .run();
      await a.submit(delivery, '');
      const accepted = await db
        .prepare('SELECT accepted_at,quote_json,manifest_json,state FROM dmp_messages WHERE id=?')
        .bind(delivery.manifest.messageId)
        .first();
      assert.ok(accepted.accepted_at);
      assert.equal(accepted.state, 'queued');
      const signedUrl = publicOrigin + '/v1/messages?mailbox=outbox',
        signedHeaders = signRequest(
          'GET',
          signedUrl,
          new Uint8Array(),
          identityId(alice.address),
          toUint8Array(alice.secretKey),
        );
      assert.equal((await fetch(signedUrl, { headers: signedHeaders })).status, 200);
      assert.equal((await fetch(signedUrl, { headers: signedHeaders })).status, 409);
      for (const path of ['/api/account/state', '/api/storage/mails'])
        assert.notEqual(
          (
            await fetch(publicOrigin + path, {
              headers: { 'x-caller-role': 'owner', 'x-caller-did': 'did:test:forged' },
            })
          ).status,
          200,
        );
      assert.notEqual(
        (await rpc({ type: 'read', path: '/instance/app/didmail/private/protocol-runtime.json' })).ok,
        true,
      );
      assert.notEqual(
        (await rpc({ type: 'exec', path: '/didmail-http/.actions/install-config', args: { config: {} } })).ok,
        true,
      );
      const status = JSON.parse((await arc('service', 'status', '--instance', instance, '--json')).stdout);
      const listener = await run('lsof', ['-tiTCP:' + publicPort, '-sTCP:LISTEN']);
      assert.equal(Number(listener.stdout.trim()), status.pid);
      await arc('service', 'restart', '--instance', instance, '--json');
      // ARC activates application providers lazily. The standard app mount read is
      // sufficient; no repository executor, Worker bundle or dependency tree runs.
      assert.equal(
        JSON.parse((await rpc({ type: 'read', path: '/didmail-http/health.json' })).data.content).protocolIngress,
        true,
      );
      assert.equal((await (await fetch(publicOrigin + '/api/health')).json()).node, wallet.address);
      assert.equal((await fetch(signedUrl, { headers: signedHeaders })).status, 409, 'Nonces survive ARC restart');
      assert.deepEqual(
        await db
          .prepare('SELECT accepted_at,quote_json,manifest_json,state FROM dmp_messages WHERE id=?')
          .bind(delivery.manifest.messageId)
          .first(),
        accepted,
      );
      await db
        .prepare('UPDATE dmp_messages SET lease_owner=NULL,lease_expires_at=0 WHERE id=?')
        .bind(delivery.manifest.messageId)
        .run();
      const deadline = Date.now() + 15000;
      while ((await a.status(delivery.manifest.messageId)).state !== 'delivered' && Date.now() < deadline)
        await new Promise((resolve) => setTimeout(resolve, 250));
      assert.equal(
        (await a.status(delivery.manifest.messageId)).state,
        'delivered',
        'Native ARC scheduler resumes the accepted task',
      );
      const bundle = await b.manifest(delivery.manifest.messageId),
        document = await b.document(bundle.manifest, bundle.receipt);
      assert.equal(document.subject, 'Native ARC fixture');
      assert.deepEqual(
        await b.blob(bundle.manifest, document.attachments[0].blobId, bundle.receipt.acceptedAt),
        attachment,
      );
      await a.submit(delivery, ''); // Retry after an unknown acknowledgement must not duplicate delivery.
      assert.equal(
        (
          await db
            .prepare('SELECT count(*) n FROM dmp_internal_deliveries WHERE message_id=?')
            .bind(delivery.manifest.messageId)
            .first()
        ).n,
        1,
      );
      assert.equal(forbiddenNetwork, 0, 'No chain transaction was sent');
    } finally {
      if (occupied) await new Promise((resolve) => occupied.close(resolve));
      if (platform) {
        platform.closeAllConnections();
        await new Promise((resolve) => platform.close(resolve));
      }
      if (started) await arc('service', 'delete', '--instance', instance, '--force', '--yes');
      await fs.rm(directory, { recursive: true, force: true });
    }
  },
);
