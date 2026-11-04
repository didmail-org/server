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

const run = promisify(execFile);
const enabled = process.env.DIDMAIL_ARC_PROVIDER_TEST === '1';
const provider = fileURLToPath(new URL('../blocklet/providers/didmail/', import.meta.url));
const arc = (...args) => run('arc', args, { timeout: 45_000, maxBuffer: 2 * 1024 * 1024 });

test('local ARC exposes DIDMail read-only provider through app-scoped RPC', { skip: !enabled, timeout: 120_000 }, async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'arc-provider-evidence-'));
  const app = path.join(root, 'app');
  const home = path.join(root, 'home');
  const instance = `arc-provider-evidence-${randomUUID()}`;
  const appId = 'didmail-provider-evidence';
  let startAttempted = false;
  let upstreamStatus = 200;
  const upstream = http.createServer((req, res) => {
    const bodies = { '/api/health': { fixture: 'health' }, '/api/mail/attachment-config': { fixture: 'attachment' } };
    const body = bodies[req.url];
    res.writeHead(body ? upstreamStatus : 404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body ?? {}));
  });
  await new Promise((resolve, reject) => upstream.once('error', reject).listen(0, '127.0.0.1', resolve));
  try {
    await arc('blocklet', 'create', app, '--recipe', 'minimal-app', '--name', appId);
    const providerDir = path.join(app, 'providers', 'didmail');
    await mkdir(path.dirname(providerDir), { recursive: true });
    await cp(provider, providerDir, { recursive: true });
    await writeFile(path.join(providerDir, 'config.json'), JSON.stringify({ endpoint: `http://127.0.0.1:${upstream.address().port}` }));
    await writeFile(path.join(app, 'blocklet.yaml'), `specVersion: 2\nid: ${appId}\nname: ${appId}\ndid: did:blocklet:${appId}\nversion: 0.1.0\ndescription: Isolated provider integration fixture\nscope: app\nmounts:\n  - target: ./providers/didmail\n    path: /didmail\n    required: true\n    ops: [list, read, stat, explain]\n`);
    startAttempted = true;
    const { stdout } = await arc('service', 'start', '--instance', instance, '--home', home, '--blocklet', app, '--port', '0', '--purpose', 'evidence', '--no-advertise', '--print', 'port');
    const port = Number(stdout.trim().split(/\r?\n/).at(-1));
    assert.ok(Number.isInteger(port) && port > 0, 'ARC must report its assigned port');
    const rpc = (type, resource) => new Promise((resolve, reject) => {
      const request = http.request({ host: '127.0.0.1', port, path: '/api/afs/rpc', method: 'POST', headers: { Host: `${appId}.localhost`, 'Content-Type': 'application/json' } }, response => {
        let body = '';
        response.setEncoding('utf8');
        response.on('data', chunk => { body += chunk; });
        response.on('end', () => { try { resolve({ status: response.statusCode, body: JSON.parse(body) }); } catch (error) { reject(error); } });
      });
      request.on('error', reject);
      request.end(JSON.stringify({ type, path: resource }));
    });
    const list = await rpc('list', '/didmail');
    assert.equal(list.body.ok, true);
    assert.deepEqual(list.body.data.map(entry => entry.path).sort(), ['/didmail/attachment-config.json', '/didmail/health.json']);
    for (const [resource, fixture] of [['health.json', 'health'], ['attachment-config.json', 'attachment']]) {
      const result = await rpc('read', `/didmail/${resource}`);
      assert.equal(result.body.ok, true);
      assert.equal(JSON.parse(result.body.data.content).fixture, fixture);
    }
    const missing = await rpc('read', '/didmail/missing.json');
    assert.equal(missing.status, 404);
    const write = await rpc('write', '/didmail/health.json');
    assert.notEqual(write.body.ok, true);
    assert.match(write.body.error, /authentication required/i);
    upstreamStatus = 503;
    const unavailable = await rpc('read', '/didmail/health.json');
    assert.notEqual(unavailable.body.ok, true);
  } finally {
    let safeToRemove = !startAttempted;
    try {
      if (startAttempted) {
        await arc('service', 'delete', '--instance', instance, '--force', '--yes');
        safeToRemove = true;
      }
    } finally {
      await new Promise(resolve => upstream.close(resolve));
      if (safeToRemove) await rm(root, { recursive: true, force: true });
    }
  }
});
