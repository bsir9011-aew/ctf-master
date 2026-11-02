import test from 'node:test';
import assert from 'node:assert/strict';
import {runWorkshop,WORKSHOP_MAX_LINES} from '../src/core/bashWorkshop.ts';
import {blindTicket,blindTicketIds} from '../src/core/blindTickets.ts';
import {verifyRecoveryPreview} from '../src/core/workshopRecoveryVerify.ts';
import {concreteRecoveryEvidence,gradeConcreteEvidence} from '../src/core/workshopConcreteEvidence.ts';
import {gradeRemediation} from '../src/core/workshopRemediation.ts';
import {compareCausePrediction} from '../src/core/workshopPrediction.ts';
import {createAcademyState} from '../src/core/commandAcademy.ts';
import {modeOf} from '../src/core/permissions.ts';

const causes=[
  ['directory','directory-x','directory-change'],
  ['file','file-r','file-change'],
  ['missing','restore-backup','backup-restored']
];
const scriptFor=id=>[
  'BASE=~/practice',
  'test -r "$BASE/diagnostics/'+blindTicket(id).name+'"',
  'echo $?',
  'namei -l "$BASE/diagnostics/'+blindTicket(id).name+'"'
].join('\n');

test('three independent tickets with three causes yield nine real diagnostic and recovery cases',()=>{
  assert.deepEqual(new Set(blindTicketIds),new Set(['service','worker','billing']));
  assert.equal(WORKSHOP_MAX_LINES,4);
  const academy=createAcademyState();
  for(const id of blindTicketIds){
    const ticket=blindTicket(id);
    assert.equal(ticket.file,ticket.directory+'/'+ticket.name);
    for(const [cause,action,conclusion] of causes){
      const result=runWorkshop(scriptFor(id),'pathblock','intro',cause,id);
      assert.equal(result.completed,true,id+' '+cause+': '+result.feedback);
      assert.deepEqual(result.steps.map(s=>s.command),['variable','test','echo','namei']);
      assert.equal(result.steps[1].target,ticket.file);
      assert.equal(result.steps[1].exitCode,1);
      assert.equal(result.steps[2].output,'1');
      assert.equal(result.steps[3].target,ticket.file);
      assert.deepEqual(compareCausePrediction(cause,result),
        {predicted:cause,observed:cause,matched:true});
      assert.equal(gradeRemediation(action,result).matched,true);
      const baseSnapshot=structuredClone(result.state);
      const preview=verifyRecoveryPreview(result,action,id);
      assert.ok(preview,id+': '+cause);
      assert.equal(preview.verified,true,id+' '+cause+': '+preview.message);
      assert.equal(preview.state.files[ticket.file],ticket.content);
      assert.deepEqual(preview.checks.map(c=>c.passed),[true,true,true]);
      const evidence=concreteRecoveryEvidence(result,preview,id);
      assert.ok(evidence,id+': '+cause);
      assert.equal(evidence.correct,conclusion);
      assert.equal(evidence.rows[0].label,'cat '+ticket.name);
      assert.equal(evidence.rows[2].label,'Plik '+ticket.name);
      assert.equal(gradeConcreteEvidence(evidence,conclusion).matched,true);
      for(const wrong of evidence.options.filter(o=>o.id!==conclusion)){
        assert.equal(gradeConcreteEvidence(evidence,wrong.id).matched,false);
      }
      assert.deepEqual(result.state,baseSnapshot,'preview must not mutate incident');
      assert.equal(academy.files[ticket.file]===undefined,id!=='service',
        'non-default tickets must not leak into Academy seed');
      assert.equal(preview.state.dirs.includes(ticket.directory),true);
      if(cause==='directory')assert.equal(modeOf(preview.state,ticket.directory),0o700);
      if(cause==='file')assert.equal(modeOf(preview.state,ticket.file),0o400);
      if(cause==='missing')assert.equal(modeOf(preview.state,ticket.file),0o644);
    }
  }
});

test('a script for another ticket cannot complete and cannot borrow evidence',()=>{
  for(const id of blindTicketIds){
    const other=blindTicketIds.find(v=>v!==id);
    const script=scriptFor(other);
    for(const [cause,action] of causes){
      const result=runWorkshop(script,'pathblock','intro',cause,id);
      assert.equal(result.completed,false,id+' '+cause);
      assert.equal(verifyRecoveryPreview(result,action,id),null);
      assert.equal(concreteRecoveryEvidence(result,null,id),null);
    }
  }
});

test('a valid incident cannot pass recovery against a mismatched ticket',()=>{
  for(const id of blindTicketIds){
    const incident=runWorkshop(scriptFor(id),'pathblock','intro','file',id);
    assert.equal(incident.completed,true);
    for(const other of blindTicketIds.filter(v=>v!==id)){
      assert.equal(verifyRecoveryPreview(incident,'file-r',other),null);
      const preview=verifyRecoveryPreview(incident,'file-r',id);
      assert.ok(preview);
      assert.equal(concreteRecoveryEvidence(incident,preview,other),null);
    }
  }
});

test('no file is ever added or changed on the host; only a disposable virtual state',()=>{
  const academy=createAcademyState();
  const original=structuredClone(academy);
  for(const id of blindTicketIds){
    for(const [cause,action] of causes){
      const result=runWorkshop(scriptFor(id),'pathblock','intro',cause,id);
      const snapshot=structuredClone(result.state);
      const preview=verifyRecoveryPreview(result,action,id);
      assert.ok(preview);
      assert.deepEqual(result.state,snapshot);
    }
  }
  assert.deepEqual(academy,original);
});

test('legacy guided variants keep their original paths and exercise count',async()=>{
  const {workshopScenarios}=await import('../src/core/workshopScenarios.ts');
  assert.equal(workshopScenarios.length,7);
  const old=['BASE=~/practice','test -r "$BASE/diagnostics/service.log"',
    'echo $?','namei -l "$BASE/diagnostics/service.log"'].join('\n');
  assert.equal(runWorkshop(old,'pathblock','intro').completed,true);
  assert.equal(runWorkshop(old,'pathblock','intro','directory').completed,true);
  assert.equal(runWorkshop(old,'pathblock','intro','file').completed,true);
  assert.equal(runWorkshop(old,'pathblock','intro','missing').completed,true);
});
