import type {CommandResult,LinuxState} from './linux.ts';
import {initialProcesses,initialServices} from './processes.ts';

/** Entirely fictional endpoint. Never perform a browser or host network request. */
export const opsCase=Object.freeze({
  endpoint:'http://ops.ctf.test/health',
  queue:'queue.service',
  ssh:'sshd.service',
  api:'api.service',
  diagnostic:'INC-020: queue worker halted following unsafe deployment'
});

export interface OpsRecovery {
  scenario:'queue-outage';
}

export interface OpsProgress {
  baseline:boolean;
  diagnosed:boolean;
  restored:boolean;
  verified:boolean;
  completed:boolean;
  sideEffects:number;
  sideEffectNotes:string[];
  availability:'healthy'|'degraded';
}

/** The scenario starts once and is thereafter never re-seeded.
 * Only this explicitly selected mission gets the simulated queue outage.
 * Preserve the rest of the filesystem, session and previously saved progress.
 */
export function seedOpsCase(state:LinuxState):LinuxState {
  if(state.ops?.scenario==='queue-outage')return state;
  const oldServices=state.services??initialServices();
  const oldProcesses=state.processes??initialProcesses();
  const updateService=(name:'queue'|'sshd'|'api',active:boolean)=>{
    const previous=oldServices[name];
    return {...previous,status:active?'active' as const:'inactive' as const,
      journal: name==='queue'
        ? [...previous.journal,'02:13 queue: worker halted after unsafe deployment']
        : previous.journal
    };
  };
  return {...state,ops:{scenario:'queue-outage'},
    services:{
      ...oldServices,
      queue:updateService('queue',false),
      sshd:updateService('sshd',true),
      api:updateService('api',true)
    },
    processes:oldProcesses.map(p=>p.service==='queue'?{...p,running:false}:
      p.service==='sshd'||p.service==='api'?{...p,running:true}:p)
  };
}

export function opsHealthy(state:LinuxState):boolean {
  return state.ops?.scenario==='queue-outage'&&
    ['queue','sshd','api'].every(name=>state.services?.[name]?.status==='active');
}

/** Similar to curl without -f: even HTTP 503 is a successful transfer. */
export function opsHttpProbe(state:LinuxState):CommandResult {
  const healthy=opsHealthy(state);
  const reason=state.services?.sshd?.status!=='active'?'SSH_ACCESS_LOST':
    state.services?.api?.status!=='active'?'API_STOPPED':
    state.services?.queue?.status!=='active'?'QUEUE_STOPPED':'OK';
  return {
    state,ok:true,command:'curl',target:'ops-health',
    output:healthy
      ? 'HTTP/1.1 200 OK\nService: ops\nStatus: HEALTHY'
      : 'HTTP/1.1 503 Service Unavailable\nService: ops\nStatus: DEGRADED\nReason: '+reason
  };
}

function operationalPenalty(events:readonly CommandResult[]):{count:number;notes:string[]}{
  const notes:string[]=[];
  for(const r of events){
    if(!r.ok)continue;
    if(r.command==='systemctl'){
      // A failed attempt leaves no system impact and is not a penalty.
      if(r.target==='sshd.service'&&r.state.services?.sshd?.status!=='active')
        notes.push('Przerwano dostęp administracyjny SSH');
      if(r.target==='api.service'&&r.state.services?.api?.status!=='active')
        notes.push('Wyłączono API podczas incydentu kolejki');
      if(r.target==='api.service'&&r.state.services?.queue?.status!=='active'&&
         r.state.services?.api?.status==='active'&&
         r.output==='api.service active')
        notes.push('Restart API nie usuwa przyczyny w kolejce');
      if(r.target==='queue.service'&&r.state.services?.queue?.status!=='active'&&
         r.output==='queue.service inactive')
        notes.push('Utrzymano przerwę pracy kolejki');
    }
    if(r.command==='kill'){
      const service=['sshd','api','queue'].find(name=>
        r.state.services?.[name]?.status==='failed');
      if(service)notes.push('Zatrzymano proces usługi '+service);
    }
  }
  return {count:notes.length,notes};
}
const isStatus=(e:CommandResult,name:string,active:boolean)=>
  e.ok&&e.command==='systemctl'&&e.target===name+'.service'&&
  e.output.includes('Active: '+(active?'active':'inactive'));
const isInitialFailure=(e:CommandResult)=>
  e.ok&&e.command==='curl'&&e.target==='ops-health'&&
  e.output.includes('Reason: QUEUE_STOPPED')&&
  e.state.services?.queue?.status==='inactive'&&
  e.state.services?.sshd?.status==='active'&&
  e.state.services?.api?.status==='active';

/** A wrong intervention can be repaired. Success depends on the final
 * verified service health AND the actual diagnosis-recovery sequence, while
 * the impact history remains visible for feedback and self-evaluation.
 */
export function opsProgress(state:LinuxState,events:readonly CommandResult[]):OpsProgress {
  const impact=operationalPenalty(events);
  const base={baseline:false,diagnosed:false,restored:false,verified:false,completed:false,
    sideEffects:impact.count,sideEffectNotes:impact.notes,
    availability:opsHealthy(state)?'healthy' as const:'degraded' as const};
  if(state.ops?.scenario!=='queue-outage')return base;
  const first=events.findIndex(isInitialFailure);
  const baseline=first>=0;
  if(!baseline)return base;
  const status=events.findIndex((e,i)=>i>first&&isStatus(e,'queue',false));
  const journal=events.findIndex((e,i)=>i>first&&e.ok&&e.command==='journalctl'&&
    e.target==='queue.service'&&
    e.output.includes('worker halted after unsafe deployment'));
  const diagnosed=status>=0&&journal>=0;
  if(!diagnosed)return {...base,baseline};
  const afterDiagnosis=Math.max(status,journal);
  const repaired=events.findIndex((e,i)=>i>afterDiagnosis&&
    e.ok&&e.command==='systemctl'&&e.target==='queue.service'&&
    e.state.services?.queue?.status==='active'&&
    e.output==='queue.service active');
  const restored=repaired>=0&&state.services?.queue?.status==='active';
  if(!restored)return {...base,baseline,diagnosed};
  const healthy=events.findIndex((e,i)=>i>repaired&&e.ok&&
    e.command==='curl'&&e.target==='ops-health'&&
    e.output.includes('HTTP/1.1 200 OK')&&
    e.output.includes('Status: HEALTHY'));
  const queueStatus=events.findIndex((e,i)=>i>healthy&&healthy>=0&&isStatus(e,'queue',true));
  const sshStatus=events.findIndex((e,i)=>i>healthy&&healthy>=0&&isStatus(e,'sshd',true));
  const verified=healthy>=0&&queueStatus>=0&&sshStatus>=0&&opsHealthy(state);
  return {...base,baseline,diagnosed,restored,verified,completed:verified};
}
