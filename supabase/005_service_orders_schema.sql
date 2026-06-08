-- Moduł Serwis - zlecenia serwisowe, sprzęt klienta, postępy i załączniki.
-- Uruchom ten plik w Supabase SQL Editor jako migrację dla modułu Serwis.

create extension if not exists pgcrypto;

create table if not exists public.service_orders (
    id uuid primary key default gen_random_uuid(),
    service_number text not null unique,
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
    labor_cost numeric(12,2),
    parts_cost numeric(12,2),
    other_cost numeric(12,2),
    total_cost numeric(12,2),
    estimate_status text not null default 'Roboczy',
    internal_notes text,
    attachments jsonb not null default '[]'::jsonb,
    notes text,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

alter table public.service_orders add column if not exists service_number text;
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
alter table public.service_orders add column if not exists labor_cost numeric(12,2);
alter table public.service_orders add column if not exists parts_cost numeric(12,2);
alter table public.service_orders add column if not exists other_cost numeric(12,2);
alter table public.service_orders add column if not exists total_cost numeric(12,2);
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
create index if not exists idx_service_orders_status on public.service_orders(status);
create index if not exists idx_service_orders_priority on public.service_orders(priority);
create index if not exists idx_service_orders_client_id on public.service_orders(client_id);
create index if not exists idx_service_orders_equipment_id on public.service_orders(equipment_id);
create index if not exists idx_service_orders_accepted_date on public.service_orders(accepted_date);
create index if not exists idx_service_orders_planned_date on public.service_orders(planned_date);
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

notify pgrst, 'reload schema';
