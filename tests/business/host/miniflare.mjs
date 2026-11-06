// Temporary HTTP isolation host for business regressions. Production never
// imports Miniflare. All durable operations execute the real AFS stores here.
import { Miniflare as HttpHost, convertV4MiniflareOptions as convert } from 'miniflare';
import { AfsBusinessStore, AfsObjectStore } from '../../../scripts/afs-business-store.mjs';
import { memoryBusinessRoot } from '../../../scripts/afs-business-fixture.mjs';
import { businessDatabase, createStorageBinding } from '../../../scripts/arc-storage-bridge.mjs';
const fixtures = new WeakMap();
export function convertV4MiniflareOptions(input) {
  const resources = new Map(), workers = new Map();
  const prepare = worker => {
    const { databaseFixtures, objectFixtures, ...options } = worker;
    const resourceId = Object.values(databaseFixtures || {})[0] || Object.values(objectFixtures || {})[0] || worker.name || 'default';
    let fixture = resources.get(resourceId);
    if (!fixture) {
      const root = memoryBusinessRoot(), store = new AfsBusinessStore(root);
      fixture = { root, store, ready: store.initialize({ schemaVersion: 1, schema: [], tables: {} }) };
      resources.set(resourceId, fixture);
    }
    workers.set(worker.name || '', fixture);
    const binding = createStorageBinding(fixture.root);
    return { ...options,
      bindings: { ...worker.bindings, DIDMAIL_STORAGE_BACKEND: 'afs' },
      serviceBindings: { ARC_STORAGE: async request => { await fixture.ready; return binding(request); }, ...worker.serviceBindings },
    };
  };
  const options = convert(input.workers ? { ...input, workers: input.workers.map(prepare) } : prepare(input));
  fixtures.set(options, workers);
  return options;
}
export class Miniflare extends HttpHost {
  constructor(options) { super(options); this.businessFixtures = fixtures.get(options); }
  fixture(name) {
    const fixture = this.businessFixtures?.get(name || '') || this.businessFixtures?.values().next().value;
    if (!fixture) throw Error('Business test fixture requires explicit AFS options');
    return fixture;
  }
  async getDatabase(_binding = 'DB', name) {
    const fixture = this.fixture(name); await fixture.ready;
    return businessDatabase(fixture.store);
  }
  async getObjects(_binding = 'BLOBS', name) {
    const fixture = this.fixture(name); await fixture.ready;
    const objects = new AfsObjectStore(fixture.root);
    return {
      async get(key) {
        const { value } = await objects.read(key);
        if (!value || value.deleted) return null;
        const bytes = Uint8Array.from(Buffer.from(value.bytes, 'base64'));
        return { ...value, arrayBuffer: async () => bytes.buffer, text: async () => new TextDecoder().decode(bytes) };
      },
      async head(key) {
        const { value } = await objects.read(key);
        return value && !value.deleted ? value : null;
      },
      async put(key, input, options = {}) {
        return objects.put(key, new Uint8Array(await new Response(input).arrayBuffer()), options.httpMetadata);
      },
      delete: keys => objects.delete(keys),
      async list({ prefix = '' } = {}) {
        return { objects: [...fixture.root.nodes.values()].map(n => JSON.parse(n.content)).filter(value => value.key && !value.deleted && value.key.startsWith(prefix)) };
      },
    };
  }
}
