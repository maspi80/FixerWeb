-- Moduł Notatki — szybkie notatki tekstowe.
-- Uruchom ten plik w Supabase SQL Editor jako migrację dla modułu Notatki.

create extension if not exists pgcrypto;

create table if not exists public.notes (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    content text,
    status text not null default 'Aktywna',
    priority text not null default 'Normalny',
    pinned boolean not null default false,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

alter table public.notes add column if not exists title text;
alter table public.notes add column if not exists content text;
alter table public.notes add column if not exists status text default 'Aktywna';
alter table public.notes add column if not exists priority text default 'Normalny';
alter table public.notes add column if not exists pinned boolean not null default false;
alter table public.notes add column if not exists created_at timestamptz default now();
alter table public.notes add column if not exists updated_at timestamptz default now();

create index if not exists idx_notes_status on public.notes(status);
create index if not exists idx_notes_pinned on public.notes(pinned);
create index if not exists idx_notes_updated_at on public.notes(updated_at desc);

alter table public.notes enable row level security;

drop policy if exists notes_select on public.notes;
drop policy if exists notes_insert on public.notes;
drop policy if exists notes_update on public.notes;
drop policy if exists notes_delete on public.notes;

create policy notes_select on public.notes for select to authenticated using (true);
create policy notes_insert on public.notes for insert to authenticated with check (true);
create policy notes_update on public.notes for update to authenticated using (true) with check (true);
create policy notes_delete on public.notes for delete to authenticated using (true);

notify pgrst, 'reload schema';
