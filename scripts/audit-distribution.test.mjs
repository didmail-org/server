import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const script = fileURLToPath(new URL('./audit-distribution.mjs', import.meta.url));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function fixture(run) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'didmail-native-audit-'));
  const write = (name, bytes) => { fs.mkdirSync(path.dirname(path.join(cwd,name)),{recursive:true}); fs.writeFileSync(path.join(cwd,name),bytes); };
  const prefix = 'providers/didmail-http/vendor/';
  const contents = {
    LICENSE: 'public project license', NOTICE: 'public project notice', 'THIRD_PARTY_NOTICES.md': 'public notices',
    'third_party_licenses/retained.txt': 'retained historical provenance',
    [prefix+'dependencies.mjs']: 'export const fixture = 1;',
    [prefix+'lib0.mjs']: 'export * from "./dependencies.mjs";',
    [prefix+'lib0.cjs']: 'module.exports = {};',
    [prefix+'licenses/fixture/LICENSE']: 'PUBLIC FIXTURE LICENSE\r\n',
    'providers/didmail-native/vendor/noble-hashes/LICENSE': 'retained MIT source license',
    '.web-cache/index.html': '<main>native fixture</main>',
  };
  const vendor = { schemaVersion:1, applicationModules:false, sha256:hash(contents[prefix+'dependencies.mjs']), entryFiles:{'lib0.mjs':hash(contents[prefix+'lib0.mjs']),'lib0.cjs':hash(contents[prefix+'lib0.cjs'])}, specifiers:{fixture:{import:'lib0.mjs',require:'lib0.cjs'}}, packages:[{name:'fixture',version:'1.0.0',license:'MIT',licenseFiles:['licenses/fixture/LICENSE']}], provenance:{source:'public fixture'} };
  const seal = () => {
    contents[prefix+'manifest.json'] = JSON.stringify(vendor);
    for (const [file,bytes] of Object.entries(contents)) write('blocklet/dist/'+file,bytes);
    write('blocklet/dist/.afs/manifest.json',JSON.stringify({files:Object.entries(contents).map(([file,bytes])=>({path:file,sha256:hash(bytes)}))}));
  };
  for (const file of ['LICENSE','NOTICE','THIRD_PARTY_NOTICES.md','third_party_licenses/retained.txt']) write('blocklet/'+file,contents[file]);
  fs.mkdirSync(path.join(cwd,'docs'));
  seal();
  const invoke = (...args) => spawnSync(process.execPath,[script,...args],{cwd,encoding:'utf8'});
  try { run({cwd,write,invoke,contents,vendor,seal,prefix}); }
  finally { fs.rmSync(cwd,{recursive:true,force:true}); }
}
test('native audit reconstructs evidence using only built package metadata and public notices',()=>fixture(({cwd,invoke})=>{
  const result=invoke('--write'); assert.equal(result.status,0,result.stderr);
  assert.equal(invoke().status,0);
  const evidence=JSON.parse(fs.readFileSync(path.join(cwd,'docs/distribution-dependency-evidence.json')));
  assert.equal(evidence.target,'arc-native-blocklet'); assert.equal('worker' in evidence,false);
  assert.equal(evidence.packages[0].evidence[0].sha256,hash('PUBLIC FIXTURE LICENSE\r\n'));
  assert.equal(evidence.distributionApproval,'blocked');
}));
test('audit refuses modified assets, stale evidence and unhashed vendor facades',()=>fixture(({write,invoke,contents,vendor,seal,prefix})=>{
  assert.equal(invoke('--write').status,0);
  write('blocklet/dist/.web-cache/index.html','changed');
  assert.match(invoke().stderr,/ARC manifest hash mismatch/);
  contents['.web-cache/index.html']='new generated build'; seal();
  assert.equal(invoke().status,0,'A valid regenerated cache is verified against its own manifest');
  write('blocklet/NOTICE','new source notice');
  write('blocklet/dist/NOTICE','new source notice'); contents.NOTICE='new source notice'; seal();
  assert.match(invoke().stderr,/stale/);
  vendor.entryFiles['lib0.mjs']='0'.repeat(64); seal();
  assert.match(invoke('--write').stderr,/Vendor facade hash mismatch/);
  vendor.entryFiles['lib0.mjs']=hash(contents[prefix+'lib0.mjs']);
  vendor.specifiers.fixture.import='not-hashed.mjs'; seal();
  assert.match(invoke('--write').stderr,/Unhashed vendor facade/);
}));
test('audit rejects unlisted, private and aliased output even during evidence update',()=>fixture(({cwd,write,invoke,contents,seal})=>{
  write('blocklet/dist/unlisted.js','unlisted'); assert.match(invoke('--write').stderr,/Unlisted ARC output/);
  fs.unlinkSync(path.join(cwd,'blocklet/dist/unlisted.js'));
  contents['private/wallet.json']='synthetic canary'; seal(); assert.match(invoke('--write').stderr,/Private\/development data/);
  delete contents['private/wallet.json']; fs.rmSync(path.join(cwd,'blocklet/dist/private'),{recursive:true}); seal();
  fs.symlinkSync('../LICENSE',path.join(cwd,'blocklet/dist/alias')); assert.match(invoke('--write').stderr,/must not be aliases/);
}));
test('missing sidecars fail integrity, missing grants remain explicit and cannot imply release approval',()=>fixture(({invoke,vendor,seal,contents,prefix})=>{
  vendor.packages[0].licenseFiles=['licenses/missing']; seal(); assert.match(invoke('--write').stderr,/ARC manifest omits/);
  vendor.packages[0].licenseFiles=[]; seal(); const result=invoke('--write'); assert.equal(result.status,0,result.stderr);
  assert.deepEqual(JSON.parse(result.stdout).unresolvedLicenseTexts,['fixture@1.0.0']);
  assert.equal(JSON.parse(result.stdout).distributionApproval,'blocked');
  vendor.packages[0].licenseFiles=['licenses/fixture/LICENSE']; contents[prefix+'licenses/fixture/LICENSE']=''; seal();
  assert.match(invoke('--write').stderr,/Empty license text/);
}));

test('ordinary verification checks a valid clean rebuild without replacing stable snapshots',()=>fixture(({cwd,write,invoke,contents,seal})=>{
  assert.equal(invoke('--write').status,0);
  const baseline=fs.readFileSync(path.join(cwd,'docs/distribution-artifact-evidence.json'),'utf8');
  contents['.web-cache/_arc/assets/older.js']='old generated cache asset'; seal();
  assert.equal(invoke().status,0);
  delete contents['.web-cache/_arc/assets/older.js'];
  fs.unlinkSync(path.join(cwd,'blocklet/dist/.web-cache/_arc/assets/older.js'));
  contents['.web-cache/index.html']='fresh valid ARC render';seal();
  assert.equal(invoke().status,0);
  assert.equal(fs.readFileSync(path.join(cwd,'docs/distribution-artifact-evidence.json'),'utf8'),baseline);
  const report=JSON.parse(fs.readFileSync(path.join(cwd,'artifacts/distribution/current-artifact-evidence.json')));
  assert(!report.files.some(file=>file.file.endsWith('older.js')));
  assert.equal(report.files.find(file=>file.file==='.web-cache/index.html').sha256,hash('fresh valid ARC render'));
  write('blocklet/dist/.web-cache/index.html','tampered after build');
  assert.match(invoke().stderr,/ARC manifest hash mismatch/);
}));
