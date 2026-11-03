import test from 'node:test';
import assert from 'node:assert/strict';
import {runServiceWorkshop} from '../src/core/serviceWorkshop.ts';
import {previewReporterFix} from '../src/core/reporterConfigRepair.ts';
import {verifyReporterStart} from '../src/core/reporterControlledStart.ts';
import {runReporterSmoke,gradeReporterSmoke} from '../src/core/reporterSmokeTest.ts';
import {REPORTER_CONFIG_PATH} from '../src/core/reporterConfigFixture.ts';
import {createAcademyState} from '../src/core/commandAcademy.ts';

const commands=['ps','systemctl status reporter','journalctl -u reporter',
  'cat '+REPORTER_CONFIG_PATH];
const permutations=a=>a.length===1?[a]:a.flatMap((v,i)=>
  permutations(a.filter((_,j)=>j!==i)).map(rest=>[v,...rest]));
const prepare=(lines=commands)=>{
  const incident=runServiceWorkshop(lines.join('\n'),'reporter');
  assert.equal(incident.completed,true,incident.feedback);
  const fix=previewReporterFix(incident,'rename-directive');
  assert.ok(fix);
  const start=verifyReporterStart(incident,fix);
  assert.ok(start);
  assert.equal(start.verified,true);
  return {incident,fix,start};
};
test('all 24 diagnostic orders expose real failed CSV write despite active service',()=>{
  for(const order of permutations(commands)){
    const {incident,fix,start}=prepare(order);
    const previous=structuredClone(incident.state);
    const fixed=structuredClone(fix.state);
    const active=structuredClone(start.state);
    const evidence=runReporterSmoke(incident,fix,start);
    assert.ok(evidence);
    assert.equal(evidence.attempted,true);
    assert.equal(evidence.outputPath,'/var/reports/ctf-smoke-report.csv');
    assert.equal(evidence.directoryExists,false);
    assert.equal(evidence.readCode,0);
    assert.equal(evidence.writeCode,1);
    assert.match(evidence.writeMessage,/katalog docelowy nie istnieje/);
    assert.equal(evidence.conclusion,'missing-output-dir');
    assert.match(evidence.command,/^cat .* > \/var\/reports\/ctf-smoke-report\.csv$/);
    assert.equal(Object.hasOwn(evidence.state.files,evidence.outputPath),false);
    assert.equal(evidence.state.services.reporter.status,'active');
    assert.equal(evidence.state.processes.find(p=>p.service==='reporter').running,true);
    assert.equal(gradeReporterSmoke(evidence,'missing-output-dir')?.matched,true);
    for(const other of ['restart-again','report-written','change-permissions']){
      assert.equal(gradeReporterSmoke(evidence,other)?.matched,false);
    }
    assert.deepEqual(incident.state,previous);
    assert.deepEqual(fix.state,fixed);
    assert.deepEqual(start.state,active);
  }
});
test('smoke test cannot start without a complete and verified reporter recovery',()=>{
  const {incident,fix,start}=prepare();
  assert.equal(runReporterSmoke(incident,null,start),null);
  assert.equal(runReporterSmoke(incident,fix,null),null);
  assert.equal(runReporterSmoke({...incident,completed:false},fix,start),null);
  assert.equal(runReporterSmoke({...incident,steps:incident.steps.slice(0,3)},fix,start),null);
  assert.equal(gradeReporterSmoke(null,'missing-output-dir')?.matched,null);
  assert.equal(gradeReporterSmoke(null,''),null);
  const other=runServiceWorkshop(['ps','systemctl status web','journalctl -u web'].join('\n'),'web');
  assert.equal(runReporterSmoke(other,fix,start),null);
});
test('forged reporter start status, wrong output path or unrelated file changes are refused',()=>{
  const {incident,fix,start}=prepare();
  const altered=[
    {...start,verified:false},
    {...start,afterStatus:'failed'},
    {...start,state:{...start.state,
      services:{...start.state.services,reporter:{...start.state.services.reporter,status:'failed'}}}},
    {...start,state:{...start.state,files:{...start.state.files,[REPORTER_CONFIG_PATH]:
      start.state.files[REPORTER_CONFIG_PATH].replace('/var/reports','/tmp')}}},
    {...start,state:{...start.state,files:{...start.state.files,
      '/home/player/notes.txt':'changed'}}},
    {...start,state:{...start.state,dirs:[...start.state.dirs,'/var/reports']}}
  ];
  for(const wrong of altered)assert.equal(runReporterSmoke(incident,fix,wrong),null);
  assert.equal(runReporterSmoke(incident,{...fix,afterLine:'output_path=/tmp'},start),null);
  assert.equal(runReporterSmoke(incident,{...fix,verified:false},start),null);
});
test('the smoke sample remains local and cannot overwrite a real or existing virtual file',()=>{
  const {incident,fix,start}=prepare();
  const original=structuredClone(createAcademyState());
  const evidence=runReporterSmoke(incident,fix,start);
  assert.ok(evidence);
  assert.equal(Object.hasOwn(start.state.files,'/home/player/practice/.reporter-smoke-input.csv'),false);
  assert.equal(Object.hasOwn(incident.state.files,'/home/player/practice/.reporter-smoke-input.csv'),false);
  assert.equal(evidence.state.files['/home/player/practice/.reporter-smoke-input.csv'],
    'id,total\n101,42\n');
  assert.deepEqual(createAcademyState(),original);
});
