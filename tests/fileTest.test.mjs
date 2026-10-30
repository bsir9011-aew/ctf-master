import test from 'node:test';
import assert from 'node:assert/strict';
import {executeLinux,initialLinux} from '../src/core/linux.ts';
import {createAcademyState,academySubmit,commandLessons} from '../src/core/commandAcademy.ts';
import {createTransferState,submitTransfer,transferChallenges,transferMistake} from '../src/core/academyTransfer.ts';
import {introTestFixture,transferTestFixture,fileTestCompleted} from '../src/core/fileTest.ts';

const run=(state,raw)=>executeLinux(state,raw);
const LAB='/home/player/practice';

test('test -e/-f/-d are silent and do not read file contents',()=>{
  const before=createAcademyState(),snapshot=structuredClone(before);
  for(const [raw,code] of [
    ['test -e ~/practice/checks/locked.log',0],
    ['test -f ~/practice/checks/locked.log',0],
    ['test -d ~/practice/checks/locked.log',1],
    ['test -d ~/practice/checks',0],
    ['test -f ~/practice/checks',1],
    ['test -e ~/practice/checks/missing.log',1]
  ]){
    const r=run(before,raw);
    assert.equal(r.exitCode,code,raw);
    assert.equal(r.ok,code===0,raw);
    assert.equal(r.output,'',raw);
    assert.equal(r.command,'test');
    assert.deepEqual(r.state.files,snapshot.files);
    assert.deepEqual(r.state.permissions,snapshot.permissions);
  }
  assert.deepEqual(before,snapshot);
});

test('file access distinguishes existence from permission and tests file bits',()=>{
  const before=createAcademyState();
  const exists=run(before,'test -f ~/practice/checks/locked.log');
  assert.equal(exists.exitCode,0);
  const readable=run(before,'test -r ~/practice/checks/locked.log');
  assert.equal(readable.exitCode,1);
  assert.equal(run(before,'test -w ~/practice/checks/locked.log').exitCode,1);
  assert.equal(run(before,'test -x ~/practice/checks/locked.log').exitCode,1);
  const ordinary=run(before,'test -r ~/practice/intro.txt');
  assert.equal(ordinary.exitCode,0);
  assert.equal(run(before,'test -x ~/practice/checks').exitCode,0);
  assert.equal(run(before,'test -w ~/practice/checks').exitCode,0);
});

test('bracket alias requires closing bracket, uses same semantics and supports spaces',()=>{
  const state=createAcademyState();
  const valid=run(state,'[ -f "~/practice/report draft.txt" ]');
  assert.equal(valid.exitCode,0);
  assert.equal(valid.command,'test');
  const no=run(state,'[ -f ~/practice/checks ]');
  assert.equal(no.exitCode,1);
  const missing=run(state,'[ -f ~/practice/intro.txt');
  assert.equal(missing.exitCode,2);
  assert.equal(run(state,'test -r').exitCode,2);
  assert.equal(run(state,'test -q ~/practice/intro.txt').exitCode,2);
  assert.equal(run(state,'test -f ~/practice/intro.txt extra').exitCode,2);
});

test('unreachable ancestor prevents testing true existence or readability',()=>{
  const s=createTransferState('test');
  const inaccessible=transferTestFixture.file;
  assert.ok(Object.hasOwn(s.files,inaccessible));
  assert.equal(s.permissions?.[inaccessible],0o644);
  assert.equal(run(s,'test -e '+inaccessible).exitCode,1);
  assert.equal(run(s,'test -f '+inaccessible).exitCode,1);
  assert.equal(run(s,'test -r '+inaccessible).exitCode,1);
  assert.equal(run(s,'test -x '+transferTestFixture.directory).exitCode,1);
  const changed=run(s,'chmod u+x '+transferTestFixture.directory);
  assert.equal(changed.exitCode,0);
  assert.equal(changed.state.permissions?.[transferTestFixture.directory],0o700);
  assert.equal(run(changed.state,'test -r '+inaccessible).exitCode,0);
  assert.equal(s.permissions?.[transferTestFixture.directory],0o600);
});

test('a false predicate reports 1, echo reads 1 and resets it to 0',()=>{
  const s=createAcademyState();
  const first=run(s,'test -r '+introTestFixture.visible);
  assert.equal(first.exitCode,1);
  assert.equal(first.state.lastExitCode,1);
  const read=run(first.state,'echo $?');
  assert.equal(read.output,'1');
  assert.equal(read.exitCode,0);
  assert.equal(run(read.state,'echo $?').output,'0');
});

