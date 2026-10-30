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
    if(cmd==='pipeline') return {
      title:'Potok został przerwany',
      detail:result.output+' Sprawdź, w którym etapie wystąpił problem. Kolejne polecenie pobiera dane z poprzedniego, nie z pliku.',
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
