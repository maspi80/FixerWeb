# Supabase — checklista migracji

Migracje są wykonywane ręcznie w Supabase SQL Editor. Repozytorium nie ma
jeszcze automatycznego rejestru wdrożonych migracji, dlatego stan każdego
środowiska trzeba potwierdzić przed publikacją aplikacji.

## Kolejność

Uruchamiaj pliki `supabase/001_*.sql`–`supabase/050_*.sql` rosnąco. Numery są
unikalne i ciągłe; kontroluje to komenda:

```bash
npm run verify:migrations
```

Najważniejsze grupy:

| Zakres | Obszar |
| --- | --- |
| 001–012 | Klienci, sprzęt, wypożyczenia, serwis, organizer i kalendarz |
| 013–019 | Projekty, komentarze oraz rozszerzenia wypożyczeń |
| 020–023 | Ustawienia aplikacji, notatki i kolejność zadań projektowych |
| 024–030 | Użytkownicy, uprawnienia projektów i profile |
| 031–046 | Chat, integralność danych i cykl życia konwersacji |
| 047–050 | Realtime organizera, replica identity i ręczne sortowanie |

## Przed wdrożeniem

- Wykonaj backup bazy.
- Ustal ostatnią potwierdzoną migrację na środowisku.
- Przejrzyj każdą brakującą migrację, zwłaszcza operacje `UPDATE`, funkcje
  `security definer` oraz zmiany RLS.
- Uruchom brakujące pliki kolejno i zapisz datę wykonania w historii wdrożenia.
- Po migracjach odśwież cache PostgREST, jeśli dany plik nie wykonuje
  `NOTIFY pgrst, 'reload schema'`.

## Kontrola funkcjonalna

Po zastosowaniu migracji sprawdź:

- logowanie użytkownika aktywnego i odrzucenie użytkownika nieaktywnego;
- uprawnienia `projects.view/create/edit/delete` dla administratora i zwykłego
  użytkownika;
- utworzenie oraz zmianę kolejności projektu, zadania i notatki;
- wysłanie wiadomości prywatnej i publicznej oraz oznaczenie jej jako odczytanej;
- utworzenie wypożyczenia, częściowy zwrot i pełny zwrot;
- backup i próbne odtworzenie na środowisku testowym.

## Stan produkcji

Uzupełnij przy każdym wdrożeniu:

| Środowisko | Ostatnia migracja | Data | Wykonał | Uwagi |
| --- | --- | --- | --- | --- |
| Production | do potwierdzenia | — | — | — |
| Staging | do potwierdzenia | — | — | — |
