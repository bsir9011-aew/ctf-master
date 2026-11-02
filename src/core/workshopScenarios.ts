export type WorkshopId='backup'|'diagnosis'|'permissions'|'fallback'|'transfer'|'pathblock'|'repair';
export const WORKSHOP_DEFAULT='BASE=~/practice\nfor FILE in ...; do ...; done\ntest -f ... && test -f ...';
export const DIAGNOSIS_DEFAULT='BASE=~/practice\ntest -f ... && test -f ...\necho $?';
export const PERMISSIONS_DEFAULT='BASE=~/practice\ntest -f ... && test -r ...\necho $?';
export const FALLBACK_DEFAULT='BASE=~/practice\ntest -f ... || test -f ...\necho $?';
export const PATHBLOCK_DEFAULT='BASE=~/practice\ntest -r ...\necho $?\nnamei -l ...';
export const REPAIR_DEFAULT='BASE=~/practice\nnamei -l ...\nchmod ... ...\ncat ...';
export const workshopScenarios=[
  {id:'backup',label:'01 · Kopie logów',title:'Zabezpiecz dwa logi'},
  {id:'diagnosis',label:'02 · Brakujący log',title:'Znajdź brakujący log'},
  {id:'permissions',label:'03 · Uprawnienia',title:'Plik istnieje, ale nie można go czytać'},
  {id:'fallback',label:'04 · Plan awaryjny',title:'Znajdź działający log zastępczy'},
  {id:'transfer',label:'05 · Sprawdzian',title:'Samodzielnie: awaria logowania'},
  {id:'pathblock',label:'06 · Katalog',title:'Dlaczego nie można odczytać pliku?'},
  {id:'repair',label:'07 · Naprawa',title:'Przywróć dostęp bez nadawania zbędnych praw'}
] as const;
export const workshopInitialScript=(id:WorkshopId)=>
  id==='repair'?REPAIR_DEFAULT:
  id==='pathblock'?PATHBLOCK_DEFAULT:
  id==='transfer'?'':
  id==='fallback'?FALLBACK_DEFAULT:
  id==='permissions'?PERMISSIONS_DEFAULT:
  id==='diagnosis'?DIAGNOSIS_DEFAULT:WORKSHOP_DEFAULT;
/** Preserve all RC.38-48 draft keys. */
export const workshopDraftKey=(id:WorkshopId)=>
  id==='repair'?'ctf-master:bash-workshop-repair-draft-v1':
  id==='pathblock'?'ctf-master:bash-workshop-pathblock-draft-v1':
  id==='transfer'?'ctf-master:bash-workshop-transfer-draft-v1':
  id==='fallback'?'ctf-master:bash-workshop-fallback-draft-v1':
  id==='permissions'?'ctf-master:bash-workshop-permissions-draft-v1':
  id==='diagnosis'?'ctf-master:bash-workshop-diagnosis-draft-v1':
    'ctf-master:bash-workshop-draft-v1';

/** All three repairs live within one short mobile challenge. */
export type RepairWorkshopVariant='intro'|'transfer'|'file';
export const repairWorkshopDraftKey=(variant:RepairWorkshopVariant)=>
  variant==='file'?'ctf-master:bash-workshop-repair-file-draft-v1':
  variant==='transfer'?'ctf-master:bash-workshop-repair-transfer-draft-v1':
    workshopDraftKey('repair');
export const repairWorkshopStarter=(variant:RepairWorkshopVariant)=>
  variant==='intro'?REPAIR_DEFAULT:'';

/** Independent file-read denial reuses Academy's locked.log and preserves guided draft. */
export const pathblockWorkshopDraftKey=(variant:'intro'|'transfer')=>
  variant==='transfer'?'ctf-master:bash-workshop-pathblock-transfer-draft-v1':
    workshopDraftKey('pathblock');
export const pathblockWorkshopStarter=(variant:'intro'|'transfer')=>
  variant==='transfer'?'':PATHBLOCK_DEFAULT;
