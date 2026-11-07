// Shared source and artifact verification for distribution audits and regressions.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const nativePackage = 'blocklet/dist';
export const inputEvidence = 'docs/distribution-artifact-evidence.json';
const metadata = ['.afs/manifest.json', 'blocklet.dist.json'];
const generatedSidecar = /^\.web-cache\/(?:\.(?:access|artifacts)\.json|index\.html|llms(?:-full)?\.txt|robots\.txt|sitemap\.xml|sitemap-pages\.xml(?:\.br|\.gz)?)$/;
const generatedPage = /^\.web-cache\/(?:ar|en|ja|ru|zh)\/(?:([a-z-]+)\/)?index\.html$/;
const generatedAsset = /^\.web-cache\/_arc\/assets\/([a-f0-9]{64})\.(?:css|js|svg)$/;
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const allowedInput = /^(?:blocklet\.yaml|package\.json|LICENSE|NOTICE|THIRD_PARTY_NOTICES\.md|(?:\.aup|\.route|\.web|assets|pages|providers|third_party_licenses)\/[^\\]+)$/;
const privatePath = /(?:^|\/)(?:node_modules|tests?|scripts|\.data|\.arc|\.wrangler|\.dev\.vars[^/]*|\.env(?:\.[^/]*)?|artifacts|private|node-wallet\.json|protocol-runtime\.json|runtime\.json)(?:\/|$)|\.(?:pem|key|sqlite|sqlite3|db|log)(?:$|-)/i;

export const safePath = file => typeof file === 'string' && file.length > 0 &&
  !/[\\\x00-\x1f]/.test(file) && file.split('/').every(part => part && part !== '.' && part !== '..');

function readFile(root, relative) {
  assert(safePath(relative), `Unsafe native package path: ${relative}`);
  let target = root;
  const parts = relative.split('/');
  for (const part of parts.slice(0, -1)) {
    target = path.join(target, part);
    assert(fs.lstatSync(target).isDirectory() && fs.realpathSync(target) === target,
      `Native package directory must not be an alias: ${relative}`);
  }
  target = path.join(target, parts.at(-1));
  const before = fs.lstatSync(target);
  assert(before.isFile() && before.nlink === 1 && fs.realpathSync(target) === target,
    `Native package file must be regular and unlinked: ${relative}`);
  const fd = fs.openSync(target, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    const current = fs.fstatSync(fd);
    assert(current.isFile() && current.nlink === 1 && current.dev === before.dev && current.ino === before.ino &&
      fs.realpathSync(target) === target, `Native package file changed while opening: ${relative}`);
    return fs.readFileSync(fd);
  } finally {
    fs.closeSync(fd);
  }
}

export function loadInputs(source = 'blocklet') {
  assert(fs.lstatSync(source).isDirectory(), 'Native package source must be a directory');
  const root = fs.realpathSync(source);
  const { sourceFiles } = JSON.parse(readFile(fs.realpathSync('.'), inputEvidence));
  const inputs = new Map();
  for (const { file } of sourceFiles) {
    assert(safePath(file) && allowedInput.test(file) && !privatePath.test(file), `Forbidden native package input: ${file}`);
    assert(!inputs.has(file), `Duplicate native package input: ${file}`);
    const bytes = readFile(root, file);
    inputs.set(file, bytes);
  }
  for (const file of ['package.json', 'blocklet.yaml', 'LICENSE', 'NOTICE', 'THIRD_PARTY_NOTICES.md', '.web/template/logo.svg', 'assets/logo.svg'])
    assert(inputs.has(file), `Required native package input: ${file}`);
  return inputs;
}

export function verifyNativePackage(directory, inputs) {
  assert(fs.lstatSync(directory).isDirectory(), 'Package directory must not be an alias');
  const root = fs.realpathSync(directory);
  const read = file => readFile(root, file);
  const manifest = JSON.parse(read(metadata[0]));
  const flat = JSON.parse(read(metadata[1]));
  assert.equal(flat.did, 'did:blocklet:didmail-server');
  assert(Array.isArray(manifest.files) && manifest.files.length, 'ARC package manifest required');
  const listed = new Map();
  for (const item of manifest.files) {
    assert(safePath(item.path), `Unsafe ARC manifest path: ${item.path}`);
    assert(!privatePath.test(item.path), `Private/development data in package: ${item.path}`);
    const page = generatedPage.exec(item.path);
    const asset = generatedAsset.exec(item.path);
    const knownPage = page && (page[1] === 'search' || inputs.has(`pages/${page[1] ?? 'index'}/layout.aup`));
    assert(inputs.has(item.path) || knownPage || asset || generatedSidecar.test(item.path),
      `Unexpected ARC manifest path: ${item.path}`);
    assert(!listed.has(item.path), `Duplicate ARC manifest path: ${item.path}`);
    const bytes = read(item.path);
    assert.equal(sha256(bytes), item.sha256, `ARC manifest hash mismatch: ${item.path}`);
    if (asset) assert.equal(asset[1], item.sha256, `ARC asset name digest mismatch: ${item.path}`);
    assert.equal(bytes.length, item.size, `ARC manifest size mismatch: ${item.path}`);
    listed.set(item.path, item.sha256);
  }
  for (const [file, bytes] of inputs)
    assert.equal(listed.get(file), sha256(bytes), `Delivered source missing or changed: ${file}`);
  function inspect(relative = '') {
    for (const entry of fs.readdirSync(path.join(root, relative), { withFileTypes: true })) {
      const file = relative + entry.name;
      assert(!entry.isSymbolicLink(), `Distribution files must not be aliases: ${file}`);
      if (entry.isDirectory()) inspect(file + '/');
      else assert(listed.has(file) || metadata.includes(file), `Unlisted ARC output: ${file}`);
    }
  }
  inspect();
  return { listed, read };
}
