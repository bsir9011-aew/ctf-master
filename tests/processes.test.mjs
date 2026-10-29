import test from 'node:test';
import assert from 'node:assert/strict';
import {executeLinux, initialLinux} from '../src/core/linux.ts';
import {missions} from '../src/core/missions.ts';
import {
  availableReviews,createReviewAttempt,runReviewCommand,reviewScenarios
} from '../src/core/review.ts';

function sequence(commands, initial=initialLinux()) {
  let state=initial;
  const events=[];
  for (const command of commands) {
    const r=executeLinux(state,command);
    state=r.state; events.push(r);
  }
  return {state,events};
}

test('ps lists active processes and excludes the failed web worker',()=>{
  const ps=executeLinux(initialLinux(),'ps');
  assert.equal(ps.ok,true);
  assert.match(ps.output,/1\s+init/);
  assert.match(ps.output,/424\s+cpu-burn/);
  assert.doesNotMatch(ps.output,/webd/);
  assert.equal(executeLinux(initialLinux(),'ps aux').output,ps.output);
  assert.equal(executeLinux(initialLinux(),'ps -ef').ok,false);
});

test('kill stops only the chosen simulated PID and preserves the original state',()=>{
  const original=initialLinux();
  const result=executeLinux(original,'kill 424');
  assert.equal(result.ok,true);
  assert.equal(result.target,'pid:424');
  assert.equal(result.state.processes.find(p=>p.pid===424).running,false);
  assert.equal(original.processes.find(p=>p.pid===424).running,true);
  assert.equal(result.state.processes.find(p=>p.pid===350).running,true);
  assert.doesNotMatch(executeLinux(result.state,'ps').output,/cpu-burn/);
});

test('essential, malformed and missing PIDs are handled safely',()=>{
  const state=initialLinux();
  for (const cmd of ['kill 1','kill -9 424','kill 0','kill 999','kill 424 350']) {
    const r=executeLinux(state,cmd);
    assert.equal(r.ok,false,cmd);
    assert.equal(r.state,state,cmd);
  }
  const stopped=executeLinux(state,'kill 424');
  assert.equal(executeLinux(stopped.state,'kill 424').ok,false);
});

test('status and journalctl describe the root cause without host execution',()=>{
  const state=initialLinux();
  const status=executeLinux(state,'systemctl status web');
  assert.equal(status.ok,true);
  assert.equal(status.target,'web.service');
  assert.match(status.output,/Active: failed/);
  const journal=executeLinux(state,'journalctl -u web.service');
  assert.match(journal.output,/transient worker crash/);
  assert.equal(journal.target,'web.service');
  assert.equal(journal.state,state);
});

test('restarting web service updates service and process state together',()=>{
  const first=initialLinux();
  const restarted=executeLinux(first,'systemctl restart web.service');
  assert.equal(restarted.ok,true);
  assert.equal(restarted.state.services.web.status,'active');
  assert.equal(restarted.state.processes.find(p=>p.pid===331).running,true);
  assert.match(executeLinux(restarted.state,'ps').output,/webd/);
  assert.match(executeLinux(restarted.state,'journalctl -u web').output,/started successfully/);
  assert.equal(first.services.web.status,'failed');
});

test('stopping and starting a service are repeatable, with no unrelated changes',()=>{
  const original=initialLinux();
  const stop=executeLinux(original,'systemctl stop queue');
  assert.equal(stop.state.services.queue.status,'inactive');
  assert.equal(stop.state.processes.find(p=>p.pid===350).running,false);
  assert.equal(stop.state.services.sshd.status,'active');
  const again=executeLinux(stop.state,'systemctl stop queue');
  assert.equal(again.ok,true);
  assert.equal(again.state,stop.state);
  const started=executeLinux(stop.state,'systemctl start queue');
  assert.equal(started.state.services.queue.status,'active');
  assert.equal(started.state.processes.find(p=>p.pid===350).running,true);
});

test('killing a service worker marks the service failed until restarted',()=>{
  const killed=executeLinux(initialLinux(),'kill 214');
  assert.equal(killed.state.services.sshd.status,'failed');
  assert.match(executeLinux(killed.state,'journalctl -u sshd').output,/terminated unexpectedly/);
  assert.equal(executeLinux(killed.state,'systemctl restart sshd').state.services.sshd.status,'active');
});

