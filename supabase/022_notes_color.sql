-- Kolor notatki — wizualne oznaczenie w module Notatki.

alter table public.notes add column if not exists note_color text not null default 'default';

notify pgrst, 'reload schema';
