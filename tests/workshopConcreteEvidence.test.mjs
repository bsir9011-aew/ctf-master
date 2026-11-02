import test from 'node:test';
import assert from 'node:assert/strict';
import {runWorkshop} from '../src/core/bashWorkshop.ts';
import {verifyRecoveryPreview} from '../src/core/workshopRecoveryVerify.ts';
import {concreteRecoveryEvidence,gradeConcreteEvidence} from '../src/core/workshopConcreteEvidence.ts';
import {recoveryFixture} from '../src/core/pathRecovery.ts';

const path='"$BASE/diagnostics/service.log"';
const script=['BASE=~/practice','test -r '+path,'echo $?','namei -l '+path].join('\n');
const target='/home/player/practice/diagnostics/service.log';
const parent='/home/player/practice/diagnostics';
const cases=[
  ['directory','directory-x','directory-change','600','700','644','644','file-change'],
  ['file','file-r','file-change','700','700','000','400','directory-change'],
  ['missing','restore-backup','backup-restored','700','700','brak','644','file-change']
];
function scenario(cause,action){
  const incident=runWorkshop(script,'pathblock','intro',cause);
  assert.equal(incident.completed,true,incident.feedback);
  const preview=verifyRecoveryPreview(incident,action);
  assert.ok(preview,cause);
  assert.equal(preview.verified,true,cause);
  return {incident,preview};
}
test('three real state transitions produce distinct, case-specific evidence',()=>{
  for(const [cause,action,correct,dirBefore,dirAfter,fileBefore,fileAfter,wrong] of cases){
    const {incident,preview}=scenario(cause,action);
    const original=structuredClone(incident.state);
    const simulated=structuredClone(preview.state);
    const evidence=concreteRecoveryEvidence(incident,preview);
    assert.ok(evidence,cause);
    assert.equal(evidence.correct,correct);
    assert.equal(evidence.options.length,3);
    assert.equal(new Set(evidence.options.map(x=>x.id)).size,3);
    assert.equal(evidence.options.filter(x=>x.id===correct).length,1);
    assert.equal(evidence.rows.length,4);
    assert.deepEqual(evidence.rows[0],{label:'cat service.log',before:'kod 1',after:'kod 0'});
    assert.deepEqual(evidence.rows[1],{label:'Katalog diagnostics',before:dirBefore,after:dirAfter});
    assert.deepEqual(evidence.rows[2],{label:'Plik service.log',before:fileBefore,after:fileAfter});
    assert.ok(evidence.rows[3].after.includes(cause==='missing'?'kopią treningową':'bez zmiany treści'));
    assert.deepEqual(gradeConcreteEvidence(evidence,correct),
      {matched:true,message:'Poprawnie: wniosek jest zgodny z wynikami przed i po naprawie.'});
    assert.equal(gradeConcreteEvidence(evidence,wrong).matched,false);
    for(const option of evidence.options.filter(o=>o.id!==correct)){
      assert.equal(gradeConcreteEvidence(evidence,option.id).matched,false,option.id);
    }
    assert.equal(gradeConcreteEvidence(evidence,'').matched,null);
    assert.equal(gradeConcreteEvidence(evidence,'outside-choice').matched,false);
    assert.deepEqual(incident.state,original,'grader must never modify incident');
    assert.deepEqual(preview.state,simulated,'grader must never modify recovery state');
  }
});

test('observations come from actual changed state and not textual verdicts',()=>{
  for(const [cause,action] of cases){
    const {incident,preview}=scenario(cause,action);
    const tamperedResult={...incident,feedback:'Fake: directory chmod success'};
    assert.ok(concreteRecoveryEvidence(tamperedResult,preview));
    assert.equal(concreteRecoveryEvidence({...incident,completed:false},preview),null);
    assert.equal(concreteRecoveryEvidence({...incident,steps:incident.steps.slice(0,3)},preview),null);
    assert.equal(concreteRecoveryEvidence(incident,null),null);
  }
});

test('contradictory and forged real state snapshots never show a valid question',()=>{
  const {incident,preview}=scenario('file','file-r');
  const variants=[
    {...preview,verified:false},
    {...preview,checks:preview.checks.slice(0,2)},
    {...preview,checks:preview.checks.map((c,i)=>i===0?{...c,passed:false}:c)},
    {...preview,checks:preview.checks.map(c=>({...c,id:'read'}))},
    {...preview,state:{...preview.state,
      permissions:{...preview.state.permissions,[target]:0o777}}},
    {...preview,state:{...preview.state,
      permissions:{...preview.state.permissions,[parent]:0o777}}},
    {...preview,state:{...preview.state,
      files:{...preview.state.files,'/home/player/notes.txt':'tampered'}}},
    {...preview,state:{...preview.state,
      files:{...preview.state.files,[target]:'corrupted'}}},
    {...preview,state:{...preview.state,
      dirs:[...preview.state.dirs,'/tmp/new-dir']}},
    {...preview,state:{...preview.state,
      ownership:{...preview.state.ownership,'/home/player/notes.txt':{uid:123,gid:123}}}}
  ];
  for(const variant of variants){
    assert.equal(concreteRecoveryEvidence(incident,variant),null,
      'modified evidence must never become a correct response');
  }
});
test('missing-file preview accepts only a matching isolated training backup',()=>{
  const {incident,preview}=scenario('missing','restore-backup');
  const backup='/home/player/practice/service.log.verified-backup';
  assert.equal(incident.state.files[target],undefined);
  assert.equal(preview.state.files[target],recoveryFixture('intro').content);
  assert.ok(concreteRecoveryEvidence(incident,preview));
  for(const changed of [
    {...preview,usedTrainingBackup:false},
    {...preview,state:{...preview.state,
      files:{...preview.state.files,[backup]:'BAD_COPY'}}},
    {...preview,state:{...preview.state,
      files:{...preview.state.files,[target]:'BAD_COPY'}}}
  ])assert.equal(concreteRecoveryEvidence(incident,changed),null);
});

test('no generic three-checkbox answer is accepted for new interpretation',()=>{
  const {incident,preview}=scenario('directory','directory-x');
  const evidence=concreteRecoveryEvidence(incident,preview);
  assert.ok(evidence);
  assert.equal(gradeConcreteEvidence(evidence,'read').matched,false);
  assert.equal(gradeConcreteEvidence(null,'directory-change').matched,null);
});
