import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adminTranslator } from '../../ui/admin-i18n.js';
import { renderStorageTable, storagePayment, storageFeeDetails, storageStatus } from '../../ui/storage-list.js';
const id='7c154444-4384-4edd-a5ee-c39e63e459af';
const mail={id,storageKey:'dmp:'+id,sender:'did:abt:z'+'1'.repeat(30),receiver:'did:abt:z'+'2'.repeat(30),sendStatus:'awaiting_signature',size:127,payment:'10000000000000000',credit:'8900000000000000',dividend:'1000000000000000',createdAt:'2026-10-30T08:20:00.000Z',envelope:'z'+'3'.repeat(30),hash:'a'.repeat(64)};
const t=adminTranslator('zh');
test('overview has short IDs, localized state, quote labeling and hidden technical/deletion details',()=>{
 const html=renderStorageTable([mail],t,'TBA');const overview=html.split('<tr class="dm-storage-detail-row"')[0];
 assert.ok(overview.includes('7c154444…59af'));assert.ok(overview.includes('待签名'));assert.ok(overview.includes('127 B'));assert.ok(overview.includes('报价'));
 assert.ok(!overview.includes('data-action="delete-mail"'));assert.ok(!overview.includes('净收益'));assert.match(html,/id="storage-mail-0" hidden/);assert.match(html,/aria-expanded="false"/);assert.ok(html.includes('报价明细'));assert.ok(html.includes('节点服务费'));assert.ok(!html.includes('Net Profit'));
});
test('amounts distinguish unsigned quotes, pending payments and confirmed payments without losing atomic precision',()=>{
 assert.ok(storagePayment(mail,t,'TBA').includes('0.01 TBA'));assert.ok(!storagePayment(mail,t,'TBA').includes('付款已确认'));
 assert.ok(storagePayment({...mail,paymentTx:'fixture',sendStatus:'payment_pending'},t,'TBA').includes('等待确认'));
 assert.ok(storagePayment({...mail,sendStatus:'delivered'},t,'TBA').includes('付款已确认'));
 assert.ok(storageFeeDetails(mail,t,'TBA').includes('0.0001 TBA'));
 assert.ok(storageFeeDetails({...mail,payment:'1'},t,'TBA').includes('0.000000000000000001 TBA'));
 assert.ok(storagePayment({payment:'1234567890123456789'},t,'ABT').includes('1.2346 ABT'));
 assert.ok(!storagePayment({payment:null},t,'TBA').includes('Free'));
});
test('unconfirmed paid deliveries cannot be deleted, and untrusted metadata is escaped',()=>{
 const html=renderStorageTable([{...mail,sendStatus:'payment_pending',paymentTx:'fixture',hash:'<img src=x onerror=alert(1)>'}],t,'TBA');
 assert.match(html,/<button[^>]*data-action="delete-mail"[^>]*disabled/);assert.ok(html.includes('完成后才可删除'));assert.ok(!html.includes('<img src=x'));assert.ok(html.includes('&lt;img'));
});
test('all supported languages translate each live NFT delivery phase',()=>{
 const phases=['uploading','awaiting_signature','queued','payment_pending','payment_confirmed','index_pending','delivered','rejected','expired','reconciliation_required'];
 for(const locale of ['zh','ja','ru','ar']) for(const phase of phases){assert.notEqual(storageStatus({...mail,sendStatus:phase},adminTranslator(locale)),storageStatus({...mail,sendStatus:phase},adminTranslator('en')),locale+':'+phase);}
});

test('legacy NFT rows retain numeric deletion routes while modern mail uses its storage key',()=>{
 const legacy=renderStorageTable([{...mail,id:7,storageKey:'legacy:7'}],t,'TBA');
 assert.ok(legacy.includes('data-mail-id="7"'));assert.ok(!legacy.includes('data-mail-id="legacy:7"'));
 assert.ok(renderStorageTable([mail],t,'TBA').includes('data-mail-id="dmp:'+id+'"'));
});
