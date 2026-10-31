# 🐧 CTF Master

**From Linux Explorer to CTF Master.** Mobilna aplikacja edukacyjna typu PWA: terminal treningowy, mini-laboratoria i zadania CTF. Cel: samodzielne rozwiazywanie nowych problemow, a nie odgadywanie jednej komendy.

## Uruchomienie (GitHub Codespaces)

```bash
npm install
npm run dev
```

W Codespaces otworz udostepniony port **5173** (zakladka **Ports**). Na telefonie otworz adres podgladu; mozna zainstalowac aplikacje jako PWA. Build produkcyjny: `npm run build`. Testy symulatora: `npm test` (Node.js 22+).

## Co dziala w 1.0 RC (Akademia komend)

- 21 misji: terminal, pliki, logi, uprawnienia, procesy, uslugi, routing IPv4, DNS i sciezki ARP/TCP (z opcjonalnym widokiem topologii).
- Trzy tryby: **Komendy** (32 lekcje techniczne + 1 dochodzenie, 33 sprawdziany), **Misje** (21 scenariuszy), **Powtórki** (20 wariantów). Akademia komend korzysta z odrębnego symulatora i postępu.
- Zwinięta domyślnie **Mapa nauki** z 6 rozdziałami: cele, komendy, licznik postępu, przejście do pierwszej dostępnej misji.
- Symulowany terminal: `pwd`, `ls` (`-a`, `-l`), `cd`, `cat`, `mkdir`, `touch`, `cp`, `mv`, `rm`, `grep [-i]`, `find [-name]`, `man POLECENIE`, `man -k HASLO`, `head`, `tail`, `wc`, `sort`, `uniq`, `chmod`, `stat`, `umask`, `chgrp`, `>`, `>>`, `&&`, `||`, `test`, `ps`, `kill`, `systemctl`, `journalctl`, `ip`, `ping`, `ss`, `resolvectl`, `nslookup`, `nc -z`, `trace`, `whoami`, `id`, `groups`, `namei -l`, `help`, `clear`.
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

Zobacz [docs/ROADMAP.md](docs/ROADMAP.md). Dalszy kierunek: coraz lepszy symulator Linuksa, dokumentacja komend, uprawnienia, usługi, diagnostyka i praktyczne zadania. `grep` szuka dosłownego tekstu; `find` obsługuje `-name` z `*` i `?`, a `rm` usuwa tylko pliki. Dostępne są ograniczone potoki tekstowe i bezpieczne przekierowania stdout do plików wirtualnych. Ocena samodzielnosci dotyczy pierwszego zaliczenia misji (brak blednych komend, help i odkrytych podpowiedzi); powtorki sa prowadzone w osobnych sesjach. Nie wykonujemy prawdziwych polecen uzytkownika na backendzie.

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

## Learning Workspace (1.0 RC.6)

Akademia Komend ma teraz **uklad dwukolumnowy na komputerze**: po lewej aktualne cwiczenie i potrzebna skladnia, po prawej terminal z informacja zwrotna bezposrednio pod nim. Na ekranach mobilnych (do 840 px) zadanie wyswietla sie bezposrednio nad terminalem. Pusty terminal jest nizszy; jego historia zwieksza obszar wyswietlania do ograniczonej wysokosci i jest przewijana wewnatrz terminala.

W trybie Komendy uproszczono gorny naglowek, zredukowano powtarzanie biezacej rekomendacji oraz przeniesiono informacje o rezultacie obok terminala. Po wykonaniu cwiczenia przycisk samodzielnego sprawdzianu pojawia sie pod terminalem; dla komend zaliczonych wczesniej jest dostepny takze po ponownym otwarciu zadania. Wersja aplikacji w pasku tytulowym jest odczytywana z `package.json`, a nie wpisana na stale.

Zadna z tych zmian nie modyfikuje silnika Linux ani zapisanych danych. Dotychczasowe 15 cwiczen, 15 sprawdzianow, 16 misji i 20 powtorek nadal sa dostepne. Manualny test na prawdziwym telefonie i test PWA offline: nadal do wykonania.

## Ergonomia terminala Akademii (1.0 RC.7)

W trybie **Komendy** terminal obsluguje historie ostatnich 30 unikalnych wpisanych polecen: klawisze strzalek ↑/↓ w polu wprowadzania lub dwa przyciski przy terminalu, dostepne takze na ekranie dotykowym. Powrot za pomoca ↓ do nowego wpisu przywraca niezapisany szkic polecenia. Historia jest pamietana tylko w ramach biezacego cwiczenia/strony (nie zapisujemy surowych komend ani ich wynikow do localStorage).

