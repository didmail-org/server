import { MailPolicyStore } from '../didmail-native/mail-policy.mjs';
import { recoverAdmissions } from '../didmail-native/recover.mjs';
import { AfsBusinessStore } from './store.mjs';
export async function recoverNativeAdmissions(root) {
  const policy=new MailPolicyStore(root),business=new AfsBusinessStore(root);
  await recoverAdmissions({read:async()=>(await policy.read()).state,
    revoke:(token,revision)=>business.transaction([{sql:'INSERT INTO didmail_admission_fences(token,policy_revision,open) VALUES(?,?,0) ON CONFLICT(token) DO UPDATE SET open=0',params:[token,revision]}]),
    release:token=>policy.changeAdmission(token,undefined,false),
  });
}
