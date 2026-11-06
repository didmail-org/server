// Compatibility port for isolated legacy tests and operator tools.
export * from './arc-native-storage-client.mjs';
import { createStorageOperations, storageFailure } from '../blocklet/providers/didmail-business/operations.mjs';
export function createStorageBinding(root) {
  const operate = createStorageOperations(root);
  return async request => {
    if (request.method !== 'POST' || new URL(request.url).pathname !== '/storage') return new Response('Private storage operation required',{status:403});
    try { return Response.json({data:await operate(await request.json())}); }
    catch(error) { const failure=storageFailure(error);return Response.json(failure,{status:failure.status}); }
  };
}
