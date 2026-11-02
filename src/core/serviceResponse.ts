import {createAcademyState} from './commandAcademy.ts';
import {executeLinux,type LinuxState} from './linux.ts';
import type {WorkshopResult} from './bashWorkshop.ts';
import {observedServiceDiagnosis,serviceTicket,type ServiceTicketId} from './serviceWorkshop.ts';

export type ServiceResponseChoice=''|'restart-target'|'investigate-startup'|'verify-alert'|'kill-worker';
type RealChoice=Exclude<ServiceResponseChoice,''>;
export interface ServiceResponseAssessment {
  matched:boolean|null;
  message:string;
}
export interface ServiceResponseCheck {
  id:'status'|'process'|'scope';
  passed:boolean;
  label:string;
}
export interface ServiceResponseVerification {
  command:string|null;
  beforeStatus:string;
  afterStatus:string;
  beforePid:string;
  afterPid:string;
  checks:ServiceResponseCheck[];
  verified:boolean;
  message:string;
  /** Only for automated regression tests; never commit it to Academy. */
  state:LinuxState;
}
const expected={
  crash:'restart-target',
  startup:'investigate-startup',
  healthy:'verify-alert'
} as const;
const failure='Najpierw ustal, co stało się z usługą. Restart i kill nie są uniwersalną naprawą.';
/** From the actual RC.63 read-only evidence and the selected incident only. */
export function gradeServiceResponse(
  result:Pick<WorkshopResult,'steps'|'state'|'completed'>,
  id:ServiceTicketId,
  diagnosis:'crash'|'startup'|'healthy'|'',
  choice:ServiceResponseChoice
):ServiceResponseAssessment|null {
  if(!choice)return null;
  const observed=result.completed?observedServiceDiagnosis(result,id):null;
  if(!observed||observed!==diagnosis)return {
    matched:null,message:'Brak poprawnie uzasadnionej diagnozy. Najpierw oceń stan procesu, usługi i dziennika.'
  };
  const matched=choice===expected[observed];
  if(!matched)return {matched:false,message:choice==='kill-worker'?
    'Kill bez dowodu i planu może pogorszyć incydent. Wybierz bezpieczną reakcję na ten konkretny stan.':
    failure};
  const messages={
    crash:'Restart pojedynczej usługi może przywrócić dostępność po awarii procesu. Nie dowodzi jednak usunięcia przyczyny źródłowej.',
    startup:'Błąd startu wymaga zbadania przyczyny (np. konfiguracji lub zależności). Nie udawaj, że kolejny restart już naprawił problem.',
    healthy:'Usługa i proces działają. Nie ingeruj w nie - sprawdź konfigurację monitoringu i przyczynę alarmu.'
  };
  return {matched:true,message:messages[observed]};
}
const equal=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const activePid=(output:string,pid:number,name:string)=>
  output.split('\n').slice(1).some(row=>{
    const fields=row.trim().split(/\s+/);
    return fields[0]===String(pid)&&fields.slice(1).join(' ')===name;
  });
/** Fixed virtual action, isolated snapshot, three independent post-action checks.
 * Never invokes actual systemctl, host APIs or a network.
 */
