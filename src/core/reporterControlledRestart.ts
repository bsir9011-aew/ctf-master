import {executeLinux,type LinuxState} from './linux.ts';
import type {WorkshopResult} from './bashWorkshop.ts';
import {previewReporterFix,type ReporterFixPreview} from './reporterConfigRepair.ts';
import {REPORTER_CONFIG_PATH} from './reporterConfigFixture.ts';
import {serviceWorldForTicket} from './serviceWorkshop.ts';

export type ReporterRestartChoice=''|'validate-restart'|'restart-immediately'|'kill-process'|'edit-more';
export interface ReporterRestartCheck {
  id:'configuration'|'availability'|'scope';
  passed:boolean;
  label:string;
}
export interface ReporterRestartVerification {
  verified:boolean;
  command:string;
  checks:ReporterRestartCheck[];
  beforeStatus:string;
  afterStatus:string;
  beforePid:string;
  afterPid:string;
  message:string;
  state:LinuxState;
}
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const unit='reporter.service';
const command='systemctl restart '+unit;
const psHasProcess=(output:string,pid:number,name:string):boolean=>
  output.split('\n').slice(1).some(row=>{
    const columns=row.trim().split(/\s+/);
    return columns[0]===String(pid)&&columns.slice(1).join(' ')===name;
  });

/** Use the actual corrected file content; a restart is never a substitute
 * for validating the configuration first.
 */
export function validReporterConfiguration(value:string):boolean{
  const lines=value.trimEnd().split('\n');
  const entries=lines.filter(line=>line&&!line.startsWith('#'));
  const found=new Map<string,string>();
  const allowed=['format','output_path','retry_limit'];
  for(const line of entries){
    const parts=/^([a-z_]+)=([^\n]+)$/.exec(line);
    if(!parts||!allowed.includes(parts[1])||found.has(parts[1]))return false;
    found.set(parts[1],parts[2]);
  }
  return found.size===3&&found.get('format')==='csv'&&
    found.get('output_path')==='/var/reports'&&
    found.get('retry_limit')==='3';
}
/** Never grade using a label or a forged config preview: re-derive the
 * exact expected corrected snapshot from the verified source trace.
 */
function reliableCorrection(
  incident:Pick<WorkshopResult,'steps'|'state'|'completed'>,
  preview:ReporterFixPreview|null
):ReporterFixPreview|null{
  if(!preview?.verified||!same(incident.state,serviceWorldForTicket('reporter')))return null;
  const expected=previewReporterFix(incident,'rename-directive');
  if(!expected?.verified||!same(preview,expected))return null;
  if(!validReporterConfiguration(preview.state.files[REPORTER_CONFIG_PATH]??''))return null;
  if(preview.state.services?.reporter?.status!=='failed'|| 
     preview.state.processes?.find(p=>p.service==='reporter')?.running!==false)return null;
  return expected;
}
export function gradeReporterRestart(
  incident:Pick<WorkshopResult,'steps'|'state'|'completed'>,
  preview:ReporterFixPreview|null,
  choice:ReporterRestartChoice
):{matched:boolean|null;message:string}|null{
  if(!choice)return null;
  if(!reliableCorrection(incident,preview))return {
    matched:null,message:'Najpierw potwierdź minimalną poprawkę i sprawdź konfigurację.'
  };
  if(choice!=='validate-restart')return {
    matched:false,message:'Nie zmieniaj kolejnych ustawień ani procesów w ciemno. Przed restartem zweryfikuj poprawioną konfigurację.'
  };
  return {matched:true,message:'Poprawnie: sprawdź poprawioną konfigurację, potem wykonaj kontrolowany restart i zbierz nowe dowody.'};
}
/** Only a fixed virtual systemctl on an isolated corrected state.
 * Never executes a real command, edits the source incident, or writes to Academy.
 */
