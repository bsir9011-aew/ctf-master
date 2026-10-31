import { executeLinux, type CommandResult, type LinuxState } from './linux.ts';
import { createAcademyState } from './commandAcademy.ts';
import { investigationFiles, investigationStatus } from './investigation.ts';
import { usedManualBefore } from './manual.ts';
import {recoveryFixture,recoveryCompleted} from './pathRecovery.ts';
import {umaskExerciseCompleted} from './umask.ts';
import {shareCase,shareCompleted} from './chgrp.ts';
import {redirectionCase,redirectionCompleted} from './redirection.ts';
import {quotingCase,quotingCompleted} from './quoting.ts';
import {statusCase,statusCompleted} from './exitStatus.ts';
import {transferTestFixture,fileTestCompleted,fileTestMistake} from './fileTest.ts';
import {conditionalCompleted,conditionalMistake} from './conditionalLesson.ts';
import {variableCompleted,variableMistake} from './variableLesson.ts';

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
  {lessonId:'variables',assignment:'Zachowaj w SOURCE ścieżkę ~/practice/logs/review.log, a w DEST nową ścieżkę ~/practice/logs/variable-evidence.log. Za pomocą obu zmiennych wykonaj kopię, a następnie odczytaj ją przez DEST. Oryginał musi zostać nienaruszony; nie używaj dosłownych ścieżek w cp/cat.',
    pass:(state,events)=>variableCompleted('transfer',state,events)},
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
  {lessonId:'id',assignment:'W tej sesji pracujesz jako analyst. Sprawdź NAZWĘ jego grupy podstawowej, a następnie wyświetl NAZWY wszystkich grup, łącznie z dodatkowymi. Porównaj oba wyniki.',
    pass:(_s,e)=>{
      const primary=e.findIndex(r=>r.ok&&r.command==='id'&&
        r.target==='primary-name'&&r.output==='security');
      return primary>=0&&e.slice(primary+1).some(r=>r.ok&&
        (r.command==='id'||r.command==='groups')&&
        r.target==='group-names'&&r.output==='security audit');
    }},
  {lessonId:'man',assignment:'Pracujesz z nieznanym poleceniem head. Najpierw sprawdz jego opcje w man head, a potem wyswietl dokladnie dwa pierwsze wiersze ~/practice/logs/manual-review.log. Dobierz parametry samodzielnie.',
    pass:(_s,e)=>usedManualBefore(e,'head','head',r=>
      r.target===LAB+'/logs/manual-review.log' &&
      r.output==='WARN service slow\nINFO restart scheduled')},
  {lessonId:'grep',assignment:'W dzienniku ~/practice/events.log odszukaj wpis INFO sync complete.',
    pass:(_s,e)=>saw(e,'grep',r=>r.target===LAB+'/events.log' && r.output.includes('INFO sync complete'))},
  {lessonId:'head',assignment:'Zobacz pierwsze 2 wiersze nowego dziennika ~/practice/logs/review.log.',
    pass:(_s,e)=>saw(e,'head',r=>r.target===LAB+'/logs/review.log' &&
      r.output==='WARN spike\nINFO stable')},
  {lessonId:'tail',assignment:'Zobacz ostatnie 3 wiersze ~/practice/logs/review.log.',
    pass:(_s,e)=>saw(e,'tail',r=>r.target===LAB+'/logs/review.log' &&
      r.output==='ERROR temp\nINFO review\nWARN resolved')},
  {lessonId:'wc',assignment:'Policz wiersze nowego dziennika ~/practice/logs/review.log.',
    pass:(_s,e)=>saw(e,'wc',r=>r.target===LAB+'/logs/review.log' && r.output==='5')},
  {lessonId:'sort',assignment:'Wypisz wiersze ~/practice/review-names.txt w kolejności alfabetycznej.',
    pass:(_s,e)=>saw(e,'sort',r=>r.target===LAB+'/review-names.txt' &&
      r.output==='adam\nola\ntomasz')},
  {lessonId:'uniq',assignment:'Pokaż ~/practice/review-levels.txt bez sąsiadujących powtórzeń wpisów.',
    pass:(_s,e)=>saw(e,'uniq',r=>r.target===LAB+'/review-levels.txt' &&
      r.output==='OK\nWARN\nOK')},
  {lessonId:'pipeline',assignment:'W ~/practice/logs/incidents.log policz, ile różnych komunikatów ERROR wystąpiło. Użyj jednego potoku grep, sort, uniq i wc -l.',
    pass:(_s,e)=>saw(e,'pipeline',r=>r.target===LAB+'/logs/incidents.log' &&
      r.stages?.join('>')==='grep>sort>uniq>wc' &&
      r.filterPattern==='ERROR' && r.output==='3')},
  {lessonId:'redirect',assignment:'Z nowego logu ~/practice/logs/incidents.log przygotuj raport ~/practice/incidents-summary.log. Najpierw zapisz wszystkie ERROR przez >, potem dopisz wszystkie INFO przez >>. Oryginał zostaw bez zmian. Na koniec odczytaj raport cat.',
    pass:(state,events)=>redirectionCompleted('transfer',state,events)},
  {lessonId:'quoting',assignment:'W katalogu ~/practice/logs odnajdź plik audit notes.txt. Przenieś go do nowej nazwy incident notes.txt w tym samym katalogu, bez zmiany treści. Na końcu odczytaj przeniesiony plik poleceniem cat. Dobierz sposób ochrony spacji w ścieżkach.',
    pass:(state,events)=>quotingCompleted('transfer',state,events)},
  {lessonId:'exit-status',assignment:'Sprawdź dziennik ~/practice/logs/review.log pod kątem wpisu CRITICAL, a następnie bezpośrednio zbadaj status komendy. Później wyszukaj ERROR i odczytaj jego status od razu po wyszukiwaniu. Zademonstruj różnicę między brakiem dopasowania a sukcesem.',
    pass:(_state,events)=>statusCompleted('transfer',events)},
  {lessonId:'test',assignment:'Log ~/practice/logs/forensics/trace.log wygląda na czytelny (644), lecz katalog forensics blokuje przejście. Sprawdź test -r na pliku i natychmiast echo $?. Zdiagnozuj test -x na katalogu i odczytaj jego status. Następnie przywróć właścicielowi tylko brakujące prawo przejścia, po czym ponów test -r i echo $?. Nie otwieraj dostępu innym ani nie zmieniaj pliku.',
    pass:(state,events)=>fileTestCompleted('transfer',state,events)},
  {lessonId:'conditionals',assignment:'Przygotuj raport dowodowy z ~/practice/logs/review.log do ~/practice/logs/review-evidence.log, używając test -f i &&, aby nie wykonywać cp bez źródła. Następnie sprawdź brak unknown-evidence.log i upewnij się przez &&, że skip-this.tmp NIE powstanie. Gdy unknown-evidence.log nie istnieje, przez || utwórz investigate.flag. Potwierdź treść kopii poleceniem cat. Zachowaj oryginalny log.',
    pass:(state,events)=>conditionalCompleted('transfer',state,events)},
  {lessonId:'investigation',assignment:'SOC otrzymał alert o nietypowych próbach logowania około 04:12. Samodzielnie rozpoznaj właściwy dziennik w ~/practice/logs, odczytaj ślad związanego z tym zdarzenia i zabezpiecz cały plik jako ~/practice/incident-evidence.log. Zachowaj oryginalne logi.',
    pass:(s,e)=>investigationStatus('transfer',s,e).completed},
  {lessonId:'find',assignment:'Znajdź audit-67.txt w podkatalogach ~/practice za pomocą find.',
    pass:(_s,e)=>saw(e,'find',r=>r.target===LAB && r.output.split('\n').includes(LAB+'/logs/audit-67.txt'))},
  {lessonId:'cp',assignment:'Zachowaj kopię ~/practice/intro.txt w ~/practice/intro-copy.txt, nie usuwając oryginału.',
    pass:s=>hasFile(s,'intro.txt') && hasFile(s,'intro-copy.txt') &&
      s.files[LAB+'/intro-copy.txt']===s.files[LAB+'/intro.txt']},
  {lessonId:'mv',assignment:'Przenieś ~/practice/source.txt do ~/practice/source-renamed.txt.',
    pass:s=>!hasFile(s,'source.txt') && s.files[LAB+'/source-renamed.txt']==='COPY_ME'},
  {lessonId:'rm',assignment:'Usuń plik ~/practice/review.tmp, zachowując pozostałe dane.',
    pass:s=>!hasFile(s,'review.tmp') && hasFile(s,'intro.txt') && hasFile(s,'source.txt')},
  {lessonId:'file-access',assignment:'Jako analyst należysz do grup security i audit. Pliki ~/practice/logs/audit-share.log i ~/practice/logs/player-share.log mają 640, ale inną grupę. Sprawdź swoje grupy, obejrzyj grupę pliku i odczytaj właściwy log audit-share.log.',
    pass:(_s,e)=>{
      const membership=e.findIndex(r=>r.ok&&r.command==='id'&&r.target==='group-ids'&&r.output==='1100 1200');
      const inspect=e.findIndex((r,i)=>i>membership&&r.ok&&
        (r.command==='stat'||r.command==='ls')&&r.target===LAB+'/logs/audit-share.log'&&
        r.output.includes('audit'));
      return membership>=0&&inspect>membership&&e.slice(inspect+1).some(r=>r.ok&&
        r.command==='cat'&&r.target===LAB+'/logs/audit-share.log'&&
        r.output==='AUDIT: incident evidence review');
    }},
  {lessonId:'namei',assignment:'Nowy katalog ~/practice/logs/locked blokuje dostęp do health.log, mimo że sam plik ma prawo odczytu. Znajdź brakujący bit przez namei -l, przywróć najmniejsze niezbędne uprawnienia właścicielowi katalogu i potwierdź odczyt pliku. Nie otwieraj uprawnień pozostałym.',
    pass:(state,events)=>recoveryCompleted('transfer',state,events)},
  {lessonId:'umask',assignment:'Zespół potrzebuje pliku, który grupa może odczytać, ale inni nie. Ustaw maskę tak, aby NOWY plik ~/practice/team-draft.txt miał prawa 640, a NOWY katalog ~/practice/team-work miał prawa 750. Nie zmieniaj uprawnień po utworzeniu.',
    pass:(state,events)=>umaskExerciseCompleted(state,events,0o027,
      LAB+'/team-draft.txt',LAB+'/team-work')},
  {lessonId:'chgrp',assignment:'Jako analyst masz dostęp do grup security i audit. Plik ~/practice/logs/audit-report.log ma obecnie grupę security i tryb 640. Przenieś jego własność grupową do audit bez zmiany uprawnień lub treści, a następnie potwierdź to w stat lub ls -l.',
    pass:(state,events)=>shareCompleted('transfer',state,events)},
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
  // The second investigation deliberately replaces rather than repeats
  // the first case's candidate files.
  const introCandidates=investigationFiles('intro');
  const baseFiles=lessonId==='investigation'
    ? Object.fromEntries(Object.entries(state.files).filter(([path])=>!Object.hasOwn(introCandidates,path)))
    : state.files;
  return {
    ...state,
    cwd:lessonId==='pwd'?LAB+'/logs':state.cwd,
    dirs:[...state.dirs,...(lessonId==='namei'?[recoveryFixture('transfer').directory]:[]),
      ...(lessonId==='test'?[transferTestFixture.directory]:[])],
    identity:(lessonId==='id'||lessonId==='file-access'||lessonId==='chgrp')
      ?{uid:1001,user:'analyst',primary:{gid:1100,name:'security'},
        supplementary:[{gid:1200,name:'audit'}]}
      :state.identity,
    files:{
      ...baseFiles,
      ...investigationFiles('transfer'),
      [LAB+'/logs/audit-67.txt']:'audit event 67',
      ...(lessonId==='test'?{[transferTestFixture.file]:transferTestFixture.content}:{}),
      [quotingCase('transfer').source]:quotingCase('transfer').content,
      [shareCase('transfer').path]:shareCase('transfer').content,
      ...(lessonId==='namei'?{[recoveryFixture('transfer').file]:recoveryFixture('transfer').content}:{}),
      [LAB+'/logs/audit-share.log']:'AUDIT: incident evidence review',
      [LAB+'/logs/player-share.log']:'PLAYER: private account log',
      [LAB+'/logs/manual-review.log']:'WARN service slow\nINFO restart scheduled\nERROR retry failed\nINFO operator notified\n',
      [LAB+'/review.tmp']:'temporary review data',
      [LAB+'/team.key']:'SIMULATED_TEAM_KEY',
      [LAB+'/logs/review.log']:'WARN spike\nINFO stable\nERROR temp\nINFO review\nWARN resolved\n',
      [LAB+'/logs/incidents.log']:'ERROR disk\nINFO ready\nERROR network\nERROR disk\nERROR memory\nINFO sync\nERROR network\n',
      [LAB+'/review-names.txt']:'tomasz\nadam\nola\n',
      [LAB+'/review-levels.txt']:'OK\nOK\nWARN\nWARN\nOK\n'
    },
    permissions:{...state.permissions,[LAB+'/team.key']:0o644,
      [LAB+'/logs/audit-share.log']:0o640,[LAB+'/logs/player-share.log']:0o640,
      [shareCase('transfer').path]:0o640,
      ...(lessonId==='namei'?{[recoveryFixture('transfer').directory]:0o600}:{}),
      ...(lessonId==='test'?{[transferTestFixture.directory]:0o600,
        [transferTestFixture.file]:0o644}:{})},
    ownership:{...state.ownership,
      [LAB+'/logs/audit-share.log']:{uid:2000,gid:1200},
      [LAB+'/logs/player-share.log']:{uid:2000,gid:1000},
      [shareCase('transfer').path]:{uid:1001,gid:1100}}
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
  if(lessonId==='conditionals')return conditionalMistake(result);
  if(lessonId==='variables')return variableMistake('transfer',result);
  if(lessonId==='test')return fileTestMistake(result);
  if(lessonId==='exit-status'){
    const c=statusCase('transfer');
    if(result.command==='grep'&&result.target===c.file&&
       result.filterPattern===c.absent&&result.exitCode===1)return false;
    if(result.command==='grep'&&result.target===c.file&&
       result.filterPattern===c.present&&result.exitCode===0)return false;
    return !result.ok||(result.command==='grep'&&result.target!==c.file);
  }
  if(lessonId==='quoting'){
    const c=quotingCase('transfer');
    return !result.ok||(result.command==='mv'&&
      (result.target!==c.target||result.state.files[c.target]!==c.content));
  }
  if(lessonId==='redirect'){
    const c=redirectionCase('transfer');
    const data=result.state.files[c.target];
    return !result.ok||(result.command==='redirect'&&
      (result.target!==c.target||result.sourceCommand!=='grep'||
       ![c.warning,c.warning+c.rest].includes(data)));
  }
  if(lessonId==='investigation')
    return !result.ok || (result.command==='cp' && !completed);
  if(lessonId==='man')
    return !result.ok || (result.command==='head' && !completed);
  if(lessonId==='id')
    return !result.ok || (result.target==='group-names' && !completed);
  if(lessonId==='file-access')
    return !result.ok || (result.command==='cat' && !completed);
  if(lessonId==='namei')
    return !result.ok || (result.command==='chmod' && !completed && result.target!==recoveryFixture('transfer').directory);
  if(lessonId==='umask')
    return !result.ok || (result.command==='umask'&&result.target!=='027') ||
      (result.command==='chmod' && !completed);
  if(lessonId==='chgrp') {
    const target=shareCase('transfer');
    return !result.ok ||
      (result.command==='chgrp' &&
       (result.target!==target.path ||
        result.state.ownership?.[target.path]?.gid!==target.newGid));
  }
  return !result.ok || (result.command===lessonId && !completed);
}
