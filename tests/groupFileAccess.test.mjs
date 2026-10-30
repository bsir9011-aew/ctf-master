import {assertWorldUnchanged} from './assertWorldUnchanged.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {executeLinux, initialLinux} from '../src/core/linux.ts';
import {ownerOf,hasAccess,canTraverse} from '../src/core/permissions.ts';
import {createAcademyState,academySubmit,restoreAcademyProgress} from '../src/core/commandAcademy.ts';
import {createTransferState,submitTransfer,transferMistake} from '../src/core/academyTransfer.ts';

const LAB='/home/player/practice';
const use=(state,command)=>executeLinux(state,command);
const groupCmds=['cat','grep','head','tail','wc','sort','uniq'];

test('same 640 mode allows group member but denies unrelated group',()=>{
  const s=createAcademyState();
  assert.equal(use(s,'id -G').output,'1000 1100');
  assert.equal(use(s,'stat ~/practice/operator.log').ok,true);
  assert.match(use(s,'stat ~/practice/operator.log').output,/mode 640.*owner svc.*group operators/);
  assert.match(use(s,'ls -l ~/practice/operator.log').output,/-rw-r----- svc operators/);
  assert.equal(use(s,'cat ~/practice/operator.log').ok,true);
  assert.equal(use(s,'cat ~/practice/audit-only.log').ok,false);
  assert.equal(use(s,'stat ~/practice/audit-only.log').ok,true);
  assert.equal(ownerOf(s,LAB+'/operator.log').gid,1100);
});

test('all text inspection commands check group read rights',()=>{
  const s=createAcademyState();
  for(const cmd of groupCmds){
    const allowed=use(s,(cmd==='grep'?'grep OPERATOR':' '+cmd).trim()+' ~/practice/operator.log');
    assert.equal(allowed.ok,true,cmd);
    const denied=use(s,(cmd==='grep'?'grep AUDIT':' '+cmd).trim()+' ~/practice/audit-only.log');
    assert.equal(denied.ok,false,cmd);
    assert.match(denied.output,/Permission denied/,cmd);
  }
  assert.equal(use(s,'grep OPERATOR ~/practice/operator.log | wc -l').output,'1');
  assert.equal(use(s,'cat ~/practice/audit-only.log | wc -l').ok,false);
});

test('owner class overrides even when the owner is also a member of file group',()=>{
  const s=createAcademyState();
  s.ownership[LAB+'/operator.log']={uid:1000,gid:1100};
  s.permissions[LAB+'/operator.log']=0o040;
  assert.equal(hasAccess(s,LAB+'/operator.log','r'),false);
  assert.equal(use(s,'cat ~/practice/operator.log').ok,false);
});

test('other class can read 004 but cannot bypass blocked parent traversal',()=>{
  const s=createAcademyState();
  s.permissions[LAB+'/audit-only.log']=0o004;
  assert.equal(use(s,'cat ~/practice/audit-only.log').ok,true);
  const locked=use(s,'chmod 600 ~/practice');
  assert.equal(locked.ok,true);
  assert.equal(canTraverse(locked.state,LAB+'/audit-only.log'),false);
  assert.equal(use(locked.state,'cat ~/practice/audit-only.log').ok,false);
  assert.equal(use(locked.state,'stat ~/practice/audit-only.log').ok,false);
});

test('missing directory execute bit blocks cd, file read and filename discovery',()=>{
  const seed=createAcademyState();
  const blocked=use(seed,'chmod 600 ~/practice/logs');
  assert.equal(blocked.ok,true);
  for(const cmd of [
    'cd ~/practice/logs',
    'cat ~/practice/logs/edge.log',
    'find ~/practice/logs -name "*.log"'
  ]) {
    const r=use(blocked.state,cmd);
    assert.equal(r.ok,false,cmd);
    assert.match(r.output,/Permission denied/,cmd);
  }
  const restored=use(blocked.state,'chmod u+x ~/practice/logs');
  assert.equal(restored.ok,true);
  assert.equal(use(restored.state,'cd ~/practice/logs').ok,true);
});

