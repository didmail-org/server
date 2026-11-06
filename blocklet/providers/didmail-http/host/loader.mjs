import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { realpathSync, readFileSync, existsSync, statSync } from 'node:fs';
import { builtinModules } from 'node:module';
import manifest from '../vendor/manifest.json' with { type: 'json' };
const base = realpathSync(fileURLToPath(new URL('../', import.meta.url))) + path.sep;
const packageBase = realpathSync(fileURLToPath(new URL('../../../', import.meta.url))) + path.sep;
const namespace = 'didmail-source';
function resolveFile(file) {
  for (const candidate of [file, file + '.ts', file + '.mjs', file + '.js', file + '.json', file + '/index.ts'])
    if (existsSync(candidate) && statSync(candidate).isFile()) return realpathSync(candidate);
  throw Error('Unpackaged DIDMail source module');
}
function target(specifier, importer, kind = 'import') {
  if (specifier.startsWith('node:')) return specifier;
  if (builtinModules.includes(specifier)) return 'node:' + specifier;
  if (specifier.startsWith('cloudflare:')) throw Error('Cloudflare is not a native DIDMail runtime dependency');
  const stub = { sequelize: 'sequelize.ts', 'node-fetch': 'node-fetch.ts', depd: 'depd.cjs', '@arcblock/ws': 'ws.ts' }[
    specifier
  ];
  let file;
  if (stub) file = base + 'source/runtime/' + stub;
  else if (specifier.startsWith('.')) {
    file = path.resolve(path.dirname(importer), specifier);
  } else if (specifier.startsWith('/')) file = specifier;
  else {
    const entry = manifest.specifiers[specifier];
    if (!entry) throw Error('Unpackaged DIDMail dependency');
    file = base + 'vendor/' + entry[kind];
  }
  file = resolveFile(file);
  if (!file.startsWith(packageBase)) throw Error('Outside packaged DIDMail module scope');
  // Existing pure providers and the immutable environment retain their normal
  // module identity. Every application/dependency module is loaded from dist.
  if (!file.startsWith(base) || [base + 'host/environment.mjs', base + 'host/runtime.mjs'].includes(file)) return file;
  return namespace + ':' + file;
}
let registered = false;
export function registerLoader() {
  if (registered) return;
  if (typeof globalThis.Bun?.plugin !== 'function') throw Error('ARC native module loading is unavailable');
  Bun.plugin({
    name: 'didmail-packaged-protocol',
    setup(build) {
      build.onResolve({ filter: /.*/ }, (args) => {
        if (!args.importer.startsWith(base)) return;
        const resolved = target(args.path, args.importer);
        if (resolved.startsWith(namespace + ':')) return { path: resolved.slice(namespace.length + 1), namespace };
        return { path: resolved };
      });
      build.onLoad({ filter: /.*/, namespace }, (args) => {
        const file = resolveFile(args.path),
          loader = file.endsWith('.ts') ? 'ts' : file.endsWith('.json') ? 'json' : 'js';
        if (!file.startsWith(base)) throw Error('Outside packaged DIDMail module scope');
        let contents = readFileSync(file, 'utf8');
        const imports =
          loader === 'json'
            ? new Set()
            : new Set(new Bun.Transpiler({ loader }).scanImports(contents).map((item) => item.path));
        if (loader !== 'json') {
          contents = contents.replace(
            /(\b(?:__)?require)\(\s*(['"])([^'"\n]+)\2\s*\)/g,
            (whole, fn, quote, specifier) => {
              if (
                !imports.has(specifier) &&
                !(
                  fn === '__require' &&
                  (specifier.startsWith('node:') ||
                    builtinModules.includes(specifier) ||
                    ['sequelize', 'node-fetch', 'depd', '@arcblock/ws'].includes(specifier))
                )
              )
                return whole;
              const resolved = target(specifier, file, 'require');
              const call = fn + '(' + JSON.stringify(resolved) + ')';
              return resolved.startsWith(namespace + ':') ? '(' + call + '.default ?? ' + call + ')' : call;
            },
          );
          contents = contents.replace(
            /((?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*))(['"])([^'"\n]+)\2/g,
            (whole, prefix, quote, specifier) => {
              if (!imports.has(specifier)) return whole;
              return prefix + quote + target(specifier, file) + quote;
            },
          );
          // Bun's virtual JS namespace uses ESM semantics even for a .cjs path.
          // These tiny facades/stubs use only module.exports; preserve that boundary.
          if (file.endsWith('.cjs'))
            contents =
              'const module={exports:{}};const exports=module.exports;\n' +
              contents +
              '\nexport default module.exports;';
        }
        // beta.74's virtual loader parses extensionless modules as JavaScript.
        // Use the embedded runtime's TypeScript parser, with no generated app artifact.
        if (loader === 'json')
          return { contents: 'export default ' + JSON.stringify(JSON.parse(contents)) + ';', loader: 'js' };
        return { contents: new Bun.Transpiler({ loader }).transformSync(contents), loader: 'js' };
      });
    },
  });
  registered = true;
}
