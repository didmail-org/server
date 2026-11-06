import { MailPolicyStore, requireAdmin } from '../didmail-native/mail-policy.mjs';
export function createPolicyOperations(root) {
  const store=new MailPolicyStore(root);
  return async body=>{
    if(body.op==='read')return (await store.read()).state;
    if(body.op==='begin'){await store.changeAdmission(body.token,body.revision,true);return null;}
    if(body.op==='end'){await store.changeAdmission(body.token,undefined,false);return null;}
    if(body.op==='edit')return store.edit(body.args,body.actor);
    if(body.op==='list'){requireAdmin(body.actor);return store.list(body.args);}
    throw Object.assign(new Error('Unsupported private policy operation'),{code:'AFS_FORBIDDEN',status:403});
  };
}
