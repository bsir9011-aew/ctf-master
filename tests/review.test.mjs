import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addReviewHint, availableReviews, createReviewAttempt, getReviewScenario, markReviewHelp,
  restoreReviewAttempt, restoreReviewHistory, runReviewCommand, reviewScenarios
} from '../src/core/review.ts';
import { initialLinux } from '../src/core/linux.ts';

function commands(attempt,history,values) {
  let last = {attempt,history};
  for (const command of values) last = runReviewCommand(last.attempt,last.history,command);
  return last;
}

test('practice variants start in isolated virtual filesystems', () => {
  const original = initialLinux();
  const attempt = createReviewAttempt('log-search',{});
  assert.equal(original.files['/var/log/firewall.log'],undefined);
  assert.match(attempt.state.files['/var/log/firewall.log'],/BLOCK/);
  const result = commands(attempt,{},['rm /var/log/firewall.log']).attempt;
  assert.equal(result.state.files['/var/log/firewall.log'],undefined);
  assert.equal(original.files['/var/log/firewall.log'],undefined);
});

test('review skills unlock only after relevant missions, with weak ones prioritized', () => {
  assert.equal(availableReviews(['orientation'],{},{}).length,0);
  const unlocked = availableReviews(
    ['backup-evidence','log-hunt','evidence-search'],
    {'log-hunt':{commands:3,errors:2,hints:1,usedHelp:false,independent:false},
     'backup-evidence':{commands:1,errors:0,hints:0,usedHelp:false,independent:true}}, {});
  assert.deepEqual(unlocked.map(item => item.id),['log-search','file-search','backup']);
  assert.equal(unlocked[0].recommended,true);
  assert.equal(unlocked[2].recommended,false);
});

test('log review requires actually reading the marker from the correct path', () => {
  const attempt = createReviewAttempt('log-search',{});
  const invalid = commands(attempt,{},['cat /var/log/auth.log']).attempt;
  assert.equal(invalid.completed,false);
  const good = commands(attempt,{},['grep BLOCK /var/log/firewall.log']);
  assert.equal(good.attempt.completed,true);
  assert.equal(good.attempt.independent,true);
  assert.equal(good.history['log-search'].streak,1);
});

test('next completed attempt uses a different log file and reaches mastery after two clean solves', () => {
  const first = commands(createReviewAttempt('log-search',{}),{},['grep BLOCK /var/log/firewall.log']);
  const next = createReviewAttempt('log-search',first.history);
  assert.equal(next.variantId,'log-b');
  const second = commands(next,first.history,['grep ERROR /var/log/queue.log']);
  assert.equal(second.history['log-search'].streak,2);
  const queue = availableReviews(['log-hunt'],{'log-hunt':{commands:2,errors:1,hints:1,usedHelp:false,independent:false}},second.history);
  assert.equal(queue[0].recommended,false);
});

test('help or hints prevent a clean streak; next attempt may recover', () => {
  const first = addReviewHint(createReviewAttempt('log-search',{}));
  const assisted = commands(first,{},['grep BLOCK /var/log/firewall.log']);
  assert.equal(assisted.attempt.completed,true);
  assert.equal(assisted.attempt.independent,false);
  assert.equal(assisted.history['log-search'].streak,0);
  const second = markReviewHelp(createReviewAttempt('log-search',assisted.history));
  const helped = commands(second,assisted.history,['grep ERROR /var/log/queue.log']);
  assert.equal(helped.history['log-search'].streak,0);
  assert.equal(helped.attempt.usedHelp,true);
});

test('failed commands on solved review do not count twice', () => {
  const first = commands(createReviewAttempt('log-search',{}),{},['grep BLOCK /var/log/firewall.log']);
  const again = runReviewCommand(first.attempt,first.history,'grep ERROR /var/log/queue.log');
  assert.deepEqual(again.history,first.history);
  assert.deepEqual(again.attempt,first.attempt);
});

test('find review requires discovery and opening the specific target', () => {
  const attempt = createReviewAttempt('file-search',{});
  const onlyCat = commands(attempt,{},['cat ~/documents/reports/trace-21.txt']);
  assert.equal(onlyCat.attempt.completed,false);
  const result = commands(attempt,{},['find ~/documents -name "trace-*.txt"','cat ~/documents/reports/trace-21.txt']);
  assert.equal(result.attempt.completed,true);
  assert.equal(result.attempt.independent,true);
  const second = createReviewAttempt('file-search',result.history);
  assert.equal(second.variantId,'find-b');
  assert.equal(commands(second,result.history,['find ~/documents -name "case-*.txt"','cat ~/documents/audit/case-63.txt']).attempt.completed,true);
});

test('backup review validates full state, not the command string', () => {
  const attempt = createReviewAttempt('backup',{});
  const wrong = commands(attempt,{},['mv /var/log/network.log ~/documents/network-copy.log']);
  assert.equal(wrong.attempt.completed,false);
  const good = commands(attempt,{},['cp /var/log/network.log ~/documents/network-copy.log']);
  assert.equal(good.attempt.completed,true);
  const different = createReviewAttempt('backup',good.history);
  assert.equal(different.variantId,'backup-b');
});

test('restoration rejects invalid review data and keeps a valid in-progress attempt', () => {
  assert.deepEqual(restoreReviewHistory({backup:{attempts:4,streak:8},bad:{attempts:7,streak:2}}),
    {backup:{attempts:4,streak:2}});
  assert.equal(restoreReviewAttempt({variantId:'unknown',skill:'backup'}),null);
  const attempt = createReviewAttempt('backup',{});
  const resumed = restoreReviewAttempt({...attempt,hints:2});
  assert.equal(resumed.hints,2);
  assert.equal(resumed.variantId,attempt.variantId);
});

test('all twenty review variants have unique ids and valid initial fixtures', () => {
  assert.equal(reviewScenarios.length,20);
  assert.equal(new Set(reviewScenarios.map(item=>item.id)).size,20);
  for (const scenario of reviewScenarios) {
    const attempt = createReviewAttempt(scenario.skill, {[scenario.skill]:{attempts:scenario.id.endsWith('b')?1:0,streak:0}});
    assert.equal(getReviewScenario(attempt).id,scenario.id);
    assert.equal(getReviewScenario(attempt).success(attempt.state,[]),false);
  }
});
