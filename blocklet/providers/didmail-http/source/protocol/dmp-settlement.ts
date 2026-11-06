import GraphQLClient from '@ocap/client';
import { fromAddress,fromPublicKey } from '@ocap/wallet';
import { toBase58,toUint8Array } from '@ocap/util';
import { toTxHash } from '@ocap/mcrypto';
import { isDeepStrictEqual } from 'node:util';
import { getAddress,parseUnits } from 'ethers';
import { addressOf,identityId,b64u,unb64u,canonicalize,utf8,digest,confirmationPolicy,validateChainConfirmation,type ChainConfirmation,type Manifest,type Quote,type Settlement,type Discovery } from '@didmail/protocol';
import env from '../config/env';
import wallet from '../identity/wallet';
import { Envelope } from '../storage/database';
import { value } from '../runtime/bindings';
import { accountLinksEnabled } from '../identity/arc-members';
import { requireSendingGasEligibility } from '../policy/mail-gas-eligibility';
import { readDmpLedgerRecord,requestDmpChainRpc } from './dmp-ledger-read';
export type Evidence = Omit<ChainConfirmation,'chainId'> & {blockHeight?:string;confirmationPolicy?:Settlement['confirmationPolicy'];ledgerBackend?:'@ocap/statedb-dolt v1.20.2';assetId?:string;rejected?:boolean};
export function receiptEvidence(evidence:Evidence,quote:Quote,expectedHash:string):ChainConfirmation{
  const policy=confirmationPolicy(quote.settlement.confirmationPolicy);
  if(evidence.transactionId!==expectedHash)throw new Error('CONFLICTING_CHAIN_EVIDENCE');
  if((policy==='arcblock-dolt-ledger/1'&&evidence.blockHeight!==undefined)||(policy==='arcblock-committed'&&evidence.ledgerBackend!==undefined))throw new Error('CONFLICTING_CHAIN_EVIDENCE');
  const common={chainId:quote.settlement.chainId,transactionId:evidence.transactionId,confirmedAt:evidence.confirmedAt};
  const result=policy==='arcblock-dolt-ledger/1'?{...common,confirmationPolicy:policy,ledgerBackend:evidence.ledgerBackend}:{...common,blockHeight:evidence.blockHeight};
  try{if((evidence.confirmationPolicy??'arcblock-committed')!==policy||validateChainConfirmation(result)!==policy)throw new Error();}catch{throw new Error('CONFLICTING_CHAIN_EVIDENCE');}
  return result as ChainConfirmation;
}
export interface Plan {planId:string;name:string;envelopeAmount:string;retention:Quote['retention'];imageUrl?:string}
export interface SettlementAdapter {
  requireGasEligibility(sender: string): Promise<void>;
  profile():Omit<Settlement,'payerId'>;
  defaultPlan():Promise<Plan|null>;
  plan(planId:string):Promise<Plan>;
  preparePayment(manifest:Manifest,quote:Quote,publicKey:Uint8Array):Promise<string>;
  verifyPayment(unsigned:string,signed:string,identity:string,publicKey:Uint8Array):Promise<string>;
  broadcast(bytes:string):Promise<void>;
  paymentEvidence(hash:string,signedBytes:string,quote:Quote):Promise<Evidence|null>;
  prepareIndex(manifest:Manifest,quote:Quote,paymentHash:string):Promise<{bytes:string;hash:string;assetId:string}>;
  indexEvidence(hash:string,assetId:string,manifest:Manifest,paymentHash:string,quote:Quote,signedBytes:string):Promise<Evidence|null>;
}
export const identityMatches=(pk:Uint8Array,did:string):boolean=>{try{const address=addressOf(did),type=fromAddress(address).type;if(type.pk!==0||type.hash!==1)return false;return fromPublicKey(pk,type).address===address;}catch{return false;}};
// ArcBlock's enums are verified by derivation rather than trusting caller-supplied roles.
const client=new GraphQLClient(env.chainHost,false) as any;
// The SDK's default transport has neither a deadline nor redirect protection.
// Keep its public codec/context API while bounding every DMP chain request and
// excluding SDK auth/extra-wallet payloads from the public chain endpoint.
client._doRequest=async(query:string,_options:unknown,dataKey?:string)=>{
  const result=await requestDmpChainRpc(env.chainHost,query);
  return dataKey&&result.data[dataKey]?result.data[dataKey]:result.data;
};
const init=client.getContext.bind(client);
client.getContext=async()=>{try{return await init();}catch(error){client.ctx.loading=false;client.ctx.callbacks=[];throw error;}};
const native=(id:string)=>id.startsWith('did:abt:')?addressOf(id):id;
// TransferV3 matches receiver states by exact address. Lowercasing an EVM
// payee makes an existing checksum account appear absent and triggers a duplicate insert.
const nativePayee=(address:string)=>address.startsWith('0x')?getAddress(address):address;
export const transactionId=(encoded:string)=>toTxHash(unb64u(encoded));
const decoded=(encoded:string)=>client.decodeTx(toBase58(unb64u(encoded)));
export const dmpLocator=(manifest:Manifest,paymentHash:string,quote?:Quote)=>({protocolVersion:1,messageId:manifest.messageId,manifestSha256:digest(utf8(canonicalize((({proof:_proof,...unsigned})=>unsigned)(manifest)))),serviceId:manifest.serviceId,endpoint:value('DIDMAIL_URL'),...(paymentHash?{paymentTransactionId:paymentHash}:{funding:{mode:'node-sponsored',quoteId:quote!.quoteId}})});
export class ArcBlockSettlement implements SettlementAdapter {
  async requireGasEligibility(sender: string) { await requireSendingGasEligibility(sender); }
  profile():Omit<Settlement,'payerId'>{return{profile:'arcblock-transfer-v3-mail-nft/1',chainId:env.chainId,chainEndpoint:env.chainHost,paymentAssetId:env.tokenId,paymentAssetDecimals:18,envelopeFactoryId:env.envelopeFactory,messageFactoryId:env.mailFactory,servicePayeeAddress:wallet().address,developerPayeeAddress:env.factoryOwner?nativePayee(env.factoryOwner):'',indexLocatorField:'subject',confirmationPolicy:confirmationPolicy(value('DMP_CONFIRMATION_POLICY','arcblock-committed'))};}
  async defaultPlan(){
    const row=await Envelope.findOne({where:{enabled:true,category:'public'},order:[['id','ASC']]});
    if(!row)return null;
    if(!accountLinksEnabled())return this.plan(String(row.get('address')));
    // Discovery is an estimate. A private mailbox must not wait for an NFT RPC;
    // the authoritative external quote still uses plan() immediately before payment.
    const days=Number(row.get('retentionPeriod')),price=parseUnits(String(row.get('price')).trim().split(/\s+/)[0],18);
    if(!Number.isSafeInteger(days)||days<0||days>36500||price<0n)throw new Error('INVALID_PLAN_METADATA');
    return {planId:String(row.get('address')),name:String(row.get('name')||'Envelope'),envelopeAmount:price.toString(),retention:days===0?{mode:'indefinite' as const}:{mode:'finite' as const,durationSeconds:days*86400},...(row.get('svg')?{imageUrl:String(row.get('svg'))}:{})};
  }
  async plan(planId:string):Promise<Plan>{
    const row=await Envelope.findOne({where:{address:planId,enabled:true}});if(!row)throw new Error('PLAN_UNAVAILABLE');
    const {state}=await client.getAssetState({address:planId});if(!state||state.parent!==env.envelopeFactory)throw new Error('INVALID_PLAN_FACTORY');
    const terms=JSON.parse(state.data.value),days=Number(terms.retentionPeriod);
    if(!Number.isSafeInteger(days)||days<0||days>36500)throw new Error('INVALID_RETENTION');
    const price=parseUnits(String(terms.price),18);if(price<0n)throw new Error('INVALID_PLAN_PRICE');
    return{planId,name:String(row.get('name')||'Envelope'),envelopeAmount:price.toString(),retention:days===0?{mode:'indefinite'}:{mode:'finite',durationSeconds:days*86400},...(row.get('svg')?{imageUrl:String(row.get('svg'))}:{})};
  }
  async preparePayment(manifest:Manifest,quote:Quote,publicKey:Uint8Array):Promise<string>{
    const outputs=[{owner:quote.settlement.servicePayeeAddress,tokens:[{address:quote.paymentAsset.assetId,value:(BigInt(quote.serviceAmount)+BigInt(quote.indexAmount)).toString()}]}];
    if(BigInt(quote.developerAmount)>0n)outputs.push({owner:nativePayee(quote.settlement.developerPayeeAddress),tokens:[{address:quote.paymentAsset.assetId,value:quote.developerAmount}]});
    const payer=addressOf(manifest.senderId);
    const tx={from:payer,pk:publicKey,chainId:quote.settlement.chainId,nonce:Date.now(),signatures:[{signer:payer,pk:publicKey}],itx:{inputs:[{owner:payer,tokens:[{address:quote.paymentAsset.assetId,value:quote.totalAmount}]}],outputs,data:{typeUrl:'json',value:{protocolVersion:1,messageId:manifest.messageId,manifestSha256:quote.manifestSha256,quoteId:quote.quoteId,serviceId:manifest.serviceId}}}};
    const encoded=await client.encodeTransferV3Tx({tx,wallet:fromPublicKey(publicKey)});return b64u(encoded.buffer);
  }
  async verifyPayment(unsigned:string,signed:string,identity:string,publicKey:Uint8Array):Promise<string>{
    const expected=decoded(unsigned),tx=decoded(signed),payer=addressOf(identity);
    if(tx.from!==payer||tx.from!==expected.from||tx.chainId!==expected.chainId||String(tx.nonce)!==String(expected.nonce)||!isDeepStrictEqual(tx.pk,expected.pk)||!isDeepStrictEqual(tx.itx,expected.itx)||tx.delegator||tx.serviceFee!==expected.serviceFee||!tx.signature)throw new Error('PAYMENT_MISMATCH');
    const signatures=tx.signaturesList||tx.signatures;
    if(!Array.isArray(signatures)||signatures.length!==1||signatures[0].signer!==payer||signatures[0].delegator||!signatures[0].signature||!isDeepStrictEqual(signatures[0].pk,tx.pk))throw new Error('PAYMENT_SIGNATURE_INVALID');
    const w=fromPublicKey(publicKey),primary={...tx,signature:undefined,itx:tx.itx};
    const encoded=await client.encodeTransferV3Tx({tx:primary,wallet:w});
    if(!await w.verify(encoded.buffer,toUint8Array(tx.signature)))throw new Error('PAYMENT_SIGNATURE_INVALID');
    const multi={...primary,signaturesList:signatures.map((s:any)=>({...s,signature:undefined}))};
    const multiEncoded=await client.encodeTransferV3Tx({tx:multi,wallet:w});
    if(!await w.verify(multiEncoded.buffer,toUint8Array(signatures[0].signature)))throw new Error('PAYMENT_SIGNATURE_INVALID');
    return transactionId(signed);
  }
  async broadcast(bytes:string):Promise<void>{const expected=transactionId(bytes);const {hash}=await client.sendTx({tx:Buffer.from(unb64u(bytes)).toString('base64'),commit:false});if(hash!==expected)throw new Error('BROADCAST_HASH_MISMATCH');}
  private async evidence(hash:string,signedBytes:string,quote:{settlement:Pick<Settlement,'chainId'|'chainEndpoint'|'confirmationPolicy'>}):Promise<Evidence|null>{
    if(transactionId(signedBytes)!==hash)throw new Error('PAYMENT_HASH_MISMATCH');
    const profile=quote.settlement,policy=confirmationPolicy(profile.confirmationPolicy);
    if(profile.chainId!==env.chainId||profile.chainEndpoint.replace(/\/+$/,'')!==env.chainHost.replace(/\/+$/,''))throw new Error('ACCEPTED_CHAIN_PROFILE_CHANGED');
    if(policy==='arcblock-dolt-ledger/1'){
      const record=await readDmpLedgerRecord(profile.chainEndpoint,profile.chainId,unb64u(signedBytes));
      if(record.state==='pending')return null;
      return{transactionId:record.transactionId,confirmedAt:record.recordedAt,confirmationPolicy:policy,ledgerBackend:record.backend,...(record.state==='rejected'?{rejected:true}:{})};
    }
    const {info:chain}=await client.getChainInfo();
    if(!chain||chain.network!==profile.chainId||chain.synced!==true||/^@ocap\/statedb-dolt(?:\s|$)/i.test(String(chain.consensusVersion).trim())||!/^[1-9][0-9]*$/.test(String(chain.blockHeight)))throw new Error('CHAIN_CONFIRMATION_POLICY_MISMATCH');
    const {info}=await client.getTx({hash});if(!info||info.hash!==hash||!/^\d+$/.test(String(info.height))||BigInt(info.height)<=0n)return null;
    return{transactionId:hash,blockHeight:String(info.height),confirmedAt:new Date(info.time).toISOString(),...(!['OK','0'].includes(String(info.code))?{rejected:true}:{})};
  }
  async readPaymentEvidence(hash:string,signedBytes:string,profile:Pick<Settlement,'chainId'|'chainEndpoint'|'confirmationPolicy'>):Promise<Evidence|null>{return this.evidence(hash,signedBytes,{settlement:profile});}
  async paymentEvidence(hash:string,signedBytes:string,quote:Quote):Promise<Evidence|null>{return this.evidence(hash,signedBytes,quote);}
  async prepareIndex(manifest:Manifest,quote:Quote,paymentHash:string):Promise<{bytes:string;hash:string;assetId:string}>{
    const locator=dmpLocator(manifest,paymentHash,quote),appWallet=wallet(),factoryWallet=fromAddress(env.factoryOwner);
    const itx=await client.preMintAsset({factory:quote.settlement.messageFactoryId,owner:addressOf(manifest.recipientId),wallet:factoryWallet,inputs:{id:manifest.messageId,sender:addressOf(manifest.senderId),receiver:addressOf(manifest.recipientId),pk:manifest.proof.publicKey,subject:b64u(utf8(canonicalize(locator))),envelope:manifest.planId,server:'DMP/1',endpoint:value('DIDMAIL_URL'),hash:quote.manifestSha256,expiredAt:'9999-12-31T23:59:59.999Z',receipt:paymentHash,attachments:'[]',totalAttachmentSize:'0',attachmentStorageCost:quote.storageAmount}});
    const tx={from:appWallet.address,pk:appWallet.publicKey,chainId:quote.settlement.chainId,nonce:Date.now(),signatures:[{signer:appWallet.address,pk:appWallet.publicKey}],itx:{factory:itx.factory,address:itx.address,inputs:[{owner:appWallet.address,tokens:[{address:quote.paymentAsset.assetId,value:quote.indexAmount}]}],owner:addressOf(manifest.recipientId),variables:itx.variables,issuer:itx.issuer}};
    const multi=await client.multiSignAcquireAssetV3Tx({tx,wallet:appWallet});const signed=await client.signAcquireAssetV3Tx({tx:{...multi,itx:tx.itx},wallet:appWallet});const encoded=await client.encodeAcquireAssetV3Tx({tx:{...signed,itx:tx.itx},wallet:appWallet});const bytes=b64u(encoded.buffer);return{bytes,hash:transactionId(bytes),assetId:itx.address};
  }
  async indexEvidence(hash:string,assetId:string,manifest:Manifest,paymentHash:string,quote:Quote,signedBytes:string):Promise<Evidence|null>{
    const evidence=await this.evidence(hash,signedBytes,quote);if(!evidence||evidence.rejected)return evidence;
    const {state}=await client.getAssetState({address:assetId});if(!state||state.parent!==quote.settlement.messageFactoryId||state.owner!==native(manifest.recipientId))throw new Error('INDEX_PROFILE_UNSUPPORTED');
    const data=JSON.parse(state.data.value);let locator:unknown;try{locator=JSON.parse(new TextDecoder().decode(unb64u(data.subject)));}catch{throw new Error('INDEX_PROFILE_UNSUPPORTED');}
    if(canonicalize(locator)!==canonicalize(dmpLocator(manifest,paymentHash,quote)))throw new Error('INDEX_PROFILE_UNSUPPORTED');return{...evidence,assetId};
  }
}
export const defaultSettlement=new ArcBlockSettlement();
