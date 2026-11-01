import test from 'node:test';
import assert from 'node:assert/strict';
import {runWorkshop} from '../src/core/bashWorkshop.ts';
import {createAcademyState} from '../src/core/commandAcademy.ts';
import {FALLBACK_DEFAULT,workshopDraftKey,workshopInitialScript,workshopScenarios} from '../src/core/workshopScenarios.ts';

const valid=[
  'BASE=~/practice',
  'test -f "$BASE/missing.log" || test -f "$BASE/manual.log"',
  'echo $?'
].join('\n');

test('real fallback executes after missing primary and ends with status 0',()=>{
  const r=runWorkshop(valid,'fallback');
  assert.equal(r.completed,true,r.feedback);
  assert.equal(r.steps[1].command,'conditional');
  assert.equal(r.steps[1].exitCode,0);
  assert.equal(r.steps[2].output,'0');
  assert.deepEqual(r.state.files,createAcademyState().files);
  assert.deepEqual(r.state.permissions,createAcademyState().permissions);
});

test('wrong operator, reversed order, missing fallback and wrong paths cannot pass',()=>{
  for(const source of [
    valid.replace(' || ',' && '),
    valid.replace('missing.log','manual.log'),
    valid.replace('manual.log','missing.log'),
    valid.replace('missing.log" || test -f "$BASE/manual.log','manual.log" || test -f "$BASE/missing.log'),
    valid.replace(' || ',' || test -r "$BASE/manual.log" || '),
    valid.replace('test -f "$BASE/manual.log"','test -r "$BASE/manual.log"'),
    valid.replace(' || test -f "$BASE/manual.log"',''),
  ]) {
    const r=runWorkshop(source,'fallback');
    assert.equal(r.completed,false,source);
  }
});

test('the actual exit status must be observed immediately and cannot be forged',()=>{
  for(const source of [
    valid.replace('echo $?','echo 0'),
    valid.replace('echo $?', "echo '$?'"),
    valid.replace('echo $?','BASE=other'),
    valid.replace('\necho $?',''),
    valid+'\nBASE=anything',
    'echo $?\n'+valid
  ]) {
    assert.equal(runWorkshop(source,'fallback').completed,false,source);
  }
});

test('all dangerous commands are rejected before any execution',()=>{
  for(const source of [
    'BASE=~/practice\nrm ~/practice/manual.log',
    'BASE=~/practice\nchmod 777 ~/practice/manual.log',
    'BASE=~/practice\ntest -f "$BASE/missing.log" || cp "$BASE/manual.log" "$BASE/new.log"',
    'BASE=~/practice\ncurl https://example.test'
  ]) {
    const r=runWorkshop(source,'fallback');
    assert.equal(r.completed,false,source);
    assert.equal(r.steps.length,0,source);
  }
});

test('earlier scenarios retain original draft keys and fallback uses an isolated draft',()=>{
  assert.deepEqual(workshopScenarios.map(x=>x.id),['backup','diagnosis','permissions','fallback','transfer','pathblock']);
  assert.equal(workshopDraftKey('backup'),'ctf-master:bash-workshop-draft-v1');
  assert.equal(workshopDraftKey('diagnosis'),'ctf-master:bash-workshop-diagnosis-draft-v1');
  assert.equal(workshopDraftKey('permissions'),'ctf-master:bash-workshop-permissions-draft-v1');
  assert.equal(workshopDraftKey('fallback'),'ctf-master:bash-workshop-fallback-draft-v1');
  assert.equal(workshopInitialScript('fallback'),FALLBACK_DEFAULT);
  assert.equal(runWorkshop(valid,'permissions').completed,false);
  assert.equal(runWorkshop(valid,'diagnosis').completed,false);
  assert.equal(runWorkshop(valid,'backup').completed,false);
});
