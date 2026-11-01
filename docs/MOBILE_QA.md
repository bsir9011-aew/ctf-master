# CTF Master 1.0 RC — manual mobile QA

## RC.33 - instalowalny testowy Android APK

- [ ] Pobierz APK z zielonego przebiegu Actions → Android APK (debug) na main, rozpakuj ZIP i zainstaluj na urządzeniu.
- [ ] Wykonaj komendy `pwd`, `ls`, wpisz ścieżkę ze spacją; sprawdź dotyk, klawiaturę i przewijanie.
- [ ] Zamknij i otwórz aplikację - upewnij się, że zapisane w APK postępy pozostały.
- [ ] Włącz tryb samolotowy i uruchom ponownie APK; zasoby i misje powinny działać bez internetu.
- [ ] Sprawdź Android Back, obrót ekranu, wyświetlanie klawiatury i nawigację po lekcjach.
- [ ] Pamiętaj, że postępy z przeglądarki PWA nie są automatycznie przeniesione do nowego WebView. Kolejne debug APK mogą wymagać odinstalowania poprzedniego z powodu nowego klucza.
- [ ] Status: QA na fizycznym urządzeniu PENDING, do potwierdzenia przez użytkownika.


Ten zestaw jest do wykonania na **prawdziwym telefonie**. Zielony CI nie potwierdza działania klawiatury ekranowej ani instalacji PWA.

## Jak uruchomić build produkcyjny (Codespaces)

1. Otwórz Codespace na gałęzi `feat/mobile-readiness-10`.
2. W terminalu uruchom:
   ```bash
   npm install
   npm test
   npm run build
   npm run preview -- --host 0.0.0.0
   ```
3. W zakładce **Ports** otwórz port **4173**, skopiuj HTTPS URL podglądu. Upewnij się, że dostęp do portu jest skonfigurowany tak, by można było otworzyć URL na własnym telefonie.
4. Na telefonie otwórz HTTPS URL w Chrome (Android) lub innej wspieranej przeglądarce. Tryb `npm run dev` na porcie 5173 **nie** rejestruje produkcyjnego service workera, więc nie testuj offline na porcie 5173.

## Krótki scenariusz manualny

- [ ] **Mały ekran (ok. 320–390 px):** brak poziomego przewijania strony. Na górze misji jest lista rozwijana, nie 16 dużych kafli.
- [ ] **Wybór misji:** ukończ pierwszą, wybierz ją ponownie, sprawdź zachowany status ukończenia; nieodblokowane pozycje pozostają niedostępne.
- [ ] **Klawiatura ekranowa:** dotknij pola terminala, wpisz `pwd` i `ls`; pole tekstowe, przyciski i wyniki pozostają widoczne i dają się przewijać.
- [ ] **Historia poleceń:** naciśnij strzałkę ↑, sprawdź poprzednie polecenie; ↓ przywraca niezapisany szkic polecenia. Na komputerze działają również klawisze strzałek w polu wejścia.
- [ ] **Przewijanie:** po poleceniach generujących długi wynik przewija się historia **w obrębie terminala**, nie cała strona do jego środka.
- [ ] **Powtórki:** otwórz odblokowaną powtórkę, wróć do misji, następnie powróć do powtórki; jej osobny stan ma zostać zachowany.
- [ ] **Schemat sieci:** w późniejszej misji nawiguj po widoku komputer → switch → router → serwer i rozwiń szczegóły; treść mieści się na ekranie.
- [ ] **Zapis:** odśwież stronę i sprawdź, czy ukończone misje i pliki wirtualne pozostały.
- [ ] **PWA offline:** po wejściu do podglądu produkcyjnego i pełnym załadowaniu strony zainstaluj PWA, uruchom je online, następnie włącz tryb samolotowy, uruchom ponownie i sprawdź wykonywanie `pwd` oraz `ls`.
- [ ] **PWA aktualizacja:** po wdrożeniu kolejnego buildu, przy aktywnym internecie zamknij i ponownie otwórz aplikację. Sprawdź nową wersję bez utraty postępu.

## Zgłaszanie błędów

Podaj: model telefonu, Android/iOS, przeglądarkę, szerokość/orientację ekranu, który krok nie przeszedł i oczekiwane/zauważone zachowanie. Nie potrzebujemy masowych screenshotów.

**Status:** MANUAL QA PENDING. Nie traktuj wersji 1.0 RC jako przetestowanego wydania mobilnego wyłącznie na podstawie zielonego CI.

## Learning Workspace 1.0 RC.6 — dodatkowa kontrola

- [ ] **Desktop (ok. 1280 px):** lekcja i terminal stoja obok siebie; naglowek jest krotki, podpowiedz i reset sa przy lekcji, a wynik pod terminalem.
- [ ] **Mobile (320–390 px):** lekcja i terminal sa jeden pod drugim, bez poziomego przewijania; klawiatura ekranowa nie zakrywa przycisku wykonania.
- [ ] Po wpisaniu `pwd` informacja o zaliczeniu pojawia sie bezposrednio pod terminalem z przyciskiem do samodzielnego sprawdzianu.
- [ ] Po ponownym otwarciu wczesniej zaliczonej komendy mozna uruchomic sprawdzian bez koniecznosci powtarzania wstepnego zadania.
- [ ] Sekcja rekomendacji nie duplikuje otwartej lekcji, jesli sugeruje dokladnie to samo cwiczenie.
- [ ] Naglowek pokazuje faktyczna wersje pakietu: 1.0.0-rc.7. Odwiedz Misje i Powtorki — ich interfejsy i postepy musza byc niezmienione.

## Learning Workspace 1.0 RC.7 — historia i usuwanie duplikatów