Panel „Warto teraz” nie duplikuje juz przycisku sprawdzianu **dla aktualnie wybranej komendy** — ten znajduje sie przy lekcji lub informacji zwrotnej pod terminalem. W razie bledu feedback wyswietla kontekstowa kategorie problemu, np. brak sciezki, uprawnienia lub blad skladni. Program nie zdradza automatycznie gotowej komendy w sprawdzianie. Dotychczasowy postep 15 cwiczen, 15 sprawdzianow, 16 misji i 20 powtorek pozostaje niezmieniony.

QA fizycznego telefonu i faktycznej instalacji PWA nadal wymaga testu recznego.

## Feedback edukacyjny (1.0 RC.8)

Rozszerzono wyjaśnienia dla trzech podstawowych poleceń: `ls`, `cd` i `grep`. Aplikacja rozróżnia nieistniejącą ścieżkę, próbę wejścia do pliku zamiast katalogu, błędną opcję `ls`, złą składnię `grep` i brak dopasowania (w tym znaczenie opcji `-i`). Poprawnie wykonane polecenie może nadal nie spełniać celu lekcji — panel pod terminalem wyjaśnia wtedy realny skutek operacji, a nie przyznaje automatycznie zaliczenia.

Wskazówki opisują zasady, **nie ujawniają docelowej komendy ani niewidocznych plików w sprawdzianach transferowych**. Wirtualny `cd` wyświetla teraz komunikat „Not a directory” dla istniejącego pliku. Zachowano 15 ćwiczeń i 15 sprawdzianów, 16 misji, 20 powtórek i poprzednie zapisy. Test na rzeczywistym telefonie nadal jest do przeprowadzenia.

## Feedback o skutku komendy (1.0 RC.9)

Akademia ma bardziej szczegółowe wyjaśnienia dla **find, cp i chmod**. `find` odróżnia puste wyniki od problemów z katalogiem startowym i pokazuje liczbę odnalezionych ścieżek. `cp` rozróżnia błędną ścieżkę źródła, brak katalogu docelowego, odmowę odczytu i skopiowanie pliku; informuje o utworzeniu nowego pliku lub nadpisaniu istniejącego. `chmod` porównuje prawa pliku przed i po poleceniu, np. 644 → 600 (rw-------), i wyjaśnia, dlaczego samo pomyślne wykonanie komendy nie musi realizować celu zadania.

Dla `cp` i `chmod` interfejs zachowuje w pamięci **stan bezpośrednio sprzed ostatniej komendy** wyłącznie na potrzeby opisania efektu (nie tworzy nowego klucza localStorage ani nie zapisuje surowych komend). Zaliczenie nadal zależy od warunku zadania, a nie od tekstu wyjaśnienia. W sprawdzianach transferowych nie ujawnia się ukrytej docelowej ścieżki. Silnik poleceń i dotychczasowy postęp pozostają bez zmian.

Status: automatyczne testy logiczne i CI sprawdzają kod, lecz rzeczywisty test na telefonie i instalacja PWA offline nadal wymagają ręcznej weryfikacji.

## Rzetelna ocena samodzielności (1.0 RC.10)

Sprawdzian transferowy uznaje teraz za nietrafioną próbę również **poprawnie wykonaną komendę będącą przedmiotem ćwiczenia, jeśli nie prowadzi do celu**. Przykładowo `chmod 640` może zakończyć się bez błędu Linuxa, ale nie spełnia warunku 600 — późniejsze poprawienie trybu w tej samej próbie nie daje statusu „opanowane”. Można zresetować sprawdzian i wykonać go ponownie bez pomyłki. Poprawnie działające **komendy pomocnicze** (np. `pwd` lub `ls` podczas rozpoznania zadania `grep`) nie są karane. Błędy wykonania wciąż liczą się jako nietrafione próby; `help` i przycisk podpowiedzi wciąż liczą pomoc.

Dodatkowo `find . -name WZORZEC` poprawnie interpretuje jawną ścieżkę `.` jako punkt startowy. Lekcja i sprawdzian `find` wymagają przeszukania wskazanego katalogu `~/practice`, a nie całego wirtualnego systemu. Postępy, które użytkownik już zdobył, pozostają niezmienione — nie wykonujemy ponownej retroaktywnej oceny. Rzeczywisty test mobilny nadal do wykonania.

## Nowe laboratoria przetwarzania tekstu (1.0 RC.11)

Akademia ma teraz **20 lekcji i 20 samodzielnych sprawdzianów**. Dodano pięć poleceń: `head [-n N] PLIK`, `tail [-n N] PLIK`, `wc [-l|-w|-c] PLIK`, `sort PLIK` oraz `uniq PLIK`. Każde ma osobne pliki treningowe, drugi wariant z innymi danymi oraz wynik zweryfikowany przez wirtualny interpreter.

