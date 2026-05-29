create extension if not exists "uuid-ossp";

create table if not exists public.clients (
  id uuid primary key default uuid_generate_v4()
);

alter table public.clients add column if not exists name text;
alter table public.clients add column if not exists type text;
alter table public.clients add column if not exists client_kind text;
alter table public.clients add column if not exists phone text;
alter table public.clients add column if not exists email text;
alter table public.clients add column if not exists street text;
alter table public.clients add column if not exists building_number text;
alter table public.clients add column if not exists apartment_number text;
alter table public.clients add column if not exists postal_code text;
alter table public.clients add column if not exists city text;
alter table public.clients add column if not exists country text;
alter table public.clients add column if not exists nip text;
alter table public.clients add column if not exists regon text;
alter table public.clients add column if not exists notes text;
alter table public.clients add column if not exists created_at timestamptz default now();
alter table public.clients add column if not exists updated_at timestamptz default now();

update public.clients set name = coalesce(nullif(name, ''), 'Klient bez nazwy') where name is null or name = '';
update public.clients set type = coalesce(nullif(type, ''), 'Firma') where type is null or type = '';
update public.clients set client_kind = coalesce(nullif(client_kind, ''), 'Stały') where client_kind is null or client_kind = '';
update public.clients set country = coalesce(nullif(country, ''), 'Polska') where country is null or country = '';
update public.clients set created_at = coalesce(created_at, now()) where created_at is null;
update public.clients set updated_at = coalesce(updated_at, now()) where updated_at is null;

alter table public.clients alter column name set not null;
alter table public.clients alter column type set default 'Firma';
alter table public.clients alter column type set not null;
alter table public.clients alter column client_kind set default 'Stały';
alter table public.clients alter column client_kind set not null;
alter table public.clients alter column country set default 'Polska';
alter table public.clients alter column country set not null;
alter table public.clients alter column created_at set default now();
alter table public.clients alter column created_at set not null;
alter table public.clients alter column updated_at set default now();
alter table public.clients alter column updated_at set not null;

alter table public.clients enable row level security;

drop policy if exists "Authenticated users can read clients" on public.clients;
create policy "Authenticated users can read clients"
on public.clients for select
to authenticated
using (true);

drop policy if exists "Authenticated users can insert clients" on public.clients;
create policy "Authenticated users can insert clients"
on public.clients for insert
to authenticated
with check (true);

drop policy if exists "Authenticated users can update clients" on public.clients;
create policy "Authenticated users can update clients"
on public.clients for update
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated users can delete clients" on public.clients;
create policy "Authenticated users can delete clients"
on public.clients for delete
to authenticated
using (true);

create table if not exists public.client_types (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.client_types enable row level security;

drop policy if exists "Authenticated users can read client types" on public.client_types;
create policy "Authenticated users can read client types"
on public.client_types for select
to authenticated
using (true);

drop policy if exists "Authenticated users can insert client types" on public.client_types;
create policy "Authenticated users can insert client types"
on public.client_types for insert
to authenticated
with check (true);

drop policy if exists "Authenticated users can update client types" on public.client_types;
create policy "Authenticated users can update client types"
on public.client_types for update
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated users can delete client types" on public.client_types;
create policy "Authenticated users can delete client types"
on public.client_types for delete
to authenticated
using (true);

insert into public.client_types (name, sort_order)
values
('Stały', 1),
('Pracownik', 2),
('VIP', 3),
('Problematyczny', 4),
('Nowy', 5),
('Zablokowany', 6)
on conflict (name) do nothing;

create table if not exists public.user_preferences (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null,
  preference_key text not null,
  preference_value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique(user_id, preference_key)
);

alter table public.user_preferences enable row level security;

drop policy if exists "Users can read own preferences" on public.user_preferences;
create policy "Users can read own preferences"
on public.user_preferences for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own preferences" on public.user_preferences;
create policy "Users can insert own preferences"
on public.user_preferences for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own preferences" on public.user_preferences;
create policy "Users can update own preferences"
on public.user_preferences for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
