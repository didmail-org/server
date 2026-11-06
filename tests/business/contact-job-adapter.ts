import type { SqlDatabase } from '../../blocklet/providers/didmail-http/source/runtime/contracts';
// Coordinator fault fixture only. It does not claim real mint/chain verification.
import { toBase58, fromBase58 } from '@ocap/util';
import { toTxHash } from '@ocap/mcrypto';
import type { ContactPreparation } from '../../blocklet/providers/didmail-http/source/protocol/contact/contact-preparation';
import type { ContactSettlementAdapter, ContactChainEvidence } from '../../blocklet/providers/didmail-http/source/protocol/contact/contact-jobs';

export function contactJobAdapter(database: SqlDatabase, mode = ''): ContactSettlementAdapter {
  const db = database.withSession('first-primary');
  const evidence = async (preparation: ContactPreparation, hash: string): Promise<ContactChainEvidence | null> => {
    const row = await db
      .prepare('SELECT * FROM contact_test_chain WHERE hash=?')
      .bind(hash)
      .first<{ hash: string; rejected: number }>();
    if (!row) return null;
    const policy = preparation.snapshot.policy.confirmationPolicy;
    return {
      confirmation: {
        chainId: mode === 'wrong-network' ? 'foreign' : preparation.snapshot.binding.chainId,
        transactionId: mode === 'wrong-hash' ? 'A'.repeat(64) : hash,
        confirmedAt: '2026-10-28T00:00:00.000Z',
        ...(policy === 'arcblock-dolt-ledger/1' && mode !== 'wrong-policy'
          ? { confirmationPolicy: policy, ledgerBackend: '@ocap/statedb-dolt v1.20.2' }
          : { blockHeight: mode === 'zero-height' ? '0' : '123' }),
      },
      rejected: row.rejected === 1,
    } as ContactChainEvidence;
  };
  return {
    paymentEvidence: (preparation) => evidence(preparation, preparation.payment!.transactionId),
    async prepareMint(preparation) {
      const id = preparation.snapshot.binding.preparationId;
      const count = await db
        .prepare(
          `INSERT INTO contact_test_signings(id,count) VALUES(?,1)
        ON CONFLICT(id) DO UPDATE SET count=count+1 RETURNING count`,
        )
        .bind(id)
        .first<{ count: number }>();
      if (mode === 'expire-mint')
        await db
          .prepare(
            `UPDATE contact_jobs SET lease_expires_at=0,
        lease_fence=lease_fence+1,lease_owner='new-worker' WHERE preparation_id=?`,
          )
          .bind(id)
          .run();
      const signedOrigin = toBase58(new TextEncoder().encode('mint:' + id + ':' + count!.count));
      return { signedOrigin, transactionId: toTxHash(fromBase58(signedOrigin)), assetId: 'zAsset' + id };
    },
    async verifyMint(_preparation, mint) {
      if (mode === 'invalid-mint' || toTxHash(fromBase58(mint.signedOrigin)) !== mint.transactionId)
        throw Error('INVALID_CONTACT_MINT');
    },
    async mintEvidence(preparation, mint) {
      const result = await evidence(preparation, mint.transactionId);
      return result ? { ...result, assetId: mode === 'wrong-asset' ? 'foreign' : mint.assetId } : null;
    },
    async broadcast(_preparation, signedOrigin) {
      const hash = toTxHash(fromBase58(signedOrigin));
      await db
        .prepare(
          `INSERT INTO contact_test_chain(hash,original,broadcasts,rejected) VALUES(?,?,1,0)
        ON CONFLICT(hash) DO UPDATE SET broadcasts=broadcasts+1`,
        )
        .bind(hash, signedOrigin)
        .run();
      if (mode !== 'return-broadcast') throw Error('Simulated response lost AFTER chain acceptance');
    },
  };
}

/** Fault occurs in the real AFS relational statement, before or after mint bytes become durable. */
export function contactJobWriteFault(database: SqlDatabase, fault: string | undefined): SqlDatabase {
  if (!fault) return database;
  return {
    withSession(constraint: string) {
      const session = database.withSession(constraint);
      return {
        prepare(sql: string) {
          const statement = session.prepare(sql);
          if (
            !sql.startsWith('UPDATE contact_jobs SET state=?,signed_mint=?') &&
            !(fault === 'after-enqueue' && sql.startsWith('INSERT INTO contact_jobs'))
          )
            return statement;
          return {
            bind(...args: unknown[]) {
              const bound = statement.bind(...args);
              return {
                async run() {
                  if (fault === 'before-mint') throw Error('Simulated storage interruption');
                  const result = await bound.run();
                  if (fault === 'after-mint' || fault === 'after-enqueue')
                    throw Error('Simulated storage response lost');
                  return result;
                },
              };
            },
          };
        },
      };
    },
  } as SqlDatabase;
}
