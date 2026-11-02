import {createAcademyState} from './commandAcademy.ts';
import {executeLinux,type LinuxState} from './linux.ts';
import type {SimProcess,SimService} from './processes.ts';
import {workshopSourceLines} from './workshopSourceLines.ts';
import type {WorkshopResult,WorkshopStep} from './bashWorkshop.ts';

/** Real virtual process/service fixtures, never host processes. */
export const serviceTickets={
  web:{title:'INC-071 · Usługa WWW',service:'web',
    symptom:'Monitoring zgłasza, że serwis WWW przestał odpowiadać.'},
  api:{title:'INC-072 · Usługa API',service:'api',
    symptom:'Klient API zgłasza, że po wdrożeniu nie dostaje odpowiedzi.'},
  queue:{title:'INC-073 · Kolejka',service:'queue',
    symptom:'Alert monitoringu twierdzi, że kolejka zadań jest niedostępna.'},
  reporter:{title:'INC-074 · Generator raportów',service:'reporter',
    symptom:'Po wdrożeniu generator raportów nie uruchamia się.'},
  scheduler:{title:'INC-075 · Harmonogram',service:'scheduler',
    symptom:'Zadania harmonogramu przestały się wykonywać.'},
  gateway:{title:'INC-076 · Brama HTTP',service:'gateway',
    symptom:'Nowa instancja bramy HTTP nie może wystartować.'}
} as const;
export type ServiceTicketId=keyof typeof serviceTickets;
export type ServiceDiagnosis=''|'crash'|'startup'|'healthy'|'config'|'dependency'|'port';
export const serviceTicketIds=Object.keys(serviceTickets) as ServiceTicketId[];
export function serviceTicket(id:ServiceTicketId){return serviceTickets[id];}
/** Additional scenarios are fresh virtual fixtures, never global Academy changes.
 * The first three tickets keep their historical state bit-for-bit.
 */
