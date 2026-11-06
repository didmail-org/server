// Explicit operator migration, not an application build/start prerequisite.
// Secrets travel in a private loopback request body, never command arguments.
import fs from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { parse } from 'dotenv';
import legacyDefaults from './migration/legacy-defaults.json' with { type: 'json' };
import { allowedVariables, validateProtocolConfig } from '../blocklet/providers/didmail-http/config.mjs';
import { localProtocolConfig } from './arc-protocol-config.mjs';
import createMembersForward from './arc-members-bridge.mjs';

// Validate the credential and exact site scope before persisting a migration.
// A listening HTTP provider alone does not establish working member admission.
export async function verifyProtocolMembership(config, { fetcher } = {}) {
  if (config.vars.DIDMAIL_MEMBER_ACCESS !== 'arc' || !config.secrets.ARC_MEMBERS_TOKEN) return;
  try {
    const instanceId = config.vars.DIDMAIL_ARC_INSTANCE_ID;
    const forward = createMembersForward({
      origin: config.arcOrigin,
      publicOrigin: config.publicOrigin,
      namespace: 'didmail-server',
      instanceId,
      token: config.secrets.ARC_MEMBERS_TOKEN,
      fetcher,
    });
    const query = new URLSearchParams({ instanceId, page: '1', search: '' });
    const response = await forward(new Request('https://arc-members.internal/members?' + query));
    if (response.status !== 200) throw Error('Unavailable membership');
  } catch {
    throw Error('ARC membership credential/site scope could not be verified; private configuration retained');
  }
}
export async function installProtocol({ arcOrigin, publicOrigin, interval = 0, enable = false }) {
  const saved = JSON.parse(await fs.readFile('.data/node-wallet.json', 'utf8'));
  const source = parse(await fs.readFile('.dev.vars'));
  if (!saved.address || saved.address !== source.NODE_ADDRESS || saved.secretKey !== source.NODE_SECRET_KEY)
    throw Error('Original wallet and preview identity differ; reconcile the original identity before migration');
  const port = Number(new URL(publicOrigin).port || 80);
  const vars = legacyDefaults;
  const values = { ...vars, ...source },
    config = {
      schemaVersion: 1,
      enabled: false,
      publicOrigin,
      arcOrigin,
      listenHost: '127.0.0.1',
      listenPort: port,
      aliases: '',
      jobsIntervalSeconds: Number(interval),
      vars: Object.fromEntries(
        Object.entries(values)
          .filter(([key]) => allowedVariables.has(key))
          .map(([key, value]) => [key, String(value)]),
      ),
      secrets: {
        NODE_SECRET_KEY: source.NODE_SECRET_KEY,
        NODE_ADDRESS: source.NODE_ADDRESS,
        ...(source.ARC_MEMBERS_TOKEN ? { ARC_MEMBERS_TOKEN: source.ARC_MEMBERS_TOKEN } : {}),
      },
    };
  validateProtocolConfig(config);
  const target = localProtocolConfig(arcOrigin);
  if (enable) {
    const current = (await target.read()).data;
    const previous = validateProtocolConfig(JSON.parse(current.content));
    if (
      previous.secrets.NODE_ADDRESS !== saved.address ||
      previous.secrets.NODE_SECRET_KEY !== saved.secretKey ||
      previous.publicOrigin !== publicOrigin ||
      previous.arcOrigin !== arcOrigin
    )
      throw Error('Staged protocol configuration differs from the original identity or selected origins');
    await verifyProtocolMembership(previous);
    await target.write({ ...previous, enabled: true }, current.meta.version);
  } else {
    await verifyProtocolMembership(config);
    await target.write(config, '!absent');
  }
  return { installed: true, enabled: enable };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { values } = parseArgs({
    options: {
      'arc-origin': { type: 'string' },
      'public-origin': { type: 'string' },
      interval: { type: 'string' },
      enable: { type: 'boolean' },
    },
  });
  if (!values['arc-origin'] || !values['public-origin']) throw Error('Explicit ARC and public origins are required');
  try {
    console.log(
      await installProtocol({
        arcOrigin: values['arc-origin'],
        publicOrigin: values['public-origin'],
        interval: values.interval,
        enable: values.enable,
      }),
    );
  } catch {
    console.error('Private protocol migration failed; original wallet/configuration retained.');
    process.exitCode = 1;
  }
}
