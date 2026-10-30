import type { CommandResult, LinuxState } from './linux.ts';

/** Concise, offline reference for the *implemented simulator subset*.
 * This is not the OS man command or a full GNU/Linux manual.
 */
interface ManualPage {
  synopsis:string;
  description:string;
  options?:string;
  search:string;
}

const PAGES:Readonly<Record<string,ManualPage>>={
  pwd:{synopsis:'pwd',description:'Wypisuje sciezke biezacego katalogu.',search:'katalog sciezka nawigacja'},
  id:{synopsis:'id [-u|-un|-g|-gn|-G|-Gn]',description:'Wyswietla UID, podstawowe GID oraz grupy uzytkownika. UID oznacza osobe, GID grupe.',options:'-u  Tylko UID. -un  Nazwa uzytkownika.\n-g  GID grupy podstawowej. -gn  Jej nazwa.\n-G  Wszystkie identyfikatory grup. -Gn  Nazwy wszystkich grup.',search:'identyfikator uid gid uzytkownik grupy'},
  groups:{synopsis:'groups',description:'Wypisuje nazwy grup biezacego uzytkownika, zaczynajac od grupy podstawowej.',search:'grupy czlonkostwo uzytkownik gid'},

  ls:{synopsis:'ls [-a] [-l] [KATALOG]',description:'Wypisuje elementy katalogu; nie zmienia biezacego katalogu.',options:'-a  Pokaz takze ukryte nazwy.\n-l  Pokaz uprawnienia i szczegoly.',search:'pliki katalog lista ukryte'},
  cd:{synopsis:'cd [KATALOG]',description:'Zmienia biezacy katalog. Bez argumentu przechodzi do katalogu domowego.',search:'katalog nawigacja sciezka'},
  cat:{synopsis:'cat PLIK',description:'Wyswietla pelna zawartosc tekstowego pliku. Wymaga prawa odczytu.',search:'plik tekst odczyt log'},
  mkdir:{synopsis:'mkdir KATALOG',description:'Tworzy nowy katalog, jesli jego katalog nadrzedny istnieje.',search:'katalog tworzenie'},
  touch:{synopsis:'touch PLIK',description:'W symulatorze tworzy pusty plik, jesli nie istnieje.',search:'plik tworzenie'},
  cp:{synopsis:'cp PLIK CEL',description:'Kopiuje pojedynczy plik. Zachowuje oryginal w miejscu.',search:'kopia backup plik'},
  mv:{synopsis:'mv PLIK CEL',description:'Przenosi plik lub zmienia jego nazwe.',search:'przeniesienie nazwa plik'},
  rm:{synopsis:'rm PLIK',description:'Usuwa pojedynczy plik. W symulatorze brak usuwania katalogow.',search:'usuwanie plik'},
  grep:{synopsis:'grep [-i] TEKST PLIK',description:'Wypisuje wiersze zawierajace doslowny tekst wzorca. Domyslnie rozroznia wielkie i male litery.',options:'-i  Ignoruj wielkosc liter przy dopasowaniu.',search:'szukanie tekst log filtr dopasowanie wielkosc liter'},
  find:{synopsis:'find [KATALOG] [-name WZORZEC]',description:'Rekurencyjnie wyszukuje sciezki po nazwie, a nie po zawartosci pliku.',options:'-name WZORZEC  Dopasuj nazwe (w symulatorze: * i ?).',search:'szukanie katalog nazwa plik'},
  head:{synopsis:'head [-n LICZBA] PLIK',description:'Wypisuje pierwsze wiersze pliku. Bez -n wypisuje do 10 wierszy.',options:'-n LICZBA  Ustaw liczbe pierwszych wierszy (1-100 w symulatorze).',search:'poczatek log tekst wiersze'},
  tail:{synopsis:'tail [-n LICZBA] PLIK',description:'Wypisuje ostatnie wiersze pliku. Bez -n wypisuje do 10 wierszy.',options:'-n LICZBA  Ustaw liczbe ostatnich wierszy (1-100 w symulatorze).',search:'koniec log tekst wiersze'},
  wc:{synopsis:'wc [-l|-w|-c] PLIK',description:'Liczy znaki nowej linii, slowa lub bajty pliku. Bez opcji wypisuje wszystkie trzy liczby.',options:'-l  Licz znaki nowej linii.\n-w  Licz slowa.\n-c  Licz bajty UTF-8.',search:'liczenie wiersze slowa bajty log'},
  sort:{synopsis:'sort PLIK',description:'Wyswietla wiersze w kolejnosci leksykograficznej. Nie modyfikuje zrodlowego pliku.',search:'sortowanie porzadkowanie tekst'},
  uniq:{synopsis:'uniq PLIK',description:'Usuwa tylko BEZPOSREDNIO SASIADUJACE, identyczne wiersze w wyswietlanym wyniku.',search:'duplikaty wiersze log'},
  stat:{synopsis:'stat PLIK_LUB_KATALOG',description:'Wyswietla informacje o wskazanym obiekcie, w tym uprawnienia.',search:'uprawnienia metadane tryb'},
  namei:{synopsis:'namei -l SCIEZKA',description:'Pokazuje kolejne katalogi i plik na podanej sciezce, wlasciciela, grupe i bity rwx. Zatrzymuje sie, gdy brakuje prawa x do katalogu.',options:'-l  Pokaz uprawnienia i nazwy wlascicieli/grup. To ograniczony diagnostyczny tryb symulatora.',search:'sciezka katalog przejscie permission denied x diagnostyka'},
  umask:{synopsis:'umask [NNN]',description:'Pokazuje albo ustawia maske praw NOWYCH plikow i katalogow w symulowanej sesji. Nie zmienia starych obiektow.',options:'NNN: trzy cyfry osemkowe 000-777. Plik dostaje 666 & ~maska, katalog 777 & ~maska. Przyklad: 077 -> nowy plik 600 i nowy katalog 700.',search:'uprawnienia domyslne maska katalog plik rwx'},
  redirect:{synopsis:'POLECENIE > PLIK  lub  POLECENIE >> PLIK',description:'Bezpieczne przekierowanie stdout komend odczytujacych do wirtualnego pliku. > nadpisuje, >> dopisuje.',options:'Plik nowy dostaje uprawnienia z umask; istniejacy wymaga prawa w. Zadnych przekierowan stdin, stderr, 2>, separatorow ani wykonywania komend hosta.',search:'przekierowanie zapis nadpisywanie dopisywanie stdout potok'},
  quoting:{synopsis:'KOMENDA "PLIK ZE SPACJA"  lub  KOMENDA PLIK\\ ZE\\ SPACJA',description:'Cudzyslow pojedynczy lub podwojny laczy spacje w jednym argumencie. Backslash poza cudzyslowami chroni nastepny znak. Fragmenty cytowane i niecytowane mozna laczyc.',options:'Przyklady: cat "~/practice/report draft.txt"; cat ~/practice/report\\ draft.txt. W apostrofach backslash jest zwyklym znakiem. Brak podstawienia zmiennych, polecen, globow i pelnej powloki.',search:'cytowanie quoting spacje apostrof cudzyslow backslash escape parser terminal'},
  conditionals:{synopsis:'KOMENDA && KOMENDA  lub  KOMENDA || KOMENDA',description:'&& uruchamia następną komendę tylko po statusie 0. || uruchamia następną tylko po niezerowym statusie. Operatory są lewostronnie łączone i mają ten sam priorytet, jak w Bash.',options:'Maksymalnie pięć poleceń w jednym łańcuchu. Można łączyć z ograniczonymi potokami i przekierowaniami. Pominięta komenda nie zmienia plików ani statusu. Status całego łańcucha to kod ostatnio uruchomionej komendy. Nieobsługiwane: ;, pojedyncze &, nawiasy grupujące, skrypty i uruchamianie hosta.',search:'operator warunkowy short circuit logiczne AND OR && || status wyjścia'},
  curl:{synopsis:'curl -i http://api.ctf.test/health',description:'Wyswietla wylacznie symulowana odpowiedz HTTP endpointu API w misji reakcji na incydent. Nie wysyla zadnych prawdziwych zapytan.',options:'HTTP 503 oznacza brak dostepnosci uslugi, a HTTP 200 poprawne dzialanie. Curl bez -f moze zwrocic status powloki 0 nawet dla HTTP 503. Konfiguracja POOL_LIMIT musi byc nie tylko zapisana w pliku, ale tez zastosowana przez restart api.service.',search:'http healthcheck api 200 503 restart konfiguracja curl'},
  hypothesis:{synopsis:'hypothesis <auth-attack|disk-pressure|pool-exhaustion> <low|medium|high>',description:'Zapisz swoją ocenę najbardziej prawdopodobnego wyjaśnienia na podstawie wcześniej sprawdzonych śladów. Pewność nie jest dowodem; bez pełnej telemetrii pozostaje niepewność.',options:'Każda poprawnie podana hipoteza zostaje zapisana jako zdarzenie w wirtualnej sesji. W śledztwie samo zgadnięcie kodu bez badania logów niczego nie zalicza. Po ocenie zabezpiecz dowody.',search:'hipotezy ocena pewność analiza śledztwo SOC przyczyna zdarzeń'},
  test:{synopsis:'test [-e|-f|-d|-r|-w|-x] SCIEZKA lub [ -f SCIEZKA ]',description:'Sprawdza warunek pliku bez wyswietlania wyniku: 0 przy prawdzie, 1 przy falszu, 2 dla blednej skladni.',options:'-e istnieje; -f zwykly plik; -d katalog; -r prawo odczytu; -w prawo zapisu; -x prawo wykonania/przejscia do katalogu. Kazdy test uwzglednia x katalogow nadrzednych. Po kazdej probie uzyj echo $?, zanim uruchomisz kolejne polecenie.',search:'warunek predykat plik istnienie katalog prawa status rwx test [ ]'},
  'exit-status':{synopsis:'POLECENIE ; echo $?',description:'Po kazdym pelnym poleceniu symulator zapisuje status. echo $? wypisuje kod poprzedniej komendy i samo konczy sie kodem 0.',options:'0 = powodzenie, 1 = brak dopasowan w grep lub inny blad wykonania, 2 = blad skladni / grep, 127 = nieznane polecenie. W tym treningu echo dziala jedynie jako echo $?, bez cytowania. Brak pelnego shella, skryptow, pipefail i innych ekspansji.',search:'status wyjscia kod bledu $? echo exit code success error'},
  chgrp:{synopsis:'chgrp GRUPA PLIK_LUB_KATALOG',description:'Zmienia grupe wlasnego pliku lub katalogu na taka, do ktorej uzytkownik nalezy. Nie zmienia uid, tresci ani trybu rwx.',options:'GRUPA: nazwa jednej z grup widocznych w groups lub id -Gn. Bez sudo, -R i bez zmiany wlasciciela.',search:'grupa wlasciciel grupowy uprawnienia access uid gid'},
  chmod:{synopsis:'chmod MODE PLIK_LUB_KATALOG',description:'Zmienia uprawnienia wlasnego pliku lub katalogu. Prawo x w katalogu pozwala wejsc do srodka.',options:'MODE: trzy cyfry osemkowe (np. 600) lub u/g/o/a +/- rwx.',search:'uprawnienia rwx bezpieczenstwo'},
  ps:{synopsis:'ps [aux]',description:'Pokazuje symulowane procesy wraz z ich PID.',search:'procesy pid'},
  kill:{synopsis:'kill PID',description:'Konczy wskazany wirtualny proces.',search:'proces pid zatrzymanie'},
  systemctl:{synopsis:'systemctl status|start|stop|restart UNIT',description:'Odczytuje i zmienia stan symulowanej uslugi.',search:'usluga daemon proces restart'},
  journalctl:{synopsis:'journalctl -u UNIT',description:'Wypisuje dziennik symulowanej uslugi systemowej.',search:'log dziennik usluga'},
  ip:{synopsis:'ip addr|route|link|neigh ...',description:'Pokazuje i w ograniczonym zakresie modyfikuje stan wirtualnej sieci.',search:'sieci adres route brama'},
  ping:{synopsis:'ping -c 1 IP',description:'Testuje wirtualna dostepnosc hosta przez ICMP.',search:'sieci polaczenie icmp'},
  ss:{synopsis:'ss -lnt',description:'Pokazuje symulowane nasluchujace gniazda TCP.',search:'port sieci tcp socket'},
  resolvectl:{synopsis:'resolvectl dns eth0 [IP]',description:'Pokazuje lub ustawia DNS dla symulowanego interfejsu.',search:'sieci dns resolver'},
  nslookup:{synopsis:'nslookup NAZWA',description:'Sprawdza rozpoznawanie nazwy w wirtualnym DNS.',search:'sieci dns domena'},
  nc:{synopsis:'nc -z HOST PORT',description:'Sprawdza wskazany wirtualny port TCP.',search:'sieci tcp port'},
  trace:{synopsis:'trace HOST PORT',description:'Pokazuje edukacyjny przeplyw pakietu przez warstwy symulacji.',search:'sieci tcp arp diagnostyka'}
};
export const manualTopics=Object.freeze(Object.keys(PAGES));

