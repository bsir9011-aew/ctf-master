import test from 'node:test';
import assert from 'node:assert/strict';
import {runWorkshop} from '../src/core/bashWorkshop.ts';
import {createAcademyState} from '../src/core/commandAcademy.ts';
import {
  PATHBLOCK_DEFAULT,workshopDraftKey,workshopInitialScript,workshopScenarios,
  pathblockWorkshopDraftKey,pathblockWorkshopStarter
} from '../src/core/workshopScenarios.ts';
import {recoveryFixture} from '../src/core/pathRecovery.ts';

const target='"$BASE/diagnostics/service.log"';
const correct=[
  'BASE=~/practice',
  'test -r '+target,
  'echo $?',
  'namei -l '+target
].join('\n');

test('test -r yields 1 when an ancestor directory lacks x, then namei identifies blocker',()=>{
  const r=runWorkshop(correct,'pathblock');
  assert.equal(r.completed,true,r.feedback);
  assert.deepEqual(r.steps.map(s=>s.command),['variable','test','echo','namei']);
  assert.equal(r.steps[1].exitCode,1);
  assert.equal(r.steps[2].output,'1');
  assert.equal(r.steps[3].blockedAt,'~/practice/diagnostics');
  assert.match(r.steps[3].output,/BRAK x/);
  const initial=createAcademyState();
  assert.equal(initial.permissions[recoveryFixture('intro').directory],0o600);
  assert.equal(initial.files[recoveryFixture('intro').file],r.state.files[recoveryFixture('intro').file]);
  assert.deepEqual(r.state.files,initial.files);
  assert.deepEqual(r.state.permissions,initial.permissions);
  assert.deepEqual(r.state.dirs,initial.dirs);
});

test('actual namei evidence and immediate echo are required, never merely matching text',()=>{
  const wrong=[
    correct.replace('test -r','test -f'),
    correct.replace('namei -l','namei -x'),
    correct.replace('namei -l','test -r'),
    correct.replace('diagnostics/service.log','checks/locked.log'),
    correct.replaceAll('diagnostics/service.log','checks/locked.log'),
    correct.replace('echo $?','echo 1'),
    correct.replace('echo $?', "echo '$?'"),
    correct.replace('echo $?','BASE=~/practice'),
    correct.replace('echo $?\n',''),
    correct.split('\n').slice(0,3).join('\n'),
    correct.replace('namei -l '+target,'namei -l "$BASE/checks/locked.log"'),
    correct.replace('namei -l '+target,'namei -l ~/practice/diagnostics/service.log')
  ];
  for(const script of wrong)assert.equal(runWorkshop(script,'pathblock').completed,false,script);
});

test('wrong order and attempts to bypass the script are rejected',()=>{
  for(const script of [
    'BASE=~/practice\nnamei -l '+target+'\necho $?\ntest -r '+target,
    'echo $?\n'+correct,
    'BASE=~/practice\n'+correct,
    correct.replace('BASE=~/practice','BASE=~/documents'),
    correct.replace('test -r '+target,'test -r ~/practice/diagnostics/service.log')
  ])assert.equal(runWorkshop(script,'pathblock').completed,false,script);
});

test('preflight disallows modifications, loops, network and hidden shell effects',()=>{
  for(const script of [
    'BASE=~/practice\nchmod u+x "$BASE/diagnostics"',
    'BASE=~/practice\nrm "$BASE/diagnostics/service.log"',
    'BASE=~/practice\ncurl https://example.test',
    'BASE=~/practice\nfor FILE in x y; do cp "$FILE" "$FILE.copy"; done',
    'BASE=~/practice\ntest -r '+target+' || chmod u+x "$BASE/diagnostics"',
    'BASE=~/practice\nnamei -l '+target+'; rm -f /tmp/pwn'
  ]){
    const r=runWorkshop(script,'pathblock');
    assert.equal(r.completed,false,script);
    assert.equal(r.steps.length,0,script);
    assert.deepEqual(r.state.files,createAcademyState().files);
    assert.deepEqual(r.state.permissions,createAcademyState().permissions);
  }
});

