import { test } from 'node:test';
import assert from 'node:assert/strict';
import { browserDiagnostics } from './browser-diagnostics.mjs';

test('failure evidence returns even when the renderer never creates an evaluation context', { timeout: 5000 }, async () => {
  const handlers = new Map();
  const page = {
    on: (name, callback) => handlers.set(name, callback),
    url: () => 'https://fixture.test/stalled',
    evaluate: () => new Promise(() => {}),
    mainFrame: () => page,
  };
  const capture = browserDiagnostics(page);
  for (let i = 0; i < 200; i++) handlers.get('request')({ url: () => `https://fixture.test/${i}`, resourceType: () => 'script' });
  const result = await capture();
  assert.equal(result.document, null);
  assert.equal(result.url, 'https://fixture.test/stalled');
  assert.equal(result.pending.length, 100);
  assert.equal(result.omittedRequests, 100);
});
