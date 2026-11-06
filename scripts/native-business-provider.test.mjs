import test from 'node:test';
import assert from 'node:assert/strict';
import DIDMailBusinessProvider,{authorizePrivateRuntime} from '../blocklet/providers/didmail-business/index.mjs';
import { memoryBusinessRoot } from './afs-business-fixture.mjs';
import { businessPath } from './afs-business-store.mjs';
test('native business initialization trusts ARC caller only and rejects caller-selected inputs',async()=>{
  const root=memoryBusinessRoot(),provider=new DIDMailBusinessProvider();provider.onMount(root);
  for(const caller of [undefined,{did:'fixture',role:'member'},{did:'fixture',role:'guest'}])await assert.rejects(provider.exec('/.actions/initialize-business',{role:'owner'},{context:{caller}}),{code:'AFS_FORBIDDEN'});
  await assert.rejects(provider.exec('/.actions/initialize-business',{path:'/other'},{context:{caller:{did:'fixture',role:'owner'}}}),{code:'AFS_VALIDATION_ERROR'});
  assert.equal(root.nodes.size,0);
  await provider.exec('/.actions/initialize-business',{_scope_afs:'ignored'},{context:{caller:{did:'fixture',role:'admin'}}});
  assert.ok(root.nodes.has(businessPath));await assert.rejects(provider.exec('/.actions/initialize-business',{},{context:{caller:{did:'fixture',role:'owner'}}}),{code:'AFS_CONFLICT'});
});
test('private runtime credential comparison denies missing/wrong credentials and every browser Origin',()=>{
  const token='f'.repeat(64),request=headers=>new Request('http://127.0.0.1/storage',{method:'POST',headers});
  assert.equal(authorizePrivateRuntime(request({}),token),false);
  assert.equal(authorizePrivateRuntime(request({authorization:'Bearer '+ 'a'.repeat(64)}),token),false);
  assert.equal(authorizePrivateRuntime(request({authorization:'Bearer '+token}),token),true);
  assert.equal(authorizePrivateRuntime(request({authorization:'Bearer '+token,origin:'http://localhost'}),token),false);
});

test('business unmount waits for late startup and stops its listener', async () => {
  const provider = new DIDMailBusinessProvider();
  let release, stopped = false;
  provider.starting = new Promise(resolve => { release = resolve; }).then(() => {
    provider.server = { stop: () => { stopped = true; } };
  });
  const stopping = provider.onUnmount();
  release();
  await stopping;
  assert.equal(stopped, true);
  assert.equal(provider.server, undefined);
  assert.equal(await provider.start(), undefined);
});