- [ ] W Akademii wpisz np. `pwd`, wybierz inne ćwiczenie albo zresetuj obecne, wykonaj kilka komend. Przyciski **↑/↓** oraz klawiatura fizyczna odtwarzają historię tylko bieżącego ćwiczenia.
- [ ] Zacznij wpisywać niedokończony tekst, naciśnij ↑, potem ↓. Tekst powinien zostać przywrócony bez wykonania komendy.
- [ ] Po zaliczeniu ćwiczenia `pwd` na karcie pozostaje jeden dostępny przycisk „Sprawdź samodzielnie”; górna rekomendacja nie powiela go.
- [ ] Gdy wpiszesz błędną ścieżkę, zobaczysz kontekstową informację zwrotną w panelu pod terminalem. Nie zdradza gotowej odpowiedzi do sprawdzianu.
- [ ] Sprawdź wąski ekran 320–390 px — dwa przyciski historii nie zasłaniają pola wprowadzania i przycisku „Wykonaj”.
- [ ] Header pokazuje 1.0.0-rc.8, a po ponownym uruchomieniu zachowane są wcześniejsze wyniki ćwiczeń, misji i powtórek.

## RC.8 — test krótkiej pętli uczenia

- [ ] W ćwiczeniu `ls` wpisz `ls ~/documents`: komenda działa, ale zadanie nie jest zaliczone. Następnie spróbuj nieistniejącej ścieżki i sprawdź inne wyjaśnienie.
- [ ] W `cd` spróbuj wejść do istniejącego pliku, a potem do nieistniejącego katalogu. Zwróć uwagę na rozróżnienie obu błędów.
- [ ] W `grep` wpisz wzorzec z niewłaściwą wielkością liter, potem użyj `-i`; sprawdź, czy wyjaśnienia pomagają zrozumieć różnicę.
- [ ] W drugim wariancie sprawdzianu informacja zwrotna nie może zdradzać nazwy docelowego pliku ani pełnej komendy.
- [ ] Przełącz na Misje/Powtórki i odśwież — dane pozostają zachowane. Nagłówek powinien wskazywać RC.8.

## RC.9 — rozumienie skutków find / cp / chmod

- [ ] W Akademii `find`: wyszukaj istniejące pliki, potem użyj niepasującego wzorca i nieistniejącego katalogu. Sprawdź różnicę między pustym wynikiem a błędem.
- [ ] W `cp`: skopiuj plik pod nową nazwą, później nadpisz istniejący plik. Feedback ma opisać różne skutki, nawet jeśli cel lekcji nie został zaliczony.
- [ ] W `chmod`: porównaj `chmod 640` i `chmod 600` na tym samym pliku po resecie zadania. Wyjaśnienie powinno pokazać prawa przed i po.
- [ ] W sprawdzianach transferowych: feedback nie może zdradzać nazwy docelowego pliku ani gotowej komendy.
- [ ] Wróć do Misji/Powtórek i odśwież aplikację — postępy nie mogą się zmienić. W nagłówku wersja RC.9.

## RC.10 — weryfikacja rzetelności oceny

- [ ] Zaliczenie intro `chmod`, potem sprawdzian: wykonaj `chmod 640 ~/practice/team.key` (poprawna komenda, niecelny wynik), następnie `chmod 600 ~/practice/team.key`. Cel osiągnięty, ale status **opanowane** nie powinien zostać przyznany. Po resecie i jednym `chmod 600` — przyznany.
- [ ] W sprawdzianie `ls` użyj `ls ~/documents`, a następnie poprawnej ścieżki. Pierwsza komenda ma być policzona jako nietrafiona próba. Wywołanie pomocniczego `pwd` nie powinno być karane.
- [ ] W lekcji `find`: `find / -name "ticket-*.txt"` pokazuje wynik, ale nie zalicza wymaganego przeszukania `~/practice`. `find ~/practice -name "ticket-*.txt"` zalicza.
- [ ] Po `cd ~/practice` sprawdź `find . -name "ticket-*.txt"` — polecenie ma działać bez błędu składni.
- [ ] Odśwież. Wcześniejsze ukończone lekcje i misje zachowują swoje dotychczasowe zaliczenia; wersja powinna wskazywać RC.10.

## RC.11 — nowe ćwiczenia z logów i plików

- [ ] W Akademii odszukaj `head`, `tail`, `wc`, `sort`, `uniq`; licznik powinien wskazywać **20** lekcji, bez skasowania starych wyników.
- [ ] Sprawdź `head -n 3 ~/practice/timeline.log`, `tail -n 2 ~/practice/timeline.log` oraz `wc -l ~/practice/timeline.log` (7 znaków nowej linii).
- [ ] `sort ~/practice/names.txt` wyświetla alfabetyczną kolejność, a `uniq ~/practice/levels.txt` pozostawia dwa nieprzylegające `INFO`.
- [ ] Spróbuj błędnej liczby przy `head -n`, brakującego pliku i pliku bez prawa odczytu. Komunikaty mają być czytelne.
- [ ] Zaliczenie pierwszego ćwiczenia pozwala uruchomić sprawdzian tej samej komendy na **innym pliku**. Nowe dane są izolowane od poprzedniej misji.
- [ ] Nie ma potoków — `sort plik | uniq` powinno zostać odrzucone, a nie działać w rzeczywistym shellu.
- [ ] Zapisane misje i powtórki po odświeżeniu pozostają niezmienione; w nagłówku widać 1.0.0-rc.11.

## RC.12 — bezpieczne potoki w treningu logów

- [ ] W Akademii sprawdź 21 lekcji; poprzednie zaliczenia nie mogą zniknąć.
- [ ] W lekcji „Połącz komendy potokiem” wykonaj `grep WARN ~/practice/alerts.log | sort | uniq | wc -l`; wynik powinien wynosić `2`, a feedback pokazywać cztery etapy.
- [ ] `grep WARN ~/practice/alerts.log | uniq | wc -l` daje inny wynik, bo duplikaty nie sąsiadują. Zobacz wyjaśnienie różnicy.
- [ ] W sprawdzianie przeanalizuj nowy plik z inną kategorią logów, bez gotowej podpowiedzi; wynik powinien zostać oceniony na podstawie etapów i skutku.
- [ ] Sprawdź cudzysłowy, pusty potok, przekierowanie i niedozwoloną komendę `rm` w potoku; nie mogą uruchomić realnych poleceń.
- [ ] Na telefonie upewnij się, że dłuższy tekst potoku mieści się w polu wprowadzania, a feedback/terminal nie przewijają poziomo całej strony.
- [ ] Nagłówek powinien pokazać RC.12; PWA offline nadal sprawdzamy w produkcyjnym podglądzie na porcie 4173.

