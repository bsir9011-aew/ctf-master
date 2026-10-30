import test from 'node:test';
import assert from 'node:assert/strict';
import {executeLinux,initialLinux} from '../src/core/linux.ts';
import {opsCase,seedOpsCase,opsProgress} from '../src/core/opsRecovery.ts';
import {missions} from '../src/core/missions.ts';

const probe='curl -i '+opsCase.endpoint;
const diagnose=[probe,'systemctl status queue','journalctl -u queue'];
const repair=['systemctl start queue',probe,'systemctl status queue','systemctl status sshd'];
function run(commands,initial=seedOpsCase(initialLinux())){
  let state=initial;
  const events=[];
  for(const command of commands){
    const e=executeLinux(state,command);
    state=e.state;events.push(e);
  }
  return {state,events,progress:opsProgress(state,events)};
}

test('the new mission is appended with unchanged earlier ordering and six chapters',()=>{
  assert.equal(missions.length,20);
  assert.equal(missions[16].id,'incident-correlation');
  assert.equal(missions[17].id,'incident-hypotheses');
  assert.equal(missions[18].id,'incident-response');
  assert.equal(missions[19].id,'operational-recovery');
  assert.equal(missions[19].success(initialLinux(),[]),false);
});

test('scenario seeds only when selected; idempotent and does not alter files or original',()=>{
  const old=initialLinux(),snapshot=structuredClone(old);
  const fresh=seedOpsCase(old);
  assert.deepEqual(old,snapshot);
  assert.deepEqual(fresh.files,old.files);
  assert.equal(fresh.services.queue.status,'inactive');
  assert.equal(fresh.services.sshd.status,'active');
  assert.equal(fresh.services.api.status,'active');
  assert.equal(fresh.processes.find(x=>x.service==='queue').running,false);
  assert.equal(seedOpsCase(fresh),fresh);
  assert.equal(old.ops,undefined);
  const custom={...old,files:{...old.files,'/home/player/documents/notes-mine.txt':'KEEP'}};
  assert.equal(seedOpsCase(custom).files['/home/player/documents/notes-mine.txt'],'KEEP');
});

test('HTTP failure and shell exit code are different, endpoint remains fictional',()=>{
  const initial=seedOpsCase(initialLinux());
  const bad=executeLinux(initial,probe);
  assert.equal(bad.ok,true);
  assert.equal(bad.exitCode,0);
  assert.match(bad.output,/HTTP\/1.1 503/);
  assert.match(bad.output,/QUEUE_STOPPED/);
  assert.equal(executeLinux(bad.state,'echo $?').output,'0');
  const disallowed=executeLinux(initial,'curl -i http://unknown.ctf.test/health');
  assert.equal(disallowed.ok,false);
  assert.equal(disallowed.exitCode,2);
  assert.equal(executeLinux(initial,'curl -i '+opsCase.endpoint).state.ops.scenario,'queue-outage');
  assert.equal(executeLinux(initialLinux(),probe).ok,false);
});

test('four checkpoints track diagnosis, repair and post-fix health independently',()=>{
  const cases=[
    [[],[false,false,false,false]],
    [[probe],[true,false,false,false]],
    [diagnose,[true,true,false,false]],
    [[...diagnose,'systemctl start queue'],[true,true,true,false]],
    [[...diagnose,...repair],[true,true,true,true]]
  ];
  for(const [commands,expected] of cases){
    const r=run(commands),p=r.progress;
    assert.deepEqual([p.baseline,p.diagnosed,p.restored,p.verified],expected);
    assert.equal(missions[19].success(r.state,r.events),p.verified);
  }
});

test('clean path restores only the halted queue, with zero extra impact',()=>{
  const r=run([...diagnose,...repair]);
  assert.equal(r.progress.completed,true);
  assert.equal(r.progress.sideEffects,0);
  assert.equal(r.progress.availability,'healthy');
  assert.equal(r.state.services.sshd.status,'active');
  assert.equal(r.state.services.api.status,'active');
  assert.equal(r.state.services.queue.status,'active');
  assert.equal(r.state.processes.find(x=>x.service==='queue').running,true);
  assert.match(r.events.at(-3).output,/HTTP\/1\.1 200/);
});

test('read-only status queries never count as harmful intervention',()=>{
  const r=run([...diagnose,'systemctl status sshd','systemctl status api',
    ...repair]);
  assert.equal(r.progress.sideEffects,0);
  assert.equal(r.progress.completed,true);
});

test('blind API restart adds a lasting side effect, but subsequent correct repair passes',()=>{
  const r=run([probe,'systemctl restart api',
    'systemctl status queue','journalctl -u queue',...repair]);
  assert.equal(r.progress.completed,true);
  assert.equal(r.progress.sideEffects,1);
  assert.match(r.progress.sideEffectNotes[0],/Restart API/);
});

test('an SSH shutdown changes observable failure reason and can be reversed',()=>{
  const result=run([...diagnose,'systemctl stop sshd',
    'systemctl start queue',probe,'systemctl start sshd',
    ...repair.slice(1)]);
  assert.equal(result.progress.completed,true);
  assert.equal(result.progress.sideEffects,1);
  assert.equal(result.progress.availability,'healthy');
  const degraded=result.events.find(e=>e.command==='curl'&&e.output.includes('SSH_ACCESS_LOST'));
  assert.ok(degraded);
  assert.equal(result.state.services.sshd.status,'active');
  assert.equal(result.progress.sideEffectNotes.length,1);
});

test('an unrepaired SSH interruption prevents success even when queue is restored',()=>{
  const r=run([...diagnose,'systemctl stop sshd',
    'systemctl start queue',probe,
    'systemctl status queue','systemctl status sshd']);
  assert.equal(r.progress.restored,true);
  assert.equal(r.progress.completed,false);
  assert.equal(r.progress.availability,'degraded');
  assert.equal(r.progress.sideEffects,1);
});

test('killing the queue worker is distinct from merely diagnosing it',()=>{
  const r=run([...diagnose,'systemctl start queue','kill 350',
    'systemctl start queue',...repair.slice(1)]);
  assert.equal(r.progress.completed,true);
  assert.ok(r.progress.sideEffects>=1);
  assert.ok(r.progress.sideEffectNotes.some(s=>s.includes('queue')));
});

test('unverified or premature fixes never count as a documented recovery',()=>{
  const fast=run(['systemctl start queue',probe,'systemctl status queue','systemctl status sshd']);
  assert.equal(fast.progress.completed,false);
  const noJournal=run([probe,'systemctl status queue',...repair]);
  assert.equal(noJournal.progress.completed,false);
  const noSSHCheck=run([...diagnose,'systemctl start queue',probe,'systemctl status queue']);
  assert.equal(noSSHCheck.progress.completed,false);
});

test('older saves and completed missions remain untouched after new scenario initialization',()=>{
  const legacy=initialLinux();delete legacy.lastExitCode;
  const state=seedOpsCase(legacy);
  const r=run([...diagnose,...repair],state);
  assert.equal(r.progress.completed,true);
  assert.equal(legacy.ops,undefined);
  assert.equal(legacy.lastExitCode,undefined);
  assert.deepEqual(state.files,legacy.files);
  assert.equal(opsProgress(r.state,[]).completed,false);
});
