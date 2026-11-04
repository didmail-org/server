import { escapeHtml } from './shared.js';
import { localizedPath } from './locales.js';

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
