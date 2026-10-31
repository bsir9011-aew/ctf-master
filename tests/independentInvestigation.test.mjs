import test from 'node:test';
import assert from 'node:assert/strict';
import {executeLinux,initialLinux} from '../src/core/linux.ts';
import {modeOf} from '../src/core/permissions.ts';
import {blindCase,seedBlindCase} from '../src/core/blindInvestigation.ts';
import {independentCase as c,seedIndependentCase,independentProgress} from '../src/core/independentInvestigation.ts';
import {missions} from '../src/core/missions.ts';

function run(commands,initial=seedIndependentCase(initialLinux())){
  let state=initial;const events=[];
  for(const command of commands){
    const event=executeLinux(state,command);
    events.push(event);state=event.state;
  }
  return {state,events,progress:independentProgress(state,events)};
}
const observe=['cat '+c.ticket,'cat '+c.evidence];
const diagnose=['stat '+c.evidence];
const recover=['chmod u+r '+c.evidence,'cat '+c.evidence];
const preserve=['cp '+c.evidence+' '+c.copy,'cat '+c.copy];
const full=[...observe,...diagnose,...recover,...preserve];

test('independent transfer is a new, unhinted mission after original investigation',()=>{
  assert.equal(missions.length,22);
  assert.equal(missions[20].id,'blind-investigation');
  assert.equal(missions[21].id,'independent-investigation');
  assert.deepEqual(missions[21].hints,[]);
  assert.doesNotMatch(missions[21].briefing,/chmod|test -r|stat |namei|case22-/);
  assert.equal(missions[21].success(initialLinux(),[]),false);
});

test('different root cause: traversable parent, file lacks owner read bit',()=>{
  const first=seedBlindCase(initialLinux());
  const state=seedIndependentCase(first);
  assert.equal(modeOf(first,blindCase.directory),0o600);
  assert.equal(modeOf(state,c.directory),0o700);
  assert.equal(modeOf(state,c.evidence),0o200);
  assert.equal(executeLinux(state,'test -x '+c.directory).exitCode,0);
  assert.equal(executeLinux(state,'test -r '+c.evidence).exitCode,1);
  assert.equal(executeLinux(state,'test -f '+c.evidence).exitCode,0);
  assert.equal(executeLinux(state,'cat '+c.evidence).target,c.evidence);
  assert.equal(executeLinux(state,'cat '+c.evidence).exitCode,1);
  const namei=executeLinux(state,'namei -l '+c.evidence);
  assert.equal(namei.ok,true);
  assert.equal(namei.blockedAt,undefined);
  assert.match(namei.output,/audit-export\.log/);
});

test('one-shot seed preserves existing user edits and never recreates deleted evidence',()=>{
  const old=initialLinux(),snapshot=structuredClone(old);
  delete old.lastExitCode;
  const seed=seedIndependentCase(old);
  assert.equal(old.independentCase,undefined);
  assert.deepEqual(old.files,snapshot.files);
  assert.equal(seed.independentCase.seeded,true);
  assert.equal(seedIndependentCase(seed),seed);
  const changed=executeLinux(seed,'rm '+c.ticket);
  assert.equal(changed.ok,true);
  assert.equal(seedIndependentCase(changed.state),changed.state);
  assert.equal(seedIndependentCase(changed.state).files[c.ticket],undefined);
  const custom={...old,files:{...old.files,[c.ticket]:'PERSONAL TICKET'}};
  assert.equal(seedIndependentCase(custom).files[c.ticket],'PERSONAL TICKET');
});

test('four evidence-backed stages require observing, diagnosis, minimal repair, verified copy',()=>{
  const prefixes=[
    [],[observe[0]],observe,[...observe,...diagnose],
    [...observe,...diagnose,...recover],
    full
  ];
  const expected=[
    [false,false,false,false],
    [false,false,false,false],
    [true,false,false,false],
    [true,true,false,false],
    [true,true,true,false],
    [true,true,true,true]
  ];
  for(let i=0;i<prefixes.length;i++){
    const x=run(prefixes[i]);
    assert.deepEqual(
      [x.progress.observed,x.progress.diagnosed,x.progress.repaired,x.progress.verified],
      expected[i],String(i));
    assert.equal(missions[21].success(x.state,x.events),i===5);
  }
});

test('more than one independent diagnostic approach passes',()=>{
  const alternatives=[
    ['stat '+c.evidence],
    ['namei -l '+c.evidence],
    ['test -x '+c.directory,'test -r '+c.evidence]
  ];
  for(const d of alternatives){
    const r=run([...observe,...d,...recover,...preserve]);
    assert.equal(r.progress.completed,true,d.join('; '));
    assert.equal(modeOf(r.state,c.directory),0o700);
    assert.equal(modeOf(r.state,c.evidence),0o600);
    assert.equal(modeOf(r.state,c.copy),0o644);
    assert.equal(r.state.files[c.evidence],c.evidenceBody);
    assert.equal(r.state.files[c.copy],c.evidenceBody);
  }
});

test('repeating the old directory repair cannot solve the changed incident',()=>{
  const r=run([...observe,'chmod u+x '+c.directory,
    'cat '+c.evidence,'cp '+c.evidence+' '+c.copy]);
  assert.equal(r.state.permissions[c.directory],0o700);
  assert.equal(r.state.permissions[c.evidence],0o200);
  assert.equal(r.progress.completed,false);
  assert.equal(r.state.files[c.copy],undefined);
});

test('a failed read alone and an isolated -r false are not sufficient diagnosis',()=>{
  const noDiagnosis=run([...observe,...recover,...preserve]);
  assert.equal(noDiagnosis.progress.completed,false);
  const falseOnly=run([...observe,'test -r '+c.evidence,...recover,...preserve]);
  assert.equal(falseOnly.progress.diagnosed,false);
  const wrongOrder=run(['stat '+c.evidence,...observe,...recover,...preserve]);
  assert.equal(wrongOrder.progress.completed,false);
  const wrongError=run(['cat '+c.ticket,'cat ~/documents/no-file.log',
    'stat '+c.evidence,...recover,...preserve]);
  assert.equal(wrongError.progress.observed,false);
});

test('broad permissions, tampering and missing verification do not pass',()=>{
  const broad=run([...observe,...diagnose,
    'chmod 777 '+c.evidence,'chmod 600 '+c.evidence,
    ...recover.slice(1),...preserve]);
  assert.equal(broad.progress.completed,false);
  const wrongDir=run([...observe,...diagnose,
    'chmod 777 '+c.directory,...recover,...preserve]);
  assert.equal(wrongDir.progress.completed,false);
  const unread=run([...observe,...diagnose,...recover,preserve[0]]);
  assert.equal(unread.progress.completed,false);
  const fullCase=run(full);
  const changed={...fullCase.state,files:{...fullCase.state.files,[c.evidence]:'FORGED'}};
  assert.equal(independentProgress(changed,fullCase.events).completed,false);
  const lostTicket={...fullCase.state,files:{...fullCase.state.files}};
  delete lostTicket.files[c.ticket];
  assert.equal(independentProgress(lostTicket,fullCase.events).completed,false);
  assert.equal(independentProgress(fullCase.state,[]).completed,false);
});
