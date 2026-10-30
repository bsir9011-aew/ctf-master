import type {CommandResult,LinuxState} from './linux.ts';
import {canTraverse,canWriteDir,hasAccess} from './permissions.ts';
import {identityOf} from './identity.ts';
import {newFileMode} from './umask.ts';
import {scanShell} from './shellSyntax.ts';
import {splitPipeline} from './pipelines.ts';

type RedirectMode='overwrite'|'append';
export interface RedirectSpec {source:string;destination:string;mode:RedirectMode}
const READ_ONLY=new Set([
  'cat','grep','head','tail','wc','sort','uniq',
  'pwd','ls','find','stat','whoami','id','groups','ps','journalctl'
]);

/** Parse one output redirect, ignoring quoted and escaped operators.
 * undefined = no redirection, null = multiple/malformed redirects.
 */
export function parseRedirection(raw:string):RedirectSpec|undefined|null {
  const tokens=scanShell(raw);
  if(!tokens)return undefined; // let the ordinary/pipeline parser report malformed quoting
  const operators=tokens.filter(t=>t.kind==='overwrite'||t.kind==='append');
  if(operators.length===0)return undefined;
  if(operators.length!==1)return null;
  const operator=operators[0];
  const index=tokens.indexOf(operator);
  const dest=tokens[index+1];
  if(index===0||tokens.length!==index+2||dest.kind!=='word'||!dest.value)
    return null;
  const source=raw.slice(0,operator.start).trim();
  if(!source)return null;
  return {source,destination:dest.value,
    mode:operator.kind==='append'?'append':'overwrite'};
}

const parent=(p:string)=>p.slice(0,p.lastIndexOf('/'))||'/';
const failure=(state:LinuxState,message:string):CommandResult=>({
  state,output:'przekierowanie: '+message,ok:false,command:'redirect'
});

export function executeRedirection(
  state:LinuxState,spec:RedirectSpec,
  tokenize:(raw:string)=>string[]|null,
  resolve:(path:string)=>string,
  run:(raw:string)=>CommandResult
):CommandResult {
  const segments=splitPipeline(spec.source);
  const stage=segments?tokenize(segments[0])?.[0]:undefined;
  if(!stage||!READ_ONLY.has(stage))
    return failure(state,'mozna zapisac tylko wynik polecenia odczytujacego');
  const destination=resolve(spec.destination);
  if(state.dirs.includes(destination))
    return failure(state,'cel jest katalogiem');
  if(!state.dirs.includes(parent(destination)))
    return failure(state,'katalog docelowy nie istnieje');
  const exists=Object.hasOwn(state.files,destination);
  if(exists
    ? !canTraverse(state,destination)||!hasAccess(state,destination,'w')
    : !canWriteDir(state,parent(destination)))
    return failure(state,'Permission denied');
  const result=run(spec.source);
  if(!result.ok||result.state!==state)
    return failure(state,result.ok?'zrodlo zmienia stan sesji':result.output);
  if(result.target===destination)
    return failure(state,'nie kieruj odczytu pliku do niego samego');
  // Existing command output omits the terminal's final LF, except for cat.
  // Restore it for text commands; cat preserves its original bytes.
  const stdout=result.command==='cat'||!result.output
    ?result.output:result.output+'\n';
  const before=exists?state.files[destination]:'';
  const content=spec.mode==='append'?before+stdout:stdout;
  const current=identityOf(state);
  const next:LinuxState={
    ...state,
    files:{...state.files,[destination]:content},
    ownership:exists?state.ownership:{
      ...state.ownership,[destination]:{uid:current.uid,gid:current.primary.gid}},
    permissions:exists?state.permissions:{
      ...state.permissions,[destination]:newFileMode(state)}
  };
  return {
    state:next,output:'',ok:true,command:'redirect',target:destination,
    redirectMode:spec.mode,sourceCommand:result.command
  };
}

const LAB='/home/player/practice';
const CASES={
  intro:{
    source:LAB+'/alerts.log',
    target:LAB+'/alerts-summary.log',
    warning:'WARN storage\nWARN auth\nWARN storage\nWARN auth\n',
    rest:'INFO ready\nINFO heartbeat\n',
    original:'WARN storage\nINFO ready\nWARN auth\nWARN storage\nINFO heartbeat\nWARN auth\n'
  },
  transfer:{
    source:LAB+'/logs/incidents.log',
    target:LAB+'/incidents-summary.log',
    warning:'ERROR disk\nERROR network\nERROR disk\nERROR memory\nERROR network\n',
    rest:'INFO ready\nINFO sync\n',
    original:'ERROR disk\nINFO ready\nERROR network\nERROR disk\nERROR memory\nINFO sync\nERROR network\n'
  }
} as const;
export type RedirectionVariant=keyof typeof CASES;
export const redirectionCase=(variant:RedirectionVariant)=>CASES[variant];

/** Require two distinct writes and a later read, not a pre-created answer file. */
export function redirectionCompleted(
  variant:RedirectionVariant,state:LinuxState,events:readonly CommandResult[]
):boolean {
  const c=CASES[variant];
  const finished=c.warning+c.rest;
  if(state.files[c.source]!==c.original||state.files[c.target]!==finished)return false;
  const first=events.findIndex(r=>r.ok&&r.command==='redirect'&&
    r.target===c.target&&r.redirectMode==='overwrite'&&
    r.sourceCommand==='grep'&&r.state.files[c.target]===c.warning);
  if(first<0)return false;
  const second=events.findIndex((r,index)=>index>first&&r.ok&&
    r.command==='redirect'&&r.target===c.target&&r.redirectMode==='append'&&
    r.sourceCommand==='grep'&&r.state.files[c.target]===finished);
  if(second<0)return false;
  return events.slice(second+1).some(r=>r.ok&&r.command==='cat'&&
    r.target===c.target&&r.output===finished);
}
