// Regression facade for the native Web Device component.
import '../blocklet/.web/components/didmail-chrome/script.js';
const module = globalThis.DIDMailNativeUI["members.js"];
export const renderMembers = module["renderMembers"];
export const mountMembers = module["mountMembers"];
