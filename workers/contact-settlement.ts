import GraphQLClient from '@ocap/client';
import { fromAddress, type WalletObject } from '@ocap/wallet';
import { formatFactoryState, preMintFromFactory } from '@ocap/asset';
import { fromBase58, toUint8Array } from '@ocap/util';
import { toTxHash } from '@ocap/mcrypto';
import type { ContactNodePolicy } from '../api/src/libs/contact-quote';
import type { ContactPreparation } from '../api/src/libs/contact-preparation';
import { contactPreparationCommitment } from '../api/src/libs/contact-preparation';
import { verifyContactPayment } from '../api/src/libs/contact-payment-evidence';
import {
  contactMintVariables,
  prepareContactMint,
  verifyContactMint,
  type ContactMintBytes,
} from '../api/src/libs/contact-mint-evidence';
import type { ContactSettlementAdapter, ContactChainEvidence } from './contact-jobs';
import { requestDmpChainRpc } from './dmp-ledger-read';
import { readContactLedgerRecord } from './contact-ledger-read';
import { decodeContactBytes } from '../api/src/libs/contact-base58';

type Operator = Pick<WalletObject<any>, 'address' | 'publicKey' | 'sign'>;
const deny = (code = 'CONFLICTING_CHAIN_EVIDENCE'): never => {
  throw new Error(code);
};
const samePayee = (a: string, b: string) =>
  /^0x[0-9a-fA-F]{40}$/.test(a) && /^0x[0-9a-fA-F]{40}$/.test(b) ? a.toLowerCase() === b.toLowerCase() : a === b;

