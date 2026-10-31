# CTF Master - Android APK (RC.35)

## Co budujemy

Instalowalny **Android Debug APK** na własny telefon (Android 7+), opakowany przez Capacitor 8. React/Vite oraz wszystkie symulowane lekcje, misje i powtórki zostają wewnątrz APK. To **nie** aplikacja publikowana w Google Play ani plik release podpisany stałym prywatnym kluczem. W tej wersji nie dodajemy kont, analityki ani prawdziwego terminala systemowego.

**Nie uruchamiaj komend z wirtualnego terminala na urządzeniu:** terminal w APK jest tym samym symulatorem JavaScript co w PWA.

## Pobranie APK po zielonym buildzie

1. Wejdź do repozytorium [CTF Master](https://github.com/bsir9011-aew/ctf-master).
2. Otwórz **Actions → Android APK (debug)**.
3. Otwórz najnowszy przebieg z gałęzi **main**, który ma zielony znacznik sukcesu.
4. Na dole w **Artifacts** wybierz `CTF-Master-Android-debug-<numer>` i pobierz ZIP.
5. Rozpakuj ZIP. W środku będzie **`CTF-Master-RC35-debug.apk`** i `SHA256SUMS.txt`.
6. Skopiuj APK do telefonu lub pobierz ZIP bezpośrednio na nim, rozpakuj i otwórz APK. Potwierdź instalację z tej konkretnej aplikacji pobierającej plik; po instalacji możesz wyłączyć zgodę **Instaluj nieznane aplikacje**.

Nie korzystaj z APK otrzymanego z przypadkowej strony. Wybieraj tylko plik wynikowy z własnego repozytorium i udanego builda. SHA-256 w ZIP pozwala zweryfikować, czy plik nie zmienił się podczas kopiowania.

## Wersja testowa i aktualizacje

- Wersja **debug** jest podpisywana automatycznym kluczem debugowym Androida utworzonym na runnerze. Przy kolejnym buildzie klucz może być inny; bez stałego klucza nie ma gwarancji instalacji aktualizacji na istniejącą apkę. Android może zażądać odinstalowania poprzedniej wersji.
- **Odinstalowanie APK usuwa jej lokalne postępy.** Zanim będziemy budować stabilne, aktualizowalne wydanie, dodamy stały klucz podpisywania w sekrecie CI i eksport/import postępu. Na razie traktuj APK jako wersję testową.
- Postępy z PWA/Chrome/Firefox oraz z osobnej aplikacji APK **nie są współdzielone**. Samo zainstalowanie APK nie skopiuje wcześniejszego `localStorage`.
- Nie musisz instalować Android Studio ani logować się do Google Play. Używanie APK po instalacji nie wymaga Codespaces ani internetu.

## Test na telefonie

1. Otwórz APK, sprawdź terminal `pwd`, `ls`, `cat`, komendy z odstępami i podpowiedzi.
2. Sprawdź klawiaturę ekranową, przewijanie, orientację pionową i poziomą oraz użycie przycisku **Wstecz**.
3. Ukończ pierwszą lekcję, zamknij aplikację całkowicie i uruchom ją ponownie - postęp powinien zostać.
4. Włącz tryb samolotowy, ponownie uruchom aplikację i sprawdź lekcje oraz misje. Dane są zaszyte w APK.
5. W razie problemu zanotuj model telefonu, Android, widoczną wersję aplikacji i dokładny moment awarii.

**Status:** automatyczny build i testy na runnerze CI nie dowodzą sprawnego działania na fizycznym telefonie. Test Androida na prawdziwym urządzeniu pozostaje do wykonania.

## Ponowny build w GitHub

Workflow: `.github/workflows/android-apk.yml`. Można go uruchomić ręcznie przez **Actions → Android APK (debug) → Run workflow**, a także wykonuje się po zmianach na main i w odpowiednich PR-ach.

Workflow używa Node 22, JDK 21, SDK API 36, Capacitor 8, poleceń `cap add android` / `cap sync android` i `gradlew assembleDebug`. Generowany katalog `android/` jest ignorowany przez Git. Web build pozostaje niezmieniony, a service worker PWA nie rejestruje się w lokalnym WebView Capacitor.

## Lokalny Android build (zaawansowane)

Jeśli masz Android SDK i JDK 21, po `npm install` możesz wykonać:

```bash
npm install --no-save --package-lock=false @capacitor/core@8.0.0 @capacitor/cli@8.0.0 @capacitor/android@8.0.0
npm run build
npm run android:prepare
cd android
bash ./gradlew assembleDebug
```

Wynik: `android/app/build/outputs/apk/debug/app-debug.apk`. Domyślnie rekomendowany jest build GitHub Actions, by nie konfigurować lokalnego SDK.


## Kopia zapasowa zaliczeń przed aktualizacją

Od RC.35 można przenosić postępy bez konta i serwera: na końcu ekranu rozwiń „Postępy · Kopia zapasowa i przywracanie”, wygeneruj kod, skopiuj cały JSON i zachowaj go w prywatnej notatce poza APK. Po reinstalacji wklej go, sprawdź i wybierz „Połącz postępy”. Import nie kasuje osiągnięć już zapisanych w nowej wersji.

**Co wraca:** poznane/opanowane lekcje, zaliczone misje, historia powtórek, liczniki, raporty i refleksje. **Czego nie przywraca:** stanu plików wirtualnego Linuksa, surowych wyników terminala i niedokończonych sesji. Kopia może zawierać prywatne notatki, więc nie wysyłaj jej do publicznych serwisów. Skopiowanie na schowek bez zapisania poza APK nie chroni przed odinstalowaniem.

Test funkcji na fizycznym telefonie pozostaje wymagany. Podpis debugowego APK nadal nie gwarantuje aktualizacji bez reinstalacji.
