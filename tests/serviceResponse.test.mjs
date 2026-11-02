import test from 'node:test';
import assert from 'node:assert/strict';
import {createAcademyState} from '../src/core/commandAcademy.ts';
import {runServiceWorkshop,observedServiceDiagnosis} from '../src/core/serviceWorkshop.ts';
import {gradeServiceResponse,verifyServiceResponse} from '../src/core/serviceResponse.ts';
import {executeLinux} from '../src/core/linux.ts';

const incidents=[
  ['web','crash','restart-target','failed','active'],
  ['api','startup','investigate-startup','failed','failed'],
  ['queue','healthy','verify-alert','active','active']
];
const script=id=>['ps','systemctl status '+id,'journalctl -u '+id].join('\n');
test('the three diagnoses have three distinct justified responses',()=>{
  for(const [id,diagnosis,action,beforeStatus,afterStatus] of incidents){
    const incident=runServiceWorkshop(script(id),id);
    assert.equal(incident.completed,true,id);
    assert.equal(observedServiceDiagnosis(incident,id),diagnosis);
    assert.equal(gradeServiceResponse(incident,id,diagnosis,'restart-target')?.matched,
      id==='web');
    assert.equal(gradeServiceResponse(incident,id,diagnosis,action)?.matched,true);
    assert.equal(gradeServiceResponse(incident,id,diagnosis,'kill-worker')?.matched,false);
    const before=structuredClone(incident.state);
    const preview=verifyServiceResponse(incident,id,diagnosis,action);
    assert.ok(preview,id);
    assert.equal(preview.verified,true,id+': '+preview.message);
    assert.equal(preview.beforeStatus,beforeStatus);
    assert.equal(preview.afterStatus,afterStatus);
    assert.deepEqual(preview.checks.map(c=>c.id),['status','process','scope']);
    assert.deepEqual(preview.checks.map(c=>c.passed),[true,true,true]);
    assert.deepEqual(incident.state,before,'preview cannot modify original incident');
    assert.equal(executeLinux(preview.state,'systemctl status '+id).ok,true);
    assert.equal(executeLinux(preview.state,'journalctl -u '+id).ok,true);
    assert.equal(executeLinux(preview.state,'ps').ok,true);
    assert.equal(preview.state.services.sshd.status,'active');
  }
});

test('crashed web worker is restarted only in disposable virtual state',()=>{
  const original=createAcademyState();
  const incident=runServiceWorkshop(script('web'),'web');
  const preview=verifyServiceResponse(incident,'web','crash','restart-target');
  assert.ok(preview);
  assert.equal(preview.command,'systemctl restart web.service');
  assert.deepEqual({before:preview.beforePid,after:preview.afterPid},
    {before:'nieaktywny',after:'aktywny'});
  assert.equal(preview.state.services.web.status,'active');
  assert.equal(preview.state.processes.find(p=>p.service==='web').running,true);
  assert.match(preview.message,/nie jest dowód trwałego usunięcia źródła/);
  assert.deepEqual(preview.state.services.web.journal.slice(0,-1),
    original.services.web.journal,'original failure log must be preserved');
  assert.deepEqual(preview.state.services.api,original.services.api);
  assert.deepEqual(preview.state.services.queue,original.services.queue);
  assert.deepEqual(preview.state.processes.filter(p=>p.service!=='web'),
    original.processes.filter(p=>p.service!=='web'));
  assert.deepEqual(original,createAcademyState());
});

test('failed startup remains failed: restarting it cannot count as fixing the root cause',()=>{
  const incident=runServiceWorkshop(script('api'),'api');
  const preview=verifyServiceResponse(incident,'api','startup','investigate-startup');
  assert.ok(preview);
  assert.equal(preview.command,null);
  assert.equal(preview.state.services.api.status,'failed');
  assert.equal(preview.state.processes.find(p=>p.service==='api').running,false);
  assert.match(preview.message,/nadal failed/);
  assert.deepEqual(preview.state,incident.state,'investigation only, no simulated mutation');
  assert.equal(gradeServiceResponse(incident,'api','startup','restart-target').matched,false);
  assert.equal(verifyServiceResponse(incident,'api','startup','restart-target'),null);
});

