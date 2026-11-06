// Regression facade for the native Web Device component.
import '../blocklet/.web/components/didmail-chrome/script.js';
const module = globalThis.DIDMailNativeUI["member-access.js"];
export const renderMemberAccess = module["renderMemberAccess"];
