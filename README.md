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
- Trzy tryby: **Komendy** (22 lekcje techniczne + 1 dochodzenie, 23 sprawdziany), **Misje** (16 scenariuszy), **Powtórki** (20 wariantów). Akademia komend korzysta z odrębnego symulatora i postępu.
- Zwinięta domyślnie **Mapa nauki** z 5 rozdziałami: cele, komendy, licznik postępu, przejście do pierwszej dostępnej misji.
- Symulowany terminal: `pwd`, `ls` (`-a`, `-l`), `cd`, `cat`, `mkdir`, `touch`, `cp`, `mv`, `rm`, `grep [-i]`, `find [-name]`, `man POLECENIE`, `man -k HASLO`, `head`, `tail`, `wc`, `sort`, `uniq`, `chmod`, `stat`, `ps`, `kill`, `systemctl`, `journalctl`, `ip`, `ping`, `ss`, `resolvectl`, `nslookup`, `nc -z`, `trace`, `whoami`, `help`, `clear`.
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

Zobacz [docs/ROADMAP.md](docs/ROADMAP.md). Dalszy kierunek: coraz lepszy symulator Linuksa, dokumentacja komend, uprawnienia, usługi, diagnostyka i praktyczne zadania. `grep` szuka dosłownego tekstu; `find` obsługuje `-name` z `*` i `?`, a `rm` usuwa tylko pliki. Dostępne są ograniczone potoki tekstowe, bez przekierowań. Ocena samodzielnosci dotyczy pierwszego zaliczenia misji (brak blednych komend, help i odkrytych podpowiedzi); powtorki sa prowadzone w osobnych sesjach. Nie wykonujemy prawdziwych polecen uzytkownika na backendzie.

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
