// Shared by static ARC builds and dynamically rendered ARC responses.
import { themeBootstrap } from './theme.js';
import { prepareBrandMotion } from './brand-motion.js';

export function prepareNativeAppearanceScript(source) {
  if (source.includes('/* didmail-native-appearance */')) return source;
  if (!source.includes('var _tones=') || !source.includes('var _pals=')) return source;
  const initial = 'var curTone=localStorage.getItem("web-tone")||el.getAttribute("data-tone")||"editorial";';
  const palette = 'var curPalette=localStorage.getItem("web-palette")||el.getAttribute("data-palette")||"neutral";';
  const mode = 'var curMode=localStorage.getItem("web-mode")||el.getAttribute("data-mode")||"dark";';
  const apply = 'el.setAttribute("data-mode",curMode);';
  const toggle = 'curMode=curMode==="dark"?"light":"dark";localStorage.setItem("web-mode",curMode);apply();';
  for (const expected of [initial, palette, mode, apply, toggle]) {
    if (source.split(expected).length !== 2) throw new Error('ARC native appearance initializer changed; review its DIDMail adapter.');
  }
  return source
    .replace(initial, '/* didmail-native-appearance */ function appearanceValue(key){try{return localStorage.getItem(key)}catch(_){return null}}\n  var curTone=appearanceValue("web-tone")||el.getAttribute("data-tone")||"editorial";')
    .replace(palette, 'var curPalette=appearanceValue("web-palette")||el.getAttribute("data-palette")||"neutral";')
    .replace(mode, 'var curMode=window.didmailTheme?el.getAttribute("data-mode"):(appearanceValue("web-mode")||el.getAttribute("data-mode")||"dark");')
    .replace(apply, 'if(window.didmailTheme)window.didmailTheme.apply();else el.setAttribute("data-mode",curMode);')
    .replace(toggle, 'curMode=el.getAttribute("data-mode")==="dark"?"light":"dark";if(window.didmailTheme)window.didmailTheme.choose(curMode);else{try{localStorage.setItem("web-mode",curMode)}catch(_){}}apply();');
}

export function prepareAppearanceHtml(source, css) {
  if (!/class="dm-home"|data-didmail-admin|data-didmail-help/.test(source)) return source;
  if (source.includes('id="didmail-appearance-bootstrap"')) return source;
  if (!/<html\b[^>]*data-aup-mode="system"/.test(source)) throw new Error('DIDMail requires ARC system appearance metadata.');
  const scripts = [...source.matchAll(/<script>([\s\S]*?)<\/script>/g)].filter((match) =>
    match[1].includes("localStorage.getItem('web-mode')") && match[1].includes("localStorage.getItem('web-tone')"));
  if (scripts.length !== 1 || !scripts[0][1].includes("localStorage.removeItem('web-mode')") ||
      !scripts[0][1].includes('arc_mode=(light|dark)')) {
    throw new Error('ARC appearance prelude changed; review the DIDMail appearance adapter before building.');
  }
  const motion = /class="dm-home"/.test(source)
    ? `<style id="didmail-brand-motion-initial">[data-didmail-brand-entrance="pending"] .dm-home-emblem{opacity:0;transform:scale(.76)}@media(prefers-reduced-motion:reduce){[data-didmail-brand-entrance="pending"] .dm-home-emblem{opacity:1;transform:none}}</style><script id="didmail-brand-motion-bootstrap">(${prepareBrandMotion.toString()})();</script>`
    : '';
  const bootstrap = `<style id="didmail-brand-theme">${css}</style><script id="didmail-appearance-bootstrap">(${themeBootstrap.toString()})();</script>${motion}`;
  return source.replace(scripts[0][0], bootstrap).replace(/<html\b[^>]*>/, (tag) =>
    tag.replace(/^<html\b/, '<html data-didmail-ui').replace(/ data-mode="(?:light|dark)"/, ''));
}
