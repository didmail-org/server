import { createRequire } from 'node:module';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { walletFile, walletType } from './legacy-wallet-setup.mjs';
const require = createRequire(import.meta.url);
const { fromSecretKey } = require('@ocap/wallet');
const { toStakeAddress } = require('@arcblock/did-util');
const Client = require('@ocap/client');
export async function chainStatus() {
  const saved = JSON.parse(fs.readFileSync(walletFile, 'utf8'));
  const wallet = fromSecretKey(saved.secretKey, walletType);
  const chainHost = process.env.CHAIN_HOST || 'https://beta.abtnetwork.io/api/';
  const client = new Client(chainHost);
  const options = { ignoreFields: ['state.context'] };
  const result = await Promise.race([
    Promise.all([
      client.getAccountState({ address: wallet.address }, options),
      client.getStakeState({ address: toStakeAddress(wallet.address, wallet.address) }, options),
    ]),
    new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error('Chain readiness timed out')), 15000); timer.unref(); }),
  ]);
  const [account, stake] = result;
  return { node: wallet.address, chainHost, declared: !!account.state, gasStake: !!stake.state, note: 'Read-only historical wallet check; ARC uses private instance configuration.' };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes('--help')) console.log('Usage: pnpm chain:status\nReads the legacy local wallet selected by DIDMAIL_WALLET_FILE (or DIDMAIL_DATA_DIR), and queries CHAIN_HOST. Does not read ARC instance configuration or broadcast transactions.');
  else { const result = await chainStatus(); console.log(JSON.stringify(result, null, 2)); if (!result.declared) process.exitCode = 1; }
}
