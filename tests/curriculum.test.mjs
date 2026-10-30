import test from 'node:test';
import assert from 'node:assert/strict';
import { missions } from '../src/core/missions.ts';
import { getCurriculum, learningChapters } from '../src/core/curriculum.ts';

const allIds=missions.map(m=>m.id);
const show=(completed,unlocked) => getCurriculum(allIds,completed,unlocked);

test('six chapters cover each real mission exactly once and in learning order',()=>{
  assert.equal(learningChapters.length,6);
  const listed=learningChapters.flatMap(x=>x.missionIds);
  assert.equal(listed.length,missions.length);
  assert.deepEqual(listed,allIds);
  assert.equal(new Set(listed).size,missions.length);
  for(const chapter of learningChapters) {
    assert.ok(chapter.title && chapter.purpose && chapter.commands && chapter.outcome);
  }
});

test('new player sees one available chapter; later chapters remain locked',()=>{
  const chapters=show([],0);
  assert.deepEqual(chapters.map(x=>x.status),
    ['available','locked','locked','locked','locked','locked']);
  assert.deepEqual(chapters.map(x=>x.completedCount),[0,0,0,0,0,0]);
  assert.equal(chapters[0].recommendedIndex,0);
  for(const chapter of chapters.slice(1)) assert.equal(chapter.recommendedIndex,null);
});

test('finishing the first three missions opens investigation, not permissions',()=>{
  const chapters=show(allIds.slice(0,3),3);
  assert.deepEqual(chapters.map(x=>x.status),
    ['completed','available','locked','locked','locked','locked']);
  assert.equal(chapters[0].completedCount,3);
  assert.equal(chapters[1].recommendedIndex,3);
  assert.equal(chapters[2].recommendedIndex,null);
});

test('incomplete chapter recommends its first unlocked and uncompleted mission',()=>{
  const chapters=show(allIds.slice(0,5),5);
  assert.equal(chapters[1].completedCount,2);
  assert.equal(chapters[1].missionCount,5);
  assert.equal(chapters[1].recommendedIndex,5);
  assert.equal(chapters[2].status,'locked');
});

test('advancing into network does not mark its later tasks complete',()=>{
  const chapters=show(allIds.slice(0,14),14);
  assert.deepEqual(chapters.map(x=>x.status),
    ['completed','completed','completed','completed','available','locked']);
  assert.equal(chapters[4].completedCount,2);
  assert.equal(chapters[4].recommendedIndex,14);
});

test('all successful mission ids mark all chapters complete',()=>{
  const chapters=show(allIds,allIds.length-1);
  assert.ok(chapters.every(x=>x.status==='completed'));
  assert.equal(chapters.reduce((sum,c)=>sum+c.completedCount,0),20);
  assert.equal(chapters[4].recommendedIndex,12);
});

test('inconsistent progress cannot unlock mission buttons on the roadmap',()=>{
  const chapters=show(['gateway-repair'],0);
  assert.equal(chapters[4].status,'locked');
  assert.equal(chapters[4].completedCount,1);
  assert.equal(chapters[4].recommendedIndex,null);
});
