import {modeOf} from './permissions.ts';
import type {CommandResult,LinuxState} from './linux.ts';

const ROOT='/home/player/documents/cases';
const paths={
  edge:ROOT+'/case18-edge.log',
  auth:ROOT+'/case18-auth.log',
  db:ROOT+'/case18-db.log',
  deploy:ROOT+'/case18-deploy.log',
  host:ROOT+'/case18-host.log'
} as const;

const fixtures:Record<string,string>={
  [paths.edge]:'02:11 INFO upstream healthy\n02:14 ERROR HTTP_502 upstream=db-api timeout\n',
  [paths.auth]:'02:13 WARN AUTH_FAILURE unknown user from 203.0.113.10\n02:15 INFO sshd still running\n',
  [paths.db]:'02:11 INFO database pool active\n02:14 ERROR POOL_EXHAUSTED waiting_for_connection\n',
  [paths.deploy]:'02:12 INFO rollout completed\n02:12 CHANGE POOL_LIMIT_REDUCED from=8 to=1\n',
  [paths.host]:'02:14 INFO DISK_OK usage=48pct\n02:14 INFO CPU_OK usage=22pct\n'
};
const markers={
  [paths.edge]:'HTTP_502',
  [paths.auth]:'AUTH_FAILURE',
  [paths.db]:'POOL_EXHAUSTED',
  [paths.deploy]:'POOL_LIMIT_REDUCED',
  [paths.host]:'DISK_OK'
};
export const hypothesisCase=Object.freeze({
  ...paths,
  dbEvidence:ROOT+'/case18-db-evidence.log',
  deployEvidence:ROOT+'/case18-deploy-evidence.log',
  report:ROOT+'/case18-analysis.log',
  options:['auth-attack','disk-pressure','pool-exhaustion'] as const
});

export type HypothesisId=(typeof hypothesisCase.options)[number];
export type Confidence='low'|'medium'|'high';

export function seedHypothesisCase(state:LinuxState):LinuxState {
  const missing=Object.entries(fixtures).filter(([path])=>!Object.hasOwn(state.files,path));
  if(missing.length===0)return state;
  return {...state,files:{...Object.fromEntries(missing),...state.files}};
}

export function executeHypothesis(
  state:LinuxState,args:readonly string[]
):CommandResult {
  const [id,confidence]=args;
  if(args.length!==2||
    !hypothesisCase.options.includes(id as HypothesisId)||
    !['low','medium','high'].includes(confidence)){
    return {state,ok:false,command:'hypothesis',
      output:'Uzycie: hypothesis <auth-attack|disk-pressure|pool-exhaustion> <low|medium|high>'};
  }
  return {
    state,ok:true,command:'hypothesis',target:id,hypothesisConfidence:confidence as Confidence,
    output:'Hipoteza i poziom pewnosci zapisane w historii prob. Zweryfikuj je na podstawie zrodel.'
  };
}

export interface HypothesisProgress {
  examined:boolean;
  assessed:boolean;
  evidence:boolean;
  report:boolean;
  completed:boolean;
}

const seen=(r:CommandResult,path:string,marker:string,body:string):boolean=>
  r.ok&&['grep','cat','head','tail'].includes(r.command)&&
  r.target===path&&r.output.includes(marker)&&
  r.state.files[path]===body;

/** A diagnosis is grounded in source inspection before the selected
 * hypothesis; the two complete originals are copied before the report.
 * Distinct decoy logs must stay intact too.
 */
export function hypothesisProgress(state:LinuxState,events:readonly CommandResult[]):HypothesisProgress {
  const reset={examined:false,assessed:false,evidence:false,report:false,completed:false};
  const intact=Object.entries(fixtures).every(([path,body])=>
    state.files[path]===body&&modeOf(state,path)===0o644);
  if(!intact)return reset;
  const indices=Object.entries(markers).map(([path,marker])=>
    events.findIndex(e=>seen(e,path,marker,fixtures[path])));
  const examined=indices.every(i=>i>=0);
  if(!examined)return reset;
  const afterReads=Math.max(...indices);
  const decision=events.findIndex((e,i)=>i>afterReads&&
    e.ok&&e.command==='hypothesis'&&
    e.target==='pool-exhaustion'&&
    ['low','medium','high'].includes(e.hypothesisConfidence??''));
  const assessed=decision>=0;
  if(!assessed)return {...reset,examined};
  const c=hypothesisCase;
  const copy=(source:string,target:string)=>{
    return events.findIndex((e,i)=>i>decision&&
      e.ok&&e.command==='cp'&&e.target===target&&
      e.state.files[target]===fixtures[source]);
  };
  const dbCopy=copy(c.db,c.dbEvidence),deployCopy=copy(c.deploy,c.deployEvidence);
  const evidence=dbCopy>=0&&deployCopy>=0&&
    state.files[c.dbEvidence]===fixtures[c.db]&&
    state.files[c.deployEvidence]===fixtures[c.deploy];
  if(!evidence)return {...reset,examined,assessed};
  const afterCopies=Math.max(dbCopy,deployCopy);
  const deployLine=fixtures[c.deploy].split('\n').find(s=>s.includes('POOL_LIMIT_REDUCED'))!;
  const dbLine=fixtures[c.db].split('\n').find(s=>s.includes('POOL_EXHAUSTED'))!;
  const first=deployLine+'\n',full=first+dbLine+'\n';
  const written=events.findIndex((e,i)=>i>afterCopies&&
    e.ok&&e.command==='redirect'&&e.redirectMode==='overwrite'&&
    e.sourceCommand==='grep'&&e.target===c.report&&
    e.state.files[c.report]===first);
  const appended=events.findIndex((e,i)=>i>written&&written>=0&&
    e.ok&&e.command==='redirect'&&e.redirectMode==='append'&&
    e.sourceCommand==='grep'&&e.target===c.report&&
    e.state.files[c.report]===full);
  const report=appended>=0&&state.files[c.report]===full&&
    events.some((e,i)=>i>appended&&e.ok&&e.command==='cat'&&
      e.target===c.report&&e.output===full);
  return {examined,assessed,evidence,report,completed:report};
}
