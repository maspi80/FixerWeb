-- FIXER WEB - edycja tematu rozmowy przez uczestnika.
-- Migracja przygotowana do recznego uruchomienia w Supabase.

create or replace function public.update_chat_conversation_title(
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

  if clean_title is not null and length(clean_title) > 120 then
    raise exception 'Nieprawidlowy temat rozmowy.'
      using errcode = '22023';
  end if;

  if not public.is_chat_conversation_member(p_conversation_id, current_user_id) then
    raise exception 'Rozmowa nie istnieje albo uzytkownik nie jest jej uczestnikiem.'
      using errcode = '42501';
  end if;

  return query
  update public.chat_conversations conversation
  set title = clean_title
  where conversation.id = p_conversation_id
  returning
    conversation.id,
    conversation.title,
    conversation.created_at;
end;
$$;

revoke all on function public.update_chat_conversation_title(uuid, text) from public;
grant execute on function public.update_chat_conversation_title(uuid, text) to authenticated;

notify pgrst, 'reload schema';