test('non-owner cannot chmod group-readable file',()=>{
  const seed=createAcademyState();
  const snapshot=structuredClone(seed);
  const r=use(seed,'chmod 777 ~/practice/operator.log');
  assert.equal(r.ok,false);
  assert.match(r.output,/Permission denied/);
  assertWorldUnchanged(r.state,snapshot);
  assert.deepEqual(seed,snapshot);
});

test('creating, moving and removing files maintains numeric owners',()=>{
  let s=initialLinux();
  const file=use(s,'touch ~/created.txt');
  assert.deepEqual(ownerOf(file.state,'/home/player/created.txt'),{uid:1000,gid:1000});
  const copy=use(file.state,'cp ~/documents/readme.txt ~/copied.txt');
  assert.equal(copy.ok,true);
  assert.deepEqual(ownerOf(copy.state,'/home/player/copied.txt'),{uid:1000,gid:1000});
  const moved=use(copy.state,'mv ~/copied.txt ~/moved.txt');
  assert.equal(moved.ok,true);
  assert.deepEqual(ownerOf(moved.state,'/home/player/moved.txt'),{uid:1000,gid:1000});
  assert.equal(moved.state.ownership['/home/player/copied.txt'],undefined);
  const gone=use(moved.state,'rm ~/moved.txt');
  assert.equal(gone.ok,true);
  assert.equal(gone.state.ownership['/home/player/moved.txt'],undefined);
});

test('directory write plus execute rights are needed for mutation',()=>{
  const s=initialLinux();
  const locked=use(s,'chmod 555 ~/documents');
  assert.equal(locked.ok,true);
  assert.equal(use(locked.state,'cat ~/documents/readme.txt').ok,true);
  for(const cmd of [
    'mkdir ~/documents/new-dir',
    'touch ~/documents/new-file.txt',
    'rm ~/documents/credentials.txt',
    'cp ~/notes.txt ~/documents/copy.txt',
    'mv ~/notes.txt ~/documents/renamed.txt'
  ]) {
    const r=use(locked.state,cmd);
    assert.equal(r.ok,false,cmd);
    assert.match(r.output,/Permission denied/,cmd);
  }
});

test('intro group access requires investigating groups and metadata before read',()=>{
  const seed=createAcademyState();
  assert.equal(academySubmit(seed,[],'cat ~/practice/operator.log','file-access').completed,false);
  const groups=academySubmit(seed,[],'id -G','file-access');
  const meta=academySubmit(groups.result.state,groups.events,'stat ~/practice/operator.log','file-access');
  assert.equal(meta.completed,false);
  const read=academySubmit(meta.result.state,meta.events,'cat ~/practice/operator.log','file-access');
  assert.equal(read.completed,true);
  assert.equal(read.result.ok,true);
});

test('transfer changes user and group, accepts independent evidence but not copying guess',()=>{
  const s=createTransferState('file-access');
  assert.equal(use(s,'id -G').output,'1100 1200');
  assert.equal(use(s,'cat ~/practice/logs/audit-share.log').ok,true);
  assert.equal(use(s,'cat ~/practice/logs/player-share.log').ok,false);
  const first=submitTransfer(s,[],'id -G','file-access');
  assert.equal(first.completed,false);
  const second=submitTransfer(first.result.state,first.events,'ls -l ~/practice/logs/audit-share.log','file-access');
  const third=submitTransfer(second.result.state,second.events,'cat ~/practice/logs/audit-share.log','file-access');
  assert.equal(third.completed,true);
  assert.equal(transferMistake('file-access',third.result,true),false);
  const premature=submitTransfer(s,[],'cat ~/practice/logs/audit-share.log','file-access');
  assert.equal(premature.completed,false);
  assert.equal(transferMistake('file-access',premature.result,false),true);
});

test('legacy session without identity or ownership defaults to previous semantics',()=>{
  const legacy=initialLinux();
  delete legacy.identity;delete legacy.ownership;
  assert.equal(use(legacy,'cat ~/documents/readme.txt').ok,true);
  assert.equal(use(legacy,'chmod 600 ~/documents/credentials.txt').ok,true);
  const progress=restoreAcademyProgress({selectedId:'id',completed:['pwd','id'],mastered:['pwd']});
  assert.deepEqual(progress.completed,['pwd','id']);
  assert.equal(progress.completed.includes('file-access'),false);
});