export function serviceWorldForTicket(id:ServiceTicketId):LinuxState{
  const state=createAcademyState();
  const cases={
    reporter:{pid:510,name:'reporterd',
      journal:['09:10 reporter: config validation failed: unknown directive output_dir',
        '09:10 systemd: reporter.service failed']},
    scheduler:{pid:520,name:'scheduler-worker',
      journal:['09:12 scheduler: dependency redis.service unavailable',
        '09:12 systemd: scheduler.service failed']},
    gateway:{pid:530,name:'gatewayd',
      journal:['09:14 gateway: bind 0.0.0.0:8080 failed: Address already in use',
        '09:14 systemd: gateway.service failed']}
  } as const;
  if(id!=='reporter'&&id!=='scheduler'&&id!=='gateway')return state;
  const seed=cases[id];
  const processes:SimProcess[]=[...(state.processes??[]),{
    pid:seed.pid,name:seed.name,running:false,service:id
  }];
  const services:Record<string,SimService>={...state.services,[id]:{
    pid:seed.pid,status:'failed' as const,journal:[...seed.journal]
  }};
  if(id==='scheduler'){
    // Dependency really is down in the virtual system. No external Redis.
    processes.push({pid:620,name:'redis-server',running:false,service:'redis'});
    services.redis={pid:620,status:'failed',journal:[
      '09:11 redis: startup failed: data directory unavailable',
      '09:11 systemd: redis.service failed'
    ]};
  }
  if(id==='gateway'){
    // A different *running* process owns port 8080, as ss -ltnp will show.
    processes.push({pid:615,name:'legacy-proxy',running:true,
      service:'legacy-proxy',listeningPort:8080});
    services['legacy-proxy']={pid:615,status:'active',
      journal:['09:00 legacy-proxy: listening on 0.0.0.0:8080']};
  }
  return {...state,processes,services};
}
const blank=(state:LinuxState,feedback:string,line?:number):WorkshopResult=>({
  completed:false,feedback,state,steps:[],errorLine:line
});
const inputAllowed=(input:string,service:string,id:ServiceTicketId)=>{
  if(id==='scheduler'&&
     (input==='systemctl status redis'||input==='systemctl status redis.service'))
    return 'dependency';
  if(id==='gateway'&&input==='ss -ltnp')return 'socket';
  if(input==='ps'||input==='ps aux')return 'ps';
  if(input===`systemctl status ${service}`||
     input===`systemctl status ${service}.service`)return 'status';
  if(input===`journalctl -u ${service}`||
     input===`journalctl -u ${service}.service`)return 'journal';
  return null;
};
export function runServiceWorkshop(script:string,id:ServiceTicketId='web'):WorkshopResult{
  const initial=serviceWorldForTicket(id),ticket=serviceTicket(id);
  if(script.length>700)return blank(initial,'Skrypt jest za długi (maksymalnie 700 znaków).');
  const lines=workshopSourceLines(script);
  const extra=id==='scheduler'?'dependency':id==='gateway'?'socket':null;
  const expectedLength=extra?4:3;
  if(lines.length!==expectedLength)return blank(initial,extra?
    'Zbierz cztery dowody: ps, status usługi, jej journal oraz '+(
      extra==='dependency'?'status redis.service.':'listę portów ss -ltnp.') :
    'Do tego zgłoszenia użyj dokładnie trzech krótkich poleceń diagnostycznych (ps, systemctl status, journalctl -u).');
  // Full preflight BEFORE executing any command, blocking kill/restart/stop,
  // redirection, shell chaining and all host/network commands.
  const categories:(string|null)[]=lines.map(line=>inputAllowed(line.raw,ticket.service,id));
  if(categories.some(item=>item===null)){
    const index=categories.indexOf(null);
    return blank(initial,'Polecenie spoza bezpiecznej diagnostyki właściwej usługi. Użyj tylko ps, systemctl status i journalctl -u.',lines[index].line);
  }
  const required=['ps','status','journal',...(extra?[extra]:[])];
  if(new Set(categories).size!==expectedLength||
     !required.every(category=>categories.includes(category)))
    return blank(initial,'Potrzebujesz różnych dowodów dla tej usługi i wskazanego zasobu pomocniczego.');
  const steps:WorkshopStep[]=[];
  let state=initial;
  for(const line of lines){
    const response=executeLinux(state,line.raw);
    state=response.state;
    steps.push({
      line:line.line,command:response.command,target:response.target,
      exitCode:response.exitCode??(response.ok?0:1),
      output:response.output.slice(0,600),
      variables:[],changedFiles:[],iterations:0,skipped:0,checks:[]
    });
    if(!response.ok)return {
      completed:false,feedback:'Odczyt nie powiódł się: '+response.output,
      state,steps,errorLine:line.line
    };
  }
  const result:WorkshopResult={completed:false,feedback:'Zinterpretuj dowody.',state,steps};
  const observed=observedServiceDiagnosis(result,id);
  if(!observed)return {
    ...result,feedback:'Wyniki są niepełne lub sprzeczne. Sprawdź właściwą usługę i jej proces.'
  };
  // Ensure every part of the world is read-only, including processes, services
  // and other subsystems, not only files and permissions.
  if(JSON.stringify(state)!==JSON.stringify(initial))return {
    ...result,feedback:'Diagnostyka nie może zmieniać żadnego stanu systemu.'
  };
  return {...result,completed:true,
    feedback:'Zebrano status usługi, dziennik i listę procesów. Wyciągnij samodzielny wniosek.'};
}
/** Derive cause solely from actual command outputs and service process state.
 * Do not rely on the ticket name or answer labels.
 */