test('healthy queue requires no intervention; alert itself is not proof of a failure',()=>{
  const incident=runServiceWorkshop(script('queue'),'queue');
  const preview=verifyServiceResponse(incident,'queue','healthy','verify-alert');
  assert.ok(preview);
  assert.equal(preview.command,null);
  assert.equal(preview.state.services.queue.status,'active');
  assert.equal(preview.state.processes.find(p=>p.service==='queue').running,true);
  assert.deepEqual(preview.state,incident.state);
  assert.equal(verifyServiceResponse(incident,'queue','healthy','restart-target'),null);
  assert.equal(gradeServiceResponse(incident,'queue','healthy','kill-worker').matched,false);
});

test('wrong action, diagnosis, or unrelated ticket cannot validate a response',()=>{
  for(const [id,diagnosis,correct] of incidents){
    const incident=runServiceWorkshop(script(id),id);
    assert.equal(gradeServiceResponse(incident,id,diagnosis,''),null);
    for(const choice of ['restart-target','investigate-startup','verify-alert','kill-worker']){
      if(choice!==correct){
        assert.equal(gradeServiceResponse(incident,id,diagnosis,choice).matched,false);
        assert.equal(verifyServiceResponse(incident,id,diagnosis,choice),null);
      }
    }
    for(const wrong of ['crash','startup','healthy'].filter(x=>x!==diagnosis)){
      assert.equal(gradeServiceResponse(incident,id,wrong,correct).matched,null);
      assert.equal(verifyServiceResponse(incident,id,wrong,correct),null);
    }
    for(const other of incidents.map(x=>x[0]).filter(x=>x!==id)){
      assert.equal(verifyServiceResponse(incident,other,diagnosis,correct),null);
    }
  }
});

test('no incomplete, spoofed or inconsistent evidence triggers a response',()=>{
  const incident=runServiceWorkshop(script('web'),'web');
  const variants=[
    {...incident,completed:false},
    {...incident,steps:incident.steps.slice(0,2)},
    {...incident,steps:incident.steps.map(s=>s.command==='ps'?
      {...s,output:s.output+'\n331 webd'}:s)},
    {...incident,steps:incident.steps.map(s=>s.command==='systemctl'?
      {...s,output:'web.service\n Active: active\n Main PID: 331\n'}:s)},
    {...incident,steps:incident.steps.map(s=>s.command==='journalctl'?
      {...s,output:'08:00 web: started successfully'}:s)},
    {...incident,state:{...incident.state,
      services:{...incident.state.services,sshd:{...incident.state.services.sshd,status:'inactive'}}}}
  ];
  for(const altered of variants){
    const actual=gradeServiceResponse(altered,'web','crash','restart-target');
    if(actual?.matched===true){
      assert.equal(verifyServiceResponse(altered,'web','crash','restart-target'),null,
        'fake world must never be processed');
    }else assert.notEqual(actual?.matched,true);
    assert.equal(verifyServiceResponse(altered,'web','crash','restart-target'),null);
  }
});

test('all six read-only command permutations preserve response behavior',()=>{
  const orderings=[
    ['ps','systemctl status web','journalctl -u web'],
    ['ps','journalctl -u web','systemctl status web'],
    ['systemctl status web','ps','journalctl -u web'],
    ['systemctl status web','journalctl -u web','ps'],
    ['journalctl -u web','ps','systemctl status web'],
    ['journalctl -u web','systemctl status web','ps']
  ];
  for(const lines of orderings){
    const result=runServiceWorkshop(lines.join('\n'),'web');
    const preview=verifyServiceResponse(result,'web','crash','restart-target');
    assert.ok(preview,lines.join(' -> '));
    assert.equal(preview.verified,true);
  }
});
