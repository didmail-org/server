// Regression facade for the native Web Device component.
import '../blocklet/.web/components/didmail-chrome/script.js';
const module = globalThis.DIDMailNativeUI["mail-policy.js"];
export const renderMailPolicy = module["renderMailPolicy"];
export const mountMailPolicy = module["mountMailPolicy"];
