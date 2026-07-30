-- FIXER WEB - tworzenie rozmow i wysylka dla aktywnych uzytkownikow z dostepem do Czatu.
-- Migracja przygotowana do recznego uruchomienia w Supabase.

drop policy if exists chat_conversations_insert_creator on public.chat_conversations;

create policy chat_conversations_insert_creator on public.chat_conversations
for insert to authenticated
with check (
  created_by = auth.uid()
  and public.has_permission('chat.view')
  and exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and profile.is_active = true
  )
);

drop policy if exists chat_conversation_members_insert_creator on public.chat_conversation_members;

create or replace function public.is_chat_conversation_creator(
  p_conversation_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.chat_conversations conversation
    where conversation.id = p_conversation_id
      and conversation.created_by = p_user_id
  );
$$;

revoke all on function public.is_chat_conversation_creator(uuid, uuid) from public;
grant execute on function public.is_chat_conversation_creator(uuid, uuid) to authenticated;

create policy chat_conversation_members_insert_creator on public.chat_conversation_members
for insert to authenticated
with check (
  public.has_permission('chat.view')
  and (
    user_id = auth.uid()
    or exists (
      select 1
      from public.profiles profile
      where profile.id = chat_conversation_members.user_id
        and profile.is_active = true
        and public.is_chat_conversation_creator(chat_conversation_members.conversation_id)
    )
  )
);

create or replace function public.create_chat_conversation(
  participant_user_id uuid,
  conversation_title text
)
returns table (
  id uuid,
  created_by uuid,
  title text,
  created_at timestamptz
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  clean_title text := btrim(conversation_title);
  new_conversation_id uuid;
begin
  if current_user_id is null then
    raise exception 'Uzytkownik nie jest zalogowany.'
      using errcode = '28000';
  end if;

  if not public.has_permission('chat.view') then
    raise exception 'Brak dostepu do modulu Czat.'
      using errcode = '42501';
  end if;

  if clean_title is null or length(clean_title) = 0 or length(clean_title) > 120 then
    raise exception 'Nieprawidlowy temat rozmowy.'
      using errcode = '22023';
  end if;

  if participant_user_id is null or participant_user_id = current_user_id then
    raise exception 'Nieprawidlowy uczestnik rozmowy.'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.profiles profile
    where profile.id = current_user_id
      and profile.is_active = true
  ) then
    raise exception 'Profil tworzacego rozmowe nie istnieje albo jest nieaktywny.'
      using errcode = '23503';
  end if;

  if not exists (
    select 1
    from public.profiles profile
    where profile.id = participant_user_id
      and profile.is_active = true
  ) then
    raise exception 'Wybrany uczestnik rozmowy nie istnieje albo jest nieaktywny.'
      using errcode = '23503';
  end if;

  insert into public.chat_conversations (created_by, title)
  values (current_user_id, clean_title)
  returning chat_conversations.id into new_conversation_id;

  insert into public.chat_conversation_members (conversation_id, user_id)
  values
    (new_conversation_id, current_user_id),
    (new_conversation_id, participant_user_id);

  return query
  select
    conversation.id,
    conversation.created_by,
    conversation.title,
    conversation.created_at
  from public.chat_conversations conversation
  where conversation.id = new_conversation_id;
end;
$$;

revoke all on function public.create_chat_conversation(uuid, text) from public;
grant execute on function public.create_chat_conversation(uuid, text) to authenticated;

drop policy if exists chat_messages_insert_own on public.chat_messages;

create policy chat_messages_insert_own on public.chat_messages
for insert to authenticated
with check (
  sender_user_id = auth.uid()
  and public.has_permission('chat.view')
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

notify pgrst, 'reload schema';
