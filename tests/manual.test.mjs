import test from 'node:test';
import assert from 'node:assert/strict';
import { executeLinux, initialLinux } from '../src/core/linux.ts';
import { manualTopics, usedManualBefore } from '../src/core/manual.ts';
import { academySubmit, createAcademyState, restoreAcademyProgress } from '../src/core/commandAcademy.ts';
import { createTransferState, submitTransfer, transferMistake, earnedMastery } from '../src/core/academyTransfer.ts';
import { explainAcademyAttempt } from '../src/core/academyFeedback.ts';

test('man grep documents -i without changing the virtual system',()=>{
  const state=createAcademyState();
  const snapshot=structuredClone(state);
  const page=executeLinux(state,'man grep');
  assert.equal(page.ok,true);
  assert.equal(page.command,'man');
  assert.equal(page.target,'grep');
  assert.match(page.output,/grep \[-i\] TEKST PLIK/);
  assert.match(page.output,/-i  Ignoruj wielkosc liter/);
  assert.deepEqual(page.state,snapshot);
  assert.deepEqual(state,snapshot);
  assert.ok(manualTopics.includes('grep'));
});

test('man head documents -n while searchable man -k stays read-only',()=>{
  const seed=createTransferState('man');
  const page=executeLinux(seed,'man head');
  assert.equal(page.ok,true);
  assert.match(page.output,/-n LICZBA/);
  const find=executeLinux(seed,'man -k wiersze');
  assert.equal(find.ok,true);
  assert.match(find.output,/head/);
  assert.equal(find.target,'search:wiersze');
  assert.deepEqual(find.state,seed);
});

test('man rejects nonexistent pages, extra args and empty lookups',()=>{
  for(const raw of ['man','man awk','man grep head','man -k','man -k not-a-real-topic']){
    const r=executeLinux(initialLinux(),raw);
    assert.equal(r.ok,false,raw);
    assert.equal(r.command,'man');
  }
  assert.equal(executeLinux(initialLinux(),'man cat | rm file').ok,false);
});

test('reading man alone cannot complete the introduction',()=>{
  const seed=createAcademyState();
  const first=academySubmit(seed,[],'man grep','man');
  assert.equal(first.result.ok,true);
  assert.equal(first.completed,false);
  const feedback=explainAcademyAttempt('man',seed,first.result,false);
  assert.equal(feedback.status,'partial');
  assert.match(feedback.detail,/Samo przeczytanie/);
});

test('manual use must precede applying the correct case insensitive option',()=>{
  const seed=createAcademyState();
  const without=academySubmit(seed,[],'grep -i error ~/practice/manual.log','man');
  assert.equal(without.result.ok,true);
  assert.equal(without.completed,false);
  assert.equal(without.result.grepCaseInsensitive,true);

  const docs=academySubmit(seed,[],'man grep','man');
  const wrong=academySubmit(docs.result.state,docs.events,'grep ERROR ~/practice/manual.log','man');
  assert.equal(wrong.result.ok,true);
  assert.equal(wrong.completed,false);
  assert.equal(wrong.result.grepCaseInsensitive,false);

  const solution=academySubmit(wrong.result.state,wrong.events,
    'grep -i error ~/practice/manual.log','man');
  assert.equal(solution.completed,true);
  assert.equal(solution.result.output,'ERROR backup permission denied');
  assert.equal(usedManualBefore(solution.events,'grep','grep',r=>r.grepCaseInsensitive===true),true);
});

test('manual written after an action does not retroactively solve the lesson',()=>{
  const first=academySubmit(createAcademyState(),[],
    'grep -i error ~/practice/manual.log','man');
  const second=academySubmit(first.result.state,first.events,'man grep','man');
  assert.equal(second.completed,false);
});

test('transfer uses a different command, different log and real -n result',()=>{
  const seed=createTransferState('man');
  const doc=submitTransfer(seed,[],'man head','man');
  assert.equal(doc.completed,false);
  assert.equal(transferMistake('man',doc.result,false),false);
  const finish=submitTransfer(doc.result.state,doc.events,
    'head -n 2 ~/practice/logs/manual-review.log','man');
  assert.equal(finish.completed,true);
  assert.equal(finish.result.output,'WARN service slow\nINFO restart scheduled');
  assert.equal(transferMistake('man',finish.result,true),false);
  assert.equal(earnedMastery(true,0,false),true);
  assert.equal(createAcademyState().files['/home/player/practice/logs/manual-review.log'],undefined);
});

test('a successful but premature head attempt does not earn independent mastery',()=>{
  const seed=createTransferState('man');
  const premature=submitTransfer(seed,[],
    'head -n 2 ~/practice/logs/manual-review.log','man');
  assert.equal(premature.result.ok,true);
  assert.equal(premature.completed,false);
  assert.equal(transferMistake('man',premature.result,false),true);
  const doc=submitTransfer(premature.result.state,premature.events,'man head','man');
  const complete=submitTransfer(doc.result.state,doc.events,
    'head -n 2 ~/practice/logs/manual-review.log','man');
  assert.equal(complete.completed,true);
  assert.equal(earnedMastery(true,1,false),false);
});

test('existing progress is preserved and man is a new unmastered exercise',()=>{
  const restored=restoreAcademyProgress({
    selectedId:'investigation',completed:['pwd','pipeline','investigation'],
    mastered:['pwd','pipeline']
  });
  assert.equal(restored.selectedId,'investigation');
  assert.deepEqual(restored.completed,['pwd','pipeline','investigation']);
  assert.deepEqual(restored.mastered,['pwd','pipeline']);
  assert.ok(!restored.completed.includes('man'));
});
