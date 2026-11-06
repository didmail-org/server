import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

test('owned provider imports resolve inside the standalone Blocklet without a repository virtual tree', () => {
  const root = fs.realpathSync('blocklet');
  let files = 0;
  let imports = 0;
  function inspect(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === 'vendor') continue;
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) { inspect(file); continue; }
      if (!/\.(ts|mts|mjs|cjs|js)$/.test(file)) continue;
      assert(!entry.isSymbolicLink(), `Owned provider source must be real package content: ${file}`);
      files++;
      const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
      function visit(node) {
        const specifier = ts.isImportDeclaration(node) || ts.isExportDeclaration(node)
          ? node.moduleSpecifier
          : ts.isCallExpression(node) &&
              (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
                ts.isIdentifier(node.expression) && node.expression.text === 'require')
            ? node.arguments[0] : undefined;
        if (specifier && ts.isStringLiteralLike(specifier) && specifier.text.startsWith('.')) {
          imports++;
          const target = path.resolve(path.dirname(file), specifier.text);
          const resolved = [target, target + '.ts', target + '.mjs', target + '.js', target + '.json', path.join(target, 'index.ts')]
            .find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
          assert(resolved, `${file}: missing physical import ${specifier.text}`);
          assert(fs.realpathSync(resolved).startsWith(root + path.sep), `${file}: import escapes the Blocklet: ${specifier.text}`);
        }
        ts.forEachChild(node, visit);
      }
      visit(source);
    }
  }
  inspect(path.join(root, 'providers'));
  assert(files > 0 && imports > 0, 'The package source/import graph must actually be inspected');
  for (const name of ['contact-base58', 'contact-mint-evidence', 'contact-payment-evidence', 'contact-preparation', 'contact-quote'])
    assert(fs.statSync(path.join(root, 'providers/didmail-http/source/protocol/contact', name + '.ts')).isFile(), name);
});
