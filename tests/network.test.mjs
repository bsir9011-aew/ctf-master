import test from 'node:test';
import assert from 'node:assert/strict';
import {executeLinux, initialLinux} from '../src/core/linux.ts';
import {ipv4Number, sameSubnet, networkCIDR} from '../src/core/network.ts';
import {missions} from '../src/core/missions.ts';
import {createReviewAttempt,runReviewCommand,availableReviews} from '../src/core/review.ts';
import {explainError} from '../src/core/learning.ts';

function run(commands, initial=initialLinux()) {
  let state=initial;const events=[];
  for(const cmd of commands){const result=executeLinux(state,cmd);state=result.state;events.push(result);}
  return {state,events};
}

test('IPv4 conversion rejects malformed octets and subnet math supports /24 and /32',()=>{
  assert.equal(ipv4Number('10.20.30.1')!==null,true);
  for(const bad of ['256.2.3.4','10.20.30','001.2.3.4','-1.2.3.4','10.2.3.4.5']) assert.equal(ipv4Number(bad),null,bad);
  assert.equal(sameSubnet('10.20.30.25','10.20.30.1',24),true);
  assert.equal(sameSubnet('10.20.40.25','10.20.30.1',24),false);
  assert.equal(sameSubnet('172.16.1.5','172.16.1.5',32),true);
  assert.equal(sameSubnet('172.16.1.5','172.16.1.6',32),false);
  assert.equal(networkCIDR('10.20.30.25',24),'10.20.30.0/24');
});

test('default route starts wrong while local router ping works',()=>{
  const s=initialLinux();
  assert.match(executeLinux(s,'ip addr show').output,/10\.20\.30\.25\/24/);
  assert.match(executeLinux(s,'ip route show').output,/default via 10\.20\.30\.254/);
  assert.equal(executeLinux(s,'ping -c 1 10.20.30.1').ok,true);
  const failed=executeLinux(s,'ping -c 1 198.51.100.10');
  assert.equal(failed.ok,false);
  assert.match(failed.output,/Destination Host Unreachable/);
  assert.match(explainError(failed).guidance,/prefiks/);
});

test('correcting route changes simulated external connectivity but not real OS',()=>{
  const original=initialLinux();
  const fixed=executeLinux(original,'ip route replace default via 10.20.30.1');
  assert.equal(fixed.ok,true);
  assert.equal(fixed.state.network.gateway,'10.20.30.1');
  assert.equal(original.network.gateway,'10.20.30.254');
  const response=executeLinux(fixed.state,'ping -c 1 198.51.100.10');
  assert.equal(response.ok,true);
  assert.equal(response.target,'198.51.100.10');
  assert.match(response.output,/1 received/);
});

test('gateway in other subnet is rejected without changing state',()=>{
  const initial=initialLinux();
  for(const bad of ['ip route replace default via 172.16.1.1','ip route replace default via 999.20.30.1',
    'ip route replace default via 10.20.30.25','ip route replace default via 10.20.30.1 extra']) {
    const result=executeLinux(initial,bad);
    assert.equal(result.ok,false,bad);
    assert.equal(result.state,initial,bad);
  }
});

test('incorrect prefix prevents remote connection even with correct gateway',()=>{
  const state=initialLinux();
  const first=executeLinux(state,'ip addr replace 10.20.40.25/24 dev eth0');
  assert.equal(first.ok,true);
  const fixedRoute=executeLinux(first.state,'ip route replace default via 10.20.30.1');
  assert.equal(fixedRoute.ok,false);
  assert.equal(executeLinux(first.state,'ping -c 1 198.51.100.10').ok,false);
  const corrected=executeLinux(first.state,'ip addr replace 10.20.30.44/24 dev eth0');
  const route=executeLinux(corrected.state,'ip route replace default via 10.20.30.1');
  assert.equal(executeLinux(route.state,'ping -c 1 198.51.100.10').ok,true);
});

test('interface down blocks local and external ping but not loopback',()=>{
  const up=executeLinux(initialLinux(),'ip route replace default via 10.20.30.1').state;
  const down=executeLinux(up,'ip link set eth0 down');
  assert.equal(down.state.network.linkUp,false);
  assert.equal(executeLinux(down.state,'ping -c 1 10.20.30.1').ok,false);
  assert.equal(executeLinux(down.state,'ping -c 1 198.51.100.10').ok,false);
  assert.equal(executeLinux(down.state,'ping -c 1 127.0.0.1').ok,true);
  assert.equal(executeLinux(executeLinux(down.state,'ip link set eth0 up').state,'ping -c 1 198.51.100.10').ok,true);
});

test('invalid IP, prefix, unsupported shell and malformed ping leave state untouched',()=>{
  const state=initialLinux();
  for(const cmd of [
    'ip addr replace 10.20.30.2/33 dev eth0','ip addr replace 10.20.30.2/0 dev eth0',
    'ip addr replace 255.255.255.255/24 dev eth0','ip addr replace 1.2.3.4/24 dev wlan0',
    'ping 198.51.100.10','ping -c 5 198.51.100.10',
    'ip route add default via 10.20.30.1','ping -c 1 example.com',
    'curl 198.51.100.10'
  ]) {
    const result=executeLinux(state,cmd);
    assert.equal(result.ok,false,cmd);
    assert.equal(result.state,state,cmd);
  }
});

