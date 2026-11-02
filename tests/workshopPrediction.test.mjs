import test from 'node:test';
import assert from 'node:assert/strict';
import {compareExitPrediction} from '../src/core/workshopPrediction.ts';
import {runWorkshop} from '../src/core/bashWorkshop.ts';

const script=(condition)=>['BASE=~/practice',condition,'echo $?'].join('\n');

test('compare against observed echo 1 for failed AND chain, not scenario answer',()=>{
  const result=runWorkshop(script('test -f "$BASE/manual.log" && test -f "$BASE/missing.log"'),'diagnosis');
  assert.equal(result.completed,true);
  assert.deepEqual(compareExitPrediction('diagnosis','1',result),{predicted:'1',observed:'1',matched:true});
  assert.deepEqual(compareExitPrediction('diagnosis','0',result),{predicted:'0',observed:'1',matched:false});
});

test('compare against observed echo 0 after OR fallback',()=>{
  const result=runWorkshop(script('test -f "$BASE/missing.log" || test -f "$BASE/manual.log"'),'fallback');
  assert.equal(result.completed,true);
  assert.deepEqual(compareExitPrediction('fallback','0',result),{predicted:'0',observed:'0',matched:true});
  assert.deepEqual(compareExitPrediction('fallback','1',result),{predicted:'1',observed:'0',matched:false});
});

test('when script failed before echo, prediction is not judged or manufactured',()=>{
  const bad=runWorkshop('BASE=~/practice\nrm ~/practice/manual.log','diagnosis');
  assert.equal(bad.steps.length,0);
  assert.deepEqual(compareExitPrediction('diagnosis','1',bad),{predicted:'1',observed:null,matched:null});
  const missingEcho=runWorkshop('BASE=~/practice\ntest -f "$BASE/manual.log" && test -f "$BASE/missing.log"','diagnosis');
  assert.equal(missingEcho.completed,false);
  assert.deepEqual(compareExitPrediction('diagnosis','1',missingEcho),{predicted:'1',observed:null,matched:null});
});

test('no prediction or backup scenario never produces exit comparison',()=>{
  const result=runWorkshop(script('test -f "$BASE/missing.log" || test -f "$BASE/manual.log"'),'fallback');
  assert.equal(compareExitPrediction('fallback','',result),null);
  assert.equal(compareExitPrediction('backup','0',result),null);
});

test('even on an incomplete task, compare only the actual echoed result',()=>{
  const badOrder=runWorkshop(script('test -f "$BASE/manual.log" || test -f "$BASE/missing.log"'),'fallback');
  assert.equal(badOrder.completed,false);
  assert.deepEqual(compareExitPrediction('fallback','0',badOrder),{predicted:'0',observed:'0',matched:true});
});

test('pathblock compares prediction to observed echo even when namei follows',()=>{
  for(const [path,variant] of [
    ['diagnostics/service.log','intro'],
    ['checks/locked.log','transfer']
  ]){
    const result=runWorkshop([
      'BASE=~/practice',
      'test -r "$BASE/'+path+'"',
      'echo $?',
      'namei -l "$BASE/'+path+'"'
    ].join('\n'),'pathblock',variant);
    assert.equal(result.completed,true,result.feedback);
    assert.equal(result.steps.at(-1).command,'namei');
    assert.deepEqual(compareExitPrediction('pathblock','1',result),
      {predicted:'1',observed:'1',matched:true});
    assert.deepEqual(compareExitPrediction('pathblock','0',result),
      {predicted:'0',observed:'1',matched:false});
  }
});
