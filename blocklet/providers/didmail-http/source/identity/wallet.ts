import { WalletObject } from '@ocap/wallet';
import createNodeWallet from '../api/src/libs/node-wallet';
import { value } from '../runtime/bindings';
let wallet: WalletObject;
export default function getWallet() {
  if (wallet) return wallet;
  const secret = value('NODE_SECRET_KEY');
  if (!secret) throw new Error('NODE_SECRET_KEY binding is required');
  const candidate = createNodeWallet(secret, value('NODE_ADDRESS'));
  wallet = candidate;
  return wallet;
}
