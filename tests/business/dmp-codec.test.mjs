import fs from 'node:fs/promises';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {Miniflare,convertV4MiniflareOptions} from './host/miniflare.mjs';
import {fromRandom,fromPublicKey,fromAddress} from '@ocap/wallet';
import {toUint8Array} from '@ocap/util';
import {getAddress} from 'ethers';
import {getRelatedAddresses} from '@ocap/util/lib/get-related-addr.js';
import {b64u,unb64u,digest,identityId,createKeyRecord,sealMessage,manifestHash,signArtifact,uuid} from '@didmail/protocol';
const sdk=createRequire(new URL('../../../mobile/package.json',import.meta.url));

test('shared business handler verifies Chrome NFT payment signing with the mobile SDK and rejects duplicate payers',{timeout:60000},async()=>{
 // Execute the unchanged browser signer source from the server's test directory,
 // so this regression does not introduce an extension dependency installation.
 const signerSource=new URL('../../../extension/src/libs/nft-payment-signing.ts',import.meta.url);
 // Each suite process owns its import fixture; concurrent runs must not remove
 // another process's file while Node resolves the TypeScript module.
 const signerDirectory=await fs.mkdtemp(new URL('../../artifacts/business-tests/nft-payment-signing-',import.meta.url));
 const signerFixture=new URL('signer.mts',pathToFileURL(signerDirectory+'/'));
 let signPreparedNftPayment;
 try{
  await fs.copyFile(signerSource,signerFixture);
  ({signPreparedNftPayment}=await import(signerFixture.href));
 }finally{await fs.rm(signerDirectory,{recursive:true,force:true});}
 const application=fromRandom(),payer=fromRandom(),recipient=fromRandom(),network='beta',endpoint='https://chain.test/api/';
 const owner=identityId(payer.address),receiver=identityId(recipient.address),service=identityId(application.address);
 const matches=(pk,did)=>fromPublicKey(pk,fromAddress(did.slice(8)).type).address===did.slice(8);
 const sealed=sealMessage({senderId:owner,recipientId:receiver,serviceId:service,secretKey:toUint8Array(payer.secretKey),senderKey:createKeyRecord(owner,toUint8Array(payer.secretKey)),recipientKey:createKeyRecord(receiver,toUint8Array(recipient.secretKey)),matches,planId:'zPublicPlan',subject:'Public codec fixture',body:'No chain broadcast'});
 const at=new Date().toISOString(),quote=signArtifact('DMP1-QUOTE',{quoteId:uuid(),quoteVersion:1,messageId:sealed.manifest.messageId,manifestSha256:manifestHash(sealed.manifest),serviceId:service,planId:'zPublicPlan',issuedAt:at,expiresAt:new Date(Date.now()+300000).toISOString(),paymentAsset:{chainId:network,assetId:'zPublicToken',decimals:18,symbol:'TBA'},envelopeAmount:'100',storageAmount:'0',totalAmount:'100',indexAmount:'0',developerAmount:'20',serviceAmount:'80',retention:{mode:'indefinite'},settlement:{profile:'arcblock-transfer-v3-mail-nft/1',chainId:network,chainEndpoint:endpoint,paymentAssetId:'zPublicToken',paymentAssetDecimals:18,envelopeFactoryId:'zPublicEnvelope',messageFactoryId:'zPublicMail',payerId:owner,servicePayeeAddress:application.address,developerPayeeAddress:'0x52908400098527886e0f7030069857d2e4169ee7',indexLocatorField:'subject',confirmationPolicy:'arcblock-dolt-ledger/1'}},service,toUint8Array(application.secretKey));
 let reads=0;
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,scriptPath:'artifacts/business-tests/test.mjs',compatibilityDate:'2026-10-24',compatibilityFlags:['nodejs_compat'],bindings:{NODE_SECRET_KEY:application.secretKey,DIDMAIL_URL:'https://dmp.test',CHAIN_ID:network,CHAIN_HOST:endpoint,FACTORY_OWNER:quote.settlement.developerPayeeAddress},outboundService:async request=>{
  reads++;assert.equal(request.url,endpoint);const body=await request.json();assert.equal(typeof body.query,'string');assert.equal(JSON.stringify(body).includes(application.secretKey),false);assert.equal(JSON.stringify(body).includes(payer.secretKey),false);
  for(const key of ['authorization','X-DIDMail-did','X-DIDMail-pk'])assert.equal(request.headers.get(key),null);
  assert.equal(/\bsendTx\s*\(/.test(body.query),false);
  const data={};if(body.query.includes('getChainInfo'))data.getChainInfo={code:'OK',info:{network,id:'public-chain-id',synced:true,consensusVersion:'@ocap/statedb-dolt v1.20.2',blockHeight:'0'}};
  if(body.query.includes('getForgeState'))data.getForgeState={code:'OK',state:{txConfig:{txFee:[]}}};
  if(body.query.includes('getFactoryState'))data.getFactoryState={code:'OK',state:{address:quote.settlement.messageFactoryId,numMinted:0,data:{typeUrl:'json',value:'{}'},output:{readonly:true,transferrable:true,ttl:0,data:{typeUrl:'json',value:JSON.stringify({id:'{{input.id}}',sender:'{{input.sender}}',receiver:'{{input.receiver}}',subject:'{{input.subject}}',endpoint:'{{input.endpoint}}',hash:'{{input.hash}}'})}}}};
  if(body.query.includes('getAccountState'))data.getAccountState={code:'OK',state:{address:getAddress(quote.settlement.developerPayeeAddress),moniker:'Public issuer fixture'}};

  assert.ok(Object.keys(data).length>0,'Unexpected RPC operation');return Response.json({data});
 }}));
 const call=async input=>{const response=await mf.dispatchFetch('https://dmp.test/__dmp/payment-codec',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input)});return{status:response.status,body:await response.json()};};
 try{
  const pk=b64u(toUint8Array(payer.publicKey)),prepared=await call({operation:'prepare',manifest:sealed.manifest,quote,pk});assert.equal(prepared.status,200,JSON.stringify(prepared.body));
  const raw=unb64u(prepared.body.unsigned),format=raw[0]===217&&raw[1]===217&&raw[2]===247?'cbor':'protobuf';
  const client=new (sdk(format==='protobuf'?'@ocap/client/legacy':'@ocap/client'))('https://network-forbidden.invalid',false);client.getContext=async()=>({chainId:network,txConfig:{txFee:[]}});client.doRawQuery=async()=>{throw Error('Mobile SDK network forbidden');};
  const {toBase58}=sdk('@ocap/util'),mobileWallet=sdk('@ocap/wallet').fromSecretKey(toUint8Array(payer.secretKey),{pk:0,hash:1});
  const tx=client.decodeTx(toBase58(unb64u(prepared.body.unsigned)));
  const payee=quote.settlement.developerPayeeAddress,existing={address:getAddress(payee)};
  // Reproduce TransferV3's exact receiver-state lookup: lowercasing misses the
  // existing checksum account, so updateOrCreate attempts a duplicate insert.
  assert.equal(getRelatedAddresses(existing).includes(payee),false);
  const transfer=sdk('@ocap/message').decodeAny(tx.itx).value;
  const developerOutput=(transfer.outputsList||transfer.outputs).find(item=>item.owner===existing.address);
  assert.ok(developerOutput,'Payment output must resolve the existing checksum account');
  assert.equal(getRelatedAddresses(existing).includes(developerOutput.owner),true);
  assert.equal((developerOutput.tokensList||developerOutput.tokens)[0].value,'20');
  assert.equal(((transfer.inputsList||transfer.inputs)[0].tokensList||(transfer.inputsList||transfer.inputs)[0].tokens)[0].value,'100','Canonicalization must not change the payment amount');
  const checked=await client.encodeTransferV3Tx({tx,wallet:mobileWallet});assert.equal(b64u(checked.buffer),prepared.body.unsigned,'Mobile encoding changed the accepted wire format');
  // Reproduce the Chrome bug with the real codec: duplicating the existing
  // payer yields a signature rejection, before any transaction is broadcast.
  const duplicated=client.decodeTx(toBase58(raw));
  duplicated.signaturesList.push({signer:mobileWallet.address,pk:mobileWallet.publicKey});
  let oldSigned=await client.multiSignTransferV3Tx({tx:duplicated,wallet:mobileWallet});
  oldSigned=await client.signTransferV3Tx({tx:{...oldSigned,itx:duplicated.itx},wallet:mobileWallet});
  const oldWire=await client.encodeTransferV3Tx({tx:{...oldSigned,itx:duplicated.itx},wallet:mobileWallet});
  const oldResult=await call({operation:'verify',unsigned:prepared.body.unsigned,signed:b64u(oldWire.buffer),identity:owner,pk});
  assert.equal(oldResult.status,409);assert.equal(oldResult.body.error,'PAYMENT_SIGNATURE_INVALID');
  const chromeWallet=sdk('@ocap/wallet').fromSecretKey('0x'+Buffer.from(toUint8Array(payer.secretKey)).toString('hex'),{pk:0,hash:1});
  assert.equal(typeof chromeWallet.publicKey,'string');
  const correct=await signPreparedNftPayment(client,{encoding:'base64url',quoteId:quote.quoteId,unsignedTransaction:prepared.body.unsigned},{...sealed,quote},chromeWallet);
  const wire={buffer:unb64u(correct)};
  assert.equal(client.decodeTx(toBase58(wire.buffer)).signaturesList.length,1);

  const verified=await call({operation:'verify',unsigned:prepared.body.unsigned,signed:b64u(wire.buffer),identity:owner,pk});assert.equal(verified.status,200,JSON.stringify(verified.body));assert.equal(verified.body.hash,digest(wire.buffer).toUpperCase());assert.ok(reads>0);
  // Exercise real production NFT preparation/signing, not the jobs adapter stub.
  // Array/number factory variables used to throw after payment confirmation.
  const minted=await call({operation:'index-prepare',manifest:sealed.manifest,quote,paymentHash:verified.body.hash});
  assert.equal(minted.status,200,JSON.stringify(minted.body));
  assert.equal(minted.body.hash,digest(unb64u(minted.body.bytes)).toUpperCase());
  assert.ok(minted.body.assetId);
  const indexTx=client.decodeTx(toBase58(unb64u(minted.body.bytes)));
  const acquire=sdk('@ocap/message').decodeAny(indexTx.itx).value;
  const variables=Object.fromEntries((acquire.variablesList||acquire.variables).map(item=>[item.name,item.value]));
  assert.equal(variables.attachments,'[]');
  assert.equal(variables.totalAttachmentSize,'0');
  assert.equal(variables.attachmentStorageCost,'0');
  assert.equal(acquire.owner,recipient.address);
  const locator=JSON.parse(new TextDecoder().decode(unb64u(variables.subject)));
  assert.equal(locator.messageId,sealed.manifest.messageId);
  assert.equal(locator.paymentTransactionId,verified.body.hash);
  assert.equal(locator.manifestSha256,quote.manifestSha256);
  assert.equal('body' in locator,false);
  const sponsoredQuote={...quote,indexAmount:'10',totalAmount:'0',envelopeAmount:'0',storageAmount:'0',serviceAmount:'0',developerAmount:'0',funding:{mode:'node-sponsored',sponsorId:sealed.manifest.serviceId,amount:'10'}};
  const funded=await call({operation:'index-prepare',manifest:sealed.manifest,quote:sponsoredQuote,paymentHash:''});assert.equal(funded.status,200,JSON.stringify(funded.body));
  const fundedTx=client.decodeTx(toBase58(unb64u(funded.body.bytes))),fundedAcquire=sdk('@ocap/message').decodeAny(fundedTx.itx).value;
  const fundedVariables=Object.fromEntries((fundedAcquire.variablesList||fundedAcquire.variables).map(item=>[item.name,item.value]));
  const fundedLocator=JSON.parse(new TextDecoder().decode(unb64u(fundedVariables.subject)));
  assert.equal(fundedLocator.paymentTransactionId,undefined);assert.deepEqual(fundedLocator.funding,{mode:'node-sponsored',quoteId:quote.quoteId});
  assert.equal(fundedTx.from,indexTx.from);assert.notEqual(fundedTx.from,payer.address);
  const fundedInputs=fundedAcquire.inputsList||fundedAcquire.inputs;assert.equal(String((fundedInputs[0].tokensList||fundedInputs[0].tokens)[0].value),sponsoredQuote.indexAmount);assert.ok(BigInt(sponsoredQuote.indexAmount)>0n);

  const bad=await call({operation:'verify',unsigned:prepared.body.unsigned,signed:prepared.body.unsigned,identity:owner,pk});assert.equal(bad.status,409);
  for(const mutation of ['primary signature','signer key','nonce']){
    const changed=client.decodeTx(toBase58(wire.buffer));
    if(mutation==='primary signature')changed.signature[0]=(changed.signature[0]+1)%256;
    if(mutation==='signer key')(changed.signatures||changed.signaturesList)[0].pk=new Uint8Array(32);
    if(mutation==='nonce')changed.nonce=(BigInt(changed.nonce)+1n).toString();
    const encoded=await client.encodeTransferV3Tx({tx:changed,wallet:mobileWallet});
    const rejected=await call({operation:'verify',unsigned:prepared.body.unsigned,signed:b64u(encoded.buffer),identity:owner,pk});assert.equal(rejected.status,409,mutation);
  }
 }finally{await mf.dispose();}
});
