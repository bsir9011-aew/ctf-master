import { executeLinux, initialLinux, type CommandResult, type LinuxState } from './linux.ts';

export type CommandLessonGroup = 'Podstawy' | 'Pliki i logi' | 'Administracja' | 'Sieć';
export interface CommandLesson {
  id:string;
  title:string;
  group:CommandLessonGroup;
  purpose:string;
  syntax:string;
  example:string;
  assignment:string;
  hint:string;
  pass:(state:LinuxState, events:CommandResult[])=>boolean;
}

const HOME='/home/player';
const LAB=HOME+'/practice';

export function createAcademyState():LinuxState {
  const initial=initialLinux();
  return {
    ...initial,
    dirs:[...initial.dirs,LAB,LAB+'/logs'],
    files:{
      ...initial.files,
      [LAB+'/intro.txt']:'Practice is how commands become useful.',
      [LAB+'/events.log']:'INFO boot ready\nWARN backup delayed\nINFO sync complete',
      [LAB+'/logs/ticket-42.txt']:'Training ticket 42',
      [LAB+'/source.txt']:'COPY_ME',
      [LAB+'/move-me.txt']:'MOVE_ME',
      [LAB+'/delete-me.tmp']:'DELETE_ME',
      [LAB+'/private.txt']:'SIMULATED_PRACTICE_DATA'
    },
    permissions:{...initial.permissions,[LAB+'/private.txt']:0o644}
  };
}
const observed=(events:CommandResult[],command:string,predicate:(e:CommandResult)=>boolean):boolean=>
  events.some(e=>e.ok && e.command===command && predicate(e));

