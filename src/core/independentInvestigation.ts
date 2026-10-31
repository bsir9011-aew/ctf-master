import type {CommandResult,LinuxState} from './linux.ts';
import {modeOf} from './permissions.ts';

/** Independent transfer: this incident is NOT a blocked parent directory.
 * The directory is traversable; the file itself has no owner read bit.
 * Keep the evidence virtual, and never modify pre-existing user files on seed.
 */
const ROOT='/home/player/downloads';
export const independentCase=Object.freeze({
  ticket:ROOT+'/shift22-ticket.txt',
  directory:ROOT+'/shift22',
  evidence:ROOT+'/shift22/audit-export.log',
  decoy:ROOT+'/shift22/status.log',
  copy:'/home/player/documents/shift22-verified-copy.log',
  ticketBody:'INC-022 | 05:16 | Audit shift reports a permission error while reading a rotated export.\nThe file was present at /home/player/downloads/shift22/audit-export.log. Preserve the original and verify an evidence copy. Avoid granting access to groups or other users.\n',
  evidenceBody:'05:12 AUDIT batch=42 result=sealed\n05:15 AUDIT batch=43 result=queued\n',
  decoyBody:'05:13 INFO service healthy\n05:16 INFO backup heartbeat stable\n'
});
export interface IndependentCaseState {seeded:true}
export interface IndependentProgress {
  observed:boolean;
  diagnosed:boolean;
  repaired:boolean;
  verified:boolean;
  completed:boolean;
}

export function seedIndependentCase(state:LinuxState):LinuxState {
  if(state.independentCase?.seeded)return state;
  const c=independentCase;
  const files={...state.files};
  for(const [path,body] of Object.entries({
    [c.ticket]:c.ticketBody,
    [c.evidence]:c.evidenceBody,
    [c.decoy]:c.decoyBody
  }))if(!Object.hasOwn(files,path))files[path]=body;
  const permissions={...state.permissions};
  for(const [path,mode] of Object.entries({
    [c.directory]:0o700,
    [c.ticket]:0o644,
    [c.evidence]:0o200,
    [c.decoy]:0o644
  }))if(!Object.hasOwn(permissions,path))permissions[path]=mode;
  return {...state,independentCase:{seeded:true},
    dirs:state.dirs.includes(c.directory)?state.dirs:[...state.dirs,c.directory],
    files,permissions};
}
const isRead=(e:CommandResult,path:string,body:string):boolean=>
  e.ok&&e.command==='cat'&&e.target===path&&e.output===body;

const diag=(e:CommandResult):boolean=>{
  const c=independentCase;
  return (e.ok&&e.command==='stat'&&e.target===c.evidence&&
      e.output.includes('mode 200'))||
    (e.ok&&e.command==='namei'&&e.target===c.evidence&&
      e.output.includes('-w-------')&&!e.blockedAt);
};

const testPair=(events:readonly CommandResult[],after:number):number=>{
  // Both observations are needed: the parent IS traversable, but the
  // target file IS NOT readable. A single failed -r is ambiguous.
  const x=events.findIndex((e,i)=>i>after&&e.command==='test'&&
    e.testFlag==='-x'&&e.target===independentCase.directory&&e.exitCode===0);
  if(x<0)return -1;
  return events.findIndex((e,i)=>i>x&&e.command==='test'&&
    e.testFlag==='-r'&&e.target===independentCase.evidence&&e.exitCode===1);
};

/** Require observed denial, reasoned diagnosis and minimal file-only repair.
 * Final artifacts without those steps never complete the new case.
 */
export function independentProgress(
  state:LinuxState,events:readonly CommandResult[]
):IndependentProgress{
  const reset={observed:false,diagnosed:false,repaired:false,verified:false,completed:false};
  const c=independentCase;
  if(!state.independentCase?.seeded||
     state.files[c.ticket]!==c.ticketBody||
     state.files[c.evidence]!==c.evidenceBody||
     state.files[c.decoy]!==c.decoyBody||
     modeOf(state,c.ticket)!==0o644||
     modeOf(state,c.decoy)!==0o644||
     modeOf(state,c.directory)!==0o700)return reset;

  const ticket=events.findIndex(e=>isRead(e,c.ticket,c.ticketBody));
  const denied=events.findIndex((e,i)=>i>ticket&&ticket>=0&&
    e.command==='cat'&&!e.ok&&e.target===c.evidence&&
    e.output.includes('Permission denied'));
  const observed=ticket>=0&&denied>=0;
  if(!observed)return reset;

  const single=events.findIndex((e,i)=>i>denied&&diag(e));
  const pair=testPair(events,denied);
  const diagnosed=single>=0||pair>=0;
  if(!diagnosed)return {...reset,observed};
  const afterDiagnosis=single>=0&&pair>=0?Math.min(single,pair):Math.max(single,pair);

  // Reject widened group/other rights even if later undone.
  const unsafe=events.some(e=>e.ok&&e.command==='chmod'&&
    (e.target===c.evidence||e.target===c.directory)&&
    ((e.target===c.evidence && ((modeOf(e.state,c.evidence)&0o077)!==0))||
      (e.target===c.directory&&modeOf(e.state,c.directory)!==0o700)));
  if(unsafe)return {...reset,observed,diagnosed};

  const fix=events.findIndex((e,i)=>i>afterDiagnosis&&e.ok&&
    e.command==='chmod'&&e.target===c.evidence&&
    modeOf(e.state,c.evidence)===0o600);
  const readBack=events.findIndex((e,i)=>i>fix&&fix>=0&&isRead(e,c.evidence,c.evidenceBody));
  const repaired=fix>=0&&readBack>=0&&modeOf(state,c.evidence)===0o600;
  if(!repaired)return {...reset,observed,diagnosed};

  const copied=events.findIndex((e,i)=>i>readBack&&e.ok&&
    e.command==='cp'&&e.target===c.copy&&
    e.state.files[c.copy]===c.evidenceBody);
  const verified=copied>=0&&state.files[c.copy]===c.evidenceBody&&
    modeOf(state,c.copy)===0o644&&
    events.some((e,i)=>i>copied&&isRead(e,c.copy,c.evidenceBody));
  return {observed,diagnosed,repaired,verified,completed:verified};
}
