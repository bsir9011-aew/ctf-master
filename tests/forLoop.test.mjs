import test from 'node:test';
import assert from 'node:assert/strict';
import {executeLinux,initialLinux} from '../src/core/linux.ts';
import {parseForLoop} from '../src/core/forLoop.ts';
import {loopCase,loopCompleted} from '../src/core/forLesson.ts';
import {createAcademyState,academySubmit,commandLessons} from '../src/core/commandAcademy.ts';
import {createTransferState,submitTransfer,transferChallenges,transferMistake} from '../src/core/academyTransfer.ts';

const execute=(initial,commands)=>{
  let state=initial;const events=[];
  for(const c of commands){const e=executeLinux(state,c);events.push(e);state=e.state;}
  return {state,events};
};
const command=(c)=>'for FILE in '+c.inputs.join(' ')+'; do cp "$FILE" "$FILE.copy"; done';

test('for preserves state and source while copying every requested file',()=>{
  const original=createAcademyState();
  const c=loopCase('intro');
  const e=executeLinux(original,command(c));
  assert.equal(e.ok,true);
  assert.equal(e.command,'for');
  assert.deepEqual(e.loopTrace.map(x=>x.value),c.inputs);
  assert.deepEqual(e.loopTrace.map(x=>x.target),c.sources.map(x=>x+'.copy'));
  assert.ok(e.loopTrace.every(x=>x.refs.filter(v=>v==='FILE').length>=2));
  assert.equal(e.state.variables.FILE,c.inputs.at(-1));
  for(let i=0;i<2;i++){
    assert.equal(e.state.files[c.sources[i]],original.files[c.sources[i]]);
    assert.equal(e.state.files[c.sources[i]+'.copy'],c.contents[i]);
  }
  assert.equal(original.variables,undefined);
  assert.equal(original.files[c.sources[0]+'.copy'],undefined);
});

test('both original lessons require a loop plus verified readback of both files',()=>{
  const c=loopCase('intro'),line=command(c);
  let state=createAcademyState(),events=[];
  let result=academySubmit(state,events,line,'for');
  assert.equal(result.completed,false);
  state=result.result.state;events=result.events;
  result=academySubmit(state,events,'cat '+c.inputs[0]+'.copy','for');
  assert.equal(result.completed,false);
  state=result.result.state;events=result.events;
  result=academySubmit(state,events,'cat '+c.inputs[1]+'.copy','for');
  assert.equal(result.completed,true);
  assert.equal(loopCompleted('intro',result.result.state,result.events),true);
});

test('transfer uses new data and requires a real loop, not direct copies',()=>{
  const c=loopCase('transfer');
  const original=createTransferState('for');
  const direct=execute(original,[
    'cp '+c.inputs[0]+' '+c.inputs[0]+'.copy',
    'cp '+c.inputs[1]+' '+c.inputs[1]+'.copy',
    'cat '+c.inputs[0]+'.copy','cat '+c.inputs[1]+'.copy'
  ]);
  assert.equal(loopCompleted('transfer',direct.state,direct.events),false);
  let state=original,events=[];
  for(const cmd of [command(c),...c.inputs.map(x=>'cat '+x+'.copy')]){
    const step=submitTransfer(state,events,cmd,'for');
    assert.equal(transferMistake('for',step.result,step.completed),false);
    state=step.result.state;events=step.events;
  }
  assert.equal(loopCompleted('transfer',state,events),true);
});

test('malformed loops reject all writes before first iteration',()=>{
  const bad=[
    'for FILE in a b; do touch ~/practice/should-not-exist; done; echo no',
    'for FILE in a b; do touch ~/practice/should-not-exist',
    'for FILE in a b; do touch ~/practice/should-not-exist; don',
    'for FILE in a b; do touch ~/practice/should-not-exist && echo okay; done',
    'for FILE in a b; do for X in c; do touch z; done; done',
    'for FILE in a b; do touch ~/practice/should-not-exist; done; done',
    'for FILE in a b; do touch ~/practice/should-not-exist; done\npwd',
    'for FILE in a b c d e f; do touch ~/practice/should-not-exist; done',
    'for FILE in a; do touch ~/practice/should-not-exist; done $(echo bad)'
  ];
  for(const code of bad){
    const seed=createAcademyState();
    const e=executeLinux(seed,code);
    assert.equal(e.ok,false,code);
    assert.deepEqual(e.state.files,seed.files,code);
    assert.deepEqual(e.state.variables,seed.variables,code);
  }
});

test('safe parameter expansion is evaluated anew in each iteration',()=>{
  const s=executeLinux(initialLinux(),
    'for N in first second third; do echo "$N"; done');
  assert.equal(s.output,'first\nsecond\nthird');
  assert.equal(s.loopTrace.length,3);
  assert.equal(s.state.variables.N,'third');
  assert.deepEqual(s.loopTrace.map(x=>x.refs),[['N'],['N'],['N']]);
  assert.equal(executeLinux(initialLinux(),
    "for N in first second; do echo '$N'; done").output,'$N\n$N');
});

test('spaces in quoted list values stay one item, no shell interpolation',()=>{
  const s=executeLinux(initialLinux(),
    'for N in "hello world" "x;z"; do echo "$N"; done');
  assert.equal(s.ok,true);
  assert.equal(s.output,'hello world\nx;z');
  assert.equal(s.loopTrace.length,2);
  assert.equal(executeLinux(initialLinux(),
    'for N in "x && touch /tmp/no"; do echo "$N"; done').output,
    'x && touch /tmp/no');
});

test('loop runs later iterations after an error; $? is the last iteration result',()=>{
  const seed=initialLinux();
  const failed=executeLinux(seed,
    'for N in bad1 bad2; do cat "$N"; done');
  assert.equal(failed.ok,false);
  assert.equal(failed.loopTrace.length,2);
  assert.equal(failed.loopTrace.every(x=>!x.ok),true);
  assert.equal(executeLinux(failed.state,'echo $?').output,'1');
  const mixed=executeLinux(seed,
    'for N in /not-present ~/notes.txt; do cat "$N"; done');
  assert.equal(mixed.ok,true);
  assert.equal(mixed.loopTrace[0].ok,false);
  assert.equal(mixed.loopTrace[1].ok,true);
  assert.equal(mixed.exitCode,0);
  assert.equal(executeLinux(mixed.state,'echo $?').output,'0');
});

test('loop variable namespace and oversize values are bounded',()=>{
  const initial=initialLinux();
  assert.equal(parseForLoop(initial,'for HOME in x; do echo "$HOME"; done'),null);
  assert.equal(parseForLoop(initial,'for PWD in x; do echo "$PWD"; done'),null);
  assert.equal(parseForLoop(initial,'for BAD-NAME in x; do echo x; done'),null);
  let state=initial;
  for(let i=0;i<16;i++)state=executeLinux(state,'A'+i+'=x').state;
  assert.equal(executeLinux(state,'for EXTRA in x; do echo x; done').ok,false);
  assert.equal(executeLinux(initial,
    'for N in '+ 'x'.repeat(257)+'; do echo "$N"; done').ok,false);
});

test('man for is available, and both catalogs contain 35 lessons in order',()=>{
  assert.equal(executeLinux(initialLinux(),'man for').ok,true);
  assert.equal(commandLessons.length,35);
  assert.equal(transferChallenges.length,35);
  assert.deepEqual(commandLessons.map(x=>x.id),transferChallenges.map(x=>x.lessonId));
});
