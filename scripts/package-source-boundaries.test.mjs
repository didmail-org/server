import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { isBuiltin } from 'node:module';
import ts from 'typescript';
import { loadInputs } from './native-package-audit.mjs';

test('owned provider imports resolve inside the standalone Blocklet without a repository virtual tree', () => {
  const root = fs.realpathSync('blocklet');
  const inputs = loadInputs();
  const httpProvider = path.join(root, 'providers/didmail-http') + path.sep;
  const vendor = JSON.parse(inputs.get('providers/didmail-http/vendor/manifest.json'));
  const runtimeShims = ['sequelize', 'node-fetch', 'depd', '@arcblock/ws'];
  const offlineSettlement = 'providers/didmail-http/source/protocol/contact/contact-settlement.ts';
  let files = 0;
  let imports = 0;
  function inspect(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === 'vendor') continue;
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) { inspect(file); continue; }
      if (!/\.(ts|mts|mjs|cjs|js)$/.test(file)) continue;
      assert(!entry.isSymbolicLink(), `Owned provider source must be real package content: ${file}`);
      assert(inputs.has(path.relative(root, file)), `Owned provider module missing from publication: ${file}`);
      files++;
      const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
      function visit(node) {
        const specifier = ts.isImportDeclaration(node) || ts.isExportDeclaration(node)
          ? node.moduleSpecifier
          : ts.isCallExpression(node) &&
              (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
                ts.isIdentifier(node.expression) && node.expression.text === 'require')
            ? node.arguments[0] : undefined;
        if (specifier && ts.isStringLiteralLike(specifier)) {
          imports++;
          const name = specifier.text;
          if (name.startsWith('.')) {
            const target = path.resolve(path.dirname(file), name);
            const resolved = [target, target + '.ts', target + '.mjs', target + '.js', target + '.json', path.join(target, 'index.ts')]
              .find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
            assert(resolved, `${file}: missing physical import ${name}`);
            const relative = path.relative(root, resolved);
            assert.notEqual(relative, offlineSettlement, `${file}: the retained offline settlement adapter has no native asset facade`);
            assert(fs.realpathSync(resolved) === resolved && relative.startsWith('providers/') && inputs.has(relative),
              `${file}: import escapes published providers: ${name}`);
          } else if (!node.isTypeOnly && !node.importClause?.isTypeOnly &&
                     !(path.relative(root, file) === offlineSettlement && name === '@ocap/asset')) {
            assert(isBuiltin(name) || file.startsWith(httpProvider) &&
              (Object.hasOwn(vendor.specifiers, name) || runtimeShims.includes(name)),
              `${file}: dependency has no packaged resolver: ${name}`);
          }
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
