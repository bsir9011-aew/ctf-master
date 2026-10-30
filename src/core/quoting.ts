import type {CommandResult,LinuxState} from './linux.ts';

const LAB='/home/player/practice';
const CASES={
  intro:{
    source:LAB+'/report draft.txt',
    target:LAB+'/final report.txt',
    content:'REPORT: service restored\n'
  },
  transfer:{
    source:LAB+'/logs/audit notes.txt',
    target:LAB+'/logs/incident notes.txt',
    content:'AUDIT: permissions verified\n'
  }
} as const;

export type QuotingVariant=keyof typeof CASES;
export const quotingCase=(variant:QuotingVariant)=>CASES[variant];

/** Moving the actual spaced-name source and reading it afterward proves the
 * learner formed one pathname argument, rather than changing an unrelated file.
 */
export function quotingCompleted(
  variant:QuotingVariant,state:LinuxState,events:readonly CommandResult[]
):boolean {
  const c=CASES[variant];
  if(Object.hasOwn(state.files,c.source)||state.files[c.target]!==c.content)return false;
  const moved=events.findIndex(r=>r.ok&&r.command==='mv'&&
    r.target===c.target&&r.state.files[c.target]===c.content&&
    !Object.hasOwn(r.state.files,c.source));
  if(moved<0)return false;
  return events.slice(moved+1).some(r=>r.ok&&r.command==='cat'&&
    r.target===c.target&&r.output===c.content);
}
