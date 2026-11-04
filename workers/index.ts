import nodeStakeWaitingPeriod from '../api/src/libs/node-stake-policy';
import localeConfig from '../ui/locales/config.js';
import { prepareAppearanceHtml, prepareNativeAppearanceScript } from '../ui/native-appearance.js';
import brandCss from '../ui/brand.css';
import { bindings, value } from './bindings';
import { arcFetch, hasArc } from './arc';
const platformRoute = (path: string) =>
  path.startsWith('/.well-known/') ||
  path === '/api/afs/rpc' ||
  /^\/(afs|mcp|ws)(\/|$)/.test(path) ||
  ['/__blocklet__.js', '/__meta__.js'].includes(path);
export default {
  async fetch(request: Request<unknown, IncomingRequestCfProperties>, _env: unknown, context: ExecutionContext) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/v1/account-links') || ['/account/authorize', '/account/approve'].includes(url.pathname)) {
      const { handleAccountLinks } = await import('./account-links');
      const response = await handleAccountLinks(request);
      const headers = new Headers(response.headers);
      headers.set('x-content-type-options', 'nosniff');
      if (!headers.has('referrer-policy')) headers.set('referrer-policy', 'no-referrer');
      if (url.pathname.startsWith('/v1/')) {
        headers.set('access-control-allow-origin', '*');
        headers.set('access-control-allow-methods', 'GET,POST,PUT,OPTIONS');
        headers.set('access-control-allow-headers', 'content-type,content-digest,dmp-identity,dmp-identity-key,signature-input,signature');
      }
      return new Response(response.body, {status:response.status,headers});
    }
    if(/^\/api\/(envelopes|namecards)\/*$/i.test(url.pathname)){const {handleEnvelopeList}=await import('./envelope-list');return handleEnvelopeList(request,/namecards\/*$/i.test(url.pathname)?'namecards':'envelopes');}
    if (request.method==='POST' && /^\/api\/contact\/send(?:\/sign)?\/?$/i.test(url.pathname)) { const {authorizeNamecardSend}=await import('./namecard-access'); const denied=await authorizeNamecardSend(request); if(denied)return denied; }
    if (url.pathname === '/api/mail/service-config' && request.method === 'GET') {
      const { publicMailPolicy } = await import('../api/src/libs/mail-service-policy');
      const { readEffectiveMailPolicy } = await import('./mail-admission');
      try {
        const [legacy, snapshot] = await Promise.all([publicMailPolicy(), readEffectiveMailPolicy(true)]);
        const {publicEnvelopeSelection}=await import('./envelope-access');
        legacy.defaultEnvelope=await publicEnvelopeSelection();
        legacy.directEnabled=Boolean(legacy.defaultEnvelope);
        return Response.json({ ...legacy, sendingAccessState:snapshot.sendingAccessState||'legacy', restricted: snapshot.policy.accessMode === 'allowlist', sendingRestricted: snapshot.policy.accessMode === 'allowlist', visibilityBasis: 'staked-server-node-nft' }, { headers: { 'cache-control': 'no-store', 'access-control-allow-origin': '*' } });
      } catch { return Response.json({ code: 'MAIL_POLICY_UNAVAILABLE' }, { status: 503 }); }
    }
    if (['/api/admin/mail-policy', '/api/admin/mail-access-list','/api/admin/mail-health','/api/admin/members'].includes(url.pathname)) {
      const { handleMailPolicyAdmin } = await import('./mail-policy-admin');
      return handleMailPolicyAdmin(request);
    }
    if (['/api/storage/mails','/api/storage/size'].includes(url.pathname) || /^\/api\/storage\/mails\/delete\/dmp(?::|%3[Aa])/.test(url.pathname)) {
      const {handleStorageAdmin}=await import('./storage-admin');
      return handleStorageAdmin(request);
    }
    // Unknown protocol versions have no API implementation.
    if (url.pathname.startsWith('/v2/')) return Response.json({ code: 'NOT_FOUND' }, { status: 404 });
    if (url.pathname === '/.well-known/didmail' || url.pathname.startsWith('/v1/')) {
      const { handleDmp } = await import('./dmp-api');
      const response = await handleDmp(request, context);
      const headers = new Headers(response.headers);
      headers.set('access-control-allow-origin', '*');
      headers.set('access-control-allow-methods', 'GET,PUT,POST,PATCH,DELETE,OPTIONS');
      headers.set('access-control-allow-headers', 'content-type,content-digest,dmp-identity,dmp-identity-key,signature-input,signature');
      headers.set('access-control-expose-headers', 'location,x-request-id,content-digest');
      headers.set('x-content-type-options', 'nosniff');
      return new Response(response.body, { status: response.status, headers });
    }
    if (platformRoute(url.pathname)) {
      if (!hasArc()) return Response.json({ message: 'ARC service binding unavailable' }, { status: 503 });
      // Keep the public host/path and raw multipart/binary bytes. ARC validates its own session.
      try {
        return await arcFetch(request);
      } catch {
        return Response.json({ message: 'ARC service unavailable' }, { status: 503 });
      }
    }
    if (url.pathname === '/runtime-config.js')
      return new Response(
        `window.blocklet=${JSON.stringify({ prefix: '/', CHAIN_ID: value('CHAIN_ID', 'beta'), mode: 'production', version: '0.1.0', appUrl: value('DIDMAIL_URL'), REVOKE_WAITING_PERIOD: nodeStakeWaitingPeriod(value('CHAIN_ID', 'beta')) }).replaceAll('<', '\\u003c')};`,
        { headers: { 'content-type': 'application/javascript', 'cache-control': 'no-store' } },
      );
    if (url.pathname === '/api/health') {
      try {
        await bindings.DB.prepare('SELECT 1').first();
        const { default: wallet } = await import('./wallet');
        return Response.json({
          status: 'ok',
          runtime: 'cloudflare-workers',
          storage: 'd1+r2',
          node: wallet().address,
          arc: hasArc(),
        });
      } catch {
        return Response.json({ status: 'unavailable', message: 'Worker bindings are incomplete' }, { status: 503 });
      }
    }
    if (/^\/api\/mail\/(?:send(?:\/sign)?|download(?:\/|$))/.test(url.pathname)) {
      return Response.json(
        {
          type: 'https://didmail.example/problems/protocol-retired',
          title: 'Legacy mail protocol retired',
          status: 410,
          code: 'PROTOCOL_RETIRED',
          detail: 'Use DIDMail Protocol 1 at /.well-known/didmail and /v1/.',
          requestId: crypto.randomUUID(),
          recoveryAction: 'upgrade_client',
        },
        { status: 410, headers: { 'cache-control': 'no-store' } },
      );
    }
    if (url.pathname.startsWith('/api/')) {
      try {
        const { default: handler } = await import('./app');
        const response=await handler.fetch!(request, bindings, context);
        return response;
      } catch (error) {
        console.error(error);
        return Response.json({ message: 'Worker initialization failed' }, { status: 503 });
      }
    }
    const target = new URL(request.url);
    // ARC's default favicon is the SVG logo; serve its real path/MIME in both UI modes.
    if (target.pathname === '/favicon.ico') target.pathname = '/logo.svg';
    const locales = localeConfig.languages.map(({ code }) => code);
    const segment = target.pathname.split('/')[1];
    const localePrefix = locales.includes(segment) ? `/${segment}` : '';
    const renderPrefix = localePrefix || `/${localeConfig.defaultLocale}`;
    const pagePath = localePrefix ? target.pathname.slice(localePrefix.length) || '/' : target.pathname;
    // Keep ARC's language cookie across bare home/admin bookmarks. Do not alter
    // APIs, assets, queries or unknown routes. Localized pages are real artifacts.
    if (
      !localePrefix &&
      (pagePath === '/' || /^\/help\/?$/.test(pagePath) || /^\/admin(?:\/(?:account|server|envelope|namecard|storage|attachment|members))?\/?$/.test(pagePath))
    ) {
      let preferred = '';
      try {
        preferred = decodeURIComponent(
          (request.headers.get('cookie') || '').match(/(?:^|;\s*)arc_lang=([^;]*)/)?.[1] || '',
        );
      } catch {}
      if (locales.includes(preferred) && preferred !== localeConfig.defaultLocale) {
        target.pathname = `/${preferred}${pagePath}`;
        return new Response(null, {
          status: 302,
          headers: { location: target.toString(), 'cache-control': 'no-store', vary: 'Cookie' },
        });
      }
    }
    // ARC beta.66 resolves named page IDs at one level; preserve public business URLs.
    const nativePage = /^\/admin\/(account|server|envelope|namecard|storage|attachment|members)\/?$/.exec(pagePath);
    if (nativePage) target.pathname = `${renderPrefix}/admin-${nativePage[1]}/`;
    else if (pagePath === '/admin' || pagePath === '/admin/') target.pathname = `${renderPrefix}/admin/`;
    else if (pagePath === '/help' || pagePath === '/help/') target.pathname = `${renderPrefix}/help/`;
    else if (localePrefix && pagePath === '/') target.pathname = `${localePrefix}/`;
    if (target.pathname === `/${localeConfig.defaultLocale}/`) target.pathname = '/';
    if (value('ARC_RENDER_UI') === 'true') {
      if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed', { status: 405 });
      try {
        const upstream = await arcFetch(new Request(target.toString(), request));
        // The same narrowly scoped adapter serves both built pages and live ARC
        // rendering. Otherwise a live render loses first-paint appearance and
        // reintroduces a light strip above the always-black brand scene.
        if (request.method === 'GET' && upstream.status === 200 &&
            ((/text\/html/i.test(upstream.headers.get('content-type') || '') &&
              (pagePath === '/' || /^\/(?:help|admin(?:\/(?:account|server|envelope|namecard|storage|attachment|members))?)\/?$/.test(pagePath))) ||
              /^\/(?:_arc\/assets\/[^/]+|aup-ssr\.[^/]+)\.js$/.test(target.pathname))) {
          const source = await upstream.text();
          const prepared = target.pathname.endsWith('.js')
            ? prepareNativeAppearanceScript(source)
            : prepareAppearanceHtml(source, brandCss);
          const headers = new Headers(upstream.headers);
          if (target.pathname.endsWith('.js')) headers.set('content-type', 'application/javascript');
          headers.delete('content-length');
          headers.delete('content-encoding');
          if (prepared !== source) headers.delete('etag');
          return new Response(prepared, { status: upstream.status, headers });
        }
        // ARC beta.66 defaults cached web assets to text/html; retain bytes and correct known asset MIME types.
        const types: Record<string, string> = {
          js: 'application/javascript',
          css: 'text/css',
          svg: 'image/svg+xml',
          png: 'image/png',
          webp: 'image/webp',
          ico: 'image/x-icon',
          woff: 'font/woff',
          woff2: 'font/woff2',
        };
        const extension = target.pathname.split('.').pop() || '';
        if (
          upstream.status === 200 &&
          types[extension] &&
          /^(\/assets\/|\/images\/|\/logo\.svg$|\/favicon\.ico$)/.test(target.pathname)
        ) {
          const headers = new Headers(upstream.headers);
          headers.set('content-type', types[extension]);
          return new Response(upstream.body, { status: upstream.status, headers });
        }
        return upstream;
      } catch {
        return Response.json({ message: 'ARC web service unavailable' }, { status: 503 });
      }
    }
    return bindings.ASSETS.fetch(new Request(target.toString(), request));
  },
  async scheduled(_event: ScheduledEvent, _env: unknown, context: ExecutionContext) {
    context.waitUntil(
      (async () => {
        const { deleteExpiredMailsWithAttachments } = await import('../api/src/libs/attachment-cleanup');
        console.log(await deleteExpiredMailsWithAttachments());
        const { processDmpJobs, cleanupDmp } = await import('./dmp-jobs');
        console.log(await processDmpJobs(), await cleanupDmp());
        await bindings.DB.prepare('DELETE FROM account_link_intents WHERE expires_at < ?').bind(new Date().toISOString()).run();
        await bindings.DB.prepare('DELETE FROM rate_limits WHERE resetAt < ?').bind(Date.now()).run();
      })(),
    );
  },
};
