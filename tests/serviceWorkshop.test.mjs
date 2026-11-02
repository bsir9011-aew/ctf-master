import test from 'node:test';
import assert from 'node:assert/strict';
import {runWorkshop,WORKSHOP_MAX_LINES} from '../src/core/bashWorkshop.ts';
import {
  runServiceWorkshop,serviceTicketIds,serviceTicket,
  observedServiceDiagnosis,gradeServiceDiagnosis
} from '../src/core/serviceWorkshop.ts';
import {createAcademyState} from '../src/core/commandAcademy.ts';
import {workshopScenarios,workshopDraftKey,workshopInitialScript} from '../src/core/workshopScenarios.ts';

const tickets=[
  ['web','crash'],
  ['api','startup'],
  ['queue','healthy']
];
const permutations=(items)=>items.length===1?[items]:
  items.flatMap((value,i)=>permutations(items.filter((_,j)=>j!==i))
    .map(rest=>[value,...rest]));
const commands=(service)=>[
  'ps',
  'systemctl status '+service+'.service',
  'journalctl -u '+service
];

test('three process/service tickets support six independent inspection orders each',()=>{
  assert.equal(serviceTicketIds.length,6);
  assert.deepEqual(serviceTicketIds.slice(0,3),['web','api','queue']);
  assert.equal(WORKSHOP_MAX_LINES,4);
  for(const [id,cause] of tickets){
    const ticket=serviceTicket(id);
    assert.ok(ticket.title&&ticket.symptom);
    for(const cmd of permutations(commands(ticket.service))){
      const result=runServiceWorkshop(cmd.join('\n'),id);
      assert.equal(result.completed,true,id+' '+cmd.join(' -> ')+': '+result.feedback);
      assert.equal(result.steps.length,3);
      assert.deepEqual(new Set(result.steps.map(s=>s.command)),new Set(['ps','systemctl','journalctl']));
      assert.equal(observedServiceDiagnosis(result,id),cause);
      assert.deepEqual(gradeServiceDiagnosis(result,id,cause).matched,true);
      assert.equal(result.steps.filter(s=>s.command==='systemctl')[0].target,ticket.service+'.service');
      assert.equal(result.steps.filter(s=>s.command==='journalctl')[0].target,ticket.service+'.service');
      assert.equal(result.state.services[ticket.service].status,id==='queue'?'active':'failed');
      assert.equal(result.state.processes.find(p=>p.service===ticket.service).running,id==='queue');
      assert.deepEqual(result.state,createAcademyState(),'no incident may change the virtual world');
    }
  }
});

test('two accepted forms for ps and unit name without .service',()=>{
  for(const [id,cause] of tickets){
    const script=['systemctl status '+id,'ps aux','journalctl -u '+id+'.service'].join('\n');
    const result=runServiceWorkshop(script,id);
    assert.equal(result.completed,true,result.feedback);
    assert.equal(observedServiceDiagnosis(result,id),cause);
    assert.equal(gradeServiceDiagnosis(result,id,cause).matched,true);
  }
});

test('healthy service is a false alert; wrong conclusions do not pass',()=>{
  for(const [id,cause] of tickets){
    const result=runServiceWorkshop(commands(id).join('\n'),id);
    assert.equal(gradeServiceDiagnosis(result,id,'').matched,null);
    for(const other of ['crash','startup','healthy'].filter(x=>x!==cause)){
      const evaluated=gradeServiceDiagnosis(result,id,other);
      assert.equal(evaluated.matched,false,id+' '+other);
      assert.doesNotMatch(evaluated.message,/Trafnie/);
    }
    const success=gradeServiceDiagnosis(result,id,cause);
    assert.equal(success.matched,true);
    assert.match(success.message,/Trafnie/);
  }
});

test('wrong unit names, repeated commands and partial traces never count as a diagnosis',()=>{
  for(const [id] of tickets){
    const other=tickets.map(([name])=>name).find(name=>name!==id);
    const inputs=[
      ['ps','systemctl status '+other,'journalctl -u '+id],
      ['ps','systemctl status '+id,'journalctl -u '+other],
      ['ps','ps aux','journalctl -u '+id],
      ['ps','systemctl status '+id,'systemctl status '+id],
      ['ps','systemctl status '+id],
      ['ps','systemctl status '+id,'journalctl -u '+id,'ps'],
      ['ps','systemctl status '+id,'echo $?']
    ];
    for(const lines of inputs){
      const r=runServiceWorkshop(lines.join('\n'),id);
      assert.equal(r.completed,false,id+' '+lines.join(','));
      assert.equal(observedServiceDiagnosis(r,id),null);
      assert.equal(gradeServiceDiagnosis(r,id,'crash').matched,null);
      assert.equal(r.steps.length,0,'must preflight entire script first');
    }
  }
});

test('read-only allowlist rejects host actions, starts, restarts, kills and pipelines upfront',()=>{
  const original=createAcademyState();
  const unsafe=[
    'systemctl restart web',
    'systemctl start web',
    'systemctl stop web',
    'kill 424',
    'sudo systemctl restart web',
    'curl https://example.test',
    'ps | grep web',
    'journalctl -u web > out.txt',
    'ps; kill 424',
    'ps && journalctl -u web',
    'ps -ef',
    'journalctl -u sshd',
    'cat /etc/shadow'
  ];
  for(const cmd of unsafe){
    const script=['ps','systemctl status web',cmd].join('\n');
    const r=runServiceWorkshop(script,'web');
    assert.equal(r.completed,false,script);
    assert.equal(r.steps.length,0,'preflight must run before any command');
    assert.deepEqual(r.state,original);
  }
});
test('incomplete or spoofed evidence never supports a cause',()=>{
  const r=runServiceWorkshop(commands('web').join('\n'),'web');
  for(const steps of [
    r.steps.slice(0,2),
    r.steps.map(s=>s.command==='journalctl'?{...s,output:'08:00 web: ready'}:s),
    r.steps.map(s=>s.command==='systemctl'?{...s,output:'web.service\n Active: active\n Main PID: 331\n'}:s),
    r.steps.map(s=>s.command==='ps'?{...s,output:s.output+'\n331 webd'}:s)
  ]){
    assert.equal(observedServiceDiagnosis({...r,steps},'web'),null);
    assert.equal(gradeServiceDiagnosis({...r,steps},'web','crash').matched,null);
  }
  assert.equal(observedServiceDiagnosis(r,'api'),null,'other service cannot borrow evidence');
});
test('service exercise preserves earlier scenarios, drafts and menu',()=>{
  assert.equal(workshopScenarios.length,8);
  assert.equal(workshopScenarios.at(-1).id,'service');
  assert.equal(workshopInitialScript('service'),'');
  assert.equal(workshopDraftKey('service'),'ctf-master:bash-workshop-service-draft-v1');
  const legacy=['BASE=~/practice','test -r "$BASE/diagnostics/service.log"',
    'echo $?','namei -l "$BASE/diagnostics/service.log"'].join('\n');
  assert.equal(runWorkshop(legacy,'pathblock','intro').completed,true);
  const svc=runWorkshop(commands('api').join('\n'),'service','intro',null,'service','api');
  assert.equal(svc.completed,true);
  assert.equal(observedServiceDiagnosis(svc,'api'),'startup');
});
