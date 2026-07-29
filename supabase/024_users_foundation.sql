-- FIXER WEB — fundament systemu użytkowników i uprawnień.
-- Etap 1: profiles + user_permissions bez zmiany istniejących tabel biznesowych.

create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    email text,
    full_name text not null default '',
    role text not null default 'user' check (role in ('admin', 'user')),
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.user_permissions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    permission_key text not null,
    allowed boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (user_id, permission_key),
    check (permission_key = lower(trim(permission_key)) and permission_key ~ '^[a-z0-9_]+(\.[a-z0-9_]+)+$')
);

create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists profiles_is_active_idx on public.profiles (is_active);
create index if not exists user_permissions_user_id_idx on public.user_permissions (user_id);
create index if not exists user_permissions_permission_key_idx on public.user_permissions (permission_key);

alter table public.profiles enable row level security;
alter table public.user_permissions enable row level security;

drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_insert_own_default on public.profiles;
drop policy if exists user_permissions_select_own on public.user_permissions;

create policy profiles_select_own on public.profiles
for select to authenticated
using (auth.uid() = id);

create policy profiles_insert_own_default on public.profiles
for insert to authenticated
with check (
    auth.uid() = id
    and role = 'user'
    and is_active = true
);

create policy user_permissions_select_own on public.user_permissions
for select to authenticated
using (auth.uid() = user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

drop trigger if exists user_permissions_set_updated_at on public.user_permissions;
create trigger user_permissions_set_updated_at
before update on public.user_permissions
for each row
execute function public.set_updated_at();

create or replace function public.handle_new_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, is_active)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    'user',
    true
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_create_profile on auth.users;
create trigger on_auth_user_created_create_profile
after insert on auth.users
for each row
execute function public.handle_new_auth_user_profile();

insert into public.profiles (id, email, full_name, role, is_active)
select
    users.id,
    users.email,
    coalesce(users.raw_user_meta_data->>'full_name', ''),
    'user',
    true
from auth.users
where not exists (
    select 1
    from public.profiles
    where profiles.id = users.id
);

-- Opcjonalny krok po migracji, wykonywany ręcznie po wskazaniu konkretnego użytkownika:
-- update public.profiles
-- set role = 'admin'
-- where id = '<AUTH_USER_ID_DO_USTAWIENIA_JAKO_ADMIN>';

notify pgrst, 'reload schema';
