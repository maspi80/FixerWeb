create table if not exists public.calendar_events (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    description text,
    start_at timestamptz not null,
    end_at timestamptz,
    all_day boolean not null default true,
    color text,
    location text,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

alter table public.calendar_events add column if not exists title text;
alter table public.calendar_events add column if not exists description text;
alter table public.calendar_events add column if not exists start_at timestamptz;
alter table public.calendar_events add column if not exists end_at timestamptz;
alter table public.calendar_events add column if not exists all_day boolean not null default true;
alter table public.calendar_events add column if not exists color text;
alter table public.calendar_events add column if not exists location text;
alter table public.calendar_events add column if not exists created_at timestamptz default now();
alter table public.calendar_events add column if not exists updated_at timestamptz default now();

create index if not exists idx_calendar_events_start_at on public.calendar_events(start_at);
create index if not exists idx_calendar_events_end_at on public.calendar_events(end_at);

alter table public.calendar_events enable row level security;

drop policy if exists calendar_events_select on public.calendar_events;
drop policy if exists calendar_events_insert on public.calendar_events;
drop policy if exists calendar_events_update on public.calendar_events;
drop policy if exists calendar_events_delete on public.calendar_events;

create policy calendar_events_select on public.calendar_events for select to authenticated using (true);
create policy calendar_events_insert on public.calendar_events for insert to authenticated with check (true);
create policy calendar_events_update on public.calendar_events for update to authenticated using (true) with check (true);
create policy calendar_events_delete on public.calendar_events for delete to authenticated using (true);