export const commandLessons:readonly CommandLesson[]=[
  {id:'pwd',title:'Gdzie jestem?',group:'Podstawy',
    purpose:'pwd wypisuje ścieżkę bieżącego katalogu, nie zmieniając plików.',
    syntax:'pwd',example:'pwd',assignment:'Wyświetl aktualny katalog użytkownika player.',
    hint:'To polecenie nie wymaga argumentu.',
    pass:(_s,e)=>observed(e,'pwd',r=>r.output===HOME)},
  {id:'ls',title:'Co jest w katalogu?',group:'Podstawy',
    purpose:'ls listuje zawartość katalogu. Opcja -l pokazuje więcej szczegółów.',
    syntax:'ls [OPCJE] [KATALOG]',example:'ls ~/documents',
    assignment:'Wyświetl pliki i katalogi znajdujące się w ~/practice.',
    hint:'Podaj po ls ścieżkę ~/practice.',
    pass:(_s,e)=>observed(e,'ls',r=>r.target===LAB && r.output.includes('intro.txt'))},
  {id:'cd',title:'Zmiana katalogu',group:'Podstawy',
    purpose:'cd zmienia katalog roboczy, od którego liczone są ścieżki względne.',
    syntax:'cd KATALOG',example:'cd ~/documents',
    assignment:'Przejdź do katalogu ~/practice.',
    hint:'Wpisz cd i docelową ścieżkę.',
    pass:(s,e)=>s.cwd===LAB && observed(e,'cd',r=>r.target===LAB)},
  {id:'mkdir',title:'Nowy katalog',group:'Podstawy',
    purpose:'mkdir tworzy nowy katalog we wskazanym miejscu.',
    syntax:'mkdir KATALOG',example:'mkdir ~/documents/demo',
    assignment:'Utwórz katalog experiments wewnątrz ~/practice.',
    hint:'Możesz użyć ścieżki ~/practice/experiments.',
    pass:s=>s.dirs.includes(LAB+'/experiments')},
  {id:'touch',title:'Nowy plik',group:'Podstawy',
    purpose:'touch w tym symulatorze tworzy pusty plik, jeśli jeszcze go nie ma.',
    syntax:'touch PLIK',example:'touch ~/documents/test.txt',
    assignment:'Utwórz plik note.txt w ~/practice.',
    hint:'Wskaż pełną ścieżkę do pliku w katalogu practice.',
    pass:s=>Object.hasOwn(s.files,LAB+'/note.txt')},
  {id:'cat',title:'Czytanie treści',group:'Podstawy',
    purpose:'cat odczytuje zawartość pliku tekstowego. Wymaga prawa odczytu.',
    syntax:'cat PLIK',example:'cat ~/notes.txt',
    assignment:'Odczytaj plik ~/practice/intro.txt.',
    hint:'Użyj cat oraz ścieżki do pliku intro.txt.',
    pass:(_s,e)=>observed(e,'cat',r=>r.target===LAB+'/intro.txt' && r.output.includes('Practice is how'))},
  {id:'grep',title:'Szukaj wpisu w logu',group:'Pliki i logi',
    purpose:'grep wyszukuje pasujące wiersze. Tutaj wzorzec jest dosłownym tekstem.',
    syntax:'grep [-i] TEKST PLIK',example:'grep INFO /var/log/auth.log',
    assignment:'Znajdź w ~/practice/events.log wiersz zawierający WARN.',
    hint:'Wyszukaj WARN w pliku events.log.',
    pass:(_s,e)=>observed(e,'grep',r=>r.target===LAB+'/events.log' && r.output.includes('WARN backup delayed'))},
  {id:'find',title:'Znajdź plik',group:'Pliki i logi',
    purpose:'find przeszukuje także podkatalogi; -name dopasowuje nazwę pliku.',
    syntax:'find KATALOG -name WZORZEC',example:'find ~/downloads -name "*.tmp"',
    assignment:'Odnajdź plik ticket-42.txt, przeszukując katalog ~/practice.',
    hint:'Możesz użyć find ~/practice -name "ticket-*.txt".',
    pass:(_s,e)=>observed(e,'find',r=>r.target===LAB && r.output.split('\n').includes(LAB+'/logs/ticket-42.txt'))},
  {id:'cp',title:'Zachowaj kopię',group:'Pliki i logi',
    purpose:'cp kopiuje plik i pozostawia jego oryginał w miejscu.',
    syntax:'cp ŹRÓDŁO CEL',example:'cp ~/notes.txt ~/documents/notes-copy.txt',
    assignment:'Zrób kopię ~/practice/source.txt pod nazwą backup.txt w tym samym katalogu.',
    hint:'Wskaż dwie ścieżki: source.txt oraz backup.txt.',
    pass:s=>s.files[LAB+'/source.txt']==='COPY_ME' && s.files[LAB+'/backup.txt']==='COPY_ME'},
  {id:'mv',title:'Przenieś lub zmień nazwę',group:'Pliki i logi',
    purpose:'mv przenosi plik. Przy zmianie nazwy oryginalna ścieżka przestaje istnieć.',
    syntax:'mv ŹRÓDŁO CEL',example:'mv ~/notes.txt ~/documents/notes.txt',
    assignment:'Zmień nazwę ~/practice/move-me.txt na renamed.txt.',
    hint:'mv przyjmuje starą i nową nazwę pliku.',
    pass:s=>s.files[LAB+'/renamed.txt']==='MOVE_ME' && !Object.hasOwn(s.files,LAB+'/move-me.txt')},
  {id:'rm',title:'Usuń zbędny plik',group:'Pliki i logi',
    purpose:'rm usuwa plik. Symulator nie ma kosza ani przywracania usuniętych plików.',
    syntax:'rm PLIK',example:'rm ~/downloads/old.tmp',
    assignment:'Usuń wyłącznie ~/practice/delete-me.tmp.',
    hint:'rm wymaga ścieżki do pliku, nie katalogu.',
    pass:s=>!Object.hasOwn(s.files,LAB+'/delete-me.tmp') && s.files[LAB+'/source.txt']==='COPY_ME'},
  {id:'chmod',title:'Minimalne uprawnienia',group:'Administracja',
    purpose:'chmod reguluje prawa rwx: właściciel, grupa i pozostali.',
    syntax:'chmod TRYB PLIK',example:'chmod 600 ~/documents/credentials.txt',
    assignment:'Ustaw plik ~/practice/private.txt tak, by tylko właściciel miał odczyt i zapis.',
    hint:'Odpowiedni tryb numeryczny to 600.',
    pass:s=>s.permissions?.[LAB+'/private.txt']===0o600},
  {id:'ps',title:'Sprawdź procesy',group:'Administracja',
    purpose:'ps wyświetla procesy aktywne w wirtualnym systemie.',
    syntax:'ps [aux]',example:'ps',
    assignment:'Wyświetl listę procesów, na której widoczny jest queue-worker.',
    hint:'W symulatorze wystarczy ps lub ps aux.',
    pass:(_s,e)=>observed(e,'ps',r=>r.output.includes('queue-worker'))},
  {id:'systemctl',title:'Sprawdź usługę',group:'Administracja',
    purpose:'systemctl status odczytuje stan usługi, np. active, inactive lub failed.',
    syntax:'systemctl status USŁUGA',example:'systemctl status sshd',
    assignment:'Sprawdź status jednostki web.service. Znajdź informację o awarii.',
    hint:'Użyj systemctl status web.',
    pass:(_s,e)=>observed(e,'systemctl',r=>r.target==='web.service' && r.output.includes('failed'))},
  {id:'ip',title:'Sprawdź trasę',group:'Sieć',
    purpose:'ip route pokazuje trasę domyślną — bramę do innych podsieci.',
    syntax:'ip route show',example:'ip addr show',
    assignment:'Wyświetl domyślną trasę sieciową hosta.',
    hint:'Skorzystaj z ip route show.',
    pass:(_s,e)=>observed(e,'ip',r=>r.target==='route' && r.output.includes('default via'))}
];

export interface AcademyProgress {completed:string[];mastered:string[];selectedId:string}
export function restoreAcademyProgress(raw:unknown):AcademyProgress {
  if (!raw || typeof raw!=='object' || Array.isArray(raw)) return {completed:[],mastered:[],selectedId:commandLessons[0].id};
  const rec=raw as Partial<AcademyProgress>;
  const ids=new Set(commandLessons.map(x=>x.id));
  return {
    completed:[...new Set(Array.isArray(rec.completed)?rec.completed.filter((id):id is string=>typeof id==='string' && ids.has(id)):[])],
    mastered:[...new Set(Array.isArray(rec.mastered)?rec.mastered.filter((id):id is string=>
      typeof id==='string' && ids.has(id) && Array.isArray(rec.completed) && rec.completed.includes(id)):[])],
    selectedId:typeof rec.selectedId==='string' && ids.has(rec.selectedId)?rec.selectedId:commandLessons[0].id
  };
}
export function academySubmit(state:LinuxState, events:CommandResult[], raw:string,lessonId:string) {
  const lesson=commandLessons.find(x=>x.id===lessonId);
  if (!lesson) throw Error('Unknown academy lesson');
  const result=executeLinux(state,raw);
  const nextEvents=[...events,result].slice(-40);
  return {result, events:nextEvents,completed:lesson.pass(result.state,nextEvents)};
}
