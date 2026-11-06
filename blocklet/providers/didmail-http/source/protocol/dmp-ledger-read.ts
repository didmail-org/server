import { DOLT_COMMITTED_RECORD_QUERY,digest,inspectDoltCommittedRecord,concat,type DoltCommittedRecord } from '@didmail/protocol';

/** Configured RPC transport. Authorization of signed mutations belongs to callers. */
export async function requestDmpChainRpc(endpoint:string,query:string,variables:Record<string,unknown>={},fetcher:typeof fetch=fetch):Promise<Record<string,any>>{
  const uri=new URL(endpoint),loopback=['localhost','127.0.0.1','[::1]'].includes(uri.hostname)||uri.hostname.endsWith('.localhost');
  if(uri.username||uri.password||uri.search||uri.hash||!(uri.protocol==='https:'||(uri.protocol==='http:'&&loopback)))throw new Error('INVALID_LEDGER_PROFILE');
  const body=JSON.stringify({query,variables});
  if(typeof query!=='string'||!query||body.length>128*1024||/\b(?:sk|secretKey|secret_key|mnemonic)\s*:/.test(query)||/"(?:sk|secretKey|secret_key|mnemonic)"\s*:/.test(JSON.stringify(variables)))throw new Error('UNSAFE_CHAIN_RPC_REQUEST');
  // workerd supports manual, not redirect:error. Reject every non-2xx response
  // below rather than following a Location to another evidence provider.
  const response=await fetcher(endpoint,{method:'POST',headers:{'content-type':'application/json',accept:'application/json'},redirect:'manual',signal:AbortSignal.timeout(20000),body});
  if(!response.ok||!response.body)throw new Error('LEDGER_RPC_UNAVAILABLE');
  const stream=response.body.getReader(),parts:Uint8Array[]=[];let size=0;
  for(;;){const {done,value}=await stream.read();if(done)break;size+=value.byteLength;if(size>8*1024*1024){await stream.cancel();throw new Error('LEDGER_RPC_RESPONSE_TOO_LARGE');}parts.push(value);}
  const result=JSON.parse(new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(concat(...parts)));
  if(/\bsendTx\s*\(/.test(query)&&Array.isArray(result?.errors)&&result.errors.length&&result.errors.every((e:any)=>e?.code==='INVALID_TX_SIZE'))throw Object.assign(new Error('CHAIN_TRANSACTION_REJECTED'),{chainRejectionCode:'INVALID_TX_SIZE'});
  if(/\bsendTx\s*\(/.test(query)&&Array.isArray(result?.errors)&&result.errors.length&&result.errors.every((e:any)=>e?.code==='INTERNAL'&&e?.message==='LEDGER_WRITE_FAILED: Entry with this hash already exists'))throw new Error('CHAIN_LEDGER_RECONCILIATION_REQUIRED');
  if(!result||typeof result!=='object'||Array.isArray(result)||!result.data||typeof result.data!=='object'||Array.isArray(result.data)||(result.errors!==undefined&&(!Array.isArray(result.errors)||result.errors.length)))throw new Error('INVALID_CHAIN_RPC_RESPONSE');
  return result;
}

/** Public membership read. Endpoint comes from the accepted configured profile. */
export async function readDmpLedgerRecord(endpoint:string,network:string,original:Uint8Array,fetcher:typeof fetch=fetch):Promise<DoltCommittedRecord>{
  if(!(original instanceof Uint8Array)||!original.length||original.length>48*1024)throw new Error('INVALID_LEDGER_ORIGINAL');
  const bytes=new Uint8Array(original);
  return inspectDoltCommittedRecord(await requestDmpChainRpc(endpoint,DOLT_COMMITTED_RECORD_QUERY,{hash:digest(bytes).toUpperCase()},fetcher),bytes,network);
}
