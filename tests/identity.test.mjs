import {assertWorldUnchanged} from './assertWorldUnchanged.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {executeLinux,initialLinux} from '../src/core/linux.ts';
import {defaultIdentity,effectiveGroups,identityOf} from '../src/core/identity.ts';
import {createAcademyState,academySubmit,restoreAcademyProgress} from '../src/core/commandAcademy.ts';
import {createTransferState,submitTransfer,transferMistake,earnedMastery} from '../src/core/academyTransfer.ts';

test('full id distinguishes UID, primary GID and supplementary groups',()=>{
  const s=initialLinux();
  const snapshot=structuredClone(s);
  const result=executeLinux(s,'id');
  assert.equal(result.ok,true);
  assert.equal(result.command,'id');
  assert.equal(result.target,'identity');
  assert.equal(result.output,'uid=1000(player) gid=1000(player) groups=1000(player),1100(operators)');
  assert.equal(executeLinux(s,'whoami').output,'player');
  assert.deepEqual(s,snapshot);
  assert.deepEqual(result.state,snapshot);
});

test('id switches between numeric IDs and readable names',()=>{
  const s=initialLinux();
  const cases={
    'id -u':['1000','uid'],
    'id -un':['player','username'],
    'id -g':['1000','primary-gid'],
    'id -gn':['player','primary-name'],
    'id -G':['1000 1100','group-ids'],
    'id -Gn':['player operators','group-names'],
    'id -nG':['player operators','group-names']
  };
  for(const [command,[output,target]] of Object.entries(cases)){
    const result=executeLinux(s,command);
    assert.equal(result.ok,true,command);
    assert.equal(result.output,output,command);
    assert.equal(result.target,target,command);
  }
  assert.equal(executeLinux(s,'groups').output,'player operators');
});

test('man id, man groups and man -k groups teach the implemented subset',()=>{
  const s=initialLinux();
  assert.match(executeLinux(s,'man id').output,/UID/);
  assert.match(executeLinux(s,'man id').output,/-Gn/);
  assert.match(executeLinux(s,'man groups').output,/groups/);
  const found=executeLinux(s,'man -k grupy');
  assert.equal(found.ok,true);
  assert.match(found.output,/id/);
  assert.match(found.output,/groups/);
});

test('identity commands reject unsupported arguments without altering session',()=>{
  const s=initialLinux();
  const original=structuredClone(s);
  for(const cmd of ['id -a','id player','id -u -g','groups player','groups -G','whoami foo']){
    const r=executeLinux(s,cmd);
    assert.equal(r.ok,false,cmd);
    assertWorldUnchanged(r.state,original,cmd);
  }
  assert.deepEqual(s,original);
});

test('missing identity in an old session defaults to player without migrating progress',()=>{
  const legacy=initialLinux();
  delete legacy.identity;
  assert.equal(identityOf(legacy).user,'player');
  assert.equal(executeLinux(legacy,'id -G').output,'1000 1100');
  assert.equal(executeLinux(legacy,'whoami').output,'player');
  assert.equal(legacy.identity,undefined);
});

test('the first group remains primary and duplicate supplementary GID is omitted',()=>{
  const identity=defaultIdentity();
  identity.supplementary.push({gid:1000,name:'duplicate'},{gid:1300,name:'audit'});
  assert.deepEqual(effectiveGroups(identity).map(g=>g.name),['player','operators','audit']);
  const s=initialLinux();
  s.identity=identity;
  assert.equal(executeLinux(s,'groups').output,'player operators audit');
});

test('intro requires full identity observation before listing numeric groups',()=>{
  const seed=createAcademyState();
  const early=academySubmit(seed,[],'id -G','id');
  assert.equal(early.result.ok,true);
  assert.equal(early.completed,false);
  const full=academySubmit(seed,[],'id','id');
  assert.equal(full.completed,false);
  const done=academySubmit(full.result.state,full.events,'id -G','id');
  assert.equal(done.completed,true);
  assert.equal(done.result.output,'1000 1100');
});

test('transfer switches to analyst with different UID, primary and supplemental groups',()=>{
  const s=createTransferState('id');
  assert.equal(executeLinux(s,'whoami').output,'analyst');
  assert.equal(executeLinux(s,'id -u').output,'1001');
  assert.equal(executeLinux(s,'id -g').output,'1100');
  assert.equal(executeLinux(s,'id -G').output,'1100 1200');
  assert.equal(executeLinux(s,'groups').output,'security audit');
  assert.equal(createAcademyState().identity?.user,'player');
});

test('transfer requires primary group before all names and accepts id -Gn or groups',()=>{
  for(const finalCommand of ['groups','id -Gn']){
    const seed=createTransferState('id');
    const early=submitTransfer(seed,[],finalCommand,'id');
    assert.equal(early.completed,false);
    assert.equal(transferMistake('id',early.result,false),true);
    const first=submitTransfer(seed,[],'id -gn','id');
    assert.equal(first.completed,false);
    assert.equal(transferMistake('id',first.result,false),false);
    const done=submitTransfer(first.result.state,first.events,finalCommand,'id');
    assert.equal(done.completed,true);
    assert.equal(transferMistake('id',done.result,true),false);
    assert.equal(earnedMastery(done.completed,0,false),true);
    assert.equal(earnedMastery(done.completed,1,false),false);
  }
});

test('wrong group choice is a miss but successful auxiliary whoami is allowed',()=>{
  const seed=createTransferState('id');
  const exploratory=submitTransfer(seed,[],'whoami','id');
  assert.equal(exploratory.result.ok,true);
  assert.equal(transferMistake('id',exploratory.result,false),false);
  const premature=submitTransfer(seed,[],'groups','id');
  assert.equal(transferMistake('id',premature.result,false),true);
});

test('the old saved mastery remains intact and new identity exercise starts unmastered',()=>{
  const progress=restoreAcademyProgress({
    selectedId:'man',completed:['pwd','man'],mastered:['pwd']
  });
  assert.equal(progress.selectedId,'man');
  assert.deepEqual(progress.completed,['pwd','man']);
  assert.deepEqual(progress.mastered,['pwd']);
  assert.equal(progress.completed.includes('id'),false);
});
