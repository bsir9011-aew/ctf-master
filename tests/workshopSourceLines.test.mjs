import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceLineRange,workshopSourceLines} from '../src/core/workshopSourceLines.ts';
import {runWorkshop} from '../src/core/bashWorkshop.ts';

const successful=[
  'BASE=~/practice',
  'for FILE in "$BASE/events.log" "$BASE/alerts.log"; do cp "$FILE" "$FILE.copy"; done',
  'test -f "$BASE/events.log.copy" && test -f "$BASE/alerts.log.copy"'
].join('\n');

test('line range selects exactly the physical source line, not the trimmed command index',()=>{
  const code='\n  BASE=~/practice  \n\n  for FILE in x; do cp "$FILE" "$FILE.copy"; done\n';
  const source=workshopSourceLines(code);
  assert.deepEqual(source.map(x=>x.line),[2,4]);
  assert.deepEqual(source.map(x=>x.raw),[
    'BASE=~/practice','for FILE in x; do cp "$FILE" "$FILE.copy"; done'
  ]);
  const a=sourceLineRange(code,2);
  assert.equal(code.slice(a.start,a.end),'BASE=~/practice');
  const b=sourceLineRange(code,4);
  assert.equal(code.slice(b.start,b.end),'for FILE in x; do cp "$FILE" "$FILE.copy"; done');
  assert.deepEqual(sourceLineRange(code,1),{start:0,end:0});
  assert.deepEqual(sourceLineRange(code,5),{start:code.length,end:code.length});
});

test('CRLF, tabs and UTF-16 cursor indices are mapped to original textarea offsets',()=>{
  const code='BASE=~/practice\r\n\t echo "🐧" \r\nbad';
  const lines=workshopSourceLines(code);
  assert.deepEqual(lines.map(x=>x.line),[1,2,3]);
  const line=sourceLineRange(code,2);
  assert.equal(code.slice(line.start,line.end),'echo "🐧"');
  assert.equal(line.start,code.indexOf('echo'));
  assert.equal(line.end,code.indexOf('\r\nbad')-1); // trailing space deliberately excluded
});

test('invalid indices cannot point at a wrong or missing line',()=>{
  const code='one\nsecond';
  for(const line of [-1,0,1.5,NaN,Infinity,3,10])
    assert.equal(sourceLineRange(code,line),null);
});

test('preflight highlights physical line and prevents all changes on bad syntax',()=>{
  const script='\nBASE=~/practice\n\nfor FILE in a b; do rm "$FILE"; done\n';
  const result=runWorkshop(script);
  assert.equal(result.completed,false);
  assert.equal(result.errorLine,4);
  assert.equal(result.steps.length,0);
  assert.equal(result.state.files['/home/player/practice/events.log.copy'],undefined);
  const range=sourceLineRange(script,result.errorLine);
  assert.match(script.slice(range.start,range.end),/^for FILE/);
});

test('runtime failure identifies exact line even after blank lines',()=>{
  const script='BASE=~/practice\n\nfor FILE in missing1 missing2; do cp "$FILE" "$FILE.copy"; done';
  const result=runWorkshop(script);
  assert.equal(result.completed,false);
  assert.equal(result.errorLine,3);
  assert.equal(result.steps.length,2);
  assert.equal(result.steps[1].line,3);
  assert.match(result.feedback,/Linia 3/);
});

test('semantic errors locate the assignment, loop or verification line when identifiable',()=>{
  const wrongBase=runWorkshop(successful.replace('BASE=~/practice','BASE=~/wrong'));
  // Runtime detects missing source in the loop, before semantic validation.
  assert.equal(wrongBase.errorLine,2);

  const noBase=runWorkshop(
    'for FILE in ~/practice/events.log ~/practice/alerts.log; do cp "$FILE" "$FILE.copy"; done');
  assert.equal(noBase.errorLine,undefined);
  assert.match(noBase.feedback,/BASE/);

  const noReference=runWorkshop([
    'BASE=~/practice',
    'for FILE in ~/practice/events.log ~/practice/alerts.log; do cp "$FILE" "$FILE.copy"; done',
    'test -f ~/practice/events.log.copy && test -f ~/practice/alerts.log.copy'
  ].join('\n'));
  assert.equal(noReference.errorLine,2);

  const noVerification=runWorkshop(successful.split('\n').slice(0,2).join('\n'));
  assert.equal(noVerification.errorLine,undefined);

  const incompleteCheck=runWorkshop(successful.replace(
    'test -f "$BASE/events.log.copy" && test -f "$BASE/alerts.log.copy"',
    'test -f "$BASE/events.log.copy"'
  ));
  assert.equal(incompleteCheck.errorLine,3);
});

test('too many nonblank lines points to fifth command, not fifth physical row',()=>{
  const script='A=1\n\nB=2\nC=3\nD=4\n\nE=5';
  const result=runWorkshop(script);
  assert.equal(result.errorLine,7);
  assert.equal(result.steps.length,0);
  assert.equal(script.slice(sourceLineRange(script,7).start),'E=5');
});

test('complete script has no error navigation target',()=>{
  const result=runWorkshop(successful);
  assert.equal(result.completed,true,result.feedback);
  assert.equal(result.errorLine,undefined);
  assert.deepEqual(result.steps.map(x=>x.line),[1,2,3]);
});
