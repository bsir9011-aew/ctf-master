import test from 'node:test';
import assert from 'node:assert/strict';
import {executeLinux,initialLinux} from '../src/core/linux.ts';
import {missions} from '../src/core/missions.ts';
import {responseCase,seedResponseCase,responseProgress} from '../src/core/responseCase.ts';
import {modeOf} from '../src/core/permissions.ts';
const c=responseCase;
const run=(commands,seed=seedResponseCase(initialLinux()))=>{
  let state=seed;
  const events=[];
  for(const raw of commands){
    const r=executeLinux(state,raw);
    state=r.state;
    events.push(r);
  }
  return {state,events};
};
const baseline=['curl -i '+c.endpoint,'cat '+c.live,'cat '+c.backup];
const rollback=['cp '+c.backup+' '+c.live];
const apply=['systemctl restart api'];
const verify=['curl -i '+c.endpoint];
const solve=()=>run([...baseline,...rollback,...apply,...verify]);

test('append remediation as mission 19 without moving original missions',()=>{
  assert.equal(missions.length,21);
  assert.equal(missions[16].id,'incident-correlation');
  assert.equal(missions[17].id,'incident-hypotheses');
  assert.equal(missions[18].id,'incident-response');
  assert.equal(missions[18].success(initialLinux(),[]),false);
});

test('seeding leaves existing files and sessions unchanged, and does not reset progress',()=>{
  const old=initialLinux(),snapshot=structuredClone(old);
  const seeded=seedResponseCase(old);
  assert.deepEqual(old,snapshot);
  assert.equal(seeded.files[c.live],c.oldConfig);
  assert.equal(seeded.files[c.backup],c.safeConfig);
  assert.equal(seeded.response.appliedPoolLimit,1);
  assert.equal(seedResponseCase(seeded),seeded);
  const existing={...old,files:{...old.files,[c.live]:'POOL_LIMIT=4\n',[c.backup]:'CUSTOM_BACKUP'}};
  const preserved=seedResponseCase(existing);
  assert.equal(preserved.files[c.live],'POOL_LIMIT=4\n');
  assert.equal(preserved.files[c.backup],'CUSTOM_BACKUP');
});

test('curl models HTTP 503 with shell exit status zero without real network requests',()=>{
  const r=executeLinux(seedResponseCase(initialLinux()),'curl -i '+c.endpoint);
  assert.equal(r.ok,true);
  assert.equal(r.exitCode,0);
  assert.match(r.output,/HTTP\/1\.1 503/);
  assert.equal(r.target,'api-health');
  assert.equal(executeLinux(r.state,'echo $?').output,'0');
  const disallowed=executeLinux(r.state,'curl -i https://example.org');
  assert.equal(disallowed.ok,false);
  assert.equal(disallowed.exitCode,2);
  assert.equal(executeLinux(r.state,'man curl').ok,true);
});

test('saving a stable config does not apply it before restarting the process',()=>{
  const {state,events}=run([...baseline,...rollback,'curl -i '+c.endpoint]);
  assert.equal(state.files[c.live],c.safeConfig);
  assert.equal(state.response.appliedPoolLimit,1);
  assert.match(events.at(-1).output,/503 Service Unavailable/);
  const p=responseProgress(state,events);
  assert.deepEqual([p.baseline,p.diagnosed,p.rollback,p.verified],[true,true,true,false]);
});

test('a blind API restart leaves the wrong pool limit and does not fix root cause',()=>{
  const q=run(['curl -i '+c.endpoint,'systemctl restart api','curl -i '+c.endpoint]);
  assert.equal(q.state.response.appliedPoolLimit,1);
  assert.match(q.events.at(-1).output,/DB_POOL_EXHAUSTED/);
  assert.equal(responseProgress(q.state,q.events).completed,false);
});

test('observations, rollback, process reload and later health response are separate stages',()=>{
  const variants=[
    [],
    [baseline[0]],
    baseline,
    [...baseline,...rollback],
    [...baseline,...rollback,...apply],
    [...baseline,...rollback,...apply,...verify]
  ];
  const expected=[
    [false,false,false,false],
    [true,false,false,false],
    [true,true,false,false],
    [true,true,true,false],
    [true,true,true,false],
    [true,true,true,true]
  ];
  variants.forEach((commands,i)=>{
    const q=run(commands);
    const p=responseProgress(q.state,q.events);
    assert.deepEqual([p.baseline,p.diagnosed,p.rollback,p.verified],expected[i],String(i));
    assert.equal(missions[18].success(q.state,q.events),i===5);
  });
});

test('successful minimal remediation keeps the baseline config and other services intact',()=>{
  const initial=seedResponseCase(initialLinux()),{state,events}=solve();
  assert.ok(events.every(x=>x.ok));
  assert.equal(events.length,6);
  assert.equal(state.files[c.live],c.safeConfig);
  assert.equal(state.files[c.backup],c.safeConfig);
  assert.equal(modeOf(state,c.live),0o644);
  assert.equal(modeOf(state,c.backup),0o644);
  assert.equal(state.response.appliedPoolLimit,8);
  assert.equal(state.services.api.status,'active');
  assert.equal(state.services.sshd.status,'active');
  assert.equal(state.services.queue.status,'active');
  assert.match(events.at(-1).output,/HTTP\/1\.1 200 OK/);
  assert.equal(responseProgress(state,events).completed,true);
  assert.equal(initial.files[c.live],c.oldConfig);
});

test('disrupting unrelated ssh or queue prevents healthy verification',()=>{
  for(const service of ['sshd','queue']){
    const q=run([...baseline,...rollback,...apply,'systemctl stop '+service,...verify]);
    assert.match(q.events.at(-1).output,/HTTP\/1\.1 503/);
    assert.equal(responseProgress(q.state,q.events).completed,false);
  }
});

test('tampering with the safe backup, overpermissive rights or resetting config fails',()=>{
  const q=solve();
  const damaged={...q.state,files:{...q.state.files,[c.backup]:'POOL_LIMIT=999\n'}};
  assert.equal(responseProgress(damaged,q.events).completed,false);
  const rights={...q.state,permissions:{...q.state.permissions,[c.live]:0o777}};
  assert.equal(responseProgress(rights,q.events).completed,false);
  const reverted={...q.state,files:{...q.state.files,[c.live]:c.oldConfig}};
  assert.equal(responseProgress(reverted,q.events).completed,false);
});

test('copying before inspecting both sources is not an evidenced remediation',()=>{
  const q=run(['curl -i '+c.endpoint,...rollback,'cat '+c.live,'cat '+c.backup,...apply,...verify]);
  assert.equal(responseProgress(q.state,q.events).completed,false);
  const shortcuts=run([...baseline,'systemctl restart api','curl -i '+c.endpoint]);
  assert.equal(responseProgress(shortcuts.state,shortcuts.events).rollback,false);
});

test('legacy sessions without response or lastExitCode can enter the case',()=>{
  const legacy=initialLinux();
  delete legacy.lastExitCode;
  const q=run([...baseline,...rollback,...apply,...verify],seedResponseCase(legacy));
  assert.equal(responseProgress(q.state,q.events).completed,true);
  assert.equal(legacy.response,undefined);
  assert.equal(legacy.lastExitCode,undefined);
});
