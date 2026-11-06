import {
  contactQuoteFromChain,
  ContactQuoteUnavailable,
  type ContactNodePolicy,
  type ContactPreparationInput,
} from '../../../../../../api/src/libs/contact-quote';
import type { ContactQuoteProvider } from './contact-api';
import { requestDmpChainRpc } from '../dmp-ledger-read';
import { Namecard } from '../../storage/database';
import env from '../../config/env';
import wallet from '../../identity/wallet';
import { value } from '../../runtime/bindings';

export const CONTACT_QUOTE_QUERY = `query ContactPreparationQuote($namecard: String!, $factory: String!, $receiver: String!) {
 getAssetState(address: $namecard) { code state { address owner parent data { typeUrl value } } }
 getFactoryState(address: $factory) { code state { address owner input { tokens { address value decimal } } } }
 getAccountState(address: $receiver) { code state { address pk } }
 getChainInfo { code info { network synced consensusVersion blockHeight } }
 getForgeState { code state { txConfig { txFee { typeUrl fee } } } }
}`;

export class ArcBlockContactQuotes implements ContactQuoteProvider {
  private readonly policy: Readonly<ContactNodePolicy>;
  constructor(
    policy: ContactNodePolicy,
    private readonly fetcher: typeof fetch = fetch,
  ) {
    this.policy = Object.freeze({ ...policy });
  }
  async prepare(input: ContactPreparationInput) {
    try {
      if (!(await Namecard.findOne({ where: { address: input.namecard, enabled: true } })))
        throw new ContactQuoteUnavailable();
      const result = await requestDmpChainRpc(
        this.policy.chainEndpoint,
        CONTACT_QUOTE_QUERY,
        { namecard: input.namecard, factory: this.policy.contactFactory, receiver: input.receiver },
        this.fetcher,
      );
      return contactQuoteFromChain(this.policy, input, {
        asset: result.data.getAssetState,
        factory: result.data.getFactoryState,
        recipient: result.data.getAccountState,
        fees: { getChainInfo: result.data.getChainInfo, getForgeState: result.data.getForgeState },
      });
    } catch {
      throw new ContactQuoteUnavailable();
    }
  }
}

export function configuredContactQuotes(): ContactQuoteProvider {
  const confirmationPolicy = value('DMP_CONFIRMATION_POLICY', 'arcblock-committed');
  if (confirmationPolicy !== 'arcblock-committed' && confirmationPolicy !== 'arcblock-dolt-ledger/1')
    throw new ContactQuoteUnavailable();
  return new ArcBlockContactQuotes({
    endpoint: value('DIDMAIL_URL'),
    chainEndpoint: env.chainHost,
    chainId: env.chainId,
    tokenAddress: env.tokenId,
    servicePayee: wallet().address,
    developerPayee: env.factoryOwner,
    namecardFactory: env.namecardFactory,
    contactFactory: env.contactFactory,
    confirmationPolicy,
  });
}