## RC.13 — śledztwo z nieznanym plikiem źródłowym

- [ ] W Akademii wybierz **Śledztwo: nieznany incydent**. Nie powinno być gotowej składni i przykładu komendy.
- [ ] Sprawdź, czy widoczne są dwa kamienie milowe: potwierdzenie śladu i zachowanie kopii.
- [ ] Użyj poleceń rozpoznawczych do zbadania katalogu logs; skopiowanie niepowiązanego dziennika nie może zaliczyć zadania.
- [ ] Przeczytaj właściwy wpis dotyczący błędów HTTP 502, a potem zachowaj pełny dziennik w podanym miejscu. Po drugim kroku zadanie ma zostać zaliczone.
- [ ] Po zaliczeniu uruchom samodzielny sprawdzian: pojawi się inny rodzaj incydentu i inne pliki. Podpowiedzi nie mogą zdradzać nazwy źródła.
- [ ] Wykonaj udaną, ale błędną operację kopiowania w sprawdzianie, a potem rozwiąż problem. Status opanowania wymaga ponownej, czystej próby.
- [ ] Zweryfikuj mobilną szerokość i przyciski, zachowanie starszych zaliczeń i wersję aplikacji RC.13.

## RC.14 — korzystanie z podręcznika Linuksa

- [ ] W zwykłym terminalu wpisz `man ls` i `man -k log`; powinny pokazać lokalne opisy, bez przechodzenia do zewnętrznej strony.
- [ ] Wybierz lekcję **Dokumentacja komend**. Samo `man grep` nie może jej zaliczyć. Wpisz `man grep`, przeczytaj opcje, następnie użyj odnalezionej flagi w zadaniu.
- [ ] W sprawdzianie druga komenda jest inna: `man head` powinien wskazać opcję liczby wierszy. Prawidłowa kolejność dokumentacji i działania daje opanowanie bez podpowiedzi.
- [ ] Jeśli najpierw wpiszesz `head -n 2` na właściwym pliku, a dopiero potem `man head`, status opanowania wymaga nowej czystej próby.
- [ ] Sprawdź `man not-real` i `man -k nieznany-tekst`: czytelne błędy. Na telefonie dłuższa strona man mieści się w przewijanym terminalu.
- [ ] Stare zaliczenia są nienaruszone, licznik Akademii wskazuje **23**, a nagłówek wersję RC.14. PWA offline osobno do sprawdzenia na fizycznym urządzeniu.

## RC.15 — użytkownik i grupy Linuksa

- [ ] W terminalu wpisz `whoami`, `id`, `id -u`, `id -g`, `id -G`, `id -Gn`, `groups`. Obserwuj rozróżnienie UID, podstawowego GID i grup dodatkowych.
- [ ] W Akademii wybierz „Kim jestem i do jakich grup należę?”. Samo `id` nie wystarcza; wyświetlenie numerów wszystkich grup w drugim kroku powinno zaliczyć lekcję.
- [ ] W sprawdzianie tożsamość jest inna (`analyst`): sprawdź nazwę grupy podstawowej, potem nazwy wszystkich grup. `groups` oraz `id -Gn` powinny być dopuszczalnymi metodami końcowego odczytu.
- [ ] Wpisz najpierw `groups`, potem poprawne rozwiązanie. Cel da się osiągnąć, ale do czystego opanowania wymagany jest reset sprawdzianu.
- [ ] `man id` i `man groups` otwierają lokalny podręcznik, `id -a` i `groups user` zwracają błąd.
- [ ] Po odświeżeniu stare ukończone lekcje pozostają zachowane; licznik ćwiczeń powinien wskazywać **24**, wersja RC.15. Android PWA/offline QA nadal ręcznie do wykonania.

## RC.16 — grupa, własność pliku i dostęp do katalogów

- [ ] Otwórz lekcję „Dlaczego jeden plik otwiera się, a drugi nie?”. `id -G` i `stat ~/practice/operator.log` pokazują członkostwo i właściciela pliku. `cat ~/practice/operator.log` działa, a `cat ~/practice/audit-only.log` odmawia dostępu, mimo identycznego trybu 640.
- [ ] Sprawdzian uruchamia innego użytkownika `analyst`. Metadane `audit-share.log` wskazują grupę audit. `id -G`, `stat` lub `ls -l`, następnie `cat` pozwalają zaliczyć zadanie, a inny log pozostaje niedostępny.
- [ ] `chmod 600 ~/practice/logs` usuwa x. `cd ~/practice/logs`, `find ~/practice/logs` i `cat ~/practice/logs/edge.log` nie powinny działać; `chmod u+x ~/practice/logs` przywraca przejście.
- [ ] `chmod 777 ~/practice/operator.log` jako nie-właściciel ma zostać odrzucone. `stat` pokazuje prawdziwe UID/GID właściciela.
- [ ] Po odświeżeniu wcześniejsze zaliczenia pozostają zachowane; jest **25** ćwiczeń i wersja RC.16. Mobilne QA na fizycznym telefonie oraz działanie PWA offline nadal wymagają weryfikacji.

## RC.17 - diagnoza przejścia przez katalogi

- [ ] W Akademii wybierz „Dlaczego plik jest niedostępny?”; `cat ~/practice/diagnostics/service.log` powinno odmówić dostępu.
- [ ] `namei -l ~/practice/diagnostics/service.log` pokazuje dostępne katalogi, a na blokującym kończy listę ze wskazaniem braku x - nie ujawnia metadanych pliku wewnątrz.
- [ ] `chmod u+x ~/practice/diagnostics`, następnie `cat ~/practice/diagnostics/service.log` odblokowują odczyt; tryb katalogu po zmianie wynosi 700.
- [ ] `chmod 777 ~/practice/diagnostics` pozwala odczytać plik, ale **nie zalicza** minimalnej naprawy.
- [ ] W sprawdzianie plik znajduje się na innej głębokości: `~/practice/logs/locked/health.log`. Znajdź właściwy katalog zamiast odtwarzać poprzednią ścieżkę.
- [ ] Sprawdź `man namei`, niepoprawne argumenty, feedback `id -G`, brak utraty dawnych wyników oraz licznik **26** ćwiczeń i wersję RC.17.
- [ ] Sprawdź realny telefon i aplikację PWA offline. Ten krok jest nadal PENDING i nie był wykonywany automatycznie.