Ważne różnice: `head` i `tail` pokazują początek i koniec logu, `wc -l` liczy znaki końca wiersza (nie zawsze liczbę wizualnych wierszy), `sort` porządkuje wiersze bez zmiany pliku, a `uniq` usuwa **tylko sąsiadujące** powtórzenia. `uniq` nie deduplikuje wszystkich wpisów w całym pliku. W wersji RC.11 symulator **nie obsługiwał potoków ani przekierowania**; nowe komendy pracują na pojedynczym pliku i nie modyfikują jego zawartości. `wc -c` liczy bajty UTF-8, a `head/tail -n` dopuszczają od 1 do 100 wierszy.

Wszystkie wcześniejsze zaliczenia i zapisane metryki pozostają zachowane pod dotychczasowymi kluczami localStorage; nowe lekcje zaczynają jako nieukończone. Test na fizycznym telefonie i instalacja PWA offline nadal wymagają wykonania.

## Pierwsze bezpieczne potoki (1.0 RC.12)

**Potok** `|` łączy wynik czytającej komendy z następnym etapem. Przykładowa analiza logów:

```bash
grep WARN ~/practice/alerts.log | sort | uniq | wc -l
```

Pierwszy etap czyta plik (`cat`, `grep`, `head`, `tail`, `sort` lub `uniq`). Kolejne mogą filtrować, sortować, deduplikować sąsiednie wiersze, wybierać ich fragment lub liczyć za pomocą `wc`. Obsługiwane są tylko potoki długości 2–5 etapów. `wc -l` liczy znaki końca wiersza w danych przekazanych do potoku, a `uniq` działa wyłącznie na sąsiednie duplikaty — dlatego często trzeba wcześniej użyć `sort`.

Akademia ma teraz **21 lekcji i 21 niezależnych sprawdzianów**. Lekcja potoków liczy różne ostrzeżenia WARN, a transfer osobno analizuje ERROR w innym pliku. Wynik i kolejność rodzin komend muszą odpowiadać wymaganiu, a nie tylko zostać wpisane w odpowiednim formacie. Feedback objaśnia kolejne etapy.

**Ograniczenia:** to symulator, nie Bash: nie ma dowolnych poleceń w potoku, przekierowań `>`, `<`, `; `, podstawiania komend ani prawdziwego uruchamiania procesów. Pojedyncze polecenia nadal zachowują dotychczasową składnię. Stare zapisy ukończeń nie są modyfikowane. Ręczny test na fizycznym telefonie/PWA nadal czeka na wykonanie.

## Śledztwo bez gotowych komend (1.0 RC.13)

Dodano **22. ćwiczenie Akademii: „Śledztwo: nieznany incydent”**, z dwoma różnymi scenariuszami. Wprowadzenie dotyczy błędów HTTP 502 po wdrożeniu; sprawdzian transferowy dotyczy nietypowych logowań. **Nie podajemy na starcie nazwy źródłowego logu ani sekwencji poleceń.** Użytkownik analizuje dostępne pliki, potwierdza ślad w oryginalnym dzienniku i dopiero potem zabezpiecza pełną kopię dowodową.

Pod kartą zadania pojawiają się dwa proste kamienie milowe: znalezienie śladu oraz zachowanie pełnej kopii bez zmiany oryginalnych danych. System sprawdza oba skutki na podstawie zdarzeń i wirtualnego stanu, a także kolejność operacji. Kopiowanie przypadkowego pliku, skopiowanie danych przed analizą albo usunięcie oryginału nie oznacza zaliczenia. W niezależnym sprawdzianie niecelne operacje `cp` liczą się jako błędne próby; poprawne polecenia rozpoznawcze nie są karane.

To ćwiczenie nie jest nowym poleceniem terminala. Łączna liczba ćwiczeń i wariantów transferu to **22 + 22**, z czego 21 dotyczy pojedynczych komend/technik. Nadal jest 16 osobnych Misji CTF i 20 wariantów Powtórek. Zachowane są dotychczasowe klucze localStorage i poprzednie zaliczenia. Testy na prawdziwym telefonie i PWA offline pozostają do wykonania.

## Dokumentacja w terminalu (1.0 RC.14)

Dodano **`man POLECENIE`** oraz **`man -k HASLO`**. Są to krótkie, dostępne offline strony podręcznika dla zaimplementowanych poleceń. W odróżnieniu od pełnego Linuksa nie otwierają zewnętrznego programu `less` i nie obiecują obsługi wszystkich flag GNU — opisują rzeczywisty zakres symulatora.