test('intro mastery requires two predicates with immediate status and unchanged rights',()=>{
  let r=academySubmit(createAcademyState(),[],
    'test -f '+introTestFixture.visible,'test');
  assert.equal(r.completed,false);
  r=academySubmit(r.result.state,r.events,'echo $?','test');
  r=academySubmit(r.result.state,r.events,'[ -r '+introTestFixture.visible+' ]','test');
  assert.equal(r.result.exitCode,1);
  assert.equal(r.completed,false);
  r=academySubmit(r.result.state,r.events,'echo $?','test');
  assert.equal(r.completed,true);
  assert.equal(fileTestCompleted('intro',r.result.state,r.events),true);
});

test('intro does not accept a non-immediate echo or chmod bypass',()=>{
  let r=academySubmit(createAcademyState(),[],'test -f '+introTestFixture.visible,'test');
  r=academySubmit(r.result.state,r.events,'pwd','test');
  r=academySubmit(r.result.state,r.events,'echo $?','test');
  r=academySubmit(r.result.state,r.events,'test -r '+introTestFixture.visible,'test');
  r=academySubmit(r.result.state,r.events,'echo $?','test');
  assert.equal(r.completed,false);
  let second=academySubmit(createAcademyState(),[],
    'chmod u+r '+introTestFixture.visible,'test');
  second=academySubmit(second.result.state,second.events,'test -f '+introTestFixture.visible,'test');
  second=academySubmit(second.result.state,second.events,'echo $?','test');
  second=academySubmit(second.result.state,second.events,'test -r '+introTestFixture.visible,'test');
  second=academySubmit(second.result.state,second.events,'echo $?','test');
  assert.equal(second.completed,false);
});

test('transfer requires precise diagnosis and minimal repair before successful retest',()=>{
  const file=transferTestFixture.file,dir=transferTestFixture.directory;
  let r=submitTransfer(createTransferState('test'),[],'test -r '+file,'test');
  assert.equal(r.result.exitCode,1);
  assert.equal(transferMistake('test',r.result,r.completed),false);
  r=submitTransfer(r.result.state,r.events,'echo $?','test');
  r=submitTransfer(r.result.state,r.events,'[ -x '+dir+' ]','test');
  assert.equal(r.result.exitCode,1);
  assert.equal(transferMistake('test',r.result,r.completed),false);
  r=submitTransfer(r.result.state,r.events,'echo $?','test');
  r=submitTransfer(r.result.state,r.events,'chmod u+x '+dir,'test');
  assert.equal(r.result.state.permissions?.[dir],0o700);
  r=submitTransfer(r.result.state,r.events,'test -r '+file,'test');
  assert.equal(r.result.exitCode,0);
  r=submitTransfer(r.result.state,r.events,'echo $?','test');
  assert.equal(r.completed,true);
  assert.equal(r.result.state.files[file],transferTestFixture.content);
});

test('overly broad repair fails and wrong targets lower transfer mastery',()=>{
  let r=submitTransfer(createTransferState('test'),[],'test -f ~/practice/nonesuch','test');
  assert.equal(transferMistake('test',r.result,r.completed),true);
  const state=createTransferState('test');
  const enlarged=run(state,'chmod 777 '+transferTestFixture.directory);
  assert.equal(enlarged.ok,true);
  assert.equal(run(enlarged.state,'test -r '+transferTestFixture.file).exitCode,0);
  assert.equal(fileTestCompleted('transfer',enlarged.state,[]),false);
  assert.equal(transferMistake('test',run(state,'test -q '+transferTestFixture.file),false),true);
});

test('manual and old session do not introduce host execution or forced migrations',()=>{
  const s=initialLinux();
  delete s.lastExitCode;
  assert.match(run(s,'man test').output,/SCIEZKA/);
  assert.equal(run(s,'test -e ~/notes.txt').exitCode,0);
  assert.equal(s.lastExitCode,undefined);
  const unknown=run(s,'test -e /etc/shadow');
  assert.equal(unknown.exitCode,1);
});

test('catalogue grows to 32 intro and independent transfer lessons',()=>{
  assert.equal(commandLessons.length,33);
  assert.equal(transferChallenges.length,33);
  assert.deepEqual(commandLessons.map(x=>x.id),transferChallenges.map(x=>x.lessonId));
});
