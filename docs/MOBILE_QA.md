# CTF Master 1.0 RC — manual mobile QA

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
