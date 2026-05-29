create extension if not exists "uuid-ossp";

create table if not exists public.clients (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  type text not null default 'Firma',
  client_kind text not null default 'Stały',
  phone text,
  email text,
  contact_person text,
  street text,
  building_number text,
  apartment_number text,
  postal_code text,
  city text,
  country text not null default 'Polska',
  nip text,
  regon text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.clients add column if not exists client_kind text not null default 'Stały';
alter table public.clients add column if not exists contact_person text;
alter table public.clients add column if not exists street text;
alter table public.clients add column if not exists building_number text;
alter table public.clients add column if not exists apartment_number text;
alter table public.clients add column if not exists postal_code text;
alter table public.clients add column if not exists city text;
alter table public.clients add column if not exists country text not null default 'Polska';
alter table public.clients add column if not exists nip text;
alter table public.clients add column if not exists regon text;
alter table public.clients add column if not exists notes text;
alter table public.clients add column if not exists updated_at timestamptz not null default now();

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

create table if not exists public.equipment (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  category text not null default 'Sprzęt',
  brand text,
  model text,
  serial text,
  inventory_number text,
  barcode text,
  status text not null default 'Dostępny',
  location text,
  purchase_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.equipment enable row level security;

drop policy if exists "Authenticated users can read equipment" on public.equipment;
create policy "Authenticated users can read equipment"
on public.equipment for select
to authenticated
using (true);

drop policy if exists "Authenticated users can insert equipment" on public.equipment;
create policy "Authenticated users can insert equipment"
on public.equipment for insert
to authenticated
with check (true);

drop policy if exists "Authenticated users can update equipment" on public.equipment;
create policy "Authenticated users can update equipment"
on public.equipment for update
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated users can delete equipment" on public.equipment;
create policy "Authenticated users can delete equipment"
on public.equipment for delete
to authenticated
using (true);

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
