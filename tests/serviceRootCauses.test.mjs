import test from 'node:test';
import assert from 'node:assert/strict';
import {runWorkshop} from '../src/core/bashWorkshop.ts';
import {serviceTicket,serviceTicketIds,serviceWorldForTicket,
  observedServiceDiagnosis,gradeServiceDiagnosis,runServiceWorkshop} from '../src/core/serviceWorkshop.ts';
import {gradeServiceResponse,verifyServiceResponse} from '../src/core/serviceResponse.ts';
import {createAcademyState} from '../src/core/commandAcademy.ts';
import {executeLinux} from '../src/core/linux.ts';

const newIncidents=[
  ['reporter','config','inspect-config','config validation failed: unknown directive'],
  ['scheduler','dependency','check-dependency','dependency redis.service unavailable'],
  ['gateway','port','inspect-port','Address already in use']
];
const allCases=[
  ['web','crash','restart-target'],
  ['api','startup','investigate-startup'],
  ['queue','healthy','verify-alert'],
  ...newIncidents.map(([id,cause,action])=>[id,cause,action])
];
const steps=(id)=>[
  'ps aux','systemctl status '+id+'.service','journalctl -u '+id
];
const perms=(a)=>a.length===1?[a]:
  a.flatMap((x,i)=>perms(a.filter((_,j)=>i!==j)).map(ys=>[x,...ys]));

test('RC65 has six compact ticket variants, legacy fixtures unchanged',()=>{
  assert.deepEqual(new Set(serviceTicketIds),new Set(allCases.map(c=>c[0])));
  assert.deepEqual(serviceWorldForTicket('web'),createAcademyState());
  assert.deepEqual(serviceWorldForTicket('api'),createAcademyState());
  assert.deepEqual(serviceWorldForTicket('queue'),createAcademyState());
  for(const [id] of newIncidents){
    const world=serviceWorldForTicket(id);
    assert.equal(world.services[id].status,'failed');
    assert.equal(world.processes.find(p=>p.service===id).running,false);
    assert.equal(world.services[id].pid,world.processes.find(p=>p.service===id).pid);
    assert.equal(world.processes.length,createAcademyState().processes.length+1);
    assert.equal(Object.keys(world.services).length,Object.keys(createAcademyState().services).length+1);
    assert.equal(serviceTicket(id).service,id);
  }
});

test('all six cases support all six safe read-only command permutations',()=>{
  for(const [id,cause,action] of allCases){
    for(const order of perms(steps(id))){
      const script=order.join('\n');
      const incident=runServiceWorkshop(script,id);
      assert.equal(incident.completed,true,id+' '+order.join(' → ')+': '+incident.feedback);
      assert.equal(incident.steps.length,3);
      assert.deepEqual(incident.state,serviceWorldForTicket(id));
      assert.equal(observedServiceDiagnosis(incident,id),cause);
      assert.equal(gradeServiceDiagnosis(incident,id,cause).matched,true);
      assert.equal(gradeServiceResponse(incident,id,cause,action).matched,true);
      const original=structuredClone(incident.state);
      const preview=verifyServiceResponse(incident,id,cause,action);
      assert.ok(preview,id+' '+cause+': '+action);
      assert.equal(preview.verified,true,id+': '+preview.message);
      assert.deepEqual(preview.checks.map(x=>x.passed),[true,true,true]);
      assert.deepEqual(incident.state,original,'preview must never mutate source');
      if(['config','dependency','port','startup','healthy'].includes(cause)){
        assert.equal(preview.command,null,'restart must not fake a fix');
        assert.deepEqual(preview.state,incident.state);
      }
      for(const wrong of ['crash','startup','healthy','config','dependency','port'].filter(x=>x!==cause)){
        assert.equal(gradeServiceDiagnosis(incident,id,wrong).matched,false);
        assert.equal(verifyServiceResponse(incident,id,wrong,action),null);
      }
    }
  }
});

