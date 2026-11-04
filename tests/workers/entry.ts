// Test-only entry point. Never included by the production bundle or Wrangler deploy.
import worker from '../../workers/index';
import { verifyContactPayment, isVerifiedContactPayment } from '../../api/src/libs/contact-payment-evidence';
import { ContactPreparationStore } from '../../workers/contact-preparation-store';
import { contactStoreFault } from './contact-store-faults';
import { handleContactRequest } from '../../workers/contact-api';
import { ArcBlockContactQuotes } from '../../workers/contact-quotes';
import { processContactJobs } from '../../workers/contact-jobs';
import { contactJobAdapter, contactJobWriteFault } from './contact-job-adapter';
import { ArcBlockContactSettlement } from '../../workers/contact-settlement';
import { getSigner, types } from '@ocap/mcrypto';
import { fromSecretKey } from '@ocap/wallet';
import contactFixture from '../fixtures/namecard-payment.json';
import { handleDmp } from '../../workers/dmp-api';
import { processDmpJobs, cleanupDmp } from '../../workers/dmp-jobs';
import { dmpTestAdapter } from './dmp-adapter';
import { readDmpLedgerRecord,requestDmpChainRpc } from '../../workers/dmp-ledger-read';
import { unb64u } from '@didmail/protocol';
import { ArcBlockSettlement } from '../../workers/dmp-settlement';
import chainReads from '../../workers/chain-read';
import { Mail, Attachment } from '../../workers/database';
import { rateLimit } from '../../workers/rate-limit';
import {
  readTemplateCache,
  templateCacheGeneration,
  writeTemplateCache,
  invalidateTemplateCache,
} from '../../workers/template-cache-store';
import { templateCacheScope } from '../../api/src/libs/template-list';
import templateEnv from '../../workers/env';
export default {
  ...worker,
  async fetch(request: Request<unknown, IncomingRequestCfProperties>, env: unknown, ctx: ExecutionContext) {
    if (new URL(request.url).pathname === '/__payment-nonce') {
      const { default: nextPaymentNonce } = await import('../../workers/payment-nonce');
      return Response.json({ nonce: await nextPaymentNonce() });
    }
    if(new URL(request.url).pathname.startsWith('/__namecard-access/')){const {authorizeNamecardSend}=await import('../../workers/namecard-access');return await authorizeNamecardSend(request)||Response.json({allowed:true});}
    if(new URL(request.url).pathname==='/__member-discovery'){const url=new URL(request.url);url.pathname='/.well-known/didmail';return handleDmp(new Request(url,request),ctx);}
    if(new URL(request.url).pathname==='/__member-stake'){
      const {requireMemberStake}=await import('../../workers/mail-gas-eligibility');
      const body=await request.json() as any;
      try{await requireMemberStake(body.sender,{getConfig:async()=>{throw Error('Internal mail must not query gas policy');},getTokenState:async()=>({state:body.token}),getStakeState:async()=>({state:body.stake})});return Response.json({allowed:true});}
      catch(error){return Response.json({code:error.code},{status:error.status||400});}
    }
    if (new URL(request.url).pathname.startsWith('/__production/v2/ordinary/')) {
      const target = new URL(request.url);
      target.pathname = target.pathname.replace('/__production', '');
      return worker.fetch(new Request(target.toString(), request), env, ctx);
    }
    if (new URL(request.url).pathname === '/__account/admission') {
      const { checkSenderAdmission,isFreeMailSender }=await import('../../workers/mail-admission');
      try { const did=new URL(request.url).searchParams.get('did')!;const policy=await checkSenderAdmission(did);return Response.json({allowed:true,free:new URL(request.url).searchParams.has('admissionOnly')?false:await isFreeMailSender(did),revision:policy.revision}); }
      catch(error){return Response.json({code:error.code},{status:error.status||400});}
    }
    if (new URL(request.url).pathname === '/__contact/settlement') {
      const input = await request.json<any>();
      const key = getSigner(types.KeyType.ED25519).genKeyPair('hex', new Uint8Array(32).fill(3));
      const operator = fromSecretKey(key.secretKey, { pk: 0, hash: 1 });
      const adapter = new ArcBlockContactSettlement(input.policy, operator, fetch, () => 1800000000002);
      try {
        if (input.operation === 'prepare') return Response.json(await adapter.prepareMint(input.preparation));
        if (input.operation === 'payment') return Response.json(await adapter.paymentEvidence(input.preparation));
        if (input.operation === 'mint') return Response.json(await adapter.mintEvidence(input.preparation, input.mint));
        if (input.operation === 'broadcast') { await adapter.broadcast(input.preparation, input.signedOrigin); return Response.json({ ok: true }); }
        if (input.operation === 'jobs') {
          const { bindings } = await import('../../workers/bindings');
          return Response.json(await processContactJobs(bindings.DB, adapter, { clock: () => input.now }));
        }
        return Response.json({ code: 'INVALID_TEST_OPERATION' }, { status: 400 });
      } catch (error) { return Response.json({ code: error.message }, { status: 409 }); }
    }
    if (new URL(request.url).pathname === '/__contact/jobs') {
      const { bindings } = await import('../../workers/bindings');
      const input = await request.json<any>();
      try { return Response.json(await processContactJobs(contactJobWriteFault(bindings.DB, input.fault),
        contactJobAdapter(bindings.DB, input.mode), { clock: () => input.now, limit: input.limit, leaseMs: input.leaseMs })); }
      catch { return Response.json({ code: 'TEST_JOB_STEP_INTERRUPTED' }, { status: 503 }); }
    }
    if (new URL(request.url).pathname.startsWith('/v1/contact-preparations/')) {
      return handleContactRequest(request, new ArcBlockContactQuotes({
        ...contactFixture.policy, endpoint: contactFixture.endpoint, chainEndpoint: 'https://chain.test/api/',
        servicePayee: contactFixture.serviceId.replace(/^did:abt:/, ''), confirmationPolicy: 'arcblock-committed',
      }), fromSecretKey(getSigner(types.KeyType.ED25519).genKeyPair('hex', new Uint8Array(32).fill(request.headers.get('x-fixture-node-signer')==='foreign'?4:3)).secretKey,{pk:0,hash:1}));
    }
    if (new URL(request.url).pathname === '/__contact/preparation') {
      try {
        const input = await request.json<any>();
        const { bindings } = await import('../../workers/bindings');
        const store = new ContactPreparationStore(contactStoreFault(bindings.DB, input.writeFault), () => input.now ?? Date.now());
        if (input.operation === 'create') return Response.json(await store.create(input.snapshot, input.ciphertext, input.expiresAt));
        if (input.operation === 'read') return Response.json(await store.read(input.id, input.sender));
        if (['accept', 'accept-lost-response', 'accept-mutate-public-key'].includes(input.operation)) {
          const publicKey = new Uint8Array(input.publicKey);
          const pending = store.accept(input.id, input.sender, input.signedOrigin, publicKey);
          if (input.operation === 'accept-mutate-public-key') publicKey.fill(0);
          const result = await pending;
          if (input.operation === 'accept-lost-response') return Response.json({ code: 'SIMULATED_LOST_RESPONSE' }, { status: 503 });
          return Response.json(result);
        }
        return Response.json({ code: 'UNKNOWN_TEST_OPERATION' }, { status: 400 });
      } catch (error) { return Response.json({ code: error.code ?? 'INVALID_CONTACT_PAYMENT', detail: String(error) }, { status: 400 }); }
    }
    if (new URL(request.url).pathname === '/__contact/verify') {
      try {
        const input = await request.json<any>();
        const result = await verifyContactPayment(input.signedOrigin, input.binding, new Uint8Array(input.publicKey));
        return Response.json({ ...result, verified: isVerifiedContactPayment(result) });
      } catch { return Response.json({ code: 'INVALID_CONTACT_PAYMENT' }, { status: 400 }); }
    }
    // Exercise retained ciphertext/signature compatibility without reopening the
    // retired public protocol. This entry is excluded from production builds.
    if (new URL(request.url).pathname.startsWith('/__legacy/api/mail/')) {
      const target = new URL(request.url);
      target.pathname = target.pathname.slice('/__legacy'.length);
      const { default: handler } = await import('../../workers/app');
      const { bindings } = await import('../../workers/bindings');
      return handler.fetch!(new Request(target.toString(), request), bindings, ctx);
    }
    if (new URL(request.url).pathname === '/__dmp/ledger-record') {
      try {
        const { original } = await request.json<{ original:string }>();
        return Response.json(await readDmpLedgerRecord('https://chain.test/api/','beta',unb64u(original)));
      } catch (error) { return Response.json({error:'LEDGER_EVIDENCE_UNAVAILABLE',detail:String(error.message)},{status:503}); }
    }
    if (new URL(request.url).pathname === '/__dmp/unsafe-chain-request') {
      try { await requestDmpChainRpc('https://chain.test/api/','mutation{sendTx(wallet:{sk:"public-fixture-secret"}){hash}}');return Response.json({unexpected:true}); }
      catch { return Response.json({blocked:true}); }
    }
    if(new URL(request.url).pathname==='/__envelope-admission'){
      const {requireEnvelopeAccess,envelopeAdmission}=await import('../../workers/envelope-access');
      try{const input=await request.json<any>();return Response.json(envelopeAdmission(await requireEnvelopeAccess(input.planId,input.sender),input.planId,input.sender));}
      catch(error){return Response.json({code:error.code||'INVALID_REQUEST'},{status:error.status||400});}
    }
    if (new URL(request.url).pathname === '/__dmp/payment-codec') {
      try {
        const input=await request.json<any>(),adapter=new ArcBlockSettlement();
        if(input.operation==='payment-prepare')return Response.json({unsigned:await adapter.payment.prepare(input.manifest,input.terms,unb64u(input.publicKey))});
        if(input.operation==='payment-verify')return Response.json({hash:await adapter.payment.verify(input.unsigned,input.signed,input.sender,unb64u(input.publicKey))});
        if(input.operation==='index-prepare')return Response.json(await adapter.prepareIndex(input.manifest,input.quote,input.paymentHash));
        if(input.operation==='prepare')return Response.json({unsigned:await adapter.preparePayment(input.manifest,input.quote,unb64u(input.pk))});
        if(input.operation==='verify')return Response.json({hash:await adapter.verifyPayment(input.unsigned,input.signed,input.identity,unb64u(input.pk))});
        return Response.json({error:'INVALID_TEST_OPERATION'},{status:400});
      }catch(error){return Response.json({error:String(error.message)},{status:409});}
    }
    if (new URL(request.url).pathname === '/__dmp/step') {
      const { bindings } = await import('../../workers/bindings');
      await bindings.DB.prepare('UPDATE dmp_messages SET next_attempt_at=0,lease_expires_at=0').run();
      return Response.json({ jobs: await processDmpJobs(dmpTestAdapter), cleanup: await cleanupDmp() });
    }
    if (new URL(request.url).pathname.startsWith('/v1/account-links')) return worker.fetch(request, env, ctx);
    if (new URL(request.url).pathname.startsWith('/v1/') || new URL(request.url).pathname === '/.well-known/didmail')
      return handleDmp(request, ctx, dmpTestAdapter);
    if (new URL(request.url).pathname === '/__chain-read') {
      try {
        const { method, input } = await request.json<{ method: string; input: unknown }>();
        const reader: any = chainReads({});
        if (!['getFactoryState', 'getAssetState', 'getAccountState', 'getStakeState', 'listAssets'].includes(method))
          return new Response('Unsupported test read', { status: 400 });
        return Response.json(await reader[method](input));
      } catch (error) {
        return Response.json({ message: error.message, code: error.code }, { status: 503 });
      }
    }
    if (new URL(request.url).pathname === '/__scheduled') {
      const pending: Promise<unknown>[] = [];
      await worker.scheduled({ cron: '0 * * * *' } as ScheduledEvent, env, {
        waitUntil: (p: Promise<unknown>) => pending.push(p),
      } as ExecutionContext);
      await Promise.all(pending);
      return Response.json({ done: true });
    }
    if (new URL(request.url).pathname === '/__template-cache') {
      const { kind = 'envelope', race = false } = await request.json<{
        kind?: 'envelope' | 'namecard';
        race?: boolean;
      }>();
      if (race) {
        const generation = await templateCacheGeneration('race');
        await writeTemplateCache('race', '0', { items: ['original'] }, generation);
        await invalidateTemplateCache('race');
        await writeTemplateCache('race', '0', { items: ['obsolete'] }, generation);
        return Response.json({ value: await readTemplateCache('race', '0') });
      }
      const scope = templateCacheScope(
        kind,
        kind === 'envelope' ? templateEnv.envelopeFactory : templateEnv.namecardFactory,
      );
      const generation = await templateCacheGeneration(scope);
      const item = {
        address: `${kind}-cached`,
        name: 'Cached template',
        description: 'Persisted chain data',
        price: '0.001',
        retentionPeriod: 7,
        display: '<svg>' + ' '.repeat(3 * 1024 * 1024) + '</svg>',
        token: { address: 'test-token', symbol: 'TBA', value: '1000000000000000', decimals: 18 },
      };
      await writeTemplateCache(
        scope,
        '0',
        { items: [item], paging: { cursor: '0', total: 1, next: false }, syncedAt: '2026-10-24T00:00:00.000Z' },
        generation,
      );
      return Response.json({ scope });
    }
    if (new URL(request.url).pathname === '/__fixture') {
      const {
        did,
        large = false,
        expired = false,
      } = await request.json<{ did: string; large?: boolean; expired?: boolean }>();
      const content = Buffer.from([11, 22, 33, 44]);
      const { toBase58 } = await import('@ocap/util');
      const mail = await Mail.create({
        subject: 'opaque',
        content: toBase58(content),
        sender: did,
        receiver: did,
        envelope: 'fixture',
        sendStatus: 'sent',
        hash: 'hash',
        size: 4,
        expiredAt: new Date(Date.now() + (expired ? -1000 : 86400000)).toISOString(),
      });
      const mailId = mail.get('id');
      const bytes = large ? Buffer.alloc(3 * 1024 * 1024, 171) : Buffer.from([45, 67, 89, 0, 255]);
      await Attachment.create({
        id: 'attachment-' + mailId,
        mailId,
        encryptedName: 'opaque',
        encryptedMime: 'opaque',
        size: bytes.length,
        hash: 'hash',
        content: bytes,
      });
      // The D1 adapter must preserve atomic bulk rollback and clean up newly written R2 blobs.
      let conflict = false;
      try {
        await Attachment.bulkCreate([
          {
            id: 'rollback-' + mailId,
            mailId,
            encryptedName: 'opaque',
            encryptedMime: 'opaque',
            size: 1,
            hash: 'hash',
            content: Buffer.from([9]),
          },
          {
            id: 'attachment-' + mailId,
            mailId,
            encryptedName: 'opaque',
            encryptedMime: 'opaque',
            size: 1,
            hash: 'hash',
            content: Buffer.from([9]),
          },
        ]);
      } catch (e) {
        conflict = (e as Error).name === 'SequelizeUniqueConstraintError';
      }
      return Response.json({ mailId, conflict, rollback: (await Attachment.findByPk('rollback-' + mailId)) === null });
    }
    if (new URL(request.url).pathname === '/__limit') return Response.json(await rateLimit('concurrency-test', 5));
    return worker.fetch(request, env, ctx);
  },
};
