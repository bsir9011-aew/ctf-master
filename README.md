# 🐧 CTF Master

**From Linux Explorer to CTF Master.** Mobilna aplikacja edukacyjna typu PWA: terminal treningowy, mini-laboratoria i zadania CTF. Cel: samodzielne rozwiazywanie nowych problemow, a nie odgadywanie jednej komendy.

## Uruchomienie (GitHub Codespaces)

```bash
npm install
npm run dev
```

W Codespaces otworz udostepniony port **5173** (zakladka **Ports**). Na telefonie otworz adres podgladu; mozna zainstalowac aplikacje jako PWA. Build produkcyjny: `npm run build`. Testy symulatora: `npm test` (Node.js 22+).

## Co dziala w 1.0 RC (Akademia komend)

- 16 misji: terminal, pliki, logi, uprawnienia, procesy, uslugi, routing IPv4, DNS i sciezki ARP/TCP (z opcjonalnym widokiem topologii).
- Trzy tryby: **Komendy** (15 ćwiczeń składni i działania), **Misje** (16 scenariuszy), **Powtórki** (20 wariantów). Akademia komend korzysta z odrębnego symulatora i postępu.
- Zwinięta domyślnie **Mapa nauki** z 5 rozdziałami: cele, komendy, licznik postępu, przejście do pierwszej dostępnej misji.
- Symulowany terminal: `pwd`, `ls` (`-a`, `-l`), `cd`, `cat`, `mkdir`, `touch`, `cp`, `mv`, `rm`, `grep [-i]`, `find [-name]`, `chmod`, `stat`, `ps`, `kill`, `systemctl`, `journalctl`, `ip`, `ping`, `ss`, `resolvectl`, `nslookup`, `nc -z`, `trace`, `whoami`, `help`, `clear`.
- Wirtualny system plikow, prawdziwe zmiany stanu w pamieci symulatora.
- Walidacja efektu zadania, nie porownywanie odpowiedzi 1:1.
- Podpowiedzi 3 poziomow, kontekstowe komunikaty o bledach, licznik prob i punkt samodzielnego rozwiazania.
- Tryb **Powtorki**: 10 umiejetnosci (w tym DNS i diagnostyka sciezki TCP), kazda z 2 wariantami, osobnym terminalem i lokalnym zapisem.
- Umiejetnosc uznana za przećwiczona po 2 kolejnych samodzielnie wykonanych roznych wariantach (brak bledow, help i podpowiedzi).
- Zapis sesji w `localStorage` z migracja danych z MVP 0.1-0.7 bez resetowania postepu.
- PWA: manifest, ikony i wersjonowany service worker dla buildu produkcyjnego; aktualizacje nie trzymaja na stale starego HTML.

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

## Wizualizacja drogi pakietu (MVP 0.9)

W zadaniach dotyczacych routingu, DNS i TCP (oraz odpowiednich powtorkach) dostepny jest responsywny schemat **komputer → przelacznik → router → serwer**. Schemat jest pogladowy, a rozbudowana analiza bierze aktualne dane z wirtualnego systemu: adres IPv4/prefiks, brame, stan eth0, skonfigurowany DNS, tablice ARP oraz port zdalnego serwera.

Przycisk **Pokaż analizę (pomoc)** odkrywa etapy rozumowania i miejsce, w ktorym polaczenie sie zatrzymuje. W nieukonczonej misji lub powtorce odkrycie analizy jest traktowane jak skorzystanie z podpowiedzi (wynik pierwszego samodzielnego zaliczenia nie jest przyznawany). Panel domyslnie jest zwiniety i nie zmienia stanu sieci. Zmiany wykonuje sie wylacznie komendami terminala; schemat od razu odswieza sie po takim poleceniu.

W analizie mozna przejsc miedzy hostem podanym jako IPv4 lub domena oraz porownywac porty TCP. Podane etapy to **kolejnosc diagnostyczna**, nie zapis rzeczywistej kolejnosci pakietow. Przelacznik jest elementem pogladowym (brak jeszcze implementacji VLAN, ARP po stronie switcha, fizycznych portow ani tablicy MAC). Model nie wysyla zadnych prawdziwych pakietow i nie tworzy ruchu sieciowego. Test interfejsu na telefonie pozostaje do wykonania.

## Wydanie mobilne 1.0 RC

Na telefonie zamiast dlugiej siatki 16 misji jest dostepna lista wyboru. Terminal obsluguje 30 ostatnich unikalnych polecen (przyciski strzalek lub klawiatura fizyczna), a po wykonaniu polecen przewija sie wylacznie historia terminala, nie cala strona. Historia komend jest lokalna dla otwartej sesji karty; zapis postepu misji pozostaje w `localStorage` na starym kluczu (brak migracji lub resetu).

