import test from 'node:test';
import assert from 'node:assert/strict';
import {runWorkshop,WORKSHOP_DEFAULT,WORKSHOP_MAX_CHARS} from '../src/core/bashWorkshop.ts';
import {createAcademyState} from '../src/core/commandAcademy.ts';

const success=[
  'BASE=~/practice',
  'for FILE in "$BASE/events.log" "$BASE/alerts.log"; do cp "$FILE" "$FILE.copy"; done',
  'test -f "$BASE/events.log.copy" && test -f "$BASE/alerts.log.copy"'
].join('\n');

test('three lines combine variable, for loop and two real virtual checks',()=>{
  const result=runWorkshop(success);
  assert.equal(result.completed,true,result.feedback);
  assert.equal(result.steps.length,3);
  assert.deepEqual(result.steps.map(x=>x.command),['variable','for','conditional']);
  assert.equal(result.steps[1].iterations,2);
  assert.deepEqual(result.steps[1].changedFiles,[
    '~/practice/events.log.copy','~/practice/alerts.log.copy'
  ]);
  assert.equal(result.steps[2].exitCode,0);
  assert.equal(result.state.variables.BASE,'~/practice');
  const before=createAcademyState();
  for(const name of ['events.log','alerts.log']){
    const p='/home/player/practice/'+name;
    assert.equal(result.state.files[p],before.files[p]);
    assert.equal(result.state.files[p+'.copy'],before.files[p]);
  }
});

test('every run uses fresh world and no stale files from previous attempts',()=>{
  const first=runWorkshop(success);
  assert.equal(first.completed,true);
  const next=runWorkshop('BASE=~/practice\ntest -f "$BASE/events.log.copy"');
  assert.equal(next.completed,false);
  assert.equal(next.state.files['/home/player/practice/events.log.copy'],undefined);
  assert.equal(next.steps.length,2);
});

test('no verification, wrong base or wrong loop yields first meaningful feedback',()=>{
  const onlyCopy=runWorkshop(success.split('\n').slice(0,2).join('\n'));
  assert.equal(onlyCopy.completed,false);
  assert.match(onlyCopy.feedback,/test -f/);
  const wrongBase=runWorkshop(success.replace('BASE=~/practice','BASE=~/documents'));
  assert.equal(wrongBase.completed,false);
  assert.equal(wrongBase.state.files['/home/player/practice/events.log.copy'],undefined);
  const noBase=runWorkshop([
    'for FILE in ~/practice/events.log ~/practice/alerts.log; do cp "$FILE" "$FILE.copy"; done',
    'test -f ~/practice/events.log.copy && test -f ~/practice/alerts.log.copy'
  ].join('\n'));
  assert.equal(noBase.completed,false);
  assert.match(noBase.feedback,/BASE/);
});

test('wrong copy target and missing verification cannot pass by filenames alone',()=>{
  const wrongCopy=runWorkshop(success.replace('"$FILE.copy"','"$FILE.other"'));
  assert.equal(wrongCopy.completed,false);
  assert.match(wrongCopy.feedback,/pętlę|kopi/);
  const partialCheck=runWorkshop(success.replace(
    'test -f "$BASE/events.log.copy" && test -f "$BASE/alerts.log.copy"',
    'test -f "$BASE/events.log.copy"'
  ));
  assert.equal(partialCheck.completed,false);
  assert.match(partialCheck.feedback,/obu plików/);
});

test('all invalid or dangerous lines rejected before filesystem mutation',()=>{
  const invalid=[
    'BASE=~/practice\nrm ~/practice/events.log',
    'BASE=~/practice\nsystemctl stop sshd',
    'BASE=~/practice\nfor FILE in a b; do rm "$FILE"; done',
    'BASE=~/practice\nfor FILE in a b; do cp "$FILE" "$FILE.copy" && touch x; done',
    'BASE=~/practice\nfor FILE in a b; do cp "$FILE" "$FILE.copy"; done; touch x',
    'BASE=~/practice\ncurl -i http://ops.ctf.test/health',
    'BASE=~/practice\ncat ~/practice/events.log > ~/practice/events.log.copy',
    'BASE=~/practice\nfor FILE in a b; do cp "$FILE" "$FILE.copy"; don',
    'BASE=~/practice\n'.repeat(5),
    'BASE=~/practice\n'+ 'x'.repeat(241)
  ];
  for(const source of invalid){
    const r=runWorkshop(source);
    assert.equal(r.completed,false,source);
    assert.equal(r.steps.length,0,source);
    assert.equal(r.state.files['/home/player/practice/events.log.copy'],undefined);
  }
});

test('separators inside quoted values are data, never shell syntax',()=>{
  const script=success.replace(
    'BASE=~/practice','LABEL="touch /tmp/unsafe && rm /etc/passwd"\nBASE=~/practice'
  );
  const r=runWorkshop(script);
  assert.equal(r.completed,true,r.feedback);
  assert.equal(r.state.variables.LABEL,'touch /tmp/unsafe && rm /etc/passwd');
  assert.equal(r.state.files['/tmp/unsafe'],undefined);
});

test('workshop limits user input and sample remains deliberately incomplete',()=>{
  assert.equal(WORKSHOP_MAX_CHARS,700);
  assert.equal(runWorkshop('x'.repeat(701)).steps.length,0);
  assert.equal(runWorkshop(WORKSHOP_DEFAULT).completed,false);
  assert.equal(runWorkshop(' ').completed,false);
});
