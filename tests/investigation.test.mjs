import test from 'node:test';
import assert from 'node:assert/strict';
import {createAcademyState,academySubmit,restoreAcademyProgress} from '../src/core/commandAcademy.ts';
import {createTransferState,submitTransfer,transferMistake,earnedMastery} from '../src/core/academyTransfer.ts';
import {investigationStatus,investigationFiles} from '../src/core/investigation.ts';
import {executeLinux,initialLinux} from '../src/core/linux.ts';

const LAB='/home/player/practice';
function runIntro(commands){
  let state=createAcademyState(),events=[],completed=false;
  for(const command of commands){
    const step=academySubmit(state,events,command,'investigation');
    state=step.result.state;events=step.events;completed=step.completed;
  }
  return {state,events,completed,status:investigationStatus('intro',state,events)};
}
function runTransfer(commands){
  let state=createTransferState('investigation'),events=[],completed=false;
  for(const command of commands){
    const step=submitTransfer(state,events,command,'investigation');
    state=step.result.state;events=step.events;completed=step.completed;
  }
  return {state,events,completed,status:investigationStatus('transfer',state,events)};
}

test('the source is discoverable through ordinary file inspection, not disclosed in the briefing',()=>{
  const state=createAcademyState();
  const list=executeLinux(state,'ls ~/practice/logs');
  assert.equal(list.ok,true);
  assert.match(list.output,/edge.log/);
  assert.match(list.output,/worker.log/);
  const task='Po wdrożeniu pojawiły się błędy HTTP 502';
  assert.ok(task);
  assert.equal(investigationStatus('intro',state,[]).completed,false);
  assert.equal(state.files[LAB+'/evidence.log'],undefined);
});

test('reading source evidence before preserving its entire log completes investigation',()=>{
  const case1=runIntro([
    'ls ~/practice/logs',
    'grep "HTTP 502" ~/practice/logs/edge.log',
    'cp ~/practice/logs/edge.log ~/practice/evidence.log'
  ]);
  assert.equal(case1.completed,true);
  assert.deepEqual(case1.status,{evidenceFound:true,evidencePreserved:true,completed:true});
  assert.equal(case1.state.files[LAB+'/evidence.log'],case1.state.files[LAB+'/logs/edge.log']);
});

test('reading only a decoy, then copying the correct file is insufficient',()=>{
  const result=runIntro([
    'cat ~/practice/logs/worker.log',
    'cp ~/practice/logs/edge.log ~/practice/evidence.log'
  ]);
  assert.equal(result.completed,false);
  assert.equal(result.status.evidenceFound,false);
});

test('copying before inspection is not a clean investigation and requires fresh preservation',()=>{
  const result=runIntro([
    'cp ~/practice/logs/edge.log ~/practice/evidence.log',
    'grep "HTTP 502" ~/practice/logs/edge.log'
  ]);
  assert.equal(result.status.evidenceFound,true);
  assert.equal(result.status.evidencePreserved,false);
  assert.equal(result.completed,false);
  const after=academySubmit(result.state,result.events,
    'cp ~/practice/logs/edge.log ~/practice/evidence.log','investigation');
  assert.equal(after.completed,true);
});

test('a copied decoy or a copied subset never satisfies the full evidence goal',()=>{
  const decoy=runIntro([
    'grep "HTTP 502" ~/practice/logs/edge.log',
    'cp ~/practice/logs/worker.log ~/practice/evidence.log'
  ]);
  assert.equal(decoy.completed,false);
  assert.equal(decoy.status.evidenceFound,true);
  const altered=runIntro([
    'grep "HTTP 502" ~/practice/logs/edge.log',
    'cp ~/practice/logs/edge.log ~/practice/evidence.log',
    'rm ~/practice/logs/edge.log'
  ]);
  assert.equal(altered.status.completed,false);
});

test('transfer has a different source, incident type and file and does not reuse intro evidence',()=>{
  const state=createTransferState('investigation');
  assert.equal(state.files[LAB+'/logs/edge.log'],undefined);
  assert.ok(state.files[LAB+'/logs/identity.log'].includes('LOGIN FAIL'));
  assert.equal(state.files[LAB+'/incident-evidence.log'],undefined);
  const initial=structuredClone(state);
  const wrong=submitTransfer(state,[],'grep "HTTP 502" ~/practice/logs/identity.log','investigation');
  assert.equal(wrong.completed,false);
  assert.equal(wrong.result.ok,false);
  assert.deepEqual(state,initial);
});

test('transfer requires finding the independent login clue and preserving its original',()=>{
  const result=runTransfer([
    'ls ~/practice/logs',
    'grep "LOGIN FAIL" ~/practice/logs/identity.log',
    'cp ~/practice/logs/identity.log ~/practice/incident-evidence.log'
  ]);
  assert.equal(result.completed,true);
  assert.equal(result.status.evidenceFound,true);
  assert.equal(result.status.evidencePreserved,true);
  assert.ok(!Object.hasOwn(result.state.files,LAB+'/evidence.log'));
});

test('successful early wrong copy counts as a failed independent attempt',()=>{
  const seed=createTransferState('investigation');
  const wrong=submitTransfer(seed,[],
    'cp ~/practice/logs/payments.log ~/practice/incident-evidence.log','investigation');
  assert.equal(wrong.result.ok,true);
  assert.equal(wrong.completed,false);
  assert.equal(transferMistake('investigation',wrong.result,wrong.completed),true);
  const read=submitTransfer(wrong.result.state,wrong.events,
    'grep "LOGIN FAIL" ~/practice/logs/identity.log','investigation');
  const good=submitTransfer(read.result.state,read.events,
    'cp ~/practice/logs/identity.log ~/practice/incident-evidence.log','investigation');
  assert.equal(good.completed,true);
  assert.equal(earnedMastery(true,1,false),false);
});

test('successful exploration without wrong copy is not penalized',()=>{
  const seed=createTransferState('investigation');
  const inspect=submitTransfer(seed,[],'ls ~/practice/logs','investigation');
  assert.equal(inspect.result.ok,true);
  assert.equal(inspect.completed,false);
  assert.equal(transferMistake('investigation',inspect.result,false),false);
  const read=submitTransfer(inspect.result.state,inspect.events,
    'cat ~/practice/logs/identity.log','investigation');
  assert.equal(transferMistake('investigation',read.result,false),false);
});

test('old progress remains valid and investigation does not appear in base CTF worlds',()=>{
  const old=restoreAcademyProgress({selectedId:'pipeline',
    completed:['pwd','pipeline'],mastered:['pwd']});
  assert.equal(old.selectedId,'pipeline');
  assert.deepEqual(old.completed,['pwd','pipeline']);
  assert.deepEqual(old.mastered,['pwd']);
  assert.equal(initialLinux().files[LAB+'/logs/edge.log'],undefined);
  assert.notDeepEqual(investigationFiles('intro'),investigationFiles('transfer'));
});
