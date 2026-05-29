-- FIXER WEB v0.5.2
-- Produkcyjny schemat modułu Klienci + rodzaje klientów + ustawienia tabel.
-- Uruchom ten plik w Supabase SQL Editor jako jedno zapytanie.

create extension if not exists pgcrypto;

create table if not exists public.clients (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    type text default 'Firma',
    client_kind text default 'Stały',
    customer_kind text,
    contact_person text,
    phone text,
    email text,
    street text,
    building_number text,
    apartment_number text,
    postal_code text,
    city text,
    country text default 'Polska',
    nip text,
    regon text,
    notes text,
    note text,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

alter table public.clients add column if not exists name text;
alter table public.clients add column if not exists type text default 'Firma';
alter table public.clients add column if not exists client_kind text default 'Stały';
alter table public.clients add column if not exists customer_kind text;
alter table public.clients add column if not exists contact_person text;
alter table public.clients add column if not exists phone text;
alter table public.clients add column if not exists email text;
alter table public.clients add column if not exists street text;
alter table public.clients add column if not exists building_number text;
alter table public.clients add column if not exists apartment_number text;
alter table public.clients add column if not exists postal_code text;
alter table public.clients add column if not exists city text;
alter table public.clients add column if not exists country text default 'Polska';
alter table public.clients add column if not exists nip text;
alter table public.clients add column if not exists regon text;
alter table public.clients add column if not exists notes text;
alter table public.clients add column if not exists note text;
alter table public.clients add column if not exists created_at timestamptz default now();
alter table public.clients add column if not exists updated_at timestamptz default now();

create table if not exists public.client_types (
    id uuid primary key default gen_random_uuid(),
    name text not null unique,
    sort_order integer default 0,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

insert into public.client_types (name, sort_order)
values
    ('Stały', 1),
    ('Pracownik', 2),
    ('VIP', 3),
    ('Problematyczny', 4),
    ('Nowy', 5),
    ('Zablokowany', 6)
on conflict (name) do nothing;

create table if not exists public.user_table_preferences (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    table_key text not null,
    visible_columns jsonb not null default '[]'::jsonb,
    column_order jsonb not null default '[]'::jsonb,
    column_widths jsonb not null default '{}'::jsonb,
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    unique (user_id, table_key)
);

alter table public.clients enable row level security;
alter table public.client_types enable row level security;
alter table public.user_table_preferences enable row level security;

drop policy if exists clients_select on public.clients;
drop policy if exists clients_insert on public.clients;
drop policy if exists clients_update on public.clients;
drop policy if exists clients_delete on public.clients;

create policy clients_select on public.clients for select to authenticated using (true);
create policy clients_insert on public.clients for insert to authenticated with check (true);
create policy clients_update on public.clients for update to authenticated using (true) with check (true);
create policy clients_delete on public.clients for delete to authenticated using (true);

drop policy if exists client_types_select on public.client_types;
drop policy if exists client_types_insert on public.client_types;
drop policy if exists client_types_update on public.client_types;
drop policy if exists client_types_delete on public.client_types;

create policy client_types_select on public.client_types for select to authenticated using (true);
create policy client_types_insert on public.client_types for insert to authenticated with check (true);
create policy client_types_update on public.client_types for update to authenticated using (true) with check (true);
create policy client_types_delete on public.client_types for delete to authenticated using (true);

drop policy if exists table_preferences_select_own on public.user_table_preferences;
drop policy if exists table_preferences_insert_own on public.user_table_preferences;
drop policy if exists table_preferences_update_own on public.user_table_preferences;
drop policy if exists table_preferences_delete_own on public.user_table_preferences;

create policy table_preferences_select_own on public.user_table_preferences
for select to authenticated using (auth.uid() = user_id);

create policy table_preferences_insert_own on public.user_table_preferences
for insert to authenticated with check (auth.uid() = user_id);

create policy table_preferences_update_own on public.user_table_preferences
for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy table_preferences_delete_own on public.user_table_preferences
for delete to authenticated using (auth.uid() = user_id);