**Uzywanie offline:** produkcyjny service worker ma wersje cache `v1.0.0`, pobiera pliki buildu i stosuje network-first dla strony HTML, cache-first dla zasobow. Nie nalezy testowac offline na `npm run dev`, poniewaz service worker rejestrowany jest tylko w trybie produkcyjnym. Do sprawdzenia sluzy `npm run build && npm run preview -- --host 0.0.0.0` na porcie 4173; patrz [docs/MOBILE_QA.md](docs/MOBILE_QA.md).

**Uwaga:** 1.0 to release candidate, nie wynik zakonczonego QA na prawdziwym telefonie. CI potwierdza testy logiki oraz build, a instalacja PWA i zachowanie klawiatury ekranowej wymagaja manualnego sprawdzenia.

## Mapa nauki (1.0 RC.2)

Aby nie przeskakiwać od podstawowych poleceń prosto do rozbudowanej diagnostyki, dodaliśmy pięć ułożonych po kolei rozdziałów: terminal i flaga (misje 1–3), pliki i śledztwa (4–8), uprawnienia (9–10), procesy i usługi (11–12), sieć i troubleshooting (13–16). Każda sekcja wyjaśnia cel, używane komendy i oczekiwaną umiejętność. Mapa pokazuje zaliczony/odblokowany/zablokowany status obliczany z zapisanej historii misji. Nie zawiera obejścia blokad i nie resetuje postępu.

To nadal wydanie **release candidate**: testy automatyczne oraz build nie zastępują ręcznego testu na fizycznym telefonie; lista w `docs/MOBILE_QA.md` pozostaje aktualna.

## Akademia komend (1.0 RC.3)

Aplikacja startuje w zakładce **Komendy**. Dostępnych jest 15 krótkich ćwiczeń: nawigacja, tworzenie plików, odczyt, wyszukiwanie, kopiowanie, przenoszenie i usuwanie, a dalej uprawnienia, procesy, usługi i trasy IP. Każde zadanie zawiera zastosowanie, składnię, przykład, jedną podpowiedź i pole do wpisania polecenia. Zaliczenie zależy od zaobserwowanego działania symulowanego systemu, nie od samego identycznego ciągu tekstowego. Można powtarzać zadania bez blokowania następnych, z resetem wirtualnego laboratorium.

Wykonanie ćwiczeń i ich postęp **nie odblokowują misji CTF**. Akademia ma osobny stan w localStorage (`ctf-master:command-academy-v1`) i nie modyfikuje dotychczasowych kluczy misji oraz powtórek. Wznowienie po odświeżeniu zachowuje ukończone ćwiczenia i wybrany numer; niezakończone polecenia i pliki treningowe są resetowane po przejściu do innego trybu.

Nadal wymagany jest test ręczny na fizycznym telefonie i sprawdzenie PWA offline według `docs/MOBILE_QA.md`.

## Sprawdzian transferowy dla kazdej komendy (1.0 RC.4)

Po pierwszym zaliczeniu komendy mozna otworzyc **Sprawdz samodzielnie**. Dostepnych jest 15 drugich wariantow, z innymi nazwami plikow, miejscem wykonania lub celem diagnostycznym. Sprawdzian uruchamia niezalezne, odtwarzalne srodowisko. Przyklad skladni nie jest w nim pokazywany, a podpowiedz jest ogolna.

Akademia odroznia **poznane** (pierwsze cwiczenie) od **opanowane** (drugi wariant rozwiazany bez nieudanej komendy i bez podpowiedzi). Uzycie podpowiedzi albo blad nie przeszkadza w cwiczeniu, ale wymaga powtorzenia sprawdzianu od poczatku dla potwierdzenia samodzielnosci. Postep starszych wersji pozostaje zachowany; nie przyznajemy retrospektywnie opanowania dawnym zaliczeniom. Dane nadal sa lokalne, bez backendu i bez zmian stanu misji CTF.

Testy automatyczne dotycza wszystkich 15 drugich wariantow, odtwarzania srodowiska, brakow uprawnien do przyznania mastery oraz odczytu starych zapisow. **QA na fizycznym telefonie: nadal do wykonania.**

## Trener komend (1.0 RC.5)

Akademia pokazuje **Twój następny krok**. Dla umiejętności poznanych, lecz jeszcze nieopanowanych zaleca sprawdzian na nowych danych; w pozostałych przypadkach proponuje kolejne ćwiczenie. Błędy oraz użycie podpowiedzi zwiększają priorytet danej umiejętności. Kolejność jest deterministyczna, bez AI i bez zewnętrznych połączeń.

Lokalne liczniki trudności są zapisywane oddzielnie w `ctf-master:academy-coach-v1`. Nie zawierają wpisywanych komend ani ich wyników, wyłącznie zliczenia błędów i użycia pomocy. Starszy postęp Akademii, misji i powtórek pozostaje nienaruszony. W sprawdzianie wpisanie `help` jest traktowane tak samo jak ujawnienie podpowiedzi: można ukończyć zadanie, ale do zaliczenia samodzielności potrzeba nowej próby.

To prosta heurystyka priorytetów, nie model psychometryczny i nie kalendarz spaced repetition. Ręczne QA na telefonie nadal czeka na wykonanie.
