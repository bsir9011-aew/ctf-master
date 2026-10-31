import test from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyUndoHistory,recordEditorEdit,undoEditorEdit,UNDO_LIMIT
} from '../src/core/editorUndo.ts';

const snapshot=(value,start=value.length,end=start)=>({value,start,end});
const add=(history,before,after,kind='typing',at=1000)=>
  recordEditorEdit(history,before,after,kind,at);

test('undo restores the exact content and selection replaced by a Bash shortcut',()=>{
  const initial=snapshot('for FILE in ...; do cp a b; done',12,15);
  const replaced=snapshot('for FILE in $FILE; do cp a b; done',17);
  const history=add(emptyUndoHistory(),initial,replaced,'shortcut');
  const reverted=undoEditorEdit(history);
  assert.deepEqual(reverted.snapshot,initial);
  assert.equal(reverted.history.past.length,0);
  assert.equal(undoEditorEdit(reverted.history),null);
});

test('nearby contiguous typing edits are grouped into one undo checkpoint',()=>{
  let history=emptyUndoHistory();
  history=add(history,snapshot('B'),snapshot('BA'),'typing',1000);
  history=add(history,snapshot('BA'),snapshot('BAS'),'typing',1050);
  history=add(history,snapshot('BAS'),snapshot('BASE'),'typing',1200);
  assert.equal(history.past.length,1);
  assert.equal(undoEditorEdit(history).snapshot.value,'B');
});

test('pause and caret movement force separate undo checkpoints',()=>{
  let history=emptyUndoHistory();
  history=add(history,snapshot('A'),snapshot('AB'),'typing',1000);
  history=add(history,snapshot('AB'),snapshot('ABC'),'typing',2500);
  assert.equal(history.past.length,2);
  history=add(history,snapshot('ABC',1),snapshot('AXBC',2),'typing',2510);
  assert.equal(history.past.length,3);
  const undo=undoEditorEdit(history);
  assert.equal(undo.snapshot.value,'ABC');
  assert.equal(undo.snapshot.start,1);
});

test('shortcuts and reset always record independent undo points',()=>{
  const first=snapshot('BASE=~/practice');
  const dollar=snapshot('BASE=~/practice$',16);
  const template=snapshot('for FILE in ...; do ...; done');
  let history=add(emptyUndoHistory(),first,dollar,'shortcut',1000);
  history=add(history,dollar,template,'reset',1050);
  assert.equal(history.past.length,2);
  const undone=undoEditorEdit(history);
  assert.equal(undone.snapshot.value,dollar.value);
  assert.equal(undoEditorEdit(undone.history).snapshot.value,first.value);
});

test('long paste does not merge with nearby mobile typing',()=>{
  let history=add(emptyUndoHistory(),snapshot('echo'),snapshot('echo '),'typing',1000);
  history=add(history,snapshot('echo '),snapshot('echo very long pasted command'),'typing',1050);
  assert.equal(history.past.length,2);
  const revert=undoEditorEdit(history);
  assert.equal(revert.snapshot.value,'echo ');
});

test('history bounded at 20 and never reaches into persisted draft or runtime',()=>{
  let history=emptyUndoHistory();
  for(let i=0;i<UNDO_LIMIT+12;i++){
    const before=snapshot('change '+i);
    const after=snapshot('next '+i);
    history=add(history,before,after,'shortcut',1000+i);
  }
  assert.equal(history.past.length,UNDO_LIMIT);
  assert.equal(undoEditorEdit(history).snapshot.value,'change '+(UNDO_LIMIT+11));
  let result=history;
  let count=0;
  while(undoEditorEdit(result)){result=undoEditorEdit(result).history;count++;}
  assert.equal(count,UNDO_LIMIT);
});

test('no-op and invalid time cannot silently destroy the last checkpoint',()=>{
  const initial=emptyUndoHistory();
  assert.equal(add(initial,snapshot('x'),snapshot('x'),'shortcut'),initial);
  let history=add(initial,snapshot('a'),snapshot('ab'),'typing',1000);
  history=add(history,snapshot('ab'),snapshot('abc'),'typing',900);
  assert.equal(history.past.length,2);
});
