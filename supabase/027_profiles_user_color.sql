-- FIXER WEB — kolor profilu użytkownika.
-- Dodaje wyłącznie profiles.user_color i ustawia domyślny akcent FIXER WEB.

alter table public.profiles
  add column if not exists user_color text not null default '#2563EB';

update public.profiles
set user_color = '#2563EB'
where user_color is null or btrim(user_color) = '';
