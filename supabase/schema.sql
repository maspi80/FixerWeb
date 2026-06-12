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

-- Moduł Serwis - zlecenia serwisowe, sprzęt klienta, postępy i załączniki.
create table if not exists public.service_orders (
    id uuid primary key default gen_random_uuid(),
    service_number text not null unique,
    claim_type text default 'Pogwarancyjna',
    status text not null default 'Przyjęte',
    priority text not null default 'Normalny',
    client_id uuid references public.clients(id) on delete set null,
    equipment_id uuid references public.equipment(id) on delete set null,
    accepted_date date not null default current_date,
    planned_date date,
    completed_date date,
    customer_device_name text,
    customer_device_brand text,
    customer_device_model text,
    customer_device_serial text,
    customer_device_code text,
    customer_device_category text,
    intake_condition text,
    intake_accessories text,
    intake_visual_notes text,
    fault_description text,
    diagnosis text,
    work_performed text,
    parts_materials text,
    external_service text,
    external_rma_number text,
    external_sent_date date,
    external_return_date date,
    external_cost numeric(12,2),
    external_notes text,
    labor_cost numeric(12,2),
    parts_cost numeric(12,2),
    other_cost numeric(12,2),
    total_cost numeric(12,2),
    estimate_items jsonb not null default '[]'::jsonb,
    estimate_status text not null default 'Roboczy',
    internal_notes text,
    attachments jsonb not null default '[]'::jsonb,
    notes text,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

alter table public.service_orders add column if not exists service_number text;
alter table public.service_orders add column if not exists claim_type text default 'Pogwarancyjna';
alter table public.service_orders add column if not exists status text default 'Przyjęte';
alter table public.service_orders add column if not exists priority text default 'Normalny';
alter table public.service_orders add column if not exists client_id uuid references public.clients(id) on delete set null;
alter table public.service_orders add column if not exists equipment_id uuid references public.equipment(id) on delete set null;
alter table public.service_orders add column if not exists accepted_date date default current_date;
alter table public.service_orders add column if not exists planned_date date;
alter table public.service_orders add column if not exists completed_date date;
alter table public.service_orders add column if not exists customer_device_name text;
alter table public.service_orders add column if not exists customer_device_brand text;
alter table public.service_orders add column if not exists customer_device_model text;
alter table public.service_orders add column if not exists customer_device_serial text;
alter table public.service_orders add column if not exists customer_device_code text;
alter table public.service_orders add column if not exists customer_device_category text;
alter table public.service_orders add column if not exists intake_condition text;
alter table public.service_orders add column if not exists intake_accessories text;
alter table public.service_orders add column if not exists intake_visual_notes text;
alter table public.service_orders add column if not exists fault_description text;
alter table public.service_orders add column if not exists diagnosis text;
alter table public.service_orders add column if not exists work_performed text;
alter table public.service_orders add column if not exists parts_materials text;
alter table public.service_orders add column if not exists external_service text;
alter table public.service_orders add column if not exists external_rma_number text;
alter table public.service_orders add column if not exists external_sent_date date;
alter table public.service_orders add column if not exists external_return_date date;
alter table public.service_orders add column if not exists external_cost numeric(12,2);
alter table public.service_orders add column if not exists external_notes text;
alter table public.service_orders add column if not exists labor_cost numeric(12,2);
alter table public.service_orders add column if not exists parts_cost numeric(12,2);
alter table public.service_orders add column if not exists other_cost numeric(12,2);
alter table public.service_orders add column if not exists total_cost numeric(12,2);
alter table public.service_orders add column if not exists estimate_items jsonb not null default '[]'::jsonb;
alter table public.service_orders add column if not exists estimate_status text default 'Roboczy';
alter table public.service_orders add column if not exists internal_notes text;
alter table public.service_orders add column if not exists attachments jsonb not null default '[]'::jsonb;
alter table public.service_orders add column if not exists notes text;
alter table public.service_orders add column if not exists created_at timestamptz default now();
alter table public.service_orders add column if not exists updated_at timestamptz default now();

create table if not exists public.service_order_progress (
    id uuid primary key default gen_random_uuid(),
    service_order_id uuid not null references public.service_orders(id) on delete cascade,
    entry_text text not null,
    operator_name text,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

alter table public.service_order_progress add column if not exists service_order_id uuid references public.service_orders(id) on delete cascade;
alter table public.service_order_progress add column if not exists entry_text text;
alter table public.service_order_progress add column if not exists operator_name text;
alter table public.service_order_progress add column if not exists created_at timestamptz default now();
alter table public.service_order_progress add column if not exists updated_at timestamptz default now();

create table if not exists public.service_order_attachments (
    id uuid primary key default gen_random_uuid(),
    service_order_id uuid not null references public.service_orders(id) on delete cascade,
    name text,
    file_url text,
    file_type text,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'service_orders_client_id_fkey') then
    alter table public.service_orders
      add constraint service_orders_client_id_fkey foreign key (client_id) references public.clients(id) on delete set null not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'service_orders_equipment_id_fkey') then
    alter table public.service_orders
      add constraint service_orders_equipment_id_fkey foreign key (equipment_id) references public.equipment(id) on delete set null not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'service_order_progress_service_order_id_fkey') then
    alter table public.service_order_progress
      add constraint service_order_progress_service_order_id_fkey foreign key (service_order_id) references public.service_orders(id) on delete cascade not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'service_order_attachments_service_order_id_fkey') then
    alter table public.service_order_attachments
      add constraint service_order_attachments_service_order_id_fkey foreign key (service_order_id) references public.service_orders(id) on delete cascade not valid;
  end if;
