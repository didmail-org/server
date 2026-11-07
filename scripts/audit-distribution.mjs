// Current native package evidence, not legal approval. Requires only an ARC build,
// checked-in vendor metadata and public notices; no node_modules/compiler caches.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createPublicPackageWriter } from './public-package-files.mjs';
import { inputEvidence, loadInputs, nativePackage, safePath, sha256, verifyNativePackage } from './native-package-audit.mjs';
const read = file => fs.readFileSync(file);
const write = process.argv.includes('--write');
const packageOption = process.argv.indexOf('--package');
const directory = packageOption < 0 ? nativePackage : process.argv[packageOption + 1];
assert(directory, '--package requires the built package directory');
const inputs = loadInputs();
const { listed, read: readArtifact } = verifyNativePackage(directory, inputs);
const delivered = file => {
  assert(listed.has(file), `ARC manifest omits ${file}`);
  return readArtifact(file);
};
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
// The reviewed path list verifies direct ARC builds. Updating evidence refreshes
// hashes of those paths and never admits new files automatically.
const sourceFiles = [...inputs].map(([file, bytes]) => ({ file, sha256: sha256(bytes) }));
snapshot(inputEvidence, JSON.stringify({ schemaVersion: 3, target: 'arc-native-blocklet',
  scope: 'Stable public package source inputs; actual generated artifact hashes are verified on every audit and recorded under ignored artifacts/distribution/.',
  distributionApproval: 'blocked', sourceFiles }, null, 2) + '\n');
fs.mkdirSync('artifacts', { recursive: true });
const report = createPublicPackageWriter('artifacts/distribution');
report.write('current-artifact-evidence.json', JSON.stringify({ schemaVersion: 3, target: 'arc-native-blocklet',
  distributionApproval: 'blocked', manifestSha256: sha256(readArtifact('.afs/manifest.json')),
  files: [...listed].sort(([a],[b]) => a.localeCompare(b)).map(([file, sha256]) => ({file, sha256})) }, null, 2) + '\n');
console.log(JSON.stringify({ target: evidence.target, files: listed.size, packages: packages.length, unresolvedLicenseTexts: unresolved, distributionApproval: evidence.distributionApproval, additionalGates: evidence.additionalGates }, null, 2));
