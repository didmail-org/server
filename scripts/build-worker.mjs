import { build } from 'esbuild';
import path from 'node:path';
import fs from 'node:fs/promises';
import { copyDistributionNotices } from './distribution-notices.mjs';
const root = process.cwd();
const replacements = new Map(
  Object.entries({
    'api/src/libs/sqlite.ts': 'workers/database.ts',
    'api/src/libs/template-cache-store.ts': 'workers/template-cache-store.ts',
    'api/src/libs/rate-limit.ts': 'workers/rate-limit.ts',
    'api/src/libs/env.ts': 'workers/env.ts',
    'api/src/runtime/env.ts': 'workers/runtime-env.ts',
    'api/src/runtime/wallet.ts': 'workers/wallet.ts',
    'api/src/runtime/payment-nonce.ts': 'workers/payment-nonce.ts',
    'api/src/runtime/session.ts': 'workers/session.ts',
    'api/src/runtime/chain-read.ts': 'workers/chain-read.ts',
    'api/src/runtime/template-token.ts': 'workers/template-token.ts',
  }).map(([a, b]) => [path.join(root, a), path.join(root, b)]),
);
const result = await build({
  entryPoints: [process.argv.includes('--test') ? 'tests/workers/entry.ts' : 'workers/index.ts'],
  outfile: process.argv.includes('--test') ? '.worker/test.mjs' : '.worker/index.mjs',
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire('/worker/index.mjs');" },
  mainFields: ['module', 'main'],
  conditions: ['workerd', 'worker', 'node'],
  target: 'es2022',
  external: ['node:*', 'cloudflare:*'],
  packages: 'bundle',
  loader: { '.css': 'text' },
  metafile: true,
  plugins: [
    {
      name: 'worker-runtime',
      setup(b) {
        b.onResolve({ filter: /.*/ }, (args) => {
          // The Worker uses Axios' fetch adapter; keep Node HTTP/2 and proxy
          // transports out of the production bundle entirely.
          if (args.path === 'axios') return { path: path.join(root, 'node_modules/axios/dist/browser/axios.cjs') };
          if (args.path === 'node-fetch') return { path: path.join(root, 'workers/node-fetch.ts') };
          if (args.path === 'depd') return { path: path.join(root, 'workers/depd.cjs') };
          if (args.path === '@arcblock/ws') return { path: path.join(root, 'workers/ws.ts') };
          if (args.path === 'sequelize') return { path: path.join(root, 'workers/sequelize.ts') };
          if (args.path.startsWith('.')) {
            const base = path.resolve(args.resolveDir, args.path);
            const replacement = replacements.get(base) || replacements.get(base + '.ts');
            if (replacement) return { path: replacement };
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
if (!process.argv.includes('--test') && inputs.some((p) => p.startsWith('tests/')))
  throw new Error('Test harness included in production Worker');
for (const forbidden of ['sqlite3', 'sequelize/lib', 'api/src/runtime/wallet.ts', 'api/src/index.ts', 'http-proxy']) {
  if (inputs.some((p) => p.includes(forbidden))) throw new Error('Non-Worker dependency bundled: ' + forbidden);
}
await fs.writeFile(
  process.argv.includes('--test') ? '.worker/test-metafile.json' : '.worker/metafile.json',
  JSON.stringify(result.metafile, null, 2),
);
if (!process.argv.includes('--test')) {
  copyDistributionNotices('.worker/legal');
  // Wrangler deploys dist as ASSETS; sidecars next to the entry alone are not uploaded.
  copyDistributionNotices('dist');
}
console.log(`Worker bundled: ${inputs.length} modules; native SQLite, filesystem wallet and Node gateway excluded`);
