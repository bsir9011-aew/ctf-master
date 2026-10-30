import test from 'node:test';
import assert from 'node:assert/strict';
import {executeLinux} from '../src/core/linux.ts';
import {createAcademyState,academySubmit} from '../src/core/commandAcademy.ts';
import {createTransferState,submitTransfer,transferMistake} from '../src/core/academyTransfer.ts';
import {redirectionCompleted,redirectionCase} from '../src/core/redirection.ts';

const run=(state,raw)=>executeLinux(state,raw);
const intro=redirectionCase('intro'),transfer=redirectionCase('transfer');

test('> creates a file with umask and owner, >> appends without changing source',()=>{
  const original=createAcademyState(),snapshot=structuredClone(original);
  const first=run(original,'grep WARN ~/practice/alerts.log > ~/practice/alerts-summary.log');
  assert.equal(first.ok,true);
  assert.equal(first.output,'');
  assert.equal(first.command,'redirect');
  assert.equal(first.redirectMode,'overwrite');
  assert.equal(first.state.files[intro.target],intro.warning);
  assert.equal(first.state.permissions[intro.target],0o644);
  assert.deepEqual(first.state.ownership[intro.target],{uid:1000,gid:1000});
  const next=run(first.state,'grep INFO ~/practice/alerts.log >> ~/practice/alerts-summary.log');
  assert.equal(next.ok,true);
  assert.equal(next.redirectMode,'append');
  assert.equal(next.state.files[intro.target],intro.warning+intro.rest);
  assert.equal(next.state.files[intro.source],intro.original);
  assert.deepEqual(original,snapshot);
});

test('> overwrites an existing file, not just appends',()=>{
  const first=run(createAcademyState(),'grep WARN ~/practice/alerts.log > ~/practice/alerts-summary.log');
  const second=run(first.state,'grep INFO ~/practice/alerts.log > ~/practice/alerts-summary.log');
  assert.equal(second.ok,true);
  assert.equal(second.state.files[intro.target],intro.rest);
  assert.equal(second.state.permissions[intro.target],0o644);
});

test('redirect accepts read-only pipeline output',()=>{
  const original=createAcademyState();
  const result=run(original,'grep WARN ~/practice/alerts.log | sort | uniq | wc -l > ~/practice/count.txt');
  assert.equal(result.ok,true);
  assert.equal(result.state.files['/home/player/practice/count.txt'],'2\n');
  assert.equal(result.state.files[intro.source],intro.original);
});

test('cannot read unreadable file or write unwritable destination',()=>{
  const seed=createAcademyState();
  const blocked=run(seed,'chmod 000 ~/practice/alerts.log');
  const rejected=run(blocked.state,'cat ~/practice/alerts.log > ~/practice/new.txt');
  assert.equal(rejected.ok,false);
  assert.equal(rejected.state.files['/home/player/practice/new.txt'],undefined);
  const protectedFile=run(seed,'chmod 444 ~/practice/source.txt');
  const noOverwrite=run(protectedFile.state,'grep WARN ~/practice/alerts.log > ~/practice/source.txt');
  assert.equal(noOverwrite.ok,false);
  assert.equal(noOverwrite.state.files['/home/player/practice/source.txt'],'COPY_ME');
});

test('cannot create under read-only directory or overwrite directory',()=>{
  const seed=createAcademyState();
  const blocked=run(seed,'chmod 500 ~/practice/logs');
  assert.equal(run(blocked.state,'pwd > ~/practice/logs/new.txt').ok,false);
  const r=run(seed,'pwd > ~/practice/logs');
  assert.equal(r.ok,false);
});

test('no host shell, side-effecting sources, input redirection or extra targets',()=>{
  const state=createAcademyState(),snapshot=structuredClone(state);
  for(const raw of [
    'rm ~/practice/source.txt > ~/practice/no.txt',
    'touch ~/practice/foo > ~/practice/no.txt',
    'echo x > ~/practice/no.txt',
    'cat ~/practice/source.txt >',
    'cat ~/practice/source.txt > ~/practice/a.txt > ~/practice/b.txt',
    'cat ~/practice/source.txt > ~/practice/a.txt; rm ~/practice/source.txt',
    'cat ~/practice/source.txt > ~/practice/a.txt | sort'
  ]) {
    const r=run(state,raw);
    assert.equal(r.ok,false,raw);
    assert.deepEqual(r.state,snapshot,raw);
  }
});

test('quoted > is not treated as shell syntax in a grep literal',()=>{
  const state=createAcademyState();
  const before=structuredClone(state);
  const r=run(state,'grep "alpha>beta" ~/practice/events.log');
  assert.equal(r.command,'grep');
  assert.equal(r.ok,false);
  assert.deepEqual(state,before);
});

test('self-redirection does not destroy a source log',()=>{
  const state=createAcademyState();
  const r=run(state,'cat ~/practice/alerts.log > ~/practice/alerts.log');
  assert.equal(r.ok,false);
  assert.equal(r.state.files[intro.source],intro.original);
});

test('academy requires overwrite, append and an independent readback',()=>{
  let result=academySubmit(createAcademyState(),[],
    'grep WARN ~/practice/alerts.log > ~/practice/alerts-summary.log','redirect');
  assert.equal(result.completed,false);
  result=academySubmit(result.result.state,result.events,
    'grep INFO ~/practice/alerts.log >> ~/practice/alerts-summary.log','redirect');
  assert.equal(result.completed,false);
  result=academySubmit(result.result.state,result.events,
    'cat ~/practice/alerts-summary.log','redirect');
  assert.equal(result.completed,true);
  assert.equal(redirectionCompleted('intro',result.result.state,result.events),true);
});

test('transfer is different and wrong successful redirections lower mastery',()=>{
  let result=submitTransfer(createTransferState('redirect'),[],
    'grep ERROR ~/practice/logs/incidents.log > ~/practice/not-target.txt','redirect');
  assert.equal(result.result.ok,true);
  assert.equal(transferMistake('redirect',result.result,result.completed),true);
  result=submitTransfer(result.result.state,result.events,
    'grep ERROR ~/practice/logs/incidents.log > ~/practice/incidents-summary.log','redirect');
  assert.equal(result.completed,false);
  assert.equal(transferMistake('redirect',result.result,result.completed),false);
  result=submitTransfer(result.result.state,result.events,
    'grep INFO ~/practice/logs/incidents.log >> ~/practice/incidents-summary.log','redirect');
  assert.equal(result.completed,false);
  result=submitTransfer(result.result.state,result.events,
    'cat ~/practice/incidents-summary.log','redirect');
  assert.equal(result.completed,true);
  assert.equal(result.result.state.files[transfer.target],transfer.warning+transfer.rest);
});
