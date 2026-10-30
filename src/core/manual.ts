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
