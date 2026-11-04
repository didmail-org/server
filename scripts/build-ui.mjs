// Build ARC Web Device pages and the small framework-free business interaction bundle.
import { build } from 'esbuild';
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { prepareAppearanceArtifacts } from './prepare-ui-appearance.mjs';
import { packageWorkerCore } from './package-worker-core.mjs';
import { createPublicPackageWriter } from './public-package-files.mjs';
import { copyDistributionNotices } from './distribution-notices.mjs';
const buildMetafiles = [];
async function auditedBuild(options) {
  const result = await build({ ...options, metafile: true });
  buildMetafiles.push(result.metafile);
  return result;
}
createPublicPackageWriter('blocklet');
const component = 'blocklet/.web/components/didmail-admin';
await auditedBuild({
  entryPoints: ['ui/admin-render.js'],
  outfile: `${component}/render.js`,
  bundle: true,
  format: 'esm',
  platform: 'neutral',
});
const result = await auditedBuild({
  entryPoints: ['ui/admin.js'],
  outfile: `${component}/script.js`,
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2022',
  minify: true,
  metafile: true,
  loader: { '.svg': 'text', '.css': 'text' },
});
await auditedBuild({
  entryPoints: ['ui/home-render.js'],
  outfile: 'blocklet/.web/components/didmail-home/render.js',
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  loader: { '.svg': 'text', '.css': 'text' },
});
await auditedBuild({
  entryPoints: ['ui/help-render.js'],
  outfile: 'blocklet/.web/components/didmail-help/render.js',
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  loader: { '.md': 'text' },
});
await auditedBuild({
  entryPoints: ['ui/chrome.js'],
  loader: { '.css': 'text' },
  outfile: 'blocklet/.web/components/didmail-home/script.js',
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2022',
  minify: true,
});
cpSync('blocklet/.web/components/didmail-home/script.js', 'blocklet/.web/components/didmail-help/script.js');
for (const name of Object.keys(result.metafile.inputs)) {
  if (/node_modules\/.*(?:react|recoil|headlessui|framer-motion)/.test(name))
    throw new Error(`Unexpected framework dependency: ${name}`);
}
rmSync('blocklet/web', { recursive: true, force: true });
mkdirSync('blocklet/web', { recursive: true });
cpSync('logo.svg', 'blocklet/web/logo.svg');
// layout.aup is the page source; remove the old generated React HTML layout.
rmSync('blocklet/pages/index/layout.json', { force: true });
for (const section of ['account', 'server', 'envelope', 'namecard', 'storage', 'attachment', 'members'])
  rmSync(`blocklet/pages/admin/${section}`, { recursive: true, force: true });
for (const section of [
  'index',
  'help',
  'admin',
  'admin/account',
  'admin/server',
  'admin/envelope',
  'admin/namecard',
  'admin/storage',
  'admin/attachment',
  'admin/members',
]) {
  const dir = `blocklet/pages/${section.replaceAll('/', '-')}`;
  mkdirSync(`${dir}/seo`, { recursive: true });
  const home = section === 'index';
  const id = section.replaceAll('/', '-');
  const componentName = home ? 'didmail-home' : section === 'help' ? 'didmail-help' : 'didmail-admin';
  const page = section === 'admin' ? 'server' : section.split('/').pop();
  writeFileSync(
    `${dir}/layout.aup`,
    `page ${id} {\n  web-page page {\n    section content component=${componentName}${home || section === 'help' ? '' : ` section="${page}"`}\n  }\n}\n`,
  );
  writeFileSync(
    `${dir}/seo/title`,
    home
      ? 'DIDMail Server'
      : section === 'help'
        ? 'DIDMail Server · Help'
        : `DIDMail Admin · ${page === 'attachment' ? 'Settings' : page}`,
  );
}
const packageResult = spawnSync(process.execPath, ['scripts/package-arc.mjs'], { stdio: 'inherit' });
if (packageResult.status !== 0) process.exit(packageResult.status || 1);
for (const args of [
  ['blocklet', 'check', 'blocklet'],
  ['blocklet', 'build', 'blocklet'],
]) {
  const run = spawnSync('arc', args, { stdio: 'inherit' });
  if (run.error) throw new Error(`Cannot execute ARC CLI: ${run.error.message}`, { cause: run.error });
  if (run.status !== 0) process.exit(run.status || 1);
}
console.log(`Prepared native appearance shells: ${await prepareAppearanceArtifacts()} HTML artifacts.`);
rmSync('dist', { recursive: true, force: true });
cpSync('blocklet/.web-cache', 'dist', { recursive: true });
// Standalone Workers cannot rely on ARC's dynamic /aup-core.*.css route.
// Keep ARC builds unchanged; standalone builds supply the genuine offline asset.
if (process.env.DIDMAIL_WORKER_CORE_CSS) {
  const core = await packageWorkerCore({ directory: 'dist', cssFile: process.env.DIDMAIL_WORKER_CORE_CSS });
  console.log(`Packaged standalone Worker core styles: ${core.length}.`);
}
writeFileSync(
  'dist/ui-build.json',
  JSON.stringify({ renderer: 'arc-web-device', frameworks: [], modules: Object.keys(result.metafile.inputs) }, null, 2),
);
mkdirSync('artifacts', { recursive: true });
writeFileSync('artifacts/ui-metafiles.json', JSON.stringify(buildMetafiles, null, 2));
copyDistributionNotices('dist');
// No wallet, node provider settings, private AFS files or local ARC state goes into public assets.
console.log(`Web Device UI built: ${Object.keys(result.metafile.inputs).length} browser modules; no React runtime.`);
