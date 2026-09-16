# FIXER WEB v0.5.2

Wersja dopracowująca moduł Klienci po uruchomieniu prawdziwego zapisu w Supabase.

## Zmiany

- uporządkowany schemat tabeli `clients`, zgodny z aktualną kartoteką klienta,
- pełny zapis, odczyt, edycja i usuwanie klientów w Supabase,
- tabela `client_types` dla edytowalnych rodzajów klientów w Ustawieniach,
- tabela `user_table_preferences` dla zapamiętywania ustawień tabel użytkownika,
- ustawienia tabel są zapisywane per użytkownik:
  - widoczność kolumn,
  - kolejność kolumn,
  - szerokość kolumn,
- zachowany lokalny fallback ustawień tabel, gdy połączenie z bazą chwilowo nie odpowiada,
- ujednolicony plik SQL do uruchomienia w Supabase jako jedno zapytanie.

## Supabase

Zmiany bazy są zapisane jako kolejno numerowane migracje w katalogu
`supabase/`. Plik `schema.sql` jest historycznym schematem bazowym i nie
zawiera wszystkich późniejszych zmian. Nie należy używać go jako zamiennika
pełnego zestawu migracji.

Przed wdrożeniem sprawdź [checklistę migracji](docs/SUPABASE_MIGRATIONS.md) i
uruchom migracje, których brakuje w danym środowisku, w kolejności numerów.

W Vercel muszą być ustawione zmienne środowiskowe:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```


## v0.5.5
- Zablokowano przewijanie całego widoku modułu przy długich tabelach.
- Górna sekcja modułu pozostaje w miejscu.
- Przewija się wyłącznie zawartość tabeli.
- Nagłówek tabeli pozostaje widoczny podczas przewijania listy.
