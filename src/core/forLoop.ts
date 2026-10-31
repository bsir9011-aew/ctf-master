import {scanShell} from './shellSyntax.ts';
import {expandVirtualWords,validName,VARIABLE_LIMIT,VARIABLE_VALUE_LIMIT} from './shellVariables.ts';
import {previousExitCode} from './exitStatus.ts';
import type {CommandResult,LinuxState} from './linux.ts';

export const FOR_LIMIT=5;
export interface ForLoopSpec {
  variable:string;
  values:string[];
  body:string;
}
export interface ForStep {
  value:string;
  command:string;
  target?:string;
  exitCode?:number;
  ok:boolean;
  refs:string[];
}

/** Split the two semicolons without interpreting quoted or escaped text.
 * Reject every extra unquoted separator and incomplete quoting up front.
 */
function splitStatements(raw:string):string[]|null {
  const parts:string[]=[];
  let start=0,quote:"'"|'"'|null=null;
  for(let i=0;i<raw.length;i++){
    const ch=raw[i];
    if(ch==='\\'&&quote!=="'"){
      if(i===raw.length-1)return null;
      i++;continue;
    }
    if(ch===quote){quote=null;continue;}
    if(!quote&&(ch==="'"||ch==='"')){quote=ch;continue;}
    if(!quote&&ch===';'){
      parts.push(raw.slice(start,i).trim());start=i+1;
    }
  }
  if(quote)return null;
  parts.push(raw.slice(start).trim());
  return parts;
}

/** Undefined: ordinary command. Null: an invalid for-loop (never execute). */
export function parseForLoop(state:LinuxState,raw:string):ForLoopSpec|null|undefined {
  if(!/^\s*for(?:\s|$)/u.test(raw))return undefined;
  if(raw.length>640||raw.includes('\n')||raw.includes('\r'))return null;
  const parts=splitStatements(raw);
  if(!parts||parts.length!==3||parts[2]!=='done')return null;
  const environment={...state.variables,HOME:'/home/player',PWD:state.cwd};
  const header=expandVirtualWords(parts[0],environment,previousExitCode(state));
  if(!header||header.words.length<4||header.words[0]!=='for'||
     header.words[2]!=='in'||!validName(header.words[1]))return null;
  const variable=header.words[1];
  if(variable==='HOME'||variable==='PWD')return null;
  const values=header.words.slice(3);
  if(values.length<1||values.length>FOR_LIMIT||
     values.some(v=>v.length>VARIABLE_VALUE_LIMIT))return null;
  const old=state.variables??{};
  if(!Object.hasOwn(old,variable)&&Object.keys(old).length>=VARIABLE_LIMIT)return null;
  const bodyMatch=/^do\s+(.+)$/su.exec(parts[1]);
  if(!bodyMatch)return null;
  const body=bodyMatch[1].trim();
  if(!body||/^\s*(for|done|do)(?:\s|$)/u.test(body))return null;
  const tokens=scanShell(body);
  if(!tokens||!tokens.length||tokens.some(t=>t.kind!=='word'))return null;
  // Validate body lexing before any iteration or filesystem mutation.
  if(!expandVirtualWords(body,{...environment,[variable]:values[0]},previousExitCode(state)))return null;
  return {variable,values,body};
}

/** Bash-like: continue through body errors; last iteration determines status.
 * The loop variable remains bound to its final value. No host execution.
 */
export function executeForLoop(
  state:LinuxState,spec:ForLoopSpec,
  execute:(state:LinuxState,raw:string)=>CommandResult
):CommandResult {
  let current=state;
  const trace:ForStep[]=[];
  const lines:string[]=[];
  let last:CommandResult|undefined;
  for(const value of spec.values){
    current={...current,variables:{...current.variables,[spec.variable]:value}};
    const result=execute(current,spec.body);
    current=result.state;
    last=result;
    trace.push({value,command:result.command,target:result.target,
      exitCode:result.exitCode,ok:result.ok,refs:result.variableRefs??[]});
    if(result.output)lines.push(result.output);
  }
  return {state:current,command:'for',target:spec.variable,
    output:lines.join('\n'),ok:last?.ok===true,
    loopTrace:trace};
}