export function verifyReporterRestart(
  incident:Pick<WorkshopResult,'steps'|'state'|'completed'>,
  preview:ReporterFixPreview|null,
  choice:ReporterRestartChoice
):ReporterRestartVerification|null{
  if(gradeReporterRestart(incident,preview,choice)?.matched!==true)return null;
  const corrected=reliableCorrection(incident,preview);
  if(!corrected)return null;
  const before=corrected.state;
  const old=before.services?.reporter;
  const oldProc=before.processes?.find(p=>p.service==='reporter');
  if(!old||!oldProc||old.status!=='failed'||oldProc.running||
     old.pid!==oldProc.pid)return null;
  const configProof=executeLinux(before,'cat '+REPORTER_CONFIG_PATH);
  const beforeStatus=executeLinux(before,'systemctl status '+unit);
  const beforePs=executeLinux(before,'ps');
  if(!configProof.ok||!validReporterConfiguration(configProof.output)||
     configProof.output!==before.files[REPORTER_CONFIG_PATH]||
     !beforeStatus.ok||!beforeStatus.output.includes(' Active: failed\n')||
     !beforePs.ok||psHasProcess(beforePs.output,oldProc.pid,oldProc.name))return null;
  const action=executeLinux(before,command);
  if(!action.ok||action.target!==unit)return null;
  const after=action.state;
  const service=after.services?.reporter;
  const proc=after.processes?.find(p=>p.service==='reporter');
  if(!service||!proc)return null;
  const status=executeLinux(after,'systemctl status '+unit);
  const ps=executeLinux(after,'ps');
  const journal=executeLinux(after,'journalctl -u '+unit);
  const configAfter=executeLinux(after,'cat '+REPORTER_CONFIG_PATH);
  const configuration=configAfter.ok&&configAfter.target===REPORTER_CONFIG_PATH&&
    configAfter.output===configProof.output&&
    validReporterConfiguration(configAfter.output);
  const availability=service.status==='active'&&proc.running&&
    service.pid===old.pid&&proc.pid===oldProc.pid&&
    status.ok&&status.target===unit&&
    status.output.includes(' Active: active\n')&&
    status.output.includes(' Main PID: '+old.pid+'\n')&&
    ps.ok&&psHasProcess(ps.output,old.pid,oldProc.name);
  const otherServicesBefore={...before.services};
  const otherServicesAfter={...after.services};
  delete otherServicesBefore.reporter;delete otherServicesAfter.reporter;
  const remainingBefore=before.processes?.filter(p=>p.service!=='reporter');
  const remainingAfter=after.processes?.filter(p=>p.service!=='reporter');
  const stateBefore={...before},stateAfter={...after};
  delete stateBefore.services;delete stateBefore.processes;
  delete stateAfter.services;delete stateAfter.processes;
  const journalProof=journal.ok&&journal.target===unit&&
    journal.output===service.journal.join('\n')&&
    service.journal.length===old.journal.length+1&&
    same(service.journal.slice(0,-1),old.journal)&&
    service.journal.at(-1)==='systemd: reporter.service started successfully';
  const scope=configuration&&journalProof&&
    same(otherServicesBefore,otherServicesAfter)&&
    same(remainingBefore,remainingAfter)&&same(stateBefore,stateAfter);
  const checks:ReporterRestartCheck[]=[
    {id:'configuration',passed:configuration,
      label:'Skorygowany plik wciąż zawiera poprawne i niezmienione ustawienia'},
    {id:'availability',passed:availability,
      label:'Po restarcie reporter.service ma status active i uruchomiony PID'},
    {id:'scope',passed:scope,
      label:'Journal rejestruje restart; inne procesy, usługi i dane bez zmian'}
  ];
  const verified=checks.every(c=>c.passed);
  return {
    verified,command,checks,beforeStatus:old.status,afterStatus:service.status,
    beforePid:'nieaktywny',afterPid:proc.running?'aktywny':'nieaktywny',
    state:after,message:verified?
      'Wirtualny reporter wystartował po poprawce konfiguracji. Status i proces są aktywne. To nie jest jeszcze test działania eksportu raportów.':
      'Nie potwierdzono bezpiecznego przywrócenia usługi.'
  };
}
