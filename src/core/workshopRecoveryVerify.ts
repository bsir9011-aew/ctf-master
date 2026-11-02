import type {LinuxState} from './linux.ts';
import {executeLinux} from './linux.ts';
import type {WorkshopResult} from './bashWorkshop.ts';
import {gradeRemediation,type RemediationChoice} from './workshopRemediation.ts';
import {blindTicket,type BlindTicketId} from './blindTickets.ts';
import {modeOf} from './permissions.ts';

/** Disposable in-memory preview, never executed on a host OS. */
export interface RecoveryCheck {
  id:'read'|'scope'|'integrity';
  passed:boolean;
  label:string;
}
export interface RecoveryVerification {
  verified:boolean;
  command:string;
  checks:RecoveryCheck[];
  usedTrainingBackup:boolean;
  message:string;
  /** For regression testing only; never persist or apply back to the incident. */
  state:LinuxState;
}
const recordsEqual=(a:Record<string,unknown>,b:Record<string,unknown>)=>
  Object.keys(a).length===Object.keys(b).length&&
  Object.keys(a).every(key=>Object.hasOwn(b,key)&&a[key]===b[key]);

export function verifyRecoveryPreview(
  result:Pick<WorkshopResult,'steps'|'completed'|'state'>,
  choice:RemediationChoice,
  ticketId:BlindTicketId='service'
):RecoveryVerification|null {
  const ticket=blindTicket(ticketId);
  const TARGET=ticket.file,DIR=ticket.directory,BACKUP=ticket.backup;
  const assessment=gradeRemediation(choice,result);
  if(!assessment||assessment.matched!==true||!assessment.cause)return null;
  const test=result.steps.find(s=>s.command==='test'&&s.testFlag==='-r');
  if(test?.target!==TARGET)return null;

  const cause=assessment.cause;
  const before=result.state;
  // This training backup is introduced ONLY in the disposable preview.
  // It is not evidence that a real deployment has a valid recovery source.
  const usedTrainingBackup=cause==='missing';
  if(usedTrainingBackup&&
     (Object.hasOwn(before.files,BACKUP)||before.dirs.includes(BACKUP)))return null;
  const sandbox:LinuxState={
    ...before,
    dirs:[...before.dirs],
    files:{...before.files},
    permissions:{...before.permissions},
    ownership:{...before.ownership},
    variables:{...before.variables}
  };
  if(usedTrainingBackup){
    sandbox.files[BACKUP]=ticket.content;
    sandbox.permissions![BACKUP]=0o400;
    sandbox.ownership![BACKUP]={uid:1000,gid:1000};
  }
  const command=cause==='directory'?'chmod u+x '+DIR:
    cause==='file'?'chmod u+r '+TARGET:'cp '+BACKUP+' '+TARGET;
  const action=executeLinux(sandbox,command);
  const after=action.state;
  const read=action.ok?executeLinux(after,'cat '+TARGET):null;
  const expectedContent=usedTrainingBackup?sandbox.files[BACKUP]:before.files[TARGET];
  const readPassed=!!read?.ok&&read.target===TARGET&&
    read.output===expectedContent&&typeof expectedContent==='string';
  const exactMode=cause==='directory'?modeOf(after,DIR)===0o700&&
    modeOf(after,TARGET)===modeOf(before,TARGET):
    cause==='file'?modeOf(after,TARGET)===0o400&&
      modeOf(after,DIR)===modeOf(before,DIR):
      modeOf(after,TARGET)===0o644&&modeOf(after,DIR)===modeOf(before,DIR);
  const expectedChanged=cause==='directory'?DIR:TARGET;
  const afterPermissions={...after.permissions};
  const beforePermissions={...before.permissions};
  delete afterPermissions[expectedChanged];delete beforePermissions[expectedChanged];
  if(usedTrainingBackup)delete afterPermissions[BACKUP];
  const unchangedPermissions=recordsEqual(afterPermissions,beforePermissions);
  const scopePassed=action.ok&&exactMode&&unchangedPermissions&&
    after.dirs.length===before.dirs.length&&
    after.dirs.every((path,i)=>path===before.dirs[i]);

  const afterOtherFiles={...after.files};
  const beforeOtherFiles={...before.files};
  delete afterOtherFiles[TARGET];delete beforeOtherFiles[TARGET];
  if(usedTrainingBackup)delete afterOtherFiles[BACKUP];
  const unchangedOtherFiles=recordsEqual(afterOtherFiles,beforeOtherFiles);
  const afterOwners={...after.ownership};
  const beforeOwners={...before.ownership};
  if(usedTrainingBackup){
    delete afterOwners[TARGET];delete afterOwners[BACKUP];
    delete beforeOwners[TARGET];
  }
  const ownershipUntouched=recordsEqual(afterOwners,beforeOwners);
  const integrityPassed=action.ok&&unchangedOtherFiles&&ownershipUntouched&&
    after.files[TARGET]===expectedContent&&
    (!usedTrainingBackup||(
      sandbox.files[BACKUP]===ticket.content&&
      after.files[BACKUP]===sandbox.files[BACKUP]));
  const checks:RecoveryCheck[]=[
    {id:'read',passed:readPassed,label:'Odczyt docelowego pliku działa'},
    {id:'scope',passed:scopePassed,label:'Zmiana praw jest minimalna i ograniczona do celu'},
    {id:'integrity',passed:integrityPassed,label:usedTrainingBackup?
      'Odtworzony plik zgadza się z kopią treningową; inne dane bez zmian':
      'Oryginalne dane i pozostałe zasoby są nienaruszone'}
  ];
  const verified=checks.every(check=>check.passed);
  return {
    verified,command,checks,usedTrainingBackup,
    message:verified?
      'Weryfikacja przeszła: odczyt działa, prawa są minimalne, inne dane bez zmian.':
      'Nie wszystkie kontrole przeszły. Sama poprawna komenda nie oznacza bezpiecznej naprawy.',
    state:after
  };
}
