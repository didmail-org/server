import type { TaskContext } from '../runtime/contracts';
import { internalPolicy, memberPair, checkInternalQuote } from './member-mail';
import { accountLinksEnabled } from '../identity/arc-members';
import { requireMemberStake } from '../policy/mail-gas-eligibility';
import { requireEnvelopeAccess, envelopeAdmission } from '../policy/envelope-access';
import { addressOf,b64u,unb64u,canonicalize,parseCanonical,utf8,text,digest,uuid,isUuid,signArtifact,verifyArtifact,validateManifest,validateKeyRecord,manifestHash,chunkSize,amount,type Manifest,type Quote,type KeyRecord,type KeyRevocation,type Discovery,type Problem,type Proof } from '@didmail/protocol';
import { parseUnits } from 'ethers';
import { toUint8Array } from '@ocap/util';
import { admissionSql, admissionValues, checkSenderAdmission, checkMessageLimits, readMailPolicy, readEffectiveMailPolicy } from '../policy/mail-admission';
import { readSendingGasEligibility } from '../policy/mail-gas-eligibility';
import { bindings,value } from '../runtime/bindings';
import { afsPolicyEnabled, withAfsAdmission } from '../storage/afs-mail-policy';
import wallet from '../identity/wallet';
import { rateLimit } from '../runtime/rate-limit';
import { getMessage,manifestOf,quoteOf,statusOf,db,type MessageRow } from './dmp-store';
import { defaultSettlement,identityMatches,type SettlementAdapter } from './dmp-settlement';
import { processDmpJobs } from './dmp-jobs';
import { authenticateProtocolRequest } from '../identity/protocol-request';
import { reserveWalletLane } from '../identity/wallet-lane';
const CHUNK_LIMIT=1048576+16;
// Only external, unpaid NFT sessions occupy the upload-session allowance.
const NFT_UPLOAD_QUOTA_SQL = `(SELECT count(*) FROM dmp_messages
  WHERE sender_id=? AND id<>? AND delivery_kind='nft' AND accepted_at IS NULL
  AND lifecycle='live' AND upload_expires_at>?)<8`;
