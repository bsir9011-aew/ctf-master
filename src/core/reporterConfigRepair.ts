import {executeLinux,type LinuxState} from './linux.ts';
import type {WorkshopResult} from './bashWorkshop.ts';
import {observedServiceDiagnosis,serviceWorldForTicket} from './serviceWorkshop.ts';
import {REPORTER_CONFIG_PATH} from './reporterConfigFixture.ts';

export type ReporterFixChoice=''|'rename-directive'|'delete-directive'|'chmod-777'|'restart-only';
export interface ReporterFixAssessment {
  matched:boolean|null;
  message:string;
}
export interface ReporterFixCheck {
  id:'syntax'|'preservation'|'scope';
  passed:boolean;
  label:string;
}
export interface ReporterFixPreview {
  verified:boolean;
  beforeLine:string;
  afterLine:string;
  checks:ReporterFixCheck[];
  message:string;
  state:LinuxState;
}
const eq=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const BAD='output_dir',GOOD='output_path';

/** Derive the key mismatch from the executed journal and actual cat output.
 * No scenario title or precomputed answer can override missing evidence.
 */
function reporterMismatch(result:Pick<WorkshopResult,'completed'|'steps'|'state'>):
  {wrongLine:string;goodLine:string;original:string;changed:string}|null {
  if(!result.completed||observedServiceDiagnosis(result,'reporter')!=='config')return null;
  const cat=result.steps.find(s=>s.command==='cat'&&s.target===REPORTER_CONFIG_PATH);
  const journal=result.steps.find(s=>s.command==='journalctl'&&s.target==='reporter.service');
  const actual=executeLinux(result.state,'cat '+REPORTER_CONFIG_PATH);
  if(!cat||cat.exitCode!==0||!actual.ok||actual.output!==cat.output||
     !journal||journal.exitCode!==0)return null;
  const key=journal.output.match(/unknown directive ([a-z_]+)/)?.[1];
  const original=actual.output;
  const lines=original.split('\n');
  const allowedLine=lines.find(line=>line.startsWith('# dostępne klucze: '));
  const allowed=allowedLine?.replace('# dostępne klucze: ','').split(',').map(s=>s.trim())??[];
  const wrong=lines.filter(line=>line.startsWith(key+'='));
  if(key!==BAD||!allowed.includes(GOOD)||allowed.includes(key)||
     wrong.length!==1||!/^output_dir=[^\n]+$/.test(wrong[0])||
     lines.some(line=>line.startsWith(GOOD+'=')))return null;
  const wrongLine=wrong[0],goodLine=GOOD+wrongLine.slice(key.length);
  const changed=lines.map(line=>line===wrongLine?goodLine:line).join('\n');
  if(changed===original||changed.split('\n').length!==lines.length)return null;
  return {wrongLine,goodLine,original,changed};
}
export function gradeReporterFix(
  result:Pick<WorkshopResult,'completed'|'steps'|'state'>,
  choice:ReporterFixChoice
):ReporterFixAssessment|null {
  if(!choice)return null;
  const mismatch=reporterMismatch(result);
  if(!mismatch)return {matched:null,
    message:'Brak potwierdzonego odczytu konfiguracji i dziennika tej samej usługi.'};
  if(choice!=='rename-directive')return {matched:false,
    message:'Ta zmiana nie naprawia wskazanego błędu przy minimalnej ingerencji. Porównaj nieznany klucz z listą obsługiwanych w pliku.'};
  return {matched:true,
    message:'Poprawnie: zmień samą nazwę nieobsługiwanej dyrektywy; pozostaw jej wartość i inne ustawienia.'};
}
/** Only an in-memory diff of one configuration line. No simulated restart,
 * no shell write, no editing of Academy/incident, no claim of restored service.
 */
export function previewReporterFix(
  incident:Pick<WorkshopResult,'completed'|'steps'|'state'>,
  choice:ReporterFixChoice
):ReporterFixPreview|null {
  if(gradeReporterFix(incident,choice)?.matched!==true||
     !eq(incident.state,serviceWorldForTicket('reporter')))return null;
  const mismatch=reporterMismatch(incident);
  if(!mismatch)return null;
  const before=incident.state;
  const after:LinuxState={...before,
    files:{...before.files,[REPORTER_CONFIG_PATH]:mismatch.changed}};
  const readAfter=executeLinux(after,'cat '+REPORTER_CONFIG_PATH);
  const beforeLines=mismatch.original.split('\n');
  const afterLines=readAfter.output.split('\n');
  const changedLines=beforeLines.filter((line,i)=>line!==afterLines[i]);
  const syntax=readAfter.ok&&readAfter.target===REPORTER_CONFIG_PATH&&
    readAfter.output===mismatch.changed&&changedLines.length===1&&
    changedLines[0]===mismatch.wrongLine&&
    afterLines[beforeLines.indexOf(mismatch.wrongLine)]===mismatch.goodLine;
  const preservation=beforeLines.length===afterLines.length&&
    beforeLines.every((line,i)=>line===mismatch.wrongLine?
      afterLines[i]===mismatch.goodLine:line===afterLines[i]);
  const revert={...after,files:{...after.files,
    [REPORTER_CONFIG_PATH]:mismatch.original}};
  const scope=eq(revert,before)&&
    after.services?.reporter?.status==='failed'&&
    after.processes?.find(p=>p.service==='reporter')?.running===false;
  const checks:ReporterFixCheck[]=[
    {id:'syntax',passed:syntax,label:'Wirtualny odczyt potwierdza poprawną dyrektywę'},
    {id:'preservation',passed:preservation,label:'Wartości i pozostałe ustawienia bez zmian'},
    {id:'scope',passed:scope,label:'Tylko konfiguracja; usługa nadal failed, bez restartu'}
  ];
  const verified=checks.every(c=>c.passed);
  return {
    verified,beforeLine:mismatch.wrongLine,afterLine:mismatch.goodLine,
    checks,state:after,
    message:verified?
      'Poprawka pliku zweryfikowana. Usługa nadal failed - przed uruchomieniem trzeba sprawdzić konfigurację i zaplanować kontrolowany restart.':
      'Nie potwierdzono minimalnej i bezpiecznej poprawki konfiguracji.'
  };
}
