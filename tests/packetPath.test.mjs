import test from 'node:test';
import assert from 'node:assert/strict';
import {initialLinux,executeLinux} from '../src/core/linux.ts';
import {analyzePacketPath} from '../src/core/packetPath.ts';
import {createReviewAttempt} from '../src/core/review.ts';

function run(commands, initial=initialLinux()) {
  let state=initial;
  for(const cmd of commands) {
    const result=executeLinux(state,cmd);
    assert.equal(result.ok,true,cmd);
    state=result.state;
  }
  return state;
}

test('initial network correctly points to a faulty default gateway',()=>{
  const net=initialLinux().network;
  const result=analyzePacketPath(net,'ip',443);
  assert.equal(result.failure,'route');
  assert.equal(result.stages.find(x=>x.id==='link').status,'ok');
  assert.equal(result.stages.find(x=>x.id==='route').status,'blocked');
  assert.equal(result.stages.find(x=>x.id==='dns').status,'skipped');
  assert.equal(result.stages.find(x=>x.id==='tcp').status,'skipped');
  assert.match(result.message,/brama/);
});

test('link down stops the model at the host not router or TCP',()=>{
  const net=run(['ip link set eth0 down']).network;
  const result=analyzePacketPath(net,'ip',443);
  assert.equal(result.failure,'link');
  assert.equal(result.stages.find(x=>x.id==='route').status,'skipped');
  assert.equal(result.stages.find(x=>x.id==='tcp').status,'skipped');
});

test('after gateway repair numeric destination works without DNS',()=>{
  const state=run(['ip route replace default via 10.20.30.1']);
  const view=analyzePacketPath(state.network,'ip',443);
  assert.equal(view.failure,null);
  assert.equal(view.stages.find(x=>x.id==='dns').status,'skipped');
  assert.equal(view.stages.find(x=>x.id==='arp').status,'waiting');
  assert.equal(view.stages.find(x=>x.id==='tcp').status,'ok');
  assert.equal(executeLinux(state,'nc -z 198.51.100.10 443').ok,true);
});

test('DNS error is different from link and gateway errors',()=>{
  const state=run(['ip route replace default via 10.20.30.1']);
  const view=analyzePacketPath(state.network,'name',443);
  assert.equal(view.failure,'dns');
  assert.equal(view.stages.find(x=>x.id==='route').status,'ok');
  assert.equal(view.stages.find(x=>x.id==='dns').status,'blocked');
  assert.equal(executeLinux(state,'nc -z lab.ctf.test 443').ok,false);
});

test('resolving the name exposes the difference between open and closed TCP ports',()=>{
  const state=run(['ip route replace default via 10.20.30.1',
    'resolvectl dns eth0 198.51.100.53']);
  assert.equal(analyzePacketPath(state.network,'name',443).failure,null);
  assert.equal(analyzePacketPath(state.network,'name',22).failure,'tcp');
  assert.equal(analyzePacketPath(state.network,'name',0).failure,'tcp');
  assert.equal(executeLinux(state,'nc -z lab.ctf.test 22').ok,false);
  assert.equal(executeLinux(state,'nc -z lab.ctf.test 443').ok,true);
});

test('ARP display changes only after a successful simulated exchange',()=>{
  const before=run(['ip route replace default via 10.20.30.1']);
  assert.equal(analyzePacketPath(before.network,'ip',443).arpMac,null);
  const ping=executeLinux(before,'ping -c 1 198.51.100.10');
  assert.equal(ping.ok,true);
  const after=analyzePacketPath(ping.state.network,'ip',443);
  assert.equal(after.stages.find(x=>x.id==='arp').status,'ok');
  assert.equal(after.arpMac,'02:42:ac:14:1e:01');
  assert.equal(before.network.arpCache['10.20.30.1'],undefined);
});

test('wrong subnet remains a route problem after merely changing gateway',()=>{
  const state=run(['ip addr replace 10.20.40.25/24 dev eth0']);
  assert.equal(analyzePacketPath(state.network,'ip',443).failure,'route');
  assert.equal(executeLinux(state,'ping -c 1 198.51.100.10').ok,false);
});

test('read-only analysis never alters a player session',()=>{
  const original=initialLinux();
  const snapshot=structuredClone(original);
  analyzePacketPath(original.network,'name',8443);
  analyzePacketPath(original.network,'ip',22);
  assert.deepEqual(original,snapshot);
});

test('review topology uses variant-specific addresses and ports',()=>{
  const dnsReview=createReviewAttempt('dns',{});
  const first=analyzePacketPath(dnsReview.state.network,'name',8443);
  assert.equal(first.source,'10.44.20.5/24');
  assert.equal(first.router,'10.44.20.1');
  assert.equal(first.failure,'dns');
  const tcpReview=createReviewAttempt('tcp-path',{});
  const second=analyzePacketPath(tcpReview.state.network,'name',8443);
  assert.equal(second.failure,null);
  assert.equal(second.port,8443);
  assert.equal(analyzePacketPath(tcpReview.state.network,'name',443).failure,'tcp');
});

test('legacy review state without network data uses safe defaults',()=>{
  const result=analyzePacketPath(undefined,'ip',443);
  assert.equal(result.failure,'route');
  assert.equal(typeof result.message,'string');
});
