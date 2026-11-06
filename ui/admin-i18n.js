// Regression facade for the native Web Device component.
import '../blocklet/.web/components/didmail-chrome/script.js';
const module = globalThis.DIDMailNativeUI["admin-i18n.js"];
export const adminTranslator = module["adminTranslator"];
export const adminError = module["adminError"];
