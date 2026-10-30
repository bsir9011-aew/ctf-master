import test from 'node:test';
import assert from 'node:assert/strict';
import {scanShell,tokenizeShellWords} from '../src/core/shellSyntax.ts';
import {splitPipeline} from '../src/core/pipelines.ts';
import {parseRedirection} from '../src/core/redirection.ts';
import {executeLinux} from '../src/core/linux.ts';
import {createAcademyState,academySubmit,commandLessons} from '../src/core/commandAcademy.ts';
import {createTransferState,submitTransfer,transferChallenges,transferMistake} from '../src/core/academyTransfer.ts';
import {quotingCase,quotingCompleted} from '../src/core/quoting.ts';

const run=(state,raw)=>executeLinux(state,raw);

test('lexer joins adjacent quoted and unquoted pieces into one argument',()=>{
  assert.deepEqual(tokenizeShellWords('cat ~/practice/"report "draft.txt'),
    ['cat','~/practice/report draft.txt']);
  assert.deepEqual(tokenizeShellWords("mv 'one two' three\\ four"),
    ['mv','one two','three four']);
  assert.deepEqual(tokenizeShellWords('cat ""'),['cat','']);
  assert.deepEqual(tokenizeShellWords("cat 'path\\name'"),['cat','path\\name']);
});

test('only unquoted/unescaped pipe and redirect are operators',()=>{
  const raw='grep "WARN|INFO" a\\>b.txt | sort > "my|report>notes.txt"';
  const scanned=scanShell(raw);
  assert.deepEqual(scanned.filter(t=>t.kind!=='word').map(t=>t.kind),
    ['pipe','overwrite']);
  assert.deepEqual(splitPipeline('cat "p|q" | wc -l'),
    ['cat "p|q"','wc -l']);
  assert.deepEqual(splitPipeline('cat p\\|q'),['cat p\\|q']);
  assert.equal(parseRedirection('grep "a>b" file.txt'),undefined);
  assert.equal(parseRedirection('cat a\\>b.txt'),undefined);
  assert.deepEqual(parseRedirection('cat x > out'),{source:'cat x',destination:'out',mode:'overwrite'});
});

test('malformed quoting, trailing escapes and unsupported shell separators fail closed',()=>{
  const original=createAcademyState(),snapshot=structuredClone(original);
  for(const cmd of [
    'touch "~/practice/missing',
    "cat '~/practice/x",
    'touch ~/practice/unfinished\\',
    'touch ~/practice/a.txt; rm ~/practice/source.txt',
    'touch ~/practice/a.txt && rm ~/practice/source.txt',
    'cat ~/practice/alerts.log < ~/practice/source.txt',
    'cat ~/practice/alerts.log > "~/practice/unfinished',
    'cat ~/practice/alerts.log > a > b'
  ]){
    const r=run(original,cmd);
    assert.equal(r.ok,false,cmd);
    assert.deepEqual(r.state,snapshot,cmd);
  }
  assert.deepEqual(original,snapshot);
});

test('quoted or escaped filenames containing | and > never create shell stages',()=>{
  const first=run(createAcademyState(),'touch ~/practice/pipe\\|name.txt');
  assert.equal(first.ok,true);
  const second=run(first.state,'touch ~/practice/arrow\\>name.txt');
  assert.equal(second.ok,true);
  assert.ok(Object.hasOwn(second.state.files,'/home/player/practice/pipe|name.txt'));
  assert.ok(Object.hasOwn(second.state.files,'/home/player/practice/arrow>name.txt'));
  assert.equal(run(second.state,'ls "~/practice/pipe|name.txt"').ok,true);
  assert.equal(run(second.state,"ls '~/practice/arrow>name.txt'").ok,true);
});

test('quoted filename and literal text with a pipe work in a real read-only pipeline',()=>{
  const state=createAcademyState();
  const path='/home/player/practice/audit trail.log';
  const seed={...state,files:{...state.files,[path]:'INFO boot\nWARN|INFO combined\n'}};
  const result=run(seed,'grep "WARN|INFO" "~/practice/audit trail.log" | wc -l');
  assert.equal(result.ok,true);
  assert.equal(result.command,'pipeline');
  assert.equal(result.output,'1');
  assert.equal(seed.files[path],'INFO boot\nWARN|INFO combined\n');
});

test('quoted destination of a pipeline redirection works with > in its name',()=>{
  const state=createAcademyState();
  const cmd='grep WARN ~/practice/alerts.log | sort | uniq | wc -l > "~/practice/unique > count.txt"';
  const r=run(state,cmd);
  assert.equal(r.ok,true);
  assert.equal(r.command,'redirect');
  assert.equal(r.state.files['/home/player/practice/unique > count.txt'],'2\n');
});

test('single quotes are literal while double quotes can escape embedded quotes',()=>{
  const state=createAcademyState();
  const a=run(state,"touch '~/practice/a\\b.txt'");
  assert.equal(a.ok,true);
  assert.ok(Object.hasOwn(a.state.files,'/home/player/practice/a\\b.txt'));
  const b=run(a.state,'touch "~/practice/hello\\"world.txt"');
  assert.equal(b.ok,true);
  assert.ok(Object.hasOwn(b.state.files,'/home/player/practice/hello"world.txt'));
});

test('educational shell does not evaluate command substitution or interpolate variables',()=>{
  const state=createAcademyState();
  const result=run(state,'touch "~/practice/$(whoami).txt"');
  assert.equal(result.ok,true);
  assert.ok(Object.hasOwn(result.state.files,'/home/player/practice/$(whoami).txt'));
});

test('quote mastery requires a real move followed by readback',()=>{
  const target=quotingCase('intro');
  let r=academySubmit(createAcademyState(),[],
    'mv "~/practice/report draft.txt" ~/practice/final\\ report.txt','quoting');
  assert.equal(r.result.ok,true);
  assert.equal(r.completed,false);
  assert.equal(r.result.state.files[target.source],undefined);
  r=academySubmit(r.result.state,r.events,
    "cat '~/practice/final report.txt'",'quoting');
  assert.equal(r.completed,true);
  assert.equal(quotingCompleted('intro',r.result.state,r.events),true);
});

test('transfer has distinct filenames and successful wrong move counts as mistake',()=>{
  const q=quotingCase('transfer');
  let r=submitTransfer(createTransferState('quoting'),[],
    'mv ~/practice/source.txt "~/practice/logs/wrong file.txt"','quoting');
  assert.equal(r.result.ok,true);
  assert.equal(transferMistake('quoting',r.result,r.completed),true);
  r=submitTransfer(r.result.state,r.events,
    'mv "~/practice/logs/audit notes.txt" "~/practice/logs/incident notes.txt"','quoting');
  assert.equal(r.result.ok,true);
  assert.equal(transferMistake('quoting',r.result,r.completed),false);
  r=submitTransfer(r.result.state,r.events,
    'cat ~/practice/logs/incident\\ notes.txt','quoting');
  assert.equal(r.completed,true);
  assert.equal(r.result.state.files[q.target],q.content);
});

test('catalogues add exactly one independent lesson and transfer each',()=>{
  assert.equal(commandLessons.length,30);
  assert.equal(transferChallenges.length,30);
  assert.deepEqual(transferChallenges.map(x=>x.lessonId),commandLessons.map(x=>x.id));
});
