-- FIXER WEB - edycja nazwy watku publicznego w kanale Ogolny.
-- Migracja przygotowana do recznego uruchomienia w Supabase.

create or replace function public.update_public_chat_thread_title(
  p_conversation_id uuid,
  p_title text default null
)
returns table (
  id uuid,
  title text,
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

  if clean_title is null or length(clean_title) > 120 then
    raise exception 'Nieprawidlowa nazwa watku.'
      using errcode = '22023';
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
    raise exception 'Brak uprawnienia do zmiany nazwy watku.'
      using errcode = '42501';
  end if;

  return query
  update public.chat_conversations conversation
  set title = clean_title
  where conversation.id = p_conversation_id
    and conversation.conversation_type = 'public_thread'
  returning
    conversation.id,
    conversation.title,
    conversation.created_at;
end;
$$;

revoke all on function public.update_public_chat_thread_title(uuid, text) from public;
grant execute on function public.update_public_chat_thread_title(uuid, text) to authenticated;

notify pgrst, 'reload schema';
