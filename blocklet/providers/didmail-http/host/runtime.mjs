import { createProtocolServer } from './http-server.mjs';
import { createStorageOperations, storageFailure } from '../../didmail-business/operations.mjs';
import { AfsBusinessStore } from '../../didmail-business/store.mjs';
import { registerLoader } from './loader.mjs';
import { configureEnvironment } from './environment.mjs';
import { arcHttpTransport } from './arc-http-transport.mjs';
import { previewRouting } from './preview-routing.mjs';
import createChainForward from './arc-chain-bridge.mjs';

export async function startProtocolRuntime(root, config) {
  registerLoader();
  // A missing migration/import is an operator error; no implicit empty store.
  await new AfsBusinessStore(root).transaction([{ sql: 'SELECT 1' }]);
  const routing = previewRouting({
    origin: config.publicOrigin,
    arc: config.arcOrigin,
    aliases: config.aliases,
    listenHost: config.listenHost,
  });
  const forward = async (request) => {
    const { target, publicOrigin } = routing.resolve(request.url);
    const headers = Object.fromEntries(request.headers);
    for (const key of Object.keys(headers))
      if (/^x-(caller-|arc-role|arc-did|forwarded-)/i.test(key)) delete headers[key];
    delete headers.connection;
    delete headers['transfer-encoding'];
    delete headers['content-length'];
    const body = ['GET', 'HEAD'].includes(request.method) ? undefined : Buffer.from(await request.arrayBuffer());
    if (body) headers['content-length'] = String(body.length);
    return arcHttpTransport(config.arcOrigin, publicOrigin)(target, {
      method: request.method,
      headers,
      body,
      signal: AbortSignal.timeout(30000),
    });
  };
  const operate = createStorageOperations(root);
  const privateBinding = (policy) => ({
    async fetch(request) {
      try {
        return Response.json({
          data: await operate(policy ? { op: 'policy', operation: await request.json() } : await request.json()),
        });
      } catch (error) {
        const failure = storageFailure(error);
        return Response.json({ ...failure, detail: failure.error }, { status: failure.status });
      }
    },
  });
  const { ARC_MEMBERS_TOKEN: token, ...wallet } = config.secrets;
  const environment = {
    ...config.vars,
    ...wallet,
    DIDMAIL_URL: config.publicOrigin,
    DIDMAIL_RUNTIME: 'arc-native',
    DIDMAIL_STORAGE_BACKEND: 'afs',
    DIDMAIL_POLICY_BACKEND: 'afs',
    DIDMAIL_CONFIG_BACKEND: 'afs',
    ARC: { fetch: forward },
    ARC_STORAGE: privateBinding(false),
    ARC_MAIL_POLICY: privateBinding(true),
    ARC_CHAIN: { fetch: createChainForward(config.arcOrigin) },
  };
  if (token) {
    const { default: createMembersForward } = await import('./arc-members-bridge.mjs');
    environment.ARC_MEMBERS = {
      fetch: createMembersForward({
        origin: config.arcOrigin,
        publicOrigin: config.publicOrigin,
        instanceId: config.vars.DIDMAIL_ARC_INSTANCE_ID,
        namespace: 'didmail-server',
        token,
      }),
    };
  }
  const pending = new Set();
  const context = {
    waitUntil(promise) {
      const tracked = Promise.resolve(promise)
        .catch(() => {
          console.error('DIDMail background operation deferred');
        })
        .finally(() => pending.delete(tracked));
      pending.add(tracked);
    },
    passThroughOnException() {},
  };
  let ready = false,
    core,
    app;
  const { server, close: closeServer } = createProtocolServer({
    config, routing, fetch: request => core.fetch(request, environment, context), isReady: () => ready,
  });
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(config.listenPort, config.listenHost, resolve);
    });
  } catch (error) {
    throw Object.assign(new Error('DIDMail listener is unavailable'), {
      code: 'DIDMAIL_LISTENER_UNAVAILABLE',
      retryable: true,
    });
  }
  try {
    configureEnvironment(environment);
    const { default: getWallet } = await import('../source/identity/wallet.ts');
    getWallet(); // Verify the original key/address before serving a public request.
    ({ default: core } = await import('../source/http/index.ts'));
    // Validate the complete legacy router at startup, rather than leaving broken
    // dependency loading hidden behind a later authenticated request.
    app = await import('./app.mjs');
    ready = true;
    let scheduled = false,
      stopping = false;
    const runScheduled = async () => {
      if (stopping || scheduled) return;
      scheduled = true;
      try {
        await core.scheduled({}, environment, context);
        while (pending.size) await Promise.all([...pending]);
      } catch {
        console.error('DIDMail native scheduler deferred');
      } finally {
        scheduled = false;
      }
    };
    const timer = config.jobsIntervalSeconds ? setInterval(runScheduled, config.jobsIntervalSeconds * 1000) : undefined;
    timer?.unref?.();
    return {
      async close() {
        stopping = true;
        clearInterval(timer);
        await closeServer();
        await app.closeApp();
      },
    };
  } catch (error) {
    await closeServer();
    throw error;
  }
}
