import {executeLinux,type LinuxState} from './linux.ts';
import type {WorkshopResult} from './bashWorkshop.ts';
import {serviceWorldForTicket} from './serviceWorkshop.ts';
import {previewReporterFix,type ReporterFixPreview} from './reporterConfigRepair.ts';
import {REPORTER_CONFIG_PATH} from './reporterConfigFixture.ts';

export interface ReporterStartCheck{
  id:'config'|'availability'|'scope';
  passed:boolean;
  label:string;
}
export interface ReporterStartVerification{
  verified:boolean;
  command:string;
  beforeStatus:'failed';
  afterStatus:string;
  beforePid:string;
  afterPid:string;
  checks:ReporterStartCheck[];
  message:string;
  state:LinuxState;
}
const equal=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);

/** A controlled restart in a disposable virtual world.
 * The only input is a verified one-line fix obtained from the actual four
 * diagnostic readouts. Never execute a host shell or persist the state.
 */
export function verifyReporterStart(
  incident:Pick<WorkshopResult,'completed'|'steps'|'state'>,
  fix:ReporterFixPreview|null
):ReporterStartVerification|null{
  if(!fix?.verified||!fix.checks.every(c=>c.passed)||
     !equal(incident.state,serviceWorldForTicket('reporter')))return null;
  // Re-derive the complete fix from the original incident. A forged or stale
  // preview (e.g. altered config or unrelated permissions) must not be usable.
  const expected=previewReporterFix(incident,'rename-directive');
  if(!expected?.verified||!equal(expected.state,fix.state)||
     expected.beforeLine!==fix.beforeLine||expected.afterLine!==fix.afterLine)return null;
  const corrected=fix.state;
  const repairedText=executeLinux(corrected,'cat '+REPORTER_CONFIG_PATH);
  if(!repairedText.ok||repairedText.output!==corrected.files[REPORTER_CONFIG_PATH]||
     !repairedText.output.includes('\noutput_path=/var/reports\n')||
     repairedText.output.includes('\noutput_dir='))return null;

  const original=incident.state;
  const beforeService=corrected.services?.reporter;
  const beforeProcess=corrected.processes?.find(p=>p.service==='reporter');
  if(!beforeService||beforeService.status!=='failed'||!beforeProcess||
     beforeProcess.running||beforeProcess.pid!==beforeService.pid)return null;
  const command='systemctl restart reporter.service';
  const restart=executeLinux(corrected,command);
  if(!restart.ok||restart.target!=='reporter.service')return null;
  const after=restart.state;
  const service=after.services?.reporter;
  const process=after.processes?.find(p=>p.service==='reporter');
  if(!service||!process)return null;
  const status=executeLinux(after,'systemctl status reporter.service');
  const ps=executeLinux(after,'ps');
  const journal=executeLinux(after,'journalctl -u reporter.service');
  const config=executeLinux(after,'cat '+REPORTER_CONFIG_PATH);
  const configPassed=config.ok&&config.target===REPORTER_CONFIG_PATH&&
    config.output===repairedText.output&&
    config.output===after.files[REPORTER_CONFIG_PATH];
  const availabilityPassed=status.ok&&ps.ok&&
    status.target==='reporter.service'&&service.status==='active'&&
    process.running&&process.pid===beforeProcess.pid&&process.pid===service.pid&&
    status.output.includes(' Active: active\n')&&
    status.output.includes(' Main PID: '+process.pid+'\n')&&
    ps.output.split('\n').slice(1).some(row=>
      row.trim().split(/\s+/)[0]===String(process.pid)&&
      row.trim().split(/\s+/).slice(1).join(' ')===process.name);
  const beforeOthers={...corrected.services};
  const afterOthers={...after.services};
  delete beforeOthers.reporter;delete afterOthers.reporter;
  const beforeRest={...corrected};
  const afterRest={...after};
  delete beforeRest.services;delete afterRest.services;
  delete beforeRest.processes;delete afterRest.processes;
  const scopePassed=journal.ok&&journal.target==='reporter.service'&&
    journal.output===service.journal.join('\n')&&
    service.journal.length===beforeService.journal.length+1&&
    equal(service.journal.slice(0,-1),beforeService.journal)&&
    service.journal.at(-1)==='systemd: reporter.service started successfully'&&
    equal(beforeOthers,afterOthers)&&
    equal(beforeRest,afterRest)&&
    equal(corrected.processes?.filter(p=>p.service!=='reporter'),
      after.processes?.filter(p=>p.service!=='reporter'));
  const checks:ReporterStartCheck[]=[
    {id:'config',passed:configPassed,
      label:'Naprawiona konfiguracja jest nadal poprawna i niezmieniona'},
    {id:'availability',passed:availabilityPassed,
      label:'systemctl i ps potwierdzają active oraz działający PID usługi'},
    {id:'scope',passed:scopePassed,
      label:'Journal potwierdza start; inne procesy i zasoby bez zmian'}
  ];
  const verified=checks.every(check=>check.passed);
  return {
    verified,command,beforeStatus:'failed',afterStatus:service.status,
    beforePid:'nieaktywny',afterPid:process.running?'aktywny':'nieaktywny',
    checks,state:after,
    message:verified?
      'Dostępność reporter.service została przywrócona w symulatorze. Potwierdzono konfigurację, PID, status i zakres zmian; stabilność długoterminowa wymaga dalszego monitoringu.':
      'Nie potwierdzono bezpiecznego przywrócenia reporter.service.'
  };
}
