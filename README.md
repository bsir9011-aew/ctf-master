# 🐧 CTF Master

**From Linux Explorer to CTF Master.** Mobilna aplikacja edukacyjna typu PWA: terminal treningowy, mini-laboratoria i zadania CTF. Cel: samodzielne rozwiazywanie nowych problemow, a nie odgadywanie jednej komendy.

## Uruchomienie (GitHub Codespaces)

```bash
npm install
npm run dev
```

W Codespaces otworz udostepniony port **5173** (zakladka **Ports**). Na telefonie otworz adres podgladu; mozna zainstalowac aplikacje jako PWA. Build produkcyjny: `npm run build`. Testy symulatora: `npm test` (Node.js 22+).

## Co dziala w MVP 0.3

- 8 misji: 3 podstawowe, 4 dotyczace logow i plikow oraz 1 zadanie transferowe (analiza zdarzenia i zachowanie kopii).
- Symulowany terminal: `pwd`, `ls` (`-a`, `-l`), `cd`, `cat`, `mkdir`, `touch`, `cp`, `mv`, `rm`, `grep [-i]`, `find [-name]`, `whoami`, `help`, `clear`.
- Wirtualny system plikow, prawdziwe zmiany stanu w pamieci symulatora.
- Walidacja efektu zadania, nie porownywanie odpowiedzi 1:1.
- Podpowiedzi 3 poziomow, kontekstowe komunikaty o bledach, licznik prob i punkt samodzielnego rozwiazania.
- Zapis sesji w `localStorage` z migracja danych z MVP 0.1 i 0.2 bez resetowania postepu.
- PWA: manifest, ikony, service worker dla wersji produkcyjnej.

**Bezpieczenstwo:** Polecenia nie sa wykonywane na urzadzeniu, w kontenerze ani na serwerze. Parser obsluguje tylko jawnie dozwolone komendy symulacji. To nie jest prawdziwy Bash.

## Architektura

```text
src/App.tsx                 UI, misje i lokalny zapis sesji
src/core/missions.ts        tresc misji i warunki zaliczenia
src/core/linux.ts           silnik komend i wirtualny system plikow
public/sw.js                tryb offline dla zbudowanej aplikacji
```

## Plan

Zobacz [docs/ROADMAP.md](docs/ROADMAP.md). Przyszle etapy: bogatszy parser, drag & drop, uprawnienia, procesy, sieci, Web/Forensics/OSINT/Reverse/Pwn. `grep` szuka doslownego tekstu; `find` obsluguje jedynie `-name` z `*` i `?`; `rm` usuwa tylko pliki. Nie ma jeszcze potokow ani przekierowan. Ocena samodzielnosci dotyczy pierwszego zaliczenia misji (brak blednych komend, help i odkrytych podpowiedzi); powtorki z oddzielnymi podejsciami pojawia sie pozniej. Nie wykonujemy prawdziwych polecen uzytkownika na backendzie.

## Status

MVP demonstracyjne, niepelny interpreter systemu Linux. Zestaw zadan celowo ograniczony, aby unikac pozornej nauki poprzez setki sztywnych quizow.
