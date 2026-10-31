import type {CommandResult,LinuxState} from './linux.ts';
import {modeOf} from './permissions.ts';

const ROOT='/home/player/documents/cases';
export const blindCase=Object.freeze({
  ticket:ROOT+'/case21-ticket.txt',
  distraction:ROOT+'/case21-app.log',
  directory:ROOT+'/case21-audit',
  evidence:ROOT+'/case21-audit/evidence.log',
  copy:ROOT+'/case21-evidence-copy.log',
  ticketBody:'INC-021 | 07:42 | audit export: permission denied\nSource: /home/player/documents/cases/case21-audit/evidence.log\nRequirement: recover read access without widening group/other rights; retain original and preserve a verified evidence copy.\n',
  decoyBody:'07:40 INFO frontend ready\n07:41 WARN health latency 210ms\n07:42 INFO frontend recovered\n',
  evidenceBody:'07:39 AUDIT event_id=5827 user=svc report_export=complete\n07:41 AUDIT event_id=5830 user=analyst evidence_handoff=pending\n'
});

export interface BlindCaseState {seeded:true}
export interface BlindProgress {
  observed:boolean;
  diagnosed:boolean;
  recovered:boolean;
  preserved:boolean;
  completed:boolean;
}

/** Seed only when entering / restoring mission 21. Mark first entry so a
 * user's later file removal cannot accidentally recreate their evidence.
 */
export function seedBlindCase(state:LinuxState):LinuxState{
  if(state.blindCase?.seeded)return state;
  const c=blindCase;
  const defaults:Record<string,string>={
    [c.ticket]:c.ticketBody,[c.distraction]:c.decoyBody,[c.evidence]:c.evidenceBody
  };
  const files={...state.files};
  for(const [path,body] of Object.entries(defaults)){
    if(!Object.hasOwn(files,path))files[path]=body;
  }
  const permissions={...state.permissions};
  if(!Object.hasOwn(permissions,c.directory))permissions[c.directory]=0o600;
  if(!Object.hasOwn(permissions,c.evidence))permissions[c.evidence]=0o644;
  return {...state,blindCase:{seeded:true},
    dirs:state.dirs.includes(c.directory)?state.dirs:[...state.dirs,c.directory],
    files,permissions};
}
const read=(r:CommandResult,path:string,body:string):boolean=>
  r.ok&&r.command==='cat'&&r.target===path&&r.output===body;

const diagnostic=(r:CommandResult):boolean=>{
  const c=blindCase;
  return (r.command==='namei'&&r.ok&&r.target===c.evidence&&
      r.blockedAt===c.directory&&r.output.includes('[BRAK x'))||
    (r.command==='stat'&&r.ok&&r.target===c.directory&&
      r.output.includes('mode 600'))||
    (r.command==='test'&&r.testFlag==='-x'&&r.target===c.directory&&
      r.exitCode===1);
};

/** Check independently observed failure and causal diagnosis, rather than
 * accepting a guessed chmod plus a copied file. No exact raw commands required.
 */
export function blindProgress(
  state:LinuxState,events:readonly CommandResult[]
):BlindProgress {
  const blank={observed:false,diagnosed:false,recovered:false,preserved:false,completed:false};
  const c=blindCase;
  if(!state.blindCase?.seeded||
    state.files[c.ticket]!==c.ticketBody||
    state.files[c.evidence]!==c.evidenceBody||
    state.files[c.distraction]!==c.decoyBody||
    modeOf(state,c.ticket)!==0o644||
    modeOf(state,c.distraction)!==0o644||
    modeOf(state,c.evidence)!==0o644)return blank;
  const ticket=events.findIndex(e=>read(e,c.ticket,c.ticketBody));
  const denied=events.findIndex((e,i)=>i>ticket&&ticket>=0&&
    e.command==='cat'&&!e.ok&&
    e.output.includes('Permission denied')&&
    // cat does not set target on failure; confirm source pathname via
    // actual virtual state, and only attribute this denial when other
    // protected fixture files were not involved.
    e.state.files[c.evidence]===c.evidenceBody);
  const observed=ticket>=0&&denied>=0;
  if(!observed)return blank;
  const inspected=events.findIndex((e,i)=>i>denied&&diagnostic(e));
  const diagnosed=inspected>=0;
  if(!diagnosed)return {...blank,observed};
  const fix=events.findIndex((e,i)=>i>inspected&&
    e.ok&&e.command==='chmod'&&e.target===c.directory&&
    modeOf(e.state,c.directory)===0o700);
  const recovered=fix>=0&&modeOf(state,c.directory)===0o700&&
    events.some((e,i)=>i>fix&&read(e,c.evidence,c.evidenceBody));
  if(!recovered)return {...blank,observed,diagnosed};
  const firstRead=events.findIndex((e,i)=>i>fix&&read(e,c.evidence,c.evidenceBody));
  const copied=events.findIndex((e,i)=>i>firstRead&&e.ok&&
    e.command==='cp'&&e.target===c.copy&&
    e.state.files[c.copy]===c.evidenceBody);
  const preserved=copied>=0&&state.files[c.copy]===c.evidenceBody&&
    modeOf(state,c.copy)===0o644&&
    events.some((e,i)=>i>copied&&read(e,c.copy,c.evidenceBody));
  return {observed,diagnosed,recovered,preserved,completed:preserved};
}
