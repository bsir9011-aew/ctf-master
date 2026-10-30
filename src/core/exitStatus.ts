import type {CommandResult,LinuxState} from './linux.ts';

/** Exit status of the last complete virtual command. Legacy sessions default to 0. */
export function previousExitCode(state:LinuxState):number {
  const code=state.lastExitCode;
  return typeof code==='number'&&Number.isSafeInteger(code)&&code>=0&&code<=255
    ?code:0;
}

/** Deliberately small, predictable mapping (not full Bash/POSIX):
 * success = 0, grep no-match = 1, other runtime failures = 1,
 * invalid syntax/grep error = 2, unknown command = 127.
 */
export function resultExitCode(result:CommandResult):number {
  if(result.ok)return 0;
  const message=result.output.toLowerCase();
  if(message.includes('command not found'))return 127;
  if(result.command==='grep')return message.includes('brak dopasowan')?1:2;
  if(message.includes('niepoprawna skladnia')||
     message.includes('niepoprawne cytowanie')||
     message.includes('uzycie:')||
     message.includes('niepoprawne parametry')||
     message.includes('nieznana opcja')||
     message.includes('nieobslugiwany operator'))return 2;
  return 1;
}

/** Set status once for the outer command; do not mutate a nested pipeline stage. */
export function finishCommand(result:CommandResult):CommandResult {
  const code=resultExitCode(result);
  const current=previousExitCode(result.state);
  const next=result.state.lastExitCode===code
    ?result.state
    : current===code && code===0 && result.state.lastExitCode===undefined
      ?result.state
      :{...result.state,lastExitCode:code};
  return {...result,state:next,exitCode:code};
}

const LAB='/home/player/practice';
const CASES={
  intro:{
    file:LAB+'/events.log',absent:'FATAL',present:'WARN',
    observation:'WARN backup delayed'
  },
  transfer:{
    file:LAB+'/logs/review.log',absent:'CRITICAL',present:'ERROR',
    observation:'ERROR temp'
  }
} as const;
export type StatusVariant=keyof typeof CASES;
export const statusCase=(variant:StatusVariant)=>CASES[variant];

/** Observe a failed search's exit code immediately; then a successful search.
 * An intervening command would overwrite $? - including echo itself.
 */
export function statusCompleted(variant:StatusVariant,events:readonly CommandResult[]):boolean {
  const c=CASES[variant];
  for(let index=0;index+3<events.length;index++){
    const [missing,readMissing,matching,readMatching]=events.slice(index,index+4);
    if(missing.command==='grep'&&!missing.ok&&missing.exitCode===1&&
       missing.target===c.file&&missing.filterPattern===c.absent&&
       readMissing.command==='echo'&&readMissing.ok&&readMissing.target==='previous-exit'&&
       readMissing.output==='1'&&
       matching.command==='grep'&&matching.ok&&matching.exitCode===0&&
       matching.target===c.file&&matching.filterPattern===c.present&&
       matching.output.includes(c.observation)&&
       readMatching.command==='echo'&&readMatching.ok&&readMatching.target==='previous-exit'&&
       readMatching.output==='0')return true;
  }
  return false;
}
