// Run existing browser interactions on generated native pages when the approved
// ARC preview is unavailable. Business APIs are still supplied by each test's
// isolated browser fixtures; this server rejects every unhandled mutation.
import { nativePackage } from './native-package-audit.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
const name = process.argv[2];
if (!['ui', 'admin', 'policy'].includes(name)) throw new Error('Usage: node scripts/browser-artifacts.mjs ui|admin|policy');
const root = path.resolve(`${nativePackage}/.web-cache`);
const source = path.resolve(nativePackage);
const html = await fs.readFile(path.join(root, 'en/index.html'), 'utf8');
const corePath = html.match(/href="(\/aup-core\.[a-f0-9]+\.css)"/)[1];
if (!process.env.DIDMAIL_BROWSER_CORE_CSS) throw new Error('Supply DIDMAIL_BROWSER_CORE_CSS with the genuine public ARC stylesheet.');
const core = await fs.readFile(process.env.DIDMAIL_BROWSER_CORE_CSS, 'utf8');
if (!core.includes('.aup-app-header')) throw new Error('Expected the genuine public ARC core stylesheet.');
const server = createServer(async (req, res) => {
  try {
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(409).end('Business mutations are unavailable in the artifact fixture'); return; }
    const url = new URL(req.url, 'http://localhost');
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === corePath) { res.writeHead(200, { 'content-type': 'text/css' }).end(core); return; }
    if (pathname === '/__blocklet__.js') { res.writeHead(200, { 'content-type': 'application/javascript' }).end('/* No live ARC bridge in native-artifact tests. */'); return; }
    const match = /^\/(?:(en|zh|ja|ar|ru)\/)?(help|admin(?:\/[a-z]+)?)?\/?$/.exec(pathname);
    if (match) {
      const preferred = (req.headers.cookie || '').match(/(?:^|;\s*)arc_lang=(zh|ja|ar|ru)(?=;|$)/)?.[1];
      if (!match[1] && preferred) { res.writeHead(302, { location: `/${preferred}${pathname}${url.search}` }).end(); return; }
      pathname = '/' + (match[1] || 'en') + '/' + (match[2] ? match[2].replaceAll('/', '-') + '/' : '') + 'index.html';
    }
    const base = pathname.startsWith('/assets/') ? source : root;
    const file = path.resolve(base, '.' + pathname);
    if (!file.startsWith(base + path.sep)) { res.writeHead(404).end(); return; }
    const body = await fs.readFile(file);
    res.writeHead(200, { 'content-type': ({ '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' })[path.extname(file)] || 'application/octet-stream' }).end(body);
  } catch { res.writeHead(404).end('Missing native artifact'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
try {
  const child = spawn(process.execPath, [`scripts/browser-${name === 'policy' ? 'mail-policy' : name}.mjs`], {
    env: { ...process.env, DIDMAIL_BROWSER_URL: `http://127.0.0.1:${server.address().port}` }, stdio: 'inherit',
  });
  const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
  process.exitCode = code ?? 1;
} finally { await new Promise(resolve => server.close(resolve)); }
