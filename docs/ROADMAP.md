# CTF Master - roadmap

## Guiding principles
- Zrozumienie mechanizmu jest wazniejsze niz pamieciowe poznanie polecen.
- Stopniowo wycofuj podpowiedzi; oceniaj samodzielnosc i transfer.
- Kazdy modul ma misje w nieznanej topologii i warunek zaliczenia oparty na skutku.
- Jasno odrozniaj symulacje od prawdziwego Linuksa.

## Etap 0 - Linux Explorer (teraz)
- [x] React + TS + PWA skeleton
- [x] Terminal symulowany i system plikow
- [x] Trzy misje z walidacja efektu
- [x] Trzy poziomy wskazowek
- [x] Zapis postepu
- [ ] Parser: cytowanie, potoki, przekierowania, status wyjscia
- [ ] Drag and drop polecen oraz warianty scenariuszy
- [x] Kontekstowy feedback i zapisane statystyki pomocy
- [x] Pierwsza misja transferowa
- [x] Pierwsze powtorki celowane: 10 umiejetnosci, 2 warianty kazda, osobne srodowisko
- [ ] Powtorki czasowe i przeglad wszystkich obszarow (m.in. uprawnienia)
- [x] Testy logiki symulatora
- [x] Kompaktowa mobilna nawigacja i historia polecen
- [x] Wersjonowanie cache PWA i testy mechanizmu offline
- [x] Mapa 5 rozdzialow z celami, komendami i postepem
- [x] Akademia 15 komend z niezaleznym terminalem i postepem
- [x] Samodzielny sprawdzian transferowy dla 15 komend i osobny status opanowania
- [x] Trener komend z rekomendacją na podstawie słabości i opanowania
- [x] Learning Workspace: lekcja obok terminala na desktopie, kompaktowa nawigacja i bezposredni feedback
- [x] Historia komend w Akademii (klawiatura i dotyk), mniej dublowanych przycisków i kontekstowy feedback
- [x] Kontekstowe wyjaśnienia ls/cd/grep: sukces, częściowy rezultat i błędy bez zdradzania odpowiedzi
- [x] Efekty find/cp/chmod: liczba ścieżek, kopiowanie, porównanie rwx przed i po komendzie
- [x] Ocena sprawdzianu uwzględniająca nietrafione poprawnie wykonane komendy; poprawione find . -name
- [x] Pięć komend tekstowych head/tail/wc/sort/uniq, osobne ćwiczenia i warianty transferowe
- [x] Ograniczone potoki do analizy logów: czytanie plików, grep/sort/uniq/wc, lekcja i transfer
- [x] Pierwsze samodzielne śledztwo: nieznany log, hipoteza ze śladów, potwierdzenie i zachowanie dowodu, drugi wariant
- [x] Podręcznik man i man -k w terminalu: dokumentacja przed zastosowaniem flagi, drugi wariant na nowej komendzie
- [x] Tożsamość UID/GID: grupy podstawowe i dodatkowe, zmienione konto w transferze, dokumentacja i feedback
- [x] Dostęp do plików wg właściciela/grupy/pozostałych, x katalogów i osobne ćwiczenie transferowe
- [x] namei -l: znajdowanie katalogu bez prawa x, naprawa z najmniejszym dostępem i niezależny wariant
- [x] umask: domyślne prawa plików i katalogów tworzone z maską, nauka i transfer
- [ ] Manual QA na fizycznym telefonie (1.0 RC.18)

## Etap 1 - Linux Administrator
- [x] Podstawy chmod, stat, tryby rwx i testy Permission denied
- [x] Podstawy UID/GID i grup dodatkowych: id, groups, whoami oraz odmienne tożsamości w sprawdzianie
- [x] Grupowe prawa plików i prawo przejścia x w katalogach
- [ ] chown, ACL i dokładniejsza semantyka praw POSIX
- [x] grep/find i pierwsze misje logow
- [x] Podstawowe procesy i uslugi: ps, kill, systemctl, journalctl
- [ ] Zaawansowana diagnostyka procesow i jednostek
- [x] Pierwsza diagnostyka awarii uslugi i procesow bez podanych komend
- [x] Podstawy IP, prefiksu, bramy, ping, ss i diagnozy portow
- [x] Pierwsze scenariusze DNS, ARP cache, diagnostyki TCP i trasy pakietu
- [x] Responsywny widok drogi pakietu oraz etapow diagnostyki oparty na stanie symulatora
- [ ] VLAN, ACL, tablica MAC przelacznika i pelniejsza symulacja TCP
- [ ] Zaawansowane scenariusze przyczynowe

## Etap 2 - CTF Rookie
- [ ] Ukryte pliki, encoding, archiwa, pliki binarne
- [ ] Misje Web, Forensics, OSINT, Crypto
- [ ] Zadania transferowe bez podpowiedzi

## Etap 3 - CTF Operator i Master
- [ ] Oddzielone, resetowalne prawdziwe srodowiska laboratoryjne (nie na serwerze aplikacji)
- [ ] Reverse engineering, binary exploitation, pwn, zlozone zadania
- [ ] Integracja z zewnetrznymi platformami i samodzielne write-ups
