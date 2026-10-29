import test from 'node:test';
import assert from 'node:assert/strict';
import { executeLinux, initialLinux, resolvePath } from '../src/core/linux.ts';
import { missions } from '../src/core/missions.ts';

function runSession(commands) {
  let state = initialLinux();
  const events = [];
  for (const cmd of commands) {
    const result = executeLinux(state, cmd);
    state = result.state;
    events.push(result);
  }
  return { state, events };
}

test('relative, absolute and home paths resolve consistently', () => {
  assert.equal(resolvePath('/home/player', '../other/./file'), '/home/other/file');
  assert.equal(resolvePath('/var', '~/notes.txt'), '/home/player/notes.txt');
});

test('pwd and whoami reveal the simulated user context', () => {
  const state = initialLinux();
  assert.equal(executeLinux(state, 'pwd').output, '/home/player');
  assert.equal(executeLinux(state, 'whoami').output, 'player');
});

test('mkdir, cd and touch change the virtual filesystem only', () => {
  const original = initialLinux();
  const { state } = runSession(['mkdir projekty', 'cd projekty', 'touch notes.txt']);
  assert.equal(state.cwd, '/home/player/projekty');
  assert.equal(state.files['/home/player/projekty/notes.txt'], '');
  assert.equal(original.dirs.includes('/home/player/projekty'), false);
});

test('cannot enter directories that do not exist', () => {
  const result = executeLinux(initialLinux(), 'cd missing');
  assert.equal(result.ok, false);
  assert.equal(result.state.cwd, '/home/player');
});

test('ls does not reveal hidden entries without -a', () => {
  const state = initialLinux();
  assert.doesNotMatch(executeLinux(state, 'ls').output, /\.vault/);
  assert.match(executeLinux(state, 'ls -al').output, /\.vault/);
  assert.match(executeLinux(state, 'ls -la').output, /\.vault/);
});

test('quoted file paths are supported', () => {
  const { state, events } = runSession(['touch "my notes.txt"', 'cat "my notes.txt"']);
  assert.equal(events.at(-1).ok, true);
  assert.equal(state.files['/home/player/my notes.txt'], '');
});

test('unsupported commands are rejected instead of executed', () => {
  for (const command of ['rm -rf /', 'uname -a', 'echo test > out.txt']) {
    const result = executeLinux(initialLinux(), command);
    assert.equal(result.ok, false, command);
  }
});

test('orientation mission requires both successful observations', () => {
  const { state, events } = runSession(['pwd', 'ls']);
  assert.equal(missions[0].success(state, events), true);
  assert.equal(missions[0].success(state, events.slice(0, 1)), false);
});

test('workspace mission verifies state and successful navigation', () => {
  const commands = ['mkdir projekty', 'cd projekty', 'touch notes.txt'];
  const { state, events } = runSession(commands);
  assert.equal(missions[1].success(state, events), true);
  const partial = runSession(commands.slice(0, 2));
  assert.equal(missions[1].success(partial.state, partial.events), false);
});

test('hidden flag mission requires reading the actual file', () => {
  const commands = ['ls -a', 'cd .vault', 'cat flag.txt'];
  const { state, events } = runSession(commands);
  assert.equal(missions[2].success(state, events), true);
  assert.equal(missions[2].success(state, events.slice(0, 2)), false);
});
