import test from 'node:test';
import assert from 'node:assert/strict';
import {runWorkshop} from '../src/core/bashWorkshop.ts';
import {createAcademyState} from '../src/core/commandAcademy.ts';
import {
  repairWorkshopDraftKey,repairWorkshopStarter,workshopDraftKey,workshopScenarios
} from '../src/core/workshopScenarios.ts';

const FILE='/home/player/practice/checks/locked.log';
const target='"$BASE/checks/locked.log"';
const valid=[
  'BASE=~/practice',
  'namei -l '+target,
  'chmod u+r '+target,
  'cat '+target
].join('\n');

test('minimal owner-only file repair restores read without altering other data',()=>{
  const base=createAcademyState();
  assert.equal(base.permissions[FILE],0o000);
  const r=runWorkshop(valid,'repair','file');
  assert.equal(r.completed,true,r.feedback);
  assert.deepEqual(r.steps.map(s=>s.command),['variable','namei','chmod','cat']);
  assert.equal(r.steps[1].blockedAt,undefined);
  assert.match(r.steps[1].output,/---------- .*locked\.log/);
  assert.equal(r.steps[2].exitCode,0);
  assert.equal(r.steps[3].output,base.files[FILE]);
  assert.equal(r.state.permissions[FILE],0o400);
  for(const [path,mode] of Object.entries(base.permissions))
    assert.equal(r.state.permissions[path],path===FILE?0o400:mode,path);
  assert.equal(Object.keys(r.state.permissions).length,Object.keys(base.permissions).length);
  assert.deepEqual(r.state.files,base.files);
  assert.deepEqual(r.state.dirs,base.dirs);
  assert.deepEqual(r.state.ownership,base.ownership);
});

test('symbolic u+r and exact octal owner-read modes pass; broad modes do not',()=>{
  for(const mode of ['u+r','400','0400']){
    const r=runWorkshop(valid.replace('chmod u+r','chmod '+mode),'repair','file');
    assert.equal(r.completed,true,mode+': '+r.feedback);
  }
  for(const mode of ['777','644','600','u+rw','a+r','g+r','o+r','u+x','-R']){
    const r=runWorkshop(valid.replace('chmod u+r','chmod '+mode),'repair','file');
    assert.equal(r.completed,false,mode);
    assert.equal(r.steps.length,0,mode);
    assert.equal(r.state.permissions[FILE],0o000);
  }
});

test('actual inspection and readback are required in the exact order',()=>{
  for(const script of [
    valid.replace('namei -l '+target,'namei -l "$BASE/diagnostics/service.log"'),
    valid.replace('cat '+target,'cat "$BASE/alerts.log"'),
    valid.replace('chmod u+r '+target,'chmod u+r "$BASE/diagnostics"'),
    valid.replace('BASE=~/practice','BASE=~/docs'),
    valid.replace('cat '+target,'echo 1'),
    valid.replace('namei -l '+target+'\n',''),
    valid.replace('cat '+target,''),
    valid.replace('namei -l '+target+'\nchmod u+r '+target,
      'chmod u+r '+target+'\nnamei -l '+target),
    valid.replace('cat '+target,'cat '+target+' | grep SERVICE')
  ]){
    assert.equal(runWorkshop(script,'repair','file').completed,false,script);
  }
});

test('whole-script preflight rejects unintended write, host/network and chaining',()=>{
  const base=createAcademyState();
  for(const script of [
    valid.replace('cat '+target,'rm '+target),
    valid.replace('cat '+target,'curl https://example.test'),
    valid.replace('cat '+target,'cat '+target+' > /tmp/out'),
    valid.replace('chmod u+r '+target,'chmod u+r '+target+' && cat '+target),
    valid.replace('cat '+target,'cat '+target+'; chmod 777 '+target),
    valid.replace('cat '+target,'touch "$BASE/another.log"'),
    valid.replace('cat '+target,'chmod 777 '+target)
  ]){
    const r=runWorkshop(script,'repair','file');
    assert.equal(r.completed,false,script);
    assert.equal(r.steps.length,0,script);
    assert.deepEqual(r.state.files,base.files);
    assert.deepEqual(r.state.permissions,base.permissions);
  }
});

test('fresh world per attempt: previous success cannot unlock subsequent read',()=>{
  assert.equal(runWorkshop(valid,'repair','file').completed,true);
  const r=runWorkshop('BASE=~/practice\ncat '+target,'repair','file');
  assert.equal(r.completed,false);
  assert.equal(r.steps[1]?.command,'cat');
  assert.equal(r.steps[1]?.exitCode,1);
  assert.equal(r.state.permissions[FILE],0o000);
});

test('old repair variants stay isolated from the new file incident',()=>{
  const directoryScript=[
    'BASE=~/practice',
    'namei -l "$BASE/diagnostics/service.log"',
    'chmod u+x "$BASE/diagnostics"',
    'cat "$BASE/diagnostics/service.log"'
  ].join('\n');
  assert.equal(runWorkshop(directoryScript,'repair','intro').completed,true);
  assert.equal(runWorkshop(directoryScript,'repair','file').completed,false);
  assert.equal(runWorkshop(valid,'repair','intro').completed,false);
  assert.equal(runWorkshop(valid,'repair','transfer').completed,false);
});

test('new file repair is blank, uses isolated local key, leaves menu at seven',()=>{
  assert.equal(repairWorkshopDraftKey('intro'),workshopDraftKey('repair'));
  assert.equal(repairWorkshopDraftKey('transfer'),'ctf-master:bash-workshop-repair-transfer-draft-v1');
  assert.equal(repairWorkshopDraftKey('file'),'ctf-master:bash-workshop-repair-file-draft-v1');
  assert.equal(repairWorkshopStarter('intro').startsWith('BASE='),true);
  assert.equal(repairWorkshopStarter('transfer'),'');
  assert.equal(repairWorkshopStarter('file'),'');
  assert.equal(workshopScenarios.length,7);
  assert.equal(workshopScenarios.at(-1).id,'repair');
});