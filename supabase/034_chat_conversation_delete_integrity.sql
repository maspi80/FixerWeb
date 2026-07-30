-- FIXER WEB - trwale usuwanie prywatnych rozmow czatu.
-- Migracja przygotowana do recznego uruchomienia w Supabase.

alter table public.chat_conversation_members
  drop constraint if exists chat_conversation_members_conversation_id_fkey;

alter table public.chat_conversation_members
  add constraint chat_conversation_members_conversation_id_fkey
  foreign key (conversation_id)
  references public.chat_conversations(id)
  on delete cascade
  not valid;

alter table public.chat_conversation_members
  validate constraint chat_conversation_members_conversation_id_fkey;

alter table public.chat_messages
  drop constraint if exists chat_messages_conversation_id_fkey;

alter table public.chat_messages
  add constraint chat_messages_conversation_id_fkey
  foreign key (conversation_id)
  references public.chat_conversations(id)
  on delete cascade
  not valid;

alter table public.chat_messages
  validate constraint chat_messages_conversation_id_fkey;

create or replace function public.cleanup_chat_read_state_for_deleted_conversation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.chat_read_state
  where conversation_key = 'conversation:' || old.id::text;

  return old;
end;
$$;

drop trigger if exists chat_conversations_cleanup_read_state on public.chat_conversations;

create trigger chat_conversations_cleanup_read_state
after delete on public.chat_conversations
for each row
execute function public.cleanup_chat_read_state_for_deleted_conversation();

drop policy if exists chat_conversations_delete_member on public.chat_conversations;

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
  and (
    user_id = auth.uid()
    or public.is_chat_conversation_member(conversation_id)
  )
);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'chat_conversations'
  ) then
    execute 'alter publication supabase_realtime add table public.chat_conversations';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'chat_conversation_members'
  ) then
    execute 'alter publication supabase_realtime add table public.chat_conversation_members';
  end if;
end $$;

notify pgrst, 'reload schema';