test('pathblock has independent draft and does not alter old scenarios',()=>{
  assert.deepEqual(workshopScenarios.map(s=>s.id),[
    'backup','diagnosis','permissions','fallback','transfer','pathblock','repair','service'
  ]);
  assert.equal(workshopInitialScript('pathblock'),PATHBLOCK_DEFAULT);
  assert.equal(runWorkshop(PATHBLOCK_DEFAULT,'pathblock').completed,false);
  assert.equal(workshopDraftKey('pathblock'),'ctf-master:bash-workshop-pathblock-draft-v1');
  for(const id of ['backup','diagnosis','permissions','fallback','transfer']){
    assert.notEqual(workshopDraftKey('pathblock'),workshopDraftKey(id));
    assert.equal(runWorkshop(correct,id).completed,false,id);
  }
});

const independentTarget='"$BASE/checks/locked.log"';
const independent=[
  'BASE=~/practice',
  'test -r '+independentTarget,
  'echo $?',
  'namei -l '+independentTarget
].join('\n');

test('independent case distinguishes unreadable FILE from untraversable DIRECTORY',()=>{
  const result=runWorkshop(independent,'pathblock','transfer');
  const seed=createAcademyState();
  assert.equal(result.completed,true,result.feedback);
  assert.deepEqual(result.steps.map(step=>step.command),['variable','test','echo','namei']);
  assert.equal(result.steps[1].exitCode,1);
  assert.equal(result.steps[2].output,'1');
  assert.equal(result.steps[3].blockedAt,undefined);
  assert.match(result.steps[3].output,/---------- .*locked\.log/);
  assert.match(result.feedback,/inny mechanizm/);
  assert.equal(seed.permissions['/home/player/practice/checks/locked.log'],0);
  assert.deepEqual(result.state.files,seed.files);
  assert.deepEqual(result.state.permissions,seed.permissions);
  assert.deepEqual(result.state.dirs,seed.dirs);
  assert.deepEqual(result.state.ownership,seed.ownership);
});

test('independent and guided diagnoses cannot solve each other',()=>{
  assert.equal(runWorkshop(correct,'pathblock','intro').completed,true);
  assert.equal(runWorkshop(independent,'pathblock','transfer').completed,true);
  assert.equal(runWorkshop(correct,'pathblock','transfer').completed,false);
  assert.equal(runWorkshop(independent,'pathblock','intro').completed,false);
});

test('independent case checks order, real evidence and preflight without changes',()=>{
  for(const script of [
    independent.replace('test -r','test -f'),
    independent.replace('namei -l','cat'),
    independent.replace('echo $?','echo 1'),
    independent.replace('namei -l '+independentTarget,'namei -l "$BASE/diagnostics/service.log"'),
    independent.replace('BASE=~/practice','BASE=~/documents'),
    independent.split('\n').slice(0,3).join('\n'),
    independent.replace('test -r '+independentTarget,'chmod u+r '+independentTarget),
    independent.replace('namei -l '+independentTarget,'rm '+independentTarget)
  ]){
    const r=runWorkshop(script,'pathblock','transfer');
    assert.equal(r.completed,false,script);
    assert.deepEqual(r.state.files,createAcademyState().files,script);
    assert.deepEqual(r.state.permissions,createAcademyState().permissions,script);
  }
});

test('separate independent draft and blank editor, with eight menu items retained',()=>{
  assert.equal(pathblockWorkshopStarter('transfer'),'');
  assert.equal(pathblockWorkshopStarter('intro'),PATHBLOCK_DEFAULT);
  assert.equal(pathblockWorkshopDraftKey('intro'),workshopDraftKey('pathblock'));
  assert.equal(pathblockWorkshopDraftKey('transfer'),
    'ctf-master:bash-workshop-pathblock-transfer-draft-v1');
  assert.notEqual(pathblockWorkshopDraftKey('intro'),pathblockWorkshopDraftKey('transfer'));
  assert.equal(workshopScenarios.length,8);
  assert.equal(runWorkshop('', 'pathblock','transfer').completed,false);
});
