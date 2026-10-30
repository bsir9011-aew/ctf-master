import type {CommandResult,LinuxState} from './linux.ts';
import {canTraverse,hasAccess} from './permissions.ts';

export type TestFlag='-e'|'-f'|'-d'|'-r'|'-w'|'-x';
const FLAGS=new Set<TestFlag>(['-e','-f','-d','-r','-w','-x']);

const LAB='/home/player/practice';
const INTRO={
  visible:LAB+'/checks/locked.log',
  directory:LAB+'/checks',
  content:'SIMULATED LOCKED EVIDENCE'
};
const TRANSFER={
  directory:LAB+'/logs/forensics',
  file:LAB+'/logs/forensics/trace.log',
  content:'SIMULATED FORENSIC RECORD'
};
export const testCase=(variant:'intro'|'transfer')=>variant==='intro'?INTRO:TRANSFER;

/** A pure virtual version of POSIX unary file predicates.
 * Absence, an inaccessible ancestor or a false condition yields status 1.
 * Invalid arguments yield status 2. Nothing executes on the host.
 */
export function executeFileTest(
  state:LinuxState,cmd:'test'|'[',args:readonly string[],
  resolve:(path:string)=>string
):CommandResult {
  const done=(ok:boolean,target?:string,flag?:TestFlag,usage=false):CommandResult=>({
    state,command:'test',ok,
    output:usage?'Uzycie: test [-e|-f|-d|-r|-w|-x] SCIEZKA lub [ -f SCIEZKA ]':'',
    target,testFlag:flag
  });
  const terms=cmd==='['
    ?args.at(-1)===']'?args.slice(0,-1):null
    :args;
  if(!terms||terms.length!==2||!FLAGS.has(terms[0] as TestFlag)||!terms[1])
    return done(false,undefined,undefined,true);
  const flag=terms[0] as TestFlag;
  const target=resolve(terms[1]);
  const file=Object.hasOwn(state.files,target);
  const dir=state.dirs.includes(target);
  const accessible=(file||dir)&&canTraverse(state,target);
  const matched=accessible&&(flag==='-e'?true:
    flag==='-f'?file:
    flag==='-d'?dir:
    hasAccess(state,target,flag.slice(1) as 'r'|'w'|'x'));
  return done(matched,target,flag);
}

/** Require immediate echo $? after each meaningful observation.
 * A failed predicate is expected in this exercise, not a learner mistake.
 */
const pair=(events:readonly CommandResult[],from:number,flag:TestFlag,target:string,code:0|1):number=>{
  for(let i=from;i+1<events.length;i++){
    const a=events[i],b=events[i+1];
    if(a.command==='test'&&a.testFlag===flag&&a.target===target&&a.exitCode===code&&
      b.command==='echo'&&b.target==='previous-exit'&&b.output===String(code)&&b.ok)
      return i+2;
  }
  return -1;
};

export function fileTestCompleted(
  variant:'intro'|'transfer',state:LinuxState,events:readonly CommandResult[]
):boolean{
  if(variant==='intro'){
    const a=pair(events,0,'-f',INTRO.visible,0);
    return a>=0&&pair(events,a,'-r',INTRO.visible,1)>=0&&
      state.files[INTRO.visible]===INTRO.content&&state.permissions?.[INTRO.visible]===0o000;
  }
  if(state.files[TRANSFER.file]!==TRANSFER.content||
    state.permissions?.[TRANSFER.directory]!==0o700||
    state.permissions?.[TRANSFER.file]!==0o644)return false;
  const failed=pair(events,0,'-r',TRANSFER.file,1);
  if(failed<0)return false;
  const diagnostic=pair(events,failed,'-x',TRANSFER.directory,1);
  if(diagnostic<0)return false;
  const fixed=events.findIndex((r,i)=>i>=diagnostic&&r.ok&&r.command==='chmod'&&
    r.target===TRANSFER.directory&&r.state.permissions?.[TRANSFER.directory]===0o700);
  return fixed>=0&&pair(events,fixed+1,'-r',TRANSFER.file,0)>=0;
}

/** Intentional false conditions count as observations, not errors.
 * Unrelated unsuccessful commands still lower the clean-transfer score.
 */
export function fileTestMistake(result:CommandResult):boolean{
  if(result.command==='test'){
    return result.exitCode===2||!result.testFlag||!result.target;
  }
  return !result.ok;
}
