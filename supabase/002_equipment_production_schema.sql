
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
