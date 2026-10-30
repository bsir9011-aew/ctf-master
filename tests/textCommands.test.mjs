import test from 'node:test';
import assert from 'node:assert/strict';
import { executeLinux, initialLinux } from '../src/core/linux.ts';
import { academySubmit, createAcademyState, commandLessons, restoreAcademyProgress } from '../src/core/commandAcademy.ts';
import { createTransferState, submitTransfer, transferChallenges, transferMistake } from '../src/core/academyTransfer.ts';
import { recommendAcademy } from '../src/core/academyCoach.ts';

function exec(raw,state=createAcademyState()) {return executeLinux(state,raw);}
const textIds=['head','tail','wc','sort','uniq'];

test('all five command names are present in the learning and transfer catalogues',()=>{
  assert.equal(commandLessons.length,24);
  assert.equal(transferChallenges.length,24);
  for(const id of textIds) {
    assert.equal(commandLessons.filter(x=>x.id===id).length,1);
    assert.equal(transferChallenges.filter(x=>x.lessonId===id).length,1);
  }
});

test('head supports explicit count and defaults to 10 lines',()=>{
  const first=exec('head -n 3 ~/practice/timeline.log');
  assert.equal(first.ok,true);
  assert.equal(first.output,'INFO boot\nWARN latency\nINFO cache');
  assert.equal(first.target,'/home/player/practice/timeline.log');
  assert.equal(exec('head ~/practice/timeline.log').output.split('\n').length,7);
  assert.equal(exec('head -n 1 ~/practice/timeline.log').output,'INFO boot');
});

test('tail returns final lines and supports the same -n syntax',()=>{
  assert.equal(exec('tail -n 2 ~/practice/timeline.log').output,'WARN queue\nINFO stable');
  assert.equal(exec('tail -n 1 ~/practice/timeline.log').output,'INFO stable');
  assert.equal(exec('tail ~/practice/timeline.log').output.split('\n').length,7);
});

test('wc uses newline count and distinguishes lines, words, bytes',()=>{
  const seed=createAcademyState();
  assert.equal(exec('wc -l ~/practice/timeline.log',seed).output,'7');
  assert.equal(exec('wc -l ~/practice/intro.txt',seed).output,'0');
  assert.equal(exec('wc -w ~/practice/intro.txt',seed).output,'6');
  assert.equal(exec('wc -c ~/practice/intro.txt',seed).output,
    String(new TextEncoder().encode(seed.files['/home/player/practice/intro.txt']).length));
  assert.match(exec('wc ~/practice/timeline.log',seed).output,/^7 \d+ \d+$/);
});

test('sort orders lines but leaves the file content untouched',()=>{
  const seed=createAcademyState();
  const before=structuredClone(seed);
  const result=exec('sort ~/practice/names.txt',seed);
  assert.equal(result.ok,true);
  assert.equal(result.output,'anna\nmarta\nzoe');
  assert.deepEqual(result.state,before);
});

test('uniq removes only adjacent duplicates, not all equal lines',()=>{
  const result=exec('uniq ~/practice/levels.txt');
  assert.equal(result.ok,true);
  assert.equal(result.output,'INFO\nWARN\nINFO');
  assert.equal(result.output.split('\n').filter(x=>x==='INFO').length,2);
});

test('all five commands reject missing files and protected files',()=>{
  let protectedState=exec('chmod 000 ~/practice/timeline.log');
  assert.equal(protectedState.ok,true);
  for(const cmd of ['head','tail','wc','sort','uniq']) {
    const missing=exec(cmd+' ~/practice/not-real.txt');
    assert.equal(missing.ok,false,cmd);
    assert.match(missing.output,/No such file/);
    const denied=exec(cmd+' ~/practice/timeline.log',protectedState.state);
    assert.equal(denied.ok,false,cmd);
    assert.match(denied.output,/Permission denied/);
  }
});

test('invalid counts and unsupported pipes are not silently accepted',()=>{
  for(const raw of ['head -n 0 ~/practice/timeline.log','tail -n -1 ~/practice/timeline.log',
    'head -n nope ~/practice/timeline.log','head -n 101 ~/practice/timeline.log',
    'tail -n 1.5 ~/practice/timeline.log',
    'wc -z ~/practice/timeline.log','sort ~/practice/names.txt foo',
    'uniq ~/practice/levels.txt extra','sort ~/practice/names.txt | rm ~/practice/source.txt']) {
    const res=exec(raw);
    assert.equal(res.ok,false,raw);
  }
});

test('all five training lessons require exact observed outcome and target',()=>{
  const intro={
    head:'head -n 3 ~/practice/timeline.log',tail:'tail -n 2 ~/practice/timeline.log',
    wc:'wc -l ~/practice/timeline.log',sort:'sort ~/practice/names.txt',
    uniq:'uniq ~/practice/levels.txt'
  };
  for(const id of textIds){
    const start=createAcademyState();
    assert.equal(academySubmit(start,[],'pwd',id).completed,false,id);
    const correct=academySubmit(start,[],intro[id],id);
    assert.equal(correct.completed,true,id);
  }
});

test('every transfer requires different data from its introduction and is isolated',()=>{
  const commands={
    head:'head -n 2 ~/practice/logs/review.log',
    tail:'tail -n 3 ~/practice/logs/review.log',
    wc:'wc -l ~/practice/logs/review.log',
    sort:'sort ~/practice/review-names.txt',
    uniq:'uniq ~/practice/review-levels.txt'
  };
  const base=createAcademyState();
  const prior=structuredClone(base);
  for(const id of textIds){
    const start=createTransferState(id);
    assert.equal(transferChallenges.find(x=>x.lessonId===id).pass(start,[]),false,id);
    const correct=submitTransfer(start,[],commands[id],id);
    assert.equal(correct.result.ok,true,id);
    assert.equal(correct.completed,true,id);
    assert.equal(transferMistake(id,correct.result,correct.completed),false,id);
  }
  assert.deepEqual(base,prior);
  assert.equal(initialLinux().files['/home/player/practice/logs/review.log'],undefined);
});

test('legacy academy progress is retained and new lessons are recommended',()=>{
  const old=restoreAcademyProgress({selectedId:'chmod',completed:['pwd'],mastered:['pwd']});
  assert.equal(old.selectedId,'chmod');
  assert.deepEqual(old.completed,['pwd']);
  assert.deepEqual(old.mastered,['pwd']);
  const allOld=commandLessons.filter(x=>!textIds.includes(x.id)).map(x=>x.id);
  const p={completed:allOld,mastered:allOld};
  const recommendation=recommendAcademy(p,{});
  assert.equal(recommendation.lessonId,'head');
  assert.equal(recommendation.phase,'intro');
});