## RC.18 — domyślne uprawnienia przez umask

- [ ] Otwórz terminal i wpisz `umask` (oczekiwane `0022`), następnie `man umask`.
- [ ] W Akademii wykonaj lekcję „Domyślne uprawnienia nowych plików”: ustaw `umask 077`, a następnie utwórz nowy plik i katalog o wskazanych nazwach. `stat` ma pokazać `600` i `700`.
- [ ] Wprowadź `umask` po utworzeniu obiektów: stare prawa nie mogą ulec zmianie.
- [ ] Spróbuj stworzyć obiekty pod maską `022`, a następnie użyć `chmod` do uzyskania `600`/`700` — takie obejście **nie może zaliczyć** ćwiczenia.
- [ ] Sprawdzian używa innych nazw i maski dającej `640` dla nowego pliku i `750` dla katalogu. Nietrafione ustawienie maski jest liczone jako błąd samodzielności.
- [ ] Sprawdź, że `cp` do NOWEGO pliku respektuje bieżący umask, a nadpisanie istniejącego pliku nie zmienia jego praw.
- [ ] Po odświeżeniu postępy pozostają, a licznik ćwiczeń pokazuje **27** i wersję RC.18. Zainstaluj PWA na telefonie i zweryfikuj offline oddzielnie; ten test nadal PENDING.

## RC.19 - zmiana grupy właścicielskiej pliku

- [ ] Otwórz lekcję „Udostępnij plik właściwej grupie”. Sprawdź `stat ~/practice/shared-report.log`, `id -Gn` i `man chgrp`.
- [ ] Wykonaj zmianę grupy raportu z `player` do `operators`, a następnie odczytaj grupę przez `stat` lub `ls -l`. Sprawdź, że prawa pozostają `640` i treść pliku się nie zmienia.
- [ ] `chgrp audit ~/practice/shared-report.log` musi zostać odrzucone, bo `player` nie należy do `audit`.
- [ ] `chgrp operators ~/practice/operator.log` musi zostać odrzucone, bo ten plik nie należy do użytkownika.
- [ ] W sprawdzianie działasz jako `analyst`: zmień grupę innego raportu na `audit`, a następnie potwierdź zmianę. Czyste opanowanie wymaga poprawnej grupy bez nietrafionych prób.
- [ ] Zachowaj wszystkie dotychczasowe wyniki, licznik **28** lekcji i cache RC.19. Zrealizuj fizyczne QA telefonu/PWA offline osobno; nadal PENDING.

## RC.20 - przekierowanie danych do wirtualnego pliku

- [ ] W Akademii wybierz „Zapisz wynik analizy do pliku”. Wpisz `grep WARN ~/practice/alerts.log > ~/practice/alerts-summary.log`, a następnie `grep INFO ~/practice/alerts.log >> ~/practice/alerts-summary.log`.
- [ ] `cat ~/practice/alerts-summary.log` pokazuje najpierw cztery WARN, potem dwa INFO; `cat ~/practice/alerts.log` wciąż pokazuje oryginał.
- [ ] Ponowne `>` nadpisuje poprzedni raport, a `>>` dopisuje; nowy plik ma prawa wynikające z umask, istniejący wymaga zapisu.
- [ ] `grep FATAL ~/practice/alerts.log > ~/practice/alerts-summary.log` nie może skasować raportu, bo źródłowe polecenie kończy się błędem.
- [ ] Sprawdzian używa innego pliku wejściowego `incidents.log` i innej nazwy raportu. Zaliczenie wymaga dwóch przekierowań i późniejszego `cat`.
- [ ] Licznik **29** i wersja RC.20, postępy starszych 28 ćwiczeń niezmienione. Fizyczne QA telefonu i offline PWA nadal PENDING.


## RC.21 - nazwy ze spacjami i znaki specjalne

- [ ] W lekcji Pliki ze spacją w nazwie przenieś report draft.txt do final report.txt z użyciem cudzysłowów albo backslasha, następnie wykonaj cat.
- [ ] Spacja bez cytowania musi zgłosić błąd liczby argumentów, zamiast przypadkowo zmieniać plik.
- [ ] W sprawdzianie przenieś audit notes.txt do incident notes.txt i odczytaj wynik; błędne udane mv nie przyznaje czystego opanowania.
- [ ] Cytowany lub escapowany znak | albo > w nazwie pliku nie uruchamia potoku ani przekierowania.
- [ ] man quoting działa offline; niedomknięty cytat lub końcowy backslash nie może zmienić stanu.
- [ ] Licznik 30 lekcji i sprawdzianów oraz cache RC.21, zachowane starsze postępy. Fizyczne QA PWA offline nadal PENDING.


## RC.22 - status zakończenia polecenia

- [ ] W trybie Komendy otwórz „Czy polecenie się powiodło?”. Po `grep FATAL ~/practice/events.log` odczytaj status przez `echo $?`; oczekuj `1`.
- [ ] Ponowne `echo $?` musi zwrócić `0`, ponieważ echo zmienia status. Następnie `grep WARN ~/practice/events.log` i bezpośrednio `echo $?` zwracają status `0`.
- [ ] Błąd składni, np. niedomknięty cudzysłów, daje `2`; nieznana komenda daje `127`. Dostępna dokumentacja `man exit-status`.
- [ ] Niezależny sprawdzian używa innego logu i innych słów wyszukiwania. Celowy brak dopasowania nie jest karany, ale błędna diagnoza już tak.
- [ ] Zachowane stare sesje i licznik **31** ćwiczeń, cache RC.22. Realny test dotyku/PWA i działania offline nadal PENDING.


