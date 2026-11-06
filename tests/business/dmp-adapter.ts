// Isolated protocol transport/job fixture. Production ARC never imports this file.
import { b64u,unb64u,utf8,text,digest,identityId,type Manifest,type Quote } from '@didmail/protocol';
import type { SettlementAdapter,Evidence } from '../../blocklet/providers/didmail-http/source/protocol/dmp-settlement';
import { requireSendingGasEligibility } from '../../blocklet/providers/didmail-http/source/policy/mail-gas-eligibility';
import { bindings,value } from '../../blocklet/providers/didmail-http/source/runtime/bindings';
import wallet from '../../blocklet/providers/didmail-http/source/identity/wallet';
import { afsPolicyEnabled, policyOperation } from '../../blocklet/providers/didmail-http/source/storage/afs-mail-policy';
export const dmpTestAdapter:SettlementAdapter={
  async requireGasEligibility(sender: string) { if(value('DMP_TEST_REAL_GAS')==='1')await requireSendingGasEligibility(sender); },
  profile(){return{profile:'arcblock-transfer-v3-mail-nft/1',chainId:'beta',chainEndpoint:'https://beta.abtnetwork.io/api/',paymentAssetId:'zTestToken',paymentAssetDecimals:18,envelopeFactoryId:'zEnvelopeFactory',messageFactoryId:'zMessageFactory',servicePayeeAddress:wallet().address,developerPayeeAddress:'0x'+'1'.repeat(40),indexLocatorField:'subject',confirmationPolicy:value('DMP_CONFIRMATION_POLICY')==='arcblock-dolt-ledger/1'?'arcblock-dolt-ledger/1':'arcblock-committed'};},
  async defaultPlan(){return this.plan('zPaidPlan');},
  async plan(planId:string){if(planId!=='zPaidPlan')throw new Error('PLAN_UNAVAILABLE');return{planId,name:'Paid test NFT plan',envelopeAmount:value('DMP_TEST_ENVELOPE_AMOUNT','10000000000000000'),retention:{mode:'indefinite'}};},
  async preparePayment(m:Manifest,q:Quote){return b64u(utf8(JSON.stringify({messageId:m.messageId,total:q.totalAmount})));},
  async verifyPayment(unsigned:string,signed:string,identity:string){
    if(text(unb64u(signed))!=='signed:'+unsigned)throw new Error('PAYMENT_MISMATCH');
    // Deterministically interleave an administrator edit AFTER the admission
    // read and BEFORE the production acceptance CAS. Test bundle only.
    if(value('DMP_TEST_DENY_ON_VERIFY')==='1' && afsPolicyEnabled()){const state=await policyOperation('read');await policyOperation('edit',{actor:{did:'fixture-admin',role:'admin'},args:{type:'put',expectedRevision:state.revision,kind:'deny',did:identity,remark:'concurrent edit'}});}
    else if(value('DMP_TEST_DENY_ON_VERIFY')==='1')await bindings.DB.batch([
      bindings.DB.prepare('UPDATE mail_service_policy SET revision=revision+1 WHERE id=1'),
      bindings.DB.prepare("INSERT OR REPLACE INTO mail_access_entries(kind,did,remark,created_at,created_by) VALUES('deny',?,'concurrent edit',?,'fixture')").bind(identity,new Date().toISOString()),
    ]);
    return digest(unb64u(signed)).toUpperCase();
  },
  async broadcast(bytes:string){const hash=digest(unb64u(bytes)).toUpperCase();await bindings.DB.prepare('INSERT INTO dmp_test_chain(hash,broadcasts) VALUES(?,1) ON CONFLICT(hash) DO UPDATE SET broadcasts=broadcasts+1').bind(hash).run();if(value('DMP_TEST_REJECT_FIRST_INDEX')==='1' && text(unb64u(bytes)).startsWith('index:') && !(await bindings.DB.prepare('SELECT count(*) AS n FROM dmp_index_attempts').first<{n:number}>())?.n)await bindings.DB.prepare('UPDATE dmp_test_chain SET rejected=1 WHERE hash=?').bind(hash).run();throw new Error('Simulated lost broadcast response AFTER chain commit');},
  async paymentEvidence(hash:string,_bytes:string,quote:Quote){return evidence(hash,quote);},
  async prepareIndex(m:Manifest){const attempt=await bindings.DB.prepare('SELECT count(*) AS n FROM dmp_index_attempts WHERE message_id=?').bind(m.messageId).first<{n:number}>();const bytes=b64u(utf8('index:'+m.messageId+(attempt?.n?':'+attempt.n:'')));return{bytes,hash:digest(unb64u(bytes)).toUpperCase(),assetId:'zAsset'+m.messageId};},
  async indexEvidence(hash:string,assetId:string,_manifest:Manifest,_paymentHash:string,quote:Quote){const e=await evidence(hash,quote);return e?{...e,assetId}:null;},
};
async function evidence(hash:string,quote:Quote):Promise<Evidence|null>{const row=await bindings.DB.prepare('SELECT * FROM dmp_test_chain WHERE hash=?').bind(hash).first();return row && row.rejected!==-1?{...([1,2].includes(Number(row.rejected))?{rejected:true}:{}),transactionId:row.rejected===2?'0'.repeat(64):hash,confirmedAt:new Date().toISOString(),...(quote.settlement.confirmationPolicy==='arcblock-dolt-ledger/1'&&value('DMP_TEST_WRONG_EVIDENCE')!=='1'?{confirmationPolicy:'arcblock-dolt-ledger/1',ledgerBackend:'@ocap/statedb-dolt v1.20.2'} as const:{blockHeight:'123'})}:null;}
