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
- [ ] Naglowek pokazuje faktyczna wersje pakietu: 1.0.0-rc.6. Odwiedz Misje i Powtorki — ich interfejsy i postepy musza byc niezmienione.
