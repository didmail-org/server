// Isolated regression fixture only. This file cannot build or deploy a product backend.
import { build } from 'esbuild';
import path from 'node:path';
import fs from 'node:fs/promises';
const root = process.cwd();
const result = await build({
  entryPoints: ['tests/business/entry.ts'],
  outfile: 'artifacts/business-tests/test.mjs',
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire('/fixture/index.mjs');" },
  mainFields: ['module', 'main'],
  conditions: ['workerd', 'worker', 'node'],
  target: 'es2022',
  external: ['node:*', 'cloudflare:*'],
  packages: 'bundle',
  loader: { '.css': 'text' },
  metafile: true,
  plugins: [
    {
      name: 'business-test-container',
      setup(b) {
        b.onResolve({ filter: /.*/ }, (args) => {
          // The isolated test host uses Axios' fetch adapter; exclude Node
          // HTTP/2 and proxy transports from this fixture.
          if (args.path === 'axios') return { path: path.join(root, 'node_modules/axios/dist/browser/axios.cjs') };
          if (args.path === 'node-fetch') return { path: path.join(root, 'blocklet/providers/didmail-http/source/runtime/node-fetch.ts') };
          if (args.path === 'depd') return { path: path.join(root, 'blocklet/providers/didmail-http/source/runtime/depd.cjs') };
          if (args.path === '@arcblock/ws') return { path: path.join(root, 'blocklet/providers/didmail-http/source/runtime/ws.ts') };
          if (args.path === 'sequelize') return { path: path.join(root, 'blocklet/providers/didmail-http/source/runtime/sequelize.ts') };
          if (args.path.startsWith('.')) {
            const base = path.resolve(args.resolveDir, args.path);
            if (base === path.join(root, 'blocklet/providers/didmail-http/host/environment.mjs')) return { path: path.join(root, 'tests/business/host/environment.ts') };
            if (base === path.join(root, 'blocklet/providers/didmail-http/host/app.mjs')) return { path: path.join(root, 'tests/business/host/app.ts') };
          }
          if (
            /^(assert|buffer|crypto|events|fs|http|https|net|os|path|querystring|stream|stream\/.*|string_decoder|tls|tty|url|util|util\/types|vm|zlib|dns|async_hooks|timers|timers\/promises|module|process|punycode)$/.test(
              args.path,
            )
          )
            return { path: 'node:' + args.path, external: true };
        });
      },
    },
  ],
});
const inputs = Object.keys(result.metafile.inputs);
for (const forbidden of ['sqlite3', 'sequelize/lib', 'tests/support/node/', 'http-proxy']) {
  if (inputs.some((p) => p.includes(forbidden))) throw new Error('Unexpected test-container dependency: ' + forbidden);
}
if (inputs.some(file => file.startsWith('api/'))) throw new Error('Retired source tree in the business fixture');
await fs.writeFile('artifacts/business-tests/metafile.json', JSON.stringify(result.metafile, null, 2));
console.log(`Business test fixture bundled: ${inputs.length} modules; no production deployment artifact generated`);
