import fs from 'fs';
import { WalletObject } from '@ocap/wallet';
import createNodeWallet from '../../../../blocklet/providers/didmail-http/source/api/src/libs/node-wallet';
import runtimeEnv from './env';

let wallet: WalletObject | undefined;

export default function getWallet(): WalletObject {
  if (wallet) return wallet;
  if (!fs.existsSync(runtimeEnv.walletFile)) {
    throw new Error(
      'Node wallet missing. For historical Node data only, run pnpm legacy:wallet:setup or import the original wallet with pnpm legacy:sqlite:import. ARC uses private instance configuration.',
    );
  }
  const saved = JSON.parse(fs.readFileSync(runtimeEnv.walletFile, 'utf8'));
  if (typeof saved.secretKey !== 'string') {
    throw new Error('Invalid node wallet file: expected an explicitly 0x-prefixed ED25519 secretKey');
  }
  wallet = createNodeWallet(saved.secretKey, saved.address);
  return wallet;
}