Akademia ma teraz **23 ćwiczenia i 23 sprawdziany**: 22 lekcje techniczne (w tym `man`) oraz jedno wieloetapowe śledztwo. W lekcji `man` użytkownik musi **najpierw przeczytać dokumentację `grep`**, a następnie samodzielnie wykorzystać poznaną opcję, aby znaleźć wpis mimo różnic w wielkości liter. Sprawdzian wykorzystuje dokumentację innej komendy, `head`, oraz inny plik. Samo otwarcie `man` nie zalicza zadania.

Bez nowych kont, backendu czy infrastruktury; zachowano dane poprzednich ćwiczeń i klucze localStorage. Fizyczne QA telefonu i PWA offline nadal są do wykonania.

## Użytkownicy i grupy Linux (1.0 RC.15)

CTF Master zawiera teraz **24 lekcje i 24 sprawdziany** (23 tematy techniczne i jedno śledztwo). Nowy rozdział Akademii uczy różnicy pomiędzy **UID** użytkownika, **GID** jego grupy podstawowej oraz grupami dodatkowymi, z użyciem `id`, `id -u`, `id -g`, `id -G`, `id -gn`, `id -Gn`, `groups` i `whoami`. Przykładowa sesja używa konta `player`, a sprawdzian osobnej tożsamości `analyst` — wynik nie zależy wyłącznie od zapamiętanego numeru.

W obu wariantach trzeba wykonać **dwa celowe odczyty** i porównać podstawową grupę z pełną listą. Wyniki poleceń są generowane z wirtualnego modelu konta; nie są wykonywane na prawdziwym systemie, nie tworzą kont i nie przełączają użytkowników. `man id` i `man groups` opisują tylko obsługiwany podzbiór opcji.

**Uaktualnienie RC.16:** członkostwo w grupach wpływa już na odczyt plików. Dla każdego obiektu stosowana jest jedna klasa rwx: właściciel, grupa albo pozostali. Wejście do katalogu wymaga `x`. Nadal nie ma `chown`, ACL, pełnej obsługi POSIX ani `sudo`. Stare sesje bez pola `identity` nadal przyjmują domyślną tożsamość `player`, a stare postępy pozostają zachowane.

Ręczne QA na fizycznym telefonie i PWA offline nadal nie zostało wykonane.

## Własność i grupowy dostęp do plików (1.0 RC.16)

Dodano 25. ćwiczenie Akademii (i osobny sprawdzian) dotyczące **uprawnień właściciela, grupy i pozostałych**. Dwa pliki o trybie `640` są inaczej dostępne zależnie od UID/GID. Użytkownik bada `id -G`, `stat` / `ls -l` i rzeczywisty wynik `cat`. W drugim wariancie działa jako `analyst` z innym zestawem grup i logami.

Symulator sprawdza prawa `rwx` względem właściciela albo jednej pasującej grupy albo pozostałych — **bez łączenia uprawnień z kilku klas**. Odczyt wymaga również prawa przejścia `x` we wszystkich katalogach nadrzędnych. Dotyczy to m.in. `cat`, `grep`, `head`, `tail`, `wc`, `sort`, `uniq` i odczytu wejścia potoku. `ls`/ `find`, `cd`, `mkdir`, `touch`, `cp`, `mv`, `rm` sprawdzają odpowiednie uprawnienia w uproszczonym modelu. `chmod` obsługuje własne pliki **i katalogi**, a `stat` oraz `ls -l` pokazują ich faktycznego właściciela i grupę. Nowe pliki zachowują właściciela; `cp` tworzy plik z bieżącym UID/GID, a `mv` przenosi metadane.

To nadal **symulacja edukacyjna**, nie pełna kontrola dostępu POSIX. Nie ma `chown`, `sudo`, ACL, bitów specjalnych, zmiany konta w terminalu ani prawdziwego wykonania poleceń. Stare sesje bez metadanych własności domyślnie traktują pliki jako należące do `player`; dotychczasowe klucze postępu nie są zmieniane. Testy na fizycznym telefonie i offline PWA pozostają do wykonania.

## Diagnozowanie błędów dostępu - RC.17

Dodano **26. ćwiczenie Akademii** oraz samodzielny sprawdzian: `namei -l SCIEZKA` pokazuje prawa właściciela, grupy i pozostałych dla kolejnych elementów ścieżki, aż do pierwszego katalogu bez skutecznego prawa `x`. Symulator nie pokazuje wówczas metadanych niedostępnych elementów potomnych. `namei` działa tylko na wirtualnych plikach, bez wykonywania systemowych poleceń.

