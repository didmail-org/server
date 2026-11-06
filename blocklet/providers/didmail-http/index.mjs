import { createHash } from 'node:crypto';
import { protocolConfigPath, validateProtocolConfig } from './config.mjs';
import { requireAdmin } from '../didmail-native/mail-policy.mjs';
import { runtimePath } from '../didmail-business/paths.mjs';
const registryKey = Symbol.for('didmail.native.protocol.runtime');
const failure = (code, message) => Object.assign(new Error(message), { code });
const meta = { capabilities: ['read', 'stat', 'explain'], accessMode: 'readonly' };
const installPath = '/.actions/install-config';
const actionMeta = { kind: 'afs:executable', effect: 'write', severity: 'ambient' };
export default class DIDMailHTTPProvider {
  name = 'didmail-http';
  description = 'Packaged DIDMail HTTP, signing and task execution inside ARC';
  accessMode = 'readwrite';
  static async load() {
    return new DIDMailHTTPProvider();
  }
  onMount(root) {
    this.stopped = false;
    this.root = root;
    this.timer = setTimeout(() => this.start().catch(() => {}), 1000);
  }
  async onUnmount() {
    this.stopped = true;
    clearTimeout(this.timer);
    // Startup may still be reading configuration or opening the listener. Keep
    // ownership until it settles so a late handle cannot escape shutdown.
    await this.starting?.catch(() => {});
    const current = globalThis[registryKey];
    if (current?.owners.delete(this) && !current.owners.size) {
      await current.handle?.close();
      delete globalThis[registryKey];
    }
  }
  async start() {
    if (this.stopped) return;
    if (this.starting) return this.starting;
    this.starting = this.startRuntime().finally(() => {
      this.starting = undefined;
    });
    return this.starting;
  }
  async startRuntime() {
    let config;
    try {
      config = validateProtocolConfig(JSON.parse((await this.root.read(protocolConfigPath)).data.content));
    } catch (error) {
      if (['AFS_NOT_FOUND', 1].includes(error.code)) return;
      throw failure('DIDMAIL_RUNTIME_UNAVAILABLE', 'Private protocol configuration is unavailable');
    }
    if (this.stopped || !config.enabled) return;
    await this.root.read('/didmail-business/health.json');
    const descriptor = JSON.parse((await this.root.read(runtimePath)).data.content);
    if (this.stopped) return;
    const fingerprint = createHash('sha256').update(descriptor.token).digest('hex');
    const configHash = createHash('sha256').update(JSON.stringify(config)).digest('hex');
    let current = globalThis[registryKey];
    if (current) {
      if (current.fingerprint !== fingerprint || current.configHash !== configHash)
        throw failure(
          'DIDMAIL_INSTANCE_CONFLICT',
          'Only one DIDMail signing instance is supported per ARC process; restart after changing configuration',
        );
      current.owners.add(this);
      await current.starting;
      this.ready = true;
      return;
    }
    current = { fingerprint, configHash, owners: new Set([this]) };
    globalThis[registryKey] = current;
    current.starting = (async () => {
      const { startProtocolRuntime } = await import('./host/runtime.mjs');
      current.handle = await startProtocolRuntime(this.root, config);
      this.ready = true;
    })();
    // A failed immutable signing environment is not reused with another key.
    try {
      await current.starting;
    } catch (error) {
      // A bind failure precedes immutable environment/key configuration. Retrying
      // after the port is released is safe; unknown later failures stay latched.
      if (error.retryable && globalThis[registryKey] === current) delete globalThis[registryKey];
      throw error;
    }
  }
  async read(path) {
    if (path !== '/health.json') throw failure('AFS_NOT_FOUND', 'Protocol resource not found');
    let ready = false;
    try {
      await this.start();
      ready = Boolean(this.ready);
    } catch {}
    return {
      data: {
        path,
        content: JSON.stringify({ runtime: 'arc-native', protocolIngress: ready, storage: 'instance-afs' }),
        mimeType: 'application/json',
        meta,
      },
    };
  }
  async list(path) {
    if (path === '/.actions') return { data: [{ path: installPath, meta: actionMeta }] };
    if (path !== '/') throw failure('AFS_NOT_FOUND', 'Protocol resource not found');
    return {
      data: [
        { path: '/health.json', meta },
        { path: '/.actions', meta: { kind: 'afs:node' } },
      ],
    };
  }
  async stat(path) {
    if (!['/', '/health.json', '/.actions', installPath].includes(path))
      throw failure('AFS_NOT_FOUND', 'Protocol resource not found');
    return { data: { path, meta: path === installPath ? actionMeta : meta } };
  }
  async exec(path, args, options) {
    if (path !== '/.actions/install-config') throw failure('AFS_ACTION_NOT_FOUND', 'Protocol action not found');
    requireAdmin(options?.context?.caller);
    const { _scope_afs: _scope, ...input } = args || {};
    if (Object.keys(input).some((key) => key !== 'config'))
      throw failure('AFS_VALIDATION_ERROR', 'Only private protocol configuration is accepted');
    let config;
    try {
      config = validateProtocolConfig(input.config);
    } catch {
      throw failure('AFS_VALIDATION_ERROR', 'Invalid private protocol configuration');
    }
    await this.root.write(protocolConfigPath, { content: JSON.stringify(config) }, { ifMatch: '!absent' });
    return { data: { installed: true } };
  }
  async explain() {
    return {
      data: 'The protocol listener, original signing wallet and scheduler run inside ARC. Private instance configuration is create-only through the authorized install-config action. Configuration and keys cannot be read through this provider. Restart ARC after operator configuration changes. Native HTTP is local runtime acceptance; hosted runtime and Store licensing remain separate gates.',
    };
  }
}
