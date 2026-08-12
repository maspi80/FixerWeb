-- FIXER WEB - usuwanie watkow publicznych w kanale Ogolny.
-- Migracja przygotowana do recznego uruchomienia w Supabase.

create or replace function public.delete_public_chat_thread(
  p_conversation_id uuid
)
returns table (
  id uuid
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

  if not public.has_permission('chat.view') then
    raise exception 'Brak uprawnienia chat.view.'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.chat_conversations conversation
    where conversation.id = p_conversation_id
      and conversation.conversation_type = 'public_thread'
  ) then
    raise exception 'Watek nie istnieje.'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.chat_conversations conversation
    where conversation.id = p_conversation_id
      and conversation.created_by = current_user_id
  ) and not exists (
    select 1
    from public.profiles profile
    where profile.id = current_user_id
      and profile.is_active = true
      and profile.role = 'admin'
  ) then
    raise exception 'Brak uprawnienia do usuniecia watku.'
      using errcode = '42501';
  end if;

  delete from public.chat_read_state read_state
  where read_state.conversation_key = 'conversation:' || p_conversation_id::text;

  return query
  delete from public.chat_conversations conversation
  where conversation.id = p_conversation_id
    and conversation.conversation_type = 'public_thread'
  returning conversation.id;
end;
$$;

revoke all on function public.delete_public_chat_thread(uuid) from public;
grant execute on function public.delete_public_chat_thread(uuid) to authenticated;

notify pgrst, 'reload schema';
