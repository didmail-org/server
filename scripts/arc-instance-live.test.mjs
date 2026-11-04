import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);
const enabled = process.env.DIDMAIL_ARC_PROVIDER_TEST === '1';
const arc = (...args) => run('arc', args, { timeout: 45_000, maxBuffer: 2 * 1024 * 1024 });

test('local ARC instance retains a synthetic object across daemon restart', { skip: !enabled, timeout: 120_000 }, async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'arc-space-evidence-'));
  const app = path.join(root, 'app');
  const home = path.join(root, 'home');
  const instance = `arc-space-evidence-${randomUUID()}`;
  const appId = 'arc-space-evidence';
  const objectPath = `/blocklets/${appId}/instance/probe.txt`;
  const content = `synthetic-${randomUUID()}`;
  let startAttempted = false;
  const start = async () => {
    startAttempted = true;
    const { stdout } = await arc('service', 'start', '--instance', instance, '--home', home, '--blocklet', app, '--port', '0', '--purpose', 'evidence', '--no-advertise', '--print', 'port');
    const port = Number(stdout.trim().split(/\r?\n/).at(-1));
    assert.ok(Number.isInteger(port) && port > 0, 'ARC must report its assigned port');
    const status = await new Promise((resolve, reject) => {
      const request = http.get({ host: '127.0.0.1', port, path: '/', headers: { Host: `${appId}.localhost` } }, response => {
        response.resume();
        response.on('end', () => resolve(response.statusCode));
      });
      request.on('error', reject);
    });
    assert.equal(status, 200);
  };
  try {
    await arc('blocklet', 'create', app, '--recipe', 'minimal-app', '--name', appId);
    const build = await arc('blocklet', 'build', app);
    assert.match(build.stdout, /instance.*(?:required|requires)/i);
    await start();
    await arc('afs', 'write', objectPath, '--content', content, '--instance', instance);
    let read = await arc('afs', 'read', objectPath, '--instance', instance);
    assert.ok(read.stdout.includes(content));
    let winner;
    let staleVersion;
    for (let round = 0; round < 4; round++) {
      const stat = await arc('afs', 'stat', objectPath, '--instance', instance, '--json');
      const { version } = JSON.parse(stat.stdout);
      staleVersion = version;
      assert.ok(version, 'the instance provider must expose a concurrency version');
      const candidates = Array.from({ length: 8 }, () => `candidate-${randomUUID()}`);
      const writes = await Promise.allSettled(candidates.map(value =>
        arc('afs', 'write', objectPath, '--content', value, '--if-match', String(version), '--instance', instance)));
      assert.equal(writes.filter(result => result.status === 'fulfilled').length, 1, `round ${round}: exactly one write must succeed`);
      for (const conflict of writes.filter(result => result.status === 'rejected'))
        assert.match(`${conflict.reason.stdout} ${conflict.reason.stderr}`, /conflict/i);
      read = await arc('afs', 'read', objectPath, '--instance', instance);
      winner = candidates.find(candidate => read.stdout.includes(candidate));
      assert.ok(winner, 'one candidate must be stored');
    }
    await arc('service', 'stop', '--instance', instance);
    await start();
    read = await arc('afs', 'read', objectPath, '--instance', instance);
    assert.ok(read.stdout.includes(winner), 'instance data must survive a daemon restart');
    await assert.rejects(arc('afs', 'write', objectPath, '--content', 'stale-after-restart', '--if-match', String(staleVersion), '--instance', instance),
      error => /conflict/i.test(`${error.stdout} ${error.stderr}`), 'a pre-update version must remain stale after restart');
    read = await arc('afs', 'read', objectPath, '--instance', instance);
    assert.ok(read.stdout.includes(winner), 'a rejected stale write must leave the winning data intact');
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
