import test from 'node:test';
import assert from 'node:assert/strict';
import {runServiceWorkshop,serviceWorldForTicket} from '../src/core/serviceWorkshop.ts';
import {previewReporterFix} from '../src/core/reporterConfigRepair.ts';
import {verifyReporterStart} from '../src/core/reporterControlledStart.ts';
import {REPORTER_CONFIG_PATH} from '../src/core/reporterConfigFixture.ts';
import {executeLinux} from '../src/core/linux.ts';
import {createAcademyState} from '../src/core/commandAcademy.ts';

const cmds=[
  'ps aux','systemctl status reporter.service',
  'journalctl -u reporter','cat '+REPORTER_CONFIG_PATH
];
const permute=a=>a.length===1?[a]:a.flatMap((v,i)=>
  permute(a.filter((_,j)=>j!==i)).map(rest=>[v,...rest]));

test('all 24 valid diagnostic orders lead to safe controlled virtual reporter startup',()=>{
  for(const order of permute(cmds)){
    const incident=runServiceWorkshop(order.join('\n'),'reporter');
    assert.equal(incident.completed,true,incident.feedback);
    const incidentOriginal=structuredClone(incident.state);
    const fix=previewReporterFix(incident,'rename-directive');
    assert.ok(fix);
    assert.equal(fix.verified,true);
    const fixedOriginal=structuredClone(fix.state);
    const result=verifyReporterStart(incident,fix);
    assert.ok(result,order.join(' / '));
    assert.equal(result.verified,true,result.message);
    assert.equal(result.beforeStatus,'failed');
    assert.equal(result.afterStatus,'active');
    assert.equal(result.beforePid,'nieaktywny');
    assert.equal(result.afterPid,'aktywny');
    assert.equal(result.command,'systemctl restart reporter.service');
    assert.deepEqual(result.checks.map(x=>x.id),['config','availability','scope']);
    assert.deepEqual(result.checks.map(x=>x.passed),[true,true,true]);
    assert.equal(result.state.services.reporter.status,'active');
    assert.equal(result.state.processes.find(x=>x.service==='reporter').running,true);
    assert.equal(executeLinux(result.state,'cat '+REPORTER_CONFIG_PATH).output,
      ' # '.trimStart()+' reporter.service - konfiguracja treningowa\n'+
      '# dostępne klucze: format, output_path, retry_limit\n'+
      'format=csv\noutput_path=/var/reports\nretry_limit=3\n');
    assert.deepEqual(incident.state,incidentOriginal,'incident unchanged');
    assert.deepEqual(fix.state,fixedOriginal,'fix preview unchanged');
  }
});

test('service availability and complete resource scope are checked against real virtual state',()=>{
  const incident=runServiceWorkshop(cmds.join('\n'),'reporter');
  const fixed=previewReporterFix(incident,'rename-directive');
  const result=verifyReporterStart(incident,fixed);
  assert.ok(result);
  const before=fixed.state,after=result.state;
  assert.equal(after.files[REPORTER_CONFIG_PATH],before.files[REPORTER_CONFIG_PATH]);
  assert.deepEqual(after.files,before.files);
  assert.deepEqual(after.permissions,before.permissions);
  assert.deepEqual(after.ownership,before.ownership);
  assert.deepEqual(after.dirs,before.dirs);
  for(const [name,svc] of Object.entries(before.services)){
    if(name!=='reporter')assert.deepEqual(after.services[name],svc);
  }
  assert.deepEqual(after.processes.filter(p=>p.service!=='reporter'),
    before.processes.filter(p=>p.service!=='reporter'));
  assert.deepEqual(after.services.reporter.journal.slice(0,-1),
    before.services.reporter.journal,'failure evidence must remain in journal');
  assert.equal(after.services.reporter.journal.at(-1),
    'systemd: reporter.service started successfully');
  assert.deepEqual(createAcademyState(),serviceWorldForTicket('web'));
});

test('cannot start with no verified minimal config correction',()=>{
  const incident=runServiceWorkshop(cmds.join('\n'),'reporter');
  assert.equal(verifyReporterStart(incident,null),null);
  const fix=previewReporterFix(incident,'rename-directive');
  assert.ok(fix);
  for(const bad of [
    {...fix,verified:false},
    {...fix,checks:fix.checks.map((x,i)=>i?x:{...x,passed:false})},
    {...fix,afterLine:'output_path=/tmp'},
    {...fix,state:{...fix.state,files:{
      ...fix.state.files,[REPORTER_CONFIG_PATH]:'output_dir=/var/reports\n'}}},
    {...fix,state:{...fix.state,permissions:{
      ...fix.state.permissions,[REPORTER_CONFIG_PATH]:0o777}}},
    {...fix,state:{...fix.state,services:{
      ...fix.state.services,queue:{...fix.state.services.queue,status:'failed'}}}},
    {...fix,state:{...fix.state,files:{
      ...fix.state.files,'/home/player/notes.txt':'tampered'}}}
  ]){
    assert.equal(verifyReporterStart(incident,bad),null);
  }
});

test('wrong, incomplete, forged and foreign incident evidence cannot trigger startup',()=>{
  const incident=runServiceWorkshop(cmds.join('\n'),'reporter');
  const fix=previewReporterFix(incident,'rename-directive');
  assert.ok(fix);
  for(const bad of [
    {...incident,completed:false},
    {...incident,steps:incident.steps.slice(0,3)},
    {...incident,steps:incident.steps.map(s=>s.command==='cat'?
      {...s,output:'output_path=/var/reports'}:s)},
    {...incident,steps:incident.steps.map(s=>s.command==='journalctl'?
      {...s,output:'ready'}:s)},
    {...incident,state:{...incident.state,processes:
      incident.state.processes.map(p=>p.service==='web'?{...p,running:true}:p)}}
  ]){
    assert.equal(verifyReporterStart(bad,fix),null);
  }
  const other=runServiceWorkshop([
    'ps','systemctl status api','journalctl -u api'
  ].join('\n'),'api');
  assert.equal(verifyReporterStart(other,fix),null);
});
