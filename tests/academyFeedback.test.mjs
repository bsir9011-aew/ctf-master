import {assertWorldUnchanged} from './assertWorldUnchanged.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { academySubmit,createAcademyState } from '../src/core/commandAcademy.ts';
import { createTransferState, submitTransfer } from '../src/core/academyTransfer.ts';
import { executeLinux } from '../src/core/linux.ts';
import { explainAcademyAttempt } from '../src/core/academyFeedback.ts';

function attempt(id,command){
  const state=createAcademyState();
  const result=academySubmit(state,[],command,id);
  return {result,...explainAcademyAttempt(id,state,result.result,result.completed)};
}
function transfer(id,command){
  const state=createTransferState(id);
  const result=submitTransfer(state,[],command,id);
  return {result,...explainAcademyAttempt(id,state,result.result,result.completed)};
}

test('ls distinguishes listing the wrong existing directory from completion',()=>{
  const wrong=attempt('ls','ls ~/documents');
  assert.equal(wrong.result.result.ok,true);
  assert.equal(wrong.result.completed,false);
  assert.equal(wrong.status,'partial');
  assert.match(wrong.detail,/nie przeszedł do niego/);
  assert.doesNotMatch(wrong.detail,/~/);
  const right=attempt('ls','ls ~/practice');
  assert.equal(right.status,'complete');
  assert.match(right.title,/zaliczone/);
});

test('ls listing a file is not confused with listing a directory',()=>{
  const item=attempt('ls','ls ~/practice/intro.txt');
  assert.equal(item.status,'partial');
  assert.match(item.detail,/nazwę wskazanego pliku/);
});

test('ls missing path and bad option have distinct actionable feedback',()=>{
  const absent=attempt('ls','ls ~/practice/nonexistent');
  assert.equal(absent.status,'error');
  assert.match(absent.detail,/względna czy bezwzględna/);
  const option=attempt('ls','ls -z ~/practice');
  assert.equal(option.status,'error');
  assert.match(option.detail,/-a/);
});

test('cd recognizes attempted entry into a file instead of misreporting missing directory',()=>{
  const state=createAcademyState();
  const result=executeLinux(state,'cd ~/practice/intro.txt');
  assert.equal(result.ok,false);
  assert.match(result.output,/Not a directory/);
  assertWorldUnchanged(result.state,state);
  const feedback=explainAcademyAttempt('cd',state,result,false);
  assert.equal(feedback.status,'error');
  assert.match(feedback.title,/wymaga katalogu/);
});

test('cd nonexistent directory describes paths without solving the assignment',()=>{
  const bad=attempt('cd','cd ~/practice/nothing');
  assert.equal(bad.status,'error');
  assert.match(bad.detail,/\.\./);
  assert.doesNotMatch(bad.detail,/cd ~\/practice$/);
});

test('cd may succeed yet fail the current lesson, and returns actual cwd',()=>{
  const partial=attempt('cd','cd ~/documents');
  assert.equal(partial.status,'partial');
  assert.match(partial.detail,/\/home\/player\/documents/);
  const success=attempt('cd','cd ~/practice');
  assert.equal(success.status,'complete');
  assert.match(success.detail,/pwd/);
});

test('grep no match teaches case sensitivity instead of saying file is missing',()=>{
  const bad=attempt('grep','grep warn ~/practice/events.log');
  assert.equal(bad.status,'error');
  assert.match(bad.title,/nie znalazł pasującego wiersza/);
  assert.match(bad.detail,/-i/);
});

test('grep with missing file, bad syntax and a wrong valid file are different cases',()=>{
  const missing=attempt('grep','grep WARN ~/practice/not-exists.log');
  assert.equal(missing.status,'error');
  assert.match(missing.detail,/find/);
  const syntax=attempt('grep','grep WARN');
  assert.equal(syntax.status,'error');
  assert.match(syntax.detail,/Pierwszy argument/);
  const wrong=attempt('grep','grep INFO ~/practice/events.log');
  assert.equal(wrong.status,'partial');
  assert.match(wrong.detail,/pasujące wiersze/);
});

test('grep valid solution explains matching lines and no mutations',()=>{
  const result=attempt('grep','grep -i warn ~/practice/events.log');
  assert.equal(result.status,'complete');
  assert.match(result.detail,/1 pasujący wiersz/);
  assert.match(result.detail,/niczego w pliku nie zmienia/);
});

test('the transfer drill reveals observations, not any unseen expected path',()=>{
  const ls=transfer('ls','ls ~/documents');
  assert.equal(ls.status,'partial');
  assert.doesNotMatch(ls.detail,/audit-67/);
  const cd=transfer('cd','cd ~/documents');
  assert.equal(cd.status,'partial');
  assert.doesNotMatch(cd.detail,/\/practice\/logs/);
  const grep=transfer('grep','grep WARN ~/practice/events.log');
  assert.equal(grep.status,'partial');
  assert.doesNotMatch(grep.detail,/INFO sync complete/);
});

test('generic command feedback remains available for lessons outside the first three',()=>{
  const result=attempt('mkdir','mkdir ~/practice/new-folder');
  assert.equal(result.status,'partial');
  assert.match(result.detail,/Polecenie zadziałało/);
  const invalid=attempt('mkdir','mkdir ~/missing/another');
  assert.equal(invalid.status,'error');
  assert.ok(invalid.detail.length>20);
});

test('all insights are pure and do not mutate the actual Linux state or mastery flags',()=>{
  const state=createAcademyState();
  const original=structuredClone(state);
  const result=executeLinux(state,'ls ~/practice');
  const insight=explainAcademyAttempt('ls',state,result,false);
  assert.equal(insight.status,'partial');
  assert.deepEqual(state,original);
  assert.deepEqual(result.state,original);
});