export function verifyServiceResponse(
  incident:Pick<WorkshopResult,'steps'|'state'|'completed'>,
  id:ServiceTicketId,
  diagnosis:'crash'|'startup'|'healthy'|'',
  choice:ServiceResponseChoice
):ServiceResponseVerification|null {
  if(gradeServiceResponse(incident,id,diagnosis,choice)?.matched!==true||
     !equal(incident.state,createAcademyState()))return null;
  const name=serviceTicket(id).service,unit=name+'.service';
  const before=incident.state;
  const initial=before.services?.[name],process=before.processes?.find(p=>p.service===name);
  if(!initial||!process||process.pid!==initial.pid)return null;
  const actionCommand=choice==='restart-target'?'systemctl restart '+unit:null;
  const action=actionCommand?executeLinux(before,actionCommand):null;
  if(action&&!action.ok)return null;
  const after=action?.state??before;
  const service=after.services?.[name],afterProcess=after.processes?.find(p=>p.service===name);
  if(!service||!afterProcess)return null;
  const status=executeLinux(after,'systemctl status '+unit);
  const ps=executeLinux(after,'ps');
  const journal=executeLinux(after,'journalctl -u '+unit);
  const beforePs=executeLinux(before,'ps');
  const beforeStatus=executeLinux(before,'systemctl status '+unit);
  const afterActive=service.status==='active'&&afterProcess.running;
  const beforeActive=initial.status==='active'&&process.running;
  const statusProof=status.ok&&status.target===unit&&
    status.output.includes(' Active: '+service.status+'\n')&&
    status.output.includes(' Main PID: '+(afterActive?service.pid:'-')+'\n')&&
    (choice==='restart-target'?afterActive:
      service.status===initial.status&&status.output===beforeStatus.output);
  const processProof=ps.ok&&afterProcess.pid===process.pid&&
    activePid(ps.output,process.pid,process.name)===afterProcess.running&&
    (choice==='restart-target'?(!beforeActive&&afterActive):
      afterProcess.running===process.running&&ps.output===beforePs.output);
  const otherServicesBefore={...before.services};
  const otherServicesAfter={...after.services};
  delete otherServicesBefore[name];delete otherServicesAfter[name];
  const otherProcessesBefore=before.processes?.filter(p=>p.service!==name);
  const otherProcessesAfter=after.processes?.filter(p=>p.service!==name);
  const otherStateBefore={...before};
  const otherStateAfter={...after};
  delete otherStateBefore.services;delete otherStateAfter.services;
  delete otherStateBefore.processes;delete otherStateAfter.processes;
  const journalProof=journal.ok&&journal.target===unit&&
    journal.output===service.journal.join('\n')&&
    (choice==='restart-target'?
      service.journal.length===initial.journal.length+1&&
      equal(service.journal.slice(0,-1),initial.journal)&&
      service.journal.at(-1)==='systemd: '+unit+' started successfully':
      equal(service,initial));
  const scopeProof=journalProof&&equal(otherServicesBefore,otherServicesAfter)&&
    equal(otherProcessesBefore,otherProcessesAfter)&&
    equal(otherStateBefore,otherStateAfter)&&
    (choice==='restart-target'||equal(after,before));
  const checks:ServiceResponseCheck[]=[
    {id:'status',passed:statusProof,label:choice==='restart-target'?
      'Po reakcji systemctl pokazuje active dla właściwej usługi':
      'Status właściwej usługi pozostał zgodny z ustaloną diagnozą'},
    {id:'process',passed:processProof,label:choice==='restart-target'?
      'Odpowiedni PID wrócił na listę aktywnych procesów':
      'Stan właściwego procesu jest spójny; brak zbędnego restartu'},
    {id:'scope',passed:scopeProof,label:'Journal jest spójny, inne usługi i zasoby są nietknięte'}
  ];
  const verified=checks.every(check=>check.passed);
  const message=verified?(choice==='restart-target'?
    'Symulator potwierdza przywrócenie usługi. To nie jest dowód trwałego usunięcia źródła awarii.':
    choice==='investigate-startup'?
      'Bez nieuzasadnionego restartu: usługa nadal failed. Kolejny krok to ustalenie przyczyny błędu uruchomienia.':
      'Bez ingerencji: usługa nadal active. Trzeba wyjaśnić alarm monitoringu.') :
    'Kontrole nie potwierdziły bezpiecznej reakcji.';
  return {
    command:actionCommand,beforeStatus:initial.status,afterStatus:service.status,
    beforePid:process.running?'aktywny':'nieaktywny',
    afterPid:afterProcess.running?'aktywny':'nieaktywny',
    checks,verified,message,state:after
  };
}
