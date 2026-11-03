import test from 'node:test';
import assert from 'node:assert/strict';
import {executeLinux} from '../src/core/linux.ts';
import {createAcademyState} from '../src/core/commandAcademy.ts';
import {
  runServiceWorkshop,observedServiceDiagnosis,serviceWorldForTicket,
  gradeServiceDiagnosis
} from '../src/core/serviceWorkshop.ts';
import {
  gradeReporterFix,previewReporterFix
} from '../src/core/reporterConfigRepair.ts';
import {REPORTER_CONFIG_PATH,REPORTER_CONFIG_CONTENT} from '../src/core/reporterConfigFixture.ts';
import {gradeServiceResponse,verifyServiceResponse} from '../src/core/serviceResponse.ts';

const reporterCommands=[
  'ps aux','systemctl status reporter.service',
  'journalctl -u reporter','cat '+REPORTER_CONFIG_PATH
];
const orders=a=>a.length===1?[a]:a.flatMap((v,i)=>
  orders(a.filter((_,j)=>j!==i)).map(rest=>[v,...rest]));

test('reporter configuration is a real, read-only, isolated virtual file',()=>{
  const academy=createAcademyState();
  const world=serviceWorldForTicket('reporter');
  assert.equal(Object.hasOwn(academy.files,REPORTER_CONFIG_PATH),false);
  assert.equal(world.files[REPORTER_CONFIG_PATH],REPORTER_CONFIG_CONTENT);
  assert.equal(world.permissions[REPORTER_CONFIG_PATH],0o644);
  const actual=executeLinux(world,'cat '+REPORTER_CONFIG_PATH);
  assert.equal(actual.ok,true);
  assert.equal(actual.command,'cat');
  assert.equal(actual.target,REPORTER_CONFIG_PATH);
  assert.equal(actual.output,REPORTER_CONFIG_CONTENT);
  assert.match(actual.output,/^# dostępne klucze: format, output_path, retry_limit$/m);
  assert.match(actual.output,/^output_dir=\/var\/reports$/m);
  assert.equal(executeLinux(academy,'cat '+REPORTER_CONFIG_PATH).ok,false);
  assert.deepEqual(academy,createAcademyState());
});
test('all 24 diagnostic orderings require actual file, journal, service and process evidence',()=>{
  for(const script of orders(reporterCommands)){
    const incident=runServiceWorkshop(script.join('\n'),'reporter');
    assert.equal(incident.completed,true,script.join(' -> ')+': '+incident.feedback);
    assert.equal(incident.steps.length,4);
    assert.equal(observedServiceDiagnosis(incident,'reporter'),'config');
    assert.equal(gradeServiceDiagnosis(incident,'reporter','config').matched,true);
    const read=incident.steps.find(s=>s.command==='cat');
    assert.equal(read.target,REPORTER_CONFIG_PATH);
    assert.equal(read.exitCode,0);
    assert.equal(read.output,REPORTER_CONFIG_CONTENT);
    const snapshot=structuredClone(incident.state);
    const correct=gradeReporterFix(incident,'rename-directive');
    assert.equal(correct.matched,true);
    const preview=previewReporterFix(incident,'rename-directive');
    assert.ok(preview);
    assert.equal(preview.verified,true);
    assert.equal(preview.beforeLine,'output_dir=/var/reports');
    assert.equal(preview.afterLine,'output_path=/var/reports');
    assert.deepEqual(preview.checks.map(x=>x.passed),[true,true,true]);
    assert.equal(preview.state.files[REPORTER_CONFIG_PATH].includes('output_dir='),false);
    assert.match(preview.state.files[REPORTER_CONFIG_PATH],/^output_path=\/var\/reports$/m);
    assert.equal(preview.state.services.reporter.status,'failed');
    assert.equal(preview.state.processes.find(x=>x.service==='reporter').running,false);
    assert.deepEqual(incident.state,snapshot,'no preview mutates source');
  }
});
test('wrong minimal fixes are rejected without changing any virtual resource',()=>{
  const incident=runServiceWorkshop(reporterCommands.join('\n'),'reporter');
  assert.equal(gradeReporterFix(incident,''),null);
  for(const choice of ['delete-directive','chmod-777','restart-only']){
    const assessment=gradeReporterFix(incident,choice);
    assert.equal(assessment.matched,false,choice);
    assert.doesNotMatch(assessment.message,/Poprawnie/);
    assert.equal(previewReporterFix(incident,choice),null);
  }
  assert.equal(gradeServiceResponse(incident,'reporter','config','restart-target').matched,false);
  const legacyPreview=verifyServiceResponse(incident,'reporter','config','inspect-config');
  assert.ok(legacyPreview);
  assert.equal(legacyPreview.command,null);
  assert.deepEqual(legacyPreview.state,incident.state);
});
test('provenance: truncated, other-file, invented, unsafe and forged evidence cannot certify correction',()=>{
  const incident=runServiceWorkshop(reporterCommands.join('\n'),'reporter');
  for(const bad of [
    reporterCommands.slice(0,3).join('\n'),
    ['ps','systemctl status reporter','journalctl -u reporter','cat /home/player/notes.txt'].join('\n'),
    ['ps','systemctl status reporter','journalctl -u reporter','chmod 777 '+REPORTER_CONFIG_PATH].join('\n'),
    ['ps','systemctl status reporter','journalctl -u reporter','cat '+REPORTER_CONFIG_PATH+' | head'].join('\n'),
    ['ps','systemctl status reporter','journalctl -u reporter','cat '+REPORTER_CONFIG_PATH+' > /tmp/out'].join('\n'),
    ['ps','systemctl status reporter','journalctl -u reporter','systemctl restart reporter'].join('\n')
  ]){
    const res=runServiceWorkshop(bad,'reporter');
    assert.equal(res.completed,false,bad);
    assert.equal(res.steps.length,0,'must reject unsafe or wrong commands before execution');
    assert.equal(previewReporterFix(res,'rename-directive'),null);
  }
  const alternatives=[
    {...incident,completed:false},
    {...incident,steps:incident.steps.slice(0,3)},
    {...incident,steps:incident.steps.map(x=>x.command==='cat'?{...x,output:'output_dir=/foo'}:x)},
    {...incident,steps:incident.steps.map(x=>x.command==='cat'?{...x,target:'/home/player/notes.txt'}:x)},
    {...incident,steps:incident.steps.map(x=>x.command==='journalctl'?{...x,output:'reporter service active'}:x)},
    {...incident,state:{...incident.state,files:{...incident.state.files,[REPORTER_CONFIG_PATH]:'output_path=/tmp'}}},
    {...incident,state:{...incident.state,services:{...incident.state.services,web:{...incident.state.services.web,status:'active'}}}},
    {...incident,state:{...incident.state,files:{...incident.state.files,'/home/player/notes.txt':'changed'}}}
  ];
  for(const altered of alternatives){
    assert.equal(previewReporterFix(altered,'rename-directive'),null);
  }
});
test('virtual one-line correction retains all other fields, ownership, rights, processes and services',()=>{
  const incident=runServiceWorkshop(reporterCommands.join('\n'),'reporter');
  const preview=previewReporterFix(incident,'rename-directive');
  assert.ok(preview);
  const before=incident.state,after=preview.state;
  assert.equal(after.permissions[REPORTER_CONFIG_PATH],before.permissions[REPORTER_CONFIG_PATH]);
  assert.deepEqual(after.ownership,before.ownership);
  assert.deepEqual(after.services,before.services);
  assert.deepEqual(after.processes,before.processes);
  const changedBack={...after,files:{...after.files,[REPORTER_CONFIG_PATH]:before.files[REPORTER_CONFIG_PATH]}};
  assert.deepEqual(changedBack,before);
  assert.equal(after.files[REPORTER_CONFIG_PATH].split('\n').length,
    before.files[REPORTER_CONFIG_PATH].split('\n').length);
  assert.equal(executeLinux(after,'cat '+REPORTER_CONFIG_PATH).output,
    after.files[REPORTER_CONFIG_PATH]);
});
test('other service scenarios still require original numbers of commands',()=>{
  for(const id of ['web','api','queue','scheduler','gateway']){
    const script=[
      'ps aux','systemctl status '+id,'journalctl -u '+id,
      ...(id==='scheduler'?['systemctl status redis']:id==='gateway'?['ss -ltnp']:[])
    ].join('\n');
    assert.equal(runServiceWorkshop(script,id).completed,true,id);
  }
});
