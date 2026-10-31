import test from 'node:test';
import assert from 'node:assert/strict';
import {initialLinux,executeLinux} from '../src/core/linux.ts';
import {buildAfterAction,restoreAfterActionReports,restoreMissionReflections} from '../src/core/afterAction.ts';
import {seedBlindCase,blindCase,blindProgress} from '../src/core/blindInvestigation.ts';
import {seedOpsCase,opsCase,opsProgress} from '../src/core/opsRecovery.ts';
import {hypothesisCase,seedHypothesisCase,hypothesisProgress} from '../src/core/hypothesisCase.ts';

const stats=(values={})=>({
  commands:8,errors:0,hints:0,usedHelp:false,independent:true,...values
});
function play(initial,commands){
  let state=initial;
  const events=[];
  for(const command of commands){
    const e=executeLinux(state,command);
    state=e.state;events.push(e);
  }
  return {state,events};
}
test('no report before verified completion; never store full filesystem or raw log output',()=>{
  const seed=seedBlindCase(initialLinux());
  const bad=play(seed,['cat '+blindCase.ticket,'cat '+blindCase.evidence]);
  assert.equal(buildAfterAction('blind-investigation',bad.events,stats(),false),null);
  const result=buildAfterAction('blind-investigation',bad.events,stats(),true);
  assert.ok(result);
  const json=JSON.stringify(result);
  assert.equal(json.includes('files'),false);
  assert.equal(json.includes('07:39 AUDIT'),false);
  assert.equal(json.includes('report_export=complete'),false);
  assert.equal(result.hypotheses.length,0);
});

test('blind case after-action reports only observed records and minimal repairs',()=>{
  const c=blindCase;
  const commands=[
    'cat '+c.ticket,'cat '+c.evidence,'namei -l '+c.evidence,
    'chmod u+x '+c.directory,'cat '+c.evidence,
    'cp '+c.evidence+' '+c.copy,'cat '+c.copy
  ];
  const {state,events}=play(seedBlindCase(initialLinux()),commands);
  assert.equal(blindProgress(state,events).completed,true);
  const r=buildAfterAction('blind-investigation',events,stats({commands:7,errors:1,independent:false}),true);
  assert.ok(r);
  assert.equal(r.commands,7);
  assert.equal(r.nonzero,1);
  assert.equal(r.independent,false);
  assert.ok(r.sources.some(s=>s.includes(c.evidence)&&s.includes('status 1')));
  assert.ok(r.actions.some(s=>s.includes('chmod '+c.directory)));
  assert.ok(r.actions.some(s=>s.includes('cp '+c.copy)));
  assert.equal(r.consequences.length,0);
  assert.match(r.transferQuestion,/katalog/);
});

test('competing explanations are reported only when entered by the learner',()=>{
  const c=hypothesisCase;
  const commands=[
    'grep HTTP_502 '+c.edge,'grep AUTH_FAILURE '+c.auth,
    'grep POOL_EXHAUSTED '+c.db,'grep POOL_LIMIT_REDUCED '+c.deploy,
    'grep DISK_OK '+c.host,
    'hypothesis auth-attack high',
    'hypothesis pool-exhaustion medium',
    'cp '+c.db+' '+c.dbEvidence,'cp '+c.deploy+' '+c.deployEvidence,
    'grep POOL_LIMIT_REDUCED '+c.deploy+' > '+c.report,
    'grep POOL_EXHAUSTED '+c.db+' >> '+c.report,'cat '+c.report
  ];
  const {state,events}=play(seedHypothesisCase(initialLinux()),commands);
  assert.equal(hypothesisProgress(state,events).completed,true);
  const r=buildAfterAction('incident-hypotheses',events,stats({commands:12}),true);
  assert.ok(r);
  assert.deepEqual(r.hypotheses,[
    'auth-attack / pewność: high',
    'pool-exhaustion / pewność: medium'
  ]);
  assert.ok(r.sources.some(s=>s.includes(c.db)));
  assert.equal(r.actions.some(s=>s.startsWith('cp ')),true);
});

test('recoverable harmful action remains in report after health is restored',()=>{
  const commands=[
    'curl -i '+opsCase.endpoint,
    'systemctl restart api',
    'systemctl status queue','journalctl -u queue',
    'systemctl start queue','curl -i '+opsCase.endpoint,
    'systemctl status queue','systemctl status sshd'
  ];
  const {state,events}=play(seedOpsCase(initialLinux()),commands);
  assert.equal(opsProgress(state,events).completed,true);
  const r=buildAfterAction('operational-recovery',events,stats({commands:8}),true);
  assert.ok(r);
  assert.equal(r.consequences.length,1);
  assert.match(r.consequences[0],/Restart API/);
  assert.ok(r.sources.some(x=>x.includes('ops-health')));
  assert.match(r.verification,/Symulator/);
});

test('saved report roundtrip is stable after switching missions; reflection is optional',()=>{
  const commands=['pwd','ls'];
  const e=play(initialLinux(),commands);
  const r=buildAfterAction('orientation',e.events,stats({commands:2}),true);
  assert.ok(r);
  const saved=JSON.stringify({'orientation':r});
  assert.deepEqual(restoreAfterActionReports(JSON.parse(saved)).orientation,r);
  assert.equal(restoreAfterActionReports({}).orientation,undefined);
  assert.deepEqual(restoreMissionReflections({'orientation':'Najpierw sprawdzę katalog.'}),
    {'orientation':'Najpierw sprawdzę katalog.'});
});

test('malformed legacy reports and oversized reflections are ignored or bounded',()=>{
  const bad={
    'weird/x':{missionId:'weird/x',verification:'untrusted',transferQuestion:'x'},
    valid:{missionId:'valid',verification:'a'.repeat(10000),
      transferQuestion:'b'.repeat(10000),commands:-9,nonzero:Infinity,
      hints:30,sources:['ok',42,'x'.repeat(500)],actions:[]}
  };
  const restored=restoreAfterActionReports(bad);
  assert.equal(restored['weird/x'],undefined);
  assert.equal(restored.valid.commands,0);
  assert.equal(restored.valid.nonzero,0);
  assert.equal(restored.valid.hints,3);
  assert.equal(restored.valid.verification.length,500);
  assert.equal(restored.valid.sources[1].length,240);
  assert.deepEqual(restoreAfterActionReports(null),{});
  assert.equal(restoreMissionReflections({valid:'z'.repeat(1000)}).valid.length,600);
  assert.equal(restoreMissionReflections({'bad/path':'x'})['bad/path'],undefined);
});

test('status 1 in a failed file predicate is counted as nonzero, not called a learner mistake',()=>{
  const initial=initialLinux();
  const {events}=play(initial,['test -e ~/does-not-exist','echo $?']);
  const r=buildAfterAction('orientation',events,stats({errors:0,commands:2}),true);
  assert.ok(r);
  assert.equal(r.nonzero,1);
  assert.equal(r.commands,2);
});
