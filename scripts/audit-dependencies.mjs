import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const advisoryId = 'GHSA-gcqx-w48m-w2h4';
const packageId = 'deepmerge@4.3.1';
// Reviewed implementations, not an advisory allowlist. A changed patch, installed
// byte, package entrypoint or failed exploit regression requires another review.
const implementations = {
  ba1201a16aa10596ab75f9963d95ec81d363abcd6f72922cda2739158e51a23c: {
    'package.json': 'f56978e7a6da1a3c6edee41abb54f98584a2fa2680458c48db820ae772fef0c9',
    'index.js': '39bb34b5aeba657b538bd4e32fd5acff36144591117bdb3f337f5f8db6e27b80',
    'dist/cjs.js': 'cb46c0b3506de072ab6dd13c727517481689643f4728e9ced931b99c7d4a4283',
    'dist/umd.js': '2f887f8fd540a8cdc35c755091ba819288a7b8046a0dd29e0f6f8ce6ec912417',
  },
  '9d8a360bac073908357aa7158b5f6f8ba7bb8b1b91e8474a01741b3d3bd56cd5': {
    'package.json': 'f56978e7a6da1a3c6edee41abb54f98584a2fa2680458c48db820ae772fef0c9',
    'index.js': 'b40634781be96c30fc46582cf13a684d1cc1570fd005994b61744a74cac31ee4',
    'dist/cjs.js': 'ebaf590b8b28cc9a315b46016c12007b062644027652359e9ae8d402109d27c7',
    'dist/umd.js': '92d2814b5d728fe40e3492d909f7bb76eb8185845d614e8454a4a01779641060',
  },
};
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const unquote = (value) => value.replace(/^(['"])(.*)\1$/, '$2');
const affectedDeepmerge = (version) => {
  const match = /^4\.(\d+)\.(\d+)(?:\(|$)/.exec(version);
  return Boolean(match && (Number(match[1]) === 2 || (Number(match[1]) === 3 && Number(match[2]) <= 1)));
};

// These pnpm 11/12 scalar maps are intentionally read narrowly. A new lockfile
// shape fails closed rather than guessing which dependency snapshot is selected.
function sectionLines(text, name) {
  const found = [];
  let inside = false;
  for (const line of text.split(/\r?\n/)) {
    if (line === name + ':') {
      inside = true;
      continue;
    }
    if (/^\S/.test(line)) inside = false;
    if (inside) found.push(line);
  }
  return found;
}
function selectedScalar(text, section, key) {
  const values = sectionLines(text, section).flatMap((line) => {
    const match = /^ {2}([^:]+):\s*(\S+)\s*$/.exec(line);
    return match && unquote(match[1]) === key ? [unquote(match[2])] : [];
  });
  assert.equal(values.length, 1, `Missing or ambiguous ${section} selection for ${key}`);
  return values[0];
}

export function verifyLocalPatch(projectRoot) {
  const workspace = fs.readFileSync(path.join(projectRoot, 'pnpm-workspace.yaml'), 'utf8');
  const lock = fs.readFileSync(path.join(projectRoot, 'pnpm-lock.yaml'), 'utf8');
  const relativePatch = selectedScalar(workspace, 'patchedDependencies', packageId);
  const patch = path.resolve(projectRoot, relativePatch);
  assert.ok(patch.startsWith(path.resolve(projectRoot) + path.sep), 'Patch must belong to this component');
  const patchHash = sha256(fs.readFileSync(patch));
  assert.ok(Object.hasOwn(implementations, patchHash), 'Patch is not the reviewed remediation');
  assert.equal(selectedScalar(lock, 'patchedDependencies', packageId), patchHash, 'Lockfile patch hash mismatch');
  const expected = `4.3.1(patch_hash=${patchHash})`;
  const references = [...lock.matchAll(/^[ \t]+deepmerge:[ \t]*(\S[^\r\n]*)$/gm)].filter((reference) =>
    affectedDeepmerge(unquote(reference[1].trim())),
  );
  assert.ok(references.length, 'Lockfile has no bound deepmerge dependency');
  for (const reference of references)
    assert.equal(unquote(reference[1].trim()), expected, 'Unpatched lockfile dependency');
  const snapshots = sectionLines(lock, 'snapshots').filter((line) => /^ {2}['"]?deepmerge@4\.3\.1(?:\(|:)/.test(line));
  assert.equal(snapshots.length, 1, 'Missing or ambiguous deepmerge snapshot');
  assert.equal(
    unquote(snapshots[0].trim().split(':')[0]),
    `${packageId}(patch_hash=${patchHash})`,
    'Unpatched lockfile snapshot',
  );
  return { patchHash, files: { ...implementations[patchHash] } };
}

function resolvePackage(loader, name) {
  assert.match(name, /^(?:@[\w.-]+\/)?[\w.-]+$/, 'Invalid package name in audit path');
  // Inspect actual metadata using Node's dependency lookup directories. Root
  // exports may be absent or hide package.json; walking up from a main file
  // could accidentally substitute a parent's metadata. Using the subpath keeps
  // npm polyfills named after builtins (e.g. assert) visible as packages too.
  for (const directory of loader.resolve.paths(name + '/package.json') || []) {
    const manifest = path.join(directory, name, 'package.json');
    if (!fs.existsSync(manifest)) continue;
    const metadata = JSON.parse(fs.readFileSync(manifest, 'utf8'));
    assert.ok(typeof metadata.name === 'string' && metadata.name, `Invalid installed metadata for ${name}`);
    const actualManifest = fs.realpathSync(manifest);
    return { root: path.dirname(actualManifest), metadata, loader: createRequire(actualManifest) };
  }
  throw Object.assign(new Error(`Missing installed dependency: ${name}`), { code: 'DEPENDENCY_MISSING' });
}

export function verifyMergeBehavior(merge) {
  const malicious = JSON.parse(
    '{"__proto__":{"admin":true},"session":{"__proto__":{"admin":true}},"constructor":{"prototype":{"admin":true}},"prototype":{"admin":true}}',
  );
  for (const target of [{ session: null }, Object.create(null), JSON.parse('{"__proto__":{"admin":true}}')]) {
    const result = merge(target, malicious);
    assert.equal(Object.getPrototypeOf(result), Object.prototype, 'Returned object prototype was poisoned');
    assert.equal(result.admin, undefined);
    assert.equal(result.session.admin, undefined, 'Nested object prototype was poisoned');
    assert.equal(Object.getPrototypeOf(result.session), Object.prototype);
    for (const key of ['__proto__', 'constructor', 'prototype']) assert.equal(Object.hasOwn(result, key), false);
  }
  const symbol = Symbol('public metadata');
  assert.deepEqual(
    merge({ items: [1], nested: { a: true }, [symbol]: 'retained' }, { items: [2], nested: { b: true } }),
    {
      items: [1, 2],
      nested: { a: true, b: true },
      [symbol]: 'retained',
    },
  );
  assert.deepEqual(merge.all([{ a: 1 }, { b: 2 }]), { a: 1, b: 2 });
  assert.equal({}.admin, undefined);
}

export function verifyInstalledPackage(packageRoot, proof) {
  for (const [file, expected] of Object.entries(proof.files))
    assert.equal(
      sha256(fs.readFileSync(path.join(packageRoot, file))),
      expected,
      `Installed remediation changed: ${file}`,
    );
  const metadata = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));
  assert.equal(metadata.name, 'deepmerge');
  assert.equal(metadata.version, '4.3.1');
  const loader = createRequire(path.join(packageRoot, 'package.json'));
  // Both published runtime entrypoints must pass, including the browser build.
  for (const entry of ['dist/cjs.js', 'dist/umd.js']) verifyMergeBehavior(loader('./' + entry));
}

export function allResolvedInstances(projectRoot) {
  const roots = new Set(),
    seen = new Set();
  const queue = [{ root: projectRoot, isRoot: true }];
  while (queue.length) {
    const { root, isRoot } = queue.shift();
    const real = fs.realpathSync(root);
    if (seen.has(real)) continue;
    seen.add(real);
    const manifest = path.join(root, 'package.json');
    const metadata = JSON.parse(fs.readFileSync(manifest, 'utf8'));
    const loader = createRequire(manifest);
    const required = { ...metadata.dependencies, ...(isRoot ? metadata.devDependencies : {}) };
    const optional = metadata.optionalDependencies || {};
    const peers = metadata.peerDependencies || {};
    const names = new Set([...Object.keys(required), ...Object.keys(optional), ...Object.keys(peers)]);
    for (const name of names) {
      const mayBeAbsent =
        Object.hasOwn(optional, name) ||
        (!Object.hasOwn(required, name) && metadata.peerDependenciesMeta?.[name]?.optional === true);
      let dependency;
      try {
        dependency = resolvePackage(loader, name);
      } catch (error) {
        if (mayBeAbsent && error.code === 'DEPENDENCY_MISSING') continue;
        throw new Error(`Cannot inspect ${metadata.name} -> ${name}: ${error.message}`, { cause: error });
      }
      if (dependency.metadata.name === 'deepmerge' && affectedDeepmerge(dependency.metadata.version)) {
        assert.equal(dependency.metadata.version, '4.3.1', 'Unreviewed installed vulnerable version');
        roots.add(dependency.root);
      }
      queue.push({ root: dependency.root, isRoot: false });
    }
  }
  return roots;
}

export function assessAuditReport(report, projectRoot, auditExitCode = 1) {
  assert.ok(
    report &&
      !report.error &&
      typeof report.advisories === 'object' &&
      report.advisories !== null &&
      !Array.isArray(report.advisories),
    'Invalid or failed raw audit',
  );
  assert.ok(auditExitCode === 0 || auditExitCode === 1, 'Raw audit process failed');
  const counts = report.metadata?.vulnerabilities;
  assert.ok(counts && typeof counts === 'object' && !Array.isArray(counts), 'Missing audit vulnerability counts');
  assert.deepEqual(
    Object.keys(counts).sort(),
    ['critical', 'high', 'info', 'low', 'moderate'],
    'Invalid audit severity fields',
  );
  assert.ok(
    counts && Object.values(counts).every((value) => Number.isSafeInteger(value) && value >= 0),
    'Missing audit vulnerability counts',
  );
  const advisories = Object.values(report.advisories);
  const count = Object.values(counts).reduce((sum, value) => sum + value, 0);
  assert.equal(count === 0, advisories.length === 0, 'Audit findings/counts disagree');
  if (!advisories.length) {
    assert.equal(auditExitCode, 0, 'Raw audit failed without findings');
    return [];
  }
  for (const advisory of advisories) {
    assert.equal(advisory.github_advisory_id, advisoryId, 'Unremediated advisory');
    assert.equal(advisory.module_name, 'deepmerge', 'Unexpected advisory package');
    assert.equal(advisory.severity, 'low', 'Advisory risk changed; review required');
    assert.ok(Array.isArray(advisory.findings) && advisory.findings.length, 'Missing advisory installation paths');
    for (const finding of advisory.findings) {
      assert.equal(finding.version, '4.3.1', 'Unreviewed vulnerable version');
      assert.ok(Array.isArray(finding.paths) && finding.paths.length, 'Missing advisory installation paths');
    }
  }
  assert.equal(counts.low, advisories.length, 'Audit advisory count changed; review required');
  for (const [severity, value] of Object.entries(counts))
    if (severity !== 'low') assert.equal(value, 0, 'Unremediated audit severity');
  const proof = verifyLocalPatch(projectRoot);
  const instances = allResolvedInstances(projectRoot);
  const projectLoader = createRequire(path.join(projectRoot, 'package.json'));
  for (const advisory of advisories)
    for (const finding of advisory.findings)
      for (const auditPath of finding.paths) {
        assert.equal(typeof auditPath, 'string', 'Invalid advisory installation path');
        const names = auditPath.split('>');
        assert.equal(names.shift(), '.', 'Unsupported audit path');
        assert.ok(names.length && names.at(-1) === 'deepmerge', 'Invalid advisory installation path');
        let current = { loader: projectLoader };
        for (const name of names) current = resolvePackage(current.loader, name);
        assert.equal(current.metadata.name, 'deepmerge');
        assert.equal(current.metadata.version, '4.3.1');
        instances.add(current.root);
      }
  assert.ok(instances.size, 'No installed remediation found');
  for (const instance of instances) verifyInstalledPackage(instance, proof);
  return [
    {
      advisoryId,
      package: packageId,
      state: 'locally remediated',
      patchSha256: proof.patchHash,
      installedInstances: instances.size,
    },
  ];
}

export function runAudit(projectRoot) {
  const entry = process.env.npm_execpath || 'pnpm';
  const script = /\.(?:c?js|mjs)$/.test(entry);
  const result = spawnSync(
    script ? process.execPath : entry,
    script ? [entry, 'audit', '--json'] : ['audit', '--json'],
    {
      cwd: projectRoot,
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
      timeout: 60000,
    },
  );
  // The registry report stays fully visible, including locally patched versions.
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) throw result.error;
  const evidence = assessAuditReport(JSON.parse(result.stdout), projectRoot, result.status);
  console.log(JSON.stringify({ dependencyAuditGate: 'passed', localRemediations: evidence }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    runAudit(path.resolve(process.argv[2] || process.cwd()));
  } catch (error) {
    console.error('Dependency audit gate failed:', error.message);
    process.exitCode = 1;
  }
}
