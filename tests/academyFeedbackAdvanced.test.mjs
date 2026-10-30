import test from 'node:test';
import assert from 'node:assert/strict';
import { academySubmit, createAcademyState } from '../src/core/commandAcademy.ts';
import { createTransferState, submitTransfer } from '../src/core/academyTransfer.ts';
import { executeLinux } from '../src/core/linux.ts';
import { explainAcademyAttempt } from '../src/core/academyFeedback.ts';

function attempt(id,command){
  const before=createAcademyState();
  const data=academySubmit(before,[],command,id);
  const insight=explainAcademyAttempt(id,before,data.result,data.completed);
  return {...insight,data,before};
}
function transfer(id,command){
  const before=createTransferState(id);
  const data=submitTransfer(before,[],command,id);
  const insight=explainAcademyAttempt(id,before,data.result,data.completed);
  return {...insight,data};
}

test('find reports real count and a matching name search completes the lesson',()=>{
  const done=attempt('find','find ~/practice -name "ticket-*.txt"');
  assert.equal(done.data.completed,true);
  assert.equal(done.status,'complete');
  assert.match(done.detail,/1 ścieżkę/);
  const broader=attempt('find','find ~/practice');
  assert.equal(broader.status,'complete');
  assert.match(broader.detail,/ścieżki/);
});

test('find no matches is a valid command with a partial educational outcome',()=>{
  const result=attempt('find','find ~/practice -name "*.missing"');
  assert.equal(result.data.result.ok,true);
  assert.equal(result.data.completed,false);
  assert.equal(result.status,'partial');
  assert.match(result.detail,/nie znalazł nazw/);
});

test('find distinguishes wrong start path from malformed arguments',()=>{
  const missing=attempt('find','find ~/not-a-dir -name "*.txt"');
  assert.equal(missing.status,'error');
  assert.match(missing.title,/punktu początkowego/);
  const invalid=attempt('find','find ~/practice -name');
  assert.equal(invalid.status,'error');
  assert.match(invalid.detail,/wzorce \* i \?/i);
});

test('cp success actually creates a distinct file without modifying source',()=>{
  const r=attempt('cp','cp ~/practice/source.txt ~/practice/backup.txt');
  assert.equal(r.data.completed,true);
  assert.equal(r.status,'complete');
  assert.match(r.detail,/utworzył nowy plik/);
  assert.equal(r.before.files['/home/player/practice/backup.txt'],undefined);
  assert.equal(r.data.result.state.files['/home/player/practice/backup.txt'],'COPY_ME');
  assert.equal(r.data.result.state.files['/home/player/practice/source.txt'],'COPY_ME');
});

test('cp distinguish overwriting a previously existing destination from new file',()=>{
  const r=attempt('cp','cp ~/practice/intro.txt ~/practice/source.txt');
  assert.equal(r.status,'partial');
  assert.match(r.detail,/nadpisał istniejący plik/);
  assert.equal(r.data.result.state.files['/home/player/practice/source.txt'],
    'Practice is how commands become useful.');
});

test('cp failures explain source, destination and same-path mistakes',()=>{
  const missing=attempt('cp','cp ~/practice/does-not-exist ~/practice/backup.txt');
  assert.equal(missing.status,'error');assert.match(missing.title,/źródłowego/);
  const dest=attempt('cp','cp ~/practice/source.txt ~/practice/missing/backup.txt');
  assert.equal(dest.status,'error');assert.match(dest.detail,/katalog nadrzędny/);
  const same=attempt('cp','cp ~/practice/source.txt ~/practice/source.txt');
  assert.equal(same.status,'error');assert.match(same.title,/takie same/);
  const usage=attempt('cp','cp ~/practice/source.txt');
  assert.equal(usage.status,'error');assert.match(usage.detail,/Pierwszy argument/);
});

test('cp permission denial is not confused with nonexistent source',()=>{
  const seed=createAcademyState();
  const locked=executeLinux(seed,'chmod 000 ~/practice/source.txt');
  assert.equal(locked.ok,true);
  const blocked=executeLinux(locked.state,'cp ~/practice/source.txt ~/practice/backup.txt');
  assert.equal(blocked.ok,false);
  const feedback=explainAcademyAttempt('cp',locked.state,blocked,false);
  assert.equal(feedback.status,'error');
  assert.match(feedback.detail,/prawo odczytu/);
});

test('chmod explains owner group others and exact before-after permissions',()=>{
  const changed=attempt('chmod','chmod 600 ~/practice/private.txt');
  assert.equal(changed.status,'complete');
  assert.match(changed.detail,/644 → 600/);
  assert.match(changed.detail,/rw-------/);
  assert.match(changed.detail,/nie treść pliku/);
  assert.equal(changed.before.permissions['/home/player/practice/private.txt'],0o644);
  assert.equal(changed.data.result.state.permissions['/home/player/practice/private.txt'],0o600);
});

test('chmod valid command can leave wrong or unchanged permissions',()=>{
  const incomplete=attempt('chmod','chmod 640 ~/practice/private.txt');
  assert.equal(incomplete.status,'partial');
  assert.match(incomplete.detail,/644 → 640/);
  const unchanged=attempt('chmod','chmod 644 ~/practice/private.txt');
  assert.equal(unchanged.data.result.ok,true);
  assert.equal(unchanged.status,'partial');
  assert.match(unchanged.detail,/Prawa pozostały takie same/);
});

test('chmod unsupported mode, missing file and incomplete syntax get different lessons',()=>{
  const mode=attempt('chmod','chmod 99 ~/practice/private.txt');
  assert.equal(mode.status,'error');assert.match(mode.detail,/r=4, w=2, x=1/);
  const missing=attempt('chmod','chmod 600 ~/practice/ghost');
  assert.equal(missing.status,'error');assert.match(missing.title,/nie znalazł pliku/);
  const syntax=attempt('chmod','chmod 600');
  assert.equal(syntax.status,'error');assert.match(syntax.detail,/tryb uprawnień/);
});

test('transfer feedback shares observations but not unseen expected filenames',()=>{
  const find=transfer('find','find ~/practice -name "intro.txt"');
  assert.equal(find.status,'partial');
  assert.doesNotMatch(find.detail,/audit-67/);
  const cp=transfer('cp','cp ~/practice/intro.txt ~/practice/different-copy.txt');
  assert.equal(cp.status,'partial');
  assert.doesNotMatch(cp.detail,/intro-copy/);
  const chmod=transfer('chmod','chmod 640 ~/practice/team.key');
  assert.equal(chmod.status,'partial');
  assert.doesNotMatch(chmod.detail,/600/);
});

test('feedback is read-only and cannot grant lesson mastery',()=>{
  const initial=createAcademyState();
  const snapshot=structuredClone(initial);
  const result=executeLinux(initial,'find ~/practice');
  const feedback=explainAcademyAttempt('find',initial,result,false);
  assert.equal(feedback.status,'partial');
  assert.deepEqual(initial,snapshot);
  assert.deepEqual(result.state,snapshot);
});
