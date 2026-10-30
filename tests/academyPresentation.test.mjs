import test from 'node:test';
import assert from 'node:assert/strict';
import { academyTerminalHeight, needsRecommendation } from '../src/core/academyPresentation.ts';

test('fresh academy terminal is compact instead of a large empty panel',()=>{
  assert.equal(academyTerminalHeight([]),154);
  assert.equal(academyTerminalHeight([{output:'Start'}]),154);
});

test('terminal height expands with history but is capped for long outputs',()=>{
  const short=[{input:'$ pwd',output:'/home/player'},{input:'$ ls',output:'a\nb\nc\nd'}];
  assert.ok(academyTerminalHeight(short)>154);
  assert.equal(academyTerminalHeight(Array.from({length:40},()=>({input:'$ ls',output:'lots\nof\nlines'}))),312);
});

test('recommendation is hidden when it merely repeats the current task',()=>{
  const next={lessonId:'pwd',phase:'intro',reason:'Start here',score:50};
  assert.equal(needsRecommendation(next,'pwd'),false);
  assert.equal(needsRecommendation(next,'pwd'),false);
  assert.equal(needsRecommendation(next,'ls'),true);
  assert.equal(needsRecommendation(null,'pwd'),false);
});

test('same-lesson transfer is available in the lesson card, not repeated above it',()=>{
  assert.equal(needsRecommendation({lessonId:'cp',phase:'transfer',reason:'Verify',score:100},'cp'),false);
  assert.equal(needsRecommendation({lessonId:'cp',phase:'transfer',reason:'Verify',score:100},'pwd'),true);
});
