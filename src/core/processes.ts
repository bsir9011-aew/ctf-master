import type { LinuxState, CommandResult } from './linux.ts';

export interface SimProcess {
  pid: number;
  name: string;
  running: boolean;
  service?: string;
  essential?: boolean;
}
export interface SimService {
  status: 'active' | 'failed' | 'inactive';
  pid: number;
  journal: string[];
}

export const initialProcesses = (): SimProcess[] => [
  {pid:1, name:'init', running:true, essential:true},
  {pid:214, name:'sshd', running:true, service:'sshd'},
  {pid:331, name:'webd', running:false, service:'web'},
  {pid:350, name:'queue-worker', running:true, service:'queue'},
  {pid:424, name:'cpu-burn', running:true}
];

export const initialServices = (): Record<string,SimService> => ({
  sshd:{status:'active',pid:214,journal:['08:00 sshd: Listening for connections']},
  web:{status:'failed',pid:331,journal:['08:10 web: started','08:11 web: transient worker crash (exit 1)','08:11 systemd: web.service failed']},
  queue:{status:'active',pid:350,journal:['08:05 queue: ready']}
});

export function serviceName(raw: string): string {
  return raw.endsWith('.service') ? raw.slice(0,-'.service'.length) : raw;
}

/** Commands affect only persisted, in-memory simulated state. No host process APIs. */
export function executeProcessCommand(state: LinuxState, cmd: string, args: string[]): CommandResult {
  const done = (output: string, ok = true, next: LinuxState = state, target?: string): CommandResult =>
    ({output,ok,state:next,command:cmd,target});
  const processes = state.processes ?? initialProcesses();
  const services = state.services ?? initialServices();

  if (cmd === 'ps') {
    if (args.length && !(args.length === 1 && args[0] === 'aux')) {
      return done('Uzycie: ps [aux] (symulacja)',false);
    }
    const active = processes.filter(p=>p.running).sort((a,b)=>a.pid-b.pid);
    return done(['PID COMMAND',...active.map(p=>String(p.pid).padEnd(4)+' '+p.name)].join('\n'));
  }

  if (cmd === 'kill') {
    if (args.length !== 1 || !/^[1-9][0-9]*$/.test(args[0])) return done('Uzycie: kill PID',false);
    const pid = Number(args[0]);
    const target = processes.find(p=>p.pid===pid);
    if (!target || !target.running) return done('kill: process not found',false);
    if (target.essential) return done('kill: Permission denied (protected simulated process)',false);
    const changed = processes.map(p=>p.pid===pid ? {...p,running:false} : p);
    let updatedServices = services;
    if (target.service && services[target.service]) {
      updatedServices={...services,[target.service]:{
        ...services[target.service],status:'failed' as const,
        journal:[...services[target.service].journal,'systemd: '+target.service+'.service terminated unexpectedly']
      }};
    }
    return done('Signal TERM sent to '+pid,true,{...state,processes:changed,services:updatedServices},'pid:'+pid);
  }

  if (cmd === 'systemctl') {
    if (args.length !== 2 || !['status','start','stop','restart'].includes(args[0])) {
      return done('Uzycie: systemctl status|start|stop|restart NAZWA',false);
    }
    const [action,rawUnit]=args;
    const name=serviceName(rawUnit);
    const service=services[name];
    if (!service) return done('systemctl: Unit '+rawUnit+' not found',false);
    const target=name+'.service';
    if (action==='status') {
      return done(target+'\n Active: '+service.status+'\n Main PID: '+(service.status==='active'?service.pid:'-')+
        '\n Hint: journalctl -u '+name,true,state,target);
    }
    if (action==='start' && service.status==='active') return done(target+' already active',true,state,target);
    if (action==='stop' && service.status==='inactive') return done(target+' already inactive',true,state,target);
    const running=action!=='stop';
    const status=running?'active':'inactive';
    const updatedService:SimService={
      ...service,status,journal:[...service.journal,
        'systemd: '+target+' '+(running?'started successfully':'stopped')]
    };
    const updatedProcesses=processes.map(p=>p.pid===service.pid?{...p,running}:p);
    return done(target+' '+status,true,{
      ...state,processes:updatedProcesses,services:{...services,[name]:updatedService}
    },target);
  }

  if (cmd === 'journalctl') {
    if (args.length!==2 || args[0]!=='-u') return done('Uzycie: journalctl -u NAZWA',false);
    const name=serviceName(args[1]);
    const service=services[name];
    if (!service) return done('journalctl: Unit '+args[1]+' not found',false);
    return done(service.journal.join('\n'),true,state,name+'.service');
  }

  return done('Unknown simulated process command',false);
}
