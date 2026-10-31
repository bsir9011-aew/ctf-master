import test from 'node:test';
import assert from 'node:assert/strict';
import {executeLinux,initialLinux} from '../src/core/linux.ts';
import {missions} from '../src/core/missions.ts';
import {hypothesisCase,seedHypothesisCase,hypothesisProgress} from '../src/core/hypothesisCase.ts';

const c=hypothesisCase;
const seed=()=>seedHypothesisCase(initialLinux());
const inspect=[
  'grep HTTP_502 '+c.edge,
  'grep AUTH_FAILURE '+c.auth,
  'grep POOL_EXHAUSTED '+c.db,
  'grep POOL_LIMIT_REDUCED '+c.deploy,
  'grep DISK_OK '+c.host
];
const choice='hypothesis pool-exhaustion medium';
const copies=['cp '+c.db+' '+c.dbEvidence,'cp '+c.deploy+' '+c.deployEvidence];
const summary=[
  'grep POOL_LIMIT_REDUCED '+c.deploy+' > '+c.report,
  'grep POOL_EXHAUSTED '+c.db+' >> '+c.report,
  'cat '+c.report
];
const run=(commands,initial=seed())=>{
  let state=initial;
  const events=[];
  for(const cmd of commands){
    const result=executeLinux(state,cmd);
    state=result.state;
    events.push(result);
  }
  return {state,events};
};
const solved=()=>run([...inspect,choice,...copies,...summary]);

test('appends mission 18 without changing earlier indices or the six chapter hierarchy',()=>{
  assert.equal(missions.length,22);
  assert.equal(missions[16].id,'incident-correlation');
  assert.equal(missions[17].id,'incident-hypotheses');
  assert.equal(missions[17].success(seed(),[]),false);
});

test('case fixtures are added without replacing the existing world or older player artifacts',()=>{
  const existing=initialLinux();
  const changed={...existing,files:{...existing.files,'/home/player/documents/cases/custom.txt':'KEEP'}};
  const created=seedHypothesisCase(changed);
  assert.equal(created.files['/home/player/documents/cases/custom.txt'],'KEEP');
  assert.equal(created.files['/var/log/app.log'],changed.files['/var/log/app.log']);
  assert.equal(created.dirs.length,changed.dirs.length);
  assert.equal(seedHypothesisCase(created),created);
  assert.equal(Object.hasOwn(existing.files,c.edge),false);
  const modified=run(['chmod 600 '+c.edge],created).state;
  assert.equal(seedHypothesisCase(modified),modified);
});

test('all five competing sources must be genuinely inspected before an assessment counts',()=>{
  let result=run([...inspect.slice(0,4),choice]);
  assert.equal(hypothesisProgress(result.state,result.events).examined,false);
  assert.equal(hypothesisProgress(result.state,result.events).assessed,false);
  result=run([choice,...inspect]);
  assert.equal(hypothesisProgress(result.state,result.events).examined,true);
  assert.equal(hypothesisProgress(result.state,result.events).assessed,false);
  result=run([...inspect,choice]);
  assert.equal(hypothesisProgress(result.state,result.events).assessed,true);
});

test('wrong explanations do not complete assessment even with full evidence',()=>{
  for(const hypothesis of ['auth-attack','disk-pressure']){
    const {state,events}=run([...inspect,'hypothesis '+hypothesis+' high',...copies,...summary]);
    assert.equal(hypothesisProgress(state,events).examined,true);
    assert.equal(hypothesisProgress(state,events).assessed,false);
    assert.equal(hypothesisProgress(state,events).completed,false);
  }
});

test('learner can revise a hypothesis after comparing evidence; confidence is recorded',()=>{
  const q=run([...inspect,'hypothesis auth-attack high',choice,...copies,...summary]);
  assert.equal(q.events[6].target,'pool-exhaustion');
  assert.equal(q.events[6].hypothesisConfidence,'medium');
  assert.equal(hypothesisProgress(q.state,q.events).completed,true);
  assert.equal(executeLinux(seed(),'hypothesis unknown high').ok,false);
  assert.equal(executeLinux(seed(),'hypothesis disk-pressure extreme').ok,false);
  assert.equal(executeLinux(seed(),'man hypothesis').ok,true);
});

test('four checkpoints require ordered review, assessment, copies, report and readback',()=>{
  const prefixes=[
    [],
    inspect,
    [...inspect,choice],
    [...inspect,choice,...copies],
    [...inspect,choice,...copies,...summary]
  ];
  const expected=[
    [false,false,false,false],
    [true,false,false,false],
    [true,true,false,false],
    [true,true,true,false],
    [true,true,true,true]
  ];
  prefixes.forEach((commands,i)=>{
    const {state,events}=run(commands);
    const p=hypothesisProgress(state,events);
    assert.deepEqual([p.examined,p.assessed,p.evidence,p.report],expected[i]);
    assert.equal(missions[17].success(state,events),i===4);
  });
});

test('correct resolution preserves full decisive logs and writes an ordered report',()=>{
  const original=seed(),{state,events}=solved();
  assert.ok(events.every(e=>e.ok));
  assert.equal(events.length,11);
  for(const path of [c.edge,c.auth,c.db,c.deploy,c.host])
    assert.equal(state.files[path],original.files[path]);
  assert.equal(state.files[c.dbEvidence],original.files[c.db]);
  assert.equal(state.files[c.deployEvidence],original.files[c.deploy]);
  assert.equal(state.files[c.report],
    '02:12 CHANGE POOL_LIMIT_REDUCED from=8 to=1\n'+
    '02:14 ERROR POOL_EXHAUSTED waiting_for_connection\n');
  assert.equal(hypothesisProgress(state,events).completed,true);
});

test('fake report, pre-assessment backup, missing cat, and reversed evidence fail',()=>{
  const noCopy=run([...inspect,choice,...summary]);
  assert.equal(hypothesisProgress(noCopy.state,noCopy.events).evidence,false);
  const premature=run([...inspect,...copies,choice,...summary]);
  assert.equal(hypothesisProgress(premature.state,premature.events).evidence,false);
  const unread=run([...inspect,choice,...copies,...summary.slice(0,2)]);
  assert.equal(hypothesisProgress(unread.state,unread.events).report,false);
  const reverse=run([...inspect,choice,...copies,
    'grep POOL_EXHAUSTED '+c.db+' > '+c.report,
    'grep POOL_LIMIT_REDUCED '+c.deploy+' >> '+c.report,
    'cat '+c.report
  ]);
  assert.equal(hypothesisProgress(reverse.state,reverse.events).report,false);
});

test('tampered primary or decoy sources invalidate completion, even if report exists',()=>{
  const q=solved();
  const tampered={...q.state,files:{...q.state.files,[c.auth]:'FORGED'}};
  assert.equal(hypothesisProgress(tampered,q.events).completed,false);
  const rights={...q.state,permissions:{...q.state.permissions,[c.db]:0o777}};
  assert.equal(hypothesisProgress(rights,q.events).completed,false);
  assert.equal(hypothesisProgress(q.state,[]).completed,false);
});

test('legacy state with no exit code can enter and complete mission 18',()=>{
  const old=initialLinux();
  delete old.lastExitCode;
  const q=run([...inspect,choice,...copies,...summary],seedHypothesisCase(old));
  assert.equal(hypothesisProgress(q.state,q.events).completed,true);
});
