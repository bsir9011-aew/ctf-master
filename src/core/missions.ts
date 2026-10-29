import type { CommandResult, LinuxState } from './linux';
import { modeOf } from './permissions.ts';

export interface Mission {
  id: string;
  title: string;
  category: string;
  briefing: string;
  hints: [string, string, string];
  success: (state: LinuxState, events: CommandResult[]) => boolean;
}

export const missions: Mission[] = [
  {
    id: 'orientation', title: 'Poznaj teren', category: 'Linux Explorer',
    briefing: 'Sprawdz, w jakim katalogu jestes, a potem wyswietl jego zawartosc. Obie operacje musza sie powiesc.',
    hints: ['W Linuksie kazda sesja ma biezacy katalog.', 'Szukasz dwoch polecen: jednego do sciezki, drugiego do listowania.', 'Wpisz pwd, a nastepnie ls.'],
    success: (_state, events) => events.some(e => e.ok && e.command === 'pwd') && events.some(e => e.ok && e.command === 'ls')
  },
  {
    id: 'workspace', title: 'Wlasny warsztat', category: 'Linux Explorer',
    briefing: 'Utworz katalog projekty w swoim katalogu domowym. Wejdz do niego i utworz pusty plik notes.txt.',
    hints: ['Potrzebujesz katalogu, zmiany lokalizacji i pliku.', 'Przypomnij sobie mkdir, cd oraz touch.', 'mkdir projekty, cd projekty, touch notes.txt.'],
    success: (state, events) => state.dirs.includes('/home/player/projekty') &&
      Object.hasOwn(state.files, '/home/player/projekty/notes.txt') &&
      events.some(e => e.ok && e.command === 'cd' && e.target === '/home/player/projekty')
  },
  {
    id: 'hidden-flag', title: 'Ukryta flaga', category: 'CTF Rookie',
    briefing: 'Administrator schowal flage w katalogu domowym. Znajdz ja i odczytaj jej zawartosc. Nie dostaniesz nazwy pliku.',
    hints: ['Nie wszystko widac w zwyklej liscie plikow.', 'Sprawdz opcje -a polecenia ls.', 'Uzyj ls -la, poszukaj ukrytego katalogu, a potem cat.'],
    success: (_state, events) => events.some(e => e.ok && e.command === 'cat' && e.target === '/home/player/.vault/flag.txt')
  },
  {
    id: 'log-hunt', title: 'Slad w logach', category: 'Linux Investigator',
    briefing: 'Na testowym serwerze odnotowano nieudane logowanie. Odszukaj w /var/log/auth.log wpis zawierajacy DENIED i odczytaj go.',
    hints: ['Zdarzenia uwierzytelniania sa zapisane w /var/log.', 'grep wyszukuje tekst w pliku. cat wyswietla cala zawartosc.', 'Sprobuj grep DENIED /var/log/auth.log.'],
    success: (_state, events) => events.some(e => e.ok && e.target === '/var/log/auth.log' && e.output.includes('DENIED'))
  },
  {
    id: 'evidence-search', title: 'Znajdz dowod', category: 'Linux Investigator',
    briefing: 'W katalogu documents schowano plik evidence-47.txt. Odszukaj jego sciezke i odczytaj tresc.',
    hints: ['W podkatalogach documents jest wiecej zawartosci niz na pierwszym poziomie.', 'find pozwala przeszukiwac katalogi rekurencyjnie.', 'find ~/documents -name "evidence-*.txt", a potem cat SCIEZKA.'],
    success: (_state, events) => events.some(e => e.ok && e.command === 'cat' && e.target === '/home/player/documents/cases/evidence-47.txt')
  },
  {
    id: 'backup-evidence', title: 'Zachowaj kopie', category: 'Linux Investigator',
    briefing: 'Wykonaj kopie /var/log/auth.log do ~/documents/auth-backup.log. Oryginal ma pozostac bez zmian.',
    hints: ['Musisz zachowac zawartosc dwoch plikow.', 'cp kopiuje plik bez usuwania zrodla.', 'cp /var/log/auth.log ~/documents/auth-backup.log'],
    success: (state) => Object.hasOwn(state.files, '/home/player/documents/auth-backup.log') &&
      Object.hasOwn(state.files, '/var/log/auth.log') &&
      state.files['/home/player/documents/auth-backup.log'] === state.files['/var/log/auth.log']
  },
  {
    id: 'safe-cleanup', title: 'Porzadek po incydencie', category: 'Linux Investigator',
    briefing: 'Przenies ~/downloads/incident.tmp do ~/documents/incident.txt i usun niepotrzebny ~/downloads/stale.tmp. Nie kasuj zachowanego dowodu.',
    hints: ['Przeniesienie pliku zmienia jego lokalizacje.', 'mv przenosi, rm usuwa pojedynczy plik.', 'mv ~/downloads/incident.tmp ~/documents/incident.txt, a potem rm ~/downloads/stale.tmp.'],
    success: (state) => state.files['/home/player/documents/incident.txt'] === 'incident-47: save this evidence before cleanup' &&
      !Object.hasOwn(state.files, '/home/player/downloads/incident.tmp') &&
      !Object.hasOwn(state.files, '/home/player/downloads/stale.tmp')
  },
  {
    id: 'transfer-investigation', title: 'Nowy incydent', category: 'CTF Rookie',
    briefing: 'Nowe zgłoszenie: w /var/log/app.log znajduje się podejrzane zdarzenie ALERT. Zidentyfikuj wpis i zachowaj niezmienioną kopię całego dziennika w ~/documents/app-evidence.log. Dobierz polecenia samodzielnie.',
    hints: [
      'Rozdziel problem na dwa cele: odnalezienie zdarzenia i zachowanie danych.',
      'Jedno narzędzie wyszukuje tekst, inne kopiuje plik bez usuwania źródła.',
      'Sprawdź grep ALERT /var/log/app.log i cp /var/log/app.log ~/documents/app-evidence.log.'
    ],
    success: (state, events) =>
      events.some(e => e.ok && e.target === '/var/log/app.log' &&
        (e.command === 'grep' || e.command === 'cat') && e.output.includes('ALERT')) &&
      Object.hasOwn(state.files, '/var/log/app.log') &&
      Object.hasOwn(state.files, '/home/player/documents/app-evidence.log') &&
      state.files['/home/player/documents/app-evidence.log'] === state.files['/var/log/app.log']
  },
  {
    id: 'file-hardening', title: 'Sekret na widoku', category: 'Linux Administrator',
    briefing: 'Plik ~/documents/credentials.txt zawiera testowy sekret i ma zbyt szerokie uprawnienia. Ustaw go tak, aby tylko wlasciciel mogl czytac i modyfikowac plik (bez prawa wykonania).',
    hints: ['Uprawnienia sa podzielone na wlasciciela, grupe i pozostalych.', 'W stat sprawdzisz biezace uprawnienia; chmod je zmienia.', 'Wymagany tryb to 600, np. chmod 600 ~/documents/credentials.txt.'],
    success: (state) => Object.hasOwn(state.files, '/home/player/documents/credentials.txt') &&
      modeOf(state, '/home/player/documents/credentials.txt') === 0o600
  },
  {
    id: 'permission-recovery', title: 'Permission denied', category: 'Linux Administrator',
    briefing: 'Nie mozesz odczytac ~/documents/restricted.log. Ustal przyczyne, przywroc prawo odczytu wlascicielowi i odczytaj wpis RECOVERY. Nie otwieraj dostepu calej reszcie uzytkownikow.',
    hints: ['Komunikat Permission denied moze wskazywac na uprawnienia pliku.', 'Sprawdz stat, a potem wykorzystaj chmod, aby zmienic tylko prawa wlasciciela.', 'chmod u+r ~/documents/restricted.log, a nastepnie cat ~/documents/restricted.log.'],
    success: (state, events) => (modeOf(state, '/home/player/documents/restricted.log') & 0o477) === 0o400 &&
      events.some(e => e.ok && e.command === 'cat' && e.target === '/home/player/documents/restricted.log' &&
        e.output.includes('RECOVERY'))
  },
  {
    id: 'runaway-process', title: 'Nieznany proces', category: 'Linux Administrator',
    briefing: 'Na symulowanym serwerze obciazenie generuje proces cpu-burn. Zidentyfikuj go na liscie dzialajacych procesow, a nastepnie zakoncz. Nie zatrzymuj innych procesow.',
    hints: [
      'PID identyfikuje konkretna instancje procesu.',
      'ps wyswietla aktywne procesy. kill wysyla sygnal do wskazanego PID.',
      'Uzyj ps, ustal PID cpu-burn i wykonaj kill 424.'
    ],
    success: (state,events) =>
      state.processes?.some(p=>p.pid===424 && p.name==='cpu-burn' && !p.running) === true &&
      events.some(e=>e.ok && e.command==='ps' && e.output.includes('cpu-burn')) &&
      events.some(e=>e.ok && e.command==='kill' && e.target==='pid:424')
  },
  {
    id: 'web-service-recovery', title: 'Awaria aplikacji', category: 'Linux Administrator',
    briefing: 'Klienci zglaszaja niedostepnosc strony. Zdiagnozuj stan uslugi web i przyczyne w jej dzienniku, a nastepnie przywroc dzialanie. Nie wylaczaj pozostalych uslug.',
    hints: [
      'Awaria strony nie musi oznaczac awarii calego komputera.',
      'Sprawdz stan jednostki przez systemctl status i wpisy przez journalctl -u.',
      'Sprawdz systemctl status web, journalctl -u web, a nastepnie systemctl restart web.'
    ],
    success: (state,events) =>
      state.services?.web?.status === 'active' &&
      state.processes?.some(p=>p.pid===331 && p.service==='web' && p.running) === true &&
      state.services?.sshd?.status === 'active' &&
      state.services?.queue?.status === 'active' &&
      events.some(e=>e.ok && e.command==='systemctl' && e.target==='web.service' && e.output.includes('failed')) &&
      events.some(e=>e.ok && e.command==='journalctl' && e.target==='web.service' && e.output.includes('crash')) &&
      events.some(e=>e.ok && e.command==='systemctl' && e.target==='web.service' && e.output.includes('active'))
  }
];
