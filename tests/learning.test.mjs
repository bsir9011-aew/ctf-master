import test from 'node:test';
import assert from 'node:assert/strict';
import { executeLinux, initialLinux } from '../src/core/linux.ts';
import { missions } from '../src/core/missions.ts';
import { explainError, restoreLearning, revealHint, trackCommand } from '../src/core/learning.ts';

const id = 'transfer-investigation';

test('old or broken progress objects restore to safe values', () => {
  assert.deepEqual(restoreLearning(undefined), {});
  assert.deepEqual(restoreLearning([]), {});
  const result = restoreLearning({alpha:{commands:-5, errors:2, hints:99, usedHelp:'yes', independent:true}, bad:'broken'});
  assert.deepEqual(result.alpha, {commands:0, errors:2, hints:3, usedHelp:false, independent:true});
  assert.equal(Object.hasOwn(result, 'bad'), false);
});

test('first flawless completion is recorded as independent', () => {
  const good = executeLinux(initialLinux(), 'pwd');
  const result = trackCommand({}, id, good, true)[id];
  assert.deepEqual(result, {commands:1, errors:0, hints:0, usedHelp:false, independent:true});
});

test('failed attempts or a revealed hint prevent first-solve independence', () => {
  const failed = executeLinux(initialLinux(), 'cd missing');
  const good = executeLinux(initialLinux(), 'pwd');
  const errors = trackCommand({}, id, failed, false);
  assert.equal(trackCommand(errors, id, good, true)[id].independent, false);
  const hint = revealHint({}, id);
  assert.equal(trackCommand(hint, id, good, true)[id].independent, false);
});

test('help counts as assistance but not a mission command', () => {
  const assist = executeLinux(initialLinux(), 'help');
  const afterHelp = trackCommand({}, id, assist, false);
  assert.equal(afterHelp[id].commands, 0);
  assert.equal(afterHelp[id].usedHelp, true);
  const good = executeLinux(initialLinux(), 'pwd');
  assert.equal(trackCommand(afterHelp, id, good, true)[id].independent, false);
});

test('hints are capped and preserved alongside command counters', () => {
  let record = {};
  for (let i = 0; i < 6; i++) record = revealHint(record, id);
  assert.equal(record[id].hints, 3);
  const bad = executeLinux(initialLinux(), 'grep missing /var/log/app.log');
  const updated = trackCommand(record, id, bad, false);
  assert.equal(updated[id].hints, 3);
  assert.equal(updated[id].errors, 1);
});

test('coaching classifies errors without suggesting complete solutions', () => {
  const wrongPath = explainError(executeLinux(initialLinux(), 'cd nowhere'));
  const unknown = explainError(executeLinux(initialLinux(), 'not-a-command'));
  const noMatch = explainError(executeLinux(initialLinux(), 'grep nonexistent /var/log/app.log'));
  assert.match(wrongPath.guidance, /pwd/);
  assert.match(unknown.guidance, /Bash/);
  assert.match(noMatch.guidance, /-i/);
  assert.equal(explainError(executeLinux(initialLinux(), 'pwd')), null);
});

test('transfer mission requires both investigation and an intact copy', () => {
  const mission = missions.find(m => m.id === id);
  assert.ok(mission);
  let state = initialLinux();
  let events = [];
  for (const cmd of ['grep ALERT /var/log/app.log', 'cp /var/log/app.log ~/documents/app-evidence.log']) {
    const output = executeLinux(state, cmd);
    state = output.state;
    events = [...events, output];
  }
  assert.equal(mission.success(state, events), true);
  assert.equal(mission.success(state, events.slice(1)), false);
  assert.equal(mission.success(initialLinux(), events.slice(0, 1)), false);
  const tampered = {...state, files:{...state.files, '/home/player/documents/app-evidence.log':'modified'}};
  assert.equal(mission.success(tampered, events), false);
});
