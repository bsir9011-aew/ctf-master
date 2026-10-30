import type { CommandResult, LinuxState } from './linux.ts';
import {modeOf} from './permissions.ts';

export type RecoveryVariant='intro'|'transfer';

const LAB='/home/player/practice';
const CASES={
  intro:{
    directory:LAB+'/diagnostics',
    file:LAB+'/diagnostics/service.log',
    content:'SERVICE: started after backup\n'
  },
  transfer:{
    directory:LAB+'/logs/locked',
    file:LAB+'/logs/locked/health.log',
    content:'HEALTH: daemon ready\n'
  }
} as const;

export function recoveryFixture(variant:RecoveryVariant) {
  return CASES[variant];
}

/** Detect rather than guess: namei identifies a blocked directory,
 * chmod restores only its missing owner-x, and a subsequent read confirms.
 * Output and final state must match the fixture, not the user's input string.
 */
export function recoveryCompleted(
  variant:RecoveryVariant,
  state:LinuxState,
  events:readonly CommandResult[]
):boolean {
  const scenario=CASES[variant];
  if(modeOf(state,scenario.directory)!==0o700||
     state.files[scenario.file]!==scenario.content) return false;
  const diagnosticIndex=events.findIndex(r=>
    r.ok&&r.command==='namei'&&r.target===scenario.file&&
    r.blockedAt===scenario.directory);
  if(diagnosticIndex<0)return false;
  const fixedIndex=events.findIndex((r,i)=>i>diagnosticIndex&&r.ok&&
    r.command==='chmod'&&r.target===scenario.directory);
  if(fixedIndex<0)return false;
  return events.slice(fixedIndex+1).some(r=>r.ok&&r.command==='cat'&&
    r.target===scenario.file&&r.output===scenario.content);
}
