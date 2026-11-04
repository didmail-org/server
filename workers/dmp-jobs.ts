import { uuid,signArtifact,canonicalize,validateReceiptChainEvidence,termsHash,type Receipt,type Problem } from '@didmail/protocol';
import { toUint8Array } from '@ocap/util';
import { bindings } from './bindings';
import wallet from './wallet';
import { db,getMessage,manifestOf,quoteOf,type MessageRow } from './dmp-store';
import { defaultSettlement,receiptEvidence,type SettlementAdapter } from './dmp-settlement';
import { reserveWalletLane, cleanupExpiredPayerLanes } from './wallet-lane';
const ACTIVE=['queued','payment_pending','payment_confirmed','index_pending'];
async function change(row:MessageRow,fields:Record<string,string|number|null>):Promise<MessageRow>{
  const allowed=['state','payment_hash','signed_index','index_hash','asset_id','receipt_json','retention_expires_at','last_problem_json','next_attempt_at'];
  for(const key of Object.keys(fields))if(!allowed.includes(key))throw new Error('Invalid job update');
  const now=Date.now();
  const result=await db().prepare(`UPDATE dmp_messages SET ${Object.keys(fields).map(k=>k+'=?').join(',')},revision=revision+1,updated_at=? WHERE id=? AND lease_owner=? AND lease_fence=? AND lease_expires_at>? AND lifecycle='live'`).bind(...Object.values(fields),new Date(now).toISOString(),row.id,row.lease_owner,row.lease_fence,now).run();
  if(!result.meta.changes)throw new Error('JOB_LEASE_LOST');return(await getMessage(row.id))!;
}
async function releaseLane(row:MessageRow,lane:'payer'|'operator'){
  await db().prepare('DELETE FROM dmp_wallet_lanes WHERE chain_id=? AND wallet_id=? AND lane=? AND message_id=?').bind(quoteOf(row).paymentAsset.chainId,lane==='payer'?row.sender_id:`did:abt:${wallet().address}`,lane,row.id).run();
}
async function takeOperator(row:MessageRow){return reserveWalletLane(db(),{chainId:quoteOf(row).paymentAsset.chainId,walletId:`did:abt:${wallet().address}`,lane:'operator',owner:row.id});}
async function advanceSponsored(initial:MessageRow,adapter:SettlementAdapter){
 let row=initial;const q=quoteOf(row),manifest=manifestOf(row);
 if(!row.accepted_at||row.signed_payment||row.payment_hash||q.funding?.mode!=='node-sponsored'||q.funding?.sponsorId!==row.service_id||q.funding.amount!==q.indexAmount||q.settlement.payerId!==row.service_id||BigInt(q.totalAmount)!==0n||BigInt(q.indexAmount)<=0n)throw new Error('CONFLICTING_CHAIN_EVIDENCE');
 if(row.state==='queued'){
   if(!await takeOperator(row)){await change(row,{next_attempt_at:Date.now()+3000});return;}
   await adapter.requireGasEligibility(row.service_id);
   const prepared=await adapter.prepareIndex(manifest,q,'');
   row=await change(row,{signed_index:prepared.bytes,index_hash:prepared.hash,asset_id:prepared.assetId,state:'index_pending'});
 }
 if(row.state!=='index_pending'||!row.signed_index||!row.index_hash||!row.asset_id)throw new Error('INDEX_TRANSACTION_MISSING');
 const evidence=await adapter.indexEvidence(row.index_hash,row.asset_id,manifest,'',q,row.signed_index);
 if(!evidence){await adapter.requireGasEligibility(row.service_id);await adapter.broadcast(row.signed_index);await change(row,{next_attempt_at:Date.now()+3000});return;}
 if(evidence.rejected)throw new Error('INDEX_TRANSACTION_REJECTED');
 if(evidence.assetId!==row.asset_id)throw new Error('CONFLICTING_CHAIN_EVIDENCE');
 const confirmation=receiptEvidence(evidence,q,row.index_hash),now=new Date().toISOString(),expires=q.retention.mode==='finite'?new Date(Date.parse(now)+q.retention.durationSeconds*1000).toISOString():null;
 const receipt:Receipt=signArtifact('DMP1-RECEIPT',{protocolVersion:1 as const,messageId:row.id,manifestSha256:row.manifest_hash,quoteId:row.quote_id,senderId:row.sender_id,recipientId:row.recipient_id,serviceId:row.service_id,acceptedAt:row.accepted_at!,deliveredAt:now,retentionExpiresAt:expires,funding:q.funding,index:{...confirmation,assetId:row.asset_id}},row.service_id,toUint8Array(wallet().secretKey));
 validateReceiptChainEvidence(receipt,q.settlement.chainId);
 await change(row,{state:'delivered',receipt_json:canonicalize(receipt),retention_expires_at:expires,last_problem_json:null});await releaseLane(row,'operator');
}
async function advanceInternal(row:MessageRow){
  const q=quoteOf(row);
  if(!row.accepted_at||row.state!=='queued'||row.delivery_kind!=='server'||q.settlement.profile!=='none'||q.funding||row.signed_payment||row.payment_hash||row.signed_index||row.index_hash||row.asset_id||['totalAmount','indexAmount','storageAmount','envelopeAmount','serviceAmount','developerAmount'].some(k=>q[k as 'totalAmount']!=='0'))throw new Error('CONFLICTING_CHAIN_EVIDENCE');
  const manifest=manifestOf(row),chunks=await db().prepare('SELECT object_key FROM dmp_chunks WHERE message_id=?').bind(row.id).all<{object_key:string}>();
  if(chunks.results.length!==manifest.blobs.reduce((n,b)=>n+b.chunkCount,0))throw new Error('STORED_CIPHERTEXT_UNAVAILABLE');
  for(const c of chunks.results)if(!await bindings.BLOBS.head(c.object_key))throw new Error('STORED_CIPHERTEXT_UNAVAILABLE');
  const now=new Date().toISOString();
  if(q.retention.mode!=='finite')throw new Error('CONFLICTING_CHAIN_EVIDENCE');
  const expires=new Date(Date.parse(now)+q.retention.durationSeconds*1000).toISOString();
  const receipt:Receipt=signArtifact('DMP1-RECEIPT',{protocolVersion:1 as const,messageId:row.id,manifestSha256:row.manifest_hash,quoteId:row.quote_id,senderId:row.sender_id,recipientId:row.recipient_id,serviceId:row.service_id,acceptedAt:row.accepted_at,deliveredAt:now,retentionExpiresAt:expires,delivery:'server' as const,termsSha256:termsHash(q)},row.service_id,toUint8Array(wallet().secretKey));
  const results=await db().batch([
    db().prepare("UPDATE dmp_messages SET state='delivered',receipt_json=?,retention_expires_at=?,revision=revision+1,updated_at=?,last_problem_json=NULL WHERE id=? AND state='queued' AND lifecycle='live' AND lease_owner=? AND lease_fence=? AND lease_expires_at>?").bind(canonicalize(receipt),expires,now,row.id,row.lease_owner,row.lease_fence,Date.now()),
    db().prepare("INSERT OR IGNORE INTO dmp_internal_deliveries(message_id) SELECT id FROM dmp_messages WHERE id=? AND state='delivered' AND receipt_json=?").bind(row.id,canonicalize(receipt)),
  ]);
  if(!results[0].meta.changes)throw new Error('JOB_LEASE_LOST');
}
async function advance(initial:MessageRow,adapter:SettlementAdapter){
  if(quoteOf(initial).delivery==='server')return advanceInternal(initial);
  if(quoteOf(initial).funding)return advanceSponsored(initial,adapter);
  let row=initial;const q=quoteOf(row),manifest=manifestOf(row);
  if(!row.signed_payment||!row.payment_hash||!row.accepted_at)throw new Error('ACCEPTED_PAYMENT_MISSING');
  if(row.state==='queued')row=await change(row,{state:'payment_pending'});
  if(row.state==='payment_pending'){
    const evidence=await adapter.paymentEvidence(row.payment_hash!,row.signed_payment!,q);
    if(!evidence){await adapter.requireGasEligibility(row.sender_id);await adapter.broadcast(row.signed_payment!);await change(row,{next_attempt_at:Date.now()+3000});return;}
    receiptEvidence(evidence,q,row.payment_hash!);
    if(evidence.rejected){row=await change(row,{state:'rejected',last_problem_json:canonicalize({type:'about:blank',status:409,title:'Payment rejected',code:'PAYMENT_REJECTED',detail:'The chain rejected the payment. No replacement payment was created.',requestId:uuid(),recoveryAction:'inspect_transaction'} satisfies Problem)});await releaseLane(row,'payer');return;}
    row=await change(row,{state:'payment_confirmed',last_problem_json:null});await releaseLane(row,'payer');
  }
  if(row.state==='payment_confirmed'){
    if(!await takeOperator(row)){await change(row,{next_attempt_at:Date.now()+3000});return;}
    const prepared=await adapter.prepareIndex(manifest,q,row.payment_hash!);
    row=await change(row,{signed_index:prepared.bytes,index_hash:prepared.hash,asset_id:prepared.assetId,state:'index_pending'});
  }
  if(row.state==='index_pending'){
    if(!row.signed_index||!row.index_hash||!row.asset_id)throw new Error('INDEX_TRANSACTION_MISSING');
    const evidence=await adapter.indexEvidence(row.index_hash,row.asset_id,manifest,row.payment_hash!,q,row.signed_index);
    if(!evidence){await adapter.requireGasEligibility(row.sender_id);await adapter.broadcast(row.signed_index);await change(row,{next_attempt_at:Date.now()+3000});return;}
    const indexConfirmation=receiptEvidence(evidence,q,row.index_hash);
    if(evidence.rejected)throw new Error('INDEX_TRANSACTION_REJECTED');
    if(evidence.assetId!==row.asset_id)throw new Error('CONFLICTING_CHAIN_EVIDENCE');
    const payment=await adapter.paymentEvidence(row.payment_hash!,row.signed_payment!,q);if(!payment||payment.rejected)throw new Error('CONFLICTING_CHAIN_EVIDENCE');
    const paymentConfirmation=receiptEvidence(payment,q,row.payment_hash!);
    const now=new Date().toISOString(),expires=q.retention.mode==='finite'?new Date(Date.parse(now)+q.retention.durationSeconds*1000).toISOString():null;
    const receipt:Receipt=signArtifact('DMP1-RECEIPT',{protocolVersion:1 as const,messageId:row.id,manifestSha256:row.manifest_hash,quoteId:row.quote_id,senderId:row.sender_id,recipientId:row.recipient_id,serviceId:row.service_id,acceptedAt:row.accepted_at!,deliveredAt:now,retentionExpiresAt:expires,payment:paymentConfirmation,index:{...indexConfirmation,assetId:row.asset_id}},row.service_id,toUint8Array(wallet().secretKey));
    validateReceiptChainEvidence(receipt,q.settlement.chainId);
    row=await change(row,{state:'delivered',receipt_json:canonicalize(receipt),retention_expires_at:expires,last_problem_json:null});await releaseLane(row,'operator');
  }
}
export async function processDmpJobs(adapter:SettlementAdapter=defaultSettlement,limit=4){
  const now=Date.now();
  const due=await db().prepare(`SELECT id FROM dmp_messages WHERE state IN (${ACTIVE.map(()=>'?').join(',')}) AND lifecycle='live' AND next_attempt_at<=? AND lease_expires_at<=? ORDER BY accepted_at,id LIMIT ?`).bind(...ACTIVE,now,now,limit).all<{id:string}>();let processed=0;
  for(const candidate of due.results){
    const owner=uuid();const row=await db().prepare(`UPDATE dmp_messages SET lease_owner=?,lease_expires_at=?,lease_fence=lease_fence+1 WHERE id=? AND lease_expires_at<=? AND state IN (${ACTIVE.map(()=>'?').join(',')}) AND lifecycle='live' RETURNING *`).bind(owner,Date.now()+60000,candidate.id,Date.now(),...ACTIVE).first<MessageRow>();if(!row)continue;
    try{await advance(row,adapter);processed++;}
    catch(error){const code=(error as Error).message;if(code!=='JOB_LEASE_LOST'){
      const terminal=['INDEX_PROFILE_UNSUPPORTED','INDEX_TRANSACTION_REJECTED','CONFLICTING_CHAIN_EVIDENCE','ACCEPTED_PAYMENT_MISSING','INDEX_TRANSACTION_MISSING'].includes(code);
      const gasCode=(error as {code?:string}).code;
      const gasBlocked=gasCode&&['NODE_GAS_STAKE_REQUIRED','SENDER_GAS_STAKE_REQUIRED','GAS_STAKE_UNAVAILABLE'].includes(gasCode);
      const p:Problem={type:'about:blank',status:terminal?409:503,title:terminal?'Delivery requires reconciliation':'Delivery is processing',code:terminal?'RECONCILIATION_REQUIRED':gasBlocked?gasCode:row.delivery_kind==='server'?'STORAGE_UNAVAILABLE':'CHAIN_UNAVAILABLE',detail:terminal?'Payment or index requires operator reconciliation. Do not pay again.':gasBlocked?'Delivery is paused until native-token gas stake can be verified. Original transactions are retained.':'The server will reconcile the original transaction and continue.',requestId:uuid(),recoveryAction:terminal||gasCode==='NODE_GAS_STAKE_REQUIRED'?'contact_operator':gasCode==='SENDER_GAS_STAKE_REQUIRED'?'stake_for_gas':'query_status'};
      try{await change(row,{...(terminal?{state:'reconciliation_required'}:{}),last_problem_json:canonicalize(p),next_attempt_at:Date.now()+10000});}catch{/* recovery is owned by a newer fenced worker */}
    }}finally{await db().prepare('UPDATE dmp_messages SET lease_owner=NULL,lease_expires_at=0 WHERE id=? AND lease_owner=? AND lease_fence=?').bind(row.id,owner,row.lease_fence).run();}
  }return{processed};
}
export async function cleanupDmp(){
  const now=new Date().toISOString();
  const expired=await db().prepare("UPDATE dmp_messages SET lifecycle='deleting',state='expired',revision=revision+1,updated_at=? WHERE id IN (SELECT id FROM dmp_messages WHERE lifecycle='live' AND ((accepted_at IS NULL AND upload_expires_at<=?) OR (state='delivered' AND retention_expires_at IS NOT NULL AND retention_expires_at<=?)) LIMIT 100) RETURNING id").bind(now,now,now).all<{id:string}>();
  const unfinished=await db().prepare("SELECT id FROM dmp_messages WHERE lifecycle='deleting' LIMIT 100").all<{id:string}>();let deleted=0;
  for(const {id} of unfinished.results){const chunks=await db().prepare('SELECT object_key FROM dmp_chunks WHERE message_id=?').bind(id).all<{object_key:string}>();for(let start=0;start<chunks.results.length;start+=100)await bindings.BLOBS.delete(chunks.results.slice(start,start+100).map(c=>c.object_key));await db().batch([db().prepare('DELETE FROM dmp_chunks WHERE message_id=?').bind(id),db().prepare("DELETE FROM dmp_wallet_lanes WHERE message_id=? AND lane='payer'").bind(id),db().prepare("UPDATE dmp_messages SET lifecycle='deleted' WHERE id=? AND lifecycle='deleting'").bind(id)]);deleted++;}
  await cleanupExpiredPayerLanes(db(),now);
  await db().prepare('DELETE FROM dmp_nonces WHERE expires_at<?').bind(Math.floor(Date.now()/1000)).run();return{claimed:expired.results.length,deleted};
}
