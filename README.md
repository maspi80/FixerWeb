# FIXER WEB v0.5.0

Wersja rozwijająca moduł Klienci jako realny moduł roboczy z zapisem do Supabase.

## Zmiany

- klienci są pobierani z tabeli `clients` w Supabase,
- dodawanie klienta zapisuje rekord w bazie,
- edycja klienta aktualizuje rekord w bazie,
- usuwanie klienta usuwa rekord z bazy,
- rodzaje klientów są przechowywane w tabeli `client_types`,
- usunięto komunikaty o trybie demo z interfejsu,
- ustawienia tabel pozostają zapamiętywane po ponownym otwarciu programu:
  - widoczność kolumn,
  - kolejność kolumn,
  - szerokość kolumn.

## Supabase

Przed użyciem modułu Klienci uruchom zawartość pliku:

```text
supabase/schema.sql
```

w panelu Supabase SQL Editor.

W Vercel muszą być ustawione zmienne środowiskowe:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```
