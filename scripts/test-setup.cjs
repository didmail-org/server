const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'didmail-arc-test-'));
process.env.DIDMAIL_DATA_DIR = dir;
process.env.DIDMAIL_WALLET_FILE = path.join(dir, 'node-wallet.json');
fs.writeFileSync(process.env.DIDMAIL_WALLET_FILE, JSON.stringify({ secretKey: '0x' + '01'.repeat(32) }), { mode: 0o600 });
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

process.env.FACTORY_OWNER = require('@ocap/wallet').fromSecretKey('0x' + '02'.repeat(32)).address;
