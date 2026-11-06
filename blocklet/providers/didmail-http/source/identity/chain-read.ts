import createAfsChainReader from '../api/src/libs/afs-chain-reader';
import { arcFetch } from './arc';
import { bindings, value } from '../runtime/bindings';

function normalizedEndpoint(endpoint: string) {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw Object.assign(new Error('Invalid chain endpoint'), { code: 'AFS_CHAIN_UNAVAILABLE' });
  }
  if (url.username || url.password || url.search || url.hash)
    throw Object.assign(new Error('Invalid chain endpoint'), { code: 'AFS_CHAIN_UNAVAILABLE' });
  return url.origin + url.pathname.replace(/\/+$/, '');
}
function mount() {
  const endpoint = normalizedEndpoint(value('CHAIN_HOST', 'https://beta.abtnetwork.io/api/'));
  const configured = value('ARC_CHAIN_PATH');
  if (configured) {
    if (!value('ARC_CHAIN_ENDPOINT') || normalizedEndpoint(value('ARC_CHAIN_ENDPOINT')) !== endpoint)
      throw Object.assign(new Error('ARC_CHAIN_ENDPOINT must explicitly match CHAIN_HOST for a custom mount'), {
        code: 'AFS_CHAIN_UNAVAILABLE',
      });
    return configured;
  }
  for (const network of ['beta', 'main'])
    if (endpoint === `https://${network}.abtnetwork.io/api` && value('CHAIN_ID', 'beta') === network)
      return `/dev/chain/${network}`;
  throw Object.assign(new Error('Configure ARC_CHAIN_PATH and ARC_CHAIN_ENDPOINT for this chain'), {
    code: 'AFS_CHAIN_UNAVAILABLE',
  });
}
let reader: ReturnType<typeof createAfsChainReader>;
export default function chainReads<T>(_client: T): T {
  reader ||= createAfsChainReader(async (method, path, options) => {
    const failed = (message: string, stage: string, extra = {}) =>
      Object.assign(new Error(message), { code: 'AFS_CHAIN_UNAVAILABLE', path, stage, ...extra });
    let response: Response;
    try {
      const request = new Request(new URL('/afs', value('DIDMAIL_URL', 'https://didmail.internal')), {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ method, params: { path, ...(options ? { options } : {}) } }),
        signal: AbortSignal.timeout(10_000),
      });
      if (bindings.ARC_CHAIN) response = await bindings.ARC_CHAIN.fetch(request);
      else {
        const token = value('ARC_CHAIN_TOKEN');
        if (token) request.headers.set('authorization', `Bearer ${token}`);
        response = await arcFetch(request);
      }
    } catch (error) {
      const reason = ['TimeoutError', 'AbortError'].includes(error?.name) ? 'TIMEOUT_10S' : 'TRANSPORT_ERROR';
      throw failed('ARC OCAP provider is unavailable', 'transport', { reason });
    }
    if (!response.ok) throw failed('ARC OCAP RPC request failed', 'http', { httpStatus: response.status });
    let body: any;
    try {
      if (!response.body) throw new Error('Empty RPC body');
      const stream = response.body.getReader();
      const decoder = new TextDecoder();
      const chunks: string[] = [];
      let bytes = 0;
      for (;;) {
        const { value: chunk, done } = await stream.read();
        if (done) break;
        bytes += chunk.byteLength;
        if (bytes > 16 * 1024 * 1024) {
          await stream.cancel();
          throw new Error('RPC response too large');
        }
        chunks.push(decoder.decode(chunk, { stream: true }));
      }
      chunks.push(decoder.decode());
      body = JSON.parse(chunks.join(''));
    } catch (error) {
      if (['TimeoutError', 'AbortError'].includes(error?.name))
        throw failed('ARC OCAP response timed out', 'transport', { reason: 'TIMEOUT_10S' });
      throw failed('Malformed ARC OCAP RPC response', 'decode');
    }
    if (!body || body.success !== true) {
      const missing = body?.error?.code === 1 || body?.error?.code === 'AFS_NOT_FOUND';
      throw Object.assign(new Error(body?.error?.message || 'ARC OCAP query failed'), {
        code: missing ? 'AFS_CHAIN_NOT_FOUND' : 'AFS_CHAIN_UNAVAILABLE',
        path,
        stage: 'rpc',
      });
    }
    return body.data;
  }, mount());
  return reader as T;
}
