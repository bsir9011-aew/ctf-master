export type WorkshopId='backup'|'diagnosis';
export const WORKSHOP_DEFAULT='BASE=~/practice\nfor FILE in ...; do ...; done\ntest -f ... && test -f ...';
export const DIAGNOSIS_DEFAULT='BASE=~/practice\ntest -f ... && test -f ...\necho $?';
export const workshopScenarios=[
  {id:'backup',label:'01 · Kopie logów',title:'Zabezpiecz dwa logi'},
  {id:'diagnosis',label:'02 · Brakujący log',title:'Znajdź brakujący log'}
] as const;
export const workshopInitialScript=(id:WorkshopId)=>
  id==='diagnosis'?DIAGNOSIS_DEFAULT:WORKSHOP_DEFAULT;
/** Keep RC.38-41 draft key 100% backwards compatible. */
export const workshopDraftKey=(id:WorkshopId)=>
  id==='diagnosis'?'ctf-master:bash-workshop-diagnosis-draft-v1':
    'ctf-master:bash-workshop-draft-v1';