Wprowadzenie: plik `~/practice/diagnostics/service.log` ma prawo odczytu, ale jego katalog nie pozwala na przejście. Uczeń najpierw stawia diagnozę przez `namei -l`, potem przywraca tylko `x` właścicielowi i potwierdza odczyt; zaliczenie wymaga zachowania trybu `700`, a nie otwarcia `777`. Sprawdzian przenosi ten mechanizm na inną głębokość katalogów i inny plik.

Obsługiwane są `man namei`, kontekstowe wyjaśnienia błędów i zwykłe komendy `chmod`/`cat`. Przy okazji skorygowano feedback poprawnych wyników `id`. Łącznie **26 lekcji, 26 transferów, 16 misji i 20 wariantów powtórek**. Dotychczasowe klucze localStorage i ukończone ćwiczenia pozostają zachowane. Ręczne testy Android oraz PWA offline pozostają niewykonane.

## Domyślne uprawnienia — umask (RC.18)

Dostępne jest `umask` (odczyt bieżącej maski) i `umask NNN` (ustawienie wirtualnej maski sesji). **Nowe pliki** utworzone przez `touch` i `cp` otrzymują tryb `0666 & ~umask`, a **nowe katalogi** `0777 & ~umask`. Ustawienie nie zmienia istniejących plików, katalogów ani uprawnień hosta. Domyślna maska `022` zachowuje wcześniejsze działanie, czyli `644` dla nowych plików i `755` dla katalogów.

**27. ćwiczenie Akademii**: zastosuj `umask 077` i utwórz nowy plik o prawach `600` oraz katalog `700`. **27. sprawdzian**: na innych nazwach ustaw maskę skutkującą uprawnieniami `640` i `750`. Walidacja wymaga rzeczywistego utworzenia obiektów po zmianie maski; `chmod` wykonany po utworzeniu nie zastępuje rozwiązania. `man umask` działa offline.

Wersja RC.18 utrzymuje 16 misji, 20 wariantów powtórek oraz wcześniejsze zapisy postępów. Starsze sesje bez pola `umask` nadal korzystają z domyślnej maski `022`. Fizyczne testy telefonu/PWA offline pozostają PENDING.

## RC.19 - zmiana grupy właścicielskiej pliku (`chgrp`)

Wirtualne polecenie `chgrp GRUPA PLIK` pozwala właścicielowi pliku zmienić jego grupę na jedną z grup bieżącego użytkownika. Działa także na katalogach. Nie zmienia właściciela (UID), treści ani uprawnień `rwx`. Odmawia zmiany cudzych plików, niedostępnych ścieżek oraz nadania grupy, do której użytkownik nie należy. Nie ma `sudo`, `chown`, `-R` ani modyfikowania rzeczywistych obiektów systemowych.

**28. lekcja**: przenieś istniejący raport o prawach `640` z grupy `player` do `operators`, a następnie odczytaj nowe metadane przez `stat` lub `ls -l`. **28. sprawdzian**: wykonaj analogiczne zadanie jako `analyst`, tym razem w grupie `audit` i na innym pliku. Zaliczenie wymaga poprawnego skutku i późniejszego odczytu metadanych, nie tylko wpisania polecenia. Sprawdzian rozróżnia poprawne poszukiwania od błędnej zmiany grupy.

Utrzymano **28 lekcji i 28 sprawdzianów, 16 misji, 20 wariantów powtórek**, dotychczasowe klucze localStorage i zgodność ze starszymi sesjami. Realne QA na telefonie i offline PWA nadal pozostaje do wykonania.

## RC.20 - bezpieczne przekierowania standardowego wyjścia

Polecenia odczytujące w wirtualnym terminalu można teraz zakończyć `> PLIK` (utworzenie/nadpisanie) lub `>> PLIK` (utworzenie/dopisanie). Obsługiwane są wyniki filtrowania logów i ograniczonych potoków, np. `grep WARN ~/practice/alerts.log > ~/practice/alerts-summary.log`. Błąd źródła albo brak praw zapisu nie zmienia pliku. Dla nowego pliku obowiązuje umask, dla istniejącego potrzebne jest prawo zapisu; odczyt źródła do tego samego pliku jest świadomie odrzucany, aby nie tracić danych ćwiczeń.

Nowa **29. lekcja i niezależny sprawdzian** uczą kolejno nadpisania, dopisania i odczytu wyniku. Nie ma wykonywania powłoki hosta, stdin, stderr, rozwinięć Basha, wielu przekierowań ani separatorów poleceń. Stan sesji i klucze postępów nie zmieniły formatu. Fizyczne QA telefonu/PWA offline nadal PENDING.


## RC.21 - cytowanie argumentów i spacje w nazwach plików

