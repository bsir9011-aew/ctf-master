import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,chmodSync,copyFileSync,statSync,rmSync,symlinkSync,unlinkSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';

const repo=resolve(new URL('..',import.meta.url).pathname);
const setup=join(repo,'labs/real-linux/setup.mjs');
const verify=join(repo,'labs/real-linux/verify.mjs');
const run=(script,parent)=>{
  const r=spawnSync(process.execPath,[script],{
    cwd:repo,encoding:'utf8',env:{...process.env,CTF_LAB_PARENT:parent}
  });
  if(r.error)throw r.error;
  return {status:r.status,output:r.stdout+ r.stderr};
};
const isolated=(fn)=>{
  const parent=mkdtempSync(join(tmpdir(),'ctf-master-real-'));
  try{return fn(parent,join(parent,'.ctf-master-labs/permissions-01'));}
  finally{rmSync(parent,{recursive:true,force:true});}
};
test('safe real-world setup is idempotent and verifier requires actual repair and copy',()=>{
  isolated((parent,root)=>{
    const baseline=join(parent,'unrelated.txt');
    writeFileSync(baseline,'KEEP');
    const first=run(setup,parent);
    assert.equal(first.status,0,first.output);
    assert.match(first.output,/Real Linux lab created/);
    assert.equal(statSync(join(root,'archive')).mode&0o777,0o600);
    const pre=run(verify,parent);
    assert.equal(pre.status,1,pre.output);
    assert.match(pre.output,/NOT YET/);
    chmodSync(join(root,'archive'),0o700);
    assert.equal(statSync(join(root,'archive/audit.log')).mode&0o777,0o644);
    copyFileSync(join(root,'archive/audit.log'),join(root,'delivered/evidence.log'));
    chmodSync(join(root,'delivered/evidence.log'),0o644);
    const fixed=run(verify,parent);
    assert.equal(fixed.status,0,fixed.output);
    assert.match(fixed.output,/RESULT: 6\/6/);
    assert.match(fixed.output,/outcomes, not your diagnosis/);
    const again=run(setup,parent);
    assert.equal(again.status,0,again.output);
    assert.match(again.output,/Existing lab preserved/);
    assert.equal(statSync(join(root,'archive')).mode&0o777,0o700);
    assert.equal(readFileSync(baseline,'utf8'),'KEEP');
  });
});
test('over-broad chmod, changed source, altered copy and symlinked copy are rejected',()=>{
  isolated((parent,root)=>{
    assert.equal(run(setup,parent).status,0);
    chmodSync(join(root,'archive'),0o777);
    copyFileSync(join(root,'archive/audit.log'),join(root,'delivered/evidence.log'));
    chmodSync(join(root,'delivered/evidence.log'),0o644);
    assert.equal(run(verify,parent).status,1,'chmod 777 must not pass');
    chmodSync(join(root,'archive'),0o700);
    assert.equal(run(verify,parent).status,0);
    writeFileSync(join(root,'archive/audit.log'),'forged');
    assert.equal(run(verify,parent).status,1);
    writeFileSync(join(root,'archive/audit.log'),readFileSync(join(root,'delivered/evidence.log')));
    assert.equal(run(verify,parent).status,0);
    writeFileSync(join(root,'delivered/evidence.log'),'fake copy');
    assert.equal(run(verify,parent).status,1);
    unlinkSync(join(root,'delivered/evidence.log'));
    symlinkSync(join(root,'archive/audit.log'),join(root,'delivered/evidence.log'));
    assert.equal(run(verify,parent).status,1,'symlink is not a preserved copy');
  });
});
test('setup refuses unmarked existing folder and never overwrites it',()=>{
  isolated((parent,root)=>{
    mkdirSync(root,{recursive:true});
    writeFileSync(join(root,'personal.txt'),'important');
    const r=run(setup,parent);
    assert.equal(r.status,1);
    assert.match(r.output,/without a valid marker/);
    assert.equal(readFileSync(join(root,'personal.txt'),'utf8'),'important');
  });
});
test('without setup verifier is safe and reports not initialized',()=>{
  isolated((parent)=>{
    const r=run(verify,parent);
    assert.equal(r.status,2);
    assert.match(r.output,/not initialized/);
  });
});
