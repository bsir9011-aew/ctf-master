import test from 'node:test';
import assert from 'node:assert/strict';
import {executeLinux,initialLinux} from '../src/core/linux.ts';
import {createAcademyState,academySubmit,commandLessons} from '../src/core/commandAcademy.ts';
import {createTransferState,submitTransfer,transferChallenges,transferMistake,earnedMastery} from '../src/core/academyTransfer.ts';
import {previousExitCode,statusCompleted} from '../src/core/exitStatus.ts';

const run=(state,command)=>executeLinux(state,command);

test('legacy session without lastExitCode reads 0 and new commands remain isolated',()=>{
  const legacy=initialLinux();
  delete legacy.lastExitCode;
  assert.equal(previousExitCode(legacy),0);
  const result=run(legacy,'echo $?');
  assert.equal(result.output,'0');
  assert.equal(result.exitCode,0);
  assert.equal(previousExitCode(result.state),0);
  assert.equal(legacy.lastExitCode,undefined);
});

test('grep without match returns 1; echo reads previous and then resets status to 0',()=>{
  const seed=createAcademyState();
  const fail=run(seed,'grep FATAL ~/practice/events.log');
  assert.equal(fail.ok,false);
  assert.equal(fail.exitCode,1);
  assert.equal(fail.state.lastExitCode,1);
  assert.equal(seed.lastExitCode,0);
  const observed=run(fail.state,'echo $?');
  assert.equal(observed.output,'1');
  assert.equal(observed.exitCode,0);
  assert.equal(observed.state.lastExitCode,0);
  assert.equal(run(observed.state,'echo $?').output,'0');
});

test('syntax errors produce 2 and unknown commands 127, without host access',()=>{
  const original=createAcademyState();
  const syntax=run(original,'cat "unterminated');
  assert.equal(syntax.ok,false);
  assert.equal(syntax.exitCode,2);
  assert.equal(run(syntax.state,'echo $?').output,'2');
  const missing=run(syntax.state,'not-a-real-command');
  assert.equal(missing.ok,false);
  assert.equal(missing.exitCode,127);
  assert.equal(run(missing.state,'echo $?').output,'127');
  assert.deepEqual(missing.state.files,original.files);
  assert.deepEqual(missing.state.dirs,original.dirs);
});

test('single quoted and escaped $? remain literal under expanded echo',()=>{
  const seed=createAcademyState();
  const quoted=run(seed,"echo '$?'");
  assert.equal(quoted.ok,true);
  assert.equal(quoted.output,'$?');
  const escaped=run(seed,'echo \\$?');
  assert.equal(escaped.ok,true);
  assert.equal(escaped.output,'$?');
  assert.equal(escaped.target,undefined);
});

test('successful commands, pipelines and redirects set only final command status',()=>{
  const seed=createAcademyState();
  const success=run(seed,'grep WARN ~/practice/alerts.log | sort | uniq | wc -l');
  assert.equal(success.ok,true);
  assert.equal(success.exitCode,0);
  const failed=run(success.state,'grep FATAL ~/practice/events.log | sort | wc -l');
  assert.equal(failed.ok,false);
  assert.equal(failed.exitCode,1);
  const after=run(failed.state,'echo $?');
  assert.equal(after.output,'1');
  const redirect=run(after.state,'grep WARN ~/practice/alerts.log > ~/practice/new-report.txt');
  assert.equal(redirect.exitCode,0);
  assert.equal(run(redirect.state,'echo $?').output,'0');
  const denied=run(redirect.state,'grep FATAL ~/practice/events.log > ~/practice/missing-report.txt');
  assert.equal(denied.exitCode,1);
  assert.equal(denied.state.files['/home/player/practice/missing-report.txt'],undefined);
});

test('academy checks failed then successful grep with immediate status observations',()=>{
  let entry=academySubmit(createAcademyState(),[],
    'grep FATAL ~/practice/events.log','exit-status');
  assert.equal(entry.completed,false);
  assert.equal(entry.result.exitCode,1);
  entry=academySubmit(entry.result.state,entry.events,'echo $?','exit-status');
  assert.equal(entry.completed,false);
  entry=academySubmit(entry.result.state,entry.events,
    'grep WARN ~/practice/events.log','exit-status');
  assert.equal(entry.completed,false);
  entry=academySubmit(entry.result.state,entry.events,'echo $?','exit-status');
  assert.equal(entry.completed,true);
  assert.equal(statusCompleted('intro',entry.events),true);
});

test('intervening command invalidates immediate $? observation',()=>{
  let entry=academySubmit(createAcademyState(),[],
    'grep FATAL ~/practice/events.log','exit-status');
  entry=academySubmit(entry.result.state,entry.events,'pwd','exit-status');
  entry=academySubmit(entry.result.state,entry.events,'echo $?','exit-status');
  entry=academySubmit(entry.result.state,entry.events,
    'grep WARN ~/practice/events.log','exit-status');
  entry=academySubmit(entry.result.state,entry.events,'echo $?','exit-status');
  assert.equal(entry.completed,false);
});

test('transfer uses other log and grants mastery despite intentional no-match',()=>{
  let entry=submitTransfer(createTransferState('exit-status'),[],
    'grep CRITICAL ~/practice/logs/review.log','exit-status');
  assert.equal(entry.result.exitCode,1);
  assert.equal(transferMistake('exit-status',entry.result,entry.completed),false);
  entry=submitTransfer(entry.result.state,entry.events,'echo $?','exit-status');
  entry=submitTransfer(entry.result.state,entry.events,
    'grep ERROR ~/practice/logs/review.log','exit-status');
  assert.equal(transferMistake('exit-status',entry.result,entry.completed),false);
  entry=submitTransfer(entry.result.state,entry.events,'echo $?','exit-status');
  assert.equal(entry.completed,true);
  assert.equal(earnedMastery(true,0,false),true);
  assert.equal(statusCompleted('transfer',entry.events),true);
});

test('unrelated failed command still penalizes the transfer',()=>{
  const bad=submitTransfer(createTransferState('exit-status'),[],'cat nonexistent','exit-status');
  assert.equal(transferMistake('exit-status',bad.result,bad.completed),true);
});

test('curriculum adds exactly one lesson and transfer',()=>{
  assert.equal(commandLessons.length,34);
  assert.equal(transferChallenges.length,34);
  assert.deepEqual(commandLessons.map(x=>x.id),transferChallenges.map(x=>x.lessonId));
});
