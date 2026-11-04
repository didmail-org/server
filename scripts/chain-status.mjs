import { createRequire } from 'node:module';
import fs from 'node:fs';
import { walletFile, walletType } from './setup.mjs';
const require = createRequire(import.meta.url);
const { fromSecretKey } = require('@ocap/wallet');
const { toStakeAddress } = require('@arcblock/did-util');
const Client = require('@ocap/client');
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
console.log(JSON.stringify({ node: wallet.address, chainHost, declared: !!account.state, gasStake: !!stake.state, note: 'Read-only check. A new node requires token funding, gas stake and Server Node NFT configuration before sending.' }, null, 2));
if (!account.state) process.exitCode = 1;
