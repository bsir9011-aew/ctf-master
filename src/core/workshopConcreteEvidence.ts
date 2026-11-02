import type {WorkshopResult} from './bashWorkshop.ts';
import type {RecoveryVerification} from './workshopRecoveryVerify.ts';
import {executeLinux} from './linux.ts';
import {modeOf} from './permissions.ts';
import {observedAccessCause} from './workshopPrediction.ts';
import {blindTicket,type BlindTicketId} from './blindTickets.ts';


export type EvidenceInterpretation='directory-change'|'file-change'|'backup-restored'|'command-only';
export interface EvidenceRow { label:string; before:string; after:string }
export interface ConcreteEvidence {
  rows:EvidenceRow[];
  question:string;
  options:{id:EvidenceInterpretation;label:string}[];
  correct:EvidenceInterpretation;
}
const octal=(value:number)=>value.toString(8).padStart(3,'0');
const sameRecord=(a:Record<string,unknown>,b:Record<string,unknown>)=>
  Object.keys(a).length===Object.keys(b).length&&
  Object.keys(a).every(key=>Object.hasOwn(b,key)&&a[key]===b[key]);

/** Actual before/after virtual states are the evidence, never the selected
 * scenario, guessed answer, or a hardcoded success message.
 */
export function concreteRecoveryEvidence(
  incident:Pick<WorkshopResult,'completed'|'steps'|'state'>,
  preview:RecoveryVerification|null,
  ticketId:BlindTicketId='service'
):ConcreteEvidence|null {
  const ticket=blindTicket(ticketId);
  const FILE=ticket.file,DIR=ticket.directory,BACKUP=ticket.backup;
  if(!incident.completed||!preview?.verified||
     preview.checks.length!==3||
     new Set(preview.checks.map(c=>c.id)).size!==3||
     !['read','scope','integrity'].every(id=>
       preview.checks.some(c=>c.id===id&&c.passed)))return null;
  const traceCause=observedAccessCause(incident);
  if(!traceCause)return null;
  const before=incident.state,after=preview.state;
  const beforeExists=Object.hasOwn(before.files,FILE);
  const afterExists=Object.hasOwn(after.files,FILE);
  const dirBefore=modeOf(before,DIR),dirAfter=modeOf(after,DIR);
  const fileBefore=beforeExists?modeOf(before,FILE):null;
  const fileAfter=afterExists?modeOf(after,FILE):null;
  const readBefore=executeLinux(before,'cat '+FILE);
  const readAfter=executeLinux(after,'cat '+FILE);
  if(!before.dirs.includes(DIR)||!after.dirs.includes(DIR)||
     readBefore.ok||!readAfter.ok||readAfter.target!==FILE||
     !afterExists||readAfter.output!==after.files[FILE])return null;

  // Independently verify that other files, permissions, directories and
  // owners did not change. The training backup is only permitted for restore.
  const otherFilesBefore={...before.files},otherFilesAfter={...after.files};
  delete otherFilesBefore[FILE];delete otherFilesAfter[FILE];
  const otherModesBefore={...before.permissions},otherModesAfter={...after.permissions};
  delete otherModesBefore[FILE];delete otherModesAfter[FILE];
  delete otherModesBefore[DIR];delete otherModesAfter[DIR];
  const otherOwnersBefore={...before.ownership},otherOwnersAfter={...after.ownership};
  delete otherOwnersBefore[FILE];delete otherOwnersAfter[FILE];
  if(preview.usedTrainingBackup){
    delete otherFilesAfter[BACKUP];
    delete otherModesAfter[BACKUP];
    delete otherOwnersAfter[BACKUP];
  }
  if(!sameRecord(otherFilesBefore,otherFilesAfter)||
     !sameRecord(otherModesBefore,otherModesAfter)||
     !sameRecord(otherOwnersBefore,otherOwnersAfter)||
     before.dirs.length!==after.dirs.length||
     before.dirs.some((dir,i)=>dir!==after.dirs[i]))return null;

  const contentSame=beforeExists&&after.files[FILE]===before.files[FILE];
  const backupSame=preview.usedTrainingBackup&&
    !Object.hasOwn(before.files,BACKUP)&&
    after.files[FILE]===after.files[BACKUP]&&
    after.files[BACKUP]===ticket.content;
  const changedDirectory=traceCause==='directory'&&beforeExists&&
    !preview.usedTrainingBackup&&dirBefore===0o600&&dirAfter===0o700&&
    fileBefore===fileAfter&&contentSame;
  const changedFile=traceCause==='file'&&beforeExists&&
    !preview.usedTrainingBackup&&dirBefore===dirAfter&&dirAfter===0o700&&
    fileBefore===0o000&&fileAfter===0o400&&contentSame;
  const restored=traceCause==='missing'&&!beforeExists&&preview.usedTrainingBackup&&
    dirBefore===dirAfter&&dirAfter===0o700&&fileAfter===0o644&&backupSame;
  if([changedDirectory,changedFile,restored].filter(Boolean).length!==1)return null;

  const rows:EvidenceRow[]=[
    {label:'cat '+ticket.name,before:'kod '+(readBefore.ok?'0':'1'),
      after:'kod '+(readAfter.ok?'0':'1')},
    {label:'Katalog diagnostics',before:octal(dirBefore),after:octal(dirAfter)},
    {label:'Plik '+ticket.name,before:fileBefore===null?'brak':octal(fileBefore),
      after:fileAfter===null?'brak':octal(fileAfter)},
    {label:'Zgodność danych',before:beforeExists?'plik był obecny':'plik był nieobecny',
      after:restored?'zgodne z kopią treningową':contentSame?'bez zmiany treści':'niepotwierdzona'}
  ];
  if(changedDirectory)return {
    rows,question:'Który wniosek wynika z tych trybów i wyniku odczytu?',
    correct:'directory-change',
    options:[
      {id:'file-change',label:'Zmieniło się wyłącznie prawo odczytu pliku.'},
      {id:'directory-change',label:'Dodano wyłącznie owner-x katalogu; plik zachował prawa i treść.'},
      {id:'command-only',label:'Sam sukces polecenia chmod dowodzi, że prawa są bezpieczne.'}
    ]
  };
  if(changedFile)return {
    rows,question:'Jaką minimalną zmianę rzeczywiście potwierdzają wyniki?',
    correct:'file-change',
    options:[
      {id:'command-only',label:'Wystarczy, że chmod zwrócił kod 0; nie trzeba porównywać trybów.'},
      {id:'directory-change',label:'Otwarto dostęp przez katalog dla wszystkich użytkowników.'},
      {id:'file-change',label:'Plik zmienił 000 na 400; katalog i dane pozostały bez zmian.'}
    ]
  };
  return {
    rows,question:'Co potwierdza poprawne odtworzenie brakującego pliku?',
    correct:'backup-restored',
    options:[
      {id:'backup-restored',label:'Plik znów istnieje i jego treść zgadza się z kopią treningową.'},
      {id:'file-change',label:'Samo chmod u+r utworzyło plik z oryginalną treścią.'},
      {id:'command-only',label:'Wystarcza to, że wykonano cp - nie trzeba sprawdzać zawartości.'}
    ]
  };
}
export function gradeConcreteEvidence(
  evidence:ConcreteEvidence|null,
  selected:EvidenceInterpretation|''
):{matched:boolean|null;message:string}{
  if(!evidence||!selected)return {
    matched:null,message:'Brakuje obserwacji albo odpowiedzi. Sprawdź wynik naprawy.'
  };
  if(!evidence.options.some(option=>option.id===selected))return {
    matched:false,message:'Wybrana odpowiedź nie należy do tego przypadku.'
  };
  const matched=selected===evidence.correct;
  return {
    matched,
    message:matched?'Poprawnie: wniosek jest zgodny z wynikami przed i po naprawie.':
      'Porównaj kod odczytu, tryby 600/700 lub 000/400 oraz zgodność danych. Samo wykonanie polecenia nie wystarcza.'
  };
}
