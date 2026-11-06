// Regression facade for the native Web Device component.
import '../blocklet/.web/components/didmail-chrome/script.js';
const module = globalThis.DIDMailNativeUI["locales.js"];
export const languages = module["languages"];
export const defaultLocale = module["defaultLocale"];
export const resolveLocale = module["resolveLocale"];
export const messages = module["messages"];
export const localeDirection = module["localeDirection"];
export const localizedPath = module["localizedPath"];