export function observedServiceDiagnosis(
  result:Pick<WorkshopResult,'steps'|'state'>,id:ServiceTicketId
):Exclude<ServiceDiagnosis,''>|null{
  const ticket=serviceTicket(id),steps=result.steps;
  const extra=id==='scheduler'?'dependency':id==='gateway'?'socket':null;
  if(steps.length!==(extra?4:3))return null;
  const status=steps.find(s=>s.command==='systemctl'&&
    s.target===ticket.service+'.service');
  const journal=steps.find(s=>s.command==='journalctl');
  const ps=steps.find(s=>s.command==='ps');
  const auxiliary=extra?steps.find(s=>extra==='dependency'?
    s.command==='systemctl'&&s.target==='redis.service':
    s.command==='ss'&&s.target==='tcp-listeners'):undefined;
  if(!status||!journal||!ps||
     (extra&&!auxiliary)||
     status.exitCode!==0||journal.exitCode!==0||ps.exitCode!==0||
     status.target!==ticket.service+'.service'||
     journal.target!==status.target||ps.target!==undefined)return null;
  if(!status.output.startsWith(ticket.service+'.service\n')||
     !ps.output.startsWith('PID COMMAND\n'))return null;
  // Provenance: the actual command outputs must match the untouched virtual
  // world, not merely contain a plausible substring or matching service name.
  const actualStatus=executeLinux(result.state,'systemctl status '+ticket.service);
  const actualJournal=executeLinux(result.state,'journalctl -u '+ticket.service);
  const actualProcesses=executeLinux(result.state,'ps');
  if(!actualStatus.ok||!actualJournal.ok||!actualProcesses.ok||
     status.output!==actualStatus.output||journal.output!==actualJournal.output||
     ps.output!==actualProcesses.output)return null;
  if(extra==='dependency'){
    const redis=executeLinux(result.state,'systemctl status redis.service');
    const redisState=result.state.services?.redis;
    const redisProcess=result.state.processes?.find(p=>p.service==='redis');
    if(!auxiliary||auxiliary.exitCode!==0||auxiliary.output!==redis.output||
       auxiliary.target!==redis.target||!redis.ok||
       redisState?.status!=='failed'||redisProcess?.running!==false||
       !redis.output.includes(' Active: failed\n'))return null;
  }
  if(extra==='socket'){
    const socket=executeLinux(result.state,'ss -ltnp');
    const owner=result.state.processes?.find(p=>p.listeningPort===8080&&p.running);
    const ownerService=owner?.service?result.state.services?.[owner.service]:undefined;
    if(!auxiliary||auxiliary.exitCode!==0||!socket.ok||
       auxiliary.output!==socket.output||auxiliary.target!==socket.target||
       !owner||ownerService?.status!=='active'||owner.service==='gateway'||
       !socket.output.includes('0.0.0.0:8080')||
       !socket.output.includes('"'+owner.name+'",pid='+owner.pid+',fd=3'))return null;
  }
  const service=result.state.services?.[ticket.service];
  const proc=result.state.processes?.find(p=>p.service===ticket.service);
  if(!service||!proc||proc.pid!==service.pid)return null;
  const running=ps.output.split('\n').slice(1)
    .some(row=>row.trim().split(/\s+/)[0]===String(proc.pid)&&
      row.trim().split(/\s+/).slice(1).join(' ')===proc.name);
  const stateRunning=service.status==='active'&&proc.running;
  if(running!==proc.running||!status.output.includes(' Active: '+service.status+'\n')||
     !status.output.includes(' Main PID: '+(stateRunning?service.pid:'-')+'\n')||
     journal.output!==service.journal.join('\n'))return null;
  if(stateRunning&&journal.output.includes('ready')&&!journal.output.includes('failed'))
    return 'healthy';
  if(service.status==='failed'&&!proc.running&&!running){
    if(journal.output.includes('transient worker crash (exit 1)'))return 'crash';
    if(journal.output.includes('startup failed (exit 1)'))return 'startup';
    if(journal.output.includes('config validation failed: unknown directive output_dir'))
      return 'config';
    if(journal.output.includes('dependency redis.service unavailable'))
      return 'dependency';
    if(journal.output.includes('bind 0.0.0.0:8080 failed: Address already in use'))
      return 'port';
  }
  return null;
}
export function gradeServiceDiagnosis(
  result:Pick<WorkshopResult,'completed'|'steps'|'state'>,
  id:ServiceTicketId,answer:ServiceDiagnosis
):{matched:boolean|null;message:string}{
  if(!answer)return {matched:null,message:'Wybierz wniosek z danych.'};
  const observed=result.completed?observedServiceDiagnosis(result,id):null;
  if(!observed)return {matched:null,message:'Nie ma wystarczających dowodów, by ocenić wniosek.'};
  if(observed!==answer)return {matched:false,
    message:'Porównaj Active, Main PID, listę ps i konkretne zdarzenia journalctl. Sam alert nie dowodzi awarii.'};
  const success={
    crash:'Trafnie: serwis wcześniej działał, ale jego proces zakończył się błędem. Dziennik wskazuje awarię procesu.',
    startup:'Trafnie: usługa nie wystartowała. Dziennik opisuje błąd startu, a proces nie pracuje.',
    healthy:'Trafnie: status active, działający proces i wpis ready świadczą o fałszywym alarmie.',
    config:'Trafnie: journal wskazuje nieznaną dyrektywę konfiguracji. Sam restart niczego nie naprawi.',
    dependency:'Trafnie: journal wskazuje niedostępną zależność redis.service. Sprawdź ją przed zmianą usługi.',
    port:'Trafnie: Address already in use oznacza konflikt portu. Ustal, co go zajmuje.'
  };
  return {matched:true,message:success[observed]};
}
