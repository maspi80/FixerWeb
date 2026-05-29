create extension if not exists "uuid-ossp";

create table if not exists public.clients (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  type text not null default 'Firma',
  phone text,
  email text,
  rating text not null default 'Dobry',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

insert into public.clients (name, type, phone, email, rating, notes)
values
('Adam Kowalski', 'Osoba prywatna', '+48 600 100 200', 'adam@example.com', 'Ryzykowny', 'Klient testowy z historią opóźnień.'),
('Studio Alfa', 'Firma', '+48 600 300 400', 'kontakt@studioalfa.pl', 'Dobry', 'Stały klient firmowy.'),
('BMX Media', 'Firma', '+48 600 500 600', 'office@bmxmedia.pl', 'Bardzo dobry', 'Klient testowy.')
on conflict do nothing;