## RC.23 - test i prawa katalogów

- [ ] W Akademii sprawdź `test -f ~/practice/checks/locked.log`, potem `echo $?` (0). Następnie `test -r` na tym samym pliku i od razu `echo $?` (1).
- [ ] Forma `[ -d ~/practice/checks ]` daje status 0; pominięcie zamykającego `]` daje 2. Komendy `man test` i `man exit-status` działają lokalnie.
- [ ] Sprawdzian `~/practice/logs/forensics/trace.log`: `test -r` zwraca 1, `test -x` na katalogu zwraca 1; napraw tylko brakujące `u+x`, a `test -r` i `echo $?` dają 0.
- [ ] Zbyt szerokie `chmod 777` nie zalicza minimalnej naprawy. Treść logu i jego uprawnienia zostają bez zmian.
- [ ] Licznik 32 lekcji/sprawdzianów, zachowane wcześniejsze wyniki, cache RC.23. QA fizycznego urządzenia i pracy offline nadal PENDING.


## RC.24 - krótkie łańcuchy poleceń

- [ ] W Akademii otwórz lekcję „Działaj tylko po spełnieniu warunku”. Spróbuj `test -f ~/practice/source.txt && cp ~/practice/source.txt ~/practice/guarded-copy.txt` i sprawdź, że powstała kopia, a oryginał się nie zmienił.
- [ ] `test -f ~/practice/not-present.log && touch ~/practice/should-not-exist.tmp` nie może utworzyć pliku i ma status 1; `echo $?` pokazuje 1.
- [ ] `test -f ~/practice/not-present.log || touch ~/practice/follow-up.flag` ma utworzyć znacznik, a późniejsze `echo $?` zwrócić 0.
- [ ] `cat ~/practice/guarded-copy.txt` potwierdza kopię i zamyka lekcję. Sprawdzian używa innego logu i innych nazw plików.
- [ ] Znaki `&&` i `||` w cudzysłowach lub poprzedzone backslashem nie uruchamiają logiki. Błędna składnia nie zmienia plików.
- [ ] 33 lekcje/sprawdziany i cache RC.24 bez utraty poprzednich wyników. Rzeczywiste testy offline PWA i obsługi na telefonie pozostają PENDING.


## RC.25 - misja 17: INC-017 i mapa sześciu rozdziałów

- [ ] Po ukończeniu misji 16 widać 17. misję. Pierwsze 16 numerów i odblokowań pozostają bez zmian. Mapa nauki zawiera 6 rozdziałów, ostatni to SOC: pełne śledztwo.
- [ ] Misja INC-017 pokazuje cztery etapy: Ślady, Kopie dowodowe, Korelacja i Weryfikacja. Przed wykonaniem żaden nie jest oznaczony jako zaliczony.
- [ ] Najpierw znajdź ALERT w /var/log/app.log i DENIED w /var/log/auth.log, później warunkowo skopiuj oryginalne logi do osobnych plików w ~/documents. Etapy zmieniają się dopiero po poprawnych akcjach.
- [ ] Wykonaj grep ALERT > ~/documents/case17-report.log, następnie grep DENIED >> tego samego pliku. Sprawdź, że raport ma dwa wiersze w odpowiedniej kolejności i odczytaj go cat.
- [ ] Bez warunkowej kopii (`test -f` i `&&`) oraz po zmodyfikowaniu źródłowego logu misja nie może zostać zaliczona. Pliki źródłowe pozostają nienaruszone.
- [ ] Sprawdź odświeżenie postępu, obsługę dotykiem oraz PWA offline po produkcyjnym buildzie RC.25. Wciąż PENDING do czasu fizycznego testu telefonu.


## RC.26 - misja 18: konkurencyjne hipotezy

- [ ] Po ukończeniu INC-017 odblokowuje się misja 18; wcześniejsze 17 numerów i postęp nie ulegają zmianie.
- [ ] Misja otwiera pięć wirtualnych źródeł case18-*.log w ~/documents/cases bez modyfikowania dotychczasowych plików. Na telefonie sprawdź długie nazwy oraz terminal bez przewijania poziomego.
- [ ] W sekcji etapów „Źródła” wymaga odczytu pięciu logów; samo polecenie hypothesis bez analizy nie zalicza etapu oceny.
- [ ] man hypothesis pokazuje dostępne opcje i pewność; wprowadzenie błędnej hipotezy nie zalicza śledztwa, ale można ją poprawić na podstawie dalszej analizy.
- [ ] Skopiuj oba rozstrzygające oryginały do plików evidence, następnie zapisz dwa fakty w raporcie przez > i >>; cat raportu powinien zaliczyć czwarty etap. Zmiana któregoś oryginalnego logu blokuje zaliczenie.
- [ ] Po odświeżeniu powinna zachować się aktywna sesja misji, nowy raport i postępy poprzednich zadań. Produkcyjna PWA RC.26 offline, obsługa ekranu i klawiatury na fizycznym telefonie nadal PENDING.


## RC.27 - misja 19: diagnoza i bezpieczna naprawa

- [ ] Po misji INC-018 pojawia się INC-019; wcześniejsze 18 misji i zapisane ukończenia zachowują numery.
- [ ] `curl -i http://api.ctf.test/health` pokazuje HTTP 503 i kod zakończenia powłoki 0. Brak prawdziwych żądań do Internetu.
- [ ] `cat` obu plików case19-api.conf i case19-api.safe.conf ujawnia różne wartości puli; przed przywróceniem stabilnej konfiguracji sam `systemctl restart api` nie naprawia błędu.
- [ ] `cp case19-api.safe.conf case19-api.conf` modyfikuje plik, ale nie działający proces. Dopiero restart api stosuje właściwą konfigurację; ponowne `curl` potwierdza HTTP 200.
- [ ] Zatrzymanie sshd lub queue powoduje brak pełnego zdrowia; zmiana kopii zapasowej lub nadmiernie szerokie prawa nie zalicza etapu.
- [ ] Po odświeżeniu nie ginie raport z INC-018, obecny stan INC-019, ani postęp. Sprawdzenie klawiatury telefonu i działania PWA RC.27 offline nadal PENDING.


