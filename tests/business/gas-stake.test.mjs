import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Miniflare, convertV4MiniflareOptions } from './host/miniflare.mjs';
import { fromRandom, fromSecretKey, WalletType } from '@ocap/wallet';
import { types } from '@ocap/mcrypto';
import { toStakeAddress } from '@arcblock/did-util';
const wallet = fromSecretKey(fromRandom().secretKey, WalletType({ role: types.RoleType.ROLE_APPLICATION, pk: types.KeyType.ED25519, hash: types.HashType.SHA3 }));
const nativeToken = 'z35n6UoHSi9MED4uaQy6ozFgKPaZj2UKrurBG';
const script = `let changed=false, revokeTime=null;
export default {async fetch(request) {
 const path=new URL(request.url).pathname;
 if(path==='/.well-known/service/api/did/session') {
  const auth=request.headers.get('authorization');
  return Response.json(auth==='Bearer owner'?{authenticated:true,user:{did:'owner',role:'owner'}}:auth==='Bearer admin'?{authenticated:true,user:{did:'admin',role:'admin'}}:{authenticated:false,user:null});
 }
 if(path==='/change'){changed=true;return Response.json({ok:true});}
 if(path==='/revoke-now'||path==='/revoke-old'){changed=false;revokeTime=path==='/revoke-now'?new Date().toISOString():'2020-01-01T00:00:00Z';return Response.json({ok:true});}
 if(path!=='/afs')return new Response('Unexpected request',{status:500});
 const {method,params}=await request.json();
 if(!['read','list'].includes(method))return new Response('Only reads allowed',{status:500});
 const p=params.path;
 if(p.endsWith('/.meta/.capabilities'))return Response.json({success:true,data:{data:{meta:{provenance:{provider:'ocap'}},content:{operations:{read:true,list:{supported:true}}}}}});
 if(p.endsWith('/transactions')) {
  const hash='A'.repeat(64),address=p.split('/').at(-2);
  return Response.json({success:true,data:{data:[{path:'/dev/chain/beta/transactions/'+hash,meta:{kind:'ocap:transaction:revoke_stake',provenance:{provider:'ocap'}},content:{hash,type:'revoke_stake',sender:'${wallet.address}',valid:true,code:'OK',time:revokeTime,tx:{from:'${wallet.address}',itxJson:{address,outputs:[{owner:'${wallet.address}',assets:[],tokens:[{address:'${nativeToken}',value:'1000000000000000000'}]}]}}}}],total:1}});
 }
 if(p.includes('/stakes/')) {
  if(!revokeTime)return Response.json({success:false,error:{code:1,message:'not found'}});
  return Response.json({success:true,data:{data:{path:p,meta:{kind:'ocap:stake',provenance:{provider:'ocap'}},content:{address:p.split('/').at(-1),sender:'${wallet.address}',receiver:'${wallet.address}',nonce:'',revocable:true,revokeWaitingPeriod:31536000,assets:[],tokens:[],revokedTokens:[{address:'${nativeToken}',value:'1000000000000000000'}]}}}});
 }
 const kind=p.endsWith('/config')?'config':p.split('/').at(-2),address=p.split('/').at(-1);
 const content=kind==='config'?{gasMinStake:1,gasStakeLockPeriod:changed?63072000:31536000}:kind==='tokens'?{address,symbol:'TBA',decimal:18}:{address,tokens:[{address:'${nativeToken}',value:'2000000000000000000',symbol:'TBA',decimal:18}]};
 return Response.json({success:true,data:{data:{path:p,content,meta:{kind:'ocap:'+(kind==='config'?'config':kind==='tokens'?'token':'account'),provenance:{provider:'ocap'}}}}});
}};`;
test('gas staking policy is read through AFS in the isolated HTTP fixture and requires fresh owner approval', async () => {
 const mf = new Miniflare(convertV4MiniflareOptions({workers:[
  {name:'didmail',modules:true,scriptPath:'artifacts/business-tests/test.mjs',compatibilityDate:'2026-10-24',compatibilityFlags:['nodejs_compat'],bindings:{NODE_SECRET_KEY:wallet.secretKey,DIDMAIL_URL:'https://didmail.test',CHAIN_ID:'beta',CHAIN_HOST:'https://beta.abtnetwork.io/api/',LOCAL_TOKEN_ID:nativeToken},databaseFixtures:{DB:'gas-test'},objectFixtures:{BLOBS:'gas-test'},serviceBindings:{ARC:'arc',ARC_CHAIN:'arc'},outboundService:'deny'},
  {name:'arc',modules:true,script,compatibilityDate:'2026-10-24'},
  {name:'deny',modules:true,script:`export default {fetch(){throw new Error('No broadcasts permitted')}}`,compatibilityDate:'2026-10-24'},
 ]}));
 const request=(role,method='GET',body,suffix='')=>mf.dispatchFetch('https://didmail.test/api/account/gas-stake'+suffix,{method,headers:{authorization:'Bearer '+role,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 try {
  assert.equal((await request('anonymous')).status,401);
  assert.equal((await request('admin')).status,403);
  assert.equal((await request('admin','POST',{policyId:'forged'})).status,403);
  for(const suffix of ['/revoke','/claim']) {
    assert.equal((await request('anonymous','POST',{policyId:'forged'},suffix)).status,401);
    assert.equal((await request('admin','POST',{policyId:'forged'},suffix)).status,403);
    assert.equal((await request('owner','POST',{policyId:'forged'},suffix)).status,409);
  }
  const response=await request('owner');assert.equal(response.status,200);
  const quote=await response.json();
  assert.equal(quote.waitingPeriod,31536000);
  assert.equal(quote.token.value,'1000000000000000000');
  assert.equal(quote.balance,'2000000000000000000');
  assert.equal(quote.address,toStakeAddress(quote.node,quote.node));
  assert.equal(quote.eligible,false);
  assert.equal((await request('owner','POST',{policyId:'forged'})).status,409);
  await (await mf.getWorker('arc')).fetch('https://arc/change');
  assert.equal((await request('owner','POST',{policyId:quote.policyId})).status,409);
  await (await mf.getWorker('arc')).fetch('https://arc/revoke-now');
  const waitingResponse=await request('owner');
  const waiting=await waitingResponse.json();
  assert.equal(waitingResponse.status,200,JSON.stringify(waiting));
  assert.equal(waiting.withdrawals.length,1);
  assert.equal(waiting.withdrawals[0].claimable,false);
  assert.equal((await request('owner','POST',{policyId:waiting.exitPolicyId,evidence:'A'.repeat(64)},'/claim')).status,409);
  await (await mf.getWorker('arc')).fetch('https://arc/revoke-old');
  const mature=await (await request('owner')).json();
  assert.equal(mature.withdrawals[0].claimable,true);
  assert.equal((await request('owner','POST',{policyId:mature.exitPolicyId,evidence:'B'.repeat(64)},'/claim')).status,409);
 } finally {await mf.dispose();}
});
