import test from 'node:test';
import assert from 'node:assert/strict';
import {executeLinux,initialLinux} from '../src/core/linux.ts';
import {missions} from '../src/core/missions.ts';
import {incidentCase,incidentCaseProgress} from '../src/core/incidentCapstone.ts';

const c=incidentCase;
const run=(commands,seed=initialLinux())=>{
  let state=seed;
  const events=[];
  for(const raw of commands){
    const result=executeLinux(state,raw);
    state=result.state;
    events.push(result);
  }
  return {state,events};
};

const investigate=[
  'grep ALERT '+c.app,
  'grep DENIED '+c.auth
];
const backups=[
  'test -f '+c.app+' && cp '+c.app+' '+c.appEvidence,
  'test -f '+c.auth+' && cp '+c.auth+' '+c.authEvidence
];
const report=[
  'grep ALERT '+c.app+' > '+c.report,
  'grep DENIED '+c.auth+' >> '+c.report,
  'cat '+c.report
];
const complete=()=>run([...investigate,...backups,...report]);

test('mission 17 is appended without changing earlier mission ordering',()=>{
  assert.equal(missions.length,18);
  assert.equal(missions.at(-1).id,'incident-correlation');
  assert.equal(missions[0].id,'orientation');
  assert.equal(missions[15].id,'packet-layers');
  assert.equal(missions.at(-1).success(initialLinux(),[]),false);
});

test('capstone uses existing session logs and does not require new seeded files',()=>{
  const s=initialLinux();
  assert.ok(s.files[c.auth]?.includes(c.authMarker));
  assert.ok(s.files[c.app]?.includes(c.appMarker));
  assert.equal(Object.hasOwn(s.files,c.authEvidence),false);
  assert.equal(Object.hasOwn(s.files,c.appEvidence),false);
  assert.equal(Object.hasOwn(s.files,c.report),false);
});

test('investigation, guarded preservation, correlation and readback advance separately',()=>{
  const prefixes=[
    [],
    investigate,
    [...investigate,...backups],
    [...investigate,...backups,...report.slice(0,2)],
    [...investigate,...backups,...report]
  ];
  const expected=[
    [false,false,false,false],
    [true,false,false,false],
    [true,true,false,false],
    [true,true,true,false],
    [true,true,true,true]
  ];
  for(let i=0;i<prefixes.length;i++){
    const {state,events}=run(prefixes[i]);
    const p=incidentCaseProgress(state,events);
    assert.deepEqual([p.observed,p.preserved,p.correlated,p.verified],expected[i],String(i));
    assert.equal(missions.at(-1).success(state,events),i===4);
  }
});

test('correct chain creates exact evidence, preserves sources and reports both alerts',()=>{
  const initial=initialLinux(),{state,events}=complete();
  assert.ok(events.every(e=>e.ok));
  assert.equal(events.length,7);
  assert.equal(state.files[c.auth],initial.files[c.auth]);
  assert.equal(state.files[c.app],initial.files[c.app]);
  assert.equal(state.files[c.authEvidence],initial.files[c.auth]);
  assert.equal(state.files[c.appEvidence],initial.files[c.app]);
  assert.equal(state.files[c.report],
    '2026-10-29 09:12 ALERT anomalous access detected\n'+
    '2026-10-29 08:04 DENIED sshd failed login for root\n');
  assert.equal(events[2].conditionalTrace?.[0]?.command,'test');
  assert.equal(events[2].conditionalTrace?.[1]?.command,'cp');
  assert.equal(events[2].conditionalTrace?.[1]?.executed,true);
  assert.equal(events[4].redirectMode,'overwrite');
  assert.equal(events[5].redirectMode,'append');
});

test('mere filenames from direct cp cannot bypass conditional copy evidence',()=>{
  const q=run([...investigate,
    'cp '+c.app+' '+c.appEvidence,
    'cp '+c.auth+' '+c.authEvidence,
    ...report
  ]);
  assert.equal(q.state.files[c.report]!==undefined,true);
  assert.equal(incidentCaseProgress(q.state,q.events).observed,true);
  assert.equal(incidentCaseProgress(q.state,q.events).preserved,false);
  assert.equal(missions.at(-1).success(q.state,q.events),false);
});

test('copying before confirming both clues does not count as evidence chain',()=>{
  const commands=[...backups,...investigate,...report];
  const q=run(commands);
  assert.equal(incidentCaseProgress(q.state,q.events).preserved,false);
});

test('missing or incorrect summary composition cannot pass',()=>{
  const onlyOverwrite=run([...investigate,...backups,
    'grep ALERT '+c.app+' > '+c.report,'cat '+c.report]);
  assert.equal(incidentCaseProgress(onlyOverwrite.state,onlyOverwrite.events).correlated,false);
  const reverse=run([...investigate,...backups,
    'grep DENIED '+c.auth+' > '+c.report,
    'grep ALERT '+c.app+' >> '+c.report,
    'cat '+c.report]);
  assert.equal(incidentCaseProgress(reverse.state,reverse.events).completed,false);
  const unread=run([...investigate,...backups,...report.slice(0,2)]);
  assert.equal(incidentCaseProgress(unread.state,unread.events).correlated,true);
  assert.equal(incidentCaseProgress(unread.state,unread.events).verified,false);
});

test('tampering with either source or its permissions blocks completion',()=>{
  const original=complete();
  const mutated={
    ...original.state,
    files:{...original.state.files,[c.auth]:'maliciously changed'}
  };
  assert.equal(incidentCaseProgress(mutated,original.events).completed,false);
  const changed={
    ...original.state,
    permissions:{...original.state.permissions,[c.app]:0o600}
  };
  assert.equal(incidentCaseProgress(changed,original.events).completed,false);
  assert.equal(original.state.files[c.auth],initialLinux().files[c.auth]);
});

test('historical state with no status code still works with current mission',()=>{
  const legacy=initialLinux();
  delete legacy.lastExitCode;
  const q=run([...investigate,...backups,...report],legacy);
  assert.equal(incidentCaseProgress(q.state,q.events).completed,true);
});

test('the mission is bounded by current mission events, not just leftover artifacts',()=>{
  const q=complete();
  assert.equal(incidentCaseProgress(q.state,[]).completed,false);
  assert.equal(incidentCaseProgress(q.state,q.events.slice(0,-1)).completed,false);
});
