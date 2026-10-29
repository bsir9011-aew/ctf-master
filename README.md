# 🐧 CTF Master

**From Linux Explorer to CTF Master.** Mobilna aplikacja edukacyjna typu PWA: terminal treningowy, mini-laboratoria i zadania CTF. Cel: samodzielne rozwiazywanie nowych problemow, a nie odgadywanie jednej komendy.

## Uruchomienie (GitHub Codespaces)

```bash
npm install
npm run dev
```

W Codespaces otworz udostepniony port **5173** (zakladka **Ports**). Na telefonie otworz adres podgladu; mozna zainstalowac aplikacje jako PWA. Build produkcyjny: `npm run build`. Testy symulatora: `npm test` (Node.js 22+).

## Co dziala w MVP 0.8

- 16 misji: terminal, pliki, logi, uprawnienia, procesy, uslugi, routing IPv4, DNS i sciezki ARP/TCP.
- Symulowany terminal: `pwd`, `ls` (`-a`, `-l`), `cd`, `cat`, `mkdir`, `touch`, `cp`, `mv`, `rm`, `grep [-i]`, `find [-name]`, `chmod`, `stat`, `ps`, `kill`, `systemctl`, `journalctl`, `ip`, `ping`, `ss`, `resolvectl`, `nslookup`, `nc -z`, `trace`, `whoami`, `help`, `clear`.
- Wirtualny system plikow, prawdziwe zmiany stanu w pamieci symulatora.
- Walidacja efektu zadania, nie porownywanie odpowiedzi 1:1.
- Podpowiedzi 3 poziomow, kontekstowe komunikaty o bledach, licznik prob i punkt samodzielnego rozwiazania.
- Tryb **Powtorki**: 10 umiejetnosci (w tym DNS i diagnostyka sciezki TCP), kazda z 2 wariantami, osobnym terminalem i lokalnym zapisem.
- Umiejetnosc uznana za przećwiczona po 2 kolejnych samodzielnie wykonanych roznych wariantach (brak bledow, help i podpowiedzi).
- Zapis sesji w `localStorage` z migracja danych z MVP 0.1-0.7 bez resetowania postepu.
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

## Siec (MVP 0.7)

Dodano w pelni wirtualne `ip addr show`, `ip addr replace IP/PREFIX dev eth0`, `ip route show`, `ip route replace default via IP`, `ip link set eth0 up|down`, `ping -c 1 IPv4` oraz `ss -lnt`. Symulowany test lacznosci bierze pod uwage IPv4, prefiks, czy router jest w tej samej podsieci, trase domyslna i stan interfejsu. `ss` pokazuje porty nasluchujace aktywnych, symulowanych uslug: sshd:22, web:8080, api:9000.

Dwie nowe misje: naprawa bramy i diagnoza brakujacego portu 9000. Cztery powtorki celowane: zla brama, zla podsiec oraz dwa scenariusze rozrozniania ICMP/portow TCP.

**Ograniczenia:** symulator nie wykonuje polaczen sieciowych, nie ma prawdziwych pakietow, routingu hosta, DNS, ARP, NAT, firewalli czy `nmap`. `ping` obsluguje jedynie adresy testowe z danego laboratorium i localhost. `ss` pokazuje tylko fikcyjne porty. Zakres polecen jest celowo waski i nie zastepuje terminala Linux.

## Diagnostyka DNS / ARP / TCP (MVP 0.8)

Nowe polecenia: `resolvectl dns eth0 [IP]` (odczyt lub zmiana resolvera), `nslookup NAZWA`, `ip neigh show`, `nc -z HOST PORT`, `trace HOST PORT`. `trace` pokazuje kolejne rozstrzygniecia: DNS → trasa → ARP nastepnego hopu → probe TCP. To **tekstowa symulacja**, a nie przechwytywanie pakietow.

Nowe laboratoria: naprawa DNS oraz odroznienie lacznosci ICMP od otwartego portu TCP. Dwa nowe obszary powtorek (4 warianty), ktore wykorzystuja rozne fikcyjne domeny `.test`, adresy routerow, serwerow DNS i porty.

Symulacja nie wykonuje zapytan DNS ani TCP w prawdziwej sieci, nie implementuje pelnego ARP, UDP, retransmisji, NAT, TLS ani TCP handshake w czasie rzeczywistym. Uzywa rezerwowanych adresow dokumentacyjnych. `ss` dotyczy fikcyjnych lokalnych uslug, podczas gdy `nc -z` sprawdza fikcyjne porty zdalnego hosta. Postep jest przechowywany lokalnie i przenoszony ze starszych wersji.