## RC.28 - misja 20 i konsekwencje działań

- [ ] Po odblokowaniu INC-020 widać 20 misji w sześciu rozdziałach, bez utraty dotychczasowych ukończeń.
- [ ] `curl -i http://ops.ctf.test/health` zwraca fikcyjne HTTP 503 i shell exit 0; `systemctl status queue` pokazuje inactive, a `journalctl -u queue` zapis o awarii po wdrożeniu.
- [ ] `systemctl start queue`, ponowny `curl`, `systemctl status queue` oraz `systemctl status sshd` prowadzą do zaliczenia przy zerowej liczbie dodatkowych skutków.
- [ ] Niepotrzebny `systemctl restart api` w trakcie awarii zwiększa licznik skutków. `systemctl stop sshd` degraduje dostęp; po naprawie przez `systemctl start sshd` i kontroli HTTP misję można zaliczyć, ale historia działań pozostaje.
- [ ] Odczyty `systemctl status` nie zwiększają licznika błędnych interwencji, a samo pozorowanie wyniku bez diagnozy nie zalicza misji.
- [ ] Sprawdź powrót na misję, zachowanie postępów i historii, klawiaturę mobilną oraz PWA RC.28 offline. Fizyczne QA telefonu **PENDING**.


## RC.29 - INC-021, misja bez podpowiedzi

- [ ] Po ukończeniu INC-020 pojawia się misja 21; indeksy i wcześniejsze ukończenia bez zmian.
- [ ] W misji nie ma panelu podpowiedzi, auto-coacha ani listy wymaganych komend. help i man pozostają dostępne w terminalu.
- [ ] Po wejściu powstają raz pliki zgłoszenia, fałszywego tropu i dowodu. Po powrocie/odświeżeniu zachowują się edycje i usunięcia, bez nadpisania przez seed.
- [ ] Zgłoszenie znajdź w ~/documents/cases. Odmowa odczytu pliku dowodowego występuje przed naprawą. namei -l, stat katalogu albo test -x umożliwiają diagnozę braku przejścia.
- [ ] Minimalne u+x w katalogu daje tryb 700; chmod 777 nie zalicza. Odczytaj oryginał, utwórz kopię i odczytaj kopię - źródło i zgłoszenie muszą pozostać nienaruszone.
- [ ] Sprawdź na telefonie układ bez pomocy, klawiaturę, zapis sesji i produkcyjne PWA offline RC.29. Fizyczne QA nadal PENDING.


## RC.30 - raport po pierwszym zaliczeniu

- [ ] Ukończ niezaliczoną misję, sprawdź sekcję „Raport po misji” i zwinięty przegląd dowodów. Raport ma odpowiadać wykonanym komendom, bez fikcyjnych hipotez i bez kopiowania całej treści logów.
- [ ] Przejdź do innej misji i wróć: raport zachowuje się, choć historia terminala może zostać wyczyszczona. Powtórzenie komend nie nadpisuje pierwotnego raportu.
- [ ] W historycznie ukończonej misji bez raportu aplikacja pokazuje wyjaśnienie, zamiast wymyślać przebieg pierwszej próby.
- [ ] W przypadku INC-020 niepotrzebny restart API ma pojawić się jako konsekwencja nawet po usunięciu awarii. W INC-018 tylko jawnie zapisane hipotezy są widoczne jako hipotezy.
- [ ] Odpowiedz na pytanie transferowe, przełącz misję i odśwież stronę. Tekst do 600 znaków pozostaje, nie zwiększa licznika ukończeń i nie jest oceniany.
- [ ] Na telefonie sprawdź czytelność zwijanego raportu, przewijanie długich ścieżek, wygodę pola tekstowego i zachowanie po pracy offline. Fizyczne PWA QA pozostaje PENDING.


## RC.31 - weryfikacja samodzielnego transferu

- [ ] Po ukończeniu INC-021 można otworzyć nową 22. misję INC-022, bez utraty zaliczeń i raportów z poprzednich zadań.
- [ ] Misja nie wyświetla podpowiedzi ani automatycznego coachingu. Zgłoszenie prowadzi do osobnego zestawu plików, a samo powtórzenie poprzedniej naprawy nie działa.
- [ ] Sprawdź rozpoznawanie osobno istnienia pliku, przejścia przez katalog i prawa odczytu samego pliku. Różne drogi diagnozy powinny być dopuszczalne.
- [ ] Po minimalnej naprawie przeczytaj oryginał, wykonaj kopię i zweryfikuj jej treść. Zmiana danych, nadmierne uprawnienia i próba zaliczenia bez wcześniejszego zbadania błędu muszą zostać odrzucone.
- [ ] Zamknij i ponownie otwórz misję oraz aplikację. Pliki i postęp powinny przetrwać, bez automatycznego przywracania usuniętego zgłoszenia. Raport po pierwszym zaliczeniu i pole refleksji mają działać jak w RC.30.
- [ ] Na prawdziwym telefonie sprawdź układ, wprowadzanie komend, klawiaturę, zapis stanu i działanie PWA offline. **QA PENDING** do faktycznego sprawdzenia.


## RC.32 - most do rzeczywistego terminala (nie QA mobilne)

- [ ] W aplikacji sekcja REAL-01 wyraźnie rozróżnia symulator od prawdziwego terminala Codespaces; link prowadzi do instrukcji labu.
- [ ] PWA nadal wykonuje tylko symulowane komendy. Przycisk/sekcja REAL-01 nie uruchamia niczego na serwerze ani na telefonie.
- [ ] Osobno w Codespaces: node labs/real-linux/setup.mjs, a po wykonaniu ćwiczenia node labs/real-linux/verify.mjs - wynik 6/6 potwierdza stan plików, nie ocenę rozumowania.
- [ ] Bez sudo, z zachowanym stanem po ponownym setup, i bez dodania .ctf-master-labs do repozytorium. Fizyczny test offline PWA nadal PENDING.


