import test from 'node:test';
import assert from 'node:assert/strict';
import {
  commandLessons, createAcademyState, academySubmit, restoreAcademyProgress
} from '../src/core/commandAcademy.ts';
import {initialLinux} from '../src/core/linux.ts';
import {missions} from '../src/core/missions.ts';

const solutions={
  pwd:'pwd',
  ls:'ls ~/practice',
  cd:'cd ~/practice',
  mkdir:'mkdir ~/practice/experiments',
  touch:'touch ~/practice/note.txt',
  cat:'cat ~/practice/intro.txt',
  id:'id',
  man:'man grep',
  grep:'grep WARN ~/practice/events.log',
  head:'head -n 3 ~/practice/timeline.log',
  tail:'tail -n 2 ~/practice/timeline.log',
  wc:'wc -l ~/practice/timeline.log',
  sort:'sort ~/practice/names.txt',
  uniq:'uniq ~/practice/levels.txt',
  pipeline:'grep WARN ~/practice/alerts.log | sort | uniq | wc -l',
  redirect:'grep WARN ~/practice/alerts.log > ~/practice/alerts-summary.log',
  investigation:'grep "HTTP 502" ~/practice/logs/edge.log',
  find:'find ~/practice -name "ticket-*.txt"',
  cp:'cp ~/practice/source.txt ~/practice/backup.txt',
  mv:'mv ~/practice/move-me.txt ~/practice/renamed.txt',
  rm:'rm ~/practice/delete-me.tmp',
  'file-access':'id -G',
  namei:'namei -l ~/practice/diagnostics/service.log',
  umask:'umask 077',
  chgrp:'chgrp operators ~/practice/shared-report.log',
  chmod:'chmod 600 ~/practice/private.txt',
  ps:'ps',
  systemctl:'systemctl status web',
  ip:'ip route show'
};
const ids=commandLessons.map(lesson=>lesson.id);

test('catalogue has 29 unique drills and all exercise texts',()=>{
  assert.equal(ids.length,29);
  assert.equal(new Set(ids).size,29);
  assert.deepEqual(ids,Object.keys(solutions));
  for (const lesson of commandLessons) {
    assert.ok(lesson.purpose && lesson.syntax && lesson.example && lesson.assignment && lesson.hint,lesson.id);
  }
});
for(const lesson of commandLessons) {
  test('real virtual result completes command drill: '+lesson.id,()=>{
    const original=createAcademyState();
    assert.equal(lesson.pass(original,[]),false,'must not start completed');
    let result=academySubmit(original,[],solutions[lesson.id],lesson.id);
    assert.equal(result.result.ok,true);
    if(lesson.id==='redirect') {
      assert.equal(result.completed,false);
      result=academySubmit(result.result.state,result.events,
        'grep INFO ~/practice/alerts.log >> ~/practice/alerts-summary.log',lesson.id);
      assert.equal(result.completed,false);
      result=academySubmit(result.result.state,result.events,
        'cat ~/practice/alerts-summary.log',lesson.id);
    }
    if(lesson.id==='chgrp') {
      assert.equal(result.completed,false);
      result=academySubmit(result.result.state,result.events,
        'stat ~/practice/shared-report.log',lesson.id);
    }
    if(lesson.id==='umask') {
      assert.equal(result.completed,false);
      result=academySubmit(result.result.state,result.events,
        'touch ~/practice/private-created.txt',lesson.id);
      assert.equal(result.completed,false);
      result=academySubmit(result.result.state,result.events,
        'mkdir ~/practice/private-created',lesson.id);
    }
    if(lesson.id==='namei') {
      assert.equal(result.completed,false);
      result=academySubmit(result.result.state,result.events,
        'chmod u+x ~/practice/diagnostics',lesson.id);
      assert.equal(result.completed,false);
      result=academySubmit(result.result.state,result.events,
        'cat ~/practice/diagnostics/service.log',lesson.id);
    }
    if(lesson.id==='file-access') {
      assert.equal(result.completed,false);
      result=academySubmit(result.result.state,result.events,
        'stat ~/practice/operator.log',lesson.id);
      assert.equal(result.completed,false);
      result=academySubmit(result.result.state,result.events,
        'cat ~/practice/operator.log',lesson.id);
    }
    if(lesson.id==='id') {
      assert.equal(result.completed,false);
      result=academySubmit(result.result.state,result.events,'id -G',lesson.id);
    }
    if(lesson.id==='man') {
      assert.equal(result.completed,false);
      result=academySubmit(result.result.state,result.events,
        'grep -i error ~/practice/manual.log',lesson.id);
    }
    if(lesson.id==='investigation') {
      assert.equal(result.completed,false);
      result=academySubmit(result.result.state,result.events,
        'cp ~/practice/logs/edge.log ~/practice/evidence.log',lesson.id);
    }
    assert.equal(result.completed,true);
    assert.equal(lesson.pass(result.result.state,result.events),true);
  });
}

test('failed command cannot pass the lesson and coach sees failure',()=>{
  const original=createAcademyState();
  const result=academySubmit(original,[],'something-not-supported','cat');
  assert.equal(result.result.ok,false);
  assert.equal(result.completed,false);
  assert.equal(result.result.state,original);
});

test('drills cannot modify saved missions, their flags, or the base world',()=>{
  const session=initialLinux();
  const initial=structuredClone(session);
  const practice=createAcademyState();
  const result=academySubmit(practice,[],'rm ~/practice/delete-me.tmp','rm');
  assert.equal(result.completed,true);
  assert.deepEqual(session,initial);
  assert.equal(session.files['/home/player/practice/delete-me.tmp'],undefined);
  assert.equal(missions.length,16);
});

test('practice worlds reset to the same fixtures after changes',()=>{
  const initial=createAcademyState();
  const changed=academySubmit(initial,[],'mv ~/practice/move-me.txt ~/practice/renamed.txt','mv');
  assert.equal(changed.completed,true);
  const reset=createAcademyState();
  assert.equal(reset.files['/home/player/practice/move-me.txt'],'MOVE_ME');
  assert.equal(reset.files['/home/player/practice/renamed.txt'],undefined);
});

test('completion history ignores corrupt and unknown lessons',()=>{
  const restored=restoreAcademyProgress({
    completed:['pwd','pwd','not-a-lesson',123,'grep'],
    selectedId:'not-a-lesson'
  });
  assert.deepEqual(restored,{completed:['pwd','grep'],mastered:[],selectedId:'pwd'});
  assert.deepEqual(restoreAcademyProgress(null),{completed:[],mastered:[],selectedId:'pwd'});
  assert.deepEqual(restoreAcademyProgress([]),{completed:[],mastered:[],selectedId:'pwd'});
});

test('command academy does not treat one attempted command as another lesson',()=>{
  const initial=createAcademyState();
  const result=academySubmit(initial,[],'cat ~/practice/intro.txt','grep');
  assert.equal(result.result.ok,true);
  assert.equal(result.completed,false);
});

test('repeated commands are valid but academy progress cannot be confused with CTF',()=>{
  const state=createAcademyState();
  const first=academySubmit(state,[],'pwd','pwd');
  const second=academySubmit(first.result.state,first.events,'pwd','pwd');
  assert.equal(first.completed,true);
  assert.equal(second.completed,true);
  assert.equal(first.result.state,second.result.state);
});
