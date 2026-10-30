import { explainError } from './learning.ts';
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

  return {
    title: completed ? 'Zadanie wykonane poprawnie' : 'Polecenie wykonane — zadanie nadal otwarte',
    detail: completed
      ? 'Symulator potwierdził skutek wymagany w ćwiczeniu.'
      : 'Polecenie zadziałało, ale sprawdź rezultat w odniesieniu do celu zadania.',
    status: completed ? 'complete' : 'partial'
  };
}