test('ss exposes only active listeners and tracks service lifecycle',()=>{
  const first=initialLinux();
  const initial=executeLinux(first,'ss -lnt');
  assert.equal(initial.ok,true);
  assert.match(initial.output,/0\.0\.0\.0:22/);
  assert.doesNotMatch(initial.output,/0\.0\.0\.0:8080/);
  assert.doesNotMatch(initial.output,/0\.0\.0\.0:9000/);
  const restored=executeLinux(first,'systemctl start api');
  const after=executeLinux(restored.state,'ss -lnt');
  assert.match(after.output,/0\.0\.0\.0:9000/);
  assert.doesNotMatch(after.output,/0\.0\.0\.0:8080/);
  const stopped=executeLinux(restored.state,'systemctl stop api');
  assert.doesNotMatch(executeLinux(stopped.state,'ss -lnt').output,/0\.0\.0\.0:9000/);
});

test('ss rejects unsupported flags and never opens actual sockets',()=>{
  const state=initialLinux();
  for(const cmd of ['ss','ss -tulnp','ss -lntu']) {
    const result=executeLinux(state,cmd);
    assert.equal(result.ok,false,cmd);
    assert.equal(result.state,state,cmd);
  }
});

test('gateway mission checks observable inspection, correct route and connectivity',()=>{
  const mission=missions.find(m=>m.id==='gateway-repair');
  assert.ok(mission);
  const partial=run(['ip route replace default via 10.20.30.1','ping -c 1 198.51.100.10']);
  assert.equal(mission.success(partial.state,partial.events),false);
  const done=run(['ip addr show','ip route show','ip route replace default via 10.20.30.1','ping -c 1 198.51.100.10']);
  assert.equal(mission.success(done.state,done.events),true);
});

test('TCP listener mission checks absent then active port after repair',()=>{
  const mission=missions.find(m=>m.id==='api-listener');
  assert.ok(mission);
  const noCheck=run(['systemctl restart api','ss -lnt']);
  assert.equal(mission.success(noCheck.state,noCheck.events),false);
  const done=run(['ss -lnt','systemctl status api','systemctl restart api','ss -lnt']);
  assert.equal(mission.success(done.state,done.events),true);
  const damaged=run(['ss -lnt','systemctl restart api','ss -lnt','systemctl stop sshd']);
  assert.equal(mission.success(damaged.state,damaged.events),false);
});

test('route review alternates gateway fault and wrong subnet',()=>{
  const all=availableReviews(['gateway-repair'],{},{});
  assert.deepEqual(all.map(x=>x.id),['routes']);
  const a=createReviewAttempt('routes',{});
  assert.equal(a.variantId,'route-a');
  const r1=runReviewCommand(a,{},'ip route show');
  const r2=runReviewCommand(r1.attempt,r1.history,'ip route replace default via 10.30.40.1');
  const r3=runReviewCommand(r2.attempt,r2.history,'ping -c 1 198.51.100.22');
  assert.equal(r3.attempt.completed,true);
  assert.equal(r3.attempt.independent,true);
  const b=createReviewAttempt('routes',r3.history);
  assert.equal(b.variantId,'route-b');
  assert.equal(executeLinux(b.state,'ping -c 1 203.0.113.20').ok,false);
  const c1=runReviewCommand(b,r3.history,'ip route show');
  const c2=runReviewCommand(c1.attempt,c1.history,'ip addr replace 172.16.5.22/24 dev eth0');
  const c3=runReviewCommand(c2.attempt,c2.history,'ping -c 1 203.0.113.20');
  assert.equal(c3.attempt.completed,true);
  assert.equal(c3.history.routes.streak,2);
});

test('listener review variants require separate ports and preserve original state',()=>{
  const all=availableReviews(['api-listener'],{},{});
  assert.deepEqual(all.map(x=>x.id),['listeners']);
  const original=initialLinux();
  const a=createReviewAttempt('listeners',{});
  assert.equal(a.variantId,'listen-a');
  const r1=runReviewCommand(a,{},'ss -lnt');
  const r2=runReviewCommand(r1.attempt,r1.history,'systemctl restart api');
  const r3=runReviewCommand(r2.attempt,r2.history,'ss -lnt');
  assert.equal(r3.attempt.completed,true);
  const b=createReviewAttempt('listeners',r3.history);
  assert.equal(b.variantId,'listen-b');
  const z1=runReviewCommand(b,r3.history,'ss -lnt');
  const z2=runReviewCommand(z1.attempt,z1.history,'systemctl start web');
  const z3=runReviewCommand(z2.attempt,z2.history,'ss -lnt');
  assert.equal(z3.attempt.completed,true);
  assert.equal(z3.history.listeners.streak,2);
  assert.equal(original.services.api.status,'failed');
});

test('review worlds use independent network state; a changed gateway never leaks',()=>{
  const original=initialLinux();
  const a=createReviewAttempt('routes',{});
  const changed=executeLinux(a.state,'ip route replace default via 10.30.40.1');
  assert.equal(changed.ok,true);
  assert.equal(original.network.gateway,'10.20.30.254');
  assert.equal(a.state.network.gateway,'10.30.40.254');
  assert.equal(changed.state.network.gateway,'10.30.40.1');
});
