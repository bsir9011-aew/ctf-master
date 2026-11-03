import test from 'node:test';
import assert from 'node:assert/strict';
import {executeLinux} from '../src/core/linux.ts';
import {createAcademyState} from '../src/core/commandAcademy.ts';
import {runServiceWorkshop} from '../src/core/serviceWorkshop.ts';
import {previewReporterFix} from '../src/core/reporterConfigRepair.ts';
import {REPORTER_CONFIG_PATH} from '../src/core/reporterConfigFixture.ts';
import {
  validReporterConfiguration,gradeReporterRestart,verifyReporterRestart
} from '../src/core/reporterControlledRestart.ts';

const steps=['ps aux','systemctl status reporter.service',
  'journalctl -u reporter','cat '+REPORTER_CONFIG_PATH];
const orders=a=>a.length===1?[a]:a.flatMap((v,i)=>
  orders(a.filter((_,j)=>j!==i)).map(rest=>[v,...rest]));
const incident=()=>runServiceWorkshop(steps.join('\n'),'reporter');

test('the corrected config parser requires precisely valid existing reporter settings',()=>{
  const good=previewReporterFix(incident(),'rename-directive');
  assert.ok(good);
  const value=good.state.files[REPORTER_CONFIG_PATH];
  assert.equal(validReporterConfiguration(value),true);
  for(const bad of [
    value.replace('output_path=/var/reports','output_dir=/var/reports'),
    value.replace('output_path=/var/reports','output_path=/tmp'),
    value.replace('retry_limit=3','retry_limit=0'),
    value.replace('format=csv','format=xml'),
    value+'output_path=/var/reports\n',
    value.replace('retry_limit=3',''),
    value+'shell=true\n'
  ])assert.equal(validReporterConfiguration(bad),false,bad);
});

test('24 read-only diagnostic orders permit a guarded virtual reporter restart',()=>{
  for(const lines of orders(steps)){
    const original=runServiceWorkshop(lines.join('\n'),'reporter');
    assert.equal(original.completed,true);
    const snapshot=structuredClone(original.state);
    const corrected=previewReporterFix(original,'rename-directive');
    assert.ok(corrected);
    assert.equal(corrected.verified,true);
    const correctedSnapshot=structuredClone(corrected.state);
    const grade=gradeReporterRestart(original,corrected,'validate-restart');
    assert.equal(grade?.matched,true);
    const recovered=verifyReporterRestart(original,corrected,'validate-restart');
    assert.ok(recovered,lines.join(' -> '));
    assert.equal(recovered.verified,true,JSON.stringify(recovered.checks));
    assert.equal(recovered.command,'systemctl restart reporter.service');
    assert.equal(recovered.beforeStatus,'failed');
    assert.equal(recovered.afterStatus,'active');
    assert.equal(recovered.beforePid,'nieaktywny');
    assert.equal(recovered.afterPid,'aktywny');
    assert.deepEqual(recovered.checks.map(check=>check.id),
      ['configuration','availability','scope']);
    assert.deepEqual(recovered.checks.map(check=>check.passed),[true,true,true]);
    assert.equal(executeLinux(recovered.state,'systemctl status reporter').output.includes(' Active: active\n'),true);
    assert.equal(executeLinux(recovered.state,'ps').output.includes('510  reporterd'),true);
    assert.equal(executeLinux(recovered.state,'journalctl -u reporter').output.includes('config validation failed'),true);
    assert.equal(recovered.state.files[REPORTER_CONFIG_PATH],
      corrected.state.files[REPORTER_CONFIG_PATH]);
    assert.deepEqual(original.state,snapshot,'no mutation of original incident');
    assert.deepEqual(corrected.state,correctedSnapshot,'no mutation of corrected preview');
  }
});

test('restart may not be approved before the actual one-line correction',()=>{
  const source=incident();
  assert.equal(gradeReporterRestart(source,null,'validate-restart')?.matched,null);
  assert.equal(verifyReporterRestart(source,null,'validate-restart'),null);
  const corrected=previewReporterFix(source,'rename-directive');
  assert.ok(corrected);
  assert.equal(gradeReporterRestart(source,corrected,''),null);
  for(const choice of ['restart-immediately','kill-process','edit-more']){
    assert.equal(gradeReporterRestart(source,corrected,choice)?.matched,false);
    assert.equal(verifyReporterRestart(source,corrected,choice),null);
  }
  assert.equal(gradeReporterRestart({...source,completed:false},corrected,'validate-restart')?.matched,null);
});

test('forged corrected previews and unrelated state changes cannot authorize restart',()=>{
  const source=incident();
  const good=previewReporterFix(source,'rename-directive');
  assert.ok(good);
  const variants=[
    {...good,verified:false},
    {...good,afterLine:'output_path=/tmp'},
    {...good,checks:good.checks.map((v,i)=>i===1?{...v,passed:false}:v)},
    {...good,state:{...good.state,files:{...good.state.files,
      [REPORTER_CONFIG_PATH]:good.state.files[REPORTER_CONFIG_PATH].replace('output_path','output_dir')}}},
    {...good,state:{...good.state,files:{...good.state.files,
      [REPORTER_CONFIG_PATH]:good.state.files[REPORTER_CONFIG_PATH].replace('/var/reports','/tmp')}}},
    {...good,state:{...good.state,services:{...good.state.services,
      reporter:{...good.state.services.reporter,status:'active'}}}},
    {...good,state:{...good.state,processes:good.state.processes.map(p=>p.service==='reporter'?
      {...p,running:true}:p)}},
    {...good,state:{...good.state,files:{...good.state.files,
      '/home/player/notes.txt':'tampered'}}},
    {...good,state:{...good.state,services:{...good.state.services,
      sshd:{...good.state.services.sshd,status:'failed'}}}}
  ];
  for(const tampered of variants){
    assert.equal(gradeReporterRestart(source,tampered,'validate-restart')?.matched,null);
    assert.equal(verifyReporterRestart(source,tampered,'validate-restart'),null);
  }
});

test('unsafe, missing, foreign, or mutated diagnostics do not trigger restart',()=>{
  const source=incident();
  const corrected=previewReporterFix(source,'rename-directive');
  assert.ok(corrected);
  for(const bad of [
    {...source,completed:false},
    {...source,steps:source.steps.slice(0,3)},
    {...source,steps:source.steps.map(s=>s.command==='cat'?{...s,
      output:'output_path=/var/reports'}:s)},
    {...source,state:{...source.state,files:{...source.state.files,
      [REPORTER_CONFIG_PATH]:'output_path=/var/reports\n'}}}
  ])assert.equal(verifyReporterRestart(bad,corrected,'validate-restart'),null);
  const preflight=runServiceWorkshop([
    'ps aux','systemctl restart reporter','journalctl -u reporter',
    'cat '+REPORTER_CONFIG_PATH
  ].join('\n'),'reporter');
  assert.equal(preflight.completed,false);
  assert.equal(preflight.steps.length,0);
  assert.equal(verifyReporterRestart(preflight,corrected,'validate-restart'),null);
  const academy=createAcademyState();
  assert.equal(academy.services?.reporter,undefined);
  assert.equal(Object.hasOwn(academy.files,REPORTER_CONFIG_PATH),false);
});
