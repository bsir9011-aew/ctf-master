import test from 'node:test';
import assert from 'node:assert/strict';
import {runWorkshop} from '../src/core/bashWorkshop.ts';
import {createAcademyState} from '../src/core/commandAcademy.ts';
import {
  workshopScenarios,workshopDraftKey,workshopInitialScript,FALLBACK_DEFAULT
} from '../src/core/workshopScenarios.ts';

const answer=[
  'BASE=~/practice',
  'test -f "$BASE/audit-daily.log" || test -f "$BASE/alerts.log"',
  'echo $?'
].join('\n');

test('transfer actually evaluates different files and observes fallback status',()=>{
  const result=runWorkshop(answer,'transfer');
  assert.equal(result.completed,true,result.feedback);
  assert.equal(result.steps.length,3);
  assert.deepEqual(result.steps[1].checks.map(c=>[c.operator,c.executed,c.exitCode]),
    [[undefined,true,1],['||',true,0]]);
  assert.equal(result.steps[2].output,'0');
  assert.deepEqual(result.state.files,createAcademyState().files);
  assert.deepEqual(result.state.permissions,createAcademyState().permissions);
});

test('old guided answer cannot pass transfer and independent answer cannot pass guided',()=>{
  const guided=[
    'BASE=~/practice',
    'test -f "$BASE/missing.log" || test -f "$BASE/manual.log"',
    'echo $?'
  ].join('\n');
  assert.equal(runWorkshop(guided,'fallback').completed,true);
  assert.equal(runWorkshop(guided,'transfer').completed,false);
  assert.equal(runWorkshop(answer,'fallback').completed,false);
  assert.equal(runWorkshop(answer,'transfer').completed,true);
});

test('incorrect operator, reversed or substituted paths, and bypassed checks are rejected',()=>{
  const variants=[
    answer.replace(' || ',' && '),
    answer.replace('audit-daily.log','manual.log'),
    answer.replace('alerts.log','manual.log'),
    answer.replace('audit-daily.log" || test -f "$BASE/alerts.log','alerts.log" || test -f "$BASE/audit-daily.log'),
    answer.replace(' || test -f "$BASE/alerts.log"',''),
    answer.replace('test -f "$BASE/alerts.log"','test -r "$BASE/alerts.log"')
  ];
  for(const script of variants){
    const result=runWorkshop(script,'transfer');
    assert.equal(result.completed,false,script);
    assert.equal(result.errorLine,2,script);
  }
});

test('status must come from immediately following real echo, not hardcoded zero',()=>{
  for(const script of [
    answer.replace('echo $?','echo 0'),
    answer.replace('echo $?', "echo '$?'"),
    answer.split('\n').slice(0,2).join('\n'),
    answer.replace('echo $?','BASE=broken'),
    'echo $?\n'+answer,
    answer+'\nBASE=other'
  ]){
    assert.equal(runWorkshop(script,'transfer').completed,false,script);
  }
});

test('preflight blocks unsafe commands before running any step',()=>{
  for(const script of [
    'BASE=~/practice\nrm ~/practice/alerts.log',
    'BASE=~/practice\ncurl https://example.test',
    'BASE=~/practice\nchmod 777 ~/practice/alerts.log',
    'BASE=~/practice\ntest -f "$BASE/audit-daily.log" || cp "$BASE/alerts.log" ~/practice/audit-daily.log',
    'BASE=~/practice\nfor FILE in a b; do cp "$FILE" "$FILE.copy"; done'
  ]){
    const result=runWorkshop(script,'transfer');
    assert.equal(result.completed,false,script);
    assert.equal(result.steps.length,0,script);
    assert.deepEqual(result.state.files,createAcademyState().files);
  }
});

test('blank transfer starter, isolated draft, original scenarios remain intact',()=>{
  assert.deepEqual(workshopScenarios.map(x=>x.id),[
    'backup','diagnosis','permissions','fallback','transfer','pathblock'
  ]);
  assert.equal(workshopInitialScript('transfer'),'');
  assert.equal(workshopInitialScript('fallback'),FALLBACK_DEFAULT);
  const prior={
    backup:'ctf-master:bash-workshop-draft-v1',
    diagnosis:'ctf-master:bash-workshop-diagnosis-draft-v1',
    permissions:'ctf-master:bash-workshop-permissions-draft-v1',
    fallback:'ctf-master:bash-workshop-fallback-draft-v1'
  };
  for(const [id,key] of Object.entries(prior)) assert.equal(workshopDraftKey(id),key);
  assert.equal(workshopDraftKey('transfer'),'ctf-master:bash-workshop-transfer-draft-v1');
  assert.ok(!Object.values(prior).includes(workshopDraftKey('transfer')));
});

test('meaningful feedback without ready-made syntax after a wrong attempt',()=>{
  const wrong=runWorkshop(answer.replace(' || ',' && '),'transfer');
  assert.equal(wrong.completed,false);
  assert.doesNotMatch(wrong.feedback,/test -f.*\|\|.*test -f/);
  assert.equal(wrong.steps[1].checks[1].executed,false);
});
