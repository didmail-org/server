// Cache a public stylesheet using a disposable, unconfigured ARC instance.
// No existing instance, signing configuration or npm package dependency is required.
import { nativePackage } from './native-package-audit.mjs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createPublicPackageWriter } from './public-package-files.mjs';

if (process.argv.includes('--help')) {
  console.log('Usage: node scripts/cache-arc-core.mjs\nBuild the Blocklet first. Prints the cached public ARC stylesheet path. Starts/stops only a new disposable instance; never reads an existing wallet/configuration.');
} else {
  const html = await fs.readFile(`${nativePackage}/.web-cache/en/help/index.html`, 'utf8');
  const reference = html.match(/href="(\/aup-core\.[a-f0-9]{16}\.css)"/)?.[1];
  if (!reference) throw Error('Build native pages first; the ARC core stylesheet reference is missing');
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'didmail-public-core-'));
  const instance = 'didmail-public-core-' + randomUUID();
  const run = promisify(execFile);
  const arc = (...args) => run('arc', args, { timeout: 45000, maxBuffer: 1024 * 1024 });
  let attempted = false;
  try {
    attempted = true;
    const result = await arc('service', 'start', '--instance', instance, '--home', path.join(directory, 'home'),
      '--blocklet', path.resolve(nativePackage), '--port', '0', '--purpose', 'evidence', '--no-advertise', '--print', 'port');
    const port = Number(result.stdout.trim().split('\n').at(-1));
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error('Disposable ARC port unavailable');
    const response = await fetch(`http://127.0.0.1:${port}${reference}`, { redirect: 'error', signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw Error('Public ARC stylesheet unavailable');
    const bytes = Buffer.from(await response.arrayBuffer());
    const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 16);
    if (reference !== `/aup-core.${hash}.css` || !bytes.includes('.aup-app-header')) throw Error('ARC stylesheet differs from the built page reference; use the matching ARC version');
    await fs.mkdir('artifacts', { recursive: true });
    const writer = createPublicPackageWriter('artifacts/browser-core');
    writer.write(reference.slice(1), bytes);
    console.log(path.join(writer.root, reference.slice(1)));
  } finally {
    try { if (attempted) await arc('service', 'delete', '--instance', instance, '--force', '--yes'); }
    finally { await fs.rm(directory, { recursive: true, force: true }); }
  }
}
