// Regression facade for the native Web Device component.
import '../blocklet/.web/components/didmail-chrome/script.js';
const module = globalThis.DIDMailNativeUI["storage-list.js"];
export const storageStatus = module["storageStatus"];
export const storagePayment = module["storagePayment"];
export const storageFeeDetails = module["storageFeeDetails"];
export const renderStorageTable = module["renderStorageTable"];
