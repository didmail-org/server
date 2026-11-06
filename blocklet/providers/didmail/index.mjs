import config from './config.json' with { type: 'json' };
const resources = ['/health.json', '/attachment-config.json'];
const capabilities = ['list', 'read', 'stat', 'explain'];
const meta = { capabilities, accessMode: 'readonly' };
const notFound = (path) => Object.assign(new Error(`DIDMail resource not found: ${path}`), { code: 'AFS_NOT_FOUND' });

// Structural AFS provider. No host SDK, mutable mail data, credentials, or signing capability.
export default class DIDMailProvider {
  name = 'didmail';
  description = 'Read-only DIDMail service health and public attachment policy';
  accessMode = 'readonly';
  constructor(endpoint) {
    this.endpoint = endpoint;
  }
  onMount(root) {
    this.root = root;
  }
  static async load() {
    if (config.native === true) return new DIDMailProvider();
    const { endpoint } = config;
    const url = new URL(endpoint);
    if (
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname)))
    )
      throw new Error('Provider endpoint must be HTTPS (or local development loopback)');
    return new DIDMailProvider(url.origin);
  }
  async list(path) {
    if (path !== '/' && !resources.includes(path)) throw notFound(path);
    return { data: path === '/' ? resources.map((path) => ({ id: path, path, meta })) : [] };
  }
  async stat(path) {
    if (path !== '/' && !resources.includes(path)) throw notFound(path);
    return {
      data: {
        id: path,
        path,
        meta: { ...meta, ...(path === '/' ? { childrenCount: resources.length } : { mimeType: 'application/json' }) },
      },
    };
  }
  async read(path) {
    if (!resources.includes(path)) throw notFound(path);
    if (!this.endpoint) {
      if (!this.root) throw Object.assign(new Error('Instance is unavailable'), { code: 'AFS_NOT_SUPPORTED' });
      const result = await this.root.read(
        path === '/health.json' ? '/didmail-http/health.json' : '/instance/app/didmail/public/attachment-config.json',
      );
      const content =
        typeof result.data.content === 'string' ? result.data.content : JSON.stringify(result.data.content);
      JSON.parse(content);
      return { data: { id: path, path, content, mimeType: 'application/json', meta } };
    }
    const target = path === '/health.json' ? '/api/health' : '/api/mail/attachment-config';
    const response = await fetch(this.endpoint + target, { signal: AbortSignal.timeout(5000), redirect: 'error' });
    if (!response.ok) throw new Error(`DIDMail service unavailable (${response.status})`);
    const content = await response.text();
    JSON.parse(content);
    return { data: { id: path, path, content, mimeType: 'application/json', meta } };
  }
  async explain(path) {
    if (path !== '/' && !resources.includes(path)) throw notFound(path);
    return {
      data: '# DIDMail\nRead-only health and attachment policy. Mail REST endpoints retain DID headers and wallet signatures. No mail content or signing actions are exposed here.',
    };
  }
}
