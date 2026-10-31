import test from 'node:test';
import assert from 'node:assert/strict';
import {runWorkshop} from '../src/core/bashWorkshop.ts';
import {createAcademyState} from '../src/core/commandAcademy.ts';
import {
  PERMISSIONS_DEFAULT,DIAGNOSIS_DEFAULT,WORKSHOP_DEFAULT,
  workshopDraftKey,workshopInitialScript,workshopScenarios
} from '../src/core/workshopScenarios.ts';

const valid=[
  'BASE=~/practice',
  'test -f "$BASE/checks/locked.log" && test -r "$BASE/checks/locked.log"',
  'echo $?'
].join('\n');

test('locked file exists but is unreadable, status 1 is the expected diagnostic evidence',()=>{
  const result=runWorkshop(valid,'permissions');
  assert.equal(result.completed,true,result.feedback);
  assert.equal(result.steps.length,3);
  assert.equal(result.steps[1].command,'conditional');
  assert.equal(result.steps[1].exitCode,1);
  assert.equal(result.steps[2].output,'1');
  assert.match(result.feedback,/nie masz prawa/);
  const initial=createAcademyState();
  assert.deepEqual(result.state.files,initial.files);
  assert.deepEqual(result.state.permissions,initial.permissions);
  assert.equal(result.errorLine,undefined);
});

test('different flag, switched test order, wrong file and skipped branch do not pass',()=>{
  const altered=[
    valid.replace('test -r','test -f'),
    valid.replace('test -f','test -r'),
    valid.replace('checks/locked.log','private.txt'),
    valid.replaceAll('checks/locked.log','manual.log'),
    valid.replace('&&','||'),
    valid.replace('&& test -r "$BASE/checks/locked.log"','')
  ];
  for(const script of altered){
    const result=runWorkshop(script,'permissions');
    assert.equal(result.completed,false,script);
    assert.equal(result.errorLine,2,script);
  }
});

test('the visible exit status must be read with a real unquoted echo $? after file tests',()=>{
  for(const script of [
    valid.split('\n').slice(0,2).join('\n'),
    valid.replace('echo $?','echo 1'),
    valid.replace('echo $?', "echo '$?'"),
    valid.replace('echo $?','BASE=broken'),
    valid.replace('echo $?','echo $? && echo done')
  ]){
    const result=runWorkshop(script,'permissions');
    assert.equal(result.completed,false,script);
  }
});

test('malicious commands and permission changes are rejected before all execution',()=>{
  for(const script of [
    'BASE=~/practice\nchmod 644 "$BASE/checks/locked.log"',
    'BASE=~/practice\ncat "$BASE/checks/locked.log"',
    'BASE=~/practice\nrm "$BASE/checks/locked.log"',
    'BASE=~/practice\nfor FILE in a b; do cp "$FILE" "$FILE.copy"; done',
    'BASE=~/practice\ntest -f "$BASE/checks/locked.log" && chmod 644 "$BASE/checks/locked.log"',
    'BASE=~/practice\ncurl https://example.test'
  ]){
    const result=runWorkshop(script,'permissions');
    assert.equal(result.completed,false,script);
    assert.equal(result.steps.length,0,script);
    assert.deepEqual(result.state.files,createAcademyState().files);
  }
});

test('existing two scenarios retain working solutions and their original keys',()=>{
  const backup=[
    'BASE=~/practice',
    'for FILE in "$BASE/events.log" "$BASE/alerts.log"; do cp "$FILE" "$FILE.copy"; done',
    'test -f "$BASE/events.log.copy" && test -f "$BASE/alerts.log.copy"'
  ].join('\n');
  const absent=[
    'BASE=~/practice',
    'test -f "$BASE/manual.log" && test -f "$BASE/missing.log"',
    'echo $?'
  ].join('\n');
  assert.equal(runWorkshop(backup,'backup').completed,true);
  assert.equal(runWorkshop(absent,'diagnosis').completed,true);
  assert.equal(runWorkshop(absent,'permissions').completed,false);
  assert.equal(runWorkshop(valid,'diagnosis').completed,false);
  assert.equal(workshopDraftKey('backup'),'ctf-master:bash-workshop-draft-v1');
  assert.equal(workshopDraftKey('diagnosis'),'ctf-master:bash-workshop-diagnosis-draft-v1');
  assert.equal(workshopDraftKey('permissions'),'ctf-master:bash-workshop-permissions-draft-v1');
  assert.equal(workshopInitialScript('backup'),WORKSHOP_DEFAULT);
  assert.equal(workshopInitialScript('diagnosis'),DIAGNOSIS_DEFAULT);
  assert.equal(workshopInitialScript('permissions'),PERMISSIONS_DEFAULT);
  assert.deepEqual(workshopScenarios.map(s=>s.id),['backup','diagnosis','permissions']);
});

test('physical line mapping and fresh virtual state remain independent for permissions',()=>{
  const broken='\nBASE=~/practice\n\n'+valid.split('\n')[1].replace('test -r','test -x')+'\necho $?';
  const result=runWorkshop(broken,'permissions');
  assert.equal(result.completed,false);
  assert.equal(result.errorLine,4);
  assert.equal(runWorkshop(valid,'permissions').completed,true);
});
