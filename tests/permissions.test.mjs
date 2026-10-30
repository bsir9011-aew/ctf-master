import {assertWorldUnchanged} from './assertWorldUnchanged.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { executeLinux, initialLinux } from '../src/core/linux.ts';
import { modeOf, modeString, modeOctal, nextMode } from '../src/core/permissions.ts';
import { missions } from '../src/core/missions.ts';
import { explainError } from '../src/core/learning.ts';
import { availableReviews, createReviewAttempt, runReviewCommand } from '../src/core/review.ts';

function session(commands) {
  let state = initialLinux();
  const events = [];
  for (const cmd of commands) {
    const r = executeLinux(state, cmd);
    state = r.state;
    events.push(r);
  }
  return {state,events};
}

test('mode rendering matches POSIX owner/group/other bits', () => {
  const state = initialLinux();
  assert.equal(modeOf(state, '/home/player/documents/credentials.txt'), 0o644);
  assert.equal(modeString(state, '/home/player/documents/credentials.txt'), '-rw-r--r--');
  assert.equal(modeString(state, '/home/player/documents/restricted.log'), '----------');
  assert.equal(modeString(state, '/home/player/documents'), 'drwxr-xr-x');
  assert.equal(modeOctal(state, '/home/player/documents'), '755');
});

test('numeric and symbolic chmod update only targeted simulated modes', () => {
  const old = initialLinux();
  const fixed = executeLinux(old, 'chmod 0600 ~/documents/credentials.txt');
  assert.equal(fixed.ok, true);
  assert.equal(modeOctal(fixed.state,'/home/player/documents/credentials.txt'),'600');
  assert.equal(modeOctal(old,'/home/player/documents/credentials.txt'),'644');
  assert.equal(nextMode(0o644,'go-rwx'),0o600);
  assert.equal(nextMode(0,'u+r'),0o400);
  assert.equal(nextMode(0o600,'a+x'),0o711);
  assert.equal(nextMode(0o600,'u=q'),null);
});

test('stat and ls -l expose the same mode', () => {
  const state = initialLinux();
  assert.match(executeLinux(state,'stat ~/documents/credentials.txt').output,/mode 644 \(-rw-r--r--\)/);
  assert.match(executeLinux(state,'ls -l ~/documents/credentials.txt').output,/-rw-r--r-- player player/);
  const denied = executeLinux(state,'cat ~/documents/restricted.log');
  assert.equal(denied.ok,false);
  assert.match(denied.output,/Permission denied/);
  assert.match(explainError(denied).title,/uprawnień/);
});

test('unreadable file rejects cat, grep, cp without mutating data', () => {
  const state = initialLinux();
  for (const command of [
    'cat ~/documents/restricted.log',
    'grep RECOVERY ~/documents/restricted.log',
    'cp ~/documents/restricted.log ~/documents/copied.log'
  ]) {
    const output = executeLinux(state,command);
    assert.equal(output.ok,false,command);
    assertWorldUnchanged(output.state,state);
  }
});

test('chmod rejects invalid modes and missing paths', () => {
  const state = initialLinux();
  for (const cmd of ['chmod 999 ~/documents/credentials.txt','chmod -R 777 ~/documents',
    'chmod 600 missing.txt']) {
    const output = executeLinux(state,cmd);
    assert.equal(output.ok,false,cmd);
    assertWorldUnchanged(output.state,state,cmd);
  }
});

test('cp creates a default-mode file; mv preserves mode; rm clears metadata', () => {
  const first = session(['chmod 600 ~/documents/credentials.txt','cp ~/documents/credentials.txt ~/documents/copy.txt']);
  assert.equal(modeOf(first.state,'/home/player/documents/copy.txt'),0o644);
  assert.equal(modeOf(first.state,'/home/player/documents/credentials.txt'),0o600);
  const moved = executeLinux(first.state,'mv ~/documents/credentials.txt ~/documents/renamed.txt');
  assert.equal(modeOf(moved.state,'/home/player/documents/renamed.txt'),0o600);
  assert.equal(Object.hasOwn(moved.state.permissions,'/home/player/documents/credentials.txt'),false);
  const removed = executeLinux(moved.state,'rm ~/documents/renamed.txt');
  assert.equal(Object.hasOwn(removed.state.permissions,'/home/player/documents/renamed.txt'),false);
});

test('hardening mission checks resulting mode, not a command string', () => {
  const mission = missions.find(m=>m.id==='file-hardening');
  assert.ok(mission);
  assert.equal(mission.success(initialLinux(),[]),false);
  const file = session(['chmod go-rwx ~/documents/credentials.txt']);
  assert.equal(mission.success(file.state,file.events),true);
  const bad = session(['chmod 777 ~/documents/credentials.txt']);
  assert.equal(mission.success(bad.state,bad.events),false);
});

test('recovery mission requires actual read and no group/other privileges', () => {
  const mission = missions.find(m=>m.id==='permission-recovery');
  assert.ok(mission);
  const a = session(['chmod u+r ~/documents/restricted.log']);
  assert.equal(mission.success(a.state,a.events),false);
  const b = session(['chmod u+r ~/documents/restricted.log','cat ~/documents/restricted.log']);
  assert.equal(mission.success(b.state,b.events),true);
  const tooOpen = session(['chmod 777 ~/documents/restricted.log','cat ~/documents/restricted.log']);
  assert.equal(mission.success(tooOpen.state,tooOpen.events),false);
});

test('permission review unlocks and requires two different clean scenarios', () => {
  const list = availableReviews(['file-hardening'],{},{}).map(r=>r.id);
  assert.deepEqual(list,['permissions']);
  let attempt = createReviewAttempt('permissions',{});
  assert.equal(attempt.variantId,'perm-a');
  let first = runReviewCommand(attempt,{},'chmod 600 ~/documents/team.key');
  assert.equal(first.attempt.completed,true);
  assert.equal(first.attempt.independent,true);
  assert.equal(first.history.permissions.streak,1);
  attempt = createReviewAttempt('permissions',first.history);
  assert.equal(attempt.variantId,'perm-b');
  let second = runReviewCommand(attempt,first.history,'chmod u+r ~/documents/audit-review.log');
  assert.equal(second.attempt.completed,false);
  second = runReviewCommand(second.attempt,second.history,'cat ~/documents/audit-review.log');
  assert.equal(second.attempt.completed,true);
  assert.equal(second.history.permissions.streak,2);
});

test('chmod accepts owned directories, controlling traversal',()=>{
  const state=initialLinux();
  const locked=executeLinux(state,'chmod 600 ~/documents');
  assert.equal(locked.ok,true);
  assert.equal(modeOctal(locked.state,'/home/player/documents'),'600');
  const cd=executeLinux(locked.state,'cd ~/documents');
  assert.equal(cd.ok,false);
  assert.match(cd.output,/Permission denied/);
  assert.equal(executeLinux(locked.state,'ls ~/documents').ok,false);
  const unlocked=executeLinux(locked.state,'chmod u+x ~/documents');
  assert.equal(unlocked.ok,true);
  assert.equal(executeLinux(unlocked.state,'cd ~/documents').ok,true);
});
