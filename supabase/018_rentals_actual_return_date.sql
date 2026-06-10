-- FIXER WEB - rzeczywista data zwrotu wypozyczenia.
-- Migracja jest bezpieczna dla istniejacych danych: nie uzupelnia dat historycznych.

alter table public.rentals
add column if not exists actual_return_date date;

create index if not exists idx_rentals_actual_return_date
on public.rentals(actual_return_date);
