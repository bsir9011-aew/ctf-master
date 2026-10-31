import type { CommandResult, LinuxState } from './linux';
import { modeOf } from './permissions.ts';
import {incidentCaseProgress} from './incidentCapstone.ts';
import {hypothesisProgress} from './hypothesisCase.ts';
import {responseProgress} from './responseCase.ts';
import {opsProgress} from './opsRecovery.ts';
import {blindProgress} from './blindInvestigation.ts';
import {independentProgress} from './independentInvestigation.ts';

export interface Mission {
  id: string;
  title: string;
  category: string;
  briefing: string;
  hints: readonly string[];
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
  },
  {
    id: 'gateway-repair', title: 'Zagubiona brama', category: 'Linux Networking',
    briefing: 'Interfejs eth0 ma dzialac w sieci 10.20.30.0/24, a router to 10.20.30.1. Host 198.51.100.10 powinien odpowiadac. Sprawdz adres i trase, popraw bledna brame i potwierdz lacznosc.',
    hints: [
      'Polaczenie z inna podsiecia wymaga bramy domyslnej.',
      'ip addr i ip route pokazuja konfiguracje; ping -c 1 testuje dostepnosc.',
      'Sprawdz ip route, nastepnie ustaw ip route replace default via 10.20.30.1 i przetestuj ping -c 1 198.51.100.10.'
    ],
    success: (state,events) =>
      state.network?.linkUp === true &&
      state.network?.gateway === state.network?.router &&
      events.some(e=>e.ok && e.command==='ip' && e.target==='eth0') &&
      events.some(e=>e.ok && e.command==='ip' && e.target==='route') &&
      events.some(e=>e.ok && e.command==='ping' && e.target===state.network?.externalHost)
  },
  {
    id: 'api-listener', title: 'Gdzie jest port API?', category: 'Linux Networking',
    briefing: 'Usluga api powinna nasluchiwac TCP na porcie 9000. Rozpoznaj brak gniazda nasluchujacego, przywroc usluge api i sprawdz, ze port 9000 stal sie widoczny. Nie zatrzymuj innych uslug.',
    hints: [
      'ICMP i port TCP to rozne mechanizmy; ping nie sprawdzi, czy aplikacja nasluchuje.',
      'ss -lnt pokazuje nasluchujace porty TCP, a systemctl zarzadza uslugami.',
      'Uzyj ss -lnt, sprawdz systemctl status api, potem systemctl restart api i ponownie ss -lnt.'
    ],
    success: (state,events) => {
      const views=events.filter(e=>e.ok && e.command==='ss' && e.target==='tcp-listeners');
      const before=views.findIndex(e=>!e.output.includes('0.0.0.0:9000'));
      const after=views.findIndex((e,i)=>i>before && e.output.includes('0.0.0.0:9000'));
      return state.services?.api?.status === 'active' &&
        state.processes?.some(p=>p.pid===366 && p.running && p.service==='api') === true &&
        state.services?.sshd?.status === 'active' &&
        state.services?.queue?.status === 'active' &&
        before>=0 && after>before &&
        events.some(e=>e.ok && e.command==='systemctl' && e.target==='api.service' &&
          e.output.includes('active'));
    }
  },
  {
    id:'dns-repair',title:'Adres IP dziala, nazwa nie',category:'Linux Networking',
    briefing:'System zna trase poza siec lokalna, ale domena lab.ctf.test nie odpowiada. Sprawdz resolver DNS, ustal przyczyne i przywroc rozpoznawanie domeny bez zmieniania adresu docelowego. Serwer DNS laboratorium to 198.51.100.53.',
    hints:[
      'DNS zamienia nazwe na IP. Brama domyslna i resolver DNS to dwie rozne konfiguracje.',
      'Sprawdz resolvectl dns eth0, potem nslookup lab.ctf.test.',
      'Po weryfikacji trasy ustaw resolvectl dns eth0 198.51.100.53 i ponow nslookup lab.ctf.test.'
    ],
    success:(state,events)=>
      state.network?.dnsServer==='198.51.100.53' &&
      state.network?.gateway===state.network?.router &&
      events.some(e=>e.ok && e.command==='resolvectl' && e.target==='dns') &&
      events.some(e=>e.ok && e.command==='nslookup' && e.target==='lab.ctf.test' &&
        e.output.includes('198.51.100.10'))
  },
  {
    id:'packet-layers',title:'Od DNS do polaczenia TCP',category:'Linux Networking',
    briefing:'Po naprawie nazwy sprawdz trase do lab.ctf.test na porcie TCP 443. Ustal, dlaczego ping nie wystarcza do oceny portu. Zobacz adres MAC nastepnego hopu (routera), pelna sciezke diagnostyczna i skuteczna probe TCP. Nie uzywaj prawdziwej sieci.',
    hints:[
      'ARP dotyczy adresu MAC nastepnego hopu w sieci lokalnej, a TCP portu aplikacji.',
      'ip neigh show ujawnia znane adresy MAC; nc -z sprawdza polaczenie TCP, trace pokazuje warstwy.',
      'W symulatorze sprawdz trace lab.ctf.test 443, nc -z lab.ctf.test 443, a potem ip neigh show.'
    ],
    success:(state,events)=>
      state.network?.dnsServer==='198.51.100.53' &&
      state.network?.arpCache?.[state.network.router]==='02:42:ac:14:1e:01' &&
      events.some(e=>e.ok && e.command==='trace' && e.target==='lab.ctf.test:443' &&
        e.output.includes('ARP:') && e.output.includes('SYN/ACK')) &&
      events.some(e=>e.ok && e.command==='nc' && e.target==='lab.ctf.test:443') &&
      events.some(e=>e.ok && e.command==='ip' && e.target==='arp-cache' &&
        e.output.includes(state.network?.router ?? '__missing__'))
  },
  {
    id:'incident-correlation',title:'INC-017: dwa ślady, jeden incydent',
    category:'Linux Investigator',
    briefing:'Po nocnym wdrożeniu SOC zauważył anomalię aplikacji oraz nieudaną próbę logowania. Zbadaj /var/log/app.log i /var/log/auth.log i potwierdź pasujące wpisy. Następnie zabezpiecz oba niezmienione logi w ~/documents jako case17-app-evidence.log i case17-auth-evidence.log - kopie wykonuj WYŁĄCZNIE po sprawdzeniu istnienia źródła w łańcuchu warunkowym. W case17-report.log zestaw kolejno linię ALERT z aplikacji i linię DENIED z uwierzytelniania, korzystając z nadpisania i dopisania. Odczytaj gotowy raport. Oryginały oraz ich uprawnienia muszą pozostać bez zmian.',
    hints:[
      'Analizuj dwa niezależne źródła: czy incydent aplikacyjny i próba logowania rzeczywiście wystąpiły? Najpierw potwierdź ślady w oryginalnych logach.',
      'Kopie dowodowe wykonaj dopiero po potwierdzeniu śladów. Połącz test -f z cp operatorem &&. Raport utwórz z wybranych wierszy: > nadpisuje, >> dopisuje.',
      'Potwierdź osobno grep ALERT /var/log/app.log i grep DENIED /var/log/auth.log. Potem test -f ZRÓDŁO && cp ZRÓDŁO CEL dla obu logów. Zapisz grep ALERT > ~/documents/case17-report.log, dopisz grep DENIED >> do tego samego raportu i przeczytaj cat.'
    ],
    success:(state,events)=>incidentCaseProgress(state,events).completed
  },
  {
    id:'incident-hypotheses',title:'INC-018: trzy możliwe przyczyny',category:'Linux Investigator',
    briefing:'Po wdrożeniu pojawiają się HTTP 502. Równolegle widać nietypowe próby logowania, a operator podejrzewa też problemy z dyskiem. W katalogu ~/documents/cases masz pięć logów case18-*.log (edge, auth, db, deploy, host). Zbadaj każdy i porównaj czas oraz znaczenie zdarzeń. Wybierz najbardziej prawdopodobne wyjaśnienie przez hypothesis ID PEWNOSC (man hypothesis). Następnie zachowaj dwa najważniejsze oryginały jako case18-db-evidence.log i case18-deploy-evidence.log, sporządź case18-analysis.log z wierszem zmiany konfiguracji i wpisem o błędzie bazy, korzystając z > oraz >>, i odczytaj raport. Nie zmieniaj logów źródłowych. To ocena na podstawie śladów, nie dowód absolutnej przyczynowości.',
    hints:[
      'Jednoczesne zdarzenia nie muszą mieć wspólnej przyczyny. Sprawdź pięć źródeł, porównaj znaczniki czasu i szukaj mechanizmu łączącego zmianę z objawem.',
      'W szczególności odróżnij próby logowania od rzeczywistego problemu backendu oraz odczytaj dane o kondycji hosta. Zajrzyj do man hypothesis, a po decyzji zabezpiecz dwa najbardziej rozstrzygające logi.',
      'Po zbadaniu wszystkich pięciu plików użyj hypothesis z ID najbardziej pasującej hipotezy i poziomem pewności. Skopiuj całe logi deploy i db, a raport zbuduj przez grep POOL_LIMIT_REDUCED ... > oraz grep POOL_EXHAUSTED ... >>, po czym cat.'
    ],
    success:(state,events)=>hypothesisProgress(state,events).completed
  },
  {
    id:'incident-response',title:'INC-019: napraw przyczynę, nie objaw',category:'Linux Investigator',
    briefing:'Kontynuacja INC-018. API odpowiada HTTP 503 po ograniczeniu puli połączeń. Administrator sugeruje restart API, ktoś chce zatrzymać SSH, a inny proponuje zwiększyć pulę bez sprawdzenia jej limitu. Masz dwa wirtualne pliki w ~/documents/cases: case19-api.conf (bieżąca konfiguracja) i case19-api.safe.conf (ostatnia stabilna). Najpierw sprawdź odpowiedź curl -i http://api.ctf.test/health, obejrzyj oba pliki, wybierz minimalne bezpieczne działanie i zastosuj konfigurację. Następnie ponownie sprawdź endpoint. Nie wyłączaj SSH ani kolejki; zachowaj plik kopii i uprawnienia. To symulacja, a nie rzeczywisty curl.',
    hints:[
      'Oddziel objaw (HTTP 503) od stanu konfiguracji na dysku oraz konfiguracji już załadowanej w pamięci działającej usługi. Sam restart może nie naprawić przyczyny.',
      'Sprawdź man curl, status usług oraz porównaj aktywny i stabilny plik POOL_LIMIT. Zastanów się, co musi się wydarzyć, żeby proces API zastosował konfigurację.',
      'Po sprawdzeniu obu plików przywróć stabilny wariant przez cp z case19-api.safe.conf do case19-api.conf. Następnie wykonaj systemctl restart api i ponownie curl -i http://api.ctf.test/health. Potwierdź też, że sshd i queue pozostały aktywne.'
    ],
    success:(state,events)=>responseProgress(state,events).completed
  },
  {
    id:'operational-recovery',title:'INC-020: napraw po błędnej interwencji',category:'Linux Investigator',
    briefing:'Po awaryjnym wdrożeniu kolejka przestała obsługiwać zadania. API, SSH i kolejka to osobne wirtualne usługi: nie zatrzymuj ich na chybił trafił. Zbadaj curl -i http://ops.ctf.test/health, stan kolejki przez systemctl i jej dziennik journalctl. Przywróć potrzebną usługę oraz sprawdź ponownie health endpoint. Na koniec potwierdź przez systemctl, że kolejka i dostęp SSH są aktywne. Złe interwencje mogą wydłużyć awarię, jednak możesz je naprawić; ich konsekwencje pozostaną widoczne w podsumowaniu. Środowisko jest wyłącznie symulowane.',
    hints:[
      'HTTP 503 nie dowodzi, że API jest przyczyną. W pierwszej kolejności porównaj status kolejkowania z jej logiem, zamiast restartować losowe procesy.',
      'Wykorzystaj man curl, systemctl status queue i journalctl -u queue. Przywrócenie pracy zależy od usług, które rzeczywiście nie działają. Jeśli przerwałeś SSH, najpierw napraw również tę konsekwencję.',
      'Wykonaj curl -i http://ops.ctf.test/health, systemctl status queue, journalctl -u queue. Napraw queue przez systemctl start queue; sprawdź ponownie curl. Następnie systemctl status queue i systemctl status sshd. Jeżeli zatrzymałeś sshd lub api, uruchom je ponownie przed weryfikacją.'
    ],
    success:(state,events)=>opsProgress(state,events).completed
  },
  {
    id:'blind-investigation',title:'INC-021: zgłoszenie bez instrukcji',category:'Linux Investigator',
    briefing:'Zgłoszenie INC-021: Po nocnej konserwacji zespół audytu nie może otworzyć materiału dowodowego. Przywróć dostęp w sposób minimalny, zabezpiecz zweryfikowaną kopię i nie naruszaj danych źródłowych. Masz tylko terminal i dostępne pliki zgłoszeń. Sam ustal punkt awarii i wybierz działania. Tryb samodzielny: bez podpowiedzi i listy wymaganych komend.',
    hints:[],
    success:(state,events)=>blindProgress(state,events).completed
  },
  {
    id:'independent-investigation',title:'INC-022: inny punkt awarii',category:'Linux Investigator',
    briefing:'INC-022. Po nocnej rotacji logów zespół audytu nie może odczytać eksportu. Rozwiąż ten przypadek od podstaw: zbierz dowody, wskaż rzeczywistą przyczynę, przywróć wyłącznie niezbędny dostęp, zabezpiecz kopię i potwierdź jej odczyt. Zgłoszenie i ślady znajdują się w wirtualnym środowisku. Tryb transferu - bez podpowiedzi, coachingu i gotowej listy poleceń.',
    hints:[],
    success:(state,events)=>independentProgress(state,events).completed
  }
];
