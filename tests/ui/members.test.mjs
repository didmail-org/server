import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { renderMembers } from '../../ui/members.js';
import { renderMailPolicy } from '../../ui/mail-policy.js';
import { adminTranslator } from '../../ui/admin-i18n.js';
const did = JSON.parse(fs.readFileSync('test/fixtures/protocol/fixtures/account-recovery-v1.json')).body.mailboxId;
test('member table escapes profiles, distinguishes revoked links and translates the complete directory', () => {
  for (const lang of ['en', 'zh', 'ja', 'ru', 'ar']) {
    const t = adminTranslator(lang);
    const html = renderMembers(
      {
        page: 1,
        pageSize: 20,
        total: 1,
        members: [
          {
            did,
            name: '<img src=x onerror=alert(1)>',
            role: 'member',
            active: true,
            binding: { mailboxId: did, revoked: true },
          },
        ],
      },
      t,
    );
    assert.match(html, /&lt;img/);
    assert.doesNotMatch(html, /<img src=x/);
    assert.ok(html.includes(t('Revoked')));
    if (lang !== 'en') assert.notEqual(t('Members'), 'Members');
  }
});
test('settings and member access panels have distinct controls', () => {
  const policy = {
    accessMode: 'public',
    ordinary: { enabled: false, retentionDays: 10, baseFee: '0', attachmentPricePerBytePerDay: '0' },
    attachments: { enabled: true, maxCount: 20, maxFileBytes: 100, maxTotalBytes: 100 },
    maxMessageCiphertextBytes: 100,
  };
  const args = [
    { policy, accessSource: 'arc' },
    { kind: 'deny', entries: [] },
    { transportEnabled: false },
    adminTranslator('zh'),
  ];
  const settings = renderMailPolicy(...args, 'service', 'settings');
  assert.doesNotMatch(settings, /data-access-entry|data-policy-kind|settings-access-tab/);
  assert.match(settings, /data-service-policy/);
  assert.doesNotMatch(settings, /name="accessMode"/);
  const members = renderMailPolicy(...args, 'access', 'members');
  assert.doesNotMatch(members, /data-service-policy|data-mail-health|name="baseFee"/);
  assert.match(members, /data-access-entry/);
  assert.doesNotMatch(members, /data-member-access|name="accessMode"/);
  assert.doesNotMatch(members, /<option value="allow"/);
});

test('directory uses compact identity, localized guest and semantic state pills without redundant columns', () => {
  const t = adminTranslator('zh');
  const html = renderMembers(
    { page: 1, pageSize: 20, total: 1, members: [{ did, name: '', role: 'guest', active: false, binding: null }] },
    t,
  );
  assert.match(html, /dm-member-avatar/);
  assert.match(html, /dm-badge-guest/);
  assert.match(html, /dm-badge-inactive/);
  assert.ok(html.includes('未命名成员'));
  assert.ok(html.includes('访客'));
  assert.ok(html.includes('未绑定'));
  assert.doesNotMatch(html, /<th>绑定状态<\/th>/);
  assert.match(html, /data-members-page="next"[^>]*disabled/);
  const empty = renderMembers({ page: 1, pageSize: 20, total: 0, members: [] }, t);
  assert.match(empty, /colspan="4"/);
  assert.ok(empty.includes('请尝试其他姓名'));
});

test('member panel contains blocking only; node NFT automatically controls access',()=>{
 const policy={accessMode:'allowlist',ordinary:{enabled:false,retentionDays:10,baseFee:'0',attachmentPricePerBytePerDay:'0'},attachments:{enabled:true,maxCount:20,maxFileBytes:100,maxTotalBytes:100},maxMessageCiphertextBytes:100};
 const html=renderMailPolicy({policy,accessSource:'arc'},{kind:'deny',entries:[]},{},adminTranslator('zh'),'access','members');
 assert.doesNotMatch(html,/data-member-access|name="accessMode"|data-policy-kind/);
 assert.match(html,/data-block-editor/);assert.ok(html.includes('尚未屏蔽任何账户'));
});
