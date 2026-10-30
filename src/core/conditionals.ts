import {scanShell} from './shellSyntax.ts';
import type {CommandResult,LinuxState} from './linux.ts';

export type LogicalOperator='&&'|'||';
export interface ConditionalSegment {
  raw:string;
  /** The operator that precedes this segment. */
  operator?:LogicalOperator;
}
export interface ConditionalStep {
  raw:string;
  operator?:LogicalOperator;
  executed:boolean;
  command?:string;
  target?:string;
  testFlag?:'-e'|'-f'|'-d'|'-r'|'-w'|'-x';
  exitCode?:number;
}
export const CONDITIONAL_LIMIT=5;

/** Only well-formed conditional lists are admitted; never evaluate the input. */
export function parseConditionals(raw:string):ConditionalSegment[]|null|undefined {
  const tokens=scanShell(raw);
  if(!tokens)return undefined;
  const operators=tokens.filter(t=>t.kind==='and'||t.kind==='or');
  if(!operators.length)return undefined;
  if(operators.length>=CONDITIONAL_LIMIT)return null;
  const parts:ConditionalSegment[]=[];
  let from=0;
  let preceding:LogicalOperator|undefined;

  const valid=(part:string):boolean=>{
    const items=scanShell(part);
    if(!items||!items.length||items[0].kind!=='word'||items.at(-1)?.kind!=='word')return false;
    for(let i=1;i<items.length;i++){
      const kind=items[i].kind;
      if(kind==='and'||kind==='or')return false;
      if(kind==='pipe'&&items[i-1]?.kind!=='word')return false;
      if((kind==='pipe'||kind==='overwrite'||kind==='append')&&
        items[i+1]?.kind!=='word')return false;
      if((kind==='overwrite'||kind==='append')&&i!==items.length-2)return false;
    }
    return true;
  };

  for(const op of operators){
    const part=raw.slice(from,op.start).trim();
    if(!valid(part))return null;
    parts.push({raw:part,operator:preceding});
    preceding=op.kind==='and'?'&&':'||';
    from=op.end;
  }
  const last=raw.slice(from).trim();
  if(!valid(last))return null;
  parts.push({raw:last,operator:preceding});
  return parts;
}

/** Execute left to right. Skipped commands have zero side effects and do not
 * update $?; the last actually executed command determines final status.
 */
export function executeConditionals(
  initial:LinuxState,segments:readonly ConditionalSegment[],
  execute:(state:LinuxState,command:string)=>CommandResult
):CommandResult {
  let state=initial;
  let last:CommandResult|undefined;
  const trace:ConditionalStep[]=[];
  const outputs:string[]=[];
  for(const segment of segments){
    const shouldRun=!segment.operator ||
      (segment.operator==='&&'?last?.ok===true:last?.ok===false);
    if(!shouldRun){
      trace.push({raw:segment.raw,operator:segment.operator,executed:false});
      continue;
    }
    const result=execute(state,segment.raw);
    state=result.state;
    last=result;
    trace.push({
      raw:segment.raw,operator:segment.operator,executed:true,
      command:result.command,target:result.target,testFlag:result.testFlag,
      exitCode:result.exitCode
    });
    if(result.output)outputs.push(result.output);
  }
  return {
    state,ok:last?.ok===true,
    output:outputs.join('\n'),
    command:'conditional',
    conditionalTrace:trace
  };
}
