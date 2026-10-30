import { executeLinux, type CommandResult, type LinuxState } from './linux.ts';
import { createAcademyState } from './commandAcademy.ts';

const LAB='/home/player/practice';
const hasFile=(s:LinuxState,name:string)=>Object.hasOwn(s.files,LAB+'/'+name);
const saw=(events:CommandResult[],command:string,predicate:(e:CommandResult)=>boolean):boolean =>
  events.some(e=>e.ok && e.command===command && predicate(e));

export interface TransferChallenge {
  lessonId:string;
  assignment:string;
  pass:(state:LinuxState,events:CommandResult[])=>boolean;
}

/** A second, changed problem for each command. No answer strings are exposed in UI. */
export const transferChallenges:readonly TransferChallenge[]=[
  {lessonId:'pwd',assignment:'Pracujesz teraz w katalogu logs. Wyświetl jego pełną ścieżkę.',
    pass:(_s,e)=>saw(e,'pwd',r=>r.output===LAB+'/logs')},
  {lessonId:'ls',assignment:'Sprawdź zawartość katalogu ~/practice/logs i znajdź plik audit-67.txt.',
    pass:(_s,e)=>saw(e,'ls',r=>r.target===LAB+'/logs' && r.output.includes('audit-67.txt'))},
  {lessonId:'cd',assignment:'Przejdź do podkatalogu ~/practice/logs, zaczynając z katalogu domowego.',
    pass:(s,e)=>s.cwd===LAB+'/logs' && saw(e,'cd',r=>r.target===LAB+'/logs')},
  {lessonId:'mkdir',assignment:'Utwórz katalog reports w ~/practice.',
    pass:s=>s.dirs.includes(LAB+'/reports')},
  {lessonId:'touch',assignment:'Utwórz pusty plik draft.txt w ~/practice.',
    pass:s=>hasFile(s,'draft.txt') && s.files[LAB+'/draft.txt']===''},
  {lessonId:'cat',assignment:'Odczytaj treść pliku ~/practice/logs/audit-67.txt.',
    pass:(_s,e)=>saw(e,'cat',r=>r.target===LAB+'/logs/audit-67.txt' && r.output.includes('audit event 67'))},
  {lessonId:'grep',assignment:'W dzienniku ~/practice/events.log odszukaj wpis INFO sync complete.',
    pass:(_s,e)=>saw(e,'grep',r=>r.target===LAB+'/events.log' && r.output.includes('INFO sync complete'))},
  {lessonId:'find',assignment:'Znajdź audit-67.txt w podkatalogach ~/practice za pomocą find.',
    pass:(_s,e)=>saw(e,'find',r=>r.target===LAB && r.output.split('\n').includes(LAB+'/logs/audit-67.txt'))},
  {lessonId:'cp',assignment:'Zachowaj kopię ~/practice/intro.txt w ~/practice/intro-copy.txt, nie usuwając oryginału.',
    pass:s=>hasFile(s,'intro.txt') && hasFile(s,'intro-copy.txt') &&
      s.files[LAB+'/intro-copy.txt']===s.files[LAB+'/intro.txt']},
  {lessonId:'mv',assignment:'Przenieś ~/practice/source.txt do ~/practice/source-renamed.txt.',
    pass:s=>!hasFile(s,'source.txt') && s.files[LAB+'/source-renamed.txt']==='COPY_ME'},
  {lessonId:'rm',assignment:'Usuń plik ~/practice/review.tmp, zachowując pozostałe dane.',
    pass:s=>!hasFile(s,'review.tmp') && hasFile(s,'intro.txt') && hasFile(s,'source.txt')},
  {lessonId:'chmod',assignment:'Zabezpiecz ~/practice/team.key, pozostawiając prawo czytania i zapisu wyłącznie właścicielowi.',
    pass:s=>hasFile(s,'team.key') && s.permissions?.[LAB+'/team.key']===0o600},
  {lessonId:'ps',assignment:'Sprawdź działające procesy. Odszukaj proces cpu-burn.',
    pass:(_s,e)=>saw(e,'ps',r=>r.output.includes('cpu-burn'))},
  {lessonId:'systemctl',assignment:'Sprawdź, czy sshd.service działa. Odczytaj stan active.',
    pass:(_s,e)=>saw(e,'systemctl',r=>r.target==='sshd.service' && r.output.includes('Active: active'))},
  {lessonId:'ip',assignment:'Sprawdź aktualny adres i prefiks interfejsu eth0.',
    pass:(_s,e)=>saw(e,'ip',r=>r.target==='eth0' && r.output.includes('inet '))}
];

/** Fully fresh environment for the transfer, independent of both intro and missions. */
export function createTransferState(lessonId:string):LinuxState {
  if(!transferChallenges.some(item=>item.lessonId===lessonId)) throw Error('Unknown transfer lesson');
  const state=createAcademyState();
  return {
    ...state,
    cwd:lessonId==='pwd'?LAB+'/logs':state.cwd,
    files:{
      ...state.files,
      [LAB+'/logs/audit-67.txt']:'audit event 67',
      [LAB+'/review.tmp']:'temporary review data',
      [LAB+'/team.key']:'SIMULATED_TEAM_KEY'
    },
    permissions:{...state.permissions,[LAB+'/team.key']:0o644}
  };
}

export function submitTransfer(state:LinuxState,events:CommandResult[],raw:string,lessonId:string) {
  const lesson=transferChallenges.find(x=>x.lessonId===lessonId);
  if(!lesson) throw Error('Unknown transfer lesson');
  const result=executeLinux(state,raw);
  const nextEvents=[...events,result].slice(-40);
  return {result,events:nextEvents,completed:lesson.pass(result.state,nextEvents)};
}

export function earnedMastery(completed:boolean,errors:number,usedHint:boolean):boolean {
  return completed && errors===0 && !usedHint;
}

/**
 * A clean transfer attempt cannot include a successful-but-wrong use of
 * the command currently being evaluated. Exploratory successful commands
 * (pwd/ls/stat etc.) remain allowed while solving another command's task.
 * Failed commands of any kind still count as mistakes.
 */
export function transferMistake(
  lessonId:string,result:CommandResult,completed:boolean
):boolean {
  return !result.ok || (result.command===lessonId && !completed);
}