export function executeManual(state:LinuxState,args:readonly string[]):CommandResult {
  const result=(output:string,ok:boolean,target?:string):CommandResult=>({
    state,output,ok,command:'man',target
  });
  if(args[0]==='-k') {
    if(args.length!==2||!args[1].trim())
      return result('Uzycie: man -k HASLO',false);
    const term=args[1].toLowerCase();
    const matches=Object.entries(PAGES)
      .filter(([name,page])=>
        [name,page.search,page.description].join(' ').toLowerCase().includes(term))
      .map(([name,page])=>name+' - '+page.description);
    return matches.length
      ?result(matches.join('\n'),true,'search:'+term)
      :result('man: brak wpisow dla: '+args[1],false);
  }
  if(args.length!==1||!args[0]||args[0].startsWith('-'))
    return result('Uzycie: man POLECENIE | man -k HASLO',false);
  const name=args[0];
  if(!Object.hasOwn(PAGES,name))return result('man: No manual entry for '+name,false);
  const page=PAGES[name];
  return result(
    'NAZWA\n  '+name+' - '+page.description+
    '\n\nSKLADNIA\n  '+page.synopsis+
    (page.options?'\n\nOPCJE\n  '+page.options:'')+
    '\n\nUWAGA\n  Podrecznik opisuje tylko funkcje dostepne w CTF Master, nie pelnego Linuksa.',
    true,name
  );
}

/** Verifies that documentation was consulted before the relevant action. */
export function usedManualBefore(
  events:readonly CommandResult[],topic:string,
  action:string,predicate:(result:CommandResult)=>boolean
):boolean {
  const documented=events.findIndex(r=>r.ok&&r.command==='man'&&r.target===topic);
  return documented!==-1&&events.slice(documented+1)
    .some(r=>r.ok&&r.command===action&&predicate(r));
}
