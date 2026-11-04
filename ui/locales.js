import config from './locales/config.js';
import en from './locales/en.js';
import zh from './locales/zh.js';
import ar from './locales/ar.js';
import ja from './locales/ja.js';
import ru from './locales/ru.js';
const dictionaries = { en, zh, ar, ja, ru };
export const languages = config.languages;
export const defaultLocale = config.defaultLocale;
export function resolveLocale(value) {
  const locale = String(value || '').toLowerCase();
  return (
    languages.find(({ code }) => code.toLowerCase() === locale)?.code ||
    languages.find(({ code }) => code.toLowerCase() === locale.split('-')[0])?.code ||
    defaultLocale
  );
}
export function messages(locale) {
  return { ...en, ...dictionaries[resolveLocale(locale)] };
}
export function localeDirection(locale) {
  return resolveLocale(locale) === 'ar' ? 'rtl' : 'ltr';
}
export function localizedPath(path, locale) {
  const language = resolveLocale(locale);
  return language === defaultLocale ? path : `/${language}${path === '/' ? '/' : path}`;
}
