import type { CommandResult, LinuxState } from './linux';

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
  }
];
