import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { renderMemberAccess } from '../../ui/member-access.js';
import { adminTranslator } from '../../ui/admin-i18n.js';
const did = JSON.parse(fs.readFileSync('test/fixtures/protocol/fixtures/account-recovery-v1.json')).body.mailboxId;
test('all sender-panel states have complete translations and localized dates in five languages', () => {
  const statuses = [
    'Loading sender list…',
    'Sender blocked.',
    'Sender allowed.',
    'Note updated.',
    'Sender unblocked.',
    'Sender removed from allowlist.',
    'Save note',
    'Enter a valid mailbox or ARC DID.',
    'Could not confirm the result. Refresh the list before retrying.',
  ];
  for (const locale of ['en', 'zh', 'ja', 'ru', 'ar']) {
    const translate = adminTranslator(locale),
      keys = new Set(statuses);
    const t = Object.assign(
      (key, values) => {
        keys.add(key);
        return translate(key, values);
      },
      { locale },
    );
    for (const source of ['arc', 'legacy'])
      for (const kind of ['deny', 'allow'])
        for (const populated of [true, false]) {
          const html = renderMemberAccess(
            { accessSource: source },
            {
              kind,
              entries: populated
                ? [{ did, remark: '<script>bad</script>', createdAt: '2026-10-30T12:00:00.000Z' }]
                : [],
              hasPrevious: true,
              nextCursor: 'fixture',
            },
            t,
          );
          assert.doesNotMatch(html, /<script>bad/);
          assert.doesNotMatch(html, /<h[23]/); // The surrounding disclosure owns the single title.
          assert.match(html, /class="dm-block-rules"/);
          assert.match(html, /dir="ltr"/);
          if (populated)
            assert.ok(
              html.includes(
                new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric' }).format(
                  new Date('2026-10-30T12:00:00.000Z'),
                ),
              ),
            );
        }
    if (locale !== 'en') for (const key of keys) assert.notEqual(translate(key), key, locale + ': ' + key);
  }
});
