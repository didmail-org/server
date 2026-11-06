import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');
export function routes(file) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const result = [];
  const walk = node => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) &&
        node.expression.expression.getText(source) === 'router' &&
        ['get', 'post', 'put', 'delete', 'patch'].includes(node.expression.name.text) &&
        node.arguments[0] && ts.isStringLiteral(node.arguments[0])) result.push(`${node.expression.name.text.toUpperCase()} ${node.arguments[0].text}`);
    ts.forEachChild(node, walk);
  };
  walk(source);
  return result.sort();
}
const baseline = JSON.parse(fs.readFileSync(new URL('../docs/legacy-routes.json', import.meta.url), 'utf8'));
test('every legacy router method and path is retained in the new server', () => {
  for (const [file, expected] of Object.entries(baseline)) {
    assert.deepEqual(routes(path.join('blocklet/providers/didmail-http/source/api/src/routes', file)), expected, file);
  }
});
