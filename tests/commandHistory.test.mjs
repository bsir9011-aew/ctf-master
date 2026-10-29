import test from 'node:test';
import assert from 'node:assert/strict';
import {rememberCommand,moveHistoryCursor,HISTORY_LIMIT} from '../src/core/commandHistory.ts';

test('command history ignores blanks and trims whitespace',()=>{
  const initial=['pwd'];
  assert.equal(rememberCommand(initial,'   '),initial);
  assert.deepEqual(rememberCommand(initial,'  ls -a   '),['pwd','ls -a']);
});

test('repeating a command moves it to the latest position',()=>{
  assert.deepEqual(rememberCommand(['pwd','ls','cat notes.txt'],'ls'),['pwd','cat notes.txt','ls']);
});

test('command history is bounded to 30 items',()=>{
  let result=[];
  for(let i=0;i<100;i++) result=rememberCommand(result,'cmd-'+i);
  assert.equal(result.length,HISTORY_LIMIT);
  assert.equal(result[0],'cmd-70');
  assert.equal(result.at(-1),'cmd-99');
});

test('up and down traverse history without underflow or overflow',()=>{
  assert.equal(moveHistoryCursor(0,null,'older'),null);
  assert.equal(moveHistoryCursor(0,null,'newer'),null);
  assert.equal(moveHistoryCursor(3,null,'older'),2);
  assert.equal(moveHistoryCursor(3,2,'older'),1);
  assert.equal(moveHistoryCursor(3,0,'older'),0);
  assert.equal(moveHistoryCursor(3,1,'newer'),2);
  assert.equal(moveHistoryCursor(3,2,'newer'),null);
  assert.equal(moveHistoryCursor(3,null,'newer'),null);
});
