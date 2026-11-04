// Serialized into the native head before paint; keep this controller self-contained.
export function themeBootstrap() {
  if (window.didmailTheme) return;
  const root = document.documentElement;
  const read = key => { try { return localStorage.getItem(key); } catch { return null; } };
  const valid = value => value === 'light' || value === 'dark';
  let current;
  const cookie = () => {
    try { return document.cookie.match(/(?:^|;\s*)arc_mode=(light|dark)(?=;|$)/)?.[1]; } catch { return null; }
  };
  const persist = () => {
    try { localStorage.setItem('web-mode', current); } catch { /* Retain session/cookie choice. */ }
    try { document.cookie = `arc_mode=${current};path=/;max-age=31536000;SameSite=Lax`; } catch { /* Retain session choice. */ }
  };
  const resolve = () => {
    const saved = read('web-mode');
    if (valid(saved)) return saved;
    if (saved === 'system' || saved === 'auto') {
      const applied = root.getAttribute('data-mode');
      current = valid(applied) ? applied : window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      persist();
      return current;
    }
    return cookie() || 'dark';
  };
  const preference = () => current;
  const apply = () => {
    root.setAttribute('data-mode', current);
    root.setAttribute('data-didmail-appearance', current);
    root.removeAttribute('data-theme');
    window.dispatchEvent(new CustomEvent('didmail-appearance-change', { detail: { choice: current, effective: current } }));
  };
  const choose = choice => {
    if (!valid(choice)) return;
    current = choice;
    persist();
    apply();
  };
  for (const [key, attribute] of [['web-tone', 'data-tone'], ['web-palette', 'data-palette']]) {
    const value = read(key);
    if (value) root.setAttribute(attribute, value);
  }
  current = resolve();
  window.didmailTheme = Object.freeze({ preference, choose, apply });
  window.addEventListener('storage', event => {
    if (event.key === 'web-mode' || event.key === null) {
      current = read('web-mode') === null ? 'dark' : resolve();
      apply();
    }
  });
  apply();
}

export function installThemeControl(header, labels) {
  const trigger = header.querySelector('[data-action-kind="theme-toggle"]');
  if (!trigger || trigger.dataset.appearanceReady) return;
  if (!window.didmailTheme) themeBootstrap();
  trigger.removeAttribute('onclick');
  trigger.onclick = null;
  trigger.removeAttribute('aria-haspopup');
  trigger.removeAttribute('aria-expanded');
  trigger.dataset.appearanceReady = 'true';
  const svg = path => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
  const icons = {
    light: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2m-3-9 1.4-1.4M3.6 20.4 5 19M5 5 3.6 3.6M19 19l1.4 1.4"/>'),
    dark: svg('<path d="M20.5 13A9 9 0 0 1 11 3.5 9 9 0 1 0 20.5 13Z"/>'),
  };
  const update = () => {
    const target = window.didmailTheme.preference() === 'dark' ? 'light' : 'dark';
    trigger.dataset.appearanceTarget = target;
    trigger.innerHTML = icons[target];
    trigger.setAttribute('aria-label', labels[target === 'dark' ? 'switchToDark' : 'switchToLight']);
    trigger.title = trigger.getAttribute('aria-label');
  };
  trigger.addEventListener('click', () => window.didmailTheme.choose(trigger.dataset.appearanceTarget));
  window.addEventListener('didmail-appearance-change', update);
  update();
}
