// Reproducible evidence, not a legal approval. Run after production UI/Worker builds.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const read = (file) => fs.readFileSync(file);
const json = (file) => JSON.parse(read(file));
const write = process.argv.includes('--write');
const supplemental = {
  'boolbase@1.0.0': ['third_party_licenses/boolbase1.0.0.txt'],
  'cookie-signature@1.0.6': ['third_party_licenses/cookie-signature1.0.6-README-license.txt'],
  'express-async-errors@3.1.1': ['third_party_licenses/express-async-errors3.1.1.txt'],
  'jsonify@0.0.1': ['third_party_licenses/jsonify0.0.1-README-license.txt'],
  'qrcode-generator@1.4.4': [
    'third_party_licenses/qrcode-generator1.4.4.txt',
    'third_party_licenses/qrcode-generator1.4.4-source-header.txt',
  ],
  'google-protobuf@3.21.0': [
    'third_party_licenses/google-protobuf3.21.0-Closure-header.txt',
    'third_party_licenses/google-closure-library-Apache-2.0.txt',
  ],
};
function licenseFiles(root, relative = '') {
  const files = [];
  for (const entry of fs.readdirSync(path.join(root, relative), { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.isSymbolicLink()) continue;
    const name = path.posix.join(relative, entry.name);
    if (entry.isDirectory()) files.push(...licenseFiles(root, name));
    else if (entry.isFile() && /^(?:licen[cs]e|copying|notice|third.party.notices)(?:[._-].*)?$/i.test(entry.name))
      files.push(name);
  }
  return files.sort();
}
function inventory(metafiles) {
  const packages = new Map();
  const inputs = new Set();
  for (const meta of metafiles)
    for (const output of Object.values(meta.outputs)) {
      for (const [file, contribution] of Object.entries(output.inputs)) {
        if (contribution.bytesInOutput <= 0) continue;
        inputs.add(file);
        // Use the installation boundary, not internal package.json files such as
        // @noble/hashes/esm/package.json. Handle direct aliases (node_modules/axios).
        const normalized = file.startsWith('node_modules/') ? `./${file}` : file;
        const marker = '/node_modules/';
        const at = normalized.lastIndexOf(marker);
        if (at < 0) continue;
        const rest = normalized.slice(at + marker.length).split('/');
        const count = rest[0].startsWith('@') ? 2 : 1;
        const root = path.resolve(normalized.slice(0, at + marker.length) + rest.slice(0, count).join('/'));
        const real = fs.realpathSync(root);
        if (!packages.has(real)) packages.set(real, { root, files: new Map() });
        packages.get(real).files.set(rest.slice(count).join('/'), hash(read(file)));
      }
    }
  const sections = [];
  const rows = [...packages.values()]
    .map(({ root, files }) => {
      const pkg = json(path.join(root, 'package.json'));
      assert(pkg.name && pkg.version, 'Unnamed installation boundary');
      const id = `${pkg.name}@${pkg.version}`;
      const local = licenseFiles(root);
      const evidence = local.map((file) => ({ file, sha256: hash(read(path.join(root, file))) }));
      const extra = supplemental[id] || [];
      for (const file of extra) evidence.push({ file, sha256: hash(read(file)) });
      const texts = local.map((file) => `--- ${file} ---\n${read(path.join(root, file)).toString()}\n`);
      for (const file of extra) texts.push(`--- recovered: ${file} ---\n${read(file).toString()}\n`);
      sections.push({
        id,
        text: `\n${'='.repeat(70)}\n${id}\n\n${texts.join('\n') || 'UNRESOLVED: no verified license text.\n'}`,
      });
      return {
        package: pkg.name,
        version: pkg.version,
        licenseMetadata: pkg.license || pkg.licenses?.map((item) => item.type).join(' OR ') || 'UNKNOWN',
        localLicenseFile: local.some((file) => /^(?:licen[cs]e|copying)/i.test(path.basename(file))),
        ...(id === '@arcblock/validator@1.19.15'
          ? { distributionLicenseBasis: 'Packaged Apache-2.0 LICENSE retained; manifest MIT declaration conflicts.' }
          : {}),
        inputFiles: [...files].sort(([a], [b]) => a.localeCompare(b)).map(([file, sha256]) => ({ file, sha256 })),
        evidence,
        textStatus: evidence.length ? 'collected; obligations require review' : 'unresolved',
      };
    })
    .sort((a, b) => a.package.localeCompare(b.package) || a.version.localeCompare(b.version));
  sections.sort((a, b) => a.id.localeCompare(b.id));
  return { inputs: inputs.size, packages: rows, collection: sections.map((item) => item.text).join('') };
}
function snapshot(file, value) {
  if (write) fs.writeFileSync(file, value);
  else
    assert.equal(read(file).toString(), value, `${file} is stale; inspect changes and run audit:distribution:update`);
}
const workerMeta = json('.worker/metafile.json');
assert(Object.keys(workerMeta.inputs).includes('workers/index.ts'), 'Production Worker metafile required');
assert(
  !Object.keys(workerMeta.inputs).some((file) => file.startsWith('tests/')),
  'Test metafile is not production evidence',
);
const worker = inventory([workerMeta]);
const ui = inventory(json('artifacts/ui-metafiles.json'));
for (const [target, data] of [
  ['worker', worker],
  ['blocklet', ui],
]) {
  const prefix = `DIDMail Server ${target} dependency license and notice collection\n\nEvidence only; see docs/distribution-license-audit.md for unresolved distribution gates.\n`;
  snapshot(`third_party_licenses/${target}-bundle-licenses.txt`, prefix + data.collection);
}
const csv = (data) =>
  [
    'package,version,license_metadata,local_license_file,package_instances',
    ...data.packages.map((row) =>
      [row.package, row.version, row.licenseMetadata, row.localLicenseFile ? 'yes' : 'no', 1]
        .map((cell) => (/[",\r\n]/.test(String(cell)) ? `"${String(cell).replaceAll('"', '""')}"` : String(cell)))
        .join(','),
    ),
  ].join('\n') + '\n';
snapshot('docs/worker-dependency-inventory.csv', csv(worker));
snapshot('docs/blocklet-dependency-inventory.csv', csv(ui));
snapshot(
  'docs/distribution-dependency-evidence.json',
  JSON.stringify(
    {
      schemaVersion: 1,
      worker: { inputs: worker.inputs, packages: worker.packages },
      blocklet: { inputs: ui.inputs, packages: ui.packages },
    },
    null,
    2,
  ) + '\n',
);
if (!write) {
  const curatedFiles = (directory) =>
    fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      assert(!entry.isSymbolicLink(), 'Curated notice inputs must not be aliases');
      const file = `${directory}/${entry.name}`;
      return entry.isDirectory() ? curatedFiles(file) : [file];
    });
  const noticeFiles = ['LICENSE', 'NOTICE', 'THIRD_PARTY_NOTICES.md', ...curatedFiles('third_party_licenses')];
  for (const directory of ['.worker/legal', 'dist', 'blocklet/dist'])
    for (const file of noticeFiles)
      assert.equal(hash(read(path.join(directory, file))), hash(read(file)), `${directory}/${file} missing or changed`);
  const manifest = json('blocklet/dist/.afs/manifest.json');
  for (const file of noticeFiles)
    assert(
      manifest.files.some((item) => item.path === file),
      `ARC manifest omits ${file}`,
    );
  const deliveredFiles = (directory, prefix = '') =>
    fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      assert(!entry.isSymbolicLink(), 'Distribution files must not be aliases');
      const relative = `${prefix}${entry.name}`;
      return entry.isDirectory() ? deliveredFiles(path.join(directory, entry.name), `${relative}/`) : [relative];
    });
  const allowed = new Set([...manifest.files.map((item) => item.path), '.afs/manifest.json', 'blocklet.dist.json']);
  for (const file of deliveredFiles('blocklet/dist')) assert(allowed.has(file), `Unlisted ARC output: ${file}`);
  for (const file of deliveredFiles('.worker/legal'))
    assert(noticeFiles.includes(file), `Unlisted Worker legal output: ${file}`);
  for (const item of manifest.files) {
    assert(!path.isAbsolute(item.path) && !item.path.split('/').includes('..'));
    assert.equal(
      hash(read(path.join('blocklet/dist', item.path))),
      item.sha256,
      `ARC manifest hash mismatch: ${item.path}`,
    );
  }
}
console.log(
  JSON.stringify(
    {
      worker: {
        inputs: worker.inputs,
        instances: worker.packages.length,
        missingText: worker.packages.filter((p) => !p.evidence.length).map((p) => `${p.package}@${p.version}`),
      },
      blocklet: { inputs: ui.inputs, instances: ui.packages.length },
      distributionApproval:
        'See docs/distribution-license-audit.md; collection and byte checks do not grant release approval.',
    },
    null,
    2,
  ),
);
