import fs from 'fs';
import { WalletObject } from '@ocap/wallet';
import createNodeWallet from '../libs/node-wallet';
import runtimeEnv from './env';

let wallet: WalletObject | undefined;

export default function getWallet(): WalletObject {
  if (wallet) return wallet;
  if (!fs.existsSync(runtimeEnv.walletFile)) {
    throw new Error('Node wallet missing. Run pnpm setup, or import the original node wallet with pnpm migrate.');
  }
  const saved = JSON.parse(fs.readFileSync(runtimeEnv.walletFile, 'utf8'));
  if (typeof saved.secretKey !== 'string') {
    throw new Error('Invalid node wallet file: expected an explicitly 0x-prefixed ED25519 secretKey');
  }
  wallet = createNodeWallet(saved.secretKey, saved.address);
  return wallet;
}
