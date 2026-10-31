import test from 'node:test';
import assert from 'node:assert/strict';
import {executeLinux,initialLinux} from '../src/core/linux.ts';
import {createAcademyState,academySubmit,commandLessons} from '../src/core/commandAcademy.ts';
import {createTransferState,submitTransfer,transferChallenges,transferMistake} from '../src/core/academyTransfer.ts';
import {variableCase,variableCompleted} from '../src/core/variableLesson.ts';
import {expandVirtualWords} from '../src/core/shellVariables.ts';
const run=(start,commands)=>{
  let state=start;const events=[];
  for(const line of commands){const e=executeLinux(state,line);state=e.state;events.push(e);}
  return {state,events};
};

test('virtual assignments, unset, builtins and bounds',()=>{
  const initial=initialLinux();
  const r=run(initial,['NAME="alpha beta"','echo "$NAME"','unset NAME','echo "$NAME"']);
  assert.equal(r.events[0].command,'variable');
  assert.equal(r.events[1].output,'alpha beta');
  assert.equal(r.events[3].output,'');
  assert.equal(initial.variables,undefined);
  assert.equal(executeLinux(initial,'HOME=x').ok,false);
  assert.equal(executeLinux(initial,'unset PWD').ok,false);
  assert.equal(executeLinux(initial,'echo "$PWD"').output,initial.cwd);
  assert.equal(executeLinux(initial,'echo "$HOME"').output,'/home/player');
  let current=initial;
  for(let i=0;i<16;i++)current=executeLinux(current,'ITEM'+i+'=x').state;
  assert.equal(executeLinux(current,'EXTRA=y').ok,false);
  assert.equal(executeLinux(initial,'KEY='+'a'.repeat(257)).ok,false);
});

test('single quotes and escaped dollar signs remain literal',()=>{
  const r=run(initialLinux(),['NAME="hello world"','echo "$NAME"',
    "echo '$NAME'",'echo \\$NAME','echo "$MISSING"']);
  assert.deepEqual(r.events.slice(1).map(e=>e.output),[
    'hello world','$NAME','$NAME',''
  ]);
  assert.equal(executeLinux(r.state,'echo "$'+'{NAME}"').output,'hello world');
  assert.equal(executeLinux(r.state,'echo "$'+'{NOT-VALID}"').ok,false);
  assert.equal(executeLinux(r.state,'echo "a|b"').output,'a|b');
  assert.equal(executeLinux(r.state,'echo "a && b"').output,'a && b');
});

test('expanding data never injects a command',()=>{
  const r=run(initialLinux(),['DANGER="touch /home/player/downloads/unwanted.tmp"','echo "$DANGER"']);
  assert.equal(r.events[1].output,'touch /home/player/downloads/unwanted.tmp');
  assert.equal(r.state.files['/home/player/downloads/unwanted.tmp'],undefined);
  assert.deepEqual(r.events[1].variableRefs,['DANGER']);
  assert.equal(executeLinux(r.state,'echo "$(whoami)"').output,'$(whoami)');
});

test('exit status and conditional execution remain correct',()=>{
  const r=run(initialLinux(),['test -f /not-present','echo $?','FILE=~/notes.txt',
    'test -f "$FILE" && cat "$FILE"']);
  assert.equal(r.events[0].exitCode,1);
  assert.equal(r.events[1].output,'1');
  assert.equal(r.events[1].target,'previous-exit');
  assert.equal(r.events.at(-1).ok,true);
  assert.equal(r.events.at(-1).conditionalTrace[1].executed,true);
});

test('variable lesson checks real assignments and variable references, not literal paths',()=>{
  const c=variableCase('intro');
  const cmds=['SOURCE='+c.sourceValue,'DEST='+c.destinationValue,
    'cp "$SOURCE" "$DEST"','cat "$DEST"'];
  const r=run(createAcademyState(),cmds);
  assert.equal(variableCompleted('intro',r.state,r.events),true);
  assert.deepEqual(r.events[2].variableRefs,['SOURCE','DEST']);
  assert.equal(r.events[3].output,c.expected);
  const fake=run(createAcademyState(),[
    ...cmds.slice(0,2),
    'cp '+c.sourceValue+' '+c.destinationValue,'cat '+c.destinationValue
  ]);
  assert.equal(variableCompleted('intro',fake.state,fake.events),false);
});

test('independent variables transfer uses different sources and values',()=>{
  const c=variableCase('transfer');
  let state=createTransferState('variables'),events=[];
  for(const cmd of ['SOURCE='+c.sourceValue,'DEST='+c.destinationValue,
    'cp "$SOURCE" "$DEST"','cat "$DEST"']){
    const step=submitTransfer(state,events,cmd,'variables');
    state=step.result.state;events=step.events;
    assert.equal(transferMistake('variables',step.result,step.completed),false);
  }
  assert.equal(variableCompleted('transfer',state,events),true);
  const bad=submitTransfer(createTransferState('variables'),[],
    'SOURCE=~/wrong.log','variables');
  assert.equal(transferMistake('variables',bad.result,bad.completed),true);
});

test('both catalogs stay synchronized and the local man page exists',()=>{
  assert.equal(commandLessons.length,34);
  assert.equal(transferChallenges.length,34);
  assert.deepEqual(commandLessons.map(x=>x.id),transferChallenges.map(x=>x.lessonId));
  assert.equal(executeLinux(initialLinux(),'man variables').ok,true);
  const c=variableCase('intro');
  let state=createAcademyState(),events=[];
  for(const cmd of ['SOURCE='+c.sourceValue,'DEST='+c.destinationValue,
    'cp "$SOURCE" "$DEST"','cat "$DEST"']){
    const step=academySubmit(state,events,cmd,'variables');
    state=step.result.state;events=step.events;
  }
  assert.equal(variableCompleted('intro',state,events),true);
});

test('lexing protects quoting, operators and literal strings',()=>{
  const scanned=expandVirtualWords('echo "one two" \\'$NAME\\' "$NAME" \\$NAME',
    {NAME:'hello world'},0);
  assert.deepEqual(scanned.words,['echo','one two','$NAME','hello world','$NAME']);
  assert.deepEqual(scanned.refs,['NAME']);
  assert.equal(expandVirtualWords('echo a;b',{},0),null);
});
