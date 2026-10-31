import test from 'node:test';
import assert from 'node:assert/strict';
import {
  makeProgressBackup,parseProgressBackup,mergeMissionProgress,
  mergeAcademyProgress,mergeCoachProgress
} from '../src/core/progressBackup.ts';
import {missions} from '../src/core/missions.ts';

const base=()=>({completed:[0,2],learning:{},reviewHistory:{},reports:{},reflections:{}});
const academy={completed:['pwd','ls'],mastered:['pwd'],selectedId:'pwd'};
const backup=()=>parseProgressBackup(makeProgressBackup(base(),academy,
  {pwd:{errors:2,help:1}},'2026-10-31T12:00:00.000Z'));

test('export carries valid versioned achievements but no virtual filesystem, host paths or raw log history',()=>{
  const text=makeProgressBackup(base(),academy,{},'2026-10-31T12:00:00.000Z');
  assert.equal(JSON.parse(text).format,'ctf-master-progress');
  assert.equal(JSON.parse(text).schema,1);
  assert.equal(JSON.parse(text).createdAt,'2026-10-31T12:00:00.000Z');
  assert.deepEqual(JSON.parse(text).missions,[missions[0].id,missions[2].id]);
  assert.equal(text.includes('"files"'),false);
  assert.equal(text.includes('"events"'),false);
  assert.equal(text.includes('"state"'),false);
  assert.equal(text.includes('"lines"'),false);
});

test('roundtrip preserves mastered Academy, selected lesson, coach and mission progress',()=>{
  const b=backup();
  assert.deepEqual(b.academy.completed,['pwd','ls']);
  assert.deepEqual(b.academy.mastered,['pwd']);
  assert.equal(b.academy.selectedId,'pwd');
  assert.deepEqual(b.coach.pwd,{errors:2,help:1});
  assert.deepEqual(b.missions,[missions[0].id,missions[2].id]);
});

test('merge does not delete achievements or touch active mission state',()=>{
  const b=backup();
  const local={completed:[1,3],learning:{
    [missions[0].id]:{commands:9,errors:2,hints:0,usedHelp:false,independent:true}},
    reviewHistory:{'log-search':{attempts:4,streak:2}},
    reports:{},reflections:{}};
  const merged=mergeMissionProgress(local,b);
  assert.deepEqual(merged.completed,[0,1,2,3]);
  assert.equal(merged.learning[missions[0].id].commands,9);
  assert.equal(merged.reviewHistory['log-search'].streak,2);
  assert.deepEqual(local.completed,[1,3]);
});

test('Academy merge combines completed lessons and preserves mastery; coach uses bounded maximum',()=>{
  const b=backup();
  const progress=mergeAcademyProgress({
    completed:['pwd','cd'],mastered:['cd'],selectedId:'cd'
  },b);
  assert.deepEqual(new Set(progress.completed),new Set(['pwd','ls','cd']));
  assert.deepEqual(new Set(progress.mastered),new Set(['pwd','cd']));
  const coach=mergeCoachProgress({pwd:{errors:1,help:4}},b);
  assert.deepEqual(coach.pwd,{errors:2,help:4});
});

test('strictly rejects malformed JSON, unsupported versions and incomplete data',()=>{
  assert.throws(()=>parseProgressBackup('not JSON'),/JSON/);
  assert.throws(()=>parseProgressBackup('{}'),/nie jest kopią/);
  const raw=JSON.parse(makeProgressBackup(base(),academy,{}));
  raw.schema=5;
  assert.throws(()=>parseProgressBackup(JSON.stringify(raw)),/Nieobsługiwany/);
  raw.schema=1;
  delete raw.academy.mastered;
  assert.throws(()=>parseProgressBackup(JSON.stringify(raw)),/Brakuje danych/);
  assert.throws(()=>parseProgressBackup(' '.repeat(350001)),/zbyt duża/);
});

test('tampered payload cannot create unknown achievements or prototype keys',()=>{
  const raw=JSON.parse(makeProgressBackup(base(),academy,{}));
  raw.missions=[missions[0].id,'evil','__proto__'];
  raw.academy.completed=['pwd','nonexistent','__proto__'];
  raw.academy.mastered=['nonexistent','pwd'];
  raw.learning={evil:{independent:true,commands:8000},[missions[0].id]:{commands:-2,errors:1}};
  raw.coach={evil:{errors:999},pwd:{errors:5000,help:-8}};
  const restored=parseProgressBackup(JSON.stringify(raw));
  assert.deepEqual(restored.missions,[missions[0].id]);
  assert.deepEqual(restored.academy.completed,['pwd']);
  assert.deepEqual(restored.academy.mastered,['pwd']);
  const merged=mergeMissionProgress(base(),restored);
  assert.equal(Object.hasOwn(merged.learning,'evil'),false);
  assert.equal(merged.learning[missions[0].id].commands,0);
  assert.deepEqual(restored.coach.pwd,{errors:999,help:0});
});

test('newer report and reflections can restore, while current versions take precedence',()=>{
  const original=base();
  const payload=JSON.parse(makeProgressBackup(original,academy,{}));
  payload.reflections={[missions[0].id]:'Mój schemat diagnozy'};
  const imported=parseProgressBackup(JSON.stringify(payload));
  const current={...base(),reflections:{[missions[0].id]:'Moja nowsza odpowiedź'}};
  const merged=mergeMissionProgress(current,imported);
  assert.equal(merged.reflections[missions[0].id],'Moja nowsza odpowiedź');
  const empty=mergeMissionProgress(base(),imported);
  assert.equal(empty.reflections[missions[0].id],'Mój schemat diagnozy');
});