Wspólny lexer obsługuje spacje wewnątrz apostrofów i cudzysłowów, znak backslash przed spacją lub operatorem poza cytowaniem oraz łączenie fragmentów cytowanych i zwykłych. Znaki |, > i >> mają znaczenie tylko poza cudzysłowami i kiedy nie są poprzedzone backslashem.

**30. lekcja:** przenieś raport o nazwie zawierającej spację i potwierdź zawartość przez cat. Niezależny sprawdzian przenosi inny plik z podkatalogu logs, również o nazwie ze spacjami. Dokumentacja man quoting opisuje ten ograniczony podzbiór.

To nadal **nie jest pełny Bash**. Nie ma podstawiania zmiennych, podpowłok, globbingu powłoki, skryptów, wykonywania hosta ani pełnej semantyki escape w cudzysłowach. Symulator zachowuje dotychczasowe rozwijanie ~/ do wirtualnego katalogu domowego także wewnątrz cudzysłowów. Fizyczne QA telefonu oraz offline PWA nadal **PENDING**.


## RC.22 - status zakończenia ostatniego polecenia

Każda zakończona komenda wirtualnego terminala zapisuje swój kod wyjścia w sesji. Wspierane `echo $?` pokazuje poprzedni status, a samo kończy się kodem `0`. Obsługiwany podzbiór: `0` sukces, `1` brak dopasowania `grep` albo inny błąd wykonania, `2` błąd składni lub argumentów `grep`, `127` nieznana komenda. Wywołanie `echo $?` jest ograniczone do dokładnie tej formy (bez cytowania); inne ekspansje, pełny `echo`, `pipefail` i skrypty nie są obsługiwane.

**31. lekcja i sprawdzian**: porównanie nieudanego `grep` i udanego `grep`, z odczytaniem statusu po każdym poleceniu. W sprawdzianie celowy brak dopasowania nie obniża oceny samodzielności. Stare sesje bez `lastExitCode` są czytane z domyślnym kodem `0`; inne dane i klucze localStorage bez zmian. Realne QA PWA na telefonie nadal PENDING.


## RC.23 - warunki plików przez test

Komenda `test` oraz równoważna forma `[ ... ]` sprawdzają wirtualne pliki i katalogi bez wypisywania wyniku: `-e` istnienie, `-f` zwykły plik, `-d` katalog, `-r` odczyt, `-w` zapis, `-x` wykonanie/przejście. Każdy test uwzględnia brak prawa przejścia przez katalogi nadrzędne. `echo $?` pokazuje wynik: `0` dla spełnionego warunku, `1` dla niespełnionego, `2` dla niepoprawnej składni. Komendy są wyłącznie symulowane, bez wywołań systemu gospodarza.

**32. lekcja** porównuje istnienie pliku `locked.log` z brakiem prawa odczytu. **32. niezależny sprawdzian** bada niedostępny log pod katalogiem bez `x`, wymaga diagnozy `test -x` i minimalnej poprawki praw przed powtórnym odczytem statusu. Automatyczne testy sprawdzają też, że fałszywy warunek nie jest pomyłką ucznia. Nie zmieniono kluczy postępów. Fizyczne QA telefonu i działania offline PWA nadal PENDING.


## RC.24 - warunkowe wykonanie komend (`&&`, `||`)

Nowy, ograniczony interpreter łączy do pięciu komend w jednym łańcuchu. `A && B` wykona B tylko, gdy A zakończyło się kodem `0`, a `A || B` uruchomi B wyłącznie po niezerowym statusie A. Operatory mają ten sam priorytet i są łączone od lewej do prawej. Pominięty fragment nie modyfikuje ani plików, ani statusu, a `echo $?` działa również wewnątrz łańcucha. Można łączyć istniejące bezpieczne potoki oraz przekierowania.

**33. lekcja i niezależny sprawdzian** wymagają rzeczywistej kopii pod warunkiem istnienia źródła, pominięcia operacji na nieistniejącym pliku oraz wykonania działania awaryjnego po niepowodzeniu. Zaliczenie uwzględnia faktycznie wykonane/pominięte polecenia, kolejność oraz stan wirtualnych plików, a nie samo wpisanie tekstu.

Nie ma wykonywania systemowej powłoki, `eval`, separatorów `;`, `&`, skryptów, podstawień, ani nieograniczonych łańcuchów. Wersja RC.24 nie zmienia kluczy localStorage. Fizyczne QA telefonu i PWA offline pozostaje **PENDING**.


## RC.25 - misja 17: korelacja incydentu SOC

