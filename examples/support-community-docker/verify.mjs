import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright-core';
const config = JSON.parse(fs.readFileSync(new URL('./config.json', import.meta.url), 'utf8'));

const settingPath = '/instance/settings/settings-shell/app/instance-settings/support/identity/community-name.json';

function chromePath() {
  const candidates = [
    process.env.SUPPORT_DEMO_CHROME,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ];
  const found = candidates.find((file) => file && fs.existsSync(file));
  if (!found) throw new Error('Install Chrome/Chromium or set SUPPORT_DEMO_CHROME to its executable');
  return found;
}

function privateJSON(file, value) {
  if (fs.existsSync(file) && fs.lstatSync(file).isSymbolicLink())
    throw new Error('Credential/report files cannot be symlinks');
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
  fs.chmodSync(file, 0o600);
}

async function openSettings(page) {
  await page.getByText('Settings', { exact: true }).first().click();
  await page.getByRole('button', { name: 'Support', exact: true }).click();
  await page.getByLabel('Support community name', { exact: true }).waitFor({ state: 'visible' });
  assert.ok(!(await page.locator('body').innerText()).includes('Auto surface unavailable'));
}

async function readSetting(page) {
  return page.evaluate(async (target) => {
    const result = await window.afs.read(target);
    const row = result?.data ?? result;
    return typeof row.content === 'string' ? JSON.parse(row.content) : row.content;
  }, settingPath);
}

async function ownerPhase(demo, browser, phase, expected, { login = false, write = false } = {}) {
  const credentialFile = path.join(demo.home, 'credentials/authenticator.json');
  const stateFile = path.join(demo.home, 'credentials/browser-state.json');
  for (const file of [credentialFile, stateFile]) {
    if (fs.existsSync(file) && fs.lstatSync(file).isSymbolicLink())
      throw new Error('Credential files cannot be symlinks');
  }
  if (fs.existsSync(credentialFile) !== fs.existsSync(stateFile))
    throw new Error('Incomplete saved test login; preserve and inspect its private files');
  const saved = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8')) : null;
  const credentials = fs.existsSync(credentialFile)
    ? JSON.parse(fs.readFileSync(credentialFile, 'utf8')).credentials
    : [];
  const context = await browser.newContext({
    locale: 'en-US',
    viewport: { width: 1280, height: 900 },
    ...(!login && saved ? { storageState: { cookies: saved.cookies, origins: [] } } : {}),
  });
  const page = await context.newPage();
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.abort());
  const cdp = await context.newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  for (const credential of credentials) await cdp.send('WebAuthn.addCredential', { authenticatorId, credential });
  const base = new URL(demo.url()).origin;
  const result = { phase, freshLogin: login || !saved, network: [] };
  page.on('response', (response) => {
    const url = new URL(response.url());
    if (url.origin === base && url.pathname.includes('/api/passkey/')) {
      result.network.push({ path: url.pathname, method: response.request().method(), status: response.status() });
    }
  });
  try {
    if (login || !saved) {
      const returnTo = `/app?blocklet=${config.id}`;
      await page.goto(base + '/.well-known/service/login?return_to=' + encodeURIComponent(returnTo), {
        waitUntil: 'domcontentloaded',
      });
      if (!credentials.length) {
        await page.getByRole('button', { name: 'Set up a passkey', exact: true }).click();
        await page.getByRole('button', { name: 'Set up passkey', exact: true }).click();
        result.registration = true;
      } else {
        await page.getByRole('button', { name: 'Continue with a passkey', exact: true }).click();
      }
      await page.waitForURL((url) => !url.pathname.includes('/.well-known/service/login'), { timeout: 25000 });
      assert.ok(result.network.some((row) => row.method === 'POST' && row.status === 200));
    }
    const response = await page.goto(demo.url(), { waitUntil: 'domcontentloaded' });
    assert.equal(response.status(), 200);
    await page.getByText('Support knowledge', { exact: true }).waitFor({ timeout: 15000 });
    result.session = await page.evaluate(async () => {
      const response = await fetch('/.well-known/service/api/did/session');
      const data = await response.json();
      return { authenticated: data.authenticated, did: data.user?.did, role: data.user?.role };
    });
    assert.equal(result.session.authenticated, true);
    assert.equal(
      result.session.role,
      'owner',
      'Use an isolated test demo; verification does not grant owner to a second account',
    );
    await openSettings(page);
    const field = page.getByLabel('Support community name', { exact: true });
    if (write) {
      const before = await readSetting(page);
      assert.equal(before.canWrite, true);
      await field.fill(expected);
      await field.blur();
      assert.equal((await readSetting(page)).value, before.value);
      result.draftUnchangedUntilSave = true;
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      let value;
      for (let attempt = 0; attempt < 40; attempt++) {
        value = (await readSetting(page)).value;
        if (value === expected) break;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      assert.equal(value, expected);
      result.savedThroughUI = true;
      await page.reload({ waitUntil: 'domcontentloaded' });
      await openSettings(page);
    }
    assert.equal(await field.inputValue(), expected);
    const setting = await readSetting(page);
    assert.equal(setting.value, expected);
    assert.equal(setting.canWrite, true);
    await page.screenshot({ path: path.join(demo.home, 'reports', phase + '.png'), fullPage: true });
    result.value = setting.value;
    return result;
  } finally {
    // Never print or include these objects in the public report.
    privateJSON(credentialFile, await cdp.send('WebAuthn.getCredentials', { authenticatorId }));
    privateJSON(stateFile, await context.storageState());
    await context.close();
  }
}

