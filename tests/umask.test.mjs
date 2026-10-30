import test from 'node:test';
import assert from 'node:assert/strict';
import {executeLinux,initialLinux} from '../src/core/linux.ts';
import {modeOf} from '../src/core/permissions.ts';
import {sessionUmask,newFileMode,newDirectoryMode,umaskExerciseCompleted} from '../src/core/umask.ts';
import {createAcademyState,academySubmit,restoreAcademyProgress} from '../src/core/commandAcademy.ts';
import {createTransferState,submitTransfer,transferMistake} from '../src/core/academyTransfer.ts';
import {explainAcademyAttempt} from '../src/core/academyFeedback.ts';
const LAB='/home/player/practice';

test('default umask 022 produces file 644 and directory 755',()=>{
  const seed=initialLinux();
  assert.equal(executeLinux(seed,'umask').output,'0022');
  assert.equal(sessionUmask(seed),0o022);
  assert.equal(newFileMode(seed),0o644);
  assert.equal(newDirectoryMode(seed),0o755);
  const file=executeLinux(seed,'touch ~/new.txt');
  const dir=executeLinux(file.state,'mkdir ~/new-dir');
  assert.equal(file.ok,true);
  assert.equal(dir.ok,true);
  assert.equal(modeOf(dir.state,'/home/player/new.txt'),0o644);
  assert.equal(modeOf(dir.state,'/home/player/new-dir'),0o755);
});

test('umask 077 changes newly created file and directory modes, not existing objects',()=>{
  const seed=initialLinux(),before=structuredClone(seed);
  const change=executeLinux(seed,'umask 077');
  assert.equal(change.ok,true);
  assert.equal(change.target,'077');
  assert.equal(change.state.umask,0o077);
  assert.equal(executeLinux(change.state,'umask').output,'0077');
  assert.equal(modeOf(change.state,'/home/player/notes.txt'),0o644);
  const file=executeLinux(change.state,'touch ~/secret.txt');
  const dir=executeLinux(file.state,'mkdir ~/vault-new');
  assert.equal(modeOf(dir.state,'/home/player/secret.txt'),0o600);
  assert.equal(modeOf(dir.state,'/home/player/vault-new'),0o700);
  assert.equal(modeOf(dir.state,'/home/player/notes.txt'),0o644);
  assert.deepEqual(seed,before);
});

test('umask 027 supports group-readable files and group-traversable directories',()=>{
  const s=executeLinux(initialLinux(),'umask 0027').state;
  const file=executeLinux(s,'touch ~/team.txt');
  const dir=executeLinux(file.state,'mkdir ~/team-dir');
  assert.equal(modeOf(dir.state,'/home/player/team.txt'),0o640);
  assert.equal(modeOf(dir.state,'/home/player/team-dir'),0o750);
  assert.equal(executeLinux(dir.state,'stat ~/team.txt').ok,true);
  assert.match(executeLinux(dir.state,'ls -l ~/team-dir').output,/pusty/);
});

test('umask affects copying into new names, but not existing destination metadata',()=>{
  let s=executeLinux(initialLinux(),'umask 077').state;
  const copied=executeLinux(s,'cp ~/notes.txt ~/notes-copy.txt');
  assert.equal(copied.ok,true);
  assert.equal(modeOf(copied.state,'/home/player/notes-copy.txt'),0o600);
  const changed=executeLinux(copied.state,'umask 022');
  const overwrite=executeLinux(changed.state,'cp ~/notes.txt ~/notes-copy.txt');
  assert.equal(overwrite.ok,true);
  assert.equal(modeOf(overwrite.state,'/home/player/notes-copy.txt'),0o600);
});

test('touch existing file does not retroactively apply new mask',()=>{
  const s=initialLinux();
  const newMask=executeLinux(s,'umask 077');
  const touched=executeLinux(newMask.state,'touch ~/notes.txt');
  assert.equal(touched.ok,true);
  assert.equal(modeOf(touched.state,'/home/player/notes.txt'),0o644);
});

