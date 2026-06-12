-- FIXER WEB — globalne ustawienia aplikacji (firma, dokumenty, szablony)
-- Uruchom w Supabase SQL Editor po wcześniejszych migracjach.

create table if not exists public.app_settings (
    setting_key text primary key,
    setting_value jsonb not null default '{}'::jsonb,
    updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

drop policy if exists app_settings_select on public.app_settings;
drop policy if exists app_settings_insert on public.app_settings;
drop policy if exists app_settings_update on public.app_settings;
drop policy if exists app_settings_delete on public.app_settings;

create policy app_settings_select on public.app_settings
for select to authenticated using (true);

create policy app_settings_insert on public.app_settings
for insert to authenticated with check (true);

create policy app_settings_update on public.app_settings
for update to authenticated using (true) with check (true);

create policy app_settings_delete on public.app_settings
for delete to authenticated using (true);

create index if not exists app_settings_updated_at_idx on public.app_settings (updated_at desc);
