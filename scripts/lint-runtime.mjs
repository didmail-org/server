// Lint the actual package sources; outer compatibility facades are not a substitute.
import fs from 'node:fs/promises';
import path from 'node:path';
import { ESLint } from 'eslint';
const root = process.cwd();
const inputs = [];
async function collect(directory) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    if (['vendor', 'dist', '.web-cache', 'node_modules'].includes(entry.name)) continue;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await collect(file);
    else if (entry.isFile() && /\.(?:ts|mjs|js|cjs|mts)$/.test(file)) inputs.push(file);
  }
}
await collect('blocklet/providers');
await collect('blocklet/.web/components');
for (const file of ['scripts/legacy-wallet-setup.mjs', 'scripts/migration/import-legacy-sqlite.mjs', 'scripts/chain-status.mjs', 'scripts/cache-arc-core.mjs']) inputs.push(file);
const lint = new ESLint({
  useEslintrc: false,
  ignore: false,
  baseConfig: {
    root: true,
    env: { node: true, browser: true, es2022: true },
    parser: '@typescript-eslint/parser',
    parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    plugins: ['@typescript-eslint', 'import'],
    extends: ['eslint:recommended'],
    globals: { Bun: 'readonly' },
    rules: {
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true }],
    },
    overrides: [{
      files: ['blocklet/.web/components/**/*.js'],
      env: { node: false, browser: true },
    }, {
      files: ['**/*.ts', '**/*.mts'],
      rules: {
        'no-undef': 'off', // TypeScript checks type/value names in type-check:runtime.
        'no-redeclare': 'off',
        '@typescript-eslint/no-redeclare': 'error',
        'no-unused-vars': 'off',
        '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true }],
      },
    }],
  },
});
const results = [];
for (const file of inputs.sort()) {
  let source = await fs.readFile(file, 'utf8');
  if (file === 'blocklet/.web/components/didmail-chrome/script.js') {
    const start = source.indexOf('var nativeQueryCore =');
    const end = source.indexOf('const modules = Object.create(null);');
    if (start < 0 || end <= start) throw new Error('Native browser vendor boundary changed; review its lint scope');
    // Keep all authored application modules and original line numbers. Upstream
    // query/QR libraries are pinned assets and audited by provenance, not rewritten.
    const vendor = source.slice(start, end);
    source = source.slice(0, start) + 'var nativeQueryCore, nativeQrcode;' +
      vendor.slice('var nativeQueryCore, nativeQrcode;'.length).replace(/[^\n]/g, ' ') + source.slice(end);
  }
  results.push(...await lint.lintText(source, { filePath: path.resolve(root, file) }));
}
const formatter = await lint.loadFormatter('stylish');
process.stdout.write(formatter.format(results));
console.log(`Runtime lint: ${inputs.length} actual source files; pinned vendor bodies and generated outputs excluded.`);
if (results.some(result => result.errorCount)) process.exitCode = 1;
