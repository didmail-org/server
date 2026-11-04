import { escapeHtml as e } from './shared.js';
import { compileHelp } from './help-markdown.js';
import { localeDirection, localizedPath, resolveLocale } from './locales.js';

export const helpLabels = {
  en: {
    contents: 'On this page',
    home: 'Home',
    admin: 'Open administration',
    skip: 'Read the guide',
    back: 'Back to contents',
    languages: 'Guide language',
    note: 'English is the source; translations follow the same guide.',
  },
  zh: {
    contents: '本页目录',
    home: '首页',
    admin: '打开管理界面',
    skip: '阅读指南',
    back: '返回目录',
    languages: '指南语言',
    note: '英文为源文档，各语言译文保持相同章节。',
  },
  ja: {
    contents: 'このページの内容',
    home: 'ホーム',
    admin: '管理画面を開く',
    skip: 'ガイドを読む',
    back: '目次に戻る',
    languages: 'ガイドの言語',
    note: '英語が原文です。翻訳も同じ章構成です。',
  },
  ru: {
    contents: 'На этой странице',
    home: 'Главная',
    admin: 'Открыть управление',
    skip: 'Читать руководство',
    back: 'К оглавлению',
    languages: 'Язык руководства',
    note: 'Исходный текст — английский. Переводы сохраняют те же разделы.',
  },
  ar: {
    contents: 'في هذه الصفحة',
    home: 'الرئيسية',
    admin: 'فتح الإدارة',
    skip: 'قراءة الدليل',
    back: 'العودة إلى المحتويات',
    languages: 'لغة الدليل',
    note: 'الإنجليزية هي النص الأصلي، وتتبع الترجمات الأقسام نفسها.',
  },
};

export function renderHelp(markdown, requestedLocale) {
  const locale = resolveLocale(requestedLocale),
    labels = helpLabels[locale];
  const doc = compileHelp(markdown, locale);
  return {
    html: `<div class="dm-help" dir="${localeDirection(locale)}" data-didmail-help>
    <div class="dm-help-top"><a href="${localizedPath('/', locale)}">← ${e(labels.home)}</a><a href="${localizedPath('/admin', locale)}">${e(labels.admin)} →</a></div>
    <div class="dm-help-heading"><p class="dm-help-eyebrow">DIDMail Server</p><h1>${e(doc.title)}</h1>${doc.intro}<p class="dm-help-source">${e(labels.note)}</p></div>
    <a class="dm-help-skip" href="#guide">${e(labels.skip)}</a>
    <div class="dm-help-layout"><aside><details class="dm-help-toc" open id="contents"><summary>${e(labels.contents)}</summary><nav aria-label="${e(labels.contents)}">${doc.sections.map((s) => `<a href="#${s.id}">${e(s.title)}</a>`).join('')}</nav></details></aside>
    <article id="guide" tabindex="-1">${doc.sections.map((s) => `<section id="${s.id}" aria-labelledby="${s.id}-title"><h2 id="${s.id}-title">${e(s.title)}</h2>${s.html}<a class="dm-help-back" href="#contents">↑ ${e(labels.back)}</a></section>`).join('')}</article></div>
  </div>`,
  };
}
