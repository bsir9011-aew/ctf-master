import test from 'node:test';
import assert from 'node:assert/strict';
import {runWorkshop,WORKSHOP_MAX_LINES} from '../src/core/bashWorkshop.ts';
import {createAcademyState} from '../src/core/commandAcademy.ts';
import {modeOf} from '../src/core/permissions.ts';
import {compareCausePrediction} from '../src/core/workshopPrediction.ts';
import {
  pathblockWorkshopDraftKey,pathblockWorkshopStarter,workshopScenarios,
  workshopDraftKey
} from '../src/core/workshopScenarios.ts';

const target='"$BASE/diagnostics/service.log"';
const script=[
  'BASE=~/practice',
  'test -r '+target,
  'echo $?',
  'namei -l '+target
].join('\n');
const DIR='/home/player/practice/diagnostics';
const FILE=DIR+'/service.log';

test('blind cases share one file path but have genuinely different causes',()=>{
  const base=createAcademyState();
  for(const cause of ['directory','file']){
    const result=runWorkshop(script,'pathblock','intro',cause);
    assert.equal(result.completed,true,cause+': '+result.feedback);
    assert.equal(result.steps.length,4);
    assert.deepEqual(result.steps.map(s=>s.command),['variable','test','echo','namei']);
    assert.equal(result.steps[1].testFlag,'-r');
    assert.equal(result.steps[1].target,FILE);
    assert.equal(result.steps[1].exitCode,1);
    assert.equal(result.steps[2].output,'1');
    assert.equal(result.steps[3].target,FILE);
    assert.equal(result.steps[3].exitCode,0);
    assert.deepEqual(compareCausePrediction(cause,result),
      {predicted:cause,observed:cause,matched:true});
    const wrong=cause==='directory'?'file':'directory';
    assert.deepEqual(compareCausePrediction(wrong,result),
      {predicted:wrong,observed:cause,matched:false});
    assert.equal(result.state.files[FILE],base.files[FILE]);
    assert.deepEqual(result.state.files,base.files);
    assert.deepEqual(result.state.dirs,base.dirs);
    assert.deepEqual(result.state.ownership,base.ownership);
    for(const [name,mode] of Object.entries(base.permissions)){
      if(name!==DIR&&name!==FILE)assert.equal(result.state.permissions[name],mode,name);
    }
    if(cause==='directory'){
      assert.equal(result.steps[3].blockedAt,'~/practice/diagnostics');
      assert.equal(result.state.permissions[DIR],0o600);
      assert.equal(modeOf(result.state,FILE),0o644);
    }else{
      assert.equal(result.steps[3].blockedAt,undefined);
      assert.match(result.steps[3].output,/---------- .*service\.log/);
      assert.equal(result.state.permissions[DIR],0o700);
      assert.equal(result.state.permissions[FILE],0o000);
    }
  }
});

test('hypothesis evidence cannot be taken from a different file',()=>{
  for(const cause of ['directory','file']){
    const other=script.replace('namei -l '+target,
      'namei -l "$BASE/checks/locked.log"');
    const result=runWorkshop(other,'pathblock','intro',cause);
    assert.equal(result.completed,false,cause);
    assert.equal(result.steps[1].target,FILE);
    assert.equal(result.steps[3].target,'/home/player/practice/checks/locked.log');
    assert.deepEqual(compareCausePrediction(cause,result),
      {predicted:cause,observed:null,matched:null});
    assert.deepEqual(compareCausePrediction(cause,{steps:result.steps.slice(0,3)}),
      {predicted:cause,observed:null,matched:null});
  }
});

test('wrong order, fake echo and wrong target do not complete blind incident',()=>{
  for(const cause of ['directory','file']){
    for(const wrong of [
      script.replace('test -r','test -f'),
      script.replace('echo $?','echo 1'),
      script.replace('namei -l','cat'),
      script.replace('test -r '+target,'test -r "$BASE/checks/locked.log"'),
      script.replace('BASE=~/practice','BASE=~/elsewhere'),
      script.split('\n').slice(0,3).join('\n')
    ]){
      assert.equal(runWorkshop(wrong,'pathblock','intro',cause).completed,false,
        cause+': '+wrong);
    }
  }
});

test('preflight rejects dangerous changes before executing any line in blind mode',()=>{
  for(const cause of ['directory','file']){
    for(const unsafe of [
      'BASE=~/practice\nchmod 777 '+target,
      'BASE=~/practice\nrm '+target,
      'BASE=~/practice\ncurl https://example.test',
      'BASE=~/practice\ncat '+target+' > /tmp/exfil'
    ]){
      const r=runWorkshop(unsafe,'pathblock','intro',cause);
      assert.equal(r.completed,false,unsafe);
      assert.equal(r.steps.length,0,unsafe);
      assert.equal(r.state.files[FILE],createAcademyState().files[FILE]);
    }
  }
});

test('blind option has blank independent draft and preserves old progress keys',()=>{
  assert.equal(pathblockWorkshopDraftKey('intro'),workshopDraftKey('pathblock'));
  assert.equal(pathblockWorkshopDraftKey('transfer'),
    'ctf-master:bash-workshop-pathblock-transfer-draft-v1');
  assert.equal(pathblockWorkshopDraftKey('blind'),
    'ctf-master:bash-workshop-pathblock-blind-draft-v1');
  assert.equal(pathblockWorkshopStarter('blind'),'');
  assert.equal(pathblockWorkshopStarter('transfer'),'');
  assert.equal(WORKSHOP_MAX_LINES,4);
  assert.equal(workshopScenarios.length,7);
});
