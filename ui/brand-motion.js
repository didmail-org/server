// Regression facade for the native Web Device component.
import '../blocklet/.web/components/didmail-chrome/script.js';
const module = globalThis.DIDMailNativeUI["brand-motion.js"];
export const prepareBrandMotion = module["prepareBrandMotion"];
export const installBrandMotion = module["installBrandMotion"];
