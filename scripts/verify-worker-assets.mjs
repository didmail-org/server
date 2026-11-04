// Standalone start/deploy must fail closed before serving broken native pages.
import { verifyWorkerCore } from './package-worker-core.mjs';
const assets = await verifyWorkerCore({ directory: 'dist' });
console.log(`Standalone Worker core styles verified: ${assets.length}.`);
