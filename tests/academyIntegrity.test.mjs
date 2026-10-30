import test from 'node:test';
import assert from 'node:assert/strict';
import { createAcademyState, academySubmit } from '../src/core/commandAcademy.ts';
import { createTransferState, submitTransfer, transferMistake, earnedMastery } from '../src/core/academyTransfer.ts';
import { executeLinux } from '../src/core/linux.ts';

test('successful wrong-target chmod now invalidates a clean transfer',()=>{
  const first=submitTransfer(createTransferState('chmod'),[],'chmod 640 ~/practice/team.key','chmod');
  assert.equal(first.result.ok,true);
  assert.equal(first.completed,false);
  assert.equal(transferMistake('chmod',first.result,first.completed),true);
  const next=submitTransfer(first.result.state,first.events,'chmod 600 ~/practice/team.key','chmod');
  assert.equal(next.completed,true);
  assert.equal(earnedMastery(true,Number(transferMistake('chmod',first.result,first.completed)),false),false);
});

test('successful cp into the wrong file is a miss although the command executes',()=>{
  const wrong=submitTransfer(createTransferState('cp'),[],
    'cp ~/practice/intro.txt ~/practice/backup.txt','cp');
  assert.equal(wrong.result.ok,true);
  assert.equal(wrong.completed,false);
  assert.equal(transferMistake('cp',wrong.result,false),true);
});

test('wrong but successful ls target is a miss while exploration remains allowed',()=>{
  const seed=createTransferState('ls');
  const wrong=submitTransfer(seed,[],'ls ~/documents','ls');
  assert.equal(wrong.result.ok,true);
  assert.equal(wrong.completed,false);
  assert.equal(transferMistake('ls',wrong.result,false),true);

  const exploratory=submitTransfer(seed,[],'pwd','ls');
  assert.equal(exploratory.result.ok,true);
  assert.equal(exploratory.completed,false);
  assert.equal(transferMistake('ls',exploratory.result,false),false);
});

test('failed exploratory command still counts as a mistake',()=>{
  const wrong=submitTransfer(createTransferState('grep'),[],'cat missing.txt','grep');
  assert.equal(wrong.result.ok,false);
  assert.equal(transferMistake('grep',wrong.result,false),true);
});

test('successful focused transfer completion is clean',()=>{
  const correct=submitTransfer(createTransferState('find'),[],
    'find ~/practice -name "audit-*.txt"','find');
  assert.equal(correct.result.ok,true);
  assert.equal(correct.completed,true);
  assert.equal(transferMistake('find',correct.result,true),false);
  assert.equal(earnedMastery(correct.completed,0,false),true);
});

test('find must actually search the scope stated in the learning assignment',()=>{
  const broadIntro=academySubmit(createAcademyState(),[],
    'find / -name "ticket-*.txt"','find');
  assert.equal(broadIntro.result.ok,true);
  assert.equal(broadIntro.completed,false);
  const broadTransfer=submitTransfer(createTransferState('find'),[],
    'find / -name "audit-*.txt"','find');
  assert.equal(broadTransfer.result.ok,true);
  assert.equal(broadTransfer.completed,false);
  assert.equal(transferMistake('find',broadTransfer.result,false),true);
});

test('find explicit dot, default root and absolute root all parse correctly',()=>{
  const seed=createAcademyState();
  const directory=executeLinux(seed,'cd ~/practice');
  assert.equal(directory.ok,true);
  const dot=executeLinux(directory.state,'find . -name "ticket-*.txt"');
  assert.equal(dot.ok,true);
  assert.match(dot.output,/ticket-42.txt/);
  assert.equal(dot.target,'/home/player/practice');
  const implicit=executeLinux(directory.state,'find -name "ticket-*.txt"');
  assert.equal(implicit.ok,true);
  assert.equal(implicit.output,dot.output);
  const explicit=executeLinux(directory.state,'find ~/practice -name "ticket-*.txt"');
  assert.equal(explicit.ok,true);
  assert.equal(explicit.output,dot.output);
});

test('find explicit dot with no pattern returns paths without syntax errors',()=>{
  const seed=createAcademyState();
  const result=executeLinux(seed,'find .');
  assert.equal(result.ok,true);
  assert.equal(result.target,'/home/player');
  assert.match(result.output,/\/home\/player\/practice/);
});

test('focused mistakes do not alter virtual system or auto-complete lesson',()=>{
  const seed=createTransferState('chmod');
  const original=structuredClone(seed);
  const result=submitTransfer(seed,[],'chmod 640 ~/practice/team.key','chmod');
  assert.equal(result.completed,false);
  assert.equal(transferMistake('chmod',result.result,result.completed),true);
  assert.deepEqual(seed,original);
  assert.equal(result.result.state.permissions['/home/player/practice/team.key'],0o640);
});
