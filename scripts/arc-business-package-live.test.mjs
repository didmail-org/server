import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createNativeStorageBinding, nativeStorageOperation, localBusinessRoot } from './arc-storage-bridge.mjs';
import { runtimePath } from '../blocklet/providers/didmail-business/paths.mjs';
import { localPolicyRoot } from './arc-mail-policy-bridge.mjs';
import { MailPolicyStore } from '../blocklet/providers/didmail-native/mail-policy.mjs';

test('built native business package executes SQL/objects in ARC without repository scripts or dependencies', {skip:process.env.DIDMAIL_ARC_PROVIDER_TEST!=='1',timeout:120000},async()=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'didmail-native-business-')),app=directory+'/app',instance='didmail-native-business-'+randomUUID();
  const run=promisify(execFile),arc=(...args)=>run('arc',args,{timeout:45000,maxBuffer:2*1024*1024,env:{...process.env,AFS_TEST_ALLOW_CALLER_HEADER:'1'}});let started=false;
  try{
    await fs.mkdir(app+'/providers',{recursive:true});
    for(const name of ['didmail-business','didmail-native'])await fs.cp('blocklet/providers/'+name,app+'/providers/'+name,{recursive:true});
    await fs.writeFile(app+'/package.json','{"type":"module","private":true}');
    await fs.writeFile(app+'/blocklet.yaml','specVersion: 2\nid: didmail-server\nname: DIDMail Native Business Evidence\ndid: did:blocklet:didmail-server\nversion: 0.1.0\nscope: app\ninstance:\n  required: true\nmounts:\n  - target: ./providers/didmail-business\n    path: /didmail-business\n    required: true\n    ops: [list,read,stat,exec,explain]\n  - target: ./providers/didmail-native\n    path: /didmail-native\n    required: true\n    ops: [list,read,stat,exec,explain]\n');
    await arc('blocklet','check',app);await arc('blocklet','build',app);
    // Nothing outside the immutable dist tree participates in provider loading.
    await fs.rm(app+'/providers',{recursive:true});
    started=true;const launched=await arc('service','start','--instance',instance,'--home',directory+'/home','--blocklet',app+'/dist','--port','0','--purpose','evidence','--no-advertise','--print','port');const port=Number(launched.stdout.trim().split('\n').at(-1)),origin='http://127.0.0.1:'+port;
    const binding=createNativeStorageBinding(origin),call=input=>nativeStorageOperation(binding,input);
    // Native health lazily activates the package, but never creates business data.
    await assert.rejects(call({op:'transaction',statements:[{sql:'SELECT 1'}]}));
    const rpc=async(body,headers={})=>{
      const response=await fetch(origin+'/api/afs/rpc?blocklet=didmail-server',{method:'POST',headers:{host:'didmail-server.localhost:'+port,'content-type':'application/json',...headers},body:JSON.stringify(body)});return response.json();
    };
    for(const role of ['guest','member'])assert.notEqual((await rpc({type:'exec',path:'/didmail-business/.actions/initialize-business',args:{}},{'x-caller-role':role,'x-caller-did':'did:test:native'})).ok,true);
    const initialized=await rpc({type:'exec',path:'/didmail-business/.actions/initialize-business',args:{}},{'x-caller-role':'admin','x-caller-did':'did:test:native'});assert.equal(initialized.ok,true,JSON.stringify(initialized));
    assert.notEqual((await rpc({type:'exec',path:'/didmail-business/.actions/initialize-business',args:{}},{'x-caller-role':'admin','x-caller-did':'did:test:native'})).ok,true);
    const descriptor=JSON.parse((await localBusinessRoot(origin).read(runtimePath)).data.content);
    const status=JSON.parse((await arc('service','status','--instance',instance,'--json')).stdout);
    assert.equal(descriptor.pid,status.pid,'engine listener belongs to the ARC process');
    assert.equal((await fetch('http://127.0.0.1:'+descriptor.port+'/storage',{method:'POST',body:'{}'})).status,403);
    assert.equal((await fetch('http://127.0.0.1:'+descriptor.port+'/storage',{method:'POST',headers:{authorization:'Bearer '+descriptor.token,origin:'https://attacker.invalid'},body:'{}'})).status,403);
    assert.notEqual((await rpc({type:'read',path:runtimePath})).ok,true);
    const health=JSON.parse((await rpc({type:'read',path:'/didmail-business/health.json'})).data.content);
    assert.equal(health.protocolIngress,false);for(const field of ['token','port','pid','tables','rows'])assert.equal(field in health,false);
    await call({op:'transaction',statements:[{sql:'CREATE TABLE native_fixture(id INTEGER PRIMARY KEY, value TEXT UNIQUE, fence INTEGER DEFAULT 0)'},{sql:"INSERT INTO native_fixture VALUES(1,'original',0)"}]});
    await assert.rejects(call({op:'transaction',statements:[{sql:"UPDATE native_fixture SET value='rolled-back' WHERE id=1"},{sql:"INSERT INTO native_fixture(id,value) VALUES(2,'rolled-back')"}]}));
    assert.equal((await call({op:'transaction',statements:[{sql:'SELECT value FROM native_fixture'}]}))[0].results[0].value,'original');
    const peer=createNativeStorageBinding(origin);
    await Promise.all(Array.from({length:8},(_,i)=>nativeStorageOperation(i%2?peer:binding,{op:'transaction',statements:[{sql:'UPDATE native_fixture SET fence=fence+1 WHERE id=1'}]})));
    assert.equal((await call({op:'transaction',statements:[{sql:'SELECT fence FROM native_fixture'}]}))[0].results[0].fence,8);
    const forbidden=directory+'/forbidden.sqlite';await assert.rejects(call({op:'transaction',statements:[{sql:`ATTACH DATABASE '${forbidden}' AS stolen`}]}));await assert.rejects(fs.stat(forbidden),{code:'ENOENT'});
    const bytes=Buffer.alloc(1100000);for(let i=0;i<bytes.length;i++)bytes[i]=i%251;
    await call({op:'put',key:'fixture/ciphertext',bytes:bytes.toString('base64'),httpMetadata:{contentType:'application/octet-stream'}});
    assert.ok(Buffer.from((await call({op:'get',key:'fixture/ciphertext'})).bytes,'base64').equals(bytes));
    const admin={'x-caller-role':'admin','x-caller-did':'did:test:native'};
    assert.equal((await rpc({type:'exec',path:'/didmail-native/.actions/initialize-mail-policy',args:{expectedVersion:'!absent'}},admin)).ok,true);
    const token=randomUUID();await call({op:'policy',operation:{op:'begin',token,revision:1}});
    await call({op:'transaction',statements:[{sql:'INSERT INTO didmail_admission_fences VALUES(?,?,1)',params:[token,1]}]});
    const policy=new MailPolicyStore(localPolicyRoot(origin)),pending=await policy.read();pending.state.admissions[token].startedAt=new Date(Date.now()-61000).toISOString();await policy.write(pending.state,pending.version);
    const deadline=Date.now()+18000;while(Object.keys((await policy.read()).state.admissions).length&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,250));
    assert.equal(Object.keys((await policy.read()).state.admissions).length,0,'ARC timer recovers admission without any business Worker');
    assert.equal((await call({op:'transaction',statements:[{sql:'SELECT open FROM didmail_admission_fences WHERE token=?',params:[token]}]}))[0].results[0].open,0);
    await arc('service','restart','--instance',instance,'--json');
    assert.equal((await call({op:'transaction',statements:[{sql:'SELECT fence FROM native_fixture'}]}))[0].results[0].fence,8);
    assert.ok(Buffer.from((await call({op:'get',key:'fixture/ciphertext'})).bytes,'base64').equals(bytes));
    const refreshed=JSON.parse((await localBusinessRoot(origin).read(runtimePath)).data.content);assert.notEqual(refreshed.pid,descriptor.pid);assert.notEqual(refreshed.token,descriptor.token);
  }finally{if(started)await arc('service','delete','--instance',instance,'--force','--yes');await fs.rm(directory,{recursive:true,force:true});}
});
