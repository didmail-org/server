// Regression facade for the native Web Device component.
import '../blocklet/.web/components/didmail-chrome/script.js';
const module = globalThis.DIDMailNativeUI["identity.js"];
export const installIdentityUI = module["installIdentityUI"];
