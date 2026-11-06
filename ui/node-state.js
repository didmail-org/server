// Regression facade for the native Web Device component.
import '../blocklet/.web/components/didmail-chrome/script.js';
const module = globalThis.DIDMailNativeUI["node-state.js"];
export const NODE_CACHE_KEY = module["NODE_CACHE_KEY"];
export const NODE_STALE_TIME = module["NODE_STALE_TIME"];
export const scopeFor = module["scopeFor"];
export const clearNodeSnapshot = module["clearNodeSnapshot"];
export const createNodeStore = module["createNodeStore"];
export const nodeStore = module["nodeStore"];
export const closeNodeStore = module["closeNodeStore"];
