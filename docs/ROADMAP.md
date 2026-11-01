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
- [ ] Parser: pełna semantyka powłoki nadal poza zakresem; [x] wspólny lexer cytowania, potoki, przekierowania, podstawowy status wyjścia echo $?
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
- [x] chgrp: zmiana grupy własnego pliku przy zachowaniu UID/rwx/treści, dwa ćwiczenia
- [x] Redirection: bezpieczne stdout > i >>, zachowanie praw plików, lekcja i niezależny sprawdzian
- [x] Quoting: spacje, apostrofy, cudzysłowy i backslash, spójne rozpoznawanie operatorów; lekcja i transfer
- [x] Exit status: 0/1/2/127, echo $?, zapis w sesji i natychmiastowa obserwacja, 31. lekcja i transfer
- [x] Test -e/-f/-d/-r/-w/-x oraz [ ... ]: warunki plików, odmowa przejścia przez katalog, status i niezależna diagnoza w transferze
- [x] && i ||: krótkie łańcuchy warunkowe, pomijanie poleceń, ślad działania, lekcja i niezależny sprawdzian
- [x] RC.36 - zmienne Bash: przypisania, $NAME, cytowanie, unset, praktyczna lekcja 34 i niezależny sprawdzian kopiowania dowodów
- [x] Misja 17 - korelacja dwóch logów SOC, warunkowe kopie, raport > i >> oraz odczyt dowodów; szósty rozdział końcowy
- [x] Misja 18 - konkurencyjne hipotezy, fałszywe tropy, poziom pewności, analiza pięciu źródeł, zabezpieczenie i weryfikacja raportu
- [x] Misja 19 - bezpieczna reakcja: diagnoza HTTP 503, porównanie konfiguracji, rollback, restart zastosowujący zmianę i weryfikacja zdrowia innych usług
- [x] Misja 20 - awaria kolejki, odwracalne skutki interwencji, trwała historia błędnych decyzji oraz ponowna weryfikacja SSH i dostępności
- [x] Misja 21 - diagnostyka bez podpowiedzi: analiza zgłoszenia, odmowa dostępu, naprawa z zasadą least privilege i sprawdzony dowód
- [x] RC.30 - zapisany przy pierwszym zaliczeniu raport dowodów, decyzji i konsekwencji oraz nieoceniane pytanie transferowe
- [x] RC.31 - samodzielna misja 22, inny mechanizm odmowy odczytu (plik, nie katalog), weryfikacja dowodów i minimalnej naprawy
- [x] RC.32 - osobny, izolowany realny lab Linux w Codespaces: błędne uprawnienia, diagnoza, integralność SHA-256 i bezpieczny weryfikator wyniku
- [ ] Użytkownik uruchomi REAL-01 samodzielnie i wyjaśni mechanizm naprawy (nie potwierdzają tego testy CI)
- [x] RC.33 - wygenerowanie testowego Android APK z lokalnie osadzonymi zasobami i artefaktem GitHub Actions
- [ ] Test APK na fizycznym telefonie: instalacja, klawiatura, lokalne dane, tryb samolotowy
- [ ] Stałe podpisywanie wydania i eksport/import postępów między PWA i APK
- [ ] Manual QA na fizycznym telefonie (1.0 RC.33)

## Etap 1 - Linux Administrator
- [x] Podstawy chmod, stat, tryby rwx i testy Permission denied
- [x] Podstawy UID/GID i grup dodatkowych: id, groups, whoami oraz odmienne tożsamości w sprawdzianie
- [x] Grupowe prawa plików i prawo przejścia x w katalogach
- [x] chgrp na własnych plikach i katalogach
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

- [x] RC.35 - lokalny eksport/import zaliczeń, Akademii, powtórek i raportów przez bezpieczny, wersjonowany JSON z niekasującym importem
- [ ] QA Android WebView: kopiuj/wklej pełny kod na fizycznym telefonie oraz przywróć przed odinstalowaniem APK
- [ ] Stałe podpisywanie Android release i osobny test aktualizacji bez utraty danych


- [x] RC.37 - ograniczona pętla for do wielu plików, ślad iteracji, 35. lekcja i niezależny sprawdzian z potwierdzeniem kopii
- [ ] Kolejny etap - kontrolowane, wirtualne skrypty Bash; nadal bez host shell

