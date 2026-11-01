import test from 'node:test';
import assert from 'node:assert/strict';
import {fitWorkshopEditor} from '../src/core/workshopEditorSize.ts';

function fake(scrollHeight,border=2){
  const element={
    style:{height:'200px'},scrollHeight,
    offsetHeight:112,clientHeight:112-border
  };
  return element;
}

test('editor height follows wrapped content without inner vertical scroll',()=>{
  const el=fake(192);
  assert.equal(fitWorkshopEditor(el),194);
  assert.equal(el.style.height,'194px');
  assert.equal(fitWorkshopEditor(el),194);
});

test('height can shrink when switching between mobile drafts',()=>{
  const el=fake(310);
  assert.equal(fitWorkshopEditor(el),312);
  el.scrollHeight=54;
  assert.equal(fitWorkshopEditor(el),112);
  assert.equal(el.style.height,'112px');
});

test('zero and fractional border measurements never yield negative heights',()=>{
  const el=fake(0,0);
  assert.equal(fitWorkshopEditor(el),112);
  el.scrollHeight=120.2;
  assert.equal(fitWorkshopEditor(el),121);
});
