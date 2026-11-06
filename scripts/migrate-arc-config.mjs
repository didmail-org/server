// Operator-only, one-time import. Not part of the Blocklet build or startup.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { parsePolicy, policyPath } from '../blocklet/providers/didmail-native/index.mjs';

const exec = promisify(execFile);
export async function importAttachmentConfig({ instance, file, sourceUrl, arc = async args => {
  const { stdout } = await exec('arc', [...args, '--instance', instance, '--json'], { timeout: 30000 });
  return JSON.parse(stdout.slice(stdout.indexOf('{')));
}, fetcher = fetch }) {
  if (!instance || Boolean(file) === Boolean(sourceUrl)) throw new Error('Specify an instance and exactly one of --file or --source-url');
  let content;
  if (file) content = await readFile(file, 'utf8');
  else {
    const url = new URL(sourceUrl);
    if (url.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(url.hostname) ||
        url.username || url.password || url.pathname !== '/' || url.search || url.hash)
      throw new Error('The import source must be an explicit loopback HTTP origin');
    url.pathname = '/api/mail/attachment-config';
    const response = await fetcher(url, { redirect: 'error', signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error('Original configuration could not be read');
    content = await response.text();
  }
  if (content.length > 16384) throw new Error('Configuration exceeds import size limit');
  const config = parsePolicy(content);
  const base = '/blocklets/didmail-server/instance';
  const capability = await arc(['afs', 'read', base + '/.meta/.capabilities']);
  let caps = capability.content ?? capability.data?.content;
  if (typeof caps === 'string') caps = JSON.parse(caps);
  const features = (caps?.operations ?? caps)?.write?.features;
  if (features?.ifMatch !== true || features?.treeIncrement !== true) throw new Error('Instance conditional writes are unavailable');
  const target = base + policyPath.slice('/instance'.length);
  await arc(['afs', 'write', target, '--content', JSON.stringify(config), '--mode', 'create', '--if-match', '!absent']);
  const restored = await arc(['afs', 'read', target]);
  const actual = parsePolicy(restored.content ?? restored.data?.content);
  if (JSON.stringify(actual) !== JSON.stringify(config)) throw new Error('Imported configuration did not read back exactly');
  return { target, imported: true };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { values } = parseArgs({ options: { instance: { type: 'string' }, file: { type: 'string' }, 'source-url': { type: 'string' } } });
  const result = await importAttachmentConfig({ instance: values.instance, file: values.file, sourceUrl: values['source-url'] });
  console.log(`Imported and verified attachment configuration at ${result.target}; original source retained.`);
}
