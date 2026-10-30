import {assertWorldUnchanged} from './assertWorldUnchanged.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { executeLinux, initialLinux } from '../src/core/linux.ts';
import { missions } from '../src/core/missions.ts';

function session(commands) {
  let state = initialLinux();
  const events = [];
  for (const command of commands) {
    const result = executeLinux(state, command);
    state = result.state;
    events.push(result);
  }
  return {state, events};
}

test('cp copies a file and leaves the source untouched', () => {
  const original = initialLinux();
  const copied = executeLinux(original, 'cp /var/log/auth.log ~/documents/auth-backup.log');
  assert.equal(copied.ok, true);
  assert.equal(copied.state.files['/home/player/documents/auth-backup.log'], original.files['/var/log/auth.log']);
  assert.equal(copied.state.files['/var/log/auth.log'], original.files['/var/log/auth.log']);
  assert.equal(Object.hasOwn(original.files, '/home/player/documents/auth-backup.log'), false);
});

test('cp to existing directory uses original filename', () => {
  const result = executeLinux(initialLinux(), 'cp notes.txt documents');
  assert.equal(result.ok, true);
  assert.equal(result.state.files['/home/player/documents/notes.txt'], result.state.files['/home/player/notes.txt']);
});

test('mv moves a file and removes its old path', () => {
  const result = executeLinux(initialLinux(), 'mv ~/downloads/incident.tmp ~/documents/incident.txt');
  assert.equal(result.ok, true);
  assert.equal(Object.hasOwn(result.state.files, '/home/player/downloads/incident.tmp'), false);
  assert.match(result.state.files['/home/player/documents/incident.txt'], /incident-47/);
});

test('rm removes files but does not delete directories or accept recursive flags', () => {
  const original = initialLinux();
  const denied = executeLinux(original, 'rm -rf /');
  assert.equal(denied.ok, false);
  assert.equal(executeLinux(original, 'rm documents').ok, false);
  const removed = executeLinux(original, 'rm ~/downloads/stale.tmp');
  assert.equal(removed.ok, true);
  assert.equal(Object.hasOwn(removed.state.files, '/home/player/downloads/stale.tmp'), false);
  assert.equal(Object.hasOwn(original.files, '/home/player/downloads/stale.tmp'), true);
});

test('cp/mv reject missing parents and preserve state on error', () => {
  const original = initialLinux();
  for (const command of ['cp notes.txt missing/copy.txt', 'mv documents missing', 'cp /var/log system.log', 'mv notes.txt notes.txt']) {
    const result = executeLinux(original, command);
    assert.equal(result.ok, false, command);
    assertWorldUnchanged(result.state, original, command);
  }
});

test('grep searches literal substring and supports -i', () => {
  const state = initialLinux();
  assert.match(executeLinux(state, 'grep DENIED /var/log/auth.log').output, /DENIED sshd/);
  assert.match(executeLinux(state, 'grep -i denied /var/log/auth.log').output, /DENIED sshd/);
  assert.equal(executeLinux(state, 'grep denied /var/log/auth.log').ok, false);
  assert.equal(executeLinux(state, 'grep NOT_PRESENT /var/log/auth.log').ok, false);
});

test('find traverses subfolders with glob and respects selected root', () => {
  const state = initialLinux();
  assert.match(executeLinux(state, 'find ~/documents -name "evidence-*.txt"').output, /\/documents\/cases\/evidence-47\.txt/);
  assert.doesNotMatch(executeLinux(state, 'find ~/downloads -name "evidence-*.txt"').output, /evidence-47/);
  assert.match(executeLinux(state, 'find ~/documents -name "evidence-??.txt"').output, /evidence-47\.txt/);
  assert.equal(executeLinux(state, 'find /nonexistent').ok, false);
});

test('new missions require meaningful investigation and state changes', () => {
  const log = session(['grep DENIED /var/log/auth.log']);
  assert.equal(missions[3].success(log.state, log.events), true);
  assert.equal(missions[3].success(log.state, []), false);

  const evidence = session(['find ~/documents -name "evidence-*.txt"', 'cat ~/documents/cases/evidence-47.txt']);
  assert.equal(missions[4].success(evidence.state, evidence.events), true);
  assert.equal(missions[4].success(evidence.state, evidence.events.slice(0, 1)), false);

  const backup = session(['cp /var/log/auth.log ~/documents/auth-backup.log']);
  assert.equal(missions[5].success(backup.state, backup.events), true);
  assert.equal(missions[5].success(initialLinux(), []), false);

  const cleanup = session(['mv ~/downloads/incident.tmp ~/documents/incident.txt', 'rm ~/downloads/stale.tmp']);
  assert.equal(missions[6].success(cleanup.state, cleanup.events), true);
  assert.equal(missions[6].success(session(['mv ~/downloads/incident.tmp ~/documents/incident.txt']).state, []), false);
});
