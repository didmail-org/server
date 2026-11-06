// Current native package evidence, not legal approval. Requires only an ARC build,
// checked-in vendor metadata and public notices; no node_modules/compiler caches.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createPublicPackageWriter } from './public-package-files.mjs';
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const read = file => fs.readFileSync(file);
const json = file => JSON.parse(read(file));
const write = process.argv.includes('--write');
const packageOption = process.argv.indexOf('--package');
const directory = packageOption < 0 ? 'blocklet/dist' : process.argv[packageOption + 1];
assert(directory, '--package requires the built package directory');
const safePath = file => typeof file === 'string' && file && !file.includes('\\') && !path.posix.isAbsolute(file) && file.split('/').every(part => part && part !== '.' && part !== '..');
const privatePath = /(?:^|\/)(?:node_modules|\.data|\.arc|\.wrangler|\.dev\.vars[^/]*|\.env(?:\.[^/]*)?|artifacts|private|node-wallet\.json|protocol-runtime\.json|runtime\.json)(?:\/|$)|\.(?:pem|key|sqlite|sqlite3|db)(?:$|-)/i;
function files(root, prefix = '', exclude = new Set()) {
  assert(fs.lstatSync(root).isDirectory() && !fs.lstatSync(root).isSymbolicLink(), 'Package directory must not be an alias');
  return fs.readdirSync(root, { withFileTypes: true }).filter(entry => !exclude.has(prefix + entry.name)).sort((a,b) => a.name.localeCompare(b.name)).flatMap(entry => {
    const file = path.join(root, entry.name), relative = prefix + entry.name, stat = fs.lstatSync(file);
    assert(!stat.isSymbolicLink(), `Distribution files must not be aliases: ${relative}`);
    if (stat.isDirectory()) return files(file, relative + '/', exclude);
    assert(stat.isFile() && stat.nlink === 1, `Distribution files must be regular, unlinked files: ${relative}`);
    return [relative];
  });
}
const manifest = json(path.join(directory, '.afs/manifest.json'));
assert(Array.isArray(manifest.files) && manifest.files.length, 'ARC package manifest required');
const listed = new Map();
for (const item of manifest.files) {
  assert(safePath(item.path), `Unsafe ARC manifest path: ${item.path}`);
  assert(!privatePath.test(item.path), `Private/development data in package: ${item.path}`);
  assert(!listed.has(item.path), `Duplicate ARC manifest path: ${item.path}`);
  assert.match(item.sha256, /^[a-f0-9]{64}$/, 'Invalid ARC manifest digest');
  listed.set(item.path, item.sha256);
}
const allowed = new Set([...listed.keys(), '.afs/manifest.json', 'blocklet.dist.json']);
for (const file of files(directory)) {
  assert(!privatePath.test(file), `Private/development data in package: ${file}`);
  assert(allowed.has(file), `Unlisted ARC output: ${file}`);
}
for (const [file, expected] of listed)
  assert.equal(sha256(read(path.join(directory, file))), expected, `ARC manifest hash mismatch: ${file}`);
const delivered = file => {
  assert(safePath(file) && listed.has(file), `ARC manifest omits ${file}`);
  return read(path.join(directory, file));
};
// The package source owns the shipped notices. Validate all curated source texts,
// including retained historical provenance, without needing retired build outputs.
for (const file of ['LICENSE', 'NOTICE', 'THIRD_PARTY_NOTICES.md', ...files('blocklet/third_party_licenses').map(file => 'third_party_licenses/' + file)])
  assert.equal(sha256(delivered(file)), sha256(read(path.join('blocklet', file))), `Delivered notice missing or changed: ${file}`);
const vendorPrefix = 'providers/didmail-http/vendor/';
const vendor = JSON.parse(delivered(vendorPrefix + 'manifest.json'));
assert.equal(vendor.applicationModules, false, 'Native vendor must remain dependency-only');
assert.equal(sha256(delivered(vendorPrefix + 'dependencies.mjs')), vendor.sha256, 'Native dependency asset hash mismatch');
for (const [file, expected] of Object.entries(vendor.entryFiles)) {
  assert(safePath(file), 'Unsafe vendor entry');
  assert.equal(sha256(delivered(vendorPrefix + file)), expected, `Vendor facade hash mismatch: ${file}`);
}
for (const entry of Object.values(vendor.specifiers))
  for (const kind of ['import', 'require']) assert(Object.hasOwn(vendor.entryFiles, entry[kind]), `Unhashed vendor facade: ${entry[kind]}`);