Nowy, finałowy rozdział **SOC: pełne śledztwo** obejmuje scenariusz INC-017 na istniejących wirtualnych logach `/var/log/app.log` i `/var/log/auth.log`. Uczeń sam lokalizuje i potwierdza dwa niezależne ślady, wykonuje dwie kopie pełnych plików dopiero po `test -f` z `&&`, a następnie tworzy dwuwierszowy raport przez `grep` z `>` i `>>`, odczytując go na końcu. Zaliczenie wymaga oryginalnych logów i praw bez zmian, pełnych kopii, prawidłowych danych w raporcie i autentycznej sekwencji wykonanych kroków w wirtualnym terminalu.

Karta misji pokazuje cztery etapy (śledztwo, kopie, korelacja, odczyt) bez zdradzania rozwiązań. Misja jest **dopisana jako 17.**, bez przesuwania poprzednich numerów, bez nowych pól lokalnej sesji i bez wymagania ponownego przejścia wcześniej zaliczonych misji. Wszystkie dane pozostają symulowane. Rozbudowa nie dowodzi rzeczywistej pracy PWA na telefonie: **manual mobile QA nadal PENDING**.


## RC.26 - misja 18: hipotezy pod niepewnością

Po INC-017 nowa misja **INC-018** wymaga samodzielnej oceny **trzech konkurencyjnych wyjaśnień** błędów HTTP 502: zdarzenia uwierzytelniania, kłopotu z zasobami hosta albo wyczerpania puli połączeń z bazą. W katalogu `~/documents/cases` pojawia się pięć wirtualnych logów `case18-*.log` dotyczących aplikacji, logowania, bazy, wdrożenia i zdrowia serwera. Nie wszystkie zdarzenia, które wystąpiły w tym samym czasie, muszą być przyczyną problemu.

Przez `man hypothesis` poznasz trzy dopuszczalne identyfikatory oraz składnię `hypothesis <ID> <low|medium|high>`. Wypowiedzenie hipotezy bez uprzedniego zbadania wszystkich pięciu źródeł nie zalicza zadania. Po ocenie należy zabezpieczyć dwa pełne źródła najważniejszych dowodów, przygotować dwuwierszowy raport przez `grep`, `>`, `>>` i przeczytać go `cat`. Ocena sprawdza wcześniejsze odczyty, hipotezę, autentyczne kopie, nienaruszone oryginały, kolejność raportu i jego weryfikację. Poziom pewności jest zapisywany, ale nie udaje gwarancji przyczynowości.

Misja jest **dopisana jako 18.**, a 17 wcześniejszych zachowuje numery. Nowe wirtualne logi są dodawane dopiero przy wejściu do misji lub odtworzeniu jej aktywnej sesji, bez nadpisywania istniejących plików i bez zmiany kluczy zapisu. Uruchomienie komendy `hypothesis` **nie wykonuje poleceń na komputerze**. Rzeczywiste QA telefonu i PWA offline nadal **PENDING**.


## RC.27 - misja 19: bezpieczna reakcja na incydent

Po INC-018 dostępna jest misja **INC-019: napraw przyczynę, nie objaw**. Przedmiotem śledztwa jest symulowane API, które zwraca HTTP 503 z powodu ograniczonej puli połączeń. Pliki `~/documents/cases/case19-api.conf` i `case19-api.safe.conf` przedstawiają odpowiednio bieżącą konfigurację (`POOL_LIMIT=1`) i ostatnią bezpieczną (`POOL_LIMIT=8`). Nowe pliki i opcjonalny stan działającej konfiguracji są inicjalizowane dopiero po wejściu do misji 19 albo odtworzeniu jej aktywnej sesji.

Należy zaobserwować błąd `curl -i http://api.ctf.test/health`, sprawdzić oba pliki `cat`, przywrócić stabilny wariant za pomocą `cp`, wykonać `systemctl restart api`, a następnie sprawdzić endpoint ponownie. **Kopia pliku sama nie zmienia konfiguracji załadowanej do procesu** - wymaga ponownego uruchomienia usługi. Sam restart bez zmiany konfiguracji także nie rozwiązuje problemu. Nie wolno naruszyć SSH, kolejki, uprawnień ani kopii bezpiecznej konfiguracji. Przy odpowiedzi HTTP 503 symulowany `curl` bez flagi `-f` nadal kończy się kodem powłoki `0`, co rozróżnia wynik programu od statusu HTTP.

Przed uruchomieniem: to **zamknięty wirtualny endpoint**, nie realne żądanie sieciowe. Podzbiór `curl` obsługuje wyłącznie `-i http://api.ctf.test/health`. Wymagany jest ślad kolejnych działań w terminalu, nie sam końcowy stan plików. Poprzednie misje i klucze localStorage pozostają bez zmian; fizyczne testy telefonu i PWA offline nadal **PENDING**.