end;
$$;

create index if not exists idx_service_orders_service_number on public.service_orders(service_number);
create unique index if not exists idx_service_orders_service_number_unique on public.service_orders(service_number) where service_number is not null;
create index if not exists idx_service_orders_claim_type on public.service_orders(claim_type);
create index if not exists idx_service_orders_status on public.service_orders(status);
create index if not exists idx_service_orders_priority on public.service_orders(priority);
create index if not exists idx_service_orders_client_id on public.service_orders(client_id);
create index if not exists idx_service_orders_equipment_id on public.service_orders(equipment_id);
create index if not exists idx_service_orders_accepted_date on public.service_orders(accepted_date);
create index if not exists idx_service_orders_planned_date on public.service_orders(planned_date);
create index if not exists idx_service_orders_external_service on public.service_orders(external_service);
create index if not exists idx_service_orders_external_sent_date on public.service_orders(external_sent_date);
create index if not exists idx_service_orders_external_return_date on public.service_orders(external_return_date);
create index if not exists idx_service_progress_order_id on public.service_order_progress(service_order_id);
create index if not exists idx_service_attachments_order_id on public.service_order_attachments(service_order_id);

alter table public.service_orders enable row level security;
alter table public.service_order_progress enable row level security;
alter table public.service_order_attachments enable row level security;

drop policy if exists service_orders_select on public.service_orders;
drop policy if exists service_orders_insert on public.service_orders;
drop policy if exists service_orders_update on public.service_orders;
drop policy if exists service_orders_delete on public.service_orders;

create policy service_orders_select on public.service_orders for select to authenticated using (true);
create policy service_orders_insert on public.service_orders for insert to authenticated with check (true);
create policy service_orders_update on public.service_orders for update to authenticated using (true) with check (true);
create policy service_orders_delete on public.service_orders for delete to authenticated using (true);

drop policy if exists service_progress_select on public.service_order_progress;
drop policy if exists service_progress_insert on public.service_order_progress;
drop policy if exists service_progress_update on public.service_order_progress;
drop policy if exists service_progress_delete on public.service_order_progress;

create policy service_progress_select on public.service_order_progress for select to authenticated using (true);
create policy service_progress_insert on public.service_order_progress for insert to authenticated with check (true);
create policy service_progress_update on public.service_order_progress for update to authenticated using (true) with check (true);
create policy service_progress_delete on public.service_order_progress for delete to authenticated using (true);

drop policy if exists service_attachments_select on public.service_order_attachments;
drop policy if exists service_attachments_insert on public.service_order_attachments;
drop policy if exists service_attachments_update on public.service_order_attachments;
drop policy if exists service_attachments_delete on public.service_order_attachments;

