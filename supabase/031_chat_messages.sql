-- FIXER WEB - prosty modul Czat.
-- Migracja przygotowana do recznego uruchomienia w Supabase.

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  sender_user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  recipient_user_id uuid references public.profiles(id) on delete cascade,
  message text not null check (length(btrim(message)) > 0 and length(message) <= 4000),
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_created_at_idx on public.chat_messages (created_at);
create index if not exists chat_messages_sender_user_id_idx on public.chat_messages (sender_user_id);
create index if not exists chat_messages_recipient_user_id_idx on public.chat_messages (recipient_user_id);
create index if not exists chat_messages_public_created_at_idx on public.chat_messages (created_at)
  where recipient_user_id is null;
create index if not exists chat_messages_private_pair_created_at_idx on public.chat_messages (
  least(sender_user_id, recipient_user_id),
  greatest(sender_user_id, recipient_user_id),
  created_at
) where recipient_user_id is not null;

alter table public.chat_messages enable row level security;
alter table public.chat_messages replica identity full;

drop trigger if exists chat_messages_force_sender on public.chat_messages;
drop function if exists public.set_chat_message_sender();

create or replace function public.set_chat_message_sender()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.sender_user_id = auth.uid();
  new.message = btrim(new.message);
  return new;
end;
$$;

create trigger chat_messages_force_sender
before insert on public.chat_messages
for each row
execute function public.set_chat_message_sender();

drop policy if exists chat_messages_select_visible on public.chat_messages;
drop policy if exists chat_messages_insert_own on public.chat_messages;
drop policy if exists chat_messages_delete_owner_or_public_admin on public.chat_messages;

create policy chat_messages_select_visible on public.chat_messages
for select to authenticated
using (
  (
    recipient_user_id is null
    and public.has_permission('chat.view')
  )
  or (
    recipient_user_id is not null
    and (sender_user_id = auth.uid() or recipient_user_id = auth.uid())
    and public.has_permission('chat.view')
  )
);

create policy chat_messages_insert_own on public.chat_messages
for insert to authenticated
with check (
  sender_user_id = auth.uid()
  and public.has_permission('chat.create')
  and (
    recipient_user_id is null
    or exists (
      select 1
      from public.profiles recipient
      where recipient.id = recipient_user_id
        and recipient.is_active = true
        and recipient.id <> auth.uid()
    )
  )
);

create policy chat_messages_delete_owner_or_public_admin on public.chat_messages
for delete to authenticated
using (
  public.has_permission('chat.view')
  and (
    sender_user_id = auth.uid()
    or (
      recipient_user_id is null
      and exists (
        select 1
        from public.profiles profile
        where profile.id = auth.uid()
          and profile.is_active = true
          and profile.role = 'admin'
      )
    )
  )
);

drop policy if exists profiles_select_active_chat_users on public.profiles;

create policy profiles_select_active_chat_users on public.profiles
for select to authenticated
using (
  is_active = true
  and public.has_permission('chat.view')
);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'chat_messages'
  ) then
    execute 'alter publication supabase_realtime add table public.chat_messages';
  end if;
end $$;

notify pgrst, 'reload schema';