/** Actual bounded RPC/CBOR adapter. Still internal until recovery clients and routes are enabled. */
export class ArcBlockContactSettlement implements ContactSettlementAdapter {
  private readonly policy: Readonly<ContactNodePolicy>;
  private readonly publicKey: Uint8Array;
  private readonly client: any;
  constructor(
    policy: ContactNodePolicy,
    private readonly operator: Operator,
    private readonly fetcher: typeof fetch = fetch,
    private readonly clock: () => number = Date.now,
  ) {
    this.policy = Object.freeze({ ...policy });
    this.publicKey = new Uint8Array(toUint8Array(operator.publicKey));
    this.client = new GraphQLClient(policy.chainEndpoint, false);
    this.client._doRequest = async (query: string, _options: unknown, dataKey?: string) => {
      const result = await requestDmpChainRpc(this.policy.chainEndpoint, query, {}, this.fetcher);
      return dataKey && result.data[dataKey] ? result.data[dataKey] : result.data;
    };
  }
  private profile(preparation: ContactPreparation) {
    const { binding: b, policy: p } = preparation.snapshot,
      configured = this.policy;
    if (
      b.endpoint !== configured.endpoint ||
      b.chainId !== configured.chainId ||
      p.chainEndpoint !== configured.chainEndpoint ||
      b.tokenAddress !== configured.tokenAddress ||
      b.servicePayee !== configured.servicePayee ||
      b.servicePayee !== this.operator.address ||
      b.developerPayee !== configured.developerPayee ||
      p.contactFactory !== configured.contactFactory ||
      p.namecardFactory !== configured.namecardFactory ||
      p.confirmationPolicy !== configured.confirmationPolicy ||
      !preparation.payment
    )
      deny('ACCEPTED_CHAIN_PROFILE_CHANGED');
  }
  private capture(original: ContactPreparation): ContactPreparation {
    const p = structuredClone(original);
    this.profile(p);
    Object.freeze(p.snapshot.binding);
    Object.freeze(p.snapshot.policy);
    Object.freeze(p.snapshot);
    Object.freeze(p.payment);
    return Object.freeze(p);
  }
  private async payment(preparation: ContactPreparation) {
    this.profile(preparation);
    const payment = preparation.payment!;
    const verified = await verifyContactPayment(
      payment.signedOrigin,
      preparation.snapshot.binding,
      fromBase58(payment.publicKey),
      contactPreparationCommitment(preparation),
    );
    if (verified.transactionId !== payment.transactionId || verified.unsignedOrigin !== payment.unsignedOrigin) deny();
  }
  private asset(state: any, preparation: ContactPreparation, address: string) {
    const b = preparation.snapshot.binding;
    if (
      !state ||
      state.address !== address ||
      state.owner !== b.receiver ||
      state.parent !== preparation.snapshot.policy.contactFactory ||
      (state.issuer !== undefined && !samePayee(state.issuer, b.developerPayee))
    )
      deny('CONTACT_FACTORY_UNSUPPORTED');
    let data = state.data?.value;
    if (typeof data === 'string') {
      if (data.length > 96000) deny('CONTACT_FACTORY_UNSUPPORTED');
      try {
        data = JSON.parse(data);
      } catch {
        deny('CONTACT_FACTORY_UNSUPPORTED');
      }
    }
    if (
      !data ||
      typeof data !== 'object' ||
      Array.isArray(data) ||
      data.sender !== b.sender ||
      data.pk !== preparation.payment!.publicKey ||
      data.contact !== preparation.ciphertext ||
      data.namecard !== b.namecard ||
      (data.receiver !== undefined && data.receiver !== b.receiver)
    )
      deny('CONTACT_FACTORY_UNSUPPORTED');
  }
  private async evidence(preparation: ContactPreparation, origin: string): Promise<ContactChainEvidence | null> {
    this.profile(preparation);
    const hash = toTxHash(decodeContactBytes(origin)),
      profile = preparation.snapshot.policy;
    if (profile.confirmationPolicy === 'arcblock-dolt-ledger/1') {
      const record = await readContactLedgerRecord(
        profile.chainEndpoint,
        preparation.snapshot.binding.chainId,
        decodeContactBytes(origin),
        this.fetcher,
      );
      if (record.state === 'pending') return null;
      return {
        confirmation: {
          chainId: preparation.snapshot.binding.chainId,
          transactionId: record.transactionId,
          confirmedAt: record.recordedAt,
          confirmationPolicy: 'arcblock-dolt-ledger/1',
          ledgerBackend: record.backend,
        },
        ...(record.state === 'rejected' ? { rejected: true } : {}),
      };
    }
    const { info: chain } = await this.client.getChainInfo();
    if (
      !chain ||
      chain.network !== preparation.snapshot.binding.chainId ||
      chain.synced !== true ||
      /^@ocap\/statedb-dolt(?:\s|$)/i.test(String(chain.consensusVersion).trim()) ||
      !/^[1-9][0-9]*$/.test(String(chain.blockHeight))
    )
      deny();
    const { info } = await this.client.getTx({ hash });
    if (!info) return null;
    if (info.hash !== hash || !/^[0-9]+$/.test(String(info.height))) deny();
    if (BigInt(info.height) === 0n) return null;
    if (BigInt(info.height) > BigInt(chain.blockHeight)) deny();
    return {
      confirmation: {
        chainId: preparation.snapshot.binding.chainId,
        transactionId: hash,
        confirmedAt: new Date(info.time).toISOString(),
        blockHeight: String(info.height),
      },
      ...(!['OK', '0'].includes(String(info.code)) ? { rejected: true } : {}),
    };
  }
  async paymentEvidence(preparation: ContactPreparation) {
    preparation = this.capture(preparation);
    await this.payment(preparation);
    return this.evidence(preparation, preparation.payment!.signedOrigin);
  }
  async prepareMint(preparation: ContactPreparation) {
    preparation = this.capture(preparation);
    await this.payment(preparation);
    const b = preparation.snapshot.binding,
      p = preparation.snapshot.policy;
    const [{ state: factory }, { state: issuer }, { state: account }] = await Promise.all([
      this.client.getFactoryState({ address: p.contactFactory }),
      this.client.getAccountState({ address: b.developerPayee }),
      this.client.getAccountState({ address: b.servicePayee }),
    ]);
    const tokens = factory?.input?.tokens;
    if (
      !factory ||
      factory.address !== p.contactFactory ||
      !samePayee(factory.owner, b.developerPayee) ||
      !Array.isArray(tokens) ||
      tokens.length !== 1 ||
      tokens[0]?.address !== b.tokenAddress ||
      tokens[0]?.value !== p.mintAmount ||
      tokens[0]?.decimal !== 18 ||
      factory.input.assets?.length ||
      !['0', undefined, null].includes(factory.input.value) ||
      !Number.isSafeInteger(factory.numMinted) ||
      factory.numMinted < 0 ||
      factory.numMinted >= Number.MAX_SAFE_INTEGER ||
      !issuer ||
      !samePayee(issuer.address, b.developerPayee)
    )
      deny('CONTACT_FACTORY_TERMS_CHANGED');
    if (
      !account ||
      account.address !== b.servicePayee ||
      !/^(0|[1-9][0-9]*)$/.test(String(account.nonce)) ||
      BigInt(account.nonce) >= BigInt(Number.MAX_SAFE_INTEGER)
    )
      deny('CONTACT_FACTORY_UNSUPPORTED');
    const currentTime = this.clock();
    if (!Number.isSafeInteger(currentTime) || currentTime <= 0) deny('CONTACT_FACTORY_UNSUPPORTED');
    const nonce = Math.max(currentTime, Number(account.nonce) + 1);
    const prepared = await preMintFromFactory({
      factory: formatFactoryState(factory),
      inputs: contactMintVariables(preparation),
      owner: b.receiver,
      issuer: { wallet: fromAddress(b.developerPayee), name: String(issuer.moniker ?? '') },
    });
    this.asset({ ...prepared.asset, address: prepared.address, owner: b.receiver }, preparation, prepared.address);
    return prepareContactMint(
      preparation,
      {
        address: prepared.address,
        issuer: prepared.issuer,
        variables: Object.entries(prepared.variables).map(([name, value]) => ({ name, value: String(value) })),
      },
      this.operator,
      nonce,
    );
  }
  async verifyMint(preparation: ContactPreparation, mint: Readonly<ContactMintBytes>) {
    preparation = this.capture(preparation);
    this.profile(preparation);
    const verified = await verifyContactMint(preparation, mint.signedOrigin, mint.assetId, this.publicKey);
    if (verified.transactionId !== mint.transactionId) deny('INVALID_CONTACT_MINT');
  }
  async mintEvidence(preparation: ContactPreparation, mint: Readonly<ContactMintBytes>) {
    preparation = this.capture(preparation);
    await this.verifyMint(preparation, mint);
    const evidence = await this.evidence(preparation, mint.signedOrigin);
    if (!evidence || evidence.rejected) return evidence;
    const { state } = await this.client.getAssetState({ address: mint.assetId });
    this.asset(state, preparation, mint.assetId);
    return { ...evidence, assetId: mint.assetId };
  }
  async broadcast(preparation: ContactPreparation, signedOrigin: string) {
    preparation = this.capture(preparation);
    await this.payment(preparation);
    if (signedOrigin !== preparation.payment!.signedOrigin) {
      const { decodeTx } = require('@didmail/ocap-message-cbor/cbor');
      const tx = decodeTx(decodeContactBytes(signedOrigin));
      await verifyContactMint(preparation, signedOrigin, tx.itx?.address, this.publicKey);
    }
    const { hash } = await this.client.sendTx({
      tx: Buffer.from(decodeContactBytes(signedOrigin)).toString('base64'),
      commit: false,
    });
    if (hash !== toTxHash(decodeContactBytes(signedOrigin))) deny();
  }
}
