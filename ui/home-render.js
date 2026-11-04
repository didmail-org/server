import heroLogo from '../public/images/dove.svg';
import { messages, resolveLocale, localeDirection, localizedPath } from './locales.js';
import { escapeHtml as e } from './shared.js';
export function render(ctx = {}) {
  const locale = resolveLocale(ctx.props?.locale || ctx.locale);
  const t = messages(locale);
  const icon = (paths) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
  const features = [
    [
      icon('<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>'),
      t.encryptionTitle,
      t.encryptionDescription,
      `<a href="https://www.arcblock.io/content/collections/en/did">${e(t.didLink)} →</a> <a href="https://en.wikipedia.org/wiki/Curve25519">Curve25519 →</a>`,
    ],
    [
      icon('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><path d="M17 3v7h4M3 17h7v4M10 6h7M6 10v7M10 17h4M17 10v4"/>'),
      t.networkTitle,
      t.networkDescription,
      `<a href="https://www.arcblock.io/en/docs/blocklets/">${e(t.blockletsLink)} →</a>`,
    ],
    [icon('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>'), t.envelopesTitle, t.envelopesDescription, ''],
  ];
  const extension = 'https://chromewebstore.google.com/detail/didmail/iaohpoefeikknejigaaifnajlbkdhlhi';
  return {
    html: `<div class="dm-home" dir="${localeDirection(locale)}"><section class="dm-home-hero"><div class="dm-home-light" aria-hidden="true"></div><div class="dm-home-hero-inner"><div class="dm-home-brand"><div class="dm-home-emblem"><img src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(heroLogo)}" alt="${e(t.logo)}" width="520" height="520"></div><h1>DIDMail</h1></div><div class="dm-home-hero-copy"><p>${e(t.intro)}</p><div class="dm-home-tagline">${e(t.tagline)}</div><div class="dm-home-actions"><a href="${extension}" target="_blank" rel="noopener noreferrer">${e(t.extension)} ↗</a><a href="https://www.arcblock.io/en/docs/arc-cli/install/" target="_blank" rel="noopener noreferrer">${e(t.runNode)}</a></div></div></div></section>
    <section class="dm-home-features">${features.map(([icon, title, text, links]) => `<article><span aria-hidden="true">${icon}</span><h2>${e(title)}</h2><p>${e(text)}</p><div>${links}</div></article>`).join('')}</section></div><footer class="dm-home-footer" dir="${localeDirection(locale)}">${e(t.footer)} · <a href="${localizedPath('/help', locale)}">${e(t.help)}</a> <span class="dm-home-version">· v0.1.0</span></footer>`,
  };
}
