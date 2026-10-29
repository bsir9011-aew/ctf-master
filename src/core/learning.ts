import type { CommandResult } from './linux';

export interface LearningStats {
  commands: number;
  errors: number;
  hints: number;
  usedHelp: boolean;
  independent: boolean;
}

export type LearningMap = Record<string, LearningStats>;

const initialStats = (): LearningStats => ({
  commands: 0, errors: 0, hints: 0, usedHelp: false, independent: false
});

/** Keep older local saves compatible and discard malformed learning counters. */
export function restoreLearning(value: unknown): LearningMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result: LearningMap = {};
  for (const [id, raw] of Object.entries(value)) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const x = raw as Partial<LearningStats>;
    const safeCount = (v: unknown, max: number) =>
      Number.isInteger(v) && (v as number) >= 0 ? Math.min(v as number, max) : 0;
    result[id] = {
      commands: safeCount(x.commands, 99999),
      errors: safeCount(x.errors, 99999),
      hints: safeCount(x.hints, 3),
      usedHelp: x.usedHelp === true,
      independent: x.independent === true
    };
  }
  return result;
}

export function revealHint(progress: LearningMap, missionId: string): LearningMap {
  const previous = progress[missionId] ?? initialStats();
  return {...progress, [missionId]: {...previous, hints: Math.min(3, previous.hints + 1)}};
}

/** Opening the command list is assistance, even when used through the UI. */
export function markHelp(progress: LearningMap, missionId: string): LearningMap {
  const previous = progress[missionId] ?? initialStats();
  return {...progress, [missionId]: {...previous, usedHelp:true}};
}

/** Independent means the *first* successful completion used neither help nor failed commands. */
export function trackCommand(
  progress: LearningMap, missionId: string, result: CommandResult, firstCompletion: boolean
): LearningMap {
  const previous = progress[missionId] ?? initialStats();
  const countable = result.command !== 'help' && result.command !== 'clear';
  const commands = previous.commands + Number(countable);
  const errors = previous.errors + Number(countable && !result.ok);
  const usedHelp = previous.usedHelp || result.command === 'help';
  return {
    ...progress,
    [missionId]: {
      ...previous, commands, errors, usedHelp,
      independent: previous.independent ||
        (firstCompletion && previous.hints === 0 && errors === 0 && !usedHelp)
    }
  };
}

export interface CoachMessage { title: string; guidance: string }

/** Diagnose an error, but never supply a complete solution to the current mission. */
export function explainError(result: CommandResult): CoachMessage | null {
  if (result.ok || result.command === 'clear') return null;
  const message = result.output.toLowerCase();

  if (message.includes('command not found')) {
    return {
      title: 'Nieznane polecenie w symulatorze',
      guidance: 'Sprawdź literówki i listę obsługiwanych poleceń przez help. Pamiętaj, że to uproszczony Linux, a nie pełny Bash.'
    };
  }
  if (message.includes('protected simulated process')) {
    return {
      title: 'Proces chroniony w symulatorze',
      guidance: 'Nie wszystkie procesy wolno zatrzymywac. Sprawdz w ps, ktory PID nalezy do podejrzanego programu.'
    };
  }
  if (message.includes('process not found')) {
    return {
      title: 'Proces nie istnieje lub juz zostal zatrzymany',
      guidance: 'Odnow liste dzialajacych procesow przez ps i sprawdz numer PID.'
    };
  }
  if (message.includes('unit ') && message.includes('not found')) {
    return {
      title: 'Nieznana jednostka systemd',
      guidance: 'Sprawdz nazwe uslugi. Ten symulator posiada tylko kilka zdefiniowanych jednostek.'
    };
  }
  if (message.includes('destination host unreachable') || message.includes('network interface is down')) {
    return {title:'Brak łączności sieciowej',
      guidance:'Sprawdź adres, prefiks i trasę domyślną. Zweryfikuj, czy brama znajduje się w Twojej podsieci i czy interfejs jest aktywny.'};
  }
  if (message.includes('nexthop has invalid gateway')) {
    return {title:'Brama poza osiągalną podsiecią',
      guidance:'Porównaj IP/prefiks interfejsu z adresem bramy. Bez właściwej adresacji router nie jest osiągalny na tym łączu.'};
  }
  if (message.includes('packet loss')) {
    return {title:'Brak odpowiedzi ICMP',
      guidance:'Sprawdź, czy odpytywany adres jest poprawny. Sam ping nie potwierdza otwartego portu TCP ani działania usługi.'};
  }
  if (message.includes('invalid ipv4 address')) {
    return {title:'Nieprawidłowa adresacja IPv4',
      guidance:'Adres składa się z czterech oktetów 0–255, a prefiks określa liczbę bitów sieci, np. /24.'};
  }
  if (message.includes('uzycie: ip') || message.includes('uzycie: ping') || message.includes('uzycie: ss')) {
    return {title:'Składnia polecenia sieciowego',
      guidance:'Sprawdź formę polecenia i nazwy argumentów przez help. Symulator obsługuje tylko określone warianty.'};
  }
  if (message.includes('permission denied')) {
    return {
      title: 'Brak odpowiednich uprawnień',
      guidance: 'Sprawdź właściciela i bity rwx przez stat lub ls -l. Ustal, komu faktycznie trzeba przyznać dostęp, zamiast nadawać 777.'
    };
  }
  if (message.includes('brak dopasowan')) {
    return {
      title: 'Nie znaleziono szukanego tekstu',
      guidance: 'Sprawdź wzorzec i wielkość liter. W grep opcja -i wyłącza rozróżnianie wielkich i małych liter.'
    };
  }
  if (message.includes('no such') || message.includes('nie istnieje') || message.includes('not found') || message.includes('nieistniej')) {
    return {
      title: 'Nie odnaleziono wskazanej ścieżki',
      guidance: 'Ustal bieżący katalog przez pwd. Następnie sprawdź jego zawartość przez ls i porównaj ścieżkę względną z bezwzględną.'
    };
  }
  if (message.includes('uzycie:') || message.includes('argument') || message.includes('opcja') || message.includes('zbyt wiele')) {
    return {
      title: 'Problem ze składnią polecenia',
      guidance: 'Oddziel polecenie od argumentów. Zwróć uwagę na liczbę parametrów i opcje zaczynające się od -. Zajrzyj do help, jeśli trzeba.'
    };
  }
  if (message.includes('directory') || message.includes('katalogiem') || message.includes('katalogow') || message.includes('plikiem')) {
    return {
      title: 'Niewłaściwy typ obiektu',
      guidance: 'Sprawdź, czy operujesz na pliku czy katalogu. Te obiekty nie zawsze obsługuje się tak samo.'
    };
  }
  if (message.includes('file exists') || message.includes('identyczne')) {
    return {
      title: 'Operacja nie zmieniłaby stanu',
      guidance: 'Sprawdź stan obecnego katalogu i cel operacji, zanim ponowisz polecenie.'
    };
  }
  return {
    title: 'Polecenie nie wykonało zadania',
    guidance: 'Przeczytaj dokładnie komunikat terminala. Ustal najpierw, czy problem dotyczy ścieżki, argumentów czy aktualnego stanu plików.'
  };
}