## RC.28 - misja 20: reagowanie i naprawianie skutków interwencji

**INC-020: napraw po błędnej interwencji** symuluje awarię kolejki po wdrożeniu. Wirtualne SSH i API nadal działają. Użyj `curl -i http://ops.ctf.test/health`, `systemctl status queue` i `journalctl -u queue`, żeby wykryć przyczynę. Po naprawie kolejki sprawdź ponownie HTTP i potwierdź aktywność zarówno kolejki, jak i SSH. Wariant bezpieczny nie wymaga zatrzymywania innych usług.

Błędne działania, np. zatrzymanie SSH czy niepotrzebny restart API, powodują widoczne konsekwencje. Możesz je odwrócić, lecz licznik **dodatkowych skutków interwencji** pozostaje w karcie misji (historia zdarzeń), żeby odróżnić naprawę bez zakłóceń od naprawy po dodatkowych błędach. Samo doprowadzenie do zdrowego stanu bez diagnostyki nie zalicza zadania. Symulowane `curl` może zakończyć się kodem wyjścia `0` przy HTTP 503 - sprawdzaj osobno kod HTTP i status usług.

To **nie jest prawdziwe HTTP ani systemd**. Żadne żądanie sieciowe nie jest wysyłane, a komendy nie wykonują się na systemie gospodarza. Nowy stan scenariusza jest opcjonalny, dodawany tylko po wejściu lub odtworzeniu misji 20; pierwszych 19 misji, ich indeksów i kluczy localStorage nie zmieniono. Fizyczne QA telefonu i PWA offline nadal **PENDING**.


## RC.29 - misja 21: samodzielna diagnostyka zgłoszenia

**INC-021** zaczyna się od krótkiego zgłoszenia o niedostępnym materiale audytowym. Użytkownik musi sam odnaleźć wskazówki w wirtualnym systemie, potwierdzić problem, rozpoznać granicę dostępu, zastosować zasadę najmniejszych uprawnień i zabezpieczyć zweryfikowaną kopię dowodową. W interfejsie tej misji celowo nie ma trzech podpowiedzi, coachingu po błędnych poleceniach ani wskazującego kolejne kroki panelu. Normalne polecenia terminala, takie jak help i man, pozostają dostępne.

Rozwiązanie oceniane jest na podstawie kolejnych działań i skutków, nie na podstawie wpisania jednej gotowej komendy. Nowe dane scenariusza są tworzone raz po wejściu do misji 21, bez nadpisywania plików użytkownika; późniejsze usunięcie nie powoduje automatycznego odtworzenia pliku. Poprzednie 20 misji zachowuje indeksy, dane postępów i klucze localStorage. **Fizyczne QA PWA na telefonie i offline nadal PENDING.**


## RC.30 - raport po misji i pytanie transferowe

Po **pierwszym zaliczeniu** dowolnej misji powstaje niewielki, lokalnie zapisany raport after-action. Pokazuje tylko ślady rzeczywiście zarejestrowane przez symulator: sprawdzone źródła i ich statusy, wykonane interwencje (w tym warunkowe), zadeklarowane hipotezy i poziomy pewności, znane skutki uboczne, liczby poleceń, kodów niezerowych i wykorzystanych podpowiedzi oraz fakt zaliczenia. Kody niezerowe nie są automatycznie określane jako pomyłki - np. fałszywy warunek `test` bywa oczekiwany. W szczególności RC.30 nie wymyśla brakujących hipotez ani zdarzeń, których gracz nie wykonał.

Raport zapisywany jest według identyfikatora misji **raz**, zanim historia terminala zostanie nadpisana przez następną misję; ponowne wejście do niej nie zmienia pierwotnej oceny. Nie zapisuje całych plików, wyjść komend ani zagnieżdżonych stanów w raporcie. Dla misji ukończonych przed RC.30, jeśli nie istnieje wiarygodny zapis pierwszego zaliczenia, aplikacja pokazuje komunikat o braku raportu zamiast sfabrykowanego podsumowania.

Pod raportem znajduje się krótkie, **nieoceniane pytanie transferowe** oraz pole na własną odpowiedź. Tekst do 600 znaków zapisuje się tylko w bieżącym lokalnym profilu przeglądarki; nie wpływa na odblokowania czy niezależność. UI jest mobilne, a `localStorage` nadal używa istniejącego klucza `ctf-master:mvp-08`, z opcjonalnymi polami raportów i refleksji. Liczby misji, lekcji i powtórek nie zmieniły się. Fizyczny test telefonu i offline PWA nadal **PENDING**.
