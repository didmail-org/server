import {
  canonicalize,
  digest,
  DOLT_COMMITTED_RECORD_QUERY,
  DOLT_LEDGER_BACKEND,
  type DoltCommittedRecord,
} from '@didmail/protocol';
import { requestDmpChainRpc } from '../dmp-ledger-read';

/** Contact mints can include 64 KiB of ciphertext. DMP's separate 48 KiB limit stays unchanged. */
export async function readContactLedgerRecord(
  endpoint: string,
  network: string,
  original: Uint8Array,
  fetcher: typeof fetch = fetch,
  now = Date.now(),
): Promise<DoltCommittedRecord> {
  const fail = (): never => {
    throw new Error('CONFLICTING_CHAIN_EVIDENCE');
  };
  if (
    !(original instanceof Uint8Array) ||
    !original.length ||
    original.length > 72 * 1024 ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(network) ||
    !Number.isSafeInteger(now) ||
    now < 0
  )
    return fail();
  const bytes = new Uint8Array(original),
    hash = digest(bytes).toUpperCase();
  const response = await requestDmpChainRpc(endpoint, DOLT_COMMITTED_RECORD_QUERY, { hash }, fetcher);
  if (canonicalize(response).length > 8 * 1024 * 1024) return fail();
  const chain = response.data?.getChainInfo,
    result = response.data?.getTx;
  if (
    chain?.code !== 'OK' ||
    chain.info?.network !== network ||
    chain.info?.synced !== true ||
    chain.info?.consensusVersion !== DOLT_LEDGER_BACKEND ||
    result?.code !== 'OK'
  )
    return fail();
  if (result.info === null) return { state: 'pending' };
  const info = result.info;
  if (
    !info ||
    info.hash !== hash ||
    info.height !== '0' ||
    info.tx?.chainId !== network ||
    typeof info.code !== 'string' ||
    !/^[A-Z][A-Z0-9_]{0,63}$/.test(info.code) ||
    typeof info.time !== 'string'
  )
    return fail();
  const at = Date.parse(info.time);
  if (!Number.isSafeInteger(at) || at < 0 || at > now + 30000 || new Date(at).toISOString() !== info.time)
    return fail();
  return {
    state: info.code === 'OK' ? 'committed' : 'rejected',
    chainId: network,
    transactionId: hash,
    recordedAt: info.time,
    backend: DOLT_LEDGER_BACKEND,
    executionCode: info.code,
  };
}