export const problem=(status:number,code:string,detail:string,recoveryAction='none',requestId=uuid())=>Response.json({type:'about:blank',title:code.replaceAll('_',' '),status,code,detail,requestId,recoveryAction} satisfies Problem,{status,headers:{'content-type':'application/problem+json','x-request-id':requestId,'cache-control':'no-store'}});
const json=(body:unknown,status=200,headers:Record<string,string>={})=>Response.json(body,{status,headers:{'cache-control':'no-store',...headers}});
const conflict=(code:string,detail:string,action='query_status')=>{throw Object.assign(new Error(detail),{status:409,code,recoveryAction:action});};
async function requireStake(q:Quote,sender:string,adapter:SettlementAdapter){if(q.delivery==='server'){if(adapter===defaultSettlement)await requireMemberStake(sender);else await adapter.requireGasEligibility(sender);}else await adapter.requireGasEligibility(q.funding?serviceId():sender);}
const serviceId=()=>`did:abt:${wallet().address}`;
const signed=<T extends object>(domain:string,value:T)=>signArtifact(domain,value,serviceId(),toUint8Array(wallet().secretKey));
async function quote(manifest:Manifest,adapter:SettlementAdapter,version=1):Promise<Quote>{
  const pair=await memberPair(manifest);
  if(pair){
    const policy=await readMailPolicy(),now=new Date(),profile=adapter.profile();
    return signed('DMP1-QUOTE',{quoteId:uuid(),quoteVersion:version,messageId:manifest.messageId,manifestSha256:manifestHash(manifest),serviceId:serviceId(),planId:manifest.planId,issuedAt:now.toISOString(),expiresAt:new Date(now.getTime()+600000).toISOString(),delivery:'server' as const,policyRevision:policy.revision,memberBindings:{senderRevision:pair.sender.linkRevision,recipientRevision:pair.recipient.linkRevision},paymentAsset:{chainId:profile.chainId,assetId:profile.paymentAssetId,decimals:18,symbol:value('TOKEN_SYMBOL','TBA')},envelopeAmount:'0',storageAmount:'0',totalAmount:'0',indexAmount:'0',developerAmount:'0',serviceAmount:'0',retention:{mode:'finite' as const,durationSeconds:internalPolicy().retentionSeconds},settlement:{...profile,profile:'none' as const,payerId:manifest.senderId}});
  }
  if(manifest.planId==='auto')conflict('ENVELOPE_REQUIRED','Recipient is not eligible for internal delivery; select an external envelope','choose_plan');
  const access=await requireEnvelopeAccess(manifest.planId,manifest.senderId,adapter===defaultSettlement);
  const plan=await adapter.plan(manifest.planId),profile=adapter.profile(),envelope=amount(plan.envelopeAmount),index=parseUnits(value('MAIL_PRICE','0.0001'),18);
  // Explicit included storage for indefinite retention; configurable daily rate only for finite plans.
  const totalBytes=manifest.blobs.reduce((n,b)=>n+b.sizeBytes,0),storage=plan.retention.mode==='finite'?BigInt(totalBytes)*BigInt(Math.ceil(plan.retention.durationSeconds/86400))*BigInt(value('DMP_STORAGE_PRICE_PER_BYTE_PER_DAY','0')):BigInt(totalBytes)*BigInt(value('DMP_INDEFINITE_PRICE_PER_BYTE','0'));
  const sponsored=envelope===0n&&access?.category==='members';
  const billedStorage=sponsored?0n:storage;
  const total=envelope+billedStorage;
  if(envelope===0n&&!sponsored)conflict('ENVELOPE_MEMBER_REQUIRED','Zero-price sending requires a member-only envelope','choose_plan');
  if(index<=0n)conflict('INVALID_INDEX_COST','NFT minting cost must be positive');
  if(!sponsored&&total<index)conflict('PLAN_PRICE_TOO_LOW','Envelope price cannot cover the configured index fee','choose_plan');
  const developer=sponsored?0n:(total-index)/10n,now=new Date();
  return signed('DMP1-QUOTE',{quoteId:uuid(),quoteVersion:version,messageId:manifest.messageId,manifestSha256:manifestHash(manifest),serviceId:serviceId(),planId:manifest.planId,issuedAt:now.toISOString(),expiresAt:new Date(now.getTime()+600000).toISOString(),paymentAsset:{chainId:profile.chainId,assetId:profile.paymentAssetId,decimals:18,symbol:value('TOKEN_SYMBOL','TBA')},envelopeAmount:envelope.toString(),storageAmount:billedStorage.toString(),totalAmount:total.toString(),indexAmount:index.toString(),developerAmount:developer.toString(),serviceAmount:(sponsored?0n:total-index-developer).toString(),...(sponsored?{funding:{mode:'node-sponsored' as const,sponsorId:serviceId(),amount:index.toString()}}:{}),retention:plan.retention,settlement:{...profile,payerId:sponsored?serviceId():manifest.senderId}});
}
async function authorizedMessage(id:string,identity:string,recipientRead=false){const row=await getMessage(id);if(!row||!(row.sender_id===identity||(recipientRead&&row.recipient_id===identity&&row.state==='delivered')))throw Object.assign(new Error('Message not found'),{status:404,code:'MESSAGE_NOT_FOUND'});return row;}
function live(row:MessageRow){if(row.lifecycle!=='live'||(row.state==='delivered'&&row.retention_expires_at&&Date.parse(row.retention_expires_at)<=Date.now())||(!row.accepted_at&&Date.parse(row.upload_expires_at)<=Date.now()))throw Object.assign(new Error('Message upload or retention expired'),{status:410,code:'MESSAGE_EXPIRED'});}
const keyPath=(did:string,keyId:string)=>db().prepare('SELECT * FROM dmp_keys WHERE owner_id=? AND key_id=?').bind(did,keyId);
async function missingChunks(row:MessageRow){const stored=await db().prepare('SELECT blob_id,chunk_index FROM dmp_chunks WHERE message_id=?').bind(row.id).all<{blob_id:string;chunk_index:number}>();const known=new Set(stored.results.map(c=>c.blob_id+':'+c.chunk_index));return manifestOf(row).blobs.flatMap(b=>Array.from({length:b.chunkCount},(_,index)=>({blobId:b.blobId,index})).filter(c=>!known.has(c.blobId+':'+c.index)));}
async function takePayerLane(row:MessageRow){const q=quoteOf(row);if(!await reserveWalletLane(db(),{chainId:q.paymentAsset.chainId,walletId:row.sender_id,lane:'payer',owner:row.id,expiresAt:q.expiresAt}))conflict('PAYER_BUSY','Another payment is awaiting signature or chain confirmation','query_status');}
export async function handleDmp(request:Request,context:TaskContext,adapter:SettlementAdapter=defaultSettlement):Promise<Response>{
  const requestId=uuid(),url=new URL(request.url),path=url.pathname,method=request.method;
  try{
    if(method==='OPTIONS')return new Response(null,{status:204});
    if(path==='/.well-known/didmail'&&method==='GET'){
      const app=wallet(),pk=toUint8Array(app.publicKey);
      let defaultPlan:Discovery['defaultPlan']=null;
      try{defaultPlan=await adapter.defaultPlan();}catch(error){if(!accountLinksEnabled())throw error;}
      const policy=accountLinksEnabled()?await readMailPolicy():await readEffectiveMailPolicy(true);
      const d:Discovery={protocolVersions:[1],serviceId:serviceId(),apiBaseUrl:value('DIDMAIL_URL').replace(/\/$/,'')+'/v1',signingKey:{keyId:digest(pk),publicKey:b64u(pk),serviceId:serviceId()},paymentProfile:adapter.profile(),defaultPlan,limits:{maxMessageBytes:64*1024*1024,maxBlobCount:21,plaintextChunkBytes:1048576,maxDocumentBytes:256*1024,maxConcurrentUploads:3},features:[...(accountLinksEnabled()?['server-mail']:[]),'node-sponsored-nft','envelope-categories','signed-requests','hpke','chunk-resume','durable-delivery','public-chain-index','paid-envelope-nft','storage-included-indefinite','gas-stake-required',...(policy.policy.accessMode==='allowlist'?['sender-allowlist']:[])]};return json(d);
    }
    const keyMatch=/^\/v1\/identities\/([^/]+)\/encryption-keys(?:\/([0-9a-f]{64}))?(\/revocations)?$/.exec(path);
    const publicKeyRead=keyMatch&&method==='GET'&&!keyMatch[3];
    if(!await rateLimit('dmp:ip:'+(request.headers.get('cf-connecting-ip')||'local'),600,60000))return problem(429,'RATE_LIMITED','Too many requests','wait',requestId);
    if(publicKeyRead){
      const owner=decodeURIComponent(keyMatch[1]);addressOf(owner);
      if(keyMatch[2]){const key=await keyPath(owner,keyMatch[2]).first<{record_json:string;revocation_json:string|null}>();return key?json({record:JSON.parse(key.record_json),revocation:key.revocation_json?JSON.parse(key.revocation_json):null}):problem(404,'KEY_NOT_FOUND','Encryption key not found','ask_recipient_to_connect',requestId);}
      const keys=await db().prepare('SELECT record_json,revocation_json FROM dmp_keys WHERE owner_id=? ORDER BY created_at DESC,key_id ASC LIMIT 32').bind(owner).all<{record_json:string;revocation_json:string|null}>();return json({records:keys.results.map(k=>({record:JSON.parse(k.record_json),revocation:k.revocation_json?JSON.parse(k.revocation_json):null})),observedAt:new Date().toISOString()});
    }
    const isChunk=/\/chunks\//.test(path);if(method!=='GET'&&request.headers.get('content-type')!==(isChunk?'application/octet-stream':'application/json'))return problem(415,'UNSUPPORTED_MEDIA_TYPE','Use the exact protocol media type','none',requestId);
    const { auth, bytes }=await authenticateProtocolRequest(request,isChunk?CHUNK_LIMIT:65536,identityMatches);
    const body=bytes.length&&!isChunk?parseCanonical(bytes) as Record<string,unknown>:{};
    if(path==='/v1/service-policy'&&method==='GET'){
      const snapshot=await readEffectiveMailPolicy(true);return json({sendingAccessState:snapshot.sendingAccessState||'legacy',revision:snapshot.revision,...snapshot.policy,restricted:snapshot.policy.accessMode==='allowlist',sendingRestricted:snapshot.policy.accessMode==='allowlist',visibilityBasis:'staked-server-node-nft',gasStakeRequired:true});
    }
    if(path==='/v1/sending-eligibility'&&method==='GET'){
      const snapshot=await checkSenderAdmission(auth.identityId);return json({policyRevision:snapshot.revision,gas:await readSendingGasEligibility(auth.identityId)});
    }
    if(keyMatch){
      const owner=decodeURIComponent(keyMatch[1]);if(owner!==auth.identityId||!keyMatch[2])return problem(403,'IDENTITY_MISMATCH','Key owner must match request signer','none',requestId);
      if(method==='PUT'&&!keyMatch[3]){
        const record=body as unknown as KeyRecord;validateKeyRecord(record,identityMatches);if(record.ownerId!==owner||record.keyId!==keyMatch[2]||Date.parse(record.createdAt)>Date.now()+30000)return problem(400,'INVALID_KEY_RECORD','Invalid key owner, identifier or creation time','none',requestId);
        const existing=await keyPath(owner,record.keyId).first<{record_json:string;revocation_json:string|null}>();if(existing){if(existing.record_json!==canonicalize(record))conflict('KEY_RECORD_CONFLICT','Encryption key records are immutable');return json({record:JSON.parse(existing.record_json),revocation:existing.revocation_json?JSON.parse(existing.revocation_json):null});}
        await db().prepare('INSERT INTO dmp_keys(owner_id,key_id,record_json,created_at,expires_at) VALUES(?,?,?,?,?)').bind(owner,record.keyId,canonicalize(record),record.createdAt,record.expiresAt).run();return json({record,revocation:null},201);
      }
      if(method==='POST'&&keyMatch[3]){
        const revocation=body as unknown as KeyRevocation;
        if(revocation.protocolVersion!==1||revocation.ownerId!==owner||revocation.keyId!==keyMatch[2]||!['rotated','compromised','retired'].includes(revocation.reason)||!Number.isFinite(Date.parse(revocation.revokedAt))||Date.parse(revocation.revokedAt)>Date.now()+30000||!verifyArtifact('DMP1-KEY-REVOCATION',revocation,owner,identityMatches))return problem(400,'INVALID_REVOCATION','Invalid key revocation','none',requestId);
        const result=await db().prepare('UPDATE dmp_keys SET revocation_json=? WHERE owner_id=? AND key_id=? AND (revocation_json IS NULL OR revocation_json=?)').bind(canonicalize(revocation),owner,revocation.keyId,canonicalize(revocation)).run();if(!result.meta.changes)conflict('KEY_RECORD_CONFLICT','Key missing or conflicting revocation');return json({revocation});
      }
    }
    if(path==='/v1/messages'&&method==='GET'){
      const mailbox=url.searchParams.get('mailbox');if(!['inbox','outbox'].includes(mailbox||''))return problem(400,'INVALID_MAILBOX','mailbox must be inbox or outbox','none',requestId);
      const internal=url.searchParams.get('delivery')==='server';
      const limit=Number(url.searchParams.get('limit')||50),cursor=url.searchParams.get('cursor')||'';if(!Number.isSafeInteger(limit)||limit<1||limit>100||(cursor&&!(internal?/^(0|[1-9][0-9]{0,14})$/.test(cursor):isUuid(cursor))))return problem(400,'INVALID_CURSOR','Invalid pagination parameters','none',requestId);
      if(internal){
        const field=mailbox==='inbox'?'recipient_id':'sender_id';
        const rows=await db().prepare(`SELECT m.*,d.sequence FROM dmp_internal_deliveries d JOIN dmp_messages m ON m.id=d.message_id WHERE m.${field}=? AND d.sequence>? AND m.state='delivered' AND m.lifecycle='live' AND (m.retention_expires_at IS NULL OR m.retention_expires_at>?) ORDER BY d.sequence LIMIT ?`).bind(auth.identityId,Number(cursor||0),new Date().toISOString(),limit+1).all<MessageRow&{sequence:number}>();
        const page=rows.results.slice(0,limit);return json({items:page.map(row=>({manifest:manifestOf(row),status:statusOf(row),receipt:JSON.parse(row.receipt_json!)})),nextCursor:rows.results.length>limit?String(page[page.length-1].sequence):null});
      }
      const field=mailbox==='inbox'?'recipient_id':'sender_id';const rows=await db().prepare(`SELECT * FROM dmp_messages WHERE delivery_kind='nft' AND ${field}=? AND id>? ${mailbox==='inbox'?"AND state='delivered' AND lifecycle='live'":''} ORDER BY id ASC LIMIT ?`).bind(auth.identityId,cursor,limit+1).all<MessageRow>();const page=rows.results.slice(0,limit);return json({items:page.map(row=>({manifest:manifestOf(row),status:statusOf(row),...(row.receipt_json?{receipt:JSON.parse(row.receipt_json)}:{})})),nextCursor:rows.results.length>limit?page[page.length-1].id:null});
    }
    const match=/^\/v1\/messages\/([0-9a-f-]+)(?:\/(status|prepare|submit|quotes)|\/blobs\/([0-9a-f-]+)\/chunks\/(0|[1-9][0-9]*))?$/.exec(path);if(!match||!isUuid(match[1]))return problem(404,'RESOURCE_NOT_FOUND','Protocol resource not found','none',requestId);
    const id=match[1],operation=match[2],blobId=match[3],index=Number(match[4]);
    if(method==='PUT'&&!operation&&!blobId){
      const manifest=body as unknown as Manifest;const existing=await getMessage(id);
      if(existing){if(existing.sender_id!==auth.identityId||existing.manifest_hash!==manifestHash(manifest)||existing.manifest_json!==canonicalize(manifest))conflict('MESSAGE_CONFLICT','Message identifier already belongs to another immutable manifest');live(existing);return json({quote:quoteOf(existing),missingChunks:await missingChunks(existing),statusUrl:`/v1/messages/${id}/status`,status:statusOf(existing)});}
      validateManifest(manifest,identityMatches,Date.now());if(manifest.messageId!==id||manifest.senderId!==auth.identityId||manifest.serviceId!==serviceId()||Math.abs(Date.parse(manifest.createdAt)-Date.now())>30000)return problem(400,'INVALID_MANIFEST','Message owner, service, ID or timestamp mismatch','none',requestId);
      const admission=await checkSenderAdmission(auth.identityId,Boolean(await memberPair(manifest)));checkMessageLimits(manifest,admission.policy);
      const q=await quote(manifest,adapter);await requireStake(q,auth.identityId,adapter);const now=new Date().toISOString(),manifestJson=canonicalize(manifest),hash=manifestHash(manifest);
      // Internal mail has no message-count, storage or pending-session quotas.
      // Keep external session admission atomic and same-message retries idempotent.
      const uploadQuota = q.delivery === 'server' ? '1=1' : NFT_UPLOAD_QUOTA_SQL;
      const inserted=await withAfsAdmission(admission, () => db().prepare(`INSERT OR IGNORE INTO dmp_messages(id,sender_id,recipient_id,service_id,manifest_hash,manifest_json,quote_id,quote_json,created_at,updated_at,upload_expires_at,delivery_kind)
        SELECT ?,?,?,?,?,?,?,?,?,?,?,?
        WHERE ${uploadQuota} AND ${admissionSql(admission)}`)
        .bind(id,manifest.senderId,manifest.recipientId,manifest.serviceId,hash,manifestJson,q.quoteId,canonicalize(q),now,now,new Date(Date.now()+1800000).toISOString(),q.delivery==='server'?'server':'nft',
          ...(q.delivery==='server'?[]:[auth.identityId,id,now]),...admissionValues(admission,auth.identityId)).run());
      const row=await getMessage(id);
      if(!row){await checkSenderAdmission(auth.identityId,q.delivery==='server');if((await readMailPolicy()).revision!==admission.revision)conflict('MAIL_POLICY_CONFLICT','Policy changed before upload; retry');}
      if(!row)return problem(429,'UPLOAD_QUOTA_EXCEEDED','Too many unpaid upload sessions','finish_or_wait',requestId);
      if(row.sender_id!==auth.identityId||row.manifest_hash!==hash||row.manifest_json!==manifestJson)conflict('MESSAGE_CONFLICT','Message identifier already belongs to another immutable manifest');
      live(row);return json({quote:quoteOf(row),missingChunks:await missingChunks(row),statusUrl:`/v1/messages/${id}/status`,status:statusOf(row)},inserted.meta.changes?201:200);
    }
    let row=await authorizedMessage(id,auth.identityId,method==='GET'&&operation!=='status');
    if(method==='GET'&&operation==='status')return json(statusOf(row));
    if(method==='GET'&&!operation&&!blobId){live(row);return json({manifest:manifestOf(row),...(row.receipt_json?{receipt:JSON.parse(row.receipt_json)}:{})});}
    if(blobId){
      live(row);if(!isUuid(blobId))return problem(400,'INVALID_BLOB','Invalid blob identifier','none',requestId);
      const descriptor=manifestOf(row).blobs.find(b=>b.blobId===blobId);if(!descriptor||!Number.isSafeInteger(index)||index<0||index>=descriptor.chunkCount)return problem(404,'BLOB_NOT_FOUND','Blob chunk not found','none',requestId);
      if(method==='GET'){const chunk=await db().prepare('SELECT object_key,ciphertext_sha256 FROM dmp_chunks WHERE message_id=? AND blob_id=? AND chunk_index=?').bind(id,blobId,index).first<{object_key:string;ciphertext_sha256:string}>();if(!chunk)return problem(404,'BLOB_NOT_FOUND','Blob chunk not found','none',requestId);const object=await bindings.BLOBS.get(chunk.object_key);if(!object)return problem(503,'BLOB_UNAVAILABLE','Stored ciphertext unavailable','query_status',requestId);return new Response(object.body,{headers:{'content-type':'application/octet-stream','cache-control':'private, no-store','content-digest':`sha-256=:${Buffer.from(chunk.ciphertext_sha256,'hex').toString('base64')}:`}});}
      if(method==='PUT'){
        if(row.sender_id!==auth.identityId||row.accepted_at)conflict('UPLOAD_CLOSED','Message upload is closed');
        const admission=await checkSenderAdmission(auth.identityId,quoteOf(row).delivery==='server');checkMessageLimits(manifestOf(row),admission.policy);if(quoteOf(row).delivery==='server')await checkInternalQuote(manifestOf(row),quoteOf(row),admission);else await requireEnvelopeAccess(manifestOf(row).planId,auth.identityId,adapter===defaultSettlement);
        const hash=digest(bytes);if(bytes.length!==chunkSize(descriptor,index)||hash!==descriptor.chunkSha256[index])return problem(400,'CHUNK_INTEGRITY_FAILED','Chunk length or digest does not match manifest','reupload_original_chunk',requestId);
        const key=`dmp/${wallet().address}/${id}/${blobId}/${index}/${hash}${afsPolicyEnabled() ? '/' + uuid() : ''}`;
        await bindings.BLOBS.put(key,bytes);
        let attempted=false, result;
        try { result=await withAfsAdmission(admission, () => { attempted=true; return db().prepare(`INSERT OR IGNORE INTO dmp_chunks(message_id,blob_id,chunk_index,ciphertext_sha256,object_key,size_bytes) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM dmp_messages WHERE id=? AND lifecycle='live' AND accepted_at IS NULL AND upload_expires_at>?) AND ${admissionSql(admission)}`).bind(id,blobId,index,hash,key,bytes.length,id,new Date().toISOString(),...admissionValues(admission,auth.identityId)).run(); }); }
        catch(error){
          // A rejected AFS gate never attempted the relational commit. Each AFS upload
          // owns a unique key, so cleanup cannot delete a concurrent winner.
          if(afsPolicyEnabled()&&!attempted)await bindings.BLOBS.delete(key);
          throw error;
        }
        if(!result.meta.changes){const current=await getMessage(id),chunk=await db().prepare('SELECT ciphertext_sha256,object_key FROM dmp_chunks WHERE message_id=? AND blob_id=? AND chunk_index=?').bind(id,blobId,index).first<{ciphertext_sha256:string;object_key:string}>();if(current?.lifecycle!=='live'||!chunk||chunk.ciphertext_sha256!==hash){await bindings.BLOBS.delete(key);conflict('UPLOAD_CLOSED','Upload was deleted or closed during write');}if(afsPolicyEnabled()&&chunk&&chunk.object_key!==key)await bindings.BLOBS.delete(key);}
        return json({blobId,index,ciphertextSha256:hash});
      }
    }
    live(row);
    if(method==='POST'&&operation==='quotes'){
      const admission=await checkSenderAdmission(auth.identityId,Boolean(await memberPair(manifestOf(row)))),manifest=manifestOf(row);checkMessageLimits(manifest,admission.policy);
      if(row.accepted_at||body.expectedRevision!==row.revision||body.previousQuoteId!==row.quote_id)conflict('QUOTE_CONFLICT','Message quote changed or submission already accepted');
      const q=await quote(manifest,adapter,row.quote_version+1),now=new Date().toISOString();
      const uploadQuota = q.delivery === 'server' ? '1=1' : NFT_UPLOAD_QUOTA_SQL;
      const results=await withAfsAdmission(admission, () => db().batch([
        db().prepare(`UPDATE dmp_messages SET quote_id=?,quote_json=?,quote_version=?,payment_request=NULL,delivery_kind=?,reserved_bytes=0,state='uploading',revision=revision+1,updated_at=? WHERE id=? AND revision=? AND accepted_at IS NULL AND lifecycle='live' AND ${uploadQuota} AND ${admissionSql(admission)}`)
          .bind(q.quoteId,canonicalize(q),q.quoteVersion,q.delivery==='server'?'server':'nft',now,id,row.revision,...(q.delivery==='server'?[]:[auth.identityId,id,now]),...admissionValues(admission,auth.identityId)),
        db().prepare("DELETE FROM dmp_wallet_lanes WHERE message_id=? AND lane='payer' AND EXISTS(SELECT 1 FROM dmp_messages WHERE id=? AND quote_id=? AND accepted_at IS NULL)").bind(id,id,q.quoteId),
      ]));
      if(!results[0].meta.changes)conflict('QUOTE_CONFLICT','Concurrent submission, quote refresh or external upload quota limit');
      return json({quote:q,status:statusOf((await getMessage(id))!)});
    }
    if(method==='POST'&&operation==='prepare'){
      if(quoteOf(row).delivery!=='server' && await memberPair(manifestOf(row)))conflict('DELIVERY_TERMS_CHANGED','Members now qualify for internal delivery; refresh the quote','refresh_quote');
      const admission=await checkSenderAdmission(auth.identityId,quoteOf(row).delivery==='server');checkMessageLimits(manifestOf(row),admission.policy);if(quoteOf(row).delivery==='server')await checkInternalQuote(manifestOf(row),quoteOf(row),admission);else await requireEnvelopeAccess(manifestOf(row).planId,auth.identityId,adapter===defaultSettlement);await requireStake(quoteOf(row),auth.identityId,adapter);
      if(body.quoteId!==row.quote_id||Date.parse(quoteOf(row).expiresAt)<=Date.now())conflict('PLAN_QUOTE_EXPIRED','Refresh the quote before signing','refresh_quote');
      if(row.accepted_at)conflict('ALREADY_SUBMITTED','Message already submitted');
      if((await missingChunks(row)).length)conflict('UPLOAD_INCOMPLETE','Upload all ciphertext chunks before signing','resume_upload');
      if(row.payment_request)return json({quote:quoteOf(row),paymentRequest:{encoding:'base64url',unsignedTransaction:row.payment_request,quoteId:row.quote_id}});
      // Validate complete blob digests without loading the whole message into memory.
      const {sha256}=await import('@didmail/protocol');
      for(const blob of manifestOf(row).blobs){const hash=sha256.create();for(let i=0;i<blob.chunkCount;i++){const stored=await db().prepare('SELECT object_key FROM dmp_chunks WHERE message_id=? AND blob_id=? AND chunk_index=?').bind(id,blob.blobId,i).first<{object_key:string}>();const object=stored&&await bindings.BLOBS.get(stored.object_key);if(!object)conflict('UPLOAD_INCOMPLETE','Ciphertext chunk is missing','resume_upload');hash.update(new Uint8Array(await object!.arrayBuffer()));}if(Buffer.from(hash.digest()).toString('hex')!==blob.ciphertextSha256)conflict('CHUNK_INTEGRITY_FAILED','Full blob digest mismatch','reupload_original_chunk');}
      if(quoteOf(row).delivery==='server'){const prepared=await withAfsAdmission(admission, () => db().prepare(`UPDATE dmp_messages SET state='awaiting_signature',revision=revision+1,updated_at=? WHERE id=? AND revision=? AND accepted_at IS NULL AND lifecycle='live'${afsPolicyEnabled() ? ' AND ' + admissionSql(admission) : ''}`).bind(new Date().toISOString(),id,row.revision,...(afsPolicyEnabled()?admissionValues(admission,auth.identityId):[])).run());if(!prepared.meta.changes)conflict('QUOTE_CONFLICT','Admission or quote changed during preparation');return json({quote:quoteOf(row),paymentRequest:{mode:'server',encoding:'base64url',unsignedTransaction:'',quoteId:row.quote_id}});}
      if(quoteOf(row).funding){const prepared=await withAfsAdmission(admission, () => db().prepare(`UPDATE dmp_messages SET state='awaiting_signature',revision=revision+1,updated_at=? WHERE id=? AND revision=? AND accepted_at IS NULL AND lifecycle='live'${afsPolicyEnabled() ? ' AND ' + admissionSql(admission) : ''}`).bind(new Date().toISOString(),id,row.revision,...(afsPolicyEnabled()?admissionValues(admission,auth.identityId):[])).run());if(!prepared.meta.changes)conflict('QUOTE_CONFLICT','Admission or quote changed during preparation');return json({quote:quoteOf(row),paymentRequest:{mode:'node-sponsored',encoding:'base64url',unsignedTransaction:'',quoteId:row.quote_id}});}
      await takePayerLane(row);
      const payment=await adapter.preparePayment(manifestOf(row),quoteOf(row),auth.publicKey);
      const changed=await withAfsAdmission(admission, () => db().prepare(`UPDATE dmp_messages SET payment_request=?,state='awaiting_signature',revision=revision+1,updated_at=? WHERE id=? AND revision=? AND payment_request IS NULL AND lifecycle='live' AND accepted_at IS NULL${afsPolicyEnabled() ? ' AND ' + admissionSql(admission) : ''}`).bind(payment,new Date().toISOString(),id,row.revision,...(afsPolicyEnabled()?admissionValues(admission,auth.identityId):[])).run());
      row=(await getMessage(id))!;if(!changed.meta.changes&&(row.quote_id!==body.quoteId||!row.payment_request))conflict('QUOTE_CONFLICT','Quote changed while preparing payment');return json({quote:quoteOf(row),paymentRequest:{encoding:'base64url',unsignedTransaction:row.payment_request,quoteId:row.quote_id}});
    }
    if(method==='POST'&&operation==='submit'){
      if(quoteOf(row).delivery==='server'){
        if(Object.keys(body).sort().join(',')!=='delivery,quoteId'||body.delivery!=='server'||body.quoteId!==row.quote_id)return problem(400,'INVALID_DELIVERY_AUTHORIZATION','Authorize only the stored internal terms, without a payment','none',requestId);
        if(row.accepted_at)return json(statusOf(row),202);
        if(row.state!=='awaiting_signature'||Date.parse(quoteOf(row).expiresAt)<=Date.now()||(await missingChunks(row)).length)conflict('DELIVERY_NOT_PREPARED','Prepare the original complete message');
        const manifest=manifestOf(row),admission=await checkSenderAdmission(auth.identityId,true);checkMessageLimits(manifest,admission.policy);
        const guard=await checkInternalQuote(manifest,quoteOf(row),admission);await requireStake(quoteOf(row),auth.identityId,adapter);
        const now=new Date().toISOString(),conditions=manifest.keyEnvelopes.map(()=>"EXISTS(SELECT 1 FROM dmp_keys WHERE owner_id=? AND key_id=? AND record_json=? AND revocation_json IS NULL AND expires_at>?)");
        const result=await withAfsAdmission(admission, () => db().prepare(`UPDATE dmp_messages SET accepted_at=?,state='queued',revision=revision+1,updated_at=? WHERE id=? AND revision=? AND quote_id=? AND accepted_at IS NULL AND state='awaiting_signature' AND lifecycle='live' AND upload_expires_at>? AND ${guard.sql} AND ${conditions.join(' AND ')} AND ${admissionSql(admission)}`).bind(now,now,id,row.revision,row.quote_id,now,...guard.values,...manifest.keyEnvelopes.flatMap(k=>[k.ownerId,k.keyId,canonicalize(k.keyRecord),now]),...admissionValues(admission,auth.identityId)).run());
        if(!result.meta.changes){const current=await getMessage(id);if(current?.accepted_at)return json(statusOf(current),202);conflict('DELIVERY_TERMS_CHANGED','Binding, policy or upload changed before acceptance','refresh_quote');}
        context.waitUntil(processDmpJobs(adapter,1));return json(statusOf((await getMessage(id))!),202);
      }
      if(!row.accepted_at && await memberPair(manifestOf(row)))conflict('DELIVERY_TERMS_CHANGED','Members now qualify for internal delivery; refresh the quote','refresh_quote');
      const sponsored=quoteOf(row).funding?.mode==='node-sponsored';
      if(sponsored){
        if(body.quoteId!==row.quote_id||body.fundingMode!=='node-sponsored'||'signedTransaction' in body)return problem(400,'INVALID_FUNDING_AUTHORIZATION','Confirm the saved member quote without a sender payment','none',requestId);
        if(row.accepted_at)return json(statusOf(row),202);
        if(row.state!=='awaiting_signature'||Date.parse(quoteOf(row).expiresAt)<=Date.now()||(await missingChunks(row)).length)conflict('UPLOAD_INCOMPLETE','Prepare the complete message before submitting');
        const admission=await checkSenderAdmission(auth.identityId,quoteOf(row).delivery==='server'),manifest=manifestOf(row);checkMessageLimits(manifest,admission.policy);
        const access=await requireEnvelopeAccess(manifest.planId,auth.identityId,true);if(access?.category!=='members')conflict('ENVELOPE_MEMBER_REQUIRED','Member envelope required');
        await adapter.requireGasEligibility(serviceId());
        const guard=envelopeAdmission(access,manifest.planId,auth.identityId),now=new Date().toISOString();
        const keyConditions=manifest.keyEnvelopes.map(()=>"EXISTS(SELECT 1 FROM dmp_keys WHERE owner_id=? AND key_id=? AND record_json=? AND revocation_json IS NULL AND expires_at>?)");
        const keyValues=manifest.keyEnvelopes.flatMap(k=>[k.ownerId,k.keyId,canonicalize(k.keyRecord),now]);
        const result=await withAfsAdmission(admission, () => db().prepare(`UPDATE dmp_messages SET accepted_at=?,state='queued',revision=revision+1,updated_at=? WHERE id=? AND revision=? AND quote_id=? AND state='awaiting_signature' AND accepted_at IS NULL AND lifecycle='live' AND upload_expires_at>? AND json_extract(quote_json,'$.expiresAt')>? AND ${guard.sql} AND ${keyConditions.join(' AND ')} AND ${admissionSql(admission)}`).bind(now,now,id,row.revision,row.quote_id,now,now,...guard.values,...keyValues,...admissionValues(admission,auth.identityId)).run());
        if(!result.meta.changes){const current=await getMessage(id);if(current?.accepted_at)return json(statusOf(current),202);conflict('ACCEPTANCE_CONFLICT','Member authorization or upload changed before acceptance');}
        context.waitUntil(processDmpJobs(adapter,1));return json(statusOf((await getMessage(id))!),202);
      }
      if(typeof body.signedTransaction!=='string'||body.signedTransaction.length>65536||!row.payment_request)return problem(400,'INVALID_PAYMENT','Prepared signed transaction required','none',requestId);
      const signedBytes=body.signedTransaction;unb64u(signedBytes);
      if(row.accepted_at){if(row.signed_payment!==signedBytes||row.quote_id!==body.quoteId)conflict('PAYMENT_CONFLICT','Message already accepted with a different payment');return json(statusOf(row),202,{location:`/v1/messages/${id}/status`});}
      const q=quoteOf(row);if(body.quoteId!==row.quote_id||Date.parse(q.expiresAt)<=Date.now())conflict('PLAN_QUOTE_EXPIRED','Quote expired before acceptance','refresh_quote');
      const admission=await checkSenderAdmission(auth.identityId,quoteOf(row).delivery==='server');checkMessageLimits(manifestOf(row),admission.policy);if(quoteOf(row).delivery==='server')await checkInternalQuote(manifestOf(row),quoteOf(row),admission);else await requireEnvelopeAccess(manifestOf(row).planId,auth.identityId,adapter===defaultSettlement);await requireStake(quoteOf(row),auth.identityId,adapter);
      const hash=await adapter.verifyPayment(row.payment_request,signedBytes,auth.identityId,auth.publicKey),now=new Date().toISOString(),manifest=manifestOf(row);
      const envelopeAccess=envelopeAdmission(await requireEnvelopeAccess(manifest.planId,auth.identityId,adapter===defaultSettlement),manifest.planId,auth.identityId);
      const keyConditions=manifest.keyEnvelopes.map(()=>"EXISTS(SELECT 1 FROM dmp_keys WHERE owner_id=? AND key_id=? AND record_json=? AND revocation_json IS NULL AND expires_at>?)");
      const keyValues=manifest.keyEnvelopes.flatMap(k=>[k.ownerId,k.keyId,canonicalize(k.keyRecord),now]);
      const accepted=await withAfsAdmission(admission, () => db().prepare(`UPDATE dmp_messages SET signed_payment=?,payment_hash=?,accepted_at=?,state='queued',revision=revision+1,updated_at=? WHERE id=? AND revision=? AND quote_id=? AND lifecycle='live' AND accepted_at IS NULL AND upload_expires_at>? AND json_extract(quote_json,'$.expiresAt')>? AND ${keyConditions.join(' AND ')} AND ${envelopeAccess.sql} AND ${admissionSql(admission)}`).bind(signedBytes,hash,now,now,id,row.revision,row.quote_id,now,now,...keyValues,...envelopeAccess.values,...admissionValues(admission,auth.identityId)).run());
      if(!accepted.meta.changes){const current=await getMessage(id);if(current?.signed_payment===signedBytes&&current.accepted_at)return json(statusOf(current),202,{location:`/v1/messages/${id}/status`});conflict('ACCEPTANCE_CONFLICT','Quote, key validity or upload lifecycle changed before acceptance','query_status');}
      context.waitUntil(processDmpJobs(adapter,1));return json(statusOf((await getMessage(id))!),202,{location:`/v1/messages/${id}/status`});
    }
    return problem(405,'METHOD_NOT_ALLOWED','Method not supported for resource','none',requestId);
  }catch(error){const e=error as Error&{status?:number;code?:string;recoveryAction?:string};console.error('DMP request failed',requestId,e.code||e.name);return problem(e.status||400,e.code||'INVALID_REQUEST',e.status&&e.status>=500?'Service is temporarily unavailable':e.message,e.recoveryAction||'none',requestId);}
}
