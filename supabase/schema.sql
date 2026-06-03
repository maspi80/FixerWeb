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

-- Moduł Sprzęt - pełna karta urządzenia i zapis do Supabase.
create table if not exists public.equipment (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    category text,
    brand text,
    model text,
    serial text,
    inventory_number text,
    barcode text,
    status text default 'Dostępny',
    location text,
    purchase_date date,
    notes text,
    description text,
    condition text default 'Bardzo dobry',
    purchase_value text,
    deposit text,
    price_day text,
    price_week text,
    gallery jsonb not null default '[]'::jsonb,
    attachments jsonb not null default '[]'::jsonb,
    set_items jsonb not null default '[]'::jsonb,
    service_notes text,
    history_notes text,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

alter table public.equipment add column if not exists name text;
alter table public.equipment add column if not exists category text;
alter table public.equipment add column if not exists brand text;
alter table public.equipment add column if not exists model text;
alter table public.equipment add column if not exists serial text;
alter table public.equipment add column if not exists inventory_number text;
alter table public.equipment add column if not exists barcode text;
alter table public.equipment add column if not exists status text default 'Dostępny';
alter table public.equipment add column if not exists location text;
alter table public.equipment add column if not exists purchase_date date;
alter table public.equipment add column if not exists notes text;
alter table public.equipment add column if not exists description text;
alter table public.equipment add column if not exists condition text default 'Bardzo dobry';
alter table public.equipment add column if not exists purchase_value text;
alter table public.equipment add column if not exists deposit text;
alter table public.equipment add column if not exists price_day text;
alter table public.equipment add column if not exists price_week text;
alter table public.equipment add column if not exists gallery jsonb not null default '[]'::jsonb;
alter table public.equipment add column if not exists attachments jsonb not null default '[]'::jsonb;
alter table public.equipment add column if not exists set_items jsonb not null default '[]'::jsonb;
alter table public.equipment add column if not exists service_notes text;
alter table public.equipment add column if not exists history_notes text;
alter table public.equipment add column if not exists created_at timestamptz default now();
alter table public.equipment add column if not exists updated_at timestamptz default now();

alter table public.equipment enable row level security;

drop policy if exists equipment_select on public.equipment;
drop policy if exists equipment_insert on public.equipment;
drop policy if exists equipment_update on public.equipment;
drop policy if exists equipment_delete on public.equipment;

create policy equipment_select on public.equipment for select to authenticated using (true);
create policy equipment_insert on public.equipment for insert to authenticated with check (true);
create policy equipment_update on public.equipment for update to authenticated using (true) with check (true);
create policy equipment_delete on public.equipment for delete to authenticated using (true);

-- Atomowa aktualizacja wypożyczenia: update rentals + delete/insert rental_items w jednej transakcji.
create or replace function public.update_rental_with_items(
  p_rental_id uuid,
  p_rental    jsonb,
  p_items     jsonb
)
returns void
language plpgsql
security invoker
as $$
declare
  previous_equipment_ids uuid[];
  next_equipment_ids uuid[];
  removed_equipment_ids uuid[];
begin
  select coalesce(array_agg(distinct equipment_id) filter (where equipment_id is not null), array[]::uuid[])
    into previous_equipment_ids
  from public.rental_items
  where rental_id = p_rental_id;

  update public.rentals set
    rental_number       = p_rental->>'rental_number',
    client_id           = (p_rental->>'client_id')::uuid,
    status              = p_rental->>'status',
    start_date          = (p_rental->>'start_date')::date,
    planned_return_date = nullif(p_rental->>'planned_return_date','')::date,
    actual_return_date  = nullif(p_rental->>'actual_return_date','')::date,
    notes               = p_rental->>'notes',
    total_deposit       = nullif(p_rental->>'total_deposit','')::numeric,
    total_price         = nullif(p_rental->>'total_price','')::numeric,
    updated_at          = now()
  where id = p_rental_id;

  if not found then
    raise exception 'Rental % was not found.', p_rental_id using errcode = 'P0002';
  end if;

  delete from public.rental_items where rental_id = p_rental_id;

  insert into public.rental_items (
    rental_id, equipment_id, parent_set_equipment_id, item_type,
    name_snapshot, serial_snapshot, inventory_number_snapshot, barcode_snapshot,
    status, planned_return_date, returned_at,
    price_day, price_week, deposit,
    condition_out, condition_in, damage_notes, settlement_notes
  )
  select
    p_rental_id,
    nullif(i.equipment_id,'')::uuid,
    nullif(i.parent_set_equipment_id,'')::uuid,
    i.item_type,
    i.name_snapshot, i.serial_snapshot, i.inventory_number_snapshot, i.barcode_snapshot,
    i.status,
    nullif(i.planned_return_date,'')::date,
    nullif(i.returned_at,'')::timestamptz,
    i.price_day,
    i.price_week,
    i.deposit,
    i.condition_out, i.condition_in, i.damage_notes, i.settlement_notes
  from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) as i(
    equipment_id text, parent_set_equipment_id text, item_type text,
    name_snapshot text, serial_snapshot text, inventory_number_snapshot text, barcode_snapshot text,
    status text, planned_return_date text, returned_at text,
    price_day numeric, price_week numeric, deposit numeric,
    condition_out text, condition_in text, damage_notes text, settlement_notes text
  );

  select coalesce(array_agg(distinct equipment_id) filter (where equipment_id is not null), array[]::uuid[])
    into next_equipment_ids
  from public.rental_items
  where rental_id = p_rental_id;

  if cardinality(next_equipment_ids) > 0 then
    update public.equipment
      set status = 'Wypożyczony',
          updated_at = now()
    where id = any(next_equipment_ids);
  end if;

  select coalesce(array_agg(id), array[]::uuid[])
    into removed_equipment_ids
  from unnest(previous_equipment_ids) as previous(id)
  where not (previous.id = any(next_equipment_ids))
    and not exists (
      select 1
      from public.rental_items ri
      where ri.equipment_id = previous.id
        and ri.status = 'issued'
    );

  if cardinality(removed_equipment_ids) > 0 then
    update public.equipment
      set status = 'Dostępny',
          updated_at = now()
    where id = any(removed_equipment_ids);
  end if;
end;
$$;

grant execute on function public.update_rental_with_items(uuid, jsonb, jsonb) to authenticated;
