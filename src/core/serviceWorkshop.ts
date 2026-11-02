import {createAcademyState} from './commandAcademy.ts';
import {executeLinux,type LinuxState} from './linux.ts';
import {workshopSourceLines} from './workshopSourceLines.ts';
import type {WorkshopResult,WorkshopStep} from './bashWorkshop.ts';

/** Real virtual process/service fixtures, never host processes. */
export const serviceTickets={
  web:{title:'INC-071 · Usługa WWW',service:'web',
    symptom:'Monitoring zgłasza, że serwis WWW przestał odpowiadać.'},
  api:{title:'INC-072 · Usługa API',service:'api',
    symptom:'Klient API zgłasza, że po wdrożeniu nie dostaje odpowiedzi.'},
  queue:{title:'INC-073 · Kolejka',service:'queue',
    symptom:'Alert monitoringu twierdzi, że kolejka zadań jest niedostępna.'}
} as const;
export type ServiceTicketId=keyof typeof serviceTickets;
export type ServiceDiagnosis=''|'crash'|'startup'|'healthy';
export const serviceTicketIds=Object.keys(serviceTickets) as ServiceTicketId[];
export function serviceTicket(id:ServiceTicketId){return serviceTickets[id];}
const blank=(state:LinuxState,feedback:string,line?:number):WorkshopResult=>({
  completed:false,feedback,state,steps:[],errorLine:line
});
const inputAllowed=(input:string,service:string)=>{
  if(input==='ps'||input==='ps aux')return 'ps';
  if(input===`systemctl status ${service}`||
     input===`systemctl status ${service}.service`)return 'status';
  if(input===`journalctl -u ${service}`||
     input===`journalctl -u ${service}.service`)return 'journal';
  return null;
};
export function runServiceWorkshop(script:string,id:ServiceTicketId='web'):WorkshopResult{
  const initial=createAcademyState(),ticket=serviceTicket(id);
  if(script.length>700)return blank(initial,'Skrypt jest za długi (maksymalnie 700 znaków).');
  const lines=workshopSourceLines(script);
  if(lines.length!==3)
    return blank(initial,'Do tego zgłoszenia użyj dokładnie trzech krótkich poleceń diagnostycznych (ps, systemctl status, journalctl -u).');
  // Full preflight BEFORE executing any command, blocking kill/restart/stop,
  // redirection, shell chaining and all host/network commands.
  const categories=lines.map(line=>inputAllowed(line.raw,ticket.service));
  if(categories.some(item=>item===null)){
    const index=categories.indexOf(null);
    return blank(initial,'Polecenie spoza bezpiecznej diagnostyki właściwej usługi. Użyj tylko ps, systemctl status i journalctl -u.',lines[index].line);
  }
  if(new Set(categories).size!==3)
    return blank(initial,'Potrzebujesz trzech różnych obserwacji: procesu, statusu i dziennika usługi.');
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
  if(steps.length!==3)return null;
  const status=steps.find(s=>s.command==='systemctl');
  const journal=steps.find(s=>s.command==='journalctl');
  const ps=steps.find(s=>s.command==='ps');
  if(!status||!journal||!ps||
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
    healthy:'Trafnie: status active, działający proces i wpis ready świadczą o fałszywym alarmie.'
  };
  return {matched:true,message:success[observed]};
}
