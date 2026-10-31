import test from 'node:test';
import assert from 'node:assert/strict';
import {executeLinux} from '../src/core/linux.ts';
import {scanShell} from '../src/core/shellSyntax.ts';
import {parseConditionals,CONDITIONAL_LIMIT} from '../src/core/conditionals.ts';
import {createAcademyState,academySubmit,commandLessons} from '../src/core/commandAcademy.ts';
import {createTransferState,submitTransfer,transferChallenges,transferMistake} from '../src/core/academyTransfer.ts';
import {conditionalCase,conditionalCompleted} from '../src/core/conditionalLesson.ts';
import {assertWorldUnchanged} from './assertWorldUnchanged.mjs';

const run=(s,raw)=>executeLinux(s,raw);

test('unquoted && and || are tokens; quoted or escaped variants remain filenames',()=>{
  const words=scanShell('test -f "a&&b" && touch a\\|\\|b || touch "c||d"');
  assert.deepEqual(words.filter(x=>x.kind!=='word').map(x=>x.kind),['and','or']);
  const s=createAcademyState();
  const r=run(s,'touch ~/practice/file\\&\\&safe.txt');
  assert.equal(r.ok,true);
  assert.ok(Object.hasOwn(r.state.files,'/home/player/practice/file&&safe.txt'));
  const quoted=run(r.state,'touch "~/practice/file||safe.txt"');
  assert.equal(quoted.ok,true);
  assert.ok(Object.hasOwn(quoted.state.files,'/home/player/practice/file||safe.txt'));
  assert.equal(parseConditionals('touch "file&&safe"'),undefined);
});

test('&& executes a guarded copy only if a condition succeeds',()=>{
  const s=createAcademyState();
  const cmd='test -f ~/practice/source.txt && cp ~/practice/source.txt ~/practice/guarded-copy.txt';
  const r=run(s,cmd);
  assert.equal(r.ok,true);
  assert.equal(r.exitCode,0);
  assert.equal(r.command,'conditional');
  assert.deepEqual(r.conditionalTrace.map(x=>x.executed),[true,true]);
  assert.deepEqual(r.conditionalTrace.map(x=>x.exitCode),[0,0]);
  assert.equal(r.state.files['/home/player/practice/guarded-copy.txt'],'COPY_ME');
  assert.equal(s.files['/home/player/practice/guarded-copy.txt'],undefined);
});

test('failed test skips && side effects and keeps the failure status',()=>{
  const s=createAcademyState(),snapshot=structuredClone(s);
  const r=run(s,'test -f ~/practice/absent.log && rm ~/practice/source.txt');
  assert.equal(r.ok,false);
  assert.equal(r.exitCode,1);
  assert.deepEqual(r.conditionalTrace.map(x=>x.executed),[true,false]);
  assertWorldUnchanged(r.state,snapshot);
  assert.equal(run(r.state,'echo $?').output,'1');
});

test('|| recovers only from failure; a successful guard skips fallback',()=>{
  const s=createAcademyState();
  const skip=run(s,'test -f ~/practice/source.txt || touch ~/practice/unnecessary.flag');
  assert.equal(skip.ok,true);
  assert.deepEqual(skip.conditionalTrace.map(x=>x.executed),[true,false]);
  assert.equal(skip.state.files['/home/player/practice/unnecessary.flag'],undefined);
  const fallback=run(skip.state,'test -f ~/practice/absent.log || touch ~/practice/needed.flag');
  assert.equal(fallback.ok,true);
  assert.equal(fallback.exitCode,0);
  assert.deepEqual(fallback.conditionalTrace.map(x=>x.executed),[true,true]);
  assert.equal(fallback.state.files['/home/player/practice/needed.flag'],'');
});

test('conditional operators share precedence and associate left-to-right',()=>{
  const s=createAcademyState();
  const first=run(s,'test -f ~/practice/absent.log && touch ~/practice/skipped.tmp || touch ~/practice/fallback.tmp');
  assert.deepEqual(first.conditionalTrace.map(x=>x.executed),[true,false,true]);
  assert.equal(first.state.files['/home/player/practice/fallback.tmp'],'');
  assert.equal(first.state.files['/home/player/practice/skipped.tmp'],undefined);
  const second=run(first.state,'test -f ~/practice/source.txt || touch ~/practice/no.tmp && touch ~/practice/yes.tmp');
  assert.deepEqual(second.conditionalTrace.map(x=>x.executed),[true,false,true]);
  assert.equal(second.state.files['/home/player/practice/no.tmp'],undefined);
  assert.equal(second.state.files['/home/player/practice/yes.tmp'],'');
});

