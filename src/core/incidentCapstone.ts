import {initialLinux,type CommandResult,type LinuxState} from './linux.ts';
import {modeOf} from './permissions.ts';

/** A capstone over pre-existing virtual logs, so prior saved sessions require
 * neither a reset nor new seeded files. No real logs or host APIs are used.
 */
const ROOT='/home/player/documents';
export const incidentCase=Object.freeze({
  auth:'/var/log/auth.log',
  app:'/var/log/app.log',
  authEvidence:ROOT+'/case17-auth-evidence.log',
  appEvidence:ROOT+'/case17-app-evidence.log',
  report:ROOT+'/case17-report.log',
  authMarker:'DENIED sshd failed login for root',
  appMarker:'ALERT anomalous access detected'
});

export interface IncidentCaseProgress {
  observed:boolean;
  preserved:boolean;
  correlated:boolean;
  verified:boolean;
  completed:boolean;
}

const lineWith=(text:string,marker:string)=>
  text.split('\n').find(line=>line.includes(marker));

const observation=(e:CommandResult,path:string,marker:string,sourceText:string)=>
  e.ok&&e.command==='grep'&&e.target===path&&
  e.output.includes(marker)&&e.state.files[path]===sourceText;

/** The copy must be inside a real successful test -f && cp chain. A direct cp,
 * a bypassed condition or a fabricated file does not count as a guarded copy.
 */
const guardedCopy=(e:CommandResult,source:string,destination:string,body:string):boolean=>{
  if(e.command!=='conditional'||!e.ok||e.state.files[destination]!==body)return false;
  const trace=e.conditionalTrace;
  if(!trace||trace.length!==2)return false;
  const [guard,copy]=trace;
  return guard.executed&&guard.command==='test'&&guard.testFlag==='-f'&&
    guard.target===source&&guard.exitCode===0&&
    copy.operator==='&&'&&copy.executed&&copy.command==='cp'&&
    copy.target===destination&&copy.exitCode===0;
};

const isRedirect=(e:CommandResult,mode:'overwrite'|'append',text:string)=>
  e.ok&&e.command==='redirect'&&e.redirectMode===mode&&
  e.sourceCommand==='grep'&&e.target===incidentCase.report&&
  e.state.files[incidentCase.report]===text;

/** Four ordered evidence checkpoints. Independent observations and effects are
 * both required; inspecting/copying a decoy or only writing final filenames
 * cannot pass. All event scans use the existing per-mission bounded history.
 */
export function incidentCaseProgress(
  state:LinuxState,events:readonly CommandResult[]
):IncidentCaseProgress{
  const c=incidentCase;
  const seed=initialLinux();
  const authOriginal=seed.files[c.auth],appOriginal=seed.files[c.app];
  const authLine=lineWith(authOriginal,c.authMarker);
  const appLine=lineWith(appOriginal,c.appMarker);
  if(!authLine||!appLine)return {
    observed:false,preserved:false,correlated:false,verified:false,completed:false
  };
  const integrity=state.files[c.auth]===authOriginal&&
    state.files[c.app]===appOriginal&&
    modeOf(state,c.auth)===modeOf(seed,c.auth)&&
    modeOf(state,c.app)===modeOf(seed,c.app);
  const authSeen=events.findIndex(e=>observation(e,c.auth,c.authMarker,authOriginal));
  const appSeen=events.findIndex(e=>observation(e,c.app,c.appMarker,appOriginal));
  const observed=integrity&&authSeen>=0&&appSeen>=0;
  const afterObservations=Math.max(authSeen,appSeen);
  const authCopy=events.findIndex((e,i)=>i>afterObservations&&
    guardedCopy(e,c.auth,c.authEvidence,authOriginal));
  const appCopy=events.findIndex((e,i)=>i>afterObservations&&
    guardedCopy(e,c.app,c.appEvidence,appOriginal));
  const preserved=observed&&authCopy>=0&&appCopy>=0&&
    state.files[c.authEvidence]===authOriginal&&
    state.files[c.appEvidence]===appOriginal;
  const afterCopies=Math.max(authCopy,appCopy);
  const reportHead=appLine+'\n',reportFull=reportHead+authLine+'\n';
  const head=events.findIndex((e,i)=>preserved&&i>afterCopies&&
    isRedirect(e,'overwrite',reportHead));
  const tail=events.findIndex((e,i)=>head>=0&&i>head&&
    isRedirect(e,'append',reportFull));
  const correlated=preserved&&tail>=0&&state.files[c.report]===reportFull;
  const verified=correlated&&events.some((e,i)=>i>tail&&e.ok&&
    e.command==='cat'&&e.target===c.report&&e.output===reportFull);
  return {observed,preserved,correlated,verified,completed:verified};
}