test('unknown units and unsupported systemctl options do not mutate state',()=>{
  const initial=initialLinux();
  for (const cmd of ['journalctl','journalctl -n 5','journalctl -u missing',
    'systemctl','systemctl enable web','systemctl restart missing',
    'systemctl restart web extra','sudo systemctl restart web']) {
    const r=executeLinux(initial,cmd);
    assert.equal(r.ok,false,cmd);
    assert.equal(r.state,initial,cmd);
  }
});

test('process mission requires identification and successful termination',()=>{
  const mission=missions.find(m=>m.id==='runaway-process');
  assert.ok(mission);
  const onlyKill=sequence(['kill 424']);
  assert.equal(mission.success(onlyKill.state,onlyKill.events),false);
  const done=sequence(['ps','kill 424']);
  assert.equal(mission.success(done.state,done.events),true);
  assert.equal(mission.success(initialLinux(),done.events),false);
});

test('service mission requires reading failure, inspecting status, and recovery',()=>{
  const mission=missions.find(m=>m.id==='web-service-recovery');
  assert.ok(mission);
  const quick=sequence(['systemctl restart web']);
  assert.equal(mission.success(quick.state,quick.events),false);
  const diagnosed=sequence(['systemctl status web','journalctl -u web','systemctl restart web']);
  assert.equal(mission.success(diagnosed.state,diagnosed.events),true);
  const brokenOthers=sequence(['systemctl status web','journalctl -u web','systemctl restart web','systemctl stop sshd']);
  assert.equal(mission.success(brokenOthers.state,brokenOthers.events),false);
});

test('review skills unlock only after their corresponding missions',()=>{
  assert.deepEqual(availableReviews(['orientation'],{},{}),[]);
  const unlocked=availableReviews(['runaway-process','web-service-recovery'],{},{});
  assert.deepEqual(unlocked.map(s=>s.id),['processes','services']);
  assert.equal(reviewScenarios.length,20);
});

test('two distinct process review cases require process discovery',()=>{
  const first=createReviewAttempt('processes',{});
  assert.equal(first.variantId,'proc-a');
  const partial=runReviewCommand(first,{},'kill 424');
  assert.equal(partial.attempt.completed,false);
  const seen=runReviewCommand(first,{},'ps');
  const solved=runReviewCommand(seen.attempt,seen.history,'kill 424');
  assert.equal(solved.attempt.completed,true);
  assert.equal(solved.history.processes.streak,1);
  const second=createReviewAttempt('processes',solved.history);
  assert.equal(second.variantId,'proc-b');
  const show=runReviewCommand(second,solved.history,'ps');
  const final=runReviewCommand(show.attempt,show.history,'kill 425');
  assert.equal(final.history.processes.streak,2);
});

test('two distinct service review cases require diagnosing the selected unit',()=>{
  const first=createReviewAttempt('services',{});
  assert.equal(first.variantId,'svc-a');
  const status=runReviewCommand(first,{},'systemctl status web');
  const logs=runReviewCommand(status.attempt,status.history,'journalctl -u web');
  const solved=runReviewCommand(logs.attempt,logs.history,'systemctl restart web');
  assert.equal(solved.attempt.completed,true);
  assert.equal(solved.history.services.streak,1);
  const second=createReviewAttempt('services',solved.history);
  assert.equal(second.variantId,'svc-b');
  assert.equal(second.state.services.queue.status,'failed');
  const s=runReviewCommand(second,solved.history,'systemctl status queue');
  const l=runReviewCommand(s.attempt,s.history,'journalctl -u queue');
  const done=runReviewCommand(l.attempt,l.history,'systemctl start queue');
  assert.equal(done.attempt.completed,true);
  assert.equal(done.history.services.streak,2);
});

test('help and errors reset review independence but never damage original world',()=>{
  const original=initialLinux();
  const review=createReviewAttempt('processes',{});
  const bad=runReviewCommand(review,{},'kill 999');
  const observed=runReviewCommand(bad.attempt,bad.history,'ps');
  const result=runReviewCommand(observed.attempt,observed.history,'kill 424');
  assert.equal(result.attempt.completed,true);
  assert.equal(result.attempt.independent,false);
  assert.equal(result.history.processes.streak,0);
  assert.equal(original.processes.find(p=>p.pid===424).running,true);
});