async function guestPhase(demo, browser) {
  const context = await browser.newContext({ locale: 'en-US' });
  try {
    const page = await context.newPage();
    await page.goto(demo.url(), { waitUntil: 'domcontentloaded' });
    await page.getByText('Support knowledge', { exact: true }).waitFor({ timeout: 15000 });
    await page.getByText('Settings', { exact: true }).first().click();
    await page.getByText('Sign in required', { exact: true }).waitFor();
    const denial = await page.evaluate(async (target) => {
      try {
        await window.afs.write(target + '/value', 'guest-write-must-not-succeed');
        return { refused: false };
      } catch (error) {
        return { refused: true, message: error.message };
      }
    }, settingPath);
    assert.equal(denial.refused, true, 'Anonymous write must be refused');
    assert.match(denial.message, /Forbidden.*sign in to change settings/);
    return { loginRequired: true, anonymousWriteRefused: true };
  } finally {
    await context.close();
  }
}

export async function verifyDemo(demo) {
  const file = path.join(demo.home, 'reports/verification.json');
  const report = { startedAt: new Date().toISOString(), phases: [] };
  const originalKeys = fs.readFileSync(path.join(demo.home, 'credentials/runtime.env'));
  const expected = 'Docker Settings UI ' + randomUUID();
  const browser = await chromium.launch({ headless: true, executablePath: chromePath() });
  try {
    console.log('Verifying native passkey login and Settings Save');
    report.phases.push(await ownerPhase(demo, browser, 'ui-save', expected, { login: true, write: true }));
    const baseline = demo.readSetting();
    assert.equal(baseline.value, expected);
    const identity = demo.identity();
    assert.ok(identity.id && identity.name === config.instance);
    console.log('Verifying restart with the existing login session');
    await demo.restart();
    report.phases.push(await ownerPhase(demo, browser, 'after-restart', expected));
    assert.deepEqual(demo.readSetting(), baseline);
    assert.deepEqual(demo.identity(), identity);
    console.log('Verifying container replacement and fresh passkey login');
    await demo.recreate();
    report.phases.push(await ownerPhase(demo, browser, 'after-recreate', expected, { login: true }));
    assert.deepEqual(demo.readSetting(), baseline);
    assert.deepEqual(demo.identity(), identity);
    report.guest = await guestPhase(demo, browser);
    assert.deepEqual(demo.readSetting(), baseline);
    assert.ok(
      fs.readFileSync(path.join(demo.home, 'credentials/runtime.env')).equals(originalKeys),
      'Runtime keys changed',
    );
    assert.ok(report.phases.every((phase) => phase.session.did === report.phases[0].session.did));
    report.passed = true;
    report.instanceAndKeysPreserved = true;
    report.completedAt = new Date().toISOString();
    privateJSON(file, report);
    console.log('PASS Settings save, reload, restart, replacement, login and anonymous refusal');
    console.log('Private report: ' + file);
  } catch (error) {
    report.passed = false;
    report.error = error.message;
    privateJSON(file, report);
    throw new Error('Demo verification failed; inspect the private report: ' + file);
  } finally {
    await browser.close();
  }
}
