import getWallet from '../runtime/wallet';
import runtimeEnv from '../runtime/env';
import nodeStakeWaitingPeriod from '../../../../blocklet/providers/didmail-http/source/api/src/libs/node-stake-policy';

require('dotenv-flow').config({ silent: true });

const chainId = process.env.CHAIN_ID || 'beta';

export default {
  ...runtimeEnv,
  chainId,
  appId: getWallet().address,
  chainHost: process.env.CHAIN_HOST || 'https://beta.abtnetwork.io/api/',
  tokenId: process.env.LOCAL_TOKEN_ID || 'z35n6UoHSi9MED4uaQy6ozFgKPaZj2UKrurBG',
  serverNodeFactory: process.env.SERVER_NODE_FACTORY || '',
  envelopeFactory: process.env.ENVELOPE_FACTORY || '',
  factoryOwner: process.env.FACTORY_OWNER || '',
  revokeWaitingPeriod: nodeStakeWaitingPeriod(chainId),
  mailPrice: Number(process.env.MAIL_PRICE || 0.0001),
  mailFactory: process.env.MAIL_FACTORY || '',
  contactFactory: process.env.CONTACT_FACTORY || '',
  namecardFactory: process.env.NAMECARD_FACTORY || '',
  contactPrice: Number(process.env.CONTACT_PRICE || 0.0001),
  aliasFactory: process.env.ALIAS_FACTORY || '',
};
