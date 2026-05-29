# Fixer WEB

Etap: v0.4 — Supabase + moduły Klienci i Sprzęt.

## Co zawiera paczka

- React + Vite
- przygotowanie Supabase Auth
- tryb demo, gdy Supabase nie jest jeszcze skonfigurowany
- moduł Klienci z dodawaniem, edycją i usuwaniem
- moduł Sprzęt z dodawaniem, edycją i usuwaniem
- tabele Supabase: `clients`, `equipment`, `user_preferences`
- plik SQL: `supabase/schema.sql`
- sortowanie tabel
- ukrywanie i pokazywanie kolumn tabel
- zachowanie ustawień widoku w localStorage

## Nowości w v0.4

- pełny edytor sprzętu
- pola: nazwa, kategoria, status, marka, model, numer seryjny, numer inwentarzowy, kod kreskowy/QR, lokalizacja, data zakupu, notatki
- usługa `equipmentService.js` do komunikacji z Supabase
- rozszerzony `schema.sql` o tabelę `equipment` i polityki RLS
- zaktualizowane dane demo sprzętu

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

Jeżeli schema była już uruchamiana wcześniej, można uruchomić aktualny plik ponownie. Tabele są tworzone przez `create table if not exists`, a polityki są odświeżane przez `drop policy if exists`.
