import type {WorkshopResult} from './bashWorkshop.ts';
import {observedAccessCause,type CausePrediction} from './workshopPrediction.ts';

export type RemediationChoice=''|'directory-x'|'file-r'|'restore-backup'|'chmod-777';
export interface RemediationFeedback {
  choice:Exclude<RemediationChoice,''>;
  cause:Exclude<CausePrediction,''>|null;
  matched:boolean|null;
  message:string;
}
const expected:Record<Exclude<CausePrediction,''>,Exclude<RemediationChoice,''>>={
  directory:'directory-x',
  file:'file-r',
  missing:'restore-backup'
};
const success:Record<Exclude<CausePrediction,''>,string>={
  directory:'Trafnie: przywróć wyłącznie właścicielowi prawo przejścia x na blokującym katalogu. Następnie sprawdź odczyt.',
  file:'Trafnie: przywróć wyłącznie właścicielowi prawo odczytu r na pliku. Następnie sprawdź odczyt.',
  missing:'Trafnie: odzyskaj brakujący plik ze sprawdzonej kopii i potwierdź integralność. Sam chmod ani pusty plik nie usunie przyczyny.'
};
/** Advisory-only. Never runs chmod, changes data, or grants task credit. */
export function gradeRemediation(
  choice:RemediationChoice,
  result:Pick<WorkshopResult,'steps'|'completed'>
):RemediationFeedback|null {
  if(!choice)return null;
  const cause=result.completed?observedAccessCause(result):null;
  if(!cause)return {
    choice,cause:null,matched:null,
    message:'Nie ma wystarczających, zgodnych dowodów na decyzję. Dokończ diagnozę tego samego pliku.'
  };
  const matched=expected[cause]===choice;
  return {
    choice,cause,matched,
    message:matched?success[cause]:
      choice==='chmod-777'
        ?'To nadmierne uprawnienia. Wybierz działanie tylko dla zasobu i prawa, których dotyczy dowód.'
        :'Ta interwencja nie usuwa wykrytej przyczyny. Porównaj ostatnią linię namei z testem odczytu.'
  };
}