const supplemental = {
  'boolbase@1.0.0': ['boolbase1.0.0.txt'],
  'cookie-signature@1.0.6': ['cookie-signature1.0.6-README-license.txt'],
  'express-async-errors@3.1.1': ['express-async-errors3.1.1.txt'],
  'jsonify@0.0.1': ['jsonify0.0.1-README-license.txt'],
  'qrcode-generator@1.4.4': ['qrcode-generator1.4.4.txt', 'qrcode-generator1.4.4-source-header.txt'],
  'google-protobuf@3.21.0': ['google-protobuf3.21.0-Closure-header.txt', 'google-closure-library-Apache-2.0.txt'],
};
const seen = new Set();
const packages = vendor.packages.map(pkg => {
  assert(pkg.name && pkg.version && Array.isArray(pkg.licenseFiles), 'Invalid native package inventory');
  const id = pkg.name + '@' + pkg.version;
  assert(!seen.has(id), `Duplicate native package inventory: ${id}`); seen.add(id);
  const evidence = [...pkg.licenseFiles.map(file => {
    assert(safePath(file) && file.startsWith('licenses/'), 'Unsafe vendor license path');
    return vendorPrefix + file;
  }), ...(supplemental[id] || []).map(file => 'third_party_licenses/' + file)].map(file => {
    const bytes = delivered(file); assert(bytes.length, `Empty license text: ${file}`);
    return { file, sha256: sha256(bytes) };
  });
  return { package: pkg.name, version: pkg.version, licenseMetadata: pkg.license || 'UNKNOWN', evidence,
    textStatus: evidence.length ? 'collected; obligations require review' : 'unresolved',
    ...(id === '@arcblock/validator@1.19.15' ? { distributionLicenseBasis: 'Packaged Apache-2.0 LICENSE retained; manifest MIT declaration conflicts.' } : {}) };
}).sort((a,b) => a.package.localeCompare(b.package) || a.version.localeCompare(b.version));
const retainedPrefix = 'providers/didmail-native/vendor/noble-hashes/';
assert(delivered(retainedPrefix + 'LICENSE').length, 'Retained crypto source license required');
const unresolved = packages.filter(pkg => !pkg.evidence.length).map(pkg => pkg.package + '@' + pkg.version);
const evidence = { schemaVersion: 2, target: 'arc-native-blocklet', vendorManifestSha256: listed.get(vendorPrefix + 'manifest.json'),
  provenance: vendor.provenance, packages, retainedSources: [...listed].filter(([file]) => file.startsWith(retainedPrefix)).map(([file, sha256]) => ({ file, sha256 })),
  distributionApproval: 'blocked', unresolvedLicenseTexts: unresolved,
  additionalGates: ['ARC-generated runtime/template output licensing and embedded-code provenance remain unverified; exact grants/obligations require review.'] };
function snapshot(file, value) {
  if (write) fs.writeFileSync(file, value);
  else assert.equal(read(file).toString(), value, `${file} is stale; inspect changes and run audit:distribution:update`);
}
const csvCell = value => '"' + String(value).replaceAll('"','""') + '"';
snapshot('docs/blocklet-dependency-inventory.csv', ['package,version,license_metadata,text_status', ...packages.map(pkg => [pkg.package,pkg.version,pkg.licenseMetadata,pkg.textStatus].map(csvCell).join(','))].join('\n') + '\n');
snapshot('docs/distribution-dependency-evidence.json', JSON.stringify(evidence, null, 2) + '\n');
// ARC's build cache may retain older content-addressed resources. Those are
// still checked above, but one cache's generated bytes are not a portable source
// baseline. Commit stable authored/vendor inputs; retain each actual build's
// complete verified inventory separately, including all generated cache files.
const sourceFiles = files('blocklet', '', new Set(['dist', '.web-cache', 'web'])).map(file => {
  assert(!privatePath.test(file), `Private/development input in package source: ${file}`);
  const digest = sha256(read(path.join('blocklet', file)));
  if (listed.has(file)) assert.equal(listed.get(file), digest, `Delivered source differs from current input: ${file}`);
  return { file, sha256: digest };
});
snapshot('docs/distribution-artifact-evidence.json', JSON.stringify({ schemaVersion: 3, target: 'arc-native-blocklet',
  scope: 'Stable public package source inputs; actual generated artifact hashes are verified on every audit and recorded under ignored artifacts/distribution/.',
  distributionApproval: 'blocked', sourceFiles }, null, 2) + '\n');
fs.mkdirSync('artifacts', { recursive: true });
const report = createPublicPackageWriter('artifacts/distribution');
report.write('current-artifact-evidence.json', JSON.stringify({ schemaVersion: 3, target: 'arc-native-blocklet',
  distributionApproval: 'blocked', manifestSha256: sha256(read(path.join(directory, '.afs/manifest.json'))),
  files: [...listed].sort(([a],[b]) => a.localeCompare(b)).map(([file, sha256]) => ({file, sha256})) }, null, 2) + '\n');
console.log(JSON.stringify({ target: evidence.target, files: listed.size, packages: packages.length, unresolvedLicenseTexts: unresolved, distributionApproval: evidence.distributionApproval, additionalGates: evidence.additionalGates }, null, 2));
