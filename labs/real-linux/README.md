# REAL-01 - Pierwsze laboratorium na prawdziwym Linuksie

Ten etap działa **w terminalu GitHub Codespaces**, a nie w symulowanym terminalu CTF Master. Polecenia Linux wpływają na prawdziwe, ale odizolowane pliki w katalogu labu. Wymaga Node.js 22+ i systemu Linux. Nie wymaga sudo ani połączeń sieciowych po przygotowaniu Codespace.

## Start

Będąc w głównym katalogu repozytorium:

```bash
node labs/real-linux/setup.mjs
cd .ctf-master-labs/permissions-01
cat issue.txt
```

Zgłoszenie opisuje problem. Nie ma listy komend naprawczych. Masz zebrać dane, przewidzieć, gdzie Linux odmówi dostępu, wykonać **najmniejszą potrzebną zmianę** i dostarczyć zweryfikowaną kopię. Plik `service.log` może zawierać informację niepowiązaną z przyczyną.

Użyj znanych narzędzi w *prawdziwym terminalu*, takich jak `ls -ld`, `stat`, `namei -l` (jeśli dostępne), `cat`, `test`, `chmod`, `cp` i `sha256sum`. Nie każda komenda jest konieczna. Nie edytuj pliku `audit.log` ani zgłoszenia.

## Samodzielna weryfikacja

Po zakończeniu działań wróć do katalogu repozytorium:

```bash
cd ../..
node labs/real-linux/verify.mjs
```

Weryfikator zwraca `RESULT: 6/6` i kod zakończenia `0`, jeśli końcowy stan uprawnień i treści jest prawidłowy. Jeśli zadanie nie jest ukończone, zwraca `NOT YET` i kod `1`. Przede wszystkim nie nadawaj uprawnień wszystkim użytkownikom - rozwiązanie musi pozostawać minimalne.

**Weryfikator sprawdza stan dysku, nie Twoją metodę diagnozy.** Samodzielnie zapisz krótką odpowiedź: gdzie była blokada, dlaczego Linux odmówił odczytu, co zmieniłeś i jak potwierdziłeś integralność kopii. Ten opis można później wspólnie przeanalizować.

## Zasady bezpieczeństwa

- Skrypt `setup.mjs` tworzy tylko `.ctf-master-labs/permissions-01` w repozytorium. Katalog `.ctf-master-labs/` jest ignorowany przez Git. Nie modyfikuje `/etc`, `/var/log`, usług ani kont systemowych. Wymaga tylko uprawnień zwykłego użytkownika.
- Ponowne `setup.mjs` **nie resetuje ani nie nadpisuje** wcześniej rozpoczętego labu, nawet jeśli dokonałeś błędnej zmiany. Jeśli chcesz zupełnie świeżą próbę, załóż nowy Codespace albo świadomie przygotuj nowe środowisko.
- Nie używaj `sudo`, `rm -rf` ani `chmod -R`. W tym labie żadna z tych operacji nie jest potrzebna.
- W katalogu labu wszystkie logi są syntetyczne. Nie kopiuj rzeczywistych danych firmowych, haseł ani kluczy.
- Skrypty weryfikacyjne nie uruchamiają poleceń wpisanych przez użytkownika; używają tylko lokalnego API plikowego Node.js. Żaden wynik nie trafia do serwera.
- PWA nadal ma osobny, wyłącznie wirtualny interpreter. Wynik REAL-01 nie jest automatycznie zapisywany jako zaliczenie PWA.

### Jak poznać, czy nastąpił transfer wiedzy?

Dobrze wykonany lab to nie tylko `6/6`. Powinieneś umieć bez podglądu rozwiązania wyjaśnić różnicę między prawami `r`, `w`, `x` dla pliku i katalogu, skutki działania bez `sudo`, a następnie wykonać podobną naprawę dla **innej ścieżki**. Po wykonaniu opisz własnymi słowami przyczynę i minimalną korektę.
