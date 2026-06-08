-- Moduł Organizer - zadania operatora.
-- Uruchom ten plik w Supabase SQL Editor jako migrację dla modułu Organizer.

create extension if not exists pgcrypto;

create table if not exists public.organizer_tasks (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    description text,
    status text not null default 'Do zrobienia',
    priority text not null default 'Normalny',
    due_date date,
    reminder_at timestamptz,
    category text,
    linked_module text,
    linked_id uuid,
    linked_label text,
    archived boolean not null default false,
    completed_date date,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

alter table public.organizer_tasks add column if not exists title text;
alter table public.organizer_tasks add column if not exists description text;
alter table public.organizer_tasks add column if not exists status text default 'Do zrobienia';
alter table public.organizer_tasks add column if not exists priority text default 'Normalny';
alter table public.organizer_tasks add column if not exists due_date date;
alter table public.organizer_tasks add column if not exists reminder_at timestamptz;
alter table public.organizer_tasks add column if not exists category text;
alter table public.organizer_tasks add column if not exists linked_module text;
alter table public.organizer_tasks add column if not exists linked_id uuid;
alter table public.organizer_tasks add column if not exists linked_label text;
alter table public.organizer_tasks add column if not exists archived boolean not null default false;
alter table public.organizer_tasks add column if not exists completed_date date;
alter table public.organizer_tasks add column if not exists created_at timestamptz default now();
alter table public.organizer_tasks add column if not exists updated_at timestamptz default now();

create table if not exists public.organizer_categories (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    sort_order integer not null default 100,
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    constraint organizer_categories_name_unique unique (name)
);

alter table public.organizer_categories add column if not exists name text;
alter table public.organizer_categories add column if not exists sort_order integer not null default 100;
alter table public.organizer_categories add column if not exists created_at timestamptz default now();
alter table public.organizer_categories add column if not exists updated_at timestamptz default now();

create index if not exists idx_organizer_tasks_status on public.organizer_tasks(status);
create index if not exists idx_organizer_tasks_priority on public.organizer_tasks(priority);
create index if not exists idx_organizer_tasks_due_date on public.organizer_tasks(due_date);
create index if not exists idx_organizer_tasks_archived on public.organizer_tasks(archived);
create index if not exists idx_organizer_tasks_reminder on public.organizer_tasks(reminder_at);
create index if not exists idx_organizer_categories_sort on public.organizer_categories(sort_order, name);

alter table public.organizer_tasks enable row level security;
alter table public.organizer_categories enable row level security;

drop policy if exists organizer_tasks_select on public.organizer_tasks;
drop policy if exists organizer_tasks_insert on public.organizer_tasks;
drop policy if exists organizer_tasks_update on public.organizer_tasks;
drop policy if exists organizer_tasks_delete on public.organizer_tasks;

create policy organizer_tasks_select on public.organizer_tasks for select to authenticated using (true);
create policy organizer_tasks_insert on public.organizer_tasks for insert to authenticated with check (true);
create policy organizer_tasks_update on public.organizer_tasks for update to authenticated using (true) with check (true);
create policy organizer_tasks_delete on public.organizer_tasks for delete to authenticated using (true);

drop policy if exists organizer_categories_select on public.organizer_categories;
drop policy if exists organizer_categories_insert on public.organizer_categories;
drop policy if exists organizer_categories_update on public.organizer_categories;
drop policy if exists organizer_categories_delete on public.organizer_categories;

create policy organizer_categories_select on public.organizer_categories for select to authenticated using (true);
create policy organizer_categories_insert on public.organizer_categories for insert to authenticated with check (true);
create policy organizer_categories_update on public.organizer_categories for update to authenticated using (true) with check (true);
create policy organizer_categories_delete on public.organizer_categories for delete to authenticated using (true);

insert into public.organizer_categories (name, sort_order)
values
    ('Ogólne', 1),
    ('Serwis', 2),
    ('Wypożyczenia', 3),
    ('Klienci', 4),
    ('Administracja', 5)
on conflict (name) do nothing;

notify pgrst, 'reload schema';
