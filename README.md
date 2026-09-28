# CV Studio

Statyczny kreator CV przygotowany do publikacji na GitHub Pages. Nie wymaga kompilacji ani serwera aplikacyjnego.

## Uruchomienie lokalne

Otwórz `index.html` bezpośrednio w przeglądarce albo uruchom prosty serwer HTTP w tym katalogu.

## Publikacja na GitHub Pages

1. Umieść pliki w repozytorium GitHub.
2. W `Settings → Pages` wybierz `Deploy from a branch`.
3. Wskaż gałąź `main` i katalog `/ (root)`.

Dane użytkownika są zapisywane wyłącznie w `localStorage` danej przeglądarki. Eksport PDF korzysta z systemowego okna drukowania, a eksport DOCX jest generowany lokalnie bez wysyłania danych.

## Funkcje edytora

- cztery edytowalne przykładowe CV Anny Kowalskiej: AP/AR, R2R, Supply Chain Planner oraz Procurement & Data;
- własne nazwy nagłówków sekcji;
- układ jednokolumnowy, wąska/szeroka kolumna oraz siatka modułowa;
- ustawianie sekcji po lewej, prawej lub na całą szerokość;
- własne sekcje i zmiana ich kolejności;
- lokalny zapis, import treści oraz eksport PDF/DOCX.

## Punkt powrotu

Zaakceptowana pierwsza wersja została zachowana w `versions/fundamental-v1`. Pliki w tym katalogu należy traktować jako niezmienny punkt odniesienia i kopiować stamtąd tylko podczas świadomego przywracania.
