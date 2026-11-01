import test from 'node:test';
import assert from 'node:assert/strict';
import {runWorkshop} from '../src/core/bashWorkshop.ts';
import {createAcademyState} from '../src/core/commandAcademy.ts';
import {recoveryFixture} from '../src/core/pathRecovery.ts';
import {
  REPAIR_DEFAULT,workshopScenarios,workshopDraftKey,workshopInitialScript
} from '../src/core/workshopScenarios.ts';

const target='"$BASE/diagnostics/service.log"';
const dir='"$BASE/diagnostics"';
const correct=[
  'BASE=~/practice',
  'namei -l '+target,
  'chmod u+x '+dir,
  'cat '+target
].join('\n');

test('diagnose blocker, make minimal owner-x change, and read content back',()=>{
  const r=runWorkshop(correct,'repair');
  assert.equal(r.completed,true,r.feedback);
  assert.deepEqual(r.steps.map(x=>x.command),['variable','namei','chmod','cat']);
  assert.equal(r.steps[1].blockedAt,'~/practice/diagnostics');
  assert.equal(r.steps[2].exitCode,0);
  assert.equal(r.steps[3].output,recoveryFixture('intro').content);
  const original=createAcademyState();
  const blocked=recoveryFixture('intro').directory;
  assert.equal(original.permissions[blocked],0o600);
  assert.equal(r.state.permissions[blocked],0o700);
  assert.deepEqual(r.state.files,original.files);
  assert.deepEqual(r.state.ownership,original.ownership);
  assert.deepEqual(r.state.dirs,original.dirs);
  for(const [p,mode] of Object.entries(original.permissions))
    if(p!==blocked)assert.equal(r.state.permissions[p],mode,p);
});

test('equivalent exact octal change has same least-privilege effect',()=>{
  for(const mode of ['700','0700']){
    const r=runWorkshop(correct.replace('chmod u+x','chmod '+mode),'repair');
    assert.equal(r.completed,true,mode+': '+r.feedback);
    assert.equal(r.state.permissions[recoveryFixture('intro').directory],0o700);
  }
});

test('world starts fresh after each run: prior chmod cannot skip diagnosis',()=>{
  const first=runWorkshop(correct,'repair');
  assert.equal(first.completed,true);
  const second=runWorkshop('BASE=~/practice\ncat '+target,'repair');
  assert.equal(second.completed,false);
  assert.deepEqual(second.state.permissions,createAcademyState().permissions);
});

test('wrong order, missing evidence, wrong targets and wrong readback fail',()=>{
  const variants=[
    correct.replace('namei -l '+target,'namei -l "$BASE/checks/locked.log"'),
    correct.replace('cat '+target,'cat "$BASE/manual.log"'),
    correct.replace('chmod u+x '+dir,'chmod u+x "$BASE/logs"'),
    correct.replace('namei -l '+target,'test -r '+target),
    correct.replace('cat '+target,'echo $?'),
    correct.replace('BASE=~/practice','BASE=~/documents'),
    correct.split('\n').slice(0,3).join('\n'),
    correct.replace('namei -l '+target+'\n',''),
    correct.replace('namei -l '+target+'\nchmod u+x '+dir,
      'chmod u+x '+dir+'\nnamei -l '+target),
    correct.replace('chmod u+x '+dir+'\ncat '+target,'cat '+target+'\nchmod u+x '+dir)
  ];
  for(const script of variants){
    const r=runWorkshop(script,'repair');
    assert.equal(r.completed,false,script);
  }
});

test('dangerous or broad chmod and shell operators are rejected before any step',()=>{
  const bad=[
    correct.replace('chmod u+x','chmod 777'),
    correct.replace('chmod u+x','chmod a+x'),
    correct.replace('chmod u+x','chmod g+x'),
    correct.replace('chmod u+x','chmod -R'),
    'BASE=~/practice\nchmod 777 "$BASE/diagnostics"\ncat '+target,
    correct.replace('cat '+target,'rm "$BASE/diagnostics/service.log"'),
    correct.replace('cat '+target,'curl https://example.test'),
    correct.replace('chmod u+x '+dir,'chmod u+x '+dir+' && echo ok'),
    correct.replace('chmod u+x '+dir,'chmod u+x '+dir+'; rm /tmp/file'),
    correct.replace('cat '+target,'cat '+target+' > "$BASE/output.log"'),
    correct.replace('namei -l '+target,
      'for FILE in a b; do cp "$FILE" "$FILE.copy"; done')
  ];
  for(const script of bad){
    const r=runWorkshop(script,'repair');
    assert.equal(r.completed,false,script);
    assert.equal(r.steps.length,0,script);
    assert.deepEqual(r.state.permissions,createAcademyState().permissions,script);
  }
});

test('unfinished template cannot pass; old diagnosis cannot pass repair',()=>{
  assert.equal(runWorkshop(REPAIR_DEFAULT,'repair').completed,false);
  const old=[
    'BASE=~/practice',
    'test -r '+target,
    'echo $?',
    'namei -l '+target
  ].join('\n');
  assert.equal(runWorkshop(old,'pathblock').completed,true);
  assert.equal(runWorkshop(old,'repair').completed,false);
  assert.equal(runWorkshop(correct,'pathblock').completed,false);
});

test('new scenario has separate draft and preserves old identifiers',()=>{
  assert.deepEqual(workshopScenarios.map(x=>x.id),[
    'backup','diagnosis','permissions','fallback','transfer','pathblock','repair'
  ]);
  assert.equal(workshopInitialScript('repair'),REPAIR_DEFAULT);
  assert.equal(workshopDraftKey('repair'),'ctf-master:bash-workshop-repair-draft-v1');
  for(const id of ['backup','diagnosis','permissions','fallback','transfer','pathblock'])
    assert.notEqual(workshopDraftKey(id),workshopDraftKey('repair'));
});
