import {assertWorldUnchanged} from './assertWorldUnchanged.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { executeLinux, initialLinux } from '../src/core/linux.ts';
import { missions } from '../src/core/missions.ts';
import { availableReviews, createReviewAttempt, runReviewCommand, reviewScenarios } from '../src/core/review.ts';
import { explainError } from '../src/core/learning.ts';

const gateway = 'ip route replace default via 10.20.30.1';
const resolver = 'resolvectl dns eth0 198.51.100.53';

function play(commands, seed=initialLinux()) {
  let state=seed;const events=[];
  for(const cmd of commands){const result=executeLinux(state,cmd);state=result.state;events.push(result);}
  return {state,events};
}
function reviewCommands(attempt,history,commands) {
  let result={attempt,history};
  for(const cmd of commands) result=runReviewCommand(result.attempt,result.history,cmd);
  return result;
}

test('DNS initially fails despite working numeric ping after fixing gateway',()=>{
  const s=play([gateway,'ping -c 1 198.51.100.10']);
  assert.equal(s.events[1].ok,true);
  const result=executeLinux(s.state,'nslookup lab.ctf.test');
  assert.equal(result.ok,false);
  assert.match(result.output,/DNS server not responding/);
  assert.match(explainError(result).guidance,/DNS/);
  assert.match(executeLinux(s.state,'resolvectl dns eth0').output,/198.51.100.54/);
});

test('DNS recovery resolves only a known lab hostname with the configured resolver',()=>{
  const s=play([gateway,resolver,'nslookup lab.ctf.test']);
  assert.equal(s.events[2].ok,true);
  assert.equal(s.events[2].target,'lab.ctf.test');
  assert.match(s.events[2].output,/198.51.100.10/);
  assert.equal(executeLinux(s.state,'nslookup anything-else.ctf.test').ok,false);
  assert.equal(initialLinux().network.dnsServer,'198.51.100.54');
});

test('DNS rejects unreachable routes and invalid resolver addresses',()=>{
  const initial=initialLinux();
  for(const cmd of ['resolvectl dns eth0 banana','resolvectl dns eth0 999.0.0.1',
    'resolvectl dns eth0 0.0.0.0','resolvectl dns eth0 255.255.255.255',
    'resolvectl dns eth0 198.51.100.53 extra']) {
    const r=executeLinux(initial,cmd);
    assert.equal(r.ok,false,cmd);assertWorldUnchanged(r.state,initial,cmd);
  }
  const set=executeLinux(initial,resolver);
  assert.equal(executeLinux(set.state,'nslookup lab.ctf.test').ok,false);
});

test('ARP neighbor entry is learned for the router, not the remote host',()=>{
  const seed=initialLinux();
  assert.match(executeLinux(seed,'ip neigh show').output,/empty ARP/);
  const local=play(['ping -c 1 10.20.30.1']);
  assert.match(executeLinux(local.state,'ip neigh show').output,/10.20.30.1.*02:42:ac:14:1e:01/);
  const remote=play([gateway,'ping -c 1 198.51.100.10']);
  const neigh=executeLinux(remote.state,'ip neigh show');
  assert.equal(neigh.ok,true);
  assert.match(neigh.output,/10.20.30.1/);
  assert.doesNotMatch(neigh.output,/198.51.100.10/);
  assert.deepEqual(seed.network.arpCache,{});
});

test('failed remote communication does not invent an ARP entry',()=>{
  const original=initialLinux();
  const r=executeLinux(original,'ping -c 1 198.51.100.10');
  assert.equal(r.ok,false);
  assert.deepEqual(r.state.network.arpCache,{});
});

test('TCP refusal differs from ping success and is independent of local ss listeners',()=>{
  const net=play([gateway,resolver]);
  assert.equal(executeLinux(net.state,'ping -c 1 198.51.100.10').ok,true);
  const closed=executeLinux(net.state,'nc -z lab.ctf.test 22');
  assert.equal(closed.ok,false);
  assert.match(closed.output,/Connection refused/);
  assert.match(explainError(closed).guidance,/TCP/);
  const open=executeLinux(net.state,'nc -z lab.ctf.test 443');
  assert.equal(open.ok,true);
  assert.match(open.output,/succeeded/);
  // Local sshd can listen on 22 even when remote TCP/22 is closed.
  assert.match(executeLinux(net.state,'ss -lnt').output,/0.0.0.0:22/);
});

test('trace shows DNS route ARP and TCP stages without real packet I/O',()=>{
  const state=play([gateway,resolver]).state;
  const success=executeLinux(state,'trace lab.ctf.test 443');
  assert.equal(success.ok,true);
  for(const marker of ['DNS:','ROUTE:','ARP:','TCP:','SYN/ACK']) assert.match(success.output,new RegExp(marker));
  assert.equal(success.target,'lab.ctf.test:443');
  assert.match(executeLinux(success.state,'ip neigh show').output,/02:42:ac:14:1e:01/);
});

