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

W Supabase SQL Editor uruchom jako całość plik:

```text
supabase/001_clients_production_schema.sql
```

Ten sam skrypt jest też zapisany w:

```text
supabase/schema.sql
```

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
