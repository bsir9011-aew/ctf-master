import { executeLinux, initialLinux, type CommandResult, type LinuxState } from './linux.ts';
import { investigationFiles, investigationStatus } from './investigation.ts';
import { usedManualBefore } from './manual.ts';
import { recoveryFixture, recoveryCompleted } from './pathRecovery.ts';
import { umaskExerciseCompleted } from './umask.ts';
import {shareCase,shareCompleted} from './chgrp.ts';
import {redirectionCompleted} from './redirection.ts';

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
    dirs:[...initial.dirs,LAB,LAB+'/logs',recoveryFixture('intro').directory],
    files:{
      ...initial.files,
      [LAB+'/intro.txt']:'Practice is how commands become useful.',
      [LAB+'/events.log']:'INFO boot ready\nWARN backup delayed\nINFO sync complete',
      [LAB+'/manual.log']:'INFO backup requested\nERROR backup permission denied\nINFO job skipped\n',
      [LAB+'/timeline.log']:'INFO boot\nWARN latency\nINFO cache\nERROR timeout\nINFO retry\nWARN queue\nINFO stable\n',
      [LAB+'/names.txt']:'zoe\nanna\nmarta\n',
      [LAB+'/levels.txt']:'INFO\nINFO\nWARN\nWARN\nINFO\n',
      [LAB+'/alerts.log']:'WARN storage\nINFO ready\nWARN auth\nWARN storage\nINFO heartbeat\nWARN auth\n',
      ...investigationFiles('intro'),
      [LAB+'/logs/ticket-42.txt']:'Training ticket 42',
      [LAB+'/source.txt']:'COPY_ME',
      [LAB+'/move-me.txt']:'MOVE_ME',
      [LAB+'/delete-me.tmp']:'DELETE_ME',
      [LAB+'/private.txt']:'SIMULATED_PRACTICE_DATA',
      [LAB+'/operator.log']:'OPERATOR: shared evidence readable by group',
      [LAB+'/audit-only.log']:'AUDIT: other group access denied',
      [shareCase('intro').path]:shareCase('intro').content,
      [recoveryFixture('intro').file]:recoveryFixture('intro').content
    },
    permissions:{...initial.permissions,[LAB+'/private.txt']:0o644,
      [LAB+'/operator.log']:0o640,[LAB+'/audit-only.log']:0o640,
      [shareCase('intro').path]:0o640,
      [recoveryFixture('intro').directory]:0o600},
    ownership:{...initial.ownership,
      [LAB+'/operator.log']:{uid:2000,gid:1100},
      [LAB+'/audit-only.log']:{uid:2000,gid:1200},
      [shareCase('intro').path]:{uid:1000,gid:1000}}
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
  {id:'id',title:'Kim jestem i do jakich grup należę?',group:'Podstawy',
    purpose:'id pokazuje numery UID (użytkownika), GID (grupy podstawowej) i członkostwo w grupach. groups wypisuje nazwy grup.',
    syntax:'id [OPCJA]  (lub osobno: groups)',
    example:'id -u',
    assignment:'Sprawdź pełną tożsamość bieżącego użytkownika poleceniem id, a następnie wyświetl NUMERY wszystkich jego grup za pomocą id. Zwróć uwagę na grupę podstawową i dodatkową.',
    hint:'Pełne id pokazuje UID, GID i grupy. W man id znajdziesz opcję wypisania samych numerów grup.',
    pass:(_s,e)=>{
      const full=e.findIndex(r=>r.ok&&r.command==='id'&&r.target==='identity');
      return full>=0&&e.slice(full+1).some(r=>r.ok&&r.command==='id'&&
        r.target==='group-ids'&&r.output==='1000 1100');
    }},
  {id:'man',title:'Dokumentacja komend',group:'Podstawy',
    purpose:'man to podrecznik dostepnych polecen. Pomaga samodzielnie odkrywac opcje zamiast zgadywac skladnie.',
    syntax:'man POLECENIE | man -k HASLO',
    example:'man ls',
    assignment:'Nie pamietasz, jaka opcja grep ignoruje wielkosc liter. Najpierw przeczytaj man grep, potem odszukaj wpis ERROR w ~/practice/manual.log, uzywajac wyszukiwania bez rozrozniania wielkosci liter.',
    hint:'W man grep zajrzyj do sekcji OPCJE. Sam odczyt dokumentacji nie konczy zadania - zastosuj poznana opcje w terminalu.',
    pass:(_s,e)=>usedManualBefore(e,'grep','grep',r=>
      r.target===LAB+'/manual.log' && r.grepCaseInsensitive===true &&
      r.output==='ERROR backup permission denied')},
  {id:'grep',title:'Szukaj wpisu w logu',group:'Pliki i logi',
    purpose:'grep wyszukuje pasujące wiersze. Tutaj wzorzec jest dosłownym tekstem.',
    syntax:'grep [-i] TEKST PLIK',example:'grep INFO /var/log/auth.log',
    assignment:'Znajdź w ~/practice/events.log wiersz zawierający WARN.',
    hint:'Wyszukaj WARN w pliku events.log.',
    pass:(_s,e)=>observed(e,'grep',r=>r.target===LAB+'/events.log' && r.output.includes('WARN backup delayed'))},
  {id:'head',title:'Początek pliku',group:'Pliki i logi',
    purpose:'head pokazuje pierwsze wiersze pliku, bez jego modyfikowania.',
    syntax:'head [-n LICZBA] PLIK',example:'head -n 2 ~/practice/events.log',
    assignment:'Pokaż pierwsze 3 wiersze pliku ~/practice/timeline.log.',
    hint:'Opcja -n wybiera, ile pierwszych wierszy pokazać.',
    pass:(_s,e)=>observed(e,'head',r=>r.target===LAB+'/timeline.log' &&
      r.output==='INFO boot\nWARN latency\nINFO cache')},
  {id:'tail',title:'Koniec logu',group:'Pliki i logi',
    purpose:'tail pokazuje końcowe wiersze pliku. Przydaje się do ostatnich zdarzeń.',
    syntax:'tail [-n LICZBA] PLIK',example:'tail -n 2 ~/practice/events.log',
    assignment:'Pokaż ostatnie 2 wiersze ~/practice/timeline.log.',
    hint:'Wskaż liczbę wierszy opcją -n.',
    pass:(_s,e)=>observed(e,'tail',r=>r.target===LAB+'/timeline.log' &&
      r.output==='WARN queue\nINFO stable')},
  {id:'wc',title:'Ile wierszy?',group:'Pliki i logi',
    purpose:'wc -l liczy znaki nowej linii; -w liczy słowa, a -c bajty.',
    syntax:'wc [-l|-w|-c] PLIK',example:'wc -w ~/practice/intro.txt',
    assignment:'Policz wiersze dziennika ~/practice/timeline.log za pomocą wc -l.',
    hint:'Opcja -l zwraca liczbę znaków końca wiersza.',
    pass:(_s,e)=>observed(e,'wc',r=>r.target===LAB+'/timeline.log' && r.output==='7')},
  {id:'sort',title:'Uporządkuj nazwy',group:'Pliki i logi',
    purpose:'sort wypisuje wiersze w porządku leksykograficznym; nie zmienia pliku.',
    syntax:'sort PLIK',example:'sort ~/practice/events.log',
    assignment:'Wyświetl nazwy z ~/practice/names.txt w porządku rosnącym.',
    hint:'sort potrzebuje tylko nazwy istniejącego pliku.',
    pass:(_s,e)=>observed(e,'sort',r=>r.target===LAB+'/names.txt' &&
      r.output==='anna\nmarta\nzoe')},
  {id:'uniq',title:'Usuń sąsiednie powtórzenia',group:'Pliki i logi',
    purpose:'uniq wypisuje tylko jedną kopię kolejnych identycznych wierszy. Nie usuwa powtórek rozdzielonych innymi wpisami.',
    syntax:'uniq PLIK',example:'uniq ~/practice/events.log',
    assignment:'Wyświetl ~/practice/levels.txt bez bezpośrednio sąsiadujących duplikatów.',
    hint:'Zwróć uwagę, że ostatnie INFO nie sąsiaduje z pierwszymi dwoma.',
    pass:(_s,e)=>observed(e,'uniq',r=>r.target===LAB+'/levels.txt' &&
      r.output==='INFO\nWARN\nINFO')},
  {id:'pipeline',title:'Połącz komendy potokiem',group:'Pliki i logi',
    purpose:'Potok | przekazuje wynik jednej komendy do następnej. grep filtruje, sort porządkuje, uniq redukuje sąsiednie duplikaty, a wc -l liczy wiersze.',
    syntax:'grep WZORZEC PLIK | sort | uniq | wc -l',
    example:'grep INFO ~/practice/timeline.log | sort | uniq | wc -l',
    assignment:'Policz liczbę różnych ostrzeżeń WARN w ~/practice/alerts.log. Użyj grep, sort, uniq oraz wc -l w jednym potoku.',
    hint:'Najpierw wybierz wiersze WARN, potem je uporządkuj, usuń sąsiadujące duplikaty i policz wiersze.',
    pass:(_s,e)=>observed(e,'pipeline',r=>r.target===LAB+'/alerts.log' &&
      r.stages?.join('>')==='grep>sort>uniq>wc' &&
      r.filterPattern==='WARN' && r.output==='2')},
  {id:'redirect',title:'Zapisz wynik analizy do pliku',group:'Pliki i logi',
    purpose:'Operator > zapisuje wynik polecenia, zastępując poprzednią treść. Operator >> dopisuje wynik na końcu pliku. Działa to tylko w wirtualnym systemie plików.',
    syntax:'POLECENIE > PLIK  lub  POLECENIE >> PLIK',
    example:'grep WARN ~/practice/alerts.log > ~/practice/alerts-summary.log',
    assignment:'Przygotuj ~/practice/alerts-summary.log z ~/practice/alerts.log. Najpierw zapisz wszystkie wpisy WARN przez >, a potem dopisz wpisy INFO przez >>. Zachowaj log źródłowy i na końcu odczytaj gotowy raport poleceniem cat.',
    hint:'Wynik grep możesz skierować do pliku przez >. Drugi wynik skieruj do TEGO SAMEGO pliku przez >>, aby go nie nadpisać. Ostatecznie użyj cat na raporcie.',
    pass:(state,events)=>redirectionCompleted('intro',state,events)},
  {id:'investigation',title:'Śledztwo: nieznany incydent',group:'Pliki i logi',
    purpose:'Otrzymujesz objaw incydentu i sam wybierasz strategię diagnostyki. Najpierw potwierdź ślad, potem zabezpiecz oryginalny dziennik.',
    syntax:'Dobierz narzędzia na podstawie obserwacji',
    example:'Brak gotowej sekwencji — rozpocznij od rozpoznania',
    assignment:'Po wdrożeniu pojawiły się błędy HTTP 502 około 02:14. Zbadaj pliki w ~/practice/logs, odczytaj wpis potwierdzający incydent, a dopiero potem zachowaj pełny właściwy log jako ~/practice/evidence.log. Nie zmieniaj żadnego źródłowego dziennika.',
    hint:'Zacznij od ustalenia, jakie pliki są w katalogu logs. Wybierz zdarzenie pasujące do objawu HTTP 502, potwierdź je w źródle i wykonaj kopię całego pliku.',
    pass:(s,e)=>investigationStatus('intro',s,e).completed},
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
  {id:'file-access',title:'Dlaczego jeden plik otwiera się, a drugi nie?',group:'Administracja',
    purpose:'Prawo dostępu zależy od uprawnień rwx, właściciela pliku oraz członkostwa w grupie. Odczyt r dla grupy nie oznacza odczytu dla wszystkich.',
    syntax:'id -G ; ls -l PLIK ; cat PLIK',
    example:'id -G',
    assignment:'Dwa logi ~/practice/operator.log i ~/practice/audit-only.log mają identyczny tryb 640, ale różne grupy. Sprawdź swoje grupy, obejrzyj metadane i odczytaj dostępny log operator.log. Wyjaśnij sobie, dlaczego drugi powinien odmówić dostępu.',
    hint:'id -G pokazuje grupy, ls -l albo stat pokazuje właściciela i grupę pliku. Porównaj je, zanim odczytasz log.',
    pass:(_s,e)=>{
      const groups=e.findIndex(r=>r.ok&&r.command==='id'&&r.target==='group-ids'&&r.output==='1000 1100');
      const inspected=e.findIndex((r,i)=>i>groups&&r.ok&&
        (r.command==='stat'||r.command==='ls')&&r.target===LAB+'/operator.log'&&
        r.output.includes('operators'));
      return groups>=0&&inspected>groups&&e.slice(inspected+1).some(r=>r.ok&&
        r.command==='cat'&&r.target===LAB+'/operator.log'&&
        r.output==='OPERATOR: shared evidence readable by group');
    }},
  {id:'namei',title:'Dlaczego plik jest niedostępny?',group:'Administracja',
    purpose:'namei -l pokazuje uprawnienia kolejnych elementów ścieżki. Samo r dla pliku nie wystarczy: katalogi po drodze potrzebują prawa x.',
    syntax:'namei -l SCIEZKA',
    example:'namei -l ~/documents/credentials.txt',
    assignment:'Log ~/practice/diagnostics/service.log istnieje, ale cat zwraca Permission denied. Zdiagnozuj całą ścieżkę przez namei -l, przywróć tylko brakujące prawo przejścia właścicielowi blokującego katalogu i odczytaj log. Nie otwieraj dostępu grupie ani pozostałym.',
    hint:'Najpierw sprawdź namei -l na ścieżce pliku. Na katalogu x oznacza możliwość przejścia; r na pliku pozwala czytać treść.',
    pass:(state,events)=>recoveryCompleted('intro',state,events)},
  {id:'umask',title:'Domyślne uprawnienia nowych plików',group:'Administracja',
    purpose:'umask odbiera wybrane bity z praw początkowych (666 dla plików, 777 dla katalogów). Nie modyfikuje istniejących plików.',
    syntax:'umask [NNN]',
    example:'umask',
    assignment:'Tworzysz prywatne dane. Ustaw umask 077, a potem utwórz pusty plik ~/practice/private-created.txt i katalog ~/practice/private-created. Sprawdź ich tryby przez stat. Plik ma mieć 600, katalog 700 - bez późniejszego chmod.',
    hint:'Nowy plik startuje z 666, katalog z 777. Maska 077 odbiera prawa grupie i pozostałym. Zmień maskę PRZED tworzeniem obiektów.',
    pass:(state,events)=>umaskExerciseCompleted(state,events,0o077,
      LAB+'/private-created.txt',LAB+'/private-created')},
  {id:'chgrp',title:'Udostępnij plik właściwej grupie',group:'Administracja',
    purpose:'chgrp zmienia grupę właścicielską pliku. Razem z chmod pozwala udzielić dostępu konkretnemu zespołowi bez otwierania go wszystkim.',
    syntax:'chgrp GRUPA PLIK',
    example:'chgrp operators ~/practice/shared-report.log',
    assignment:'Plik ~/practice/shared-report.log ma prawa 640 i należy do grupy player. Przydziel go grupie operators, do której należysz, zachowując obecne prawa i treść. Następnie sprawdź nową grupę przez stat lub ls -l.',
    hint:'Przed zmianą sprawdź id albo groups. W man chgrp znajdziesz składnię. Po zmianie zweryfikuj właściciela, grupę i tryb przez stat.',
    pass:(state,events)=>shareCompleted('intro',state,events)},
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
