import { readPageSession } from './node-header.js';
import { installThemeControl } from './theme.js';
import { installBrandMotion } from './brand-motion.js';
// ARC owns the header, menus, session and theme persistence. Localize only the
// public navigation/accessible labels; no duplicate header or custom toggles.
import { languages, messages, resolveLocale, localizedPath, localeDirection } from './locales.js';
const locale = resolveLocale(document.documentElement.lang);
document.documentElement.dir = localeDirection(locale);
const t = messages(locale);
installBrandMotion();
const header = document.querySelector('header.aup-app-header');
if (header) {
  installThemeControl(header, t);
  const strip = header.querySelector('.aup-app-header-strip-right');
  if (strip) {
    const help = document.createElement('a');
    help.className = 'aup-app-header-action dm-header-help';
    help.href = localizedPath('/help', locale);
    help.setAttribute('aria-label', t.help);
    help.title = t.help;
    help.dataset.iconOnly = 'true';
    help.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4M12 17h.01"/></svg>';
    if (document.querySelector('[data-didmail-help]')) help.setAttribute('aria-current', 'page');
    const admin = document.createElement('a');
    admin.className = 'aup-app-header-action dm-header-admin';
    admin.href = localizedPath('/admin', locale);
    admin.setAttribute('aria-label', t.admin);
    admin.title = t.admin;
    admin.dataset.iconOnly = 'true';
    admin.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>';
    if (document.querySelector('[data-didmail-admin]')) admin.setAttribute('aria-current', 'page');
    const user = strip.querySelector('[data-action-kind="user-menu"]');
    strip.insertBefore(help, user?.closest('.aup-app-header-user-menu') || user || null);
    strip.insertBefore(admin, user?.closest('.aup-app-header-user-menu') || user || null);
  }
  const brand = header.querySelector('.aup-app-header-brand-link');
  if (brand) brand.setAttribute('aria-label', t.brandHome);
  const labels = [
    ['[data-role="locale-switcher"] > button', t.language],
    ['.aup-app-header-user-menu-login', t.login],
  ];
  for (const [selector, label] of labels) {
    const button = header.querySelector(selector);
    if (button) {
      button.setAttribute('aria-label', label);
      button.title = label;
    }
  }
  // The SSR menu supplies native click handlers. Add standard dismissal/keyboard
  // behavior without replacing its locale cookie or navigation implementation.
  const picker = header.querySelector('[data-role="locale-switcher"]');
  if (picker) {
    const trigger = picker.querySelector('button');
    const menu = picker.querySelector('[role="menu"]');
    const options = [...menu.querySelectorAll('[role="menuitem"]')];
    options.forEach((option, index) => {
      const code = languages[index]?.code;
      if (code) option.lang = code;
      if (code === locale) option.setAttribute('aria-current', 'true');
    });
    const close = (focus = false) => {
      menu.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
      if (focus) trigger.focus();
    };
    document.addEventListener('click', (event) => {
      if (!picker.contains(event.target)) close();
    });
    picker.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        close(true);
        event.preventDefault();
      }
      if (event.key === 'Tab') {
        setTimeout(() => {
          if (!picker.contains(document.activeElement)) close();
        }, 0);
      }
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        menu.hidden = false;
        trigger.setAttribute('aria-expanded', 'true');
        const index = options.indexOf(document.activeElement);
        const next =
          event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? options.length - 1
              : index < 0
                ? event.key === 'ArrowUp'
                  ? options.length - 1
                  : 0
                : (index + (event.key === 'ArrowUp' ? -1 : 1) + options.length) % options.length;
        options[next]?.focus();
      }
    });
  }
}
// Retain the chosen locale when navigating between business pages. The API URLs
// remain unchanged; all data and authorization still use the same endpoints.
for (const a of document.querySelectorAll('.dm-tabs a')) {
  const path = new URL(a.href).pathname;
  if (path.startsWith('/admin/')) a.href = localizedPath(path, locale);
}

if (document.querySelector('[data-didmail-admin]')) void readPageSession().catch(() => {});

// Keep orientation in the long public guide; links and anchors remain native.
const guide = document.querySelector('[data-didmail-help]');
if (guide) {
  const contents = guide.querySelector('.dm-help-toc');
  if (matchMedia('(max-width: 760px)').matches) contents.open = false;
  const links = [...contents.querySelectorAll('a')];
  const sections = [...guide.querySelectorAll('article section')];
  const mark = (id) => {
    for (const link of links) {
      if (link.hash === '#' + id) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    }
  };
  mark(sections.find((section) => '#' + section.id === location.hash)?.id || sections[0]?.id);
  const visible = new Map();
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) visible.set(entry.target.id, entry.target);
      else visible.delete(entry.target.id);
    }
    const current = [...visible.values()].sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)[0];
    if (current) mark(current.id);
  }, { rootMargin: '-88px 0px -55% 0px' });
  sections.forEach((section) => observer.observe(section));
  window.addEventListener('pagehide', () => observer.disconnect(), { once: true });
}
