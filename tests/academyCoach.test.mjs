import test from 'node:test';
import assert from 'node:assert/strict';
import { commandLessons,restoreAcademyProgress } from '../src/core/commandAcademy.ts';
import {
  recommendAcademy, recordCoachSignal, restoreCoachMetrics
} from '../src/core/academyCoach.ts';

const empty=()=>restoreAcademyProgress(null);
const progress=(completed,mastered=[])=>({...empty(),completed,mastered});
const metrics=(id,errors,help)=>({[id]:{errors,help}});

test('brand new learner is directed to first command introduction',()=>{
  const suggestion=recommendAcademy(empty(),{});
  assert.equal(suggestion.lessonId,commandLessons[0].id);
  assert.equal(suggestion.phase,'intro');
});

test('known-but-unmastered command is recommended for transfer before a new lesson',()=>{
  const result=recommendAcademy(progress(['pwd']),{});
  assert.equal(result.lessonId,'pwd');
  assert.equal(result.phase,'transfer');
});

test('prior errors and help prioritize the weakest unfinished skill',()=>{
  const data=progress(['pwd','ls','cat']);
  const stats={...metrics('pwd',1,0),...metrics('ls',2,3),...metrics('cat',0,2)};
  const result=recommendAcademy(data,stats);
  assert.equal(result.lessonId,'ls');
  assert.equal(result.phase,'transfer');
  assert.match(result.reason,/pomocy/);
});

test('clean mastery is not incorrectly assigned again despite previous errors',()=>{
  const result=recommendAcademy(progress(['pwd','ls'],['pwd']),metrics('pwd',60,20));
  assert.equal(result.lessonId,'ls');
});

test('after completing all transfers no fake next lesson is recommended',()=>{
  const ids=commandLessons.map(x=>x.id);
  assert.equal(recommendAcademy(progress(ids,ids),{}),null);
});

test('learning the entire introduction curriculum moves recommendation to unmastered transfer',()=>{
  const ids=commandLessons.map(x=>x.id);
  const result=recommendAcademy(progress(ids),{});
  assert.equal(result.phase,'transfer');
  assert.equal(result.lessonId,'pwd');
});

test('signals only update the intended lesson and are bounded',()=>{
  const original={pwd:{errors:5,help:1}};
  const next=recordCoachSignal(original,'ls','errors');
  assert.equal(original.ls,undefined);
  assert.deepEqual(next,{pwd:{errors:5,help:1},ls:{errors:1,help:0}});
  assert.deepEqual(recordCoachSignal(next,'ls','help').ls,{errors:1,help:1});
  assert.equal(recordCoachSignal(original,'unknown','errors'),original);
  assert.equal(recordCoachSignal({pwd:{errors:999,help:999}},'pwd','errors').pwd.errors,999);
});

test('saved difficulty data tolerates missing, unknown and corrupt records',()=>{
  assert.deepEqual(restoreCoachMetrics(null),{});
  assert.deepEqual(restoreCoachMetrics([]),{});
  assert.deepEqual(restoreCoachMetrics({
    pwd:{errors:3,help:2}, ls:{errors:-10,help:1}, hacked:{errors:900,help:900},
    cat:{errors:1.5,help:'4'}, cp:{errors:999999,help:0}
  }),{
    pwd:{errors:3,help:2},ls:{errors:0,help:1},cp:{errors:999,help:0}
  });
});

test('migration keeps existing RC.4 completions with no saved weakness data',()=>{
  const migrated=restoreAcademyProgress({selectedId:'find',completed:['pwd','find'],mastered:['pwd']});
  assert.deepEqual(migrated.completed,['pwd','find']);
  assert.deepEqual(migrated.mastered,['pwd']);
  const result=recommendAcademy(migrated,restoreCoachMetrics(null));
  assert.equal(result.lessonId,'find');
  assert.equal(result.phase,'transfer');
});

test('a novice who has made errors is still assigned an intro lesson',()=>{
  const result=recommendAcademy(empty(),metrics('pwd',4,2));
  assert.equal(result.lessonId,'pwd');
  assert.equal(result.phase,'intro');
});
