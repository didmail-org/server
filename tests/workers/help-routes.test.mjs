import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { fromRandom } from '@ocap/wallet';

for (const native of [false, true])
  test(`public help routes preserve locale, anchor path and query (${native ? 'ARC' : 'Assets'})`, async () => {
    const node = fromRandom();
    const mf = new Miniflare(
      convertV4MiniflareOptions({
        workers: [
          {
            name: 'app',
            modules: true,
            scriptPath: '.worker/test.mjs',
            compatibilityDate: '2026-10-24',
            compatibilityFlags: ['nodejs_compat'],
            bindings: {
              NODE_SECRET_KEY: node.secretKey,
              DIDMAIL_URL: 'https://help.test',
              ARC_RENDER_UI: String(native),
            },
            serviceBindings: { ARC: 'pages', ASSETS: 'pages' },
            outboundService: 'deny',
          },
          {
            name: 'pages',
            modules: true,
            compatibilityDate: '2026-10-24',
            script: `export default{fetch(r){const u=new URL(r.url);return Response.json({path:u.pathname,query:u.search},{headers:{'x-page-path':u.pathname}})}}`,
          },
          {
            name: 'deny',
            modules: true,
            compatibilityDate: '2026-10-24',
            script: `export default{fetch(){throw Error('Help must not call a chain or external service')}}`,
          },
        ],
      }),
    );
    try {
      for (const locale of ['en', 'zh', 'ar', 'ja', 'ru']) {
        const path = locale === 'en' ? '/help' : `/${locale}/help`;
        const r = await mf.dispatchFetch('https://help.test' + path + '?from=guide');
        assert.equal(r.status, 200);
        assert.deepEqual(await r.json(), { path: `/${locale}/help/`, query: '?from=guide' });
      }
      const preferred = await mf.dispatchFetch('https://help.test/help?from=bookmark', {
        redirect: 'manual',
        headers: { cookie: 'arc_lang=ar' },
      });
      assert.equal(preferred.status, 302);
      assert.equal(preferred.headers.get('location'), 'https://help.test/ar/help?from=bookmark');
      const head = await mf.dispatchFetch('https://help.test/ja/help', { method: 'HEAD' });
      assert.equal(head.status, 200);
      assert.equal(head.headers.get('x-page-path'), '/ja/help/');
      const unknown = await mf.dispatchFetch('https://help.test/help/missing', { headers: { cookie: 'arc_lang=zh' } });
      assert.equal((await unknown.json()).path, '/help/missing');
      const asset = await mf.dispatchFetch('https://help.test/logo.svg', { headers: { cookie: 'arc_lang=ru' } });
      assert.equal((await asset.json()).path, '/logo.svg');
      if (native) assert.equal((await mf.dispatchFetch('https://help.test/help', { method: 'POST' })).status, 405);
    } finally {
      await mf.dispose();
    }
  });
