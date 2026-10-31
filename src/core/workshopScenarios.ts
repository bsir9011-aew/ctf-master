export type WorkshopId='backup'|'diagnosis'|'permissions'|'fallback';
export const WORKSHOP_DEFAULT='BASE=~/practice\nfor FILE in ...; do ...; done\ntest -f ... && test -f ...';
export const DIAGNOSIS_DEFAULT='BASE=~/practice\ntest -f ... && test -f ...\necho $?';
export const PERMISSIONS_DEFAULT='BASE=~/practice\ntest -f ... && test -r ...\necho $?';
export const FALLBACK_DEFAULT='BASE=~/practice\ntest -f ... || test -f ...\necho $?';
export const workshopScenarios=[
  {id:'backup',label:'01 · Kopie logów',title:'Zabezpiecz dwa logi'},
  {id:'diagnosis',label:'02 · Brakujący log',title:'Znajdź brakujący log'},
  {id:'permissions',label:'03 · Uprawnienia',title:'Plik istnieje, ale nie można go czytać'},
  {id:'fallback',label:'04 · Plan awaryjny',title:'Znajdź działający log zastępczy'}
] as const;
export const workshopInitialScript=(id:WorkshopId)=>
  id==='fallback'?FALLBACK_DEFAULT:
  id==='permissions'?PERMISSIONS_DEFAULT:
  id==='diagnosis'?DIAGNOSIS_DEFAULT:WORKSHOP_DEFAULT;
/** Keep all RC.38-43 draft keys 100% backwards compatible. */
export const workshopDraftKey=(id:WorkshopId)=>
  id==='fallback'?'ctf-master:bash-workshop-fallback-draft-v1':
  id==='permissions'?'ctf-master:bash-workshop-permissions-draft-v1':
  id==='diagnosis'?'ctf-master:bash-workshop-diagnosis-draft-v1':
    'ctf-master:bash-workshop-draft-v1';
