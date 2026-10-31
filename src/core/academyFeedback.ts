import { explainError } from './learning.ts';
import { modeOctal, modeString } from './permissions.ts';
import type { CommandResult, LinuxState } from './linux.ts';

export interface AcademyInsight {
  title: string;
  detail: string;
  status: 'complete' | 'partial' | 'error';
}

/**
 * Read-only feedback about what the virtual command actually did.
 * Never returns the required answer or an unseen target in transfer challenges.
 * It does not grant credit: the lesson's own state/event predicate remains authoritative.
 */
export function explainAcademyAttempt(
  lessonId: string,
  before: LinuxState,
  result: CommandResult,
  completed: boolean
): AcademyInsight {
  const cmd = result.command;
  const isFocusCommand = cmd === lessonId;

  if(cmd==='conditional'&&result.conditionalTrace){
    const skipped=result.conditionalTrace.filter(step=>!step.executed).length;
    const executed=result.conditionalTrace.filter(step=>step.executed).length;
    return {
      title:completed?'Warunki poprawnie zastosowane':'Przeanalizuj wykonane i pominięte kroki',
      detail:'W łańcuchu wykonano '+executed+' kroków, pominięto '+skipped+
        '. && wymaga sukcesu, || wymaga niepowodzenia. Wynik całego łańcucha to status ostatniej wykonanej komendy; fałszywy test nie zawsze oznacza błędną decyzję.',
      status:completed?'complete':'partial'
    };
  }
  if(cmd==='test'&&result.testFlag){
    const meaning:Record<string,string>={'-e':'istnienie obiektu','-f':'zwykły plik','-d':'katalog','-r':'prawo odczytu','-w':'prawo zapisu','-x':'prawo wykonania lub przejścia'};
    return {
      title:result.ok?'Warunek jest spełniony':'Warunek nie jest spełniony',
      detail:'Test '+result.testFlag+' sprawdza '+meaning[result.testFlag]+'. Polecenie niczego nie zmieniło. Status '+(result.exitCode??'?')+' sprawdź natychmiast przez echo $?. Fałszywy warunek może być oczekiwanym wynikiem diagnozy.',
      status:completed?'complete':'partial'
    };
  }
  if (!result.ok) {
    const output = result.output.toLowerCase();
    if (cmd === 'ls') {
      if (output.includes('no such file')) return {
        title: 'ls nie znalazł wskazanej ścieżki',
        detail: 'ls pokazuje zawartość istniejącego pliku lub katalogu. Sprawdź, gdzie jesteś (pwd), oraz czy ścieżka jest względna czy bezwzględna.',
        status: 'error'
      };
      if (output.includes('nieznana opcja')) return {
        title: 'ls nie rozpoznaje tej opcji',
        detail: 'Opcje zaczynają się od „-”. Ten symulator obsługuje w ls tylko -a (ukryte nazwy) oraz -l (szczegóły).',
        status: 'error'
      };
    }
    if (cmd === 'cd') {
      if (output.includes('not a directory')) return {
        title: 'cd wymaga katalogu, nie pliku',
        detail: 'Plik może istnieć, ale cd zmienia katalog roboczy. W razie potrzeby użyj ls, by odróżnić plik od katalogu.',
        status: 'error'
      };
      if (output.includes('no such directory')) return {
        title: 'cd nie znalazł wskazanego katalogu',
        detail: 'Sprawdź bieżącą ścieżkę przez pwd. „.” oznacza obecny katalog, „..” katalog nadrzędny, a „~/” katalog domowy.',
        status: 'error'
      };
    }
    if (cmd === 'grep') {
      if (output.includes('brak dopasowan')) return {
        title: 'grep nie znalazł pasującego wiersza',
        detail: 'grep porównuje treść wierszy, domyślnie rozróżniając wielkie i małe litery. Opcja -i pozwala pominąć wielkość liter; sprawdź też szukany tekst i właściwy plik.',
        status: 'error'
      };
      if (output.includes('plik nie istnieje')) return {
        title: 'grep nie może odczytać nieistniejącego pliku',
        detail: 'grep przeszukuje zawartość pliku, a nie nazwy plików. Sprawdź ścieżkę do dziennika; do szukania nazw służy find.',
        status: 'error'
      };
      if (output.includes('uzycie: grep')) return {
        title: 'grep potrzebuje wzorca i pliku',
        detail: 'Pierwszy argument jest szukanym tekstem, drugi wskazuje plik. Jeżeli wzorzec zawiera spacje, ujmij go w cudzysłów.',
        status: 'error'
      };
    }
    if (cmd === 'find') {
      if (output.includes('sciezka nie istnieje')) return {
        title:'find nie znalazł punktu początkowego',
        detail:'find rozpoczyna szukanie od wskazanej ścieżki. Sprawdź, czy ten katalog istnieje oraz czy ścieżka jest poprawna względem bieżącej lokalizacji.',
        status:'error'
      };
      if (output.includes('uzycie: find')) return {
        title:'find potrzebuje poprawnych argumentów',
        detail:'W tym symulatorze find przyjmuje opcjonalny katalog startowy i -name z wzorcem nazwy. Wzorce * i ? pasują do nazw, nie do treści pliku.',
        status:'error'
      };
      if (output.includes('wzorzec jest za dlugi')) return {
        title:'Wzorzec find jest za długi',
        detail:'Użyj krótszego fragmentu nazwy lub prostej maski z * albo ?.',
        status:'error'
      };
    }
    if (cmd === 'cp') {
      if (output.includes('zrodlo nie jest plikiem')) return {
        title:'cp nie znalazł pliku źródłowego',
        detail:'cp potrzebuje istniejącego pliku źródłowego. Sprawdź jego ścieżkę przez ls. Katalogi nie są kopiowane w tym symulatorze.',
        status:'error'
      };
      if (output.includes('katalog docelowy nie istnieje')) return {
        title:'cp nie znalazł katalogu docelowego',
        detail:'Przy kopiowaniu pod nową nazwą katalog nadrzędny celu musi już istnieć. cp tworzy plik, ale nie tworzy brakujących katalogów.',
        status:'error'
      };
      if (output.includes('permission denied')) return {
        title:'cp nie może odczytać źródła',
        detail:'Do skopiowania zawartości trzeba mieć prawo odczytu pliku źródłowego. Zweryfikuj uprawnienia przez ls -l lub stat; sam poprawny adres pliku nie wystarczy.',
        status:'error'
      };
      if (output.includes('identyczne')) return {
        title:'Źródło i cel cp są takie same',
        detail:'Kopia wymaga osobnej ścieżki lub nowej nazwy. W tej próbie plik nie został zmieniony.',
        status:'error'
      };
      if (output.includes('uzycie: cp')) return {
        title:'cp wymaga źródła i celu',
        detail:'Pierwszy argument wskazuje istniejący plik do skopiowania, drugi miejsce lub nową nazwę pliku.',
        status:'error'
      };
    }
    if (cmd === 'chmod') {
      if (output.includes('nieobslugiwany mode')) return {
        title:'chmod nie rozpoznaje trybu uprawnień',
        detail:'Tryb numeryczny opisuje kolejno właściciela, grupę i pozostałych. r=4, w=2, x=1; można też stosować np. u+r lub go-rwx.',
        status:'error'
      };
      if (output.includes('no such file')) return {
        title:'chmod nie znalazł pliku',
        detail:'Zmiana uprawnień wymaga istniejącego pliku. Sprawdź ścieżkę przez ls; ten symulator nie pozwala tu zmieniać praw katalogów.',
        status:'error'
      };
      if (output.includes('uzycie: chmod')) return {
        title:'chmod wymaga trybu i ścieżki',
        detail:'Podaj tryb uprawnień, a następnie plik. Sposób zapisu trybu może być numeryczny lub symboliczny.',
        status:'error'
      };
    }
    if(lessonId==='quoting'&&['mv','cat'].includes(cmd))return {
    title:completed?'Plik z nazwą zawierającą spacje odczytany':'Sprawdź liczbę argumentów i ścieżkę',
    detail:result.ok?'Ścieżka z odstępami musi trafić do komendy jako jeden argument. Po zmianie nazwy sprawdź treść przez cat.':'Spacja bez ochrony dzieli ścieżkę na kilka argumentów. Użyj cudzysłowów lub backslasha.',
    status:completed?'complete':result.ok?'partial':'error'
  };
  if(cmd==='pipeline') return {
      title:'Potok został przerwany',
      detail:result.output+' Sprawdź, w którym etapie wystąpił problem. Kolejne polecenie pobiera dane z poprzedniego, nie z pliku.',
      status:'error'
    };
    if(cmd==='id'||cmd==='groups') return {
      title:'Niepoprawne parametry tożsamości',
      detail:'id pokazuje UID i GID: -u, -g, -G oraz warianty nazw -un, -gn, -Gn. groups nie przyjmuje argumentów w tym symulatorze. W razie wątpliwości sprawdź man id.',
      status:'error'
    };
    if(cmd==='redirect')return {
      title:'Nie udało się zapisać wyniku polecenia',
      detail:result.output+' Sprawdź składnię > albo >>, istnienie katalogu oraz prawa zapisu do pliku. Źródło musi być poprawnym poleceniem odczytującym.',
      status:'error'
    };
  if(cmd==='chgrp') return {
      title:'Nie udało się zmienić grupy pliku',
      detail:'chgrp wymaga, abyś był właścicielem pliku i należał do wybranej grupy. Sprawdź id -Gn, stat i uprawnienia katalogów nadrzędnych.',
      status:'error'
    };
    if(cmd==='umask') return {
      title:'Maska musi być zapisana w systemie ósemkowym',
      detail:'umask bez argumentów pokazuje aktualną maskę, a umask 077 ją ustawia. Użyj trzech cyfr od 0 do 7.',
      status:'error'
    };
    if(cmd==='namei') return {
      title:'Nie udało się przeanalizować ścieżki',
      detail:'Użyj namei -l SCIEZKA na istniejącym pliku. Polecenie nie naprawia praw dostępu, tylko je pokazuje.',
      status:'error'
    };
  if(cmd==='man') return {
      title:'Podręcznik nie został otwarty',
      detail:'Sprawdź nazwę polecenia albo wyszukaj temat przez man -k HASLO. man pokazuje tylko dokumentację obsługiwaną przez symulator.',
      status:'error'
    };
    const fallback = explainError(result);
    return {
      title: fallback?.title ?? 'Polecenie nie powiodło się',
      detail: fallback?.guidance ?? 'Sprawdź argumenty, ścieżki i aktualny stan wirtualnego systemu.',
      status: 'error'
    };
  }

  if (cmd === 'ls') {
    const target = result.target;
    const isDirectory = !!target && before.dirs.includes(target);
    const description = isDirectory
      ? 'ls wyświetlił elementy wskazanego katalogu; nie przeszedł do niego i nie zmienił zawartości plików.'
      : 'ls wyświetlił nazwę wskazanego pliku; nie otworzył jego treści i nie zmienił katalogu roboczego.';
    return {
      title: completed ? 'Zadanie z ls zaliczone' : isFocusCommand ? 'ls wykonał się, ale cel zadania nie jest jeszcze spełniony' : 'ls wykonał się — wróć do polecenia ćwiczonego w lekcji',
      detail: description + (completed ? '' : ' Sprawdź, czy oglądasz właściwą lokalizację.'),
      status: completed ? 'complete' : 'partial'
    };
  }
  if (cmd === 'cd') return {
    title: completed ? 'Zadanie z cd zaliczone' : isFocusCommand ? 'cd zmienił katalog, ale nie na docelowy' : 'cd zmienił katalog — wróć do celu aktualnej lekcji',
    detail: 'Bieżący katalog: ' + result.state.cwd +
      '. cd zwykle nie drukuje wyniku — sprawdzisz pozycję poleceniem pwd.',
    status: completed ? 'complete' : 'partial'
  };
  if (cmd === 'grep') {
    const count = result.output ? result.output.split('\n').length : 0;
    return {
      title: completed ? 'Zadanie z grep zaliczone' : isFocusCommand ? 'grep znalazł tekst, ale cel zadania nie jest jeszcze spełniony' : 'grep znalazł tekst — wróć do celu aktualnej lekcji',
      detail: 'grep wypisał ' + count + (count === 1 ? ' pasujący wiersz.' : ' pasujące wiersze.') +
        ' Przeszukuje treść i niczego w pliku nie zmienia.' +
        (completed ? '' : ' Zweryfikuj plik i wzorzec wyszukiwania.'),
      status: completed ? 'complete' : 'partial'
    };
  }

  if (cmd === 'find') {
    const paths = result.output === '(brak wynikow)' || !result.output
      ? [] : result.output.split('\n');
    const count = paths.length;
    const message = count === 0
      ? 'find nie znalazł nazw pasujących do podanych warunków.'
      : 'find odnalazł ' + count + (count === 1 ? ' ścieżkę.' : ' ścieżki.') +
        ' Przeszukuje podkatalogi i porównuje nazwy, a nie zawartość plików.';
    return {
      title: completed ? 'Zadanie z find zaliczone'
        : isFocusCommand ? 'find wykonał wyszukiwanie — sprawdź jego zakres'
          : 'find wykonał wyszukiwanie — wróć do celu aktualnej lekcji',
      detail: message + (completed ? '' : ' Upewnij się, że szukasz w odpowiednim miejscu i używasz właściwego wzorca.'),
      status: completed ? 'complete' : 'partial'
    };
  }
  if (cmd === 'cp') {
    const target = result.target;
    const existedBefore = !!target && Object.hasOwn(before.files,target);
    const copied = !!target && Object.hasOwn(result.state.files,target);
    const message = copied
      ? 'cp ' + (existedBefore ? 'nadpisał istniejący plik.' : 'utworzył nowy plik.') +
        ' Zawartość została zapisana w ścieżce wybranej w poleceniu; plik źródłowy pozostał na miejscu.'
      : 'cp wykonał się, ale nie znaleziono docelowego pliku w nowym stanie symulatora.';
    return {
      title: completed ? 'Zadanie z cp zaliczone'
        : isFocusCommand ? 'Kopiowanie wykonane — cel zadania jeszcze nie jest spełniony'
          : 'Kopiowanie wykonane — wróć do celu aktualnej lekcji',
      detail: message + (completed ? '' : ' Sprawdź nazwę i lokalizację kopii.'),
      status: completed ? 'complete' : 'partial'
    };
  }
  if (cmd === 'chmod') {
    const target = result.target;
    const prior = target ? modeOctal(before,target) : null;
    const current = target ? modeOctal(result.state,target) : null;
    const changed = prior !== current;
    const message = target
      ? 'Prawa pliku: ' + prior + ' → ' + current + ' (' +
        modeString(result.state,target) + '). ' +
        (changed ? 'chmod zmienił metadane uprawnień, nie treść pliku.'
          : 'Prawa pozostały takie same; sama komenda nie zawsze prowadzi do oczekiwanego zabezpieczenia.')
      : 'chmod zarządza uprawnieniami pliku.';
    return {
      title: completed ? 'Zadanie z chmod zaliczone'
        : isFocusCommand ? 'Zmiana uprawnień wykonana — sprawdź rezultat'
          : 'chmod wykonany — wróć do celu aktualnej lekcji',
      detail: message + (completed ? '' : ' Zastanów się, kto powinien móc odczytać i modyfikować plik.'),
      status: completed ? 'complete' : 'partial'
    };
  }

  if(cmd==='pipeline') return {
    title:completed?'Potok wykonał zadanie':'Potok zadziałał — cel jeszcze nie został spełniony',
    detail:'Dane przeszły przez '+(result.stages?.join(' → ')??'kolejne komendy')+
      '. Każdy etap otrzymał wiersze poprzedniego etapu. Wynik końcowy: '+
      (result.output||'(pusty)')+'.'+
      (completed?'':' Sprawdź, czy liczysz właściwą kategorię zdarzeń oraz czy usuwasz duplikaty przed liczeniem.'),
    status:completed?'complete':'partial'
  };

  if(cmd==='id'||cmd==='groups') {
    const meaning=result.target==='group-ids'
      ?'To numery GID wszystkich grup: pierwsza jest podstawowa, następne to grupy dodatkowe.'
      :result.target==='group-names'
        ?'To nazwy grup. Sama przynależność do grupy nie nadaje uprawnień root.'
        :result.target==='primary-gid'||result.target==='primary-name'
          ?'To tylko grupa podstawowa; użytkownik może należeć także do grup dodatkowych.'
          :'UID identyfikuje użytkownika, GID identyfikuje grupę. To dwa różne rodzaje identyfikatorów.';
    return {
      title:completed?'Tożsamość odczytana — cel osiągnięty':'Tożsamość odczytana — sprawdź dalszy cel',
      detail:meaning+' Polecenie jedynie odczytało dane wirtualnej sesji.',
      status:completed?'complete':'partial'
    };
  }
  if(cmd==='namei') return {
    title:result.blockedAt?'Znaleziono blokujący katalog':'Sprawdzono uprawnienia ścieżki',
    detail:result.blockedAt
      ?'W jednym z katalogów brakuje skutecznego prawa x dla bieżącego użytkownika. Nawet plik z prawem r będzie niedostępny bez przejścia przez katalogi nadrzędne.'
      :'Katalogi na tej ścieżce pozwalają na przejście. Jeśli odczyt nadal nie działa, zbadaj prawo r pliku.',
    status:completed?'complete':'partial'
  };
  if(cmd==='variable')return {
    title:completed?'Zmienne wykorzystane poprawnie':'Zapisano zmienną w sesji',
    detail:'Przypisanie przechowuje tekst, ale nie kopiuje plików. Dopiero użycie $SOURCE i $DEST w poleceniu cp rozwinie zapisane ścieżki. W apostrofach $NAZWA pozostaje dosłownym tekstem.',
    status:completed?'complete':'partial'
  };
  if(cmd==='echo'&&result.variableRefs?.some(x=>x!=='?'))return {
    title:completed?'Zmienna poprawnie użyta':'Wypisano rozwiniętą wartość',
    detail:'echo pokazuje wartość zmiennej z bieżącej sesji. Rozwinięcie samo nie zmienia plików. Cudzysłów zachowuje wartość jako jeden argument, apostrofy nie rozwijają zmiennych.',
    status:completed?'complete':'partial'
  };
  if(cmd==='unset')return {
    title:'Usunięto zmienną sesji',
    detail:'unset usuwa zapisane powiązanie nazwy z wartością, nie usuwa pliku, do którego zmienna wskazywała.',
    status:completed?'complete':'partial'
  };
  if(cmd==='echo'&&result.target==='previous-exit')return {
    title:completed?'Statusy porównane':'Odczytano kod poprzedniej komendy',
    detail:'echo $? wypisuje poprzedni kod: 0 to sukces, 1 oznacza m.in. brak dopasowania, 2 błąd składni lub grep, 127 nieznane polecenie. Samo echo ustawia nowy kod 0; sprawdzaj bezpośrednio po badanej operacji.',
    status:completed?'complete':'partial'
  };
  if(cmd==='redirect')return {
    title:completed?'Raport zapisany i zweryfikowany':'Dane zapisane w pliku',
    detail:'Przekierowanie zmienia plik docelowy, a nie wejściowy. > zastępuje zawartość, >> ją dopisuje. Odczytaj wynik przez cat i sprawdź, czy oba zestawy wierszy są obecne.',
    status:completed?'complete':'partial'
  };
  if(cmd==='chgrp') return {
    title:completed?'Własność grupowa ustawiona poprawnie':'Grupa zmieniona - sprawdź rezultat',
    detail:'chgrp zmienia numer GID właściciela grupowego, ale nie zmienia UID, zawartości ani bitów rwx. Zweryfikuj przez stat lub ls -l, kto może odczytać plik.',
    status:completed?'complete':'partial'
  };
  if(cmd==='umask') return {
    title:result.target==='read'?'Odczytano aktualną maskę':'Ustawiono maskę nowych obiektów',
    detail:'Plik zaczyna od 666, katalog od 777. Umask odejmuje bity uprawnień przy TWORZENIU; nie zmienia istniejących obiektów. Sprawdź to przez touch, mkdir i stat.',
    status:completed?'complete':'partial'
  };
  if(cmd==='man') return {
    title:completed?'Dokumentacja wykorzystana w zadaniu':'Podręcznik otwarty — pora wykorzystać wiedzę',
    detail:'man pokazuje składnię i opis obsługiwanych opcji. Samo przeczytanie strony nie zmienia systemu ani nie rozwiązuje ćwiczenia. Teraz zastosuj poznaną funkcję.',
    status:completed?'complete':'partial'
  };
  return {
    title: completed ? 'Zadanie wykonane poprawnie' : 'Polecenie wykonane — zadanie nadal otwarte',
    detail: completed
      ? 'Symulator potwierdził skutek wymagany w ćwiczeniu.'
      : 'Polecenie zadziałało, ale sprawdź rezultat w odniesieniu do celu zadania.',
    status: completed ? 'complete' : 'partial'
  };
}