test('trace failure identifies DNS, routing, or closed TCP separately',()=>{
  const seed=initialLinux();
  const route=executeLinux(seed,'trace 198.51.100.10 443');
  assert.match(route.output,/Destination Host Unreachable/);
  const dns=executeLinux(seed,'trace lab.ctf.test 443');
  assert.match(dns.output,/DNS timeout/);
  const partial=play([gateway,resolver]).state;
  const closed=executeLinux(partial,'trace lab.ctf.test 22');
  assert.equal(closed.ok,false);
  assert.match(closed.output,/no listener/);
});

test('unsupported diagnostic syntax never mutates virtual lab state',()=>{
  const seed=initialLinux();
  const cmds=['nslookup','resolvectl dns wlan0','nc -z lab.ctf.test 0',
    'nc -z lab.ctf.test 65536','nc lab.ctf.test 443','trace lab.ctf.test',
    'trace lab.ctf.test 443 extra','trace ; rm /',
    'ip neigh flush dev eth0'];
  for(const cmd of cmds){
    const result=executeLinux(seed,cmd);
    assert.equal(result.ok,false,cmd);
    assertWorldUnchanged(result.state,seed,cmd);
  }
});

test('DNS mission requires resolver repair and verifiable name resolution',()=>{
  const m=missions.find(x=>x.id==='dns-repair');
  assert.ok(m);
  const onlyPing=play([gateway,'ping -c 1 198.51.100.10']);
  assert.equal(m.success(onlyPing.state,onlyPing.events),false);
  const done=play([gateway,'resolvectl dns eth0',resolver,'nslookup lab.ctf.test']);
  assert.equal(m.success(done.state,done.events),true);
  const noLookup=play([gateway,resolver]);
  assert.equal(m.success(noLookup.state,noLookup.events),false);
});

test('layered TCP mission checks all three observable stages',()=>{
  const m=missions.find(x=>x.id==='packet-layers');
  assert.ok(m);
  const commands=[gateway,resolver,'trace lab.ctf.test 443','nc -z lab.ctf.test 443','ip neigh show'];
  const done=play(commands);
  assert.equal(m.success(done.state,done.events),true);
  assert.equal(m.success(done.state,done.events.filter(x=>x.command!=='nc')),false);
  assert.equal(m.success(done.state,done.events.filter(x=>x.command!=='ip')),false);
});

test('review variants use distinct domain, DNS server, port and clean state',()=>{
  const dns=availableReviews(['dns-repair'],{},{});
  assert.deepEqual(dns.map(x=>x.id),['dns']);
  const first=createReviewAttempt('dns',{});
  assert.equal(first.variantId,'dns-a');
  const s=reviewCommands(first,{},['resolvectl dns eth0','resolvectl dns eth0 203.0.113.53','nslookup ops.ctf.test']);
  assert.equal(s.attempt.completed,true);
  assert.equal(s.history.dns.streak,1);
  const second=createReviewAttempt('dns',s.history);
  assert.equal(second.variantId,'dns-b');
  const done=reviewCommands(second,s.history,['resolvectl dns eth0','resolvectl dns eth0 198.51.100.53','nslookup staging.ctf.test']);
  assert.equal(done.history.dns.streak,2);
  assert.equal(initialLinux().network.dnsServer,'198.51.100.54');
});

test('TCP path review alternates remote port and router MAC, not memorized command',()=>{
  assert.deepEqual(availableReviews(['packet-layers'],{},{}).map(x=>x.id),['tcp-path']);
  const a=createReviewAttempt('tcp-path',{});
  assert.equal(a.variantId,'tcp-a');
  const first=reviewCommands(a,{},['trace api.ctf.test 8443','nc -z api.ctf.test 8443','ip neigh show']);
  assert.equal(first.attempt.completed,true);
  assert.equal(first.history['tcp-path'].streak,1);
  const b=createReviewAttempt('tcp-path',first.history);
  assert.equal(b.variantId,'tcp-b');
  assert.equal(executeLinux(b.state,'nc -z vault.ctf.test 8443').ok,false);
  const second=reviewCommands(b,first.history,['trace vault.ctf.test 443','nc -z vault.ctf.test 443','ip neigh show']);
  assert.equal(second.history['tcp-path'].streak,2);
  assert.equal(reviewScenarios.length,20);
});

test('all lab DNS targets are reserved documentation/test domains',()=>{
  const net=initialLinux().network;
  assert.equal(net.dnsName.endsWith('.test'),true);
  for(const scenario of reviewScenarios.filter(x=>x.skill==='dns'||x.skill==='tcp-path')) {
    assert.equal(scenario.network.dnsName.endsWith('.test'),true);
  }
});

test('legacy in-progress practice without network state fails safely',()=>{
  const old={...initialLinux(),network:undefined};
  for(const cmd of ['resolvectl dns eth0','nslookup lab.ctf.test','trace lab.ctf.test 443','nc -z lab.ctf.test 443']) {
    const result=executeLinux(old,cmd);
    assert.equal(typeof result.ok,'boolean',cmd);
    assert.equal(typeof result.output,'string',cmd);
  }
});
