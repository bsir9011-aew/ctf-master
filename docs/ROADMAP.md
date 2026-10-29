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
- [x] Pierwsze powtorki celowane: 4 umiejetnosci, 2 warianty kazda, osobne srodowisko
- [ ] Powtorki czasowe i przeglad wszystkich obszarow (m.in. uprawnienia)
- [x] Testy logiki symulatora

## Etap 1 - Linux Administrator
- [x] Podstawy chmod, stat, tryby rwx i testy Permission denied
- [ ] chown, uzytkownicy, grupy, ACL, katalogi z kontrola przechodzenia
- [x] grep/find i pierwsze misje logow
- [ ] Procesy, uslugi i zaawansowana diagnostyka
- [ ] Diagnostyka awarii i zadania bez podanych komend

## Etap 2 - CTF Rookie
- [ ] Ukryte pliki, encoding, archiwa, pliki binarne
- [ ] Misje Web, Forensics, OSINT, Crypto
- [ ] Zadania transferowe bez podpowiedzi

## Etap 3 - CTF Operator i Master
- [ ] Oddzielone, resetowalne prawdziwe srodowiska laboratoryjne (nie na serwerze aplikacji)
- [ ] Reverse engineering, binary exploitation, pwn, zlozone zadania
- [ ] Integracja z zewnetrznymi platformami i samodzielne write-ups
