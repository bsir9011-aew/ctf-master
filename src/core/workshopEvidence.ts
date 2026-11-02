import type {RecoveryVerification} from './workshopRecoveryVerify.ts';
import type {RecoveryCheck} from './workshopRecoveryVerify.ts';

export type EvidenceChoice=RecoveryCheck['id']|'command-only';
export const recoveryEvidenceOptions:readonly {id:EvidenceChoice;label:string}[]=[
  {id:'read',label:'Ponowny odczyt właściwego pliku zakończył się sukcesem'},
  {id:'scope',label:'Uprawnienia są minimalne, a inne zasoby nie zostały otwarte'},
  {id:'integrity',label:'Treść i integralność innych danych zostały zweryfikowane'},
  {id:'command-only',label:'Samo wykonanie chmod/cp wystarczy jako dowód naprawy'}
];

export interface EvidenceAssessment {
  matched:boolean|null;
  message:string;
}
/** Compare the learner's independent evidence selection with the ACTUAL
 * simulated post-fix checks. Never grade from scenario labels or predicted cause.
 */
export function gradeRecoveryEvidence(
  verification:Pick<RecoveryVerification,'verified'|'checks'>|null,
  selected:readonly EvidenceChoice[]
):EvidenceAssessment {
  const known=new Set<EvidenceChoice>(recoveryEvidenceOptions.map(option=>option.id));
  const ids=verification?.checks.map(check=>check.id)??[];
  if(!verification||ids.length!==3||new Set(ids).size!==3||
     !['read','scope','integrity'].every(id=>ids.includes(id as RecoveryCheck['id']))||
     !verification.verified||verification.checks.some(check=>!check.passed))
    return {matched:null,message:'Brakuje potwierdzonych wyników wszystkich kontroli. Nie można zatwierdzić naprawy.'};
  const unique=new Set(selected);
  const valid=selected.length===unique.size&&
    selected.every(choice=>known.has(choice))&&
    unique.size===3&&ids.every(id=>unique.has(id));
  return valid
    ?{matched:true,message:'Dowody rozpoznane: potwierdzono odczyt, minimalne prawa i integralność danych.'}
    :{matched:false,message:'Nie wystarczy uruchomić komendy. Sprawdź, czy masz osobne dowody odczytu, zakresu praw i integralności.'};
}
