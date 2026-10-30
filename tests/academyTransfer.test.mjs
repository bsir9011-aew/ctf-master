import test from 'node:test';
import assert from 'node:assert/strict';
import { commandLessons, createAcademyState, restoreAcademyProgress } from '../src/core/commandAcademy.ts';
import {createTransferState, submitTransfer, transferChallenges, earnedMastery} from '../src/core/academyTransfer.ts';
import {initialLinux} from '../src/core/linux.ts';

const answers={
  pwd:'pwd',
  ls:'ls ~/practice/logs',
  cd:'cd ~/practice/logs',
  mkdir:'mkdir ~/practice/reports',
  touch:'touch ~/practice/draft.txt',
  cat:'cat ~/practice/logs/audit-67.txt',
  id:'id -gn',
  man:'man head',
  grep:'grep "INFO sync" ~/practice/events.log',
  head:'head -n 2 ~/practice/logs/review.log',
  tail:'tail -n 3 ~/practice/logs/review.log',
  wc:'wc -l ~/practice/logs/review.log',
  sort:'sort ~/practice/review-names.txt',
  uniq:'uniq ~/practice/review-levels.txt',
  pipeline:'grep ERROR ~/practice/logs/incidents.log | sort | uniq | wc -l',
  redirect:'grep ERROR ~/practice/logs/incidents.log > ~/practice/incidents-summary.log',
  quoting:'mv "~/practice/logs/audit notes.txt" "~/practice/logs/incident notes.txt"',
  investigation:'grep "LOGIN FAIL" ~/practice/logs/identity.log',
  find:'find ~/practice -name "audit-*.txt"',
  cp:'cp ~/practice/intro.txt ~/practice/intro-copy.txt',
  mv:'mv ~/practice/source.txt ~/practice/source-renamed.txt',
  rm:'rm ~/practice/review.tmp',
  'file-access':'id -G',
  namei:'namei -l ~/practice/logs/locked/health.log',
  umask:'umask 027',
  chgrp:'chgrp audit ~/practice/logs/audit-report.log',
  chmod:'chmod 600 ~/practice/team.key',
  ps:'ps',
  systemctl:'systemctl status sshd',
  ip:'ip addr show'
};
const originalIds=commandLessons.map(x=>x.id);

