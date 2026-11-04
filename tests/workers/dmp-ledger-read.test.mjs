import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {digest,unb64u,DOLT_COMMITTED_RECORD_QUERY} from '@didmail/protocol';
import {fromRandom} from '@ocap/wallet';

test('workerd public Dolt evidence reads bind original bytes and reject missing or conflicting evidence',{timeout:60000},async()=>{
 const fixture=JSON.parse(await fs.readFile('test/fixtures/protocol/dolt-ledger.json','utf8'));
 const bytes=unb64u(fixture.signedTransaction),hash=digest(bytes).toUpperCase();let mutate=x=>x,requests=0,redirect=false;
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,scriptPath:'.worker/test.mjs',compatibilityDate:'2026-10-24',compatibilityFlags:['nodejs_compat'],bindings:{DIDMAIL_URL:'https://dmp.test',NODE_SECRET_KEY:fromRandom().secretKey},outboundService:async request=>{
  requests++;assert.equal(request.url,'https://chain.test/api/');assert.equal(request.method,'POST');
  if(redirect)return new Response('',{status:302,headers:{location:'https://untrusted.test/api/'}});
  for(const key of ['authorization','X-DIDMail-did','X-DIDMail-pk'])assert.equal(request.headers.get(key),null);
  assert.deepEqual(await request.json(),{query:DOLT_COMMITTED_RECORD_QUERY,variables:{hash}});
  const response=structuredClone(fixture.response);response.data.getTx.info.time=new Date(Date.now()-1000).toISOString();
  return Response.json(mutate(response));
 }}));
 const inspect=()=>mf.dispatchFetch('https://dmp.test/__dmp/ledger-record',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({original:fixture.signedTransaction})});
 try{
  let response=await inspect();let payload=await response.json();assert.equal(response.status,200,JSON.stringify(payload));assert.equal(payload.state,'committed');
  mutate=x=>{x.data.getTx.info=null;return x;};response=await inspect();assert.deepEqual(await response.json(),{state:'pending'});
  mutate=x=>{x.data.getTx.info.code='INVALID_SIGNATURE';return x;};response=await inspect();assert.equal((await response.json()).state,'rejected');
  for(const change of [x=>{delete x.data.getTx.info;},x=>{x.data.getChainInfo.info.network='main';},x=>{x.data.getChainInfo.info.consensusVersion='@ocap/statedb-dolt v1.20.3';},x=>{x.data.getTx.info.hash='0'.repeat(64);},x=>{x.errors=[{message:'partial'}];}]){
    mutate=x=>{change(x);return x;};response=await inspect();assert.equal(response.status,503);assert.equal((await response.json()).error,'LEDGER_EVIDENCE_UNAVAILABLE');
  }
  const before=requests;response=await mf.dispatchFetch('https://dmp.test/__dmp/ledger-record',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({original:''})});assert.equal(response.status,503);assert.equal(requests,before);
  redirect=true;response=await inspect();assert.equal(response.status,503);assert.equal(requests,before+1);
  const previous=requests;response=await mf.dispatchFetch('https://dmp.test/__dmp/unsafe-chain-request');assert.deepEqual(await response.json(),{blocked:true});assert.equal(requests,previous);
 }finally{await mf.dispose();}
});
