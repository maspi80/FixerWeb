-- FIXER WEB - wątki tematyczne w kanale Ogólny.
-- Migracja przygotowana do recznego uruchomienia w Supabase.

alter table public.chat_conversations
  add column if not exists conversation_type text not null default 'private';

alter table public.chat_conversations
  drop constraint if exists chat_conversations_conversation_type_check;

alter table public.chat_conversations
  add constraint chat_conversations_conversation_type_check
  check (conversation_type in ('private', 'public_thread'));

create index if not exists chat_conversations_public_thread_idx
  on public.chat_conversations (created_at desc)
  where conversation_type = 'public_thread';

create or replace function public.is_public_chat_thread(conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.chat_conversations conversation
    where conversation.id = conversation_id
      and conversation.conversation_type = 'public_thread'
  );
$$;

revoke all on function public.is_public_chat_thread(uuid) from public;
grant execute on function public.is_public_chat_thread(uuid) to authenticated;

drop policy if exists chat_conversations_select_member on public.chat_conversations;
drop policy if exists chat_conversations_insert_creator on public.chat_conversations;

create policy chat_conversations_select_member on public.chat_conversations
for select to authenticated
using (
  public.has_permission('chat.view')
  and (
    conversation_type = 'public_thread'
    or created_by = auth.uid()
    or public.is_chat_conversation_member(id)
  )
);

create policy chat_conversations_insert_creator on public.chat_conversations
for insert to authenticated
with check (
  public.has_permission('chat.create')
  and created_by = auth.uid()
  and (
    conversation_type = 'private'
    or conversation_type = 'public_thread'
  )
);

drop policy if exists chat_messages_select_visible on public.chat_messages;
drop policy if exists chat_messages_insert_own on public.chat_messages;

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
    and (
      public.is_public_chat_thread(conversation_id)
      or public.is_chat_conversation_member(conversation_id)
    )
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
      and (
        public.is_public_chat_thread(conversation_id)
        or public.is_chat_conversation_member(conversation_id)
      )
    )
  )
);

create or replace function public.create_public_chat_thread(
  p_title text default null
)
returns table (
  id uuid,
  title text,
  created_by uuid,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  clean_title text := nullif(btrim(p_title), '');
begin
  if current_user_id is null then
    raise exception 'Uzytkownik nie jest zalogowany.'
      using errcode = '28000';
  end if;

  if not public.has_permission('chat.view') then
    raise exception 'Brak uprawnienia chat.view.'
      using errcode = '42501';
  end if;

  if not public.has_permission('chat.create') then
    raise exception 'Brak uprawnienia chat.create.'
      using errcode = '42501';
  end if;

  if clean_title is null or length(clean_title) > 120 then
    raise exception 'Nieprawidlowy tytul watku.'
      using errcode = '22023';
  end if;

  return query
  insert into public.chat_conversations (created_by, title, conversation_type)
  values (current_user_id, clean_title, 'public_thread')
  returning
    chat_conversations.id,
    chat_conversations.title,
    chat_conversations.created_by,
    chat_conversations.created_at;
end;
$$;

revoke all on function public.create_public_chat_thread(text) from public;
grant execute on function public.create_public_chat_thread(text) to authenticated;

notify pgrst, 'reload schema';
