import test from 'node:test';
import assert from 'node:assert/strict';
import {executeLinux,initialLinux} from '../src/core/linux.ts';
import {modeOf,ownerOf} from '../src/core/permissions.ts';
import {createAcademyState,academySubmit,restoreAcademyProgress} from '../src/core/commandAcademy.ts';
import {createTransferState,submitTransfer,transferMistake,earnedMastery} from '../src/core/academyTransfer.ts';
import {shareCase,shareCompleted} from '../src/core/chgrp.ts';

const i=shareCase('intro'),t=shareCase('transfer');
const run=(state,command)=>executeLinux(state,command);

test('chgrp changes only group ID on owned file, not UID, mode or data',()=>{
  const state=createAcademyState(),snapshot=structuredClone(state);
  assert.deepEqual(ownerOf(state,i.path),{uid:1000,gid:1000});
  const r=run(state,'chgrp operators ~/practice/shared-report.log');
  assert.equal(r.ok,true);
  assert.equal(r.command,'chgrp');
  assert.equal(r.target,i.path);
  assert.deepEqual(ownerOf(r.state,i.path),{uid:1000,gid:1100});
  assert.equal(modeOf(r.state,i.path),0o640);
  assert.equal(r.state.files[i.path],i.content);
  assert.deepEqual(state,snapshot);
  assert.match(run(r.state,'stat ~/practice/shared-report.log').output,/group operators \(gid=1100\)/);
  assert.match(run(r.state,'ls -l ~/practice/shared-report.log').output,/player operators/);
});

test('chgrp refuses changing a file that belongs to a different UID',()=>{
  const seed=createAcademyState(),before=structuredClone(seed);
  const r=run(seed,'chgrp operators ~/practice/operator.log');
  assert.equal(r.ok,false);
  assert.match(r.output,/not file owner/);
  assert.deepEqual(r.state,before);
  assert.deepEqual(seed,before);
});

test('owner can assign only groups of which they are a member',()=>{
  const seed=createAcademyState();
  for(const name of ['audit','security','root','unknown','1100']){
    const result=run(seed,'chgrp '+name+' ~/practice/shared-report.log');
    assert.equal(result.ok,false,name);
    assert.deepEqual(result.state,seed,name);
  }
  assert.equal(run(seed,'chgrp player ~/practice/shared-report.log').ok,true);
});

test('missing targets, syntax errors and traversal restrictions are rejected',()=>{
  const seed=createAcademyState();
  for(const cmd of [
    'chgrp', 'chgrp operators', 'chgrp operators a b',
    'chgrp -R operators ~/practice', 'chgrp operators ~/practice/missing.log'
  ])assert.equal(run(seed,cmd).ok,false,cmd);
  const blocked=run(seed,'chmod 600 ~/practice');
  assert.equal(blocked.ok,true);
  const denied=run(blocked.state,'chgrp operators ~/practice/shared-report.log');
  assert.equal(denied.ok,false);
  assert.match(denied.output,/Permission denied/);
});

test('directory ownership can be changed without changing descendants',()=>{
  const seed=createAcademyState();
  const before=ownerOf(seed,i.path);
  const changed=run(seed,'chgrp operators ~/practice/logs');
  assert.equal(changed.ok,true);
  assert.equal(ownerOf(changed.state,'/home/player/practice/logs').gid,1100);
  assert.deepEqual(ownerOf(changed.state,i.path),before);
  assert.equal(modeOf(changed.state,'/home/player/practice/logs'),0o755);
});

test('different effective group membership changes ability to read a file',()=>{
  const seed=createAcademyState();
  const changed=run(seed,'chgrp operators ~/practice/shared-report.log');
  assert.equal(changed.ok,true);
  const observer={
    uid:1001,user:'auditor',
    primary:{gid:1200,name:'audit'},
    supplementary:[{gid:1100,name:'operators'}]
  };
  const before={...seed,identity:observer};
  const after={...changed.state,identity:observer};
  assert.equal(run(before,'cat ~/practice/shared-report.log').ok,false);
  assert.equal(run(after,'cat ~/practice/shared-report.log').ok,true);
});

