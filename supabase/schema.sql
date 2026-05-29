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

update public.clients
set client_kind = case
  when rating = 'Ryzykowny' then 'Problematyczny'
  when rating = 'Bardzo dobry' then 'VIP'
  when rating = 'Dobry' then 'Stały'
  else coalesce(client_kind, 'Stały')
end
where client_kind is null or client_kind = 'Stały';

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

insert into public.clients (name, type, client_kind, phone, email, contact_person, street, building_number, apartment_number, postal_code, city, country, nip, regon, notes)
values
('Adam Kowalski', 'Osoba prywatna', 'Problematyczny', '+48 600 100 200', 'adam@example.com', '', 'Gliwicka', '12', '4', '41-800', 'Zabrze', 'Polska', '', '', 'Klient testowy z historią opóźnień.'),
('Studio Alfa', 'Firma', 'Stały', '+48 600 300 400', 'kontakt@studioalfa.pl', 'Anna Nowak', 'Wolności', '20', '', '41-500', 'Chorzów', 'Polska', '6270000000', '270000000', 'Stały klient firmowy.'),
('BMX Media', 'Firma', 'VIP', '+48 600 500 600', 'office@bmxmedia.pl', 'Mariusz', 'Techniczna', '7', '', '44-100', 'Gliwice', 'Polska', '6310000000', '240000000', 'Klient testowy.')
on conflict do nothing;


insert into public.equipment (name, category, brand, model, serial, inventory_number, barcode, status, location, purchase_date, notes)
values
('Kamera Sony PXW-Z190', 'Kamera', 'Sony', 'PXW-Z190', 'Y80413N232910D', 'KAM-001', 'Y80413N232910D', 'Wypożyczony', 'U klienta', '2024-03-12', 'Główna kamera ENG.'),
('Walizka stream CASE-04', 'Zestaw', 'Custom', 'CASE-04', 'CASE-04', 'SET-004', 'CASE-04', 'Zestaw', 'Magazyn', '2025-01-18', 'Zestaw streamingowy do realizacji mobilnych.'),
('Mikser Yamaha MG12XU', 'Audio', 'Yamaha', 'MG12XU', 'MG12XU-7781', 'AUD-012', 'MG12XU-7781', 'Serwis', 'Serwis wewnętrzny', '2023-09-04', 'Do weryfikacji potencjometr kanału 3.')
on conflict do nothing;
