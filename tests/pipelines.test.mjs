import {assertWorldUnchanged} from './assertWorldUnchanged.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {executeLinux,initialLinux} from '../src/core/linux.ts';
import {createAcademyState,academySubmit,commandLessons,restoreAcademyProgress} from '../src/core/commandAcademy.ts';
import {createTransferState,submitTransfer,transferChallenges,transferMistake} from '../src/core/academyTransfer.ts';
import {splitPipeline,PIPELINE_LIMIT} from '../src/core/pipelines.ts';

const run=(raw,state=createAcademyState())=>executeLinux(state,raw);

test('quoted pipe is data, not a separator',()=>{
  assert.deepEqual(splitPipeline('grep "WARN|INFO" ~/practice/alerts.log'),[
    'grep "WARN|INFO" ~/practice/alerts.log'
  ]);
  assert.deepEqual(splitPipeline("grep 'a|b' x | wc -l"),[
    "grep 'a|b' x","wc -l"
  ]);
  const r=run('grep "WARN|INFO" ~/practice/alerts.log');
  assert.equal(r.command,'grep');
  assert.equal(r.ok,false);
});

test('real read-only pipeline filters, sorts, deduplicates and counts',()=>{
  const original=createAcademyState();
  const before=structuredClone(original);
  const r=run('grep WARN ~/practice/alerts.log | sort | uniq | wc -l',original);
  assert.equal(r.ok,true);
  assert.equal(r.command,'pipeline');
  assert.deepEqual(r.stages,['grep','sort','uniq','wc']);
  assert.equal(r.target,'/home/player/practice/alerts.log');
  assert.equal(r.filterPattern,'WARN');
  assert.equal(r.output,'2');
  assert.deepEqual(original,before);
  assert.deepEqual(r.state,before);
});

test('without sort, uniq removes only adjacent duplicates',()=>{
  const plain=run('grep WARN ~/practice/alerts.log | uniq | wc -l');
  assert.equal(plain.ok,true);
  assert.equal(plain.output,'4');
  const sorted=run('grep WARN ~/practice/alerts.log | sort | uniq | wc -l');
  assert.equal(sorted.output,'2');
});

test('pipeline supports direct file input and filters with whitespace quotes',()=>{
  const r=run('cat ~/practice/timeline.log | grep "WARN queue" | wc -l');
  assert.equal(r.ok,true);
  assert.equal(r.output,'1');
  assert.deepEqual(r.stages,['cat','grep','wc']);
});

test('pipeline can use sort, head and tail without file arguments downstream',()=>{
  const a=run('sort ~/practice/names.txt | head -n 2');
  assert.equal(a.ok,true);
  assert.equal(a.output,'anna\nmarta');
  const b=run('sort ~/practice/names.txt | tail -n 1');
  assert.equal(b.ok,true);
  assert.equal(b.output,'zoe');
});

test('wc counts stream lines, words and UTF8 bytes',()=>{
  const lines=run('cat ~/practice/names.txt | wc -l');
  assert.equal(lines.output,'3');
  const words=run('cat ~/practice/names.txt | wc -w');
  assert.equal(words.output,'3');
  const bytes=run('cat ~/practice/names.txt | wc -c');
  assert.equal(bytes.output,String(new TextEncoder().encode('zoe\nanna\nmarta\n').length));
});

test('cat preserves missing final newline when wc counts incoming lines',()=>{
  const r=run('cat ~/practice/intro.txt | wc -l');
  assert.equal(r.ok,true);
  assert.equal(r.output,'0');
});

test('a matching numeric result from the wrong log category cannot pass',()=>{
  const seed=createAcademyState();
  const wrong=academySubmit(seed,[],
    'grep INFO ~/practice/alerts.log | sort | uniq | wc -l','pipeline');
  assert.equal(wrong.result.ok,true);
  assert.equal(wrong.result.output,'2');
  assert.equal(wrong.completed,false);
  assert.equal(transferMistake('pipeline',wrong.result,wrong.completed),true);
});