test('intro requires a valid chgrp and later metadata inspection',()=>{
  const seed=createAcademyState();
  const attempted=academySubmit(seed,[],'stat ~/practice/shared-report.log','chgrp');
  assert.equal(attempted.completed,false);
  const change=academySubmit(seed,[],'chgrp operators ~/practice/shared-report.log','chgrp');
  assert.equal(change.result.ok,true);
  assert.equal(change.completed,false);
  const observed=academySubmit(change.result.state,change.events,'stat ~/practice/shared-report.log','chgrp');
  assert.equal(observed.completed,true);
  assert.equal(shareCompleted('intro',observed.result.state,observed.events),true);
});

test('chgrp to the wrong group and post-hoc chmod cannot pass intro',()=>{
  const seed=createAcademyState();
  const same=academySubmit(seed,[],'chgrp player ~/practice/shared-report.log','chgrp');
  const meta=academySubmit(same.result.state,same.events,'stat ~/practice/shared-report.log','chgrp');
  assert.equal(meta.completed,false);
  const correct=academySubmit(seed,[],'chgrp operators ~/practice/shared-report.log','chgrp');
  const altered=academySubmit(correct.result.state,correct.events,'chmod 777 ~/practice/shared-report.log','chgrp');
  const final=academySubmit(altered.result.state,altered.events,'stat ~/practice/shared-report.log','chgrp');
  assert.equal(final.completed,false);
});

test('independent transfer uses analyst ownership and audit group',()=>{
  const seed=createTransferState('chgrp');
  assert.equal(run(seed,'whoami').output,'analyst');
  assert.deepEqual(ownerOf(seed,t.path),{uid:1001,gid:1100});
  const first=submitTransfer(seed,[],'chgrp audit ~/practice/logs/audit-report.log','chgrp');
  assert.equal(first.result.ok,true);
  assert.equal(first.completed,false);
  const second=submitTransfer(first.result.state,first.events,
    'ls -l ~/practice/logs/audit-report.log','chgrp');
  assert.equal(second.completed,true);
  assert.deepEqual(ownerOf(second.result.state,t.path),{uid:1001,gid:1200});
  assert.equal(transferMistake('chgrp',first.result,false),false);
  assert.equal(transferMistake('chgrp',second.result,true),false);
  assert.equal(earnedMastery(true,0,false),true);
});

test('wrong successful group in transfer counts as independent mistake',()=>{
  const seed=createTransferState('chgrp');
  const wrong=submitTransfer(seed,[],'chgrp security ~/practice/logs/audit-report.log','chgrp');
  assert.equal(wrong.result.ok,true);
  assert.equal(wrong.completed,false);
  assert.equal(transferMistake('chgrp',wrong.result,false),true);
  const correct=submitTransfer(wrong.result.state,wrong.events,'chgrp audit ~/practice/logs/audit-report.log','chgrp');
  const checked=submitTransfer(correct.result.state,correct.events,'stat ~/practice/logs/audit-report.log','chgrp');
  assert.equal(checked.completed,true);
  assert.equal(earnedMastery(checked.completed,1,false),false);
});

test('manual documents only implemented group operations',()=>{
  const seed=initialLinux();
  assert.match(run(seed,'man chgrp').output,/chgrp GRUPA/);
  assert.match(run(seed,'man -k grupa').output,/chgrp/);
  assert.match(run(seed,'help').output,/chgrp/);
});

test('legacy progress is preserved without inventing chgrp mastery',()=>{
  const saved=restoreAcademyProgress({
    selectedId:'umask',completed:['pwd','umask'],mastered:['pwd']
  });
  assert.equal(saved.selectedId,'umask');
  assert.deepEqual(saved.completed,['pwd','umask']);
  assert.deepEqual(saved.mastered,['pwd']);
  assert.equal(saved.completed.includes('chgrp'),false);
  const legacy=initialLinux();
  delete legacy.ownership;
  assert.equal(run(legacy,'chgrp operators ~/notes.txt').ok,true);
});
