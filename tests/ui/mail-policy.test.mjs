import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {renderMailPolicy} from '../../ui/mail-policy.js';
import {adminTranslator} from '../../ui/admin-i18n.js';
const t=adminTranslator('zh');
test('policy hides retired VC pricing and activation while preserving attachment controls and escaping remarks',()=>{
 const fixture=JSON.parse(fs.readFileSync('test/fixtures/protocol/dmp-2/fixtures/ordinary-vc.json'));
 const p={accessMode:'allowlist',ordinary:{enabled:false,retentionDays:10,baseFee:'0',attachmentPricePerBytePerDay:'0'},attachments:{enabled:true,maxCount:20,maxFileBytes:33554432,maxTotalBytes:62914560},maxMessageCiphertextBytes:67108864};
 const html=renderMailPolicy({policy:p,revision:1},{kind:'allow',entries:[{did:fixture.manifest.senderId,remark:'<img src=x onerror=alert(1)>',createdAt:'2026-10-28T00:00:00.000Z'}],nextCursor:null},{transportEnabled:false},t);
 assert.doesNotMatch(html,/name="(?:ordinaryEnabled|baseFee|attachmentFee|retentionDays)"/);assert.match(html,/name="attachmentsEnabled"/);assert.match(html,/value="allowlist" selected/);assert.match(html,/&lt;img src=x onerror=alert\(1\)&gt;/);assert.doesNotMatch(html,/<img src=x/);
 assert.ok(html.includes('空名单拒绝新发信，不改变节点公开状态'));assert.ok(!html.includes('普通邮件和附件费用均为零'));assert.ok(html.includes('除黑名单外的所有发件人'));assert.ok(html.includes('外部收件人仍可下载自己的邮件'));
});
test('ARC member mode has no separately editable allowlist and retains deny controls',()=>{
 const p={accessMode:'allowlist',ordinary:{enabled:false,retentionDays:10,baseFee:'0',attachmentPricePerBytePerDay:'0'},attachments:{enabled:true,maxCount:20,maxFileBytes:100,maxTotalBytes:100},maxMessageCiphertextBytes:100};
 const html=renderMailPolicy({policy:p,revision:1,accessSource:'arc'},{kind:'deny',entries:[],nextCursor:null},{transportEnabled:false},t);
 assert.doesNotMatch(html,/<option value="allow"/);assert.match(html,/<option value="deny" selected/);assert.ok(html.includes('管理 ARC 成员和邀请'));assert.match(html,/href="\/\.well-known\/service\/admin"/);assert.ok(html.includes('仅活跃的 ARC 成员'));
});
