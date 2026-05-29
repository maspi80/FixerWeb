# Fixer WEB

Etap: Supabase + moduł Klienci.

## Co zawiera paczka

- React + Vite
- przygotowanie Supabase Auth
- tryb demo, gdy Supabase nie jest jeszcze skonfigurowany
- moduł Klienci z dodawaniem, edycją i usuwaniem
- tabela `clients`
- plik SQL: `supabase/schema.sql`
- przygotowanie tabeli `user_preferences`

## Vercel

Po wrzuceniu plików do repo Vercel sam wykona build.

## Supabase

Aby podpiąć prawdziwe dane:
1. W Supabase otwórz SQL Editor.
2. Wklej zawartość `supabase/schema.sql`.
3. Uruchom SQL.
4. W Vercel dodaj zmienne:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
