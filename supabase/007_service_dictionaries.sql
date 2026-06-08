create extension if not exists pgcrypto;

create table if not exists public.service_dictionaries (
    id uuid primary key default gen_random_uuid(),
    dictionary_type text not null check (dictionary_type in ('status', 'priority', 'customer_device_category', 'intake_condition')),
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
    ('intake_condition', 'Uszkodzony', 4)
on conflict (dictionary_type, name) do nothing;

alter table public.service_dictionaries enable row level security;

drop policy if exists service_dictionaries_select on public.service_dictionaries;
drop policy if exists service_dictionaries_insert on public.service_dictionaries;
drop policy if exists service_dictionaries_update on public.service_dictionaries;
drop policy if exists service_dictionaries_delete on public.service_dictionaries;

create policy service_dictionaries_select
on public.service_dictionaries
for select
to authenticated
using (true);

create policy service_dictionaries_insert
on public.service_dictionaries
for insert
to authenticated
with check (true);

create policy service_dictionaries_update
on public.service_dictionaries
for update
to authenticated
using (true)
with check (true);

create policy service_dictionaries_delete
on public.service_dictionaries
for delete
to authenticated
using (true);

create index if not exists idx_service_dictionaries_type_sort
on public.service_dictionaries(dictionary_type, sort_order, name);

notify pgrst, 'reload schema';
