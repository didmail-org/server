import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { fromBase58 } from '@ocap/util';

if (!isMainThread) {
  const bytes = new Uint8Array(fromBase58(workerData));
  parentPort.postMessage(bytes, [bytes.buffer]);
}

// Keep the independent OCAP reference decoder, but run its quadratic conversion
// away from the Miniflare host's event loop. A 64 KiB transaction can otherwise
// stall idle-socket cleanup for seconds and race workerd's connection timeout.
export async function decodeOcapReference(encoded) {
  const worker = new Worker(new URL(import.meta.url), { workerData: encoded });
  try {
    return await new Promise((resolve, reject) => {
      worker.once('message', resolve);
      worker.once('error', reject);
      worker.once('exit', (code) => reject(new Error(`OCAP reference decoder exited without a result (${code})`)));
    });
  } finally {
    await worker.terminate();
  }
}
