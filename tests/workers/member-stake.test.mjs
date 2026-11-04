import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {fromRandom} from '@ocap/wallet';
import {toStakeAddress} from '@arcblock/did-util';

test('internal admission reads only one active native-token self stake, without node NFT or gas configuration',async()=>{
 const wallet=fromRandom(),node=fromRandom(),native='z35n6UoHSi9MED4uaQy6ozFgKPaZj2UKrurBG';
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,scriptPath:'.worker/test.mjs',compatibilityDate:'2026-10-24',compatibilityFlags:['nodejs_compat'],bindings:{NODE_SECRET_KEY:node.secretKey,DIDMAIL_URL:'https://stake.test'},outboundService:async()=>{throw Error('No external reads or broadcasts');}}));
 const stake={address:toStakeAddress(wallet.address,wallet.address),sender:wallet.address,receiver:wallet.address,nonce:'',assets:[],revokedAssets:[],tokens:[{address:native,value:'1000000000000000000'}],revokedTokens:[],revokeWaitingPeriod:31536000};
 const call=async state=>{const r=await mf.dispatchFetch('https://stake.test/__member-stake',{method:'POST',body:JSON.stringify({sender:'did:abt:'+wallet.address,token:{address:native,decimal:18},stake:state})});return{status:r.status,body:await r.json()};};
 try{
  assert.equal((await call(stake)).status,200);
  for(const state of [null,{...stake,tokens:[{address:native,value:'999999999999999999'}]},{...stake,tokens:[],revokedTokens:stake.tokens}]){
    const r=await call(state);assert.equal(r.status,403);assert.equal(r.body.code,'SENDER_GAS_STAKE_REQUIRED');
  }
  const bad=await call({...stake,receiver:node.address});assert.equal(bad.status,503);assert.equal(bad.body.code,'GAS_STAKE_UNAVAILABLE');
 }finally{await mf.dispose();}
});
