import type {CommandResult,LinuxState} from './linux.ts';
import {modeOf} from './permissions.ts';
import {opsCase,opsHttpProbe} from './opsRecovery.ts';

const ROOT='/home/player/documents/cases';
export const responseCase=Object.freeze({
  live:ROOT+'/case19-api.conf',
  backup:ROOT+'/case19-api.safe.conf',
  endpoint:'http://api.ctf.test/health',
  oldConfig:'POOL_LIMIT=1\n',
  safeConfig:'POOL_LIMIT=8\n'
});
export interface ResponseRuntime {appliedPoolLimit:number}
export interface ResponseProgress {
  baseline:boolean;
  diagnosed:boolean;
  rollback:boolean;
  verified:boolean;
  completed:boolean;
}

/** New case data appears only on entering mission 19; never overwrite files
 * already present in a user session, including failed recovery attempts.
 */
export function seedResponseCase(state:LinuxState):LinuxState {
  const c=responseCase;
  const add:Record<string,string>={};
  if(!Object.hasOwn(state.files,c.live))add[c.live]=c.oldConfig;
  if(!Object.hasOwn(state.files,c.backup))add[c.backup]=c.safeConfig;
  if(state.response&&Object.keys(add).length===0)return state;
  return {...state,files:{...add,...state.files},
    response:state.response??{appliedPoolLimit:1}};
}
const configuredLimit=(text:string|undefined):number=>{
  if(!text)return 0;
  const match=/^POOL_LIMIT=(\d+)\n?$/.exec(text);
  const value=match?Number(match[1]):0;
  return Number.isSafeInteger(value)&&value>=1&&value<=1000?value:0;
};

/** systemctl restart applies the currently saved configuration, while
 * cp by itself only updates the file on disk. This is virtual state only.
 */
export function applyResponseRestart(result:CommandResult,args:readonly string[]):CommandResult {
  if(!result.ok||!result.state.response||args.length!==2||
     args[0]!=='restart'||!['api','api.service'].includes(args[1]))return result;
  return {...result,state:{
    ...result.state,
    response:{appliedPoolLimit:configuredLimit(result.state.files[responseCase.live])}
  }};
}

/** No browser fetch, network access or host curl. This diagnostic models the
 * HTTP response and intentionally returns command exit 0 even for HTTP 503,
 * like curl without --fail.
 */
export function executeResponseCurl(state:LinuxState,args:readonly string[]):CommandResult{
  if(args.length===2&&args[0]==='-i'&&args[1]===opsCase.endpoint&&
    state.ops?.scenario==='queue-outage')return opsHttpProbe(state);
  if(args.length!==2||args[0]!=='-i'||args[1]!==responseCase.endpoint||!state.response)
    return {state,ok:false,command:'curl',
      output:'Uzycie: curl -i '+responseCase.endpoint+' (tylko symulowany endpoint)'};
  const runtime=state.response.appliedPoolLimit;
  const services=state.services;
  const api=services?.api?.status==='active';
  const sshd=services?.sshd?.status==='active';
  const queue=services?.queue?.status==='active';
  const healthy=runtime===8&&api&&sshd&&queue;
  const reason=!api?'API_STOPPED':
    !sshd?'SSH_ACCESS_LOST':
    !queue?'QUEUE_STOPPED':
    runtime===1?'DB_POOL_EXHAUSTED':
    runtime===8?'OK':
    runtime>8?'DB_CAPACITY_RISK':'INVALID_POOL_CONFIG';
  return {
    state,ok:true,command:'curl',target:'api-health',
    output:healthy
      ?'HTTP/1.1 200 OK\nService: api\nPool active: 8\nStatus: HEALTHY'
      :'HTTP/1.1 503 Service Unavailable\nService: api\nPool active: '+
       runtime+'\nStatus: DEGRADED\nReason: '+reason
  };
}
const oldProbe=(e:CommandResult)=>
  e.ok&&e.command==='curl'&&e.target==='api-health'&&
  e.output.includes('HTTP/1.1 503')&&
  e.state.response?.appliedPoolLimit===1;
const fileRead=(e:CommandResult,path:string,body:string)=>
  e.ok&&e.command==='cat'&&e.target===path&&e.output===body;

/** The mission checks a causal chain instead of accepting a final-looking
 * file: failure observed, both configurations read, rollback copied, api
 * restarted to load it, then the simulated HTTP endpoint recovered.
 */
export function responseProgress(state:LinuxState,events:readonly CommandResult[]):ResponseProgress {
  const reset={baseline:false,diagnosed:false,rollback:false,verified:false,completed:false};
  const c=responseCase;
  const backupIntact=state.files[c.backup]===c.safeConfig&&
    modeOf(state,c.backup)===0o644;
  if(!backupIntact)return reset;
  const failed=events.findIndex(oldProbe);
  const baseline=failed>=0;
  if(!baseline)return reset;
  const liveRead=events.findIndex((e,i)=>i>failed&&fileRead(e,c.live,c.oldConfig));
  const backupRead=events.findIndex((e,i)=>i>failed&&fileRead(e,c.backup,c.safeConfig));
  const diagnosed=liveRead>=0&&backupRead>=0;
  if(!diagnosed)return {...reset,baseline};
  const afterRead=Math.max(liveRead,backupRead);
  const copied=events.findIndex((e,i)=>i>afterRead&&e.ok&&
    e.command==='cp'&&e.target===c.live&&
    e.state.files[c.live]===c.safeConfig);
  const rollback=copied>=0&&state.files[c.live]===c.safeConfig&&
    modeOf(state,c.live)===0o644;
  if(!rollback)return {...reset,baseline,diagnosed};
  const restarted=events.findIndex((e,i)=>i>copied&&e.ok&&
    e.command==='systemctl'&&e.target==='api.service'&&
    e.state.response?.appliedPoolLimit===8&&
    e.state.services?.api?.status==='active');
  const healthy=events.findIndex((e,i)=>i>restarted&&restarted>=0&&e.ok&&
    e.command==='curl'&&e.target==='api-health'&&
    e.output.includes('HTTP/1.1 200 OK')&&e.output.includes('Status: HEALTHY'));
  const verified=healthy>=0&&state.response?.appliedPoolLimit===8&&
    state.services?.api?.status==='active'&&
    state.services?.sshd?.status==='active'&&
    state.services?.queue?.status==='active'&&
    state.files[c.live]===c.safeConfig;
  return {baseline,diagnosed,rollback,verified,completed:verified};
}
