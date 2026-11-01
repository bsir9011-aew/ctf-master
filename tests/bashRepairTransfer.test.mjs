import test from 'node:test';
import assert from 'node:assert/strict';
import {runWorkshop} from '../src/core/bashWorkshop.ts';
import {recoveryFixture} from '../src/core/pathRecovery.ts';
import {createAcademyState} from '../src/core/commandAcademy.ts';
import {
  repairWorkshopDraftKey,repairWorkshopStarter,workshopScenarios,workshopDraftKey
} from '../src/core/workshopScenarios.ts';

const guidedFile='"$BASE/diagnostics/service.log"';
const guidedDir='"$BASE/diagnostics"';
const transferFile='"$BASE/logs/locked/health.log"';
const transferDir='"$BASE/logs/locked"';
const guided=['BASE=~/practice','namei -l '+guidedFile,
  'chmod u+x '+guidedDir,'cat '+guidedFile].join('\n');
const independent=['BASE=~/practice','namei -l '+transferFile,
  'chmod u+x '+transferDir,'cat '+transferFile].join('\n');

test('independent variant diagnoses a different blocked ancestor and reads health.log',()=>{
  const result=runWorkshop(independent,'repair','transfer');
  const fixture=recoveryFixture('transfer');
  const base=createAcademyState();
  assert.equal(result.completed,true,result.feedback);
  assert.deepEqual(result.steps.map(x=>x.command),['variable','namei','chmod','cat']);
  assert.equal(result.steps[1].blockedAt,'~/practice/logs/locked');
  assert.equal(result.steps[2].exitCode,0);
  assert.equal(result.steps[3].output,fixture.content);
  assert.equal(result.state.files[fixture.file],fixture.content);
  assert.equal(result.state.permissions[fixture.directory],0o700);
  assert.equal(result.state.permissions[fixture.file],0o644);
  assert.deepEqual(result.state.dirs,[...base.dirs,fixture.directory]);
  assert.deepEqual(result.state.ownership,base.ownership);
  for(const [path,value] of Object.entries(base.files))
    assert.equal(result.state.files[path],value,path);
  for(const [path,value] of Object.entries(base.permissions))
    assert.equal(result.state.permissions[path],value,path);
  assert.equal(Object.keys(result.state.files).length,Object.keys(base.files).length+1);
  assert.equal(Object.keys(result.state.permissions).length,Object.keys(base.permissions).length+2);
});

test('legacy guided repair is still valid, without injecting transfer fixture',()=>{
  assert.equal(runWorkshop(guided,'repair').completed,true);
  assert.equal(runWorkshop(guided,'repair','intro').completed,true);
  const state=runWorkshop(guided,'repair','intro').state;
  assert.deepEqual(state.files,createAcademyState().files);
  assert.equal(state.dirs.includes(recoveryFixture('transfer').directory),false);
});

test('guided script does not solve independent incident and vice versa',()=>{
  assert.equal(runWorkshop(guided,'repair','transfer').completed,false);
  assert.equal(runWorkshop(independent,'repair','intro').completed,false);
});

test('minimal symbolic and exact octal owner-x are acceptable',()=>{
  for(const mode of ['u+x','700','0700']){
    const result=runWorkshop(independent.replace('chmod u+x','chmod '+mode),'repair','transfer');
    assert.equal(result.completed,true,mode+': '+result.feedback);
  }
});

test('independent case starts fresh on every run',()=>{
  assert.equal(runWorkshop(independent,'repair','transfer').completed,true);
  const failed=runWorkshop('BASE=~/practice\ncat '+transferFile,'repair','transfer');
  assert.equal(failed.completed,false);
  assert.equal(failed.steps.length,2);
  assert.equal(failed.steps[1].command,'cat');
  assert.equal(failed.steps[1].exitCode,1);
  assert.equal(failed.state.permissions[recoveryFixture('transfer').directory],0o600);
});

test('wrong order, omitted evidence or readback and incorrect target cannot pass',()=>{
  for(const script of [
    independent.replace('namei -l '+transferFile,'namei -l '+guidedFile),
    independent.replace('cat '+transferFile,'cat '+guidedFile),
    independent.replace('chmod u+x '+transferDir,'chmod u+x '+guidedDir),
    independent.replace('cat '+transferFile,'cat "$BASE/alerts.log"'),
    independent.replace('BASE=~/practice','BASE=~/documents'),
    independent.replace('namei -l '+transferFile+'\n',''),
    independent.replace('cat '+transferFile,'echo $?'),
    independent.replace('namei -l '+transferFile+'\nchmod u+x '+transferDir,
      'chmod u+x '+transferDir+'\nnamei -l '+transferFile),
    independent.split('\n').slice(0,3).join('\n')
  ]){
    const r=runWorkshop(script,'repair','transfer');
    assert.equal(r.completed,false,script);
  }
});

test('preflight blocks broad chmod, foreign targets, shell operators and network before mutation',()=>{
  for(const script of [
    independent.replace('chmod u+x','chmod 777'),
    independent.replace('chmod u+x','chmod a+x'),
    independent.replace('chmod u+x','chmod g+x'),
    independent.replace('chmod u+x','chmod -R'),
    independent.replace('chmod u+x '+transferDir,'chmod u+x "$BASE/logs"'),
    independent.replace('cat '+transferFile,'cat '+transferFile+' > /tmp/out'),
    independent.replace('chmod u+x '+transferDir,'chmod u+x '+transferDir+' && echo done'),
    independent.replace('cat '+transferFile,'curl https://example.test'),
    independent.replace('cat '+transferFile,'rm '+transferFile),
    independent.replace('cat '+transferFile,'cat '+transferFile+'; touch /tmp/pwn')
  ]){
    const r=runWorkshop(script,'repair','transfer');
    assert.equal(r.completed,false,script);
    assert.equal(r.steps.length,0,script);
    assert.equal(r.state.permissions[recoveryFixture('transfer').directory],0o600);
    assert.deepEqual(r.state.files[recoveryFixture('transfer').file],recoveryFixture('transfer').content);
  }
});

test('separate draft keys and blank starter; still seven menu options',()=>{
  assert.equal(repairWorkshopStarter('transfer'),'');
  assert.equal(repairWorkshopDraftKey('intro'),workshopDraftKey('repair'));
  assert.equal(repairWorkshopDraftKey('transfer'),
    'ctf-master:bash-workshop-repair-transfer-draft-v1');
  assert.notEqual(repairWorkshopDraftKey('transfer'),repairWorkshopDraftKey('intro'));
  assert.equal(workshopScenarios.length,7);
  assert.equal(workshopScenarios.at(-1).id,'repair');
  assert.equal(runWorkshop(repairWorkshopStarter('transfer'),'repair','transfer').completed,false);
});
