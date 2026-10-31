import test from 'node:test';
import assert from 'node:assert/strict';
import {executeLinux,initialLinux} from '../src/core/linux.ts';
import {blindCase,seedBlindCase,blindProgress} from '../src/core/blindInvestigation.ts';
import {missions} from '../src/core/missions.ts';
import {modeOf} from '../src/core/permissions.ts';

const c=blindCase;
function run(commands,initial=seedBlindCase(initialLinux())){
  let state=initial;const events=[];
  for(const command of commands){
    const e=executeLinux(state,command);
    state=e.state;events.push(e);
  }
  return {state,events,progress:blindProgress(state,events)};
}
const ticket=['ls ~/documents/cases','cat '+c.ticket];
const investigate=['cat '+c.evidence,'namei -l '+c.evidence];
const repair=['chmod u+x '+c.directory,'cat '+c.evidence];
const preserve=['cp '+c.evidence+' '+c.copy,'cat '+c.copy];
const solve=()=>run([...ticket,...investigate,...repair,...preserve]);

test('the blind mission is appended without moving earlier 20 missions and has no hints',()=>{
  assert.equal(missions.length,21);
  assert.equal(missions[18].id,'incident-response');
  assert.equal(missions[19].id,'operational-recovery');
  assert.equal(missions[20].id,'blind-investigation');
  assert.deepEqual(missions[20].hints,[]);
  assert.equal(missions[20].success(initialLinux(),[]),false);
  assert.doesNotMatch(missions[20].briefing,/namei -l|chmod u\+x|case21-audit/);
});

test('one-shot case seed does not modify old saves, and does not recreate deleted files',()=>{
  const legacy=initialLinux(),before=structuredClone(legacy);
  delete legacy.lastExitCode;
  const first=seedBlindCase(legacy);
  assert.deepEqual(legacy,{...before,lastExitCode:undefined});
  assert.equal(first.blindCase.seeded,true);
  assert.equal(modeOf(first,c.directory),0o600);
  assert.equal(first.files[c.evidence],c.evidenceBody);
  assert.equal(first.files[c.ticket],c.ticketBody);
  assert.equal(seedBlindCase(first),first);
  const deleted=executeLinux(first,'rm '+c.ticket).state;
  assert.equal(seedBlindCase(deleted),deleted);
  assert.equal(seedBlindCase(deleted).files[c.ticket],undefined);
  const userEdited={...legacy,files:{...legacy.files,[c.ticket]:'MY ORIGINAL TICKET'}};
  assert.equal(seedBlindCase(userEdited).files[c.ticket],'MY ORIGINAL TICKET');
});

test('all diagnostic steps can be performed on a simulated filesystem without host access',()=>{
  const state=seedBlindCase(initialLinux());
  const t=executeLinux(state,'cat '+c.ticket);
  assert.equal(t.ok,true);
  assert.match(t.output,/permission denied/);
  const denied=executeLinux(t.state,'cat '+c.evidence);
  assert.equal(denied.ok,false);
  assert.equal(denied.target,c.evidence);
  assert.match(denied.output,/Permission denied/);
  const diagnostic=executeLinux(denied.state,'namei -l '+c.evidence);
  assert.equal(diagnostic.ok,true);
  assert.equal(diagnostic.blockedAt,c.directory);
  const probe=executeLinux(denied.state,'test -x '+c.directory);
  assert.equal(probe.exitCode,1);
  assert.equal(modeOf(state,c.directory),0o600);
});

test('blind case requires observed failure, independent diagnosis, minimal fix and verified copy',()=>{
  const prefixes=[
    [],
    ticket,
    [...ticket,investigate[0]],
    [...ticket,...investigate],
    [...ticket,...investigate,...repair],
    [...ticket,...investigate,...repair,...preserve]
  ];
  const expected=[
    [false,false,false,false],
    [false,false,false,false],
    [true,false,false,false],
    [true,true,false,false],
    [true,true,true,false],
    [true,true,true,true]
  ];
  prefixes.forEach((commands,i)=>{
    const r=run(commands),p=r.progress;
    assert.deepEqual([p.observed,p.diagnosed,p.recovered,p.preserved],expected[i],String(i));
    assert.equal(missions[20].success(r.state,r.events),i===5);
  });
});

test('correct self-directed recovery restores traversal without exposing others',()=>{
  const r=solve();
  assert.equal(r.progress.completed,true);
  assert.equal(r.state.files[c.evidence],c.evidenceBody);
  assert.equal(r.state.files[c.copy],c.evidenceBody);
  assert.equal(modeOf(r.state,c.directory),0o700);
  assert.equal(modeOf(r.state,c.evidence),0o644);
  assert.equal(modeOf(r.state,c.copy),0o644);
  assert.equal(r.state.files[c.distraction],c.decoyBody);
});

test('other valid diagnosis approaches work without exact raw command strings',()=>{
  for(const diagnostic of [
    'stat '+c.directory,
    'test -x '+c.directory,
    'namei -l '+c.evidence
  ]){
    const r=run([...ticket,'cat '+c.evidence,diagnostic,...repair,...preserve]);
    assert.equal(r.progress.completed,true,diagnostic);
  }
});

test('guessing chmod without evidence, bypassing denial or decoy denial cannot pass',()=>{
  const direct=run([...ticket,'chmod u+x '+c.directory,...repair.slice(1),...preserve]);
  assert.equal(direct.progress.completed,false);
  const noTicket=run([...investigate,...repair,...preserve]);
  assert.equal(noTicket.progress.completed,false);
  const otherDenied=run([...ticket,'cat ~/documents/restricted.log',
    'namei -l '+c.evidence,...repair,...preserve]);
  assert.equal(otherDenied.progress.completed,false);
  const wrongOrder=run([...ticket,investigate[1],investigate[0],...repair,...preserve]);
  assert.equal(wrongOrder.progress.completed,false);
});

test('overly broad permissions, corrupt evidence or missing verification fail',()=>{
  const broad=run([...ticket,...investigate,'chmod 777 '+c.directory,
    'cat '+c.evidence,...preserve]);
  assert.equal(broad.progress.completed,false);
  const unread=run([...ticket,...investigate,...repair,preserve[0]]);
  assert.equal(unread.progress.completed,false);
  const valid=solve();
  const changedDir={...valid.state,permissions:{...valid.state.permissions,[c.directory]:0o777}};
  assert.equal(blindProgress(changedDir,valid.events).completed,false);
  const tampered={...valid.state,files:{...valid.state.files,[c.evidence]:'TAMPERED'}};
  assert.equal(blindProgress(tampered,valid.events).completed,false);
  const deleted={...valid.state,files:{...valid.state.files}};
  delete deleted.files[c.ticket];
  assert.equal(blindProgress(deleted,valid.events).completed,false);
});

test('preserved artifacts without this mission history are not accepted',()=>{
  const r=solve();
  assert.equal(blindProgress(r.state,[]).completed,false);
  assert.equal(blindProgress(r.state,r.events.slice(0,-1)).completed,false);
});
