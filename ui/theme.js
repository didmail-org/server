// Regression facade for the native Web Device component.
import '../blocklet/.web/components/didmail-chrome/script.js';
const module = globalThis.DIDMailNativeUI["theme.js"];
export const themeBootstrap = module["themeBootstrap"];
export const installThemeControl = module["installThemeControl"];
