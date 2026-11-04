import test from 'node:test';
import assert from 'node:assert/strict';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { fromRandom } from '@ocap/wallet';

const prelude = `<script>(function(){var t=localStorage.getItem('web-tone'),m=localStorage.getItem('web-mode');if(!/arc_mode=(light|dark)/.test(document.cookie))localStorage.removeItem('web-mode')})()</script>`;
const home = `<html lang="en" data-mode="light" data-aup-mode="system"><head>${prelude}</head><body><header class="aup-app-header">Native header</header><main class="dm-home"><div class="dm-home-emblem">Original dove</div></main></body></html>`;
const nativeScript = `(function(){var _tones=[];var _pals=[];var el=document.documentElement;
var curTone=localStorage.getItem("web-tone")||el.getAttribute("data-tone")||"editorial";
var curPalette=localStorage.getItem("web-palette")||el.getAttribute("data-palette")||"neutral";
var curMode=localStorage.getItem("web-mode")||el.getAttribute("data-mode")||"dark";
function apply(){el.setAttribute("data-mode",curMode);}
function toggle(){curMode=curMode==="dark"?"light":"dark";localStorage.setItem("web-mode",curMode);apply();}
})();`;

test('live ARC uses the same brand first paint and preference adapter as static pages', async () => {
  const mf = new Miniflare(convertV4MiniflareOptions({ workers: [
    { name: 'app', modules: true, scriptPath: '.worker/test.mjs', compatibilityDate: '2026-10-24', compatibilityFlags: ['nodejs_compat'], bindings: { NODE_SECRET_KEY: fromRandom().secretKey, ARC_RENDER_UI: 'true', DIDMAIL_URL: 'https://brand.test' }, serviceBindings: { ARC: 'pages', ASSETS: 'pages' }, outboundService: 'deny' },
    { name: 'pages', modules: true, script: `export default{fetch(r){const p=new URL(r.url).pathname;let body=${JSON.stringify(home)};if(p.endsWith('.js'))body=${JSON.stringify(nativeScript)};if(p.endsWith('.css'))body='body{color:inherit}';if(p==='/foreign')body='<html><body>Other ARC page</body></html>';return new Response(body,{headers:{'content-type':'text/html','etag':'upstream-tag'}})}}` },
    { name: 'deny', modules: true, script: `export default{fetch(){throw Error('No external network in appearance acceptance')}}` },
  ] }));
  try {
    const response = await mf.dispatchFetch('https://brand.test/');
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /<html data-didmail-ui /);
    assert.match(html, /id="didmail-appearance-bootstrap"/);
    assert.match(html, /id="didmail-brand-motion-bootstrap"/);
    assert.match(html, /transform:scale\(\.76\)/);
    assert.match(html, /--dm-background/);
    assert.doesNotMatch(html, /localStorage.removeItem\('web-mode'\)/);
    assert.ok(html.indexOf('didmail-brand-motion-bootstrap') < html.indexOf('<body>'));
    assert.equal(response.headers.get('etag'), null);
    const js = await mf.dispatchFetch('https://brand.test/_arc/assets/native.js');
    assert.equal(js.headers.get('content-type'), 'application/javascript');
    assert.match(await js.text(), /didmail-native-appearance/);
    const liveRuntime = await mf.dispatchFetch('https://brand.test/aup-ssr.native.js');
    assert.match(await liveRuntime.text(), /didmail-native-appearance/);
    const css = await mf.dispatchFetch('https://brand.test/assets/original.css');
    assert.equal(css.headers.get('content-type'), 'text/css');
    assert.equal(await css.text(), 'body{color:inherit}');
    const other = await mf.dispatchFetch('https://brand.test/foreign');
    assert.equal(await other.text(), '<html><body>Other ARC page</body></html>');
    assert.equal(other.headers.get('etag'), 'upstream-tag');
    assert.equal((await mf.dispatchFetch('https://brand.test/', { method: 'HEAD' })).status, 200);
  } finally { await mf.dispose(); }
});
