import { createPolicyOperations } from '../blocklet/providers/didmail-business/policy-port.mjs';
import { mailPolicyPath } from '../blocklet/providers/didmail-native/mail-policy.mjs';

// Node-local trusted adapter. It is a private Service Binding, not an HTTP route.
// The root RPC is reached at a fixed loopback ARC origin and fixed instance path.
export function localPolicyRoot(origin, { appId = 'didmail-server', fetcher = fetch } = {}) {
  const url = new URL(origin);
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(url.hostname) || url.username || url.password || url.pathname !== '/' || !/^[a-z0-9-]+$/.test(appId)) throw new Error('A fixed local ARC origin is required');
  const rpc = async (method, path, input, options) => {
    if (![mailPolicyPath, '/instance/.meta/.capabilities'].includes(path) || (method === 'write' && path !== mailPolicyPath)) throw new Error('Policy path is outside the private binding');
    const response = await fetcher(new URL('/afs', url), {
      method: 'POST', headers: { 'content-type': 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(15000),
      body: JSON.stringify({ method, params: { path: '/blocklets/' + appId + path, ...(input ? { content: input } : {}), ...(options ? { options } : {}) } }),
    });
    const body = await response.json();
    if (!response.ok || !body.success) {
      const message = body.error?.message || 'ARC instance policy request failed';
      const conflict = /conflict|version.*match|already exists/i.test(message);
      throw Object.assign(new Error(message), { code: conflict ? 'AFS_CONFLICT' : body.error?.code === 1 ? 'AFS_NOT_FOUND' : typeof body.error?.code === 'string' ? body.error.code : 'AFS_UNAVAILABLE', status: conflict ? 409 : 503 });
    }
    return body.data;
  };
  return { read: path => rpc('read', path), write: (path, input, options) => rpc('write', path, input, options) };
}
export function createMailPolicyBinding(root) {
  const operate=createPolicyOperations(root);
  return async request => {
    if(request.method!=='POST'||new URL(request.url).pathname!=='/policy')return new Response('Private policy operation required',{status:403});
    try{return Response.json({data:await operate(await request.json())});}
    catch(error){return Response.json({code:error.code||'MAIL_POLICY_UNAVAILABLE',detail:error.status&&error.status<500?error.message:'Instance policy unavailable'},{status:error.status||(error.code==='AFS_CONFLICT'?409:503)});}
  };
}
