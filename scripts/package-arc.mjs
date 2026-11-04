import localeConfig from '../ui/locales/config.js';
import { copyDistributionNotices } from './distribution-notices.mjs';
import { rmSync } from 'node:fs';
import { createPublicPackageWriter } from './public-package-files.mjs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
require('dotenv-flow').config();
const port = Number(process.env.DIDMAIL_PORT || 3140);
const url = new URL(process.env.DIDMAIL_URL || `http://didmail-server.localhost:${port}`);
const files = createPublicPackageWriter(path.resolve('blocklet'));
const root = files.root;
copyDistributionNotices(root);
files.write(
  'providers/didmail/config.json',
  JSON.stringify({ endpoint: process.env.DIDMAIL_WORKER_URL || 'http://127.0.0.1:8787' }) + '\n',
);
rmSync(path.join(root, '.web-cache'), { recursive: true, force: true });
files.copy('logo.svg', '.web/template/logo.svg');
files.write('.web/seo/og-site-name', 'DIDMail Server');
files.write(
  '.web/template/header-actions',
  JSON.stringify([
    {
      kind: 'locale-switcher',
      locales: localeConfig.languages.map(({ code }) => code),
      labels: Object.fromEntries(localeConfig.languages.map(({ code, label }) => [code, label])),
    },
    { kind: 'theme-toggle' },
    { kind: 'user-menu' },
  ]) + '\n',
);
files.write('.web/template/navigation', JSON.stringify([]) + '\n');
files.write(
  '.web/seo/og-image',
  '/.well-known/service/blocklet/og.png?template=default&title=DIDMail%20Server&locale=en',
);
files.write('.route/web', 'site: didmail-server\npath: /\nsource: .\nhandler: web\naccess: public\n');
files.write(
  '.web/site.yaml',
  `name: DIDMail Server\nlocale: ${localeConfig.defaultLocale}\nlocales: ${JSON.stringify(localeConfig.languages.map(({ code }) => code))}\nrender-mode: static\ncolor-scheme: system\ntemplate:\n  header: app-header\n`,
);
files.write(
  'blocklet.yaml',
  `specVersion: 2
id: didmail-server
name: DIDMail Server
did: did:blocklet:didmail-server
version: 0.1.0
description: Decentralized encrypted mail with the original REST API and native AUP Web Device UI
logo: web/logo.svg
license: Apache-2.0
save: false
scope: app
sites:
  - name: didmail-server
    domains: [${JSON.stringify(url.hostname)}]
mounts:
  - target: ./providers/didmail
    path: /didmail
    required: true
    ops: [list, read, stat, explain]
`,
);
console.log('Prepared ARC package at blocklet/ (only public assets and a read-only provider mount).');
