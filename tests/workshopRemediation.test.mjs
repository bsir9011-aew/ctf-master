import test from 'node:test';
import assert from 'node:assert/strict';
import {runWorkshop} from '../src/core/bashWorkshop.ts';
import {createAcademyState} from '../src/core/commandAcademy.ts';
import {gradeRemediation} from '../src/core/workshopRemediation.ts';
import {observedAccessCause} from '../src/core/workshopPrediction.ts';

const target='"$BASE/diagnostics/service.log"';
const script=['BASE=~/practice','test -r '+target,'echo $?','namei -l '+target].join('\n');
const cases=[
  ['directory','directory-x'],
  ['file','file-r'],
  ['missing','restore-backup']
];
const choices=['directory-x','file-r','restore-backup','chmod-777'];

test('each response must match the executed, validated diagnosis',()=>{
  const baseline=createAcademyState();
  for(const [cause,action] of cases){
    const result=runWorkshop(script,'pathblock','intro',cause);
    assert.equal(result.completed,true,cause+': '+result.feedback);
    assert.equal(observedAccessCause(result),cause);
    const snapshot=structuredClone(result.state);
    assert.equal(gradeRemediation('',result),null);
    const right=gradeRemediation(action,result);
    assert.deepEqual({choice:right.choice,cause:right.cause,matched:right.matched},
      {choice:action,cause,matched:true});
    assert.match(right.message,/Trafnie/);
    for(const wrong of choices.filter(x=>x!==action)){
      const other=gradeRemediation(wrong,result);
      assert.equal(other.matched,false,wrong+' in '+cause);
      assert.equal(other.cause,cause);
      assert.doesNotMatch(other.message,/Trafnie/);
    }
    assert.deepEqual(result.state,snapshot,'evaluation must not mutate the world');
    assert.equal(baseline.files['/home/player/practice/diagnostics/service.log']!==undefined,true);
  }
});

test('unsafe chmod 777 is always rejected with least-privilege feedback',()=>{
  for(const [cause] of cases){
    const response=gradeRemediation('chmod-777',runWorkshop(script,'pathblock','intro',cause));
    assert.equal(response.matched,false);
    assert.match(response.message,/nadmierne uprawnienia/i);
  }
});

test('missing, foreign or incomplete evidence never yields a right answer',()=>{
  const complete=runWorkshop(script,'pathblock','intro','file');
  const incomplete={...complete,completed:false};
  const noNamei={...complete,steps:complete.steps.slice(0,3)};
  const unrelated=runWorkshop(
    script.replace('namei -l '+target,'namei -l "$BASE/checks/locked.log"'),
    'pathblock','intro','file');
  for(const result of [incomplete,noNamei,unrelated]){
    for(const choice of choices){
      const feedback=gradeRemediation(choice,result);
      assert.equal(feedback.matched,null);
      assert.equal(feedback.cause,null);
      assert.match(feedback.message,/Nie ma wystarczających/);
    }
  }
});

test('source of truth is trace, not the initial cause hypothesis or result feedback',()=>{
  const result=runWorkshop(script,'pathblock','intro','missing');
  const altered={...result,feedback:'Directory x error'};
  assert.equal(gradeRemediation('restore-backup',altered).matched,true);
  assert.equal(gradeRemediation('directory-x',altered).matched,false);
  assert.equal(observedAccessCause({...result,steps:result.steps.slice(0,2)}),null);
});

test('existing non-blind diagnosis remains unchanged and response is advisory only',()=>{
  const guided=runWorkshop(script,'pathblock','intro');
  assert.equal(guided.completed,true);
  assert.equal(gradeRemediation('directory-x',guided).matched,true);
  assert.deepEqual(guided.state,runWorkshop(script,'pathblock','intro').state);
});
