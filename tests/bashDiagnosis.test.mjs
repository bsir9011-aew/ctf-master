import test from 'node:test';
import assert from 'node:assert/strict';
import {runWorkshop} from '../src/core/bashWorkshop.ts';
import {
 WORKSHOP_DEFAULT,DIAGNOSIS_DEFAULT,workshopDraftKey,
 workshopInitialScript,workshopScenarios
} from '../src/core/workshopScenarios.ts';
import {createAcademyState} from '../src/core/commandAcademy.ts';

const diagnose=[
  'BASE=~/practice',
  'test -f "$BASE/manual.log" && test -f "$BASE/missing.log"',
  'echo $?'
].join('\n');

test('diagnostic observes existing then missing log and prints nonzero status',()=>{
  const result=runWorkshop(diagnose,'diagnosis');
  assert.equal(result.completed,true,result.feedback);
  assert.equal(result.steps.length,3);
  assert.equal(result.steps[1].command,'conditional');
  assert.equal(result.steps[1].exitCode,1);
  assert.equal(result.steps[2].command,'echo');
  assert.equal(result.steps[2].output,'1');
  const original=createAcademyState();
  assert.deepEqual(result.state.files,original.files);
  assert.equal(result.errorLine,undefined);
});

test('diagnosis does not accept reversed order, skipped test or a different missing path',()=>{
  const variants=[
    diagnose.replace('"$BASE/manual.log" && test -f "$BASE/missing.log"',
      '"$BASE/missing.log" && test -f "$BASE/manual.log"'),
    diagnose.replace('missing.log','not-there.log'),
    diagnose.replace('manual.log','events.log'),
    diagnose.replace('&&','||')
  ];
  for(const source of variants){
    const result=runWorkshop(source,'diagnosis');
    assert.equal(result.completed,false,source);
    assert.equal(result.errorLine,2,source);
  }
});

test('diagnostic requires actual exit-status observation after failed predicate',()=>{
  for(const source of [
    diagnose.split('\n').slice(0,2).join('\n'),
    diagnose.replace('echo $?','BASE=1'),
    diagnose.replace('echo $?','echo 1'),
    diagnose.replace('echo $?',"echo '$?'"),
    diagnose.replace('echo $?','echo "$?" && echo "bad"')
  ]){
    const result=runWorkshop(source,'diagnosis');
    assert.equal(result.completed,false,source);
    assert.equal(result.state.files['/home/player/practice/missing.log'],undefined);
  }
});

test('diagnostic rejects dangerous commands and copy operations before executing any line',()=>{
  for(const source of [
    'BASE=~/practice\ncp ~/practice/manual.log ~/practice/changed.log',
    'BASE=~/practice\nfor FILE in x y; do cp "$FILE" "$FILE.copy"; done',
    'BASE=~/practice\nrm ~/practice/manual.log',
    'BASE=~/practice\ncurl https://example.test',
    'BASE=~/practice\ntest -f "$BASE/manual.log" && touch /tmp/x'
  ]){
    const result=runWorkshop(source,'diagnosis');
    assert.equal(result.completed,false,source);
    assert.equal(result.steps.length,0,source);
  }
});

test('workshop 01 still succeeds with same script and default argument',()=>{
  const backup=[
    'BASE=~/practice',
    'for FILE in "$BASE/events.log" "$BASE/alerts.log"; do cp "$FILE" "$FILE.copy"; done',
    'test -f "$BASE/events.log.copy" && test -f "$BASE/alerts.log.copy"'
  ].join('\n');
  assert.equal(runWorkshop(backup).completed,true);
  assert.equal(runWorkshop(backup,'backup').completed,true);
  assert.equal(runWorkshop(diagnose,'backup').completed,false);
  assert.equal(runWorkshop(backup,'diagnosis').completed,false);
});

test('draft keys preserve old scenario 01 drafts and isolate scenario 02',()=>{
  assert.equal(workshopDraftKey('backup'),'ctf-master:bash-workshop-draft-v1');
  assert.equal(workshopDraftKey('diagnosis'),'ctf-master:bash-workshop-diagnosis-draft-v1');
  assert.notEqual(workshopDraftKey('backup'),workshopDraftKey('diagnosis'));
  assert.equal(workshopInitialScript('backup'),WORKSHOP_DEFAULT);
  assert.equal(workshopInitialScript('diagnosis'),DIAGNOSIS_DEFAULT);
  assert.equal(workshopScenarios.length,8);
  assert.deepEqual(workshopScenarios.map(x=>x.id),['backup','diagnosis','permissions','fallback','transfer','pathblock','repair','service']);
});

test('diagnosis respects line numbers and does not reuse stale copied files',()=>{
  const source='\n\n'+diagnose.replace('missing.log','renamed.log');
  const failed=runWorkshop(source,'diagnosis');
  assert.equal(failed.errorLine,4);
  assert.equal(failed.state.files['/home/player/practice/events.log.copy'],undefined);
  assert.equal(runWorkshop(diagnose,'diagnosis').completed,true);
});
