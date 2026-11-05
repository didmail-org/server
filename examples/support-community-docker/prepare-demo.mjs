import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import assert from 'node:assert/strict';

const config = JSON.parse(readFileSync('/opt/demo-config.json', 'utf8'));
const manifest = '/opt/demo/blocklet.yaml';
const source = readFileSync(manifest, 'utf8');
assert.ok(source.includes(`id: ${config.id}\n`));
assert.ok(source.includes('version: 0.1.0\n'));
writeFileSync(
  manifest,
  source.replace('version: 0.1.0\n', `version: ${config.version}\n`) +
    `
instance:
  required: true
  mount: /instance
  seed:
    from: seed
sites:
  - name: support-local
    domains:
      - localhost
`,
);

const settings = '/opt/demo/seed/settings/settings-shell/app/';
// SettingsResolver lists declared JSON fields. A DSL file in this namespace
// cannot be read through its overlay and breaks auto-surface expansion.
unlinkSync(settings + 'settings.aup');
const fields = [
  ['package-definition/site/brand/app-name.json', { scope: 'instance', type: 'text' }],
  [
    'package-definition/assistant/model/default-model.json',
    {
      scope: 'instance',
      type: 'select',
      options: ['gpt-5.5', 'gpt-5.4-mini'],
    },
  ],
  ['instance-settings/support/identity/community-name.json', { scope: 'instance', type: 'text' }],
  ['user-settings/profile/personal/display-name.json', { scope: 'user', type: 'text' }],
  ['arc-system/access/policies/session-ttl-minutes.json', { scope: 'instance', type: 'number' }],
];
for (const [file, metadata] of fields) {
  const field = JSON.parse(readFileSync(settings + file, 'utf8'));
  writeFileSync(settings + file, JSON.stringify({ ...field, ...metadata }, null, 2) + '\n');
}
