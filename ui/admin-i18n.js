import { resolveLocale } from './locales.js';
import zh from './locales/admin-zh.js';
import ar from './locales/admin-ar.js';
import ja from './locales/admin-ja.js';
import ru from './locales/admin-ru.js';
const dictionaries = { zh, ar, ja, ru };
// English source keys are the fallback; replacements run once, then the UI
// escapes at the HTML sink. Chain names, user input and payloads are not keys.
export function adminTranslator(locale) {
  const dictionary = dictionaries[resolveLocale(locale)] || {};
  const translate = (key, values = {}) =>
    String(Object.hasOwn(dictionary, key) ? dictionary[key] : key).replace(/\{(\w+)\}/g, (match, name) =>
      Object.hasOwn(values, name) ? String(values[name]) : match,
    );
  return Object.assign(translate, { locale: resolveLocale(locale) });
}
export function adminError(locale, error) {
  const t = adminTranslator(locale);
  const message = error?.message || String(error || 'Operation failed.');
  if (error?.diagnostic) {
    const detail = error.diagnostic;
    return t('Node balance unavailable ({code}; {stage}; {path}).', {
      code: [detail.code, detail.reason, detail.httpStatus].filter(Boolean).join(' / '),
      stage: t(detail.stage || 'chain'),
      path: detail.path || '/api/account/state',
    });
  }
  for (const [pattern, key, name] of [
    [/^Use at most (\d+) decimal places\.$/, 'Use at most {precision} decimal places.', 'precision'],
    [/^Invalid API response \((\d+)\)\.$/, 'Invalid API response ({status}).', 'status'],
    [/^Request failed \((\d+)\)\.$/, 'Request failed ({status}).', 'status'],
  ]) {
    const hit = message.match(pattern);
    if (hit) return t(key, { [name]: hit[1] });
  }
  return error?.name === 'TimeoutError' ? t('The operation was aborted due to timeout') : t(message);
}