test('intermediate failures and echo $? use the most recent executed command',()=>{
  const s=createAcademyState();
  const r=run(s,'test -f ~/practice/absent.log || echo $?');
  assert.equal(r.ok,true);
  assert.equal(r.output,'1');
  assert.equal(r.exitCode,0);
  assert.equal(r.state.lastExitCode,0);
  assert.equal(run(r.state,'echo $?').output,'0');
});

test('pipeline and redirect can be gated, with stdout written only after success',()=>{
  const s=createAcademyState();
  const cmd='test -f ~/practice/alerts.log && grep WARN ~/practice/alerts.log | sort | uniq | wc -l > "~/practice/guarded count.txt"';
  const r=run(s,cmd);
  assert.equal(r.ok,true);
  assert.equal(r.state.files['/home/player/practice/guarded count.txt'],'2\n');
  const skipped=run(s,'test -f ~/practice/absent.log && grep WARN ~/practice/alerts.log > ~/practice/no-report.txt');
  assert.equal(skipped.ok,false);
  assert.equal(skipped.state.files['/home/player/practice/no-report.txt'],undefined);
  assert.deepEqual(skipped.conditionalTrace.map(x=>x.executed),[true,false]);
});

test('malformed and oversized chains are rejected before any command runs',()=>{
  const s=createAcademyState(),snapshot=structuredClone(s);
  const invalid=[
    'touch ~/practice/a.tmp &&',
    'touch ~/practice/a.tmp ||',
    'touch ~/practice/a.tmp && || touch ~/practice/b.tmp',
    'touch ~/practice/a.tmp && > ~/practice/output',
    'touch ~/practice/a.tmp && cat "unfinished',
    'touch ~/practice/a.tmp && cat ~/practice/source.txt |',
    'touch ~/practice/a.tmp &&& touch ~/practice/b.tmp',
    'touch ~/practice/a.tmp ||| touch ~/practice/b.tmp',
    'touch ~/practice/a.tmp & touch ~/practice/b.tmp',
    'touch ~/practice/a.tmp; touch ~/practice/b.tmp',
    Array.from({length:CONDITIONAL_LIMIT+1},(_,i)=>'touch ~/practice/too-many-'+i+'.txt').join(' && ')
  ];
  for(const input of invalid){
    const r=run(s,input);
    assert.equal(r.ok,false,input);
    assertWorldUnchanged(r.state,snapshot,input);
  }
});

test('intro completion requires guarded copy, a truly skipped branch, fallback and readback',()=>{
  const c=conditionalCase('intro');
  let step=academySubmit(createAcademyState(),[],
    'test -f '+c.source+' && cp '+c.source+' '+c.destination,'conditionals');
  assert.equal(step.completed,false);
  step=academySubmit(step.result.state,step.events,
    'test -f '+c.absent+' && touch '+c.forbidden,'conditionals');
  assert.equal(step.completed,false);
  assert.equal(step.result.exitCode,1);
  step=academySubmit(step.result.state,step.events,
    'test -f '+c.absent+' || touch '+c.fallback,'conditionals');
  assert.equal(step.completed,false);
  step=academySubmit(step.result.state,step.events,'cat '+c.destination,'conditionals');
  assert.equal(step.completed,true);
  assert.equal(conditionalCompleted('intro',step.result.state,step.events),true);
});

test('independent transfer penalizes wrong targets and does not reward direct file creation',()=>{
  const c=conditionalCase('transfer');
  const original=createTransferState('conditionals');
  const wrong=submitTransfer(original,[],
    'test -f '+c.source+' && cp '+c.source+' ~/practice/logs/wrong-copy.log','conditionals');
  assert.equal(wrong.result.ok,true);
  assert.equal(transferMistake('conditionals',wrong.result,wrong.completed),true);
  assert.equal(conditionalCompleted('transfer',wrong.result.state,wrong.events),false);

  let step=submitTransfer(original,[],
    'test -f '+c.source+' && cp '+c.source+' '+c.destination,'conditionals');
  assert.equal(transferMistake('conditionals',step.result,step.completed),false);
  step=submitTransfer(step.result.state,step.events,
    'test -f '+c.absent+' && touch '+c.forbidden,'conditionals');
  assert.equal(step.result.exitCode,1);
  assert.equal(transferMistake('conditionals',step.result,step.completed),false);
  step=submitTransfer(step.result.state,step.events,
    'test -f '+c.absent+' || touch '+c.fallback,'conditionals');
  assert.equal(transferMistake('conditionals',step.result,step.completed),false);
  step=submitTransfer(step.result.state,step.events,'cat '+c.destination,'conditionals');
  assert.equal(step.completed,true);
});

test('catalogs add one new independent conditional lesson without resetting progress',()=>{
  assert.equal(commandLessons.length,35);
  assert.equal(transferChallenges.length,35);
  assert.deepEqual(commandLessons.map(x=>x.id),transferChallenges.map(x=>x.lessonId));
  assert.equal(run(createAcademyState(),'man conditionals').ok,true);
});
