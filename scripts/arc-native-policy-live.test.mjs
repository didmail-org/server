import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, mkdir, cp, writeFile, rm } from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';
import { createInstanceConfigClient } from '../ui/instance-config.js';

const run = promisify(execFile);
const arc = (...args) => run('arc', args, { timeout: 45_000, maxBuffer: 2 * 1024 * 1024, env: { ...process.env, AFS_TEST_ALLOW_CALLER_HEADER: '1' } });
const provider = fileURLToPath(new URL('../blocklet/providers/didmail-native/', import.meta.url));
const enabled = process.env.DIDMAIL_ARC_PROVIDER_TEST === '1';

test('native attachment policy reads instance data and survives restart without a Worker', { skip: !enabled, timeout: 120_000 }, async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'arc-policy-evidence-'));
  const app = path.join(root, 'app');
  const instance = `arc-policy-evidence-${randomUUID()}`;
  const appId = 'didmail-server';
  const target = `/blocklets/${appId}/instance/app/didmail/public/attachment-config.json`;
  const policy = { maxFileSizeBytes: 1024, maxFileCount: 3, pricePerBytePerDay: '10', updatedAt: '2026-11-03T00:00:00.000Z' };
  let startAttempted = false;
  let port;
  const start = async () => {
    startAttempted = true;
    const { stdout } = await arc('service', 'start', '--instance', instance, '--home', path.join(root, 'home'), '--blocklet', app, '--port', '0', '--purpose', 'evidence', '--no-advertise', '--print', 'port');
    port = Number(stdout.trim().split(/\r?\n/).at(-1));
    assert.ok(Number.isInteger(port) && port > 0);
    const status = await new Promise((resolve, reject) => {
      const request = http.get({ host: '127.0.0.1', port, path: '/', headers: { Host: `${appId}.localhost` } }, response => { response.resume(); response.on('end', () => resolve(response.statusCode)); });
      request.on('error', reject);
    });
    assert.equal(status, 200);
  };
  const rpc = body => new Promise((resolve, reject) => {
    const request = http.request({ host: '127.0.0.1', port, path: '/api/afs/rpc', method: 'POST', headers: { Host: `${appId}.localhost`, 'Content-Type': 'application/json' } }, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => { try { resolve(JSON.parse(body)); } catch (error) { reject(error); } });
    });
    request.on('error', reject);
    request.end(JSON.stringify(body));
  });
  const read = () => rpc({ type: 'read', path: '/didmail-native/attachment-config.json' });
  const policyAction = async (version, config, role = 'admin', origin) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/?blocklet=${appId}`, { headers: { 'x-caller-did': 'did:test:policy-user', 'x-caller-role': role, ...(origin ? { Origin: origin } : {}) } });
    try {
      const result = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('ARC test session timed out')), 15_000);
        ws.on('error', error => { clearTimeout(timer); reject(error); });
        ws.on('open', () => ws.send(JSON.stringify({ type: 'join_session', blocklet: appId, page: 'index' })));
        ws.on('message', data => {
          const message = JSON.parse(String(data));
          if (message.type === 'session') ws.send(JSON.stringify({ type: 'afs_exec', reqId: 'policy-update', path: '/didmail-native/.actions/' + (version === '!absent' ? 'initialize' : 'update') + '-attachment-config', args: { version, config } }));
          if (message.reqId === 'policy-update') { clearTimeout(timer); resolve(message); }
        });
      });
      return result;
    } finally { ws.close(); }
  };
  try {
    await arc('blocklet', 'create', app, '--recipe', 'minimal-app', '--name', appId);
    const dest = path.join(app, 'providers', 'didmail-native');
    await mkdir(path.dirname(dest), { recursive: true });
    await cp(provider, dest, { recursive: true });
    await writeFile(path.join(app, 'blocklet.yaml'), `specVersion: 2\nid: ${appId}\nname: ${appId}\ndid: did:blocklet:${appId}\nversion: 0.1.0\nscope: app\ninstance:\n  required: true\nmounts:\n  - target: ./providers/didmail-native\n    path: /didmail-native\n    required: true\n    ops: [list, read, stat, explain, exec]\nnetworkRead:\n  - path: /instance/app/didmail/public/attachment-config.json\n    role: guest\n`);
    await start();
    const missing = await read();
    assert.notEqual(missing.ok, true);
    await assert.rejects(createInstanceConfigClient({ origin: `http://127.0.0.1:${port}`, Socket: WebSocket }).read(), { code: 'AFS_NOT_FOUND' });
    const memberInit = await policyAction('!absent', policy, 'member');
    assert.equal(memberInit.type, 'afs_error');
    assert.equal(memberInit.code, 'AFS_FORBIDDEN');
    const initial = await policyAction('!absent', policy);
    assert.equal(initial.type, 'afs_result', JSON.stringify(initial));
    const duplicate = await policyAction('!absent', { ...policy, maxFileCount: 99 });
    assert.equal(duplicate.type, 'afs_error');
    assert.equal(duplicate.code, 'AFS_CONFLICT');
    assert.equal(JSON.parse((await read()).data.content).maxFileCount, 3, 'initialization never replaces an existing object');
    await arc('afs', 'write', target, '--content', JSON.stringify(policy), '--instance', instance);
    let result = await read();
    assert.equal(result.ok, true);
    assert.deepEqual(JSON.parse(result.data.content), policy);
    assert.equal(typeof result.data.meta.version, 'string', 'the policy read must provide a version for updates');
    const client = createInstanceConfigClient({ origin: `http://127.0.0.1:${port}`, Socket: class extends WebSocket {
      constructor(url) { super(url, { headers: { 'x-caller-did': 'did:test:policy-user', 'x-caller-role': 'admin' } }); }
    } });
    assert.equal((await client.session()).user.role, 'admin');
    assert.deepEqual((await client.read()).config, policy, 'the actual browser transport reads the instance without a Worker');
    const crossOrigin = await policyAction(result.data.meta.version, { ...policy, maxFileCount: 99 }, 'admin', 'https://attacker.invalid').catch(() => ({ type: 'rejected' }));
    assert.notEqual(crossOrigin.type, 'afs_result', 'cross-origin WebSocket mutations must be refused by ARC');
    const denied = await rpc({ type: 'write', path: '/didmail-native/attachment-config.json', content: JSON.stringify({ ...policy, maxFileCount: 99 }) });
    assert.notEqual(denied.ok, true, 'anonymous callers must not modify policy through the provider');
    const directWrite = await rpc({ type: 'write', path: '/instance/app/didmail/public/attachment-config.json', content: JSON.stringify({ ...policy, maxFileCount: 99 }) });
    assert.notEqual(directWrite.ok, true, 'public read access must not grant anonymous instance writes');
    const actionStat = await rpc({ type: 'stat', path: '/didmail-native/.actions/update-attachment-config' });
    assert.equal(actionStat.ok, true, 'the update action must be discoverable');
    assert.equal(actionStat.data.meta.effect, 'write');
    const deniedAction = await rpc({ type: 'exec', path: '/didmail-native/.actions/update-attachment-config', args: { version: 'fake', config: policy, caller: { did: 'did:test:attacker', role: 'admin' } } });
    assert.notEqual(deniedAction.ok, true, 'anonymous callers cannot forge an administrator action');
    assert.deepEqual(JSON.parse((await read()).data.content), policy, 'rejected writes must leave policy intact');
    const memberResult = await policyAction(result.data.meta.version, { ...policy, maxFileCount: 99 }, 'member');
    assert.equal(memberResult.type, 'afs_error');
    assert.equal(memberResult.code, 'AFS_FORBIDDEN');
    const oldVersion = result.data.meta.version;
    const adminResult = await client.update(oldVersion, { ...policy, maxFileCount: 4 });
    assert.equal(adminResult.maxFileCount, 4, JSON.stringify(adminResult));
    result = await read();
    assert.equal(JSON.parse(result.data.content).maxFileCount, 4, 'authorized update must persist');
    const stale = await policyAction(oldVersion, { ...policy, maxFileCount: 99 });
    assert.equal(stale.type, 'afs_error');
    assert.equal(stale.code, 'AFS_CONFLICT');
    const concurrent = await Promise.all([5, 6].map(maxFileCount => policyAction(result.data.meta.version, { ...policy, maxFileCount })));
    assert.equal(concurrent.filter(entry => entry.type === 'afs_result').length, 1);
    assert.equal(concurrent.filter(entry => entry.type === 'afs_error' && entry.code === 'AFS_CONFLICT').length, 1);
    result = await read();
    assert.ok([5, 6].includes(JSON.parse(result.data.content).maxFileCount));
    const persisted = JSON.parse(result.data.content);
    await arc('service', 'stop', '--instance', instance);
    await start();
    result = await read();
    assert.deepEqual(JSON.parse(result.data.content), persisted, 'authorized updates must survive restart');
    await arc('afs', 'write', target, '--content', '{invalid-json', '--instance', instance);
    result = await read();
    assert.notEqual(result.ok, true, 'invalid instance data must not be exposed as a valid policy');
    await arc('afs', 'write', target, '--content', JSON.stringify(persisted), '--instance', instance);
    result = await read();
    assert.equal(result.ok, true, 'correcting instance data must restore reads');
    assert.deepEqual(JSON.parse(result.data.content), persisted);
    await arc('service', 'stop', '--instance', instance);
    await start();
    result = await read();
    assert.equal(result.ok, true);
    assert.deepEqual(JSON.parse(result.data.content), persisted);
  } finally {
    let safeToRemove = !startAttempted;
    try {
      if (startAttempted) {
        await arc('service', 'delete', '--instance', instance, '--force', '--yes');
        safeToRemove = true;
      }
    } finally {
      if (safeToRemove) await rm(root, { recursive: true, force: true });
    }
  }
});
