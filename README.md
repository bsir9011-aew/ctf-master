# 🐧 CTF Master

**From Linux Explorer to CTF Master.** Mobilna aplikacja edukacyjna typu PWA: terminal treningowy, mini-laboratoria i zadania CTF. Cel: samodzielne rozwiazywanie nowych problemow, a nie odgadywanie jednej komendy.

## Uruchomienie (GitHub Codespaces)

```bash
npm install
npm run dev
```

W Codespaces otworz udostepniony port **5173** (zakladka **Ports**). Na telefonie otworz adres podgladu; mozna zainstalowac aplikacje jako PWA. Build produkcyjny: `npm run build`. Testy symulatora: `npm test` (Node.js 22+).

## Co dziala w MVP 0.6

- 12 misji: 3 podstawowe, 4 dotyczace logow i plikow, 1 transferowa, 2 o uprawnieniach, 2 o procesach i uslugach.
- Symulowany terminal: `pwd`, `ls` (`-a`, `-l`), `cd`, `cat`, `mkdir`, `touch`, `cp`, `mv`, `rm`, `grep [-i]`, `find [-name]`, `chmod`, `stat`, `ps`, `kill`, `systemctl`, `journalctl`, `whoami`, `help`, `clear`.
- Wirtualny system plikow, prawdziwe zmiany stanu w pamieci symulatora.
- Walidacja efektu zadania, nie porownywanie odpowiedzi 1:1.
- Podpowiedzi 3 poziomow, kontekstowe komunikaty o bledach, licznik prob i punkt samodzielnego rozwiazania.
- Tryb **Powtorki**: 6 umiejetnosci (logi, szukanie dowodow, kopie, uprawnienia, procesy, uslugi), kazda z 2 wariantami, osobnym terminalem i lokalnym zapisem.
- Umiejetnosc uznana za przećwiczona po 2 kolejnych samodzielnie wykonanych roznych wariantach (brak bledow, help i podpowiedzi).
- Zapis sesji w `localStorage` z migracja danych z MVP 0.1-0.5 bez resetowania postepu.
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

Zobacz [docs/ROADMAP.md](docs/ROADMAP.md). Przyszle etapy: bogatszy parser, drag & drop, uprawnienia zaawansowane, sieci, Web/Forensics/OSINT/Reverse/Pwn. `grep` szuka doslownego tekstu; `find` obsluguje jedynie `-name` z `*` i `?`; `rm` usuwa tylko pliki. Nie ma jeszcze potokow ani przekierowan. Ocena samodzielnosci dotyczy pierwszego zaliczenia misji (brak blednych komend, help i odkrytych podpowiedzi); powtorki sa prowadzone w osobnych sesjach. Nie wykonujemy prawdziwych polecen uzytkownika na backendzie.

## Status

MVP demonstracyjne, niepelny interpreter systemu Linux. Zestaw zadan celowo ograniczony, aby unikac pozornej nauki poprzez setki sztywnych quizow.

## Tryb powtorek (MVP 0.6)

Powtorki odblokowuja sie po przejsciu odpowiednich misji. Trudne umiejetnosci sa wyswietlane jako zalecane na podstawie bledow, pomocy i braku samodzielnego zaliczenia. Dwa kolejne samodzielne rozwiazania, w zmienionych danych, sa wymagane do zaliczenia umiejetnosci. Warianty sa deterministyczne, a nie losowane. Nie jest to jeszcze kalendarz powtorek rozlozonych w czasie.

W trybie powtorek kazda sesja ma osobny system plikow, zatem oryginalne misje zachowuja stan. Przelaczanie trybow nie usuwa trwajacej powtorki. `npm test` sprawdza logike; testy i build uruchamia takze GitHub Actions.

## Uprawnienia (MVP 0.5)

Dodano `stat PLIK`, `chmod 600 PLIK`, `chmod u+r PLIK`, `chmod go-rwx PLIK` oraz prezentacje praw rwx w `ls -l`. Odczyt przez `cat`, `grep` i kopiowanie przez `cp` respektuja prawo czytania wlasciciela. Dwie misje dotycza hardeningu pliku i diagnozy `Permission denied`. Dwie nowe powtorki wymagaja samodzielnego przeniesienia umiejetnosci.

**Uproszczenia symulacji:** istnieje tylko wlasciciel `player`, nie ma prawdziwego `chown`, ACL, sudo, grup użytkownikow, setuid, uruchamiania skryptow ani pelnych kontroli dostepu do katalogow. `chmod` dotyczy tylko plikow. Uprawnienia sa stanem wirtualnej gry, nie uprawnieniami urzadzenia.

## Procesy i uslugi (MVP 0.6)

Nowe polecenia: `ps` / `ps aux`, `kill PID`, `systemctl status|start|stop|restart UNIT`, `journalctl -u UNIT`. Procesy oraz stany jednostek systemd zmieniaja sie w pamieci symulatora i sa oddzielne w kazdej powtorce. Dwie misje ucza identyfikacji i zakonczenia wskazanego procesu oraz diagnozy i przywrocenia niedzialajacej uslugi `web`. Dodatkowo po dwa warianty powtorek dla procesow i uslug.

To uproszczona symulacja: stale PID, jeden uzytkownik, kilka nazwanych jednostek, brak rzeczywistego schedulera, sygnalow innych niz modelowany SIGTERM, uprawnien systemd, `sudo`, realnych procesow i realnego systemd. `journalctl` odczytuje wylacznie zdefiniowane dzienniki fikcyjnych uslug. Polecenia **nigdy** nie trafiaja do systemu gospodarza.
