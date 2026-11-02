import test from 'node:test';
import assert from 'node:assert/strict';
import {runWorkshop} from '../src/core/bashWorkshop.ts';
import {verifyRecoveryPreview} from '../src/core/workshopRecoveryVerify.ts';
import {executeLinux} from '../src/core/linux.ts';
import {modeOf} from '../src/core/permissions.ts';
import {recoveryFixture} from '../src/core/pathRecovery.ts';

const path='"$BASE/diagnostics/service.log"';
const script=['BASE=~/practice','test -r '+path,'echo $?','namei -l '+path].join('\n');
const target='/home/player/practice/diagnostics/service.log';
const directory='/home/player/practice/diagnostics';
const backup='/home/player/practice/service.log.verified-backup';
const examples=[
  ['directory','directory-x',directory,'chmod u+x '+directory],
  ['file','file-r',target,'chmod u+r '+target],
  ['missing','restore-backup',target,'cp '+backup+' '+target]
];

test('all three actual virtual repairs pass reading, scope and integrity',()=>{
  for(const [cause,decision,changedPath,command] of examples){
    const result=runWorkshop(script,'pathblock','intro',cause);
    assert.equal(result.completed,true,result.feedback);
    const original=structuredClone(result.state);
    const beforeRead=executeLinux(result.state,'cat '+target);
    assert.equal(beforeRead.ok,false,'incident must exist before preview: '+cause);
    const preview=verifyRecoveryPreview(result,decision);
    assert.ok(preview,'preview missing: '+cause);
    assert.equal(preview.verified,true,cause+': '+preview.message);
    assert.equal(preview.command,command);
    assert.equal(preview.checks.length,3);
    assert.deepEqual(preview.checks.map(x=>x.id),['read','scope','integrity']);
    assert.equal(preview.checks.every(x=>x.passed),true);
    assert.equal(executeLinux(preview.state,'cat '+target).ok,true);
    assert.equal(preview.state.files[target],recoveryFixture('intro').content);
    assert.deepEqual(result.state,original,'the original incident must never be mutated');
    for(const [path,data] of Object.entries(original.files)){
      if(path!==changedPath)assert.equal(preview.state.files[path],data,path);
    }
    if(cause==='directory'){
      assert.equal(modeOf(preview.state,directory),0o700);
      assert.equal(modeOf(preview.state,target),0o644);
      assert.equal(preview.usedTrainingBackup,false);
    }
    if(cause==='file'){
      assert.equal(modeOf(preview.state,target),0o400);
      assert.equal(modeOf(preview.state,directory),0o700);
      assert.equal(preview.usedTrainingBackup,false);
    }
    if(cause==='missing'){
      assert.equal(Object.hasOwn(original.files,target),false);
      assert.equal(preview.usedTrainingBackup,true);
      assert.equal(preview.state.files[backup],recoveryFixture('intro').content);
      assert.equal(modeOf(preview.state,target),0o644);
      assert.equal(modeOf(preview.state,directory),0o700);
      assert.equal(Object.hasOwn(result.state.files,backup),false,
        'backup must exist only in isolated preview');
    }
  }
});

test('wrong, unsafe and unspecified choices never launch a preview',()=>{
  for(const [cause,decision] of examples){
    const result=runWorkshop(script,'pathblock','intro',cause);
    const unchanged=structuredClone(result.state);
    assert.equal(verifyRecoveryPreview(result,''),null);
    for(const choice of ['directory-x','file-r','restore-backup','chmod-777']){
      if(choice===decision)continue;
      assert.equal(verifyRecoveryPreview(result,choice),null,cause+': '+choice);
    }
    assert.deepEqual(result.state,unchanged);
  }
});

test('missing or foreign evidence and uncompleted scripts are refused',()=>{
  const result=runWorkshop(script,'pathblock','intro','file');
  assert.equal(verifyRecoveryPreview({...result,completed:false},'file-r'),null);
  assert.equal(verifyRecoveryPreview({...result,steps:result.steps.slice(0,3)},'file-r'),null);
  const wrongTarget=runWorkshop(
    script.replace('namei -l '+path,'namei -l "$BASE/checks/locked.log"'),
    'pathblock','intro','file');
  assert.equal(verifyRecoveryPreview(wrongTarget,'file-r'),null);
});

test('a synthetic backup path collision is rejected instead of overwritten',()=>{
  const result=runWorkshop(script,'pathblock','intro','missing');
  const state={
    ...result.state,
    files:{...result.state.files,[backup]:'Unrelated important data'}
  };
  const copy=structuredClone(state);
  assert.equal(verifyRecoveryPreview({...result,state},'restore-backup'),null);
  assert.deepEqual(state,copy);
});
