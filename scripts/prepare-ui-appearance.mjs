// ARC beta.74's system prelude deletes local-only explicit preferences. Replace
// that single appearance bootstrap during the normal native UI build, leaving
// native pages, routing, identity and header rendering intact.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { prepareAppearanceHtml, prepareNativeAppearanceScript } from '../ui/native-appearance.js';
export { prepareAppearanceHtml, prepareNativeAppearanceScript } from '../ui/native-appearance.js';

export async function prepareAppearanceArtifacts({ root = path.resolve('blocklet'), cssPath = path.resolve('ui/brand.css') } = {}) {
  const css = await fs.readFile(cssPath, 'utf8');
  const walk = async (directory) => {
    const files = [];
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const name = path.join(directory, entry.name);
      if (entry.isDirectory()) files.push(...await walk(name));
      else if (entry.isFile() && entry.name.endsWith('.html')) files.push(name);
    }
    return files;
  };
  let count = 0;
  const renamed = new Map();
  for (const cache of [path.join(root, '.web-cache'), path.join(root, 'dist/.web-cache')]) {
    const assets = path.join(cache, '_arc/assets');
    let nativeCount = 0;
    for (const name of await fs.readdir(assets)) {
      if (!name.endsWith('.js')) continue;
      const source = await fs.readFile(path.join(assets, name), 'utf8');
      const prepared = prepareNativeAppearanceScript(source);
      if (prepared === source) continue;
      nativeCount++;
      const next = createHash('sha256').update(prepared).digest('hex') + '.js';
      await fs.writeFile(path.join(assets, next), prepared);
      await fs.unlink(path.join(assets, name));
      renamed.set('_arc/assets/' + name, '_arc/assets/' + next);
    }
    if (nativeCount !== 1) throw new Error('Expected exactly one ARC native appearance initializer.');
    for (const file of await walk(cache)) {
      const source = await fs.readFile(file, 'utf8');
      let prepared = source;
      for (const [old, next] of renamed) prepared = prepared.replaceAll(old, next);
      prepared = prepareAppearanceHtml(prepared, css);
      if (prepared !== source) { await fs.writeFile(file, prepared); count++; }
    }
    const prerenderPath = path.join(cache, '.prerender-manifest.json');
    try {
      let prerender = await fs.readFile(prerenderPath, 'utf8');
      for (const [old, next] of renamed) prerender = prerender.replaceAll(old, next);
      await fs.writeFile(prerenderPath, prerender);
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  // The public readonly-tree manifest covers emitted HTML, so retain truthful
  // content metadata after the deterministic shell adapter runs.
  const manifestPath = path.join(root, 'dist/.afs/manifest.json');
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  for (const file of manifest.files) {
    if (file.path.startsWith('.web-cache/')) {
      for (const [old, next] of renamed) file.path = file.path.replaceAll(old, next);
      const bytes = await fs.readFile(path.join(root, 'dist', file.path));
      file.size = bytes.length;
      file.sha256 = createHash('sha256').update(bytes).digest('hex');
    }
  }
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  return count;
}
