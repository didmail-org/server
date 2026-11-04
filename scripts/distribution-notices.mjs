import fs from 'node:fs';
import path from 'node:path';
import { createPublicPackageWriter } from './public-package-files.mjs';

// All inputs are reviewed public repository files. The writer rejects aliases at
// both ends; never recursively copy node_modules or a local runtime directory.
export function copyDistributionNotices(directory) {
  const writer = createPublicPackageWriter(directory);
  for (const name of ['LICENSE', 'NOTICE', 'THIRD_PARTY_NOTICES.md']) writer.copy(path.resolve(name), name);
  function copy(relative) {
    const stat = fs.lstatSync(relative);
    if (stat.isDirectory() && !stat.isSymbolicLink()) {
      for (const name of fs.readdirSync(relative).sort()) copy(`${relative}/${name}`);
    } else writer.copy(path.resolve(relative), relative);
  }
  copy('third_party_licenses');
}
