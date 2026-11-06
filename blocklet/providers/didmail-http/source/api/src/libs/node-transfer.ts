import GraphQLClient from '@ocap/client';
import { isValid } from '@arcblock/did';
import chainReads from '../../../identity/chain-read';
import getWallet from '../../../identity/wallet';
import env from '../../../config/env';

const client = new GraphQLClient(env.chainHost, false);
const wallet = getWallet();
const failure = (message: string, status = 400) =>
  Object.assign(new Error(message), { status, nodeTransferError: true });

function ownerAddress(user?: { did: string; role: string }) {
  if (user?.role !== 'owner') throw failure('Only the node owner can transfer funds.', 403);
  const address = user.did.replace(/^did:abt:/, '');
  if (!isValid(address) || address === wallet.address)
    throw failure('The owner does not have a valid recipient DID.', 400);
  return address;
}

export async function nodeTransferQuote(user?: { did: string; role: string }) {
  const recipient = ownerAddress(user);
  const reads = chainReads(client);
  const [{ state: account }, { state: token }] = await Promise.all([
    reads.getAccountState({ address: wallet.address }),
    reads.getTokenState({ address: env.tokenId }),
  ]);
  if (!token?.symbol || !Number.isInteger(token.decimal) || token.decimal < 0 || token.decimal > 36)
    throw failure('Node balance could not be verified.', 503);
  const balance = account?.tokens?.find((item) => item.address === env.tokenId);
  if (balance && (!/^\d+$/.test(String(balance.value)) || Number(balance.decimal ?? token.decimal) !== token.decimal))
    throw failure('Node balance could not be verified.', 503);
  return {
    recipient,
    node: wallet.address,
    chainId: env.chainId,
    token: { address: env.tokenId, symbol: token.symbol, decimal: token.decimal, value: balance?.value || '0' },
  };
}

export async function transferToOwner(user: { did: string; role: string } | undefined, amount: unknown) {
  ownerAddress(user);
  if (typeof amount !== 'string' || amount.length > 100 || !/^\d+(\.\d+)?$/.test(amount))
    throw failure('Enter a valid token amount.');
  const quote = await nodeTransferQuote(user);
  const [whole, fraction = ''] = amount.split('.');
  if (fraction.length > quote.token.decimal) throw failure(`Use at most ${quote.token.decimal} decimal places.`);
  const value = BigInt(whole + fraction.padEnd(quote.token.decimal, '0'));
  if (value <= 0n) throw failure('Transfer amount must be greater than zero.');
  if (value > BigInt(quote.token.value)) throw failure('Insufficient available balance.', 402);
  // The recipient and token are server-selected; never accept a browser-supplied destination.
  const hash = await client.sendTransferV2Tx({
    tx: {
      itx: { to: quote.recipient, value: '0', assets: [], tokens: [{ address: env.tokenId, value: value.toString() }] },
    },
    wallet,
  });
  if (typeof hash !== 'string' || !hash) throw new Error('Missing transfer transaction hash');
  return { hash, recipient: quote.recipient, amount, token: quote.token.symbol };
}