## RC.34 - test przewijania terminala i zwartego ekranu

- [ ] Otwórz Akademia → pierwsze zaliczone ćwiczenie → Sprawdzian. Karta powinna być krótsza; przycisk Reset i Powrót do nauki dostępne przez „Opcje sprawdzianu”.
- [ ] Przesuwaj stronę w górę i w dół **dotykając środka terminala, także pustej przestrzeni**. Strona powinna płynnie się przewijać, bez konieczności chwytania krawędzi poza terminalem.
- [ ] Wykonaj więcej niż sześć poleceń. Terminal pokazuje ostatnie sześć wpisów; „Pokaż wcześniejsze wyniki” ujawnia starsze, „Zwiń historię” ponownie skraca widok.
- [ ] Wpisz polecenie przy otwartej klawiaturze, użyj przycisków historii poleceń i uruchom sprawdzian; nie może zniknąć zdolność wpisywania komend ani zapisu postępów.
- [ ] Zamknij APK, uruchom ponownie oraz sprawdź dostępność zadań offline.
- [ ] RC.34 ma debugowy podpis CI mogący różnić się od RC.33; przy wymaganym odinstalowaniu starej wersji dane zostaną utracone. Najpierw przetestuj i zdecyduj, czy chcesz zachować bieżące zaliczenia.


## RC.35 - kopiowanie postępu przed reinstalacją

- [ ] Na telefonie rozwiń dolny panel postępów, wygeneruj kopię, użyj „Kopiuj kod” i upewnij się, że można wkleić pełny JSON do prywatnej notatki.
- [ ] Sprawdź import prawidłowej kopii z Akademią i misjami. Najpierw „Sprawdź kopię”, potem „Połącz postępy”; zaliczenia mają pozostać po zamknięciu APK.
- [ ] Import nie powinien usuwać obecnych zaliczeń, raportów ani refleksji. Niedokończona sesja i stan wirtualnego filesystemu pozostają lokalne i nie są przenoszone.
- [ ] Upewnij się, że kod nie zawiera pełnych logów z wirtualnego terminala i nie jest automatycznie wysyłany do sieci.
- [ ] Nieprawidłowy, niekompletny lub nieobsługiwany JSON powinien zostać odrzucony bez zmiany zaliczeń.
- [ ] UI głównych zadań jest nadal krótki - panel backupu domyślnie zwinięty. Android WebView copy/paste QA: PENDING do fizycznego sprawdzenia.

## RC.38 - kompaktowy Bash Workshop
- [ ] Na telefonie otwórz zakładkę Bash. Nie powinna zawierać długiego powitania ani sekcji REAL-01; całe zadanie, krótki edytor, opcjonalna prognoza i wynik są w jednym miejscu.
- [ ] Przy otwartej klawiaturze wpisz trzy linie i przetestuj przewijanie gestem po środku edytora, nie tylko obok niego.
- [ ] Sprawdź poprawny skrypt, błędny warunek, zwijany przebieg iteracji i informację o pierwszym błędzie.
- [ ] Wróć do innej zakładki, a potem do Bash: szkic zostaje bez zmiany ukończeń Akademii i misji.
- [ ] Przetestuj działanie w PWA bez sieci; fizyczne QA nadal PENDING. W tym PR nie dystrybuujemy APK.

## RC.39 - Bash na klawiaturze telefonu
- [ ] Ustaw kursor w połowie drugiej linii; dotknij klawisza `$` i sprawdź, że znak pojawił się w środku tekstu, a nie na końcu.
- [ ] Zaznacz fragment tekstu i zastąp go jednym z klawiszy; klawisz `↵` powinien dodać prawdziwą nową linię.
- [ ] Po dotknięciu paska znaków kursor powinien pozostać w edytorze, a przy otwartej klawiaturze nie powinno być dużych skoków strony.
- [ ] Sprawdź poziomy przesuw paska na wąskim ekranie i zwykłe pionowe przewijanie strony przy dotknięciu edytora.
- [ ] Dotknięcia klawiszy powinny zachowywać zapis szkicu, a przy limicie 700 znaków nie dopisywać kolejnych. Nie powinny zmieniać zaliczeń innych trybów.
- [ ] Fizyczny test Android/PWA nadal PENDING. Pracujemy w repo, bez APK.

## RC.40 - szybka korekta konkretnej linii
- [ ] W zakładce Bash dodaj pusty wiersz nad błędną linią; wynik powinien wskazywać jej prawdziwy numer, a nie indeks niepustego polecenia.
- [ ] Dotknij Popraw linię N: edytor powinien wrócić na ekran, a odpowiednia linia zostać zaznaczona do edycji. Sprawdź to z otwartą klawiaturą i w orientacji pionowej.
- [ ] Zmień błędną linię i uruchom ponownie. Informacja i przycisk powinny zniknąć po poprawnym wykonaniu.
- [ ] Brakującą całkowicie linię raportujemy opisowo, bez wskazywania niewłaściwej linii i bez nowego panelu.
- [ ] Fizyczny test Androida nadal PENDING; brak dystrybucji APK.

## RC.41 - Cofnij podczas pisania Bash
- [ ] Wstaw `$` lub `&&` w środek linii, a następnie dotknij ↶; tekst i kursor powinny wrócić do stanu sprzed wstawienia.
- [ ] Zaznacz linię przyciskiem „Popraw linię”, zastąp ją omyłkowo i użyj ↶; poprzednia linia powinna wrócić bez utraty pozostałego skryptu.
- [ ] Szybko wpisz kilka liter i cofnij je jednym dotknięciem; po dłuższej pauzie pisanie ma osobne cofnięcie.
- [ ] Wstaw pusty szablon, a następnie cofnij reset. Przełącz zakładki i sprawdź zachowanie zapisanego szkicu.
- [ ] Gdy nie ma historii, ↶ jest nieaktywny. Przy otwartej klawiaturze nie powinien tworzyć dodatkowych pionowych paneli.
- [ ] Rzeczywiste QA Android WebView: PENDING. Nie dystrybuować APK w tym PR.

