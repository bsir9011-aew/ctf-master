import test from 'node:test';
import assert from 'node:assert/strict';
import {runWorkshop} from '../src/core/bashWorkshop.ts';

const script=(condition)=>['BASE=~/practice',condition,'echo $?'].join('\n');

test('&& shows two executed predicates for success then failure',()=>{
  const r=runWorkshop(script('test -f "$BASE/manual.log" && test -f "$BASE/missing.log"'),'diagnosis');
  assert.equal(r.completed,true,r.feedback);
  assert.deepEqual(r.steps[1].checks.map(c=>[c.operator,c.executed,c.exitCode]),
    [[undefined,true,0],['&&',true,1]]);
});

test('|| shows executed fallback after failure',()=>{
  const r=runWorkshop(script('test -f "$BASE/missing.log" || test -f "$BASE/manual.log"'),'fallback');
  assert.equal(r.completed,true,r.feedback);
  assert.deepEqual(r.steps[1].checks.map(c=>[c.operator,c.executed,c.exitCode]),
    [[undefined,true,1],['||',true,0]]);
});

test('short circuit is visible as skipped, never an invented execution',()=>{
  const a=runWorkshop(script('test -f "$BASE/missing.log" && test -f "$BASE/manual.log"'),'diagnosis');
  assert.equal(a.completed,false);
  assert.equal(a.steps[1].checks[1].executed,false);
  assert.equal(a.steps[1].checks[1].exitCode,undefined);
  const b=runWorkshop(script('test -f "$BASE/manual.log" || test -f "$BASE/missing.log"'),'fallback');
  assert.equal(b.completed,false);
  assert.equal(b.steps[1].checks[1].executed,false);
  assert.equal(b.steps[1].checks[1].exitCode,undefined);
});

test('plain assignments and echo do not invent conditional steps',()=>{
  const r=runWorkshop(script('test -f "$BASE/missing.log" || test -f "$BASE/manual.log"'),'fallback');
  assert.deepEqual(r.steps[0].checks,[]);
  assert.deepEqual(r.steps[2].checks,[]);
});
