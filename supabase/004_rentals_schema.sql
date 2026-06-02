-- Moduł Wypożyczenia - pierwszy CRUD wypożyczeń i pozycji sprzętowych.
create table if not exists public.rentals (
    id uuid primary key default gen_random_uuid(),
    rental_number text not null unique,
    client_id uuid not null references public.clients(id) on delete restrict,
    status text not null default 'active',
    start_date date not null default current_date,
    planned_return_date date,
    actual_return_date date,
    notes text,
    total_deposit numeric(12,2),
    total_price numeric(12,2),
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    constraint rentals_status_check check (status in ('active', 'partially_returned', 'returned'))
);

create table if not exists public.rental_items (
    id uuid primary key default gen_random_uuid(),
    rental_id uuid not null references public.rentals(id) on delete cascade,
    equipment_id uuid references public.equipment(id) on delete restrict,
    parent_set_equipment_id uuid references public.equipment(id) on delete set null,
    item_type text not null default 'single',
    name_snapshot text not null,
    serial_snapshot text,
    inventory_number_snapshot text,
    barcode_snapshot text,
    status text not null default 'issued',
    planned_return_date date,
    returned_at timestamptz,
    price_day numeric(12,2),
    price_week numeric(12,2),
    deposit numeric(12,2),
    condition_out text,
    condition_in text,
    damage_notes text,
    settlement_notes text,
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    constraint rental_items_type_check check (item_type in ('single', 'set', 'set_component')),
    constraint rental_items_status_check check (status in ('issued', 'returned', 'damaged', 'lost', 'service_required'))
);

alter table public.rentals add column if not exists rental_number text;
alter table public.rentals add column if not exists client_id uuid;
alter table public.rentals add column if not exists status text default 'active';
alter table public.rentals add column if not exists start_date date default current_date;
alter table public.rentals add column if not exists planned_return_date date;
alter table public.rentals add column if not exists actual_return_date date;
alter table public.rentals add column if not exists notes text;
alter table public.rentals add column if not exists total_deposit numeric(12,2);
alter table public.rentals add column if not exists total_price numeric(12,2);
alter table public.rentals add column if not exists created_at timestamptz default now();
alter table public.rentals add column if not exists updated_at timestamptz default now();

alter table public.rental_items add column if not exists rental_id uuid;
alter table public.rental_items add column if not exists equipment_id uuid;
alter table public.rental_items add column if not exists parent_set_equipment_id uuid;
alter table public.rental_items add column if not exists item_type text default 'single';
alter table public.rental_items add column if not exists name_snapshot text;
alter table public.rental_items add column if not exists serial_snapshot text;
alter table public.rental_items add column if not exists inventory_number_snapshot text;
alter table public.rental_items add column if not exists barcode_snapshot text;
alter table public.rental_items add column if not exists status text default 'issued';
alter table public.rental_items add column if not exists planned_return_date date;
alter table public.rental_items add column if not exists returned_at timestamptz;
alter table public.rental_items add column if not exists price_day numeric(12,2);
alter table public.rental_items add column if not exists price_week numeric(12,2);
alter table public.rental_items add column if not exists deposit numeric(12,2);
alter table public.rental_items add column if not exists condition_out text;
alter table public.rental_items add column if not exists condition_in text;
alter table public.rental_items add column if not exists damage_notes text;
alter table public.rental_items add column if not exists settlement_notes text;
alter table public.rental_items add column if not exists created_at timestamptz default now();
alter table public.rental_items add column if not exists updated_at timestamptz default now();

create index if not exists idx_rentals_client_id on public.rentals(client_id);
create index if not exists idx_rentals_status on public.rentals(status);
create index if not exists idx_rentals_start_date on public.rentals(start_date);
create index if not exists idx_rentals_planned_return_date on public.rentals(planned_return_date);
create index if not exists idx_rentals_created_at on public.rentals(created_at);

create index if not exists idx_rental_items_rental_id on public.rental_items(rental_id);
create index if not exists idx_rental_items_equipment_id on public.rental_items(equipment_id);
create index if not exists idx_rental_items_status on public.rental_items(status);
create index if not exists idx_rental_items_parent_set_equipment_id on public.rental_items(parent_set_equipment_id);
create index if not exists idx_rental_items_equipment_active
on public.rental_items(equipment_id, status)
where status = 'issued';

alter table public.rentals enable row level security;
alter table public.rental_items enable row level security;

drop policy if exists rentals_select on public.rentals;
drop policy if exists rentals_insert on public.rentals;
drop policy if exists rentals_update on public.rentals;
drop policy if exists rentals_delete on public.rentals;

create policy rentals_select on public.rentals for select to authenticated using (true);
create policy rentals_insert on public.rentals for insert to authenticated with check (true);
create policy rentals_update on public.rentals for update to authenticated using (true) with check (true);
create policy rentals_delete on public.rentals for delete to authenticated using (true);

drop policy if exists rental_items_select on public.rental_items;
drop policy if exists rental_items_insert on public.rental_items;
drop policy if exists rental_items_update on public.rental_items;
drop policy if exists rental_items_delete on public.rental_items;

create policy rental_items_select on public.rental_items for select to authenticated using (true);
create policy rental_items_insert on public.rental_items for insert to authenticated with check (true);
create policy rental_items_update on public.rental_items for update to authenticated using (true) with check (true);
create policy rental_items_delete on public.rental_items for delete to authenticated using (true);