test('umask rejects invalid syntax and leaves state unmodified',()=>{
  const state=initialLinux(),before=structuredClone(state);
  for(const command of ['umask -S','umask 888','umask 22','umask 078','umask 077 foo','umask -077','umask 0000']){
    const r=executeLinux(state,command);
    assert.equal(r.ok,false,command);
    assert.equal(r.state,state,command);
  }
  assert.deepEqual(state,before);
  assert.match(executeLinux(state,'man umask').output,/666/);
});

test('legacy sessions without umask continue to create files as before',()=>{
  const legacy=initialLinux();
  delete legacy.umask;
  assert.equal(sessionUmask(legacy),0o022);
  const r=executeLinux(legacy,'touch ~/legacy.txt');
  assert.equal(r.ok,true);
  assert.equal(modeOf(r.state,'/home/player/legacy.txt'),0o644);
  assert.equal(legacy.umask,undefined);
});

test('intro lesson validates 077, new file 600 and directory 700',()=>{
  const seed=createAcademyState();
  const mask=academySubmit(seed,[],'umask 077','umask');
  assert.equal(mask.completed,false);
  const file=academySubmit(mask.result.state,mask.events,
    'touch ~/practice/private-created.txt','umask');
  assert.equal(file.completed,false);
  const dir=academySubmit(file.result.state,file.events,
    'mkdir ~/practice/private-created','umask');
  assert.equal(dir.completed,true);
  assert.equal(umaskExerciseCompleted(dir.result.state,dir.events,0o077,
    LAB+'/private-created.txt',LAB+'/private-created'),true);
});

test('creating first then chmod does not fraudulently earn umask lesson credit',()=>{
  const seed=createAcademyState();
  const file=academySubmit(seed,[],'touch ~/practice/private-created.txt','umask');
  const dir=academySubmit(file.result.state,file.events,'mkdir ~/practice/private-created','umask');
  const mask=academySubmit(dir.result.state,dir.events,'umask 077','umask');
  const chmodFile=academySubmit(mask.result.state,mask.events,
    'chmod 600 ~/practice/private-created.txt','umask');
  const chmodDir=academySubmit(chmodFile.result.state,chmodFile.events,
    'chmod 700 ~/practice/private-created','umask');
  assert.equal(chmodDir.completed,false);
});

test('transfer exercises a changed umask and target object names',()=>{
  const seed=createTransferState('umask');
  const mask=submitTransfer(seed,[],'umask 027','umask');
  assert.equal(mask.completed,false);
  const file=submitTransfer(mask.result.state,mask.events,'touch ~/practice/team-draft.txt','umask');
  const done=submitTransfer(file.result.state,file.events,'mkdir ~/practice/team-work','umask');
  assert.equal(done.completed,true);
  assert.equal(modeOf(done.result.state,LAB+'/team-draft.txt'),0o640);
  assert.equal(modeOf(done.result.state,LAB+'/team-work'),0o750);
  assert.equal(transferMistake('umask',mask.result,false),false);
  assert.equal(transferMistake('umask',done.result,true),false);
  assert.equal(createAcademyState().files[LAB+'/team-draft.txt'],undefined);
});

test('wrong successful umask in transfer counts as a learning error',()=>{
  const seed=createTransferState('umask');
  const wrong=submitTransfer(seed,[],'umask 077','umask');
  assert.equal(wrong.result.ok,true);
  assert.equal(wrong.completed,false);
  assert.equal(transferMistake('umask',wrong.result,false),true);
  const feedback=explainAcademyAttempt('umask',seed,wrong.result,false);
  assert.equal(feedback.status,'partial');
  assert.match(feedback.detail,/666/);
});

test('old saved progress remains intact with the new umask lesson',()=>{
  const progress=restoreAcademyProgress({
    selectedId:'namei',completed:['pwd','namei'],mastered:['pwd']
  });
  assert.equal(progress.selectedId,'namei');
  assert.deepEqual(progress.completed,['pwd','namei']);
  assert.deepEqual(progress.mastered,['pwd']);
  assert.ok(!progress.completed.includes('umask'));
});