test('new journal messages identify distinct technical root causes, not merely status failed',()=>{
  for(const [id,cause,action,needle] of newIncidents){
    const incident=runServiceWorkshop(steps(id).join('\n'),id);
    const status=incident.steps.find(x=>x.command==='systemctl');
    const journal=incident.steps.find(x=>x.command==='journalctl');
    const ps=incident.steps.find(x=>x.command==='ps');
    assert.match(status.output,/ Active: failed/);
    assert.match(status.output,/ Main PID: -/);
    assert.ok(journal.output.includes(needle),journal.output);
    assert.equal(ps.output.includes(id==='scheduler'?'scheduler-worker':
      id==='gateway'?'gatewayd':'reporterd'),false);
    const preview=verifyServiceResponse(incident,id,cause,action);
    assert.ok(preview);
    assert.equal(preview.beforeStatus,'failed');
    assert.equal(preview.afterStatus,'failed');
    assert.equal(preview.beforePid,'nieaktywny');
    assert.equal(preview.afterPid,'nieaktywny');
    assert.equal(preview.state.services[id].journal.join('\n'),journal.output);
    assert.notEqual(preview.message,'');
    for(const wrongAction of ['restart-target','kill-worker','verify-alert',
      'investigate-startup','inspect-config','check-dependency','inspect-port']
      .filter(x=>x!==action)){
      assert.equal(gradeServiceResponse(incident,id,cause,wrongAction).matched,false);
      assert.equal(verifyServiceResponse(incident,id,cause,wrongAction),null);
    }
  }
});

test('mismatched, forged, or incomplete evidence never unlocks response preview',()=>{
  for(const [id,cause,action] of newIncidents){
    const r=runServiceWorkshop(steps(id).join('\n'),id);
    for(const alternate of [
      {...r,completed:false},
      {...r,steps:r.steps.slice(1)},
      {...r,steps:r.steps.map(s=>s.command==='journalctl'?
        {...s,output:'09:12 '+id+': ready'}:s)},
      {...r,steps:r.steps.map(s=>s.command==='systemctl'?
        {...s,output:id+'.service\n Active: active\n Main PID: 530'}:s)},
      {...r,state:{...r.state,
        services:{...r.state.services,[id]:{
          ...r.state.services[id],status:'active'}}}},
      {...r,state:{...r.state,
        files:{...r.state.files,'/home/player/manual.log':'modified'}}}
    ]){
      assert.equal(verifyServiceResponse(alternate,id,cause,action),null);
    }
    for(const other of serviceTicketIds.filter(x=>x!==id)){
      assert.equal(verifyServiceResponse(r,other,cause,action),null);
    }
  }
});

test('unsafe host/process actions cannot enter three-line diagnostics',()=>{
  for(const [id] of newIncidents){
    for(const unsafe of [
      'systemctl restart '+id,
      'systemctl start '+id,
      'kill 1','sudo journalctl -u '+id,
      'journalctl -u '+id+' | tail',
      'ss -ltnp','curl https://example.org',
      'journalctl -u '+id+' > output',
      'ps; rm /tmp/anything'
    ]){
      const result=runServiceWorkshop(['ps','systemctl status '+id,unsafe].join('\n'),id);
      assert.equal(result.completed,false,unsafe);
      assert.equal(result.steps.length,0,unsafe);
      assert.deepEqual(result.state,serviceWorldForTicket(id));
    }
  }
});

test('integration via main Bash Workshop router preserves service ticket selection',()=>{
  for(const [id,cause,action] of newIncidents){
    const incident=runWorkshop(steps(id).join('\n'),'service','intro',null,'service',id);
    assert.equal(incident.completed,true);
    assert.equal(observedServiceDiagnosis(incident,id),cause);
    assert.equal(verifyServiceResponse(incident,id,cause,action).verified,true);
  }
  assert.deepEqual(createAcademyState(),serviceWorldForTicket('web'));
});