test('empty and malformed pipelines are rejected',()=>{
  for(const raw of [
    'cat ~/practice/names.txt |',
    '| wc -l',
    'cat ~/practice/names.txt || wc -l',
    'cat ~/practice/names.txt | | sort',
    'cat ~/practice/names.txt | grep "oops',
    'cat ~/practice/names.txt | grep',
  ]) {
    const r=run(raw);
    assert.equal(r.ok,false,raw);
    assert.equal(r.command,'pipeline',raw);
  }
});

test('pipeline stage limit is enforced',()=>{
  assert.equal(PIPELINE_LIMIT,5);
  const accepted=run('cat ~/practice/names.txt | sort | uniq | head -n 3 | wc -l');
  assert.equal(accepted.ok,true);
  const tooLong=run('cat ~/practice/names.txt | sort | uniq | head | tail | wc -l');
  assert.equal(tooLong.ok,false);
  assert.match(tooLong.output,/2-5/);
});

test('unsafe stages, redirects, separators and invented commands are rejected without side effects',()=>{
  const seed=createAcademyState();
  const before=structuredClone(seed);
  for(const raw of [
    'rm ~/practice/source.txt | wc -l',
    'cat ~/practice/names.txt | rm ~/practice/source.txt',
    'cat ~/practice/names.txt | cp a b',
    'cat ~/practice/names.txt | not-real',
    'cat ~/practice/names.txt | sort >',
    'cat ~/practice/names.txt | wc -l; rm ~/practice/source.txt',
    'cat ~/practice/names.txt | head -n 1 ~/practice/events.log'
  ]) {
    const r=run(raw,seed);
    assert.equal(r.ok,false,raw);
    assertWorldUnchanged(r.state,before,raw);
  }
  assert.deepEqual(seed,before);
});

test('unreadable source is rejected and later stages cannot run',()=>{
  const seed=createAcademyState();
  const blocked=run('chmod 000 ~/practice/alerts.log',seed);
  assert.equal(blocked.ok,true);
  const r=run('cat ~/practice/alerts.log | wc -l',blocked.state);
  assert.equal(r.ok,false);
  assert.match(r.output,/Permission denied/);
});

test('no matching grep stage stops the pipeline with a useful error',()=>{
  const r=run('cat ~/practice/alerts.log | grep FATAL | wc -l');
  assert.equal(r.ok,false);
  assert.match(r.output,/grep nie znalazl/);
});

test('lesson completion validates real output, source and allowed stage sequence',()=>{
  assert.equal(commandLessons.length,33);
  assert.equal(transferChallenges.length,33);
  const id='pipeline',base=createAcademyState();
  const wrong=academySubmit(base,[],'grep WARN ~/practice/alerts.log | wc -l',id);
  assert.equal(wrong.result.ok,true);
  assert.equal(wrong.completed,false);
  const right=academySubmit(base,[],'grep WARN ~/practice/alerts.log | sort | uniq | wc -l',id);
  assert.equal(right.completed,true);
  assert.equal(right.result.output,'2');
});

test('transfer is different and guards against successful wrong-target attempts',()=>{
  const id='pipeline',seed=createTransferState(id);
  const first=submitTransfer(seed,[],'grep ERROR ~/practice/logs/incidents.log | wc -l',id);
  assert.equal(first.result.ok,true);
  assert.equal(first.completed,false);
  assert.equal(transferMistake(id,first.result,first.completed),true);
  const second=submitTransfer(seed,[],'grep ERROR ~/practice/logs/incidents.log | sort | uniq | wc -l',id);
  assert.equal(second.result.ok,true);
  assert.equal(second.completed,true);
  assert.equal(second.result.output,'3');
  assert.equal(transferMistake(id,second.result,second.completed),false);
});

test('prior academy progress is preserved without inventing pipeline mastery',()=>{
  const restored=restoreAcademyProgress({
    selectedId:'uniq',completed:['pwd','uniq'],mastered:['pwd','uniq']
  });
  assert.equal(restored.selectedId,'uniq');
  assert.deepEqual(restored.completed,['pwd','uniq']);
  assert.deepEqual(restored.mastered,['pwd','uniq']);
  assert.ok(!restored.completed.includes('pipeline'));
  assert.equal(initialLinux().files['/home/player/practice/alerts.log'],undefined);
});