create policy service_attachments_select on public.service_order_attachments for select to authenticated using (true);
create policy service_attachments_insert on public.service_order_attachments for insert to authenticated with check (true);
create policy service_attachments_update on public.service_order_attachments for update to authenticated using (true) with check (true);
create policy service_attachments_delete on public.service_order_attachments for delete to authenticated using (true);

-- Słowniki konfiguracji modułu Serwis.
create table if not exists public.service_dictionaries (
    id uuid primary key default gen_random_uuid(),
    dictionary_type text not null check (dictionary_type in ('status', 'priority', 'customer_device_category', 'intake_condition', 'external_service', 'progress_template')),
    name text not null,
    sort_order integer not null default 100,
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    constraint service_dictionaries_type_name_unique unique (dictionary_type, name)
);

alter table public.service_dictionaries
    add column if not exists dictionary_type text;

alter table public.service_dictionaries
    add column if not exists name text;

alter table public.service_dictionaries
    add column if not exists sort_order integer not null default 100;

alter table public.service_dictionaries
    add column if not exists created_at timestamptz default now();

alter table public.service_dictionaries
    add column if not exists updated_at timestamptz default now();

alter table public.service_dictionaries
    drop constraint if exists service_dictionaries_dictionary_type_check;

alter table public.service_dictionaries
    add constraint service_dictionaries_dictionary_type_check
    check (dictionary_type in ('status', 'priority', 'customer_device_category', 'intake_condition', 'external_service', 'progress_template'));

insert into public.service_dictionaries (dictionary_type, name, sort_order)
values
    ('status', 'Przyjęte', 1),
    ('status', 'W diagnozie', 2),
    ('status', 'Oczekuje na części', 3),
    ('status', 'W naprawie', 4),
    ('status', 'Gotowe do odbioru', 5),
    ('status', 'Wydane', 6),
    ('status', 'Anulowane', 7),
    ('priority', 'Niski', 1),
    ('priority', 'Normalny', 2),
    ('priority', 'Wysoki', 3),
    ('priority', 'Pilny', 4),
    ('customer_device_category', 'Kamera', 1),
    ('customer_device_category', 'Obiektyw', 2),
    ('customer_device_category', 'Audio', 3),
    ('customer_device_category', 'Oświetlenie', 4),
    ('customer_device_category', 'Komputer', 5),
    ('customer_device_category', 'Akcesoria', 6),
    ('intake_condition', 'Idealny', 1),
    ('intake_condition', 'Dobry', 2),
    ('intake_condition', 'Dostateczny', 3),
    ('intake_condition', 'Uszkodzony', 4),
    ('external_service', 'Sony Polska', 1),
    ('external_service', 'Panasonic Polska', 2),
    ('external_service', 'Foto-Technika', 3),
    ('external_service', 'CSE', 4),
    ('external_service', 'Własny serwis', 5),
    ('progress_template', 'Wysłano do serwisu zewnętrznego', 1),
    ('progress_template', 'Otrzymano kosztorys', 2),
    ('progress_template', 'Oczekiwanie na decyzję klienta', 3),
    ('progress_template', 'Naprawa zakończona', 4),
    ('progress_template', 'Sprzęt gotowy do odbioru', 5),
    ('progress_template', 'Klient poinformowany telefonicznie', 6)
on conflict (dictionary_type, name) do nothing;

alter table public.service_dictionaries enable row level security;

drop policy if exists service_dictionaries_select on public.service_dictionaries;
drop policy if exists service_dictionaries_insert on public.service_dictionaries;
drop policy if exists service_dictionaries_update on public.service_dictionaries;
drop policy if exists service_dictionaries_delete on public.service_dictionaries;

create policy service_dictionaries_select on public.service_dictionaries for select to authenticated using (true);
create policy service_dictionaries_insert on public.service_dictionaries for insert to authenticated with check (true);
create policy service_dictionaries_update on public.service_dictionaries for update to authenticated using (true) with check (true);
create policy service_dictionaries_delete on public.service_dictionaries for delete to authenticated using (true);

create index if not exists idx_service_dictionaries_type_sort
on public.service_dictionaries(dictionary_type, sort_order, name);

notify pgrst, 'reload schema';

alter table public.rentals add column if not exists vat_rate text default '23';

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
    vat_rate            = coalesce(nullif(p_rental->>'vat_rate',''), '23'),
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
