import test from 'node:test';
import assert from 'node:assert/strict';
import {runWorkshop,WORKSHOP_MAX_LINES} from '../src/core/bashWorkshop.ts';
import {blindTicket,blindTicketIds} from '../src/core/blindTickets.ts';
import {accessEvidencePlan,compareCausePrediction,compareExitPrediction} from '../src/core/workshopPrediction.ts';
import {gradeRemediation} from '../src/core/workshopRemediation.ts';
import {verifyRecoveryPreview} from '../src/core/workshopRecoveryVerify.ts';
import {concreteRecoveryEvidence,gradeConcreteEvidence} from '../src/core/workshopConcreteEvidence.ts';
import {createAcademyState} from '../src/core/commandAcademy.ts';

const causes=[
  ['directory','directory-x','directory-change'],
  ['file','file-r','file-change'],
  ['missing','restore-backup','backup-restored']
];
const twoOrders=(id)=>{
  const target='"$BASE/diagnostics/'+blindTicket(id).name+'"';
  const check='test -r '+target,inspect='namei -l '+target;
  return [
    ['BASE=~/practice',check,'echo $?',inspect].join('\n'),
    ['BASE=~/practice',inspect,check,'echo $?'].join('\n')
  ];
};
test('blind mode accepts both proven diagnostic orders for all nine incidents',()=>{
  assert.equal(WORKSHOP_MAX_LINES,4);
  for(const id of blindTicketIds){
    const ticket=blindTicket(id);
    for(const [cause,fix,conclusion] of causes){
      const variants=twoOrders(id);
      for(const [order,script] of variants.entries()){
        const result=runWorkshop(script,'pathblock','intro',cause,id);
        assert.equal(result.completed,true,id+' '+cause+' order '+order+': '+result.feedback);
        assert.equal(result.steps.length,4);
        assert.deepEqual(result.steps.map(step=>step.command),
          order===0?['variable','test','echo','namei']:['variable','namei','test','echo']);
        const plan=accessEvidencePlan(result);
        assert.ok(plan);
        assert.equal(plan.testIndex,order===0?1:2);
        assert.equal(plan.inspectIndex,order===0?3:1);
        assert.equal(plan.target,ticket.file);
        assert.equal(result.steps[plan.testIndex].exitCode,1);
        assert.equal(result.steps[plan.testIndex+1].output,'1');
        assert.equal(result.steps[plan.inspectIndex].target,ticket.file);
        assert.deepEqual(compareCausePrediction(cause,result),
          {predicted:cause,observed:cause,matched:true});
        assert.deepEqual(compareExitPrediction('pathblock','1',result),
          {predicted:'1',observed:'1',matched:true});
        assert.equal(gradeRemediation(fix,result)?.matched,true);
        const before=structuredClone(result.state);
        const preview=verifyRecoveryPreview(result,fix,id);
        assert.ok(preview,id+' '+cause+' '+order);
        assert.equal(preview.verified,true);
        const evidence=concreteRecoveryEvidence(result,preview,id);
        assert.ok(evidence);
        assert.equal(evidence.correct,conclusion);
        assert.equal(gradeConcreteEvidence(evidence,conclusion).matched,true);
        assert.deepEqual(result.state,before,'verification cannot change incident state');
      }
    }
  }
});
test('blind diagnosis rejects fake status, wrong targets and missing adjacent echo',()=>{
  const id='worker',cause='file',t='"$BASE/diagnostics/worker.log"';
  const accepted=twoOrders(id)[1];
  for(const bad of [
    accepted.replace('echo $?','echo 1'),
    accepted.replace('test -r','test -f'),
    accepted.replace('namei -l '+t,'namei -l "$BASE/diagnostics/billing.log"'),
    accepted.replace('test -r '+t,'test -r "$BASE/checks/locked.log"'),
    accepted.replace('BASE=~/practice','BASE=~/wrong'),
    accepted.split('\n').slice(0,3).join('\n'),
    ['BASE=~/practice','test -r '+t,'namei -l '+t,'echo $?'].join('\n'),
    ['BASE=~/practice','namei -l '+t,'echo $?','test -r '+t].join('\n'),
    ['BASE=~/practice','echo $?','test -r '+t,'namei -l '+t].join('\n'),
    ['BASE=~/practice','namei -l '+t,'test -r '+t,'test -r '+t].join('\n')
  ]){
    const result=runWorkshop(bad,'pathblock','intro',cause,id);
    assert.equal(result.completed,false,bad);
    assert.equal(accessEvidencePlan(result),null,bad);
    assert.equal(compareCausePrediction(cause,result).observed,null,bad);
    assert.equal(gradeRemediation('file-r',result).matched,null,bad);
    assert.equal(verifyRecoveryPreview(result,'file-r',id),null,bad);
  }
});
test('unsafe commands rejected by preflight regardless of diagnostic order',()=>{
  for(const script of [
    'BASE=~/practice\nchmod 777 "$BASE/diagnostics/worker.log"',
    'BASE=~/practice\nrm "$BASE/diagnostics/worker.log"',
    'BASE=~/practice\ncurl https://invalid.test',
    'BASE=~/practice\nnamei -l "$BASE/diagnostics/worker.log"\ncat /etc/shadow',
    'BASE=~/practice\nnamei -l "$BASE/diagnostics/worker.log"\ntest -r "$BASE/diagnostics/worker.log"\necho $? \nchmod 777 /tmp'
  ]){
    const r=runWorkshop(script,'pathblock','intro','missing','worker');
    assert.equal(r.completed,false,script);
    assert.equal(r.steps.length,0,script);
  }
});
test('legacy guided and independent pathblock retain their required original sequence',()=>{
  const oldFile='"$BASE/diagnostics/service.log"';
  const old=['BASE=~/practice','test -r '+oldFile,'echo $?','namei -l '+oldFile].join('\n');
  const reversed=['BASE=~/practice','namei -l '+oldFile,'test -r '+oldFile,'echo $?'].join('\n');
  assert.equal(runWorkshop(old,'pathblock','intro').completed,true);
  assert.equal(runWorkshop(reversed,'pathblock','intro').completed,false);
  const transfer='"$BASE/checks/locked.log"';
  assert.equal(runWorkshop(['BASE=~/practice','test -r '+transfer,'echo $?','namei -l '+transfer].join('\n'),'pathblock','transfer').completed,true);
  assert.equal(runWorkshop(['BASE=~/practice','namei -l '+transfer,'test -r '+transfer,'echo $?'].join('\n'),'pathblock','transfer').completed,false);
  assert.equal(createAcademyState().files['/home/player/practice/diagnostics/service.log']!==undefined,true);
});
