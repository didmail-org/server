import { mkdirSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { fromRandom, fromSecretKey, WalletType } = require('@ocap/wallet');
const { types } = require('@ocap/mcrypto');
export const walletType = WalletType({ role: types.RoleType.ROLE_APPLICATION, pk: types.KeyType.ED25519, hash: types.HashType.SHA3 });
export const dataDir = path.resolve(process.env.DIDMAIL_DATA_DIR || '.data');
export const walletFile = path.resolve(process.env.DIDMAIL_WALLET_FILE || path.join(dataDir, 'node-wallet.json'));
export function setup() {
  mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  mkdirSync(path.dirname(walletFile), { recursive: true, mode: 0o700 });
  if (!existsSync(walletFile)) {
    const wallet = fromRandom(walletType);
    writeFileSync(walletFile, JSON.stringify({ address: wallet.address, secretKey: wallet.secretKey }) + '\n', { mode: 0o600, flag: 'wx' });
    console.log('Created a new local development node wallet. Existing nodes must import their original wallet before setup.');
  }
  const saved = JSON.parse(readFileSync(walletFile, 'utf8'));
  const wallet = fromSecretKey(saved.secretKey, walletType);
  if (saved.address && wallet.address !== saved.address) throw new Error('Wallet address mismatch');
  console.log(`Node DID: ${wallet.address}`);
  return wallet;
}
if (process.argv[1] === new URL(import.meta.url).pathname) {
  if (process.argv.includes('--help')) console.log('Usage: pnpm legacy:wallet:setup\nCreates a historical local Node wallet only when explicitly invoked. ARC uses private instance configuration; existing identities must be imported, never regenerated.');
  else setup();
}
