import test from 'node:test';
import assert from 'node:assert/strict';
import {createAcademyState} from '../src/core/commandAcademy.ts';
import {executeLinux} from '../src/core/linux.ts';
import {
  runServiceWorkshop,observedServiceDiagnosis,serviceWorldForTicket,
  gradeServiceDiagnosis
} from '../src/core/serviceWorkshop.ts';
import {gradeServiceResponse,verifyServiceResponse} from '../src/core/serviceResponse.ts';

const base=(id)=>[
  'ps aux','systemctl status '+id,'journalctl -u '+id
];
const extra={scheduler:'systemctl status redis.service',gateway:'ss -ltnp'};
const allOrders=a=>a.length===1?[a]:a.flatMap((v,i)=>
  allOrders(a.filter((_,k)=>k!==i)).map(rest=>[v,...rest]));

test('scheduler requires actual read-only redis.service status as a fourth independent observation',()=>{
  const world=serviceWorldForTicket('scheduler');
  const redis=executeLinux(world,'systemctl status redis.service');
  assert.equal(redis.ok,true);
  assert.equal(redis.target,'redis.service');
  assert.match(redis.output,/ Active: failed/);
  assert.match(redis.output,/ Main PID: -/);
  assert.equal(world.services.redis.status,'failed');
  assert.equal(world.processes.find(x=>x.service==='redis').running,false);
  assert.equal(runServiceWorkshop(base('scheduler').join('\n'),'scheduler').completed,false);
  for(const order of allOrders([...base('scheduler'),extra.scheduler])){
    const incident=runServiceWorkshop(order.join('\n'),'scheduler');
    assert.equal(incident.completed,true,order.join(' → ')+': '+incident.feedback);
    assert.equal(incident.steps.length,4);
    assert.equal(incident.steps.find(x=>x.target==='redis.service').output,redis.output);
    assert.equal(observedServiceDiagnosis(incident,'scheduler'),'dependency');
    assert.equal(gradeServiceDiagnosis(incident,'scheduler','dependency').matched,true);
    assert.equal(gradeServiceResponse(incident,'scheduler','dependency','check-dependency').matched,true);
    const preview=verifyServiceResponse(incident,'scheduler','dependency','check-dependency');
    assert.ok(preview);
    assert.equal(preview.verified,true);
    assert.equal(preview.state.services.redis.status,'failed');
    assert.equal(preview.command,null);
    assert.deepEqual(preview.state,incident.state);
  }
});

test('gateway requires ss -ltnp proving port 8080 is occupied by another running PID',()=>{
  const world=serviceWorldForTicket('gateway');
  const ss=executeLinux(world,'ss -ltnp');
  assert.equal(ss.ok,true);
  assert.equal(ss.command,'ss');
  assert.equal(ss.target,'tcp-listeners');
  assert.match(ss.output,/LISTEN.*0\.0\.0\.0:8080/);
  assert.match(ss.output,/legacy-proxy",pid=615,fd=3/);
  assert.equal(world.processes.find(p=>p.pid===615).listeningPort,8080);
  assert.equal(world.services['legacy-proxy'].status,'active');
  assert.equal(world.services.gateway.status,'failed');
  assert.equal(runServiceWorkshop(base('gateway').join('\n'),'gateway').completed,false);
  for(const order of allOrders([...base('gateway'),extra.gateway])){
    const incident=runServiceWorkshop(order.join('\n'),'gateway');
    assert.equal(incident.completed,true,order.join(' → ')+': '+incident.feedback);
    assert.equal(incident.steps.find(x=>x.command==='ss').output,ss.output);
    assert.equal(observedServiceDiagnosis(incident,'gateway'),'port');
    assert.equal(gradeServiceDiagnosis(incident,'gateway','port').matched,true);
    assert.equal(gradeServiceResponse(incident,'gateway','port','inspect-port').matched,true);
    const preview=verifyServiceResponse(incident,'gateway','port','inspect-port');
    assert.ok(preview);
    assert.equal(preview.verified,true);
    assert.equal(preview.command,null);
    assert.deepEqual(preview.state,incident.state);
  }
});

test('ss -ltnp is computed from virtual process status, not a hardcoded line',()=>{
  const state=serviceWorldForTicket('gateway');
  const active=executeLinux(state,'ss -ltnp');
  const stopped={
    ...state,
    processes:state.processes.map(p=>p.pid===615?{...p,running:false}:p)
  };
  const changed=executeLinux(stopped,'ss -ltnp');
  assert.equal(active.output.includes('pid=615'),true);
  assert.equal(changed.output.includes('pid=615'),false);
  assert.notEqual(active.output,changed.output);
  const oldSs=executeLinux(createAcademyState(),'ss -lnt');
  assert.equal(oldSs.ok,true,'legacy network exercise must remain operational');
  assert.equal(executeLinux(createAcademyState(),'ss -ltnp').ok,true);
  assert.equal(createAcademyState().processes.some(p=>p.listeningPort===8080),false);
});

test('forged port owners, unavailable dependencies, missing and duplicate checks fail closed',()=>{
  const examples=[
    ['scheduler','systemctl status redis.service','dependency'],
    ['gateway','ss -ltnp','port']
  ];
  for(const [id,diagnostic,cause] of examples){
    const complete=[...base(id),diagnostic].join('\n');
    const good=runServiceWorkshop(complete,id);
    assert.equal(good.completed,true);
    const partial=runServiceWorkshop(base(id).join('\n'),id);
    assert.equal(partial.completed,false);
    assert.equal(partial.steps.length,0);
    const injected=good.steps.map(step=>
      step.command===(id==='gateway'?'ss':'systemctl') &&
      step.output.includes(id==='gateway'?'pid=615':'redis.service')?
        {...step,output:'ForGERY - service looks active'}:step);
    assert.equal(observedServiceDiagnosis({...good,steps:injected},id),null);
    const altered={...good,state:{
      ...good.state,
      processes:good.state.processes.map(p=>
        id==='gateway'&&p.pid===615?{...p,running:false}:p)
    }};
    assert.equal(observedServiceDiagnosis(altered,id),null);
    assert.equal(verifyServiceResponse(altered,id,cause,id==='gateway'?'inspect-port':'check-dependency'),null);
    for(const invalid of [
      [...base(id),diagnostic].slice(0,3),
      ['ps',diagnostic,diagnostic,'journalctl -u '+id],
      ['ps','systemctl status '+id,diagnostic,'systemctl restart '+id],
      ['ps','systemctl status '+id,'journalctl -u '+id,
        id==='gateway'?'ss -lnt':'systemctl status sshd']
    ]){
      const result=runServiceWorkshop(invalid.join('\n'),id);
      assert.equal(result.completed,false,invalid.join('|'));
      assert.equal(result.steps.length,0);
    }
  }
});

test('three-command cases remain unchanged; foreign checks cannot be smuggled into their script',()=>{
  for(const id of ['web','api','queue','reporter']){
    const result=runServiceWorkshop(base(id).join('\n'),id);
    assert.equal(result.completed,true,id);
    for(const injected of ['ss -ltnp','systemctl status redis']){
      const attempt=runServiceWorkshop([...base(id),injected].join('\n'),id);
      assert.equal(attempt.completed,false);
      assert.equal(attempt.steps.length,0);
    }
  }
});
