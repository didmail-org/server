import path from 'path';

require('dotenv-flow').config({ silent: true });

const dataDir = path.resolve(process.env.DIDMAIL_DATA_DIR || '.data');
const port = Number(process.env.DIDMAIL_PORT || 3140);
const appUrl = process.env.DIDMAIL_URL || `http://didmail-server.localhost:${port}`;
const arcUrl = process.env.ARC_URL || 'http://127.0.0.1:4961';
const arcHost = process.env.ARC_HOST || new URL(appUrl).host;

if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid DIDMAIL_PORT');
for (const value of [appUrl, arcUrl]) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/') {
    throw new Error('DIDMAIL_URL and ARC_URL must be HTTP(S) origins');
  }
}

export default {
  dataDir,
  port,
  appUrl: appUrl.replace(/\/$/, ''),
  appName: 'DIDMail Server',
  arcUrl,
  arcHost,
  walletFile: path.resolve(process.env.DIDMAIL_WALLET_FILE || path.join(dataDir, 'node-wallet.json')),
};
