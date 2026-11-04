// Package the genuine ARC public stylesheet for the standalone ASSETS binding.
// ARC serves this resource itself; native page exports currently only reference it.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
async function references(directory) {
  const found = new Set();
  async function walk(current) {
    for (const entry of await fs.readdir(current, { withFileTypes: true })) {
      const file = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(file);
      else if (entry.isFile() && entry.name.endsWith('.html')) {
        const html = await fs.readFile(file, 'utf8');
        for (const match of html.matchAll(/\bhref=["'](\/aup-core\.[a-f0-9]{16}\.css)["']/g)) found.add(match[1]);
      }
    }
  }
  await walk(directory);
  if (!found.size) throw new Error('Native pages must reference the ARC core stylesheet.');
  return [...found].sort();
}
function validate(bytes, reference) {
  const hash = digest(bytes);
  if (reference !== `/aup-core.${hash.slice(0, 16)}.css`)
    throw new Error('ARC core stylesheet content does not match its referenced hash.');
  const css = bytes.toString('utf8');
  if (!['.aup-app-header', '.aup-app-header-bar', '.aup-app-header-action'].every((selector) => css.includes(selector)))
    throw new Error('Expected the genuine ARC public core stylesheet.');
  return { path: reference, sha256: hash, bytes: bytes.length };
}
export async function packageWorkerCore({ directory, cssFile }) {
  const refs = await references(directory);
  const bytes = await fs.readFile(cssFile);
  const assets = refs.map((reference) => validate(bytes, reference));
  // Validate every reference before creating an asset; no guessed/replacement CSS.
  for (const asset of assets) await fs.writeFile(path.join(directory, asset.path.slice(1)), bytes);
  await fs.writeFile(
    path.join(directory, 'worker-core-assets.json'),
    JSON.stringify(
      {
        schemaVersion: 1,
        source: 'explicit-offline-public-arc-core-css',
        assets,
      },
      null,
      2,
    ) + '\n',
  );
  return assets;
}
export async function verifyWorkerCore({ directory }) {
  const assets = [];
  for (const reference of await references(directory)) {
    const file = path.join(directory, reference.slice(1));
    let bytes;
    try {
      bytes = await fs.readFile(file);
    } catch (error) {
      if (error.code === 'ENOENT')
        throw new Error(
          'Standalone Worker assets lack ARC core CSS. Build with DIDMAIL_WORKER_CORE_CSS pointing to the matching genuine offline public stylesheet.',
        );
      throw error;
    }
    assets.push(validate(bytes, reference));
  }
  return assets;
}