test('all thirty lessons have one different transfer task in the same order',()=>{
  assert.equal(transferChallenges.length,30);
  assert.deepEqual(transferChallenges.map(x=>x.lessonId),originalIds);
  for(const ch of transferChallenges) {
    assert.ok(ch.assignment.length>25,ch.lessonId);
  }
});
for(const challenge of transferChallenges) {
  test('transfer task is initially unfinished, then solved in independent fixture: '+challenge.lessonId,()=>{
    const original=createAcademyState();
    const seed=createTransferState(challenge.lessonId);
    assert.equal(challenge.pass(seed,[]),false,challenge.lessonId);
    let result=submitTransfer(seed,[],answers[challenge.lessonId],challenge.lessonId);
    assert.equal(result.result.ok,true,challenge.lessonId);
    if(challenge.lessonId==='quoting') {
      assert.equal(result.completed,false);
      result=submitTransfer(result.result.state,result.events,
        'cat "~/practice/logs/incident notes.txt"',challenge.lessonId);
    }
    if(challenge.lessonId==='redirect') {
      assert.equal(result.completed,false);
      result=submitTransfer(result.result.state,result.events,
        'grep INFO ~/practice/logs/incidents.log >> ~/practice/incidents-summary.log',challenge.lessonId);
      assert.equal(result.completed,false);
      result=submitTransfer(result.result.state,result.events,
        'cat ~/practice/incidents-summary.log',challenge.lessonId);
    }
    if(challenge.lessonId==='chgrp') {
      assert.equal(result.completed,false);
      result=submitTransfer(result.result.state,result.events,
        'stat ~/practice/logs/audit-report.log',challenge.lessonId);
    }
    if(challenge.lessonId==='umask') {
      assert.equal(result.completed,false);
      result=submitTransfer(result.result.state,result.events,
        'touch ~/practice/team-draft.txt',challenge.lessonId);
      assert.equal(result.completed,false);
      result=submitTransfer(result.result.state,result.events,
        'mkdir ~/practice/team-work',challenge.lessonId);
    }
    if(challenge.lessonId==='namei') {
      assert.equal(result.completed,false);
      result=submitTransfer(result.result.state,result.events,
        'chmod u+x ~/practice/logs/locked',challenge.lessonId);
      assert.equal(result.completed,false);
      result=submitTransfer(result.result.state,result.events,
        'cat ~/practice/logs/locked/health.log',challenge.lessonId);
    }
    if(challenge.lessonId==='file-access') {
      assert.equal(result.completed,false);
      result=submitTransfer(result.result.state,result.events,
        'stat ~/practice/logs/audit-share.log',challenge.lessonId);
      assert.equal(result.completed,false);
      result=submitTransfer(result.result.state,result.events,
        'cat ~/practice/logs/audit-share.log',challenge.lessonId);
    }
    if(challenge.lessonId==='id') {
      assert.equal(result.completed,false);
      result=submitTransfer(result.result.state,result.events,'groups',challenge.lessonId);
    }
    if(challenge.lessonId==='man') {
      assert.equal(result.completed,false);
      result=submitTransfer(result.result.state,result.events,
        'head -n 2 ~/practice/logs/manual-review.log',challenge.lessonId);
    }
    if(challenge.lessonId==='investigation') {
      assert.equal(result.completed,false);
      result=submitTransfer(result.result.state,result.events,
        'cp ~/practice/logs/identity.log ~/practice/incident-evidence.log',challenge.lessonId);
    }
    assert.equal(result.completed,true,challenge.lessonId);
    assert.equal(earnedMastery(result.completed,0,false),true);
    assert.deepEqual(original,createAcademyState(),'academy base mutated');
  });
}

test('transfer cannot be passed by a command from a different lesson',()=>{
  const seed=createTransferState('find');
  const wrong=submitTransfer(seed,[],'cat ~/practice/logs/audit-67.txt','find');
  assert.equal(wrong.result.ok,true);
  assert.equal(wrong.completed,false);
});

test('transfer cannot be mastered after a failure or revealing guidance',()=>{
  const seed=createTransferState('cat');
  const bad=submitTransfer(seed,[],'cat not-here.txt','cat');
  assert.equal(bad.result.ok,false);
  const solved=submitTransfer(bad.result.state,bad.events,answers.cat,'cat');
  assert.equal(solved.completed,true);
  assert.equal(earnedMastery(true,1,false),false);
  assert.equal(earnedMastery(true,0,true),false);
  assert.equal(earnedMastery(false,0,false),false);
});

test('a fresh transfer can recover an independent pass without affecting old results',()=>{
  const old=createTransferState('rm');
  const success=submitTransfer(old,[],answers.rm,'rm');
  assert.equal(success.completed,true);
  const another=createTransferState('rm');
  assert.equal(transferChallenges.find(x=>x.lessonId==='rm').pass(another,[]),false);
  assert.equal(initialLinux().files['/home/player/practice/review.tmp'],undefined);
});

test('existing RC.3 progress restores without inventing mastered skills',()=>{
  const migrated=restoreAcademyProgress({selectedId:'cp',completed:['pwd','cp']});
  assert.deepEqual(migrated,{selectedId:'cp',completed:['pwd','cp'],mastered:[]});
});

test('malformed mastery entries and unknown ids are filtered',()=>{
  const result=restoreAcademyProgress({
    selectedId:'cat',completed:['pwd','cat'],mastered:['cat','cat','chmod',123,'no-such-lesson']
  });
  assert.deepEqual(result,{selectedId:'cat',completed:['pwd','cat'],mastered:['cat']});
});
