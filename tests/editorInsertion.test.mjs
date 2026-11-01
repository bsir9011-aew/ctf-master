import test from 'node:test';
import assert from 'node:assert/strict';
import {insertAtSelection} from '../src/core/editorInsertion.ts';
import {WORKSHOP_MAX_CHARS,runWorkshop} from '../src/core/bashWorkshop.ts';

test('toolbar inserts special Bash characters at cursor rather than at end',()=>{
  const base='echo FILE';
  const dollar=insertAtSelection(base,'$',5,5,WORKSHOP_MAX_CHARS);
  assert.deepEqual(dollar,{value:'echo $FILE',cursor:6});
  const quoted=insertAtSelection(dollar.value,'"',5,5,WORKSHOP_MAX_CHARS);
  assert.deepEqual(quoted,{value:'echo "$FILE',cursor:6});
  const condition=insertAtSelection('test -f file test -f copy',' && ',12,12,WORKSHOP_MAX_CHARS);
  assert.equal(condition.value,'test -f file &&  test -f copy');
  assert.equal(condition.cursor,16);
});

test('mobile || shortcut inserts OR fallback at caret',()=>{
  const line='test -f missing test -f backup';
  const insert=insertAtSelection(line,'||',15,15,WORKSHOP_MAX_CHARS);
  assert.equal(insert.value,'test -f missing|| test -f backup');
  assert.equal(insert.cursor,17);
});

test('toolbar replaces selected text and leaves surrounding script untouched',()=>{
  const source='for FILE in ...; do ...; done';
  const start=source.indexOf('...');
  const result=insertAtSelection(source,'"$FILE"',start,start+3,WORKSHOP_MAX_CHARS);
  assert.equal(result.value,'for FILE in "$FILE"; do ...; done');
  assert.equal(result.cursor,start+7);
  assert.equal(source,'for FILE in ...; do ...; done');
});

test('newline insertion adds one real script line at caret',()=>{
  const result=insertAtSelection('BASE=~/practicefor FILE','\n',15,15,WORKSHOP_MAX_CHARS);
  assert.equal(result.value,'BASE=~/practice\nfor FILE');
  assert.equal(result.cursor,16);
});

test('replacement works at exact max length; overflow does not modify draft',()=>{
  const text='a'.repeat(WORKSHOP_MAX_CHARS);
  assert.equal(insertAtSelection(text,'$',text.length,text.length,WORKSHOP_MAX_CHARS),null);
  const replaced=insertAtSelection(text,'&&',0,2,WORKSHOP_MAX_CHARS);
  assert.equal(replaced.value.length,WORKSHOP_MAX_CHARS);
  assert.equal(replaced.cursor,2);
  assert.equal(insertAtSelection('',"'",0,0,WORKSHOP_MAX_CHARS)?.value,"'");
});

test('invalid cursor positions and malformed inputs are rejected, not silently appended',()=>{
  const attempts=[[-1,0],[4,3],[0,4],[NaN,0],[1.25,2],[Infinity,2]];
  for(const [start,end] of attempts)
    assert.equal(insertAtSelection('abc','$ ',start,end,WORKSHOP_MAX_CHARS),null);
  assert.equal(insertAtSelection('abc','',1,1,WORKSHOP_MAX_CHARS),null);
  assert.equal(insertAtSelection('abc','$ ',1,1,-1),null);
});

test('UTF-16 selection offsets match browser textarea selectionStart for emoji',()=>{
  const original='ok 🐧 done';
  const index=original.indexOf(' done');
  const result=insertAtSelection(original,' &&',index,index,WORKSHOP_MAX_CHARS);
  assert.equal(result.value,'ok 🐧 && done');
  assert.equal(result.cursor,index+3);
});

test('editing Bash symbols changes only the draft, not the virtual executor',()=>{
  const initial='BASE=~/practice\nfor FILE in ...; do ...; done';
  const next=insertAtSelection(initial,'$',initial.indexOf('...'),initial.indexOf('...'),700);
  assert.equal(next.value.includes('$...'),true);
  const run=runWorkshop(next.value);
  assert.equal(run.completed,false);
  assert.equal(run.state.files['/home/player/practice/events.log.copy'],undefined);
});
