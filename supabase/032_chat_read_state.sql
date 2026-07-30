-- FIXER WEB - stan przeczytania rozmow w module Czat.
-- Migracja przygotowana do recznego uruchomienia w Supabase.

create table if not exists public.chat_read_state (
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  conversation_key text not null,
  last_read_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, conversation_key),
  check (
    conversation_key = 'all'
    or conversation_key ~ '^user:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  )
);

create index if not exists chat_read_state_user_id_idx
  on public.chat_read_state (user_id);

alter table public.chat_read_state enable row level security;

drop policy if exists chat_read_state_select_own on public.chat_read_state;
drop policy if exists chat_read_state_insert_own on public.chat_read_state;
drop policy if exists chat_read_state_update_own on public.chat_read_state;
drop policy if exists chat_read_state_delete_own on public.chat_read_state;

create policy chat_read_state_select_own on public.chat_read_state
for select to authenticated
using (user_id = auth.uid());

create policy chat_read_state_insert_own on public.chat_read_state
for insert to authenticated
with check (user_id = auth.uid());

create policy chat_read_state_update_own on public.chat_read_state
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy chat_read_state_delete_own on public.chat_read_state
for delete to authenticated
using (user_id = auth.uid());

drop trigger if exists chat_read_state_set_updated_at on public.chat_read_state;
create trigger chat_read_state_set_updated_at
before update on public.chat_read_state
for each row
execute function public.set_updated_at();

notify pgrst, 'reload schema';