- [x] RC.38 - Bash Workshop mobilny: jedno zadanie, edytor do czterech linii, jeden przycisk, inline feedback oraz zwijany ślad wykonania
- [x] Ograniczony interpreter z walidacją całego skryptu przed wykonaniem, świeży wirtualny stan na każdą próbę
- [ ] Fizyczny test mobilnego edytora, klawiatury i przewijania warsztatu; bez budowania kolejnych wieloetapowych misji przed QA

- [x] RC.39 - zwarty pasek znaków Bash w mobilnym edytorze, wstawianie pod kursorem, zastępowanie zaznaczenia i wstawianie nowej linii
- [ ] RC.39 QA: telefon Android, otwarta klawiatura, fokus, zaznaczenie, gest przewijania i przepełnienie 700 znaków
- [ ] Dalsze scenariusze Bash dopiero po ocenie ergonomii pierwszego ekranu

- [x] RC.40 - wskazanie pierwszej błędnej linii w mobilnym Bash Workshop i szybki powrót do jej edycji, bez dodatkowych ekranów
- [x] Mapowanie numerów linii z uwzględnieniem pustych wierszy i CRLF, testy błędów składni, wykonania oraz walidacji
- [ ] QA na fizycznym Androidzie: czy przycisk Popraw linię N poprawnie ustawia zaznaczenie i widoczność przy otwartej klawiaturze

- [x] RC.41 - Cofnij w mobilnym edytorze Bash: 20 punktów historii, grupowanie szybkiego pisania, cofanie znaków i resetu szablonu
- [x] Workflow Android APK tylko ręczny podczas rozwoju w repozytorium
- [ ] Fizyczna próba cofania po zaznaczeniu, pisaniu i klikaniu skrótów na klawiaturze Androida

- [x] RC.42 - drugi krótki scenariusz Bash na tym samym ekranie, analiza poprawnego kodu wyjścia 1 po test -f oraz echo $? i osobne szkice zadań
- [ ] Fizyczne QA: wybór zadania przy otwartej klawiaturze, powrót do szkiców, wynik i brak nadmiernego przewijania

- [x] RC.43 - trzeci krótki scenariusz Bash: odróżnienie istnienia pliku (`test -f`) od prawa odczytu (`test -r`), poprawny kod zakończenia 1 i niezależny szkic
- [ ] Fizyczny test mobilnego menu trzech zadań i działania edytora przy otwartej klawiaturze Androida

- [x] RC.44 - czwarty kompaktowy scenariusz Bash: rzeczywisty fallback przez `||` po brakującym logu, końcowy kod 0 i własny szkic.
- [ ] RC.44 fizyczne QA telefonu, wyboru zadania i edytora podczas otwartej klawiatury.

- [x] RC.45 - zwijany ślad Bash pokazuje wykonane/pominięte testy oraz przyczynę short-circuit dla && i ||, bez dodatkowego ekranu.
- [ ] RC.45 QA czytelności zwijanego śladu na telefonie.

- [x] RC.46 - dobrowolna prognoza kodu 0/1 przed uruchomieniem Bash; porównanie z rzeczywistym echo $?, bez fałszywej oceny, gdy brak odczytu.
- [ ] RC.46 fizyczne QA mobilnego układu przewidywanie + Uruchom oraz zmiany przewidywania po wykonaniu.

- [x] RC.47 - piąta pozycja w tym samym menu: samodzielny transfer Bash, nowe pliki audit-daily.log / alerts.log, pusty edytor, ocena wykonania i osobny szkic.
- [ ] RC.47 sprawdzić na telefonie menu 5 pozycji, klawiaturę i brak dodatkowego przewijania; fizyczny Android QA pending.

- [x] RC.48 - diagnoza błędnego prawa x katalogu, mimo istnienia pliku; test -r i namei -l w tym samym mobilnym edytorze oraz realny ślad blockedAt.
- [ ] RC.48 fizyczne QA Android: 06 · Katalog, klawiatura, zwijany ślad i brak dodatkowych ekranów.


- [x] RC.49 - nowy krótki etap 07 · Naprawa w mobilnym Bash: namei -> minimalne chmod owner-x 600->700 -> weryfikacja cat; ocena rzeczywistej zmiany i brak innych skutków.
- [ ] RC.49 QA na telefonie: siedem opcji menu, edytor przy klawiaturze, Cofnij, zwijany przebieg i scroll.
