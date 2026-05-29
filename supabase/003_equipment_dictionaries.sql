create extension if not exists pgcrypto;

create table if not exists public.equipment_dictionaries (
    id uuid primary key default gen_random_uuid(),
    dictionary_type text not null check (dictionary_type in ('category', 'status')),
    name text not null,
    sort_order integer not null default 100,
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    constraint equipment_dictionaries_type_name_unique unique (dictionary_type, name)
);

alter table public.equipment_dictionaries
    add column if not exists dictionary_type text;

alter table public.equipment_dictionaries
    add column if not exists name text;

alter table public.equipment_dictionaries
    add column if not exists sort_order integer not null default 100;

alter table public.equipment_dictionaries
    add column if not exists created_at timestamptz default now();

alter table public.equipment_dictionaries
    add column if not exists updated_at timestamptz default now();

insert into public.equipment_dictionaries (dictionary_type, name, sort_order)
values
    ('category', 'Kamera', 1),
    ('category', 'Obiektyw', 2),
    ('category', 'Audio', 3),
    ('category', 'Mikser Video', 4),
    ('category', 'Streaming', 5),
    ('category', 'Oświetlenie', 6),
    ('category', 'Komputer', 7),
    ('category', 'Akcesoria', 8),
    ('category', 'Zestaw', 9),
    ('status', 'Dostępny', 1),
    ('status', 'Wypożyczony', 2),
    ('status', 'Rezerwacja', 3),
    ('status', 'Serwis', 4),
    ('status', 'Uszkodzony', 5),
    ('status', 'Wycofany', 6),
    ('status', 'Zestaw', 7)
on conflict (dictionary_type, name) do nothing;

alter table public.equipment_dictionaries enable row level security;

drop policy if exists equipment_dictionaries_select on public.equipment_dictionaries;
drop policy if exists equipment_dictionaries_insert on public.equipment_dictionaries;
drop policy if exists equipment_dictionaries_update on public.equipment_dictionaries;
drop policy if exists equipment_dictionaries_delete on public.equipment_dictionaries;

create policy equipment_dictionaries_select
on public.equipment_dictionaries
for select
to authenticated
using (true);

create policy equipment_dictionaries_insert
on public.equipment_dictionaries
for insert
to authenticated
with check (true);

create policy equipment_dictionaries_update
on public.equipment_dictionaries
for update
to authenticated
using (true)
with check (true);

create policy equipment_dictionaries_delete
on public.equipment_dictionaries
for delete
to authenticated
using (true);

create index if not exists idx_equipment_dictionaries_type_sort
on public.equipment_dictionaries(dictionary_type, sort_order, name);
