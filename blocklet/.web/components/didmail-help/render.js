// Native Web Device renderer source. ARC reads this file directly.
const languages = ['en', 'zh', 'ar', 'ja', 'ru'];
function resolveLocale(value) {
 const code = String(value || 'en').toLowerCase().split('-')[0];
 return languages.includes(code) ? code : 'en';
}
function localeDirection(locale) { return resolveLocale(locale) === 'ar' ? 'rtl' : 'ltr'; }
function localizedPath(path, locale) {
 const code=resolveLocale(locale);
 return code === 'en' ? path : '/' + code + (path === '/' ? '/' : path);
}
const e = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const escapeHtml = e;


// Small, deliberately bounded vocabulary for our checked-in operator guides.
// Raw HTML is never rendered; the only recognized HTML source is an anchor ID.
function inline(source, locale) {
  const tokens = /`([^`\n]+)`|\[([^\]\n]+)\]\(([^\s)]+)\)|\*\*([^*\n]+)\*\*/g;
  let html = '',
    at = 0;
  for (const match of source.matchAll(tokens)) {
    html += escapeHtml(source.slice(at, match.index));
    if (match[1]) html += `<code dir="ltr">${escapeHtml(match[1])}</code>`;
    else if (match[4]) html += `<strong>${escapeHtml(match[4])}</strong>`;
    else {
      const url = match[3];
      const safe = /^#[a-z0-9-]+$/.test(url) || /^\/(?:admin(?:\/[a-z-]+)?|help)(?:#[a-z0-9-]+)?$/.test(url);
      if (!safe) throw new Error(`Unsupported help link: ${url}`);
      html += `<a href="${escapeHtml(url.startsWith('/') ? localizedPath(url, locale) : url)}">${escapeHtml(match[2])}</a>`;
    }
    at = match.index + match[0].length;
  }
  return html + escapeHtml(source.slice(at));
}

export function compileHelp(markdown, locale = 'en') {
  const lines = markdown.replaceAll('\r\n', '\n').split('\n');
  const document = { title: '', intro: '', sections: [] };
  const ids = new Set();
  let section,
    anchor,
    paragraph = [],
    list,
    code;
  const append = (html) => {
    if (section) section.html += html;
    else document.intro += html;
  };
  const flush = () => {
    if (paragraph.length) {
      append(`<p>${inline(paragraph.join(' '), locale)}</p>`);
      paragraph = [];
    }
    if (list) {
      append(`</${list}>`);
      list = undefined;
    }
  };
  for (const line of lines) {
    if (code !== undefined) {
      if (line === '```') {
        append(`<pre dir="ltr"><code>${escapeHtml(code.join('\n'))}</code></pre>`);
        code = undefined;
      } else code.push(line);
      continue;
    }
    if (/^```(?:text|sh)?$/.test(line)) {
      flush();
      code = [];
      continue;
    }
    const target = /^<a id="([a-z][a-z0-9-]+)"><\/a>$/.exec(line);
    if (target) {
      flush();
      anchor = target[1];
      continue;
    }
    if (line.startsWith('# ')) {
      flush();
      if (document.title || section) throw new Error('Help guide must have exactly one leading title');
      document.title = line.slice(2);
      continue;
    }
    if (line.startsWith('## ')) {
      flush();
      if (!anchor || ids.has(anchor)) throw new Error('Missing or duplicate help section anchor');
      ids.add(anchor);
      section = { id: anchor, title: line.slice(3), html: '' };
      document.sections.push(section);
      anchor = undefined;
      continue;
    }
    if (!line.trim()) {
      flush();
      continue;
    }
    const item = /^(?:- |\d+\. )(.+)$/.exec(line);
    if (item) {
      const kind = line.startsWith('- ') ? 'ul' : 'ol';
      if (list !== kind) {
        flush();
        append(`<${kind}>`);
        list = kind;
      }
      append(`<li>${inline(item[1], locale)}</li>`);
      continue;
    }
    if (list) flush();
    paragraph.push(line);
  }
  flush();
  if (code !== undefined || anchor || !document.title || !document.sections.length)
    throw new Error('Incomplete help guide');
  return document;
}


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

export function render(ctx) {
 return renderHelp(ctx.t('didmailHelpMarkdown'), resolveLocale(ctx.props?.locale || ctx.locale));
}
