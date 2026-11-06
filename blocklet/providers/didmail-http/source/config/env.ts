import getWallet from '../identity/wallet';
import { value } from '../runtime/bindings';
import nodeStakeWaitingPeriod from '../api/src/libs/node-stake-policy';
const chainId = value('CHAIN_ID', 'beta');
export default {
  appUrl: value('DIDMAIL_URL'),
  appName: 'DIDMail Server',
  chainId,
  appId: getWallet().address,
  chainHost: value('CHAIN_HOST', 'https://beta.abtnetwork.io/api/'),
  tokenId: value('LOCAL_TOKEN_ID', 'z35n6UoHSi9MED4uaQy6ozFgKPaZj2UKrurBG'),
  serverNodeFactory: value('SERVER_NODE_FACTORY'),
  envelopeFactory: value('ENVELOPE_FACTORY'),
  factoryOwner: value('FACTORY_OWNER'),
  revokeWaitingPeriod: nodeStakeWaitingPeriod(chainId),
  mailPrice: Number(value('MAIL_PRICE', '0.0001')),
  mailFactory: value('MAIL_FACTORY'),
  contactFactory: value('CONTACT_FACTORY'),
  namecardFactory: value('NAMECARD_FACTORY'),
  contactPrice: Number(value('CONTACT_PRICE', '0.0001')),
  aliasFactory: value('ALIAS_FACTORY'),
};
