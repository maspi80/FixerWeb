-- FIXER WEB - finalna logika cyklu zycia rozmow i wiadomosci czatu.
-- Migracja przygotowana do recznego uruchomienia w Supabase.

alter table public.chat_conversation_members
  add column if not exists deleted_at timestamptz;

alter table public.chat_messages
  add column if not exists deleted_at timestamptz;

create index if not exists chat_conversation_members_active_user_idx
  on public.chat_conversation_members (user_id, conversation_id)
  where deleted_at is null;

create index if not exists chat_messages_deleted_at_idx
  on public.chat_messages (deleted_at);

create or replace function public.is_chat_conversation_member(
  conversation_id uuid,
  user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.chat_conversation_members member
    join public.profiles profile on profile.id = member.user_id
    where member.conversation_id = $1
      and member.user_id = $2
      and member.deleted_at is null
      and profile.is_active = true
  );
$$;

revoke all on function public.is_chat_conversation_member(uuid, uuid) from public;
grant execute on function public.is_chat_conversation_member(uuid, uuid) to authenticated;

create or replace function public.hide_chat_conversation(p_conversation_id uuid)
returns table (
  id uuid,
  physically_deleted boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  remaining_members_count integer;
begin
  if current_user_id is null then
    raise exception 'Uzytkownik nie jest zalogowany.'
      using errcode = '28000';
  end if;

  if not public.has_permission('chat.view') then
    raise exception 'Brak uprawnienia chat.view.'
      using errcode = '42501';
  end if;

  update public.chat_conversation_members member
  set deleted_at = coalesce(member.deleted_at, now())
  where member.conversation_id = p_conversation_id
    and member.user_id = current_user_id;

  if not found then
    raise exception 'Rozmowa nie istnieje albo uzytkownik nie jest jej uczestnikiem.'
      using errcode = '42501';
  end if;

  delete from public.chat_read_state
  where user_id = current_user_id
    and conversation_key = 'conversation:' || p_conversation_id::text;

  select count(*) into remaining_members_count
  from public.chat_conversation_members member
  where member.conversation_id = p_conversation_id
    and member.deleted_at is null;

  if remaining_members_count = 0 then
    delete from public.chat_conversations conversation
    where conversation.id = p_conversation_id;

    return query
    select p_conversation_id, true;
    return;
  end if;

  return query
  select p_conversation_id, false;
end;
$$;

revoke all on function public.hide_chat_conversation(uuid) from public;
grant execute on function public.hide_chat_conversation(uuid) to authenticated;

create or replace function public.soft_delete_chat_message(p_message_id uuid)
returns table (
  id uuid,
  conversation_id uuid,
  sender_user_id uuid,
  recipient_user_id uuid,
  message text,
  created_at timestamptz,
  deleted_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Uzytkownik nie jest zalogowany.'
      using errcode = '28000';
  end if;

  return query
  update public.chat_messages chat_message
  set deleted_at = coalesce(chat_message.deleted_at, now())
  where chat_message.id = p_message_id
    and chat_message.sender_user_id = current_user_id
  returning
    chat_message.id,
    chat_message.conversation_id,
    chat_message.sender_user_id,
    chat_message.recipient_user_id,
    chat_message.message,
    chat_message.created_at,
    chat_message.deleted_at;

  if not found then
    raise exception 'Wiadomosc nie istnieje albo nie nalezy do uzytkownika.'
      using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.soft_delete_chat_message(uuid) from public;
grant execute on function public.soft_delete_chat_message(uuid) to authenticated;

create or replace function public.clear_public_chat_history()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Uzytkownik nie jest zalogowany.'
      using errcode = '28000';
  end if;

  if not exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and profile.is_active = true
      and profile.role = 'admin'
  ) then
    raise exception 'Brak uprawnienia administratora.'
      using errcode = '42501';
  end if;

  delete from public.chat_messages
  where conversation_id is null
    and recipient_user_id is null;

  delete from public.chat_read_state
  where conversation_key = 'all';
end;
$$;

revoke all on function public.clear_public_chat_history() from public;
grant execute on function public.clear_public_chat_history() to authenticated;

drop policy if exists chat_conversations_select_member on public.chat_conversations;
drop policy if exists chat_conversations_delete_member on public.chat_conversations;

create policy chat_conversations_select_member on public.chat_conversations
for select to authenticated
using (
  public.has_permission('chat.view')
  and public.is_chat_conversation_member(id)
);

create policy chat_conversations_delete_member on public.chat_conversations
for delete to authenticated
using (
  public.has_permission('chat.view')
  and public.is_chat_conversation_member(id)
);

drop policy if exists chat_conversation_members_select_member on public.chat_conversation_members;

create policy chat_conversation_members_select_member on public.chat_conversation_members
for select to authenticated
using (
  public.has_permission('chat.view')
  and public.is_chat_conversation_member(conversation_id)
);

drop policy if exists chat_messages_select_visible on public.chat_messages;
drop policy if exists chat_messages_insert_own on public.chat_messages;
drop policy if exists chat_messages_delete_owner_or_public_admin on public.chat_messages;

create policy chat_messages_select_visible on public.chat_messages
for select to authenticated
using (
  (
    conversation_id is null
    and recipient_user_id is null
    and public.has_permission('chat.view')
  )
  or (
    conversation_id is not null
    and public.has_permission('chat.view')
    and public.is_chat_conversation_member(conversation_id)
  )
);

create policy chat_messages_insert_own on public.chat_messages
for insert to authenticated
with check (
  sender_user_id = auth.uid()
  and public.has_permission('chat.create')
  and deleted_at is null
  and (
    (
      conversation_id is null
      and recipient_user_id is null
    )
    or (
      conversation_id is not null
      and recipient_user_id is null
      and public.is_chat_conversation_member(conversation_id)
    )
  )
);

create policy chat_messages_delete_owner on public.chat_messages
for delete to authenticated
using (
  false
);

notify pgrst, 'reload schema';
