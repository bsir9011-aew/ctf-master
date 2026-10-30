import {resolvePath,type CommandResult,type LinuxState} from './linux.ts';
import {tokenizeShellWords} from './shellSyntax.ts';
import type {ConditionalStep} from './conditionals.ts';

const LAB='/home/player/practice';
const CASES={
  intro:{
    source:LAB+'/source.txt',sourceContent:'COPY_ME',
    destination:LAB+'/guarded-copy.txt',
    absent:LAB+'/not-present.log',
    forbidden:LAB+'/should-not-exist.tmp',
    fallback:LAB+'/follow-up.flag'
  },
  transfer:{
    source:LAB+'/logs/review.log',
    sourceContent:'WARN spike\nINFO stable\nERROR temp\nINFO review\nWARN resolved\n',
    destination:LAB+'/logs/review-evidence.log',
    absent:LAB+'/logs/unknown-evidence.log',
    forbidden:LAB+'/logs/skip-this.tmp',
    fallback:LAB+'/logs/investigate.flag'
  }
} as const;
export type ConditionalVariant=keyof typeof CASES;
export const conditionalCase=(variant:ConditionalVariant)=>CASES[variant];

const intent=(state:LinuxState,step:ConditionalStep)=>{
  const tokens=tokenizeShellWords(step.raw);
  if(!tokens)return {command:'',target:''};
  const command=tokens[0]??'';
  const path=command==='cp'?tokens[2]:
    command==='touch'?tokens[1]:undefined;
  return {command,target:path?resolvePath(state.cwd,path):'',arity:tokens.length};
};

/** Observe actual gated actions, a skipped unsafe action and later evidence read.
 * Merely creating the desired files by unrelated commands never awards credit.
 */
export function conditionalCompleted(
  variant:ConditionalVariant,state:LinuxState,events:readonly CommandResult[]
):boolean{
  const c=CASES[variant];
  if(state.files[c.source]!==c.sourceContent ||
     state.files[c.destination]!==c.sourceContent ||
     state.files[c.fallback]!=='' ||
     Object.hasOwn(state.files,c.absent) ||
     Object.hasOwn(state.files,c.forbidden))return false;
  const chained=(r:CommandResult, first:0|1, rightExecuted:boolean,
    source:string,flag:'-f',rightCommand:'cp'|'touch',rightTarget:string):boolean=>{
    const steps=r.conditionalTrace;
    if(r.command!=='conditional'||!steps||steps.length!==2)return false;
    const [test,action]=steps;
    const parsed=intent(state,action);
    return test.executed&&test.command==='test'&&test.testFlag===flag&&
      test.target===source&&test.exitCode===first&&
      action.executed===rightExecuted&&
      (!rightExecuted||action.command===rightCommand)&&
      parsed.command===rightCommand&&parsed.arity===(rightCommand==='cp'?3:2)&&
      parsed.target===rightTarget;
  };

  const copy=events.findIndex(r=>r.ok&&chained(r,0,true,c.source,'-f','cp',c.destination)&&
    r.state.files[c.destination]===c.sourceContent);
  if(copy<0)return false;
  const skipped=events.findIndex((r,i)=>i>copy&&r.exitCode===1&&
    chained(r,1,false,c.absent,'-f','touch',c.forbidden));
  if(skipped<0)return false;
  const fallback=events.findIndex((r,i)=>i>skipped&&r.ok&&
    chained(r,1,true,c.absent,'-f','touch',c.fallback)&&
    r.state.files[c.fallback]==='');
  if(fallback<0)return false;
  return events.slice(fallback+1).some(r=>r.ok&&r.command==='cat'&&
    r.target===c.destination&&r.output===c.sourceContent);
}

/** No failed conditional is a learner error when the intended missing-file
 * gate correctly prevented an action. Wrong targets/branches still count.
 */
export function conditionalMistake(
  result:CommandResult,completed:boolean
):boolean {
  if(result.command!=='conditional')return !result.ok;
  const trace=result.conditionalTrace;
  if(!trace||trace.length!==2)return true;
  const [guard,action]=trace;
  if(!guard.executed||guard.command!=='test'||guard.testFlag!=='-f')return true;
  if(action.executed&&action.exitCode!==0)return true;
  // A correctly skipped branch is an intentional non-zero status.
  if(!result.ok&&!action.executed&&guard.exitCode===1)return false;
  return !result.ok&& !completed;
}
