import {assertWorldUnchanged} from './assertWorldUnchanged.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {executeLinux,initialLinux} from '../src/core/linux.ts';
import {createAcademyState,academySubmit,restoreAcademyProgress} from '../src/core/commandAcademy.ts';
import {createTransferState,submitTransfer,transferMistake} from '../src/core/academyTransfer.ts';
import {explainAcademyAttempt} from '../src/core/academyFeedback.ts';
import {recoveryCompleted,recoveryFixture} from '../src/core/pathRecovery.ts';

const intro='~/practice/diagnostics/service.log';
const transfer='~/practice/logs/locked/health.log';

test('namei -l exposes only the accessible path prefix and blocked directory',()=>{
  const seed=createAcademyState(),snapshot=structuredClone(seed);
  const r=executeLinux(seed,'namei -l '+intro);
  assert.equal(r.ok,true);
  assert.equal(r.command,'namei');
  assert.equal(r.target,'/home/player/practice/diagnostics/service.log');
  assert.equal(r.blockedAt,'/home/player/practice/diagnostics');
  assert.match(r.output,/drw------- player player diagnostics  \[BRAK x/);
  assert.doesNotMatch(r.output,/-rw-r--r-- player player service.log/);
  assert.deepEqual(seed,snapshot);
  assert.deepEqual(r.state,snapshot);
  assert.equal(executeLinux(seed,'cat '+intro).ok,false);
});

test('namei -l displays each traversable element including file when not blocked',()=>{
  const r=executeLinux(initialLinux(),'namei -l ~/notes.txt');
  assert.equal(r.ok,true);
  assert.equal(r.blockedAt,undefined);
  assert.match(r.output,/drwxr-xr-x player player home/);
  assert.match(r.output,/-rw-r--r-- player player notes.txt/);
  assert.match(executeLinux(initialLinux(),'man namei').output,/namei -l SCIEZKA/);
});

test('malformed namei and missing paths produce errors without state changes',()=>{
  const state=createAcademyState(),snapshot=structuredClone(state);
  for(const raw of ['namei','namei ~/notes.txt','namei -L ~/notes.txt',
    'namei -l ~/notes.txt extra','namei -l ~/practice/no-such.txt']){
    const r=executeLinux(state,raw);
    assert.equal(r.ok,false,raw);
    assert.equal(r.command,'namei');
    assertWorldUnchanged(r.state,state);
  }
  assert.deepEqual(state,snapshot);
});

test('intro requires actual namei diagnosis, a controlled chmod and a later read',()=>{
  const state=createAcademyState();
  assert.equal(recoveryCompleted('intro',state,[]),false);
  const diag=academySubmit(state,[],'namei -l '+intro,'namei');
  assert.equal(diag.completed,false);
  const repaired=academySubmit(diag.result.state,diag.events,
    'chmod u+x ~/practice/diagnostics','namei');
  assert.equal(repaired.completed,false);
  const read=academySubmit(repaired.result.state,repaired.events,'cat '+intro,'namei');
  assert.equal(read.completed,true);
  assert.equal(read.result.ok,true);
  assert.equal(read.result.output,recoveryFixture('intro').content);
  assert.equal(read.result.state.permissions['/home/player/practice/diagnostics'],0o700);
});

test('opening the directory too broadly fails least-privilege requirement',()=>{
  const seed=createAcademyState();
  const diag=academySubmit(seed,[],'namei -l '+intro,'namei');
  const opened=academySubmit(diag.result.state,diag.events,
    'chmod 777 ~/practice/diagnostics','namei');
  const read=academySubmit(opened.result.state,opened.events,'cat '+intro,'namei');
  assert.equal(read.result.ok,true);
  assert.equal(read.completed,false);
});

test('changing access before diagnosing does not retroactively complete lesson',()=>{
  const seed=createAcademyState();
  const changed=academySubmit(seed,[],'chmod u+x ~/practice/diagnostics','namei');
  const diag=academySubmit(changed.result.state,changed.events,'namei -l '+intro,'namei');
  assert.equal(diag.result.blockedAt,undefined);
  const read=academySubmit(diag.result.state,diag.events,'cat '+intro,'namei');
  assert.equal(read.completed,false);
});

test('namei failure diagnosis gives causal feedback without the exact chmod answer',()=>{
  const seed=createAcademyState(),r=executeLinux(seed,'namei -l '+intro);
  const feedback=explainAcademyAttempt('namei',seed,r,false);
  assert.equal(feedback.status,'partial');
  assert.match(feedback.detail,/praw[ao] x/);
  assert.doesNotMatch(feedback.detail,/chmod u\+x/);
});

test('changed transfer variant uses another depth and independently locked directory',()=>{
  const state=createTransferState('namei');
  assert.equal(state.files[recoveryFixture('transfer').file],recoveryFixture('transfer').content);
  assert.equal(executeLinux(state,'cat '+transfer).ok,false);
  const diag=submitTransfer(state,[],'namei -l '+transfer,'namei');
  assert.equal(diag.result.blockedAt,'/home/player/practice/logs/locked');
  const fixed=submitTransfer(diag.result.state,diag.events,
    'chmod u+x ~/practice/logs/locked','namei');
  const completed=submitTransfer(fixed.result.state,fixed.events,'cat '+transfer,'namei');
  assert.equal(completed.completed,true);
  assert.equal(transferMistake('namei',diag.result,false),false);
  assert.equal(transferMistake('namei',fixed.result,false),false);
  assert.equal(transferMistake('namei',completed.result,true),false);
});

test('wrong chmod target is a missed attempt and never earns independent mastery',()=>{
  const s=createTransferState('namei');
  const diag=submitTransfer(s,[],'namei -l '+transfer,'namei');
  const wrong=submitTransfer(diag.result.state,diag.events,'chmod u+x ~/practice/logs','namei');
  assert.equal(wrong.result.ok,true);
  assert.equal(wrong.completed,false);
  assert.equal(transferMistake('namei',wrong.result,false),true);
});

test('previously fixed identity feedback distinguishes successful id and invalid id',()=>{
  const seed=createAcademyState();
  const yes=executeLinux(seed,'id -G');
  const success=explainAcademyAttempt('id',seed,yes,false);
  assert.equal(success.status,'partial');
  assert.match(success.detail,/GID/);
  const no=executeLinux(seed,'id -not-supported');
  const failure=explainAcademyAttempt('id',seed,no,false);
  assert.equal(failure.status,'error');
});

test('past academy progress and legacy sessions remain valid',()=>{
  const progress=restoreAcademyProgress({
    selectedId:'file-access',completed:['pwd','id','file-access'],mastered:['pwd','id']
  });
  assert.equal(progress.selectedId,'file-access');
  assert.deepEqual(progress.completed,['pwd','id','file-access']);
  assert.ok(!progress.completed.includes('namei'));
  const legacy=initialLinux();
  delete legacy.identity;delete legacy.ownership;
  assert.equal(executeLinux(legacy,'namei -l ~/notes.txt').ok,true);
});