## RC.42 - dwa zadania w jednym mobilnym warsztacie
- [ ] Wybierz 01 Kopie logów i 02 Brakujący log z jednego małego menu. Powinny zmienić się opis i szkic, nie powinny pojawić się nowe panele ani etapy.
- [ ] W 02 ustaw BASE i sprawdź manual.log oraz missing.log przez test -f połączone &&; po echo $? wynik 1 powinien zaliczyć diagnozę, bo oznacza brak pliku.
- [ ] Odwrotna kolejność testów lub brak echo $? nie powinny zaliczać ćwiczenia; wynik ma wskazywać pierwszy istotny błąd.
- [ ] Wpisz fragment rozwiązania w 01, przejdź do 02, wróć do 01: oba szkice pozostają osobne. Cofnij i feedback nie mogą mieszać dwóch zadań.
- [ ] Sprawdź mały ekran i klawiaturę Android: jedno pole edycji, jeden wynik, minimum przewijania. Fizyczne QA nadal PENDING, bez wydawania APK.

## RC.43 - uprawnienia zamiast brakującego pliku
- [ ] W jednym menu Bash wybierz 03 Uprawnienia; zobacz krótkie zadanie i ten sam edytor bez dodatkowych etapów.
- [ ] Sprawdź locked.log przez test -f i test -r połączone &&. Wynik 0 dla istnienia oraz 1 dla odczytu, a potem echo $? pokazujące 1 powinny zaliczyć zadanie.
- [ ] Błędne użycie test -f dwukrotnie, odwrócenie kolejności, próba chmod lub brak echo $? mają zostać odrzucone.
- [ ] Wpisz inne fragmenty kodu w 01, 02 i 03. Przełączaj scenariusze - szkice muszą pozostać osobne; Cofnij nie może mieszać historii.
- [ ] Przy otwartej klawiaturze sprawdź menu, zaznaczenie błędnej linii i brak poziomego lub nadmiernego pionowego przewijania. Fizyczne QA: PENDING.


## RC.47 - jeden ekran: sprawdzian transferowy Bash

- [ ] Na telefonie otwórz Bash → **05 · Sprawdzian**. Zweryfikuj puste pole edycji, bez podanego szablonu; nie może pojawić się kolejny ekran ani przewijany panel na panelu.
- [ ] Wpisz próbę, przejdź do zadania 04 i wróć do 05: osobny szkic nie może się zgubić ani nadpisać.
- [ ] Wykonaj diagnozę `audit-daily.log` / `alerts.log` i odczyt statusu. Sprawdź, że wcześniejszy skrypt z 04 nie zalicza zadania 05.
- [ ] Otwórz i zamknij klawiaturę Androida, przewiń ekran dotykając edytora, sprawdź Cofnij i poprawianie linii. Status fizycznego QA: PENDING, dopóki nie wykonano tego na urządzeniu.


## RC.48 - katalog bez x (mobile QA)

- [ ] Bash → 06 · Katalog na fizycznym Androidzie w orientacji pionowej.
- [ ] Sprawdź wynik `test -r`, `echo $?` i `namei -l` na `~/practice/diagnostics/service.log`; oczekiwany zablokowany katalog to `~/practice/diagnostics`.
- [ ] Rozwiń i zwiń Przebieg, sprawdź czy widać brak `x`, bez odsłaniania treści chronionego pliku.
- [ ] Przy otwartej klawiaturze sprawdź przewijanie dotykiem edytora, Cofnij, wybór scenariusza i osobny szkic.
- [ ] Fizyczne QA: PENDING, dopóki nie wykona się powyższych kroków na telefonie.


## RC.49 - minimalna naprawa (Android QA)

- [ ] Bash → 07 · Naprawa na fizycznym telefonie; brak dodatkowego panelu.
- [ ] Wpisz namei -l, minimalne chmod u+x na diagnostics i końcowe cat service.log, obserwuj 600 -> 700.
- [ ] Wpisz chmod 777: powinno zostać odrzucone całe wykonanie, bez jakichkolwiek zmian.
- [ ] Przy otwartej klawiaturze sprawdź nawigację, wybór scenariusza, Cofnij, fokus, przewijanie i zachowanie osobnego szkicu.
- [ ] Fizyczne QA: PENDING.

## RC.50 - przełączenie samodzielnego przypadku naprawy (fizyczny Android)

- [ ] Otwórz Bash → 07 · Naprawa; kliknij Samodzielny przypadek. Sprawdź, że jest pusty edytor z nowym zgłoszeniem dotyczącym health.log, bez ósmego zadania w menu.
- [ ] Wpisz część rozwiązania, przejdź do wariantu z pomocą i wróć: oba szkice muszą pozostać osobne; wynik i Cofnij wyzerowane po przełączeniu.
- [ ] Zdiagnozuj katalog logs/locked bez x, dokonaj tylko owner-x, sprawdź odczyt; po błędnej/niebezpiecznej komendzie nie może dojść do zmiany świata.
- [ ] Przy otwartej klawiaturze sprawdź dotykiem przewijanie, focus, reset, pozycję przycisku i kontrast.
- [ ] Fizyczny Android QA: PENDING.

## RC.51 - fizyczne QA przewijania na telefonie
- [ ] Pociągnięcie palcem pionowo na polu skryptu przewija całą stronę, bez drugiego obszaru przewijania.
- [ ] Wpisz cztery długie linie, potem je usuń. Wysokość pola powinna zwiększać się i zmniejszać.
- [ ] Obróć telefon: zawijanie i wysokość pola aktualizują się po zmianie szerokości.
- [ ] Na pasku skrótów sprawdź gest pionowy (strona) i poziomy (pasek); `||` wstawia się w miejscu kursora.
- [ ] Otwórz klawiaturę, przetestuj Cofnij, Popraw linię i osobne szkice z obu wariantów Naprawy.
- [ ] Android QA: PENDING, do testu na prawdziwym urządzeniu.
