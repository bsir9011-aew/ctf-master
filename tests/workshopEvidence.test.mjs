import test from 'node:test';
import assert from 'node:assert/strict';
import {runWorkshop} from '../src/core/bashWorkshop.ts';
import {verifyRecoveryPreview} from '../src/core/workshopRecoveryVerify.ts';
import {gradeRecoveryEvidence,recoveryEvidenceOptions} from '../src/core/workshopEvidence.ts';

const path='"$BASE/diagnostics/service.log"';
const script=['BASE=~/practice','test -r '+path,'echo $?','namei -l '+path].join('\n');
const cases=[
  ['directory','directory-x'],
  ['file','file-r'],
  ['missing','restore-backup']
];
const proofs=['read','scope','integrity'];

test('all three incident types demand three actual independent verification proofs',()=>{
  assert.equal(recoveryEvidenceOptions.length,4);
  assert.deepEqual(new Set(recoveryEvidenceOptions.map(item=>item.id)),
    new Set([...proofs,'command-only']));
  for(const [cause,action] of cases){
    const incident=runWorkshop(script,'pathblock','intro',cause);
    assert.equal(incident.completed,true,incident.feedback);
    const incidentCopy=structuredClone(incident.state);
    const preview=verifyRecoveryPreview(incident,action);
    assert.ok(preview);
    assert.equal(preview.verified,true);
    assert.deepEqual(new Set(preview.checks.map(check=>check.id)),new Set(proofs));
    const previewCopy=structuredClone(preview.state);
    for(const ordering of [proofs,[...proofs].reverse(),['integrity','read','scope']]){
      const grade=gradeRecoveryEvidence(preview,ordering);
      assert.equal(grade.matched,true,cause);
      assert.match(grade.message,/Dowody rozpoznane/);
    }
    assert.deepEqual(incident.state,incidentCopy,'no mutation of original incident');
    assert.deepEqual(preview.state,previewCopy,'no mutation from evidence grading');
  }
});

test('merely running a command is never valid evidence of safe repair',()=>{
  for(const [cause,action] of cases){
    const incident=runWorkshop(script,'pathblock','intro',cause);
    const preview=verifyRecoveryPreview(incident,action);
    assert.ok(preview);
    for(const selection of [
      ['command-only'],
      [...proofs,'command-only'],
      ['read','scope','command-only'],
      ['scope','integrity','command-only'],
      ['read','integrity','command-only'],
      ['read'],
      ['read','scope'],
      ['read','read','scope','integrity'],
      [],
      ['unknown','read','scope','integrity']
    ]){
      const grade=gradeRecoveryEvidence(preview,selection);
      assert.equal(grade.matched,false,cause+': '+selection.join(','));
      assert.doesNotMatch(grade.message,/Dowody rozpoznane/);
    }
  }
});

test('incomplete, contradictory and failed real checks must never be graded correct',()=>{
  const incident=runWorkshop(script,'pathblock','intro','file');
  const preview=verifyRecoveryPreview(incident,'file-r');
  assert.ok(preview);
  assert.equal(gradeRecoveryEvidence(null,proofs).matched,null);
  const variants=[
    {...preview,verified:false},
    {...preview,checks:preview.checks.slice(0,2)},
    {...preview,checks:[...preview.checks,preview.checks[0]]},
    {...preview,checks:preview.checks.map((x,i)=>i===0?{...x,passed:false}:x)},
    {...preview,checks:preview.checks.map(x=>({...x,id:'read'}))}
  ];
  for(const variant of variants){
    const actual=gradeRecoveryEvidence(variant,proofs);
    assert.equal(actual.matched,null);
    assert.match(actual.message,/Brakuje potwierdzonych/);
  }
});

test('no successful repair preview exists for incomplete or unsafe action',()=>{
  const incident=runWorkshop(script,'pathblock','intro','missing');
  const bad=verifyRecoveryPreview(incident,'chmod-777');
  const truncated=verifyRecoveryPreview({...incident,steps:incident.steps.slice(0,3)},'restore-backup');
  assert.equal(bad,null);
  assert.equal(truncated,null);
  assert.equal(gradeRecoveryEvidence(bad,proofs).matched,null);
  assert.equal(gradeRecoveryEvidence(truncated,proofs).matched,null);
});
