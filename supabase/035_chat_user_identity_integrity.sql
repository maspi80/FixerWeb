-- FIXER WEB - integralnosc tozsamosci uzytkownikow w Czacie.
-- Migracja przygotowana do recznego uruchomienia w Supabase.
-- Nie zgaduje uzytkownikow po nazwie; relacje Czatu sa po UUID profiles.id.

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'chat_conversations_created_by_fkey'
      and conrelid = 'public.chat_conversations'::regclass
  ) then
    alter table public.chat_conversations
      add constraint chat_conversations_created_by_fkey
      foreign key (created_by)
      references public.profiles(id)
      on delete cascade
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'chat_conversation_members_user_id_fkey'
      and conrelid = 'public.chat_conversation_members'::regclass
  ) then
    alter table public.chat_conversation_members
      add constraint chat_conversation_members_user_id_fkey
      foreign key (user_id)
      references public.profiles(id)
      on delete cascade
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'chat_messages_sender_user_id_fkey'
      and conrelid = 'public.chat_messages'::regclass
  ) then
    alter table public.chat_messages
      add constraint chat_messages_sender_user_id_fkey
      foreign key (sender_user_id)
      references public.profiles(id)
      on delete cascade
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'chat_messages_recipient_user_id_fkey'
      and conrelid = 'public.chat_messages'::regclass
  ) then
    alter table public.chat_messages
      add constraint chat_messages_recipient_user_id_fkey
      foreign key (recipient_user_id)
      references public.profiles(id)
      on delete cascade
      not valid;
  end if;
end $$;

create or replace view public.chat_identity_integrity_issues
with (security_invoker = true)
as
select
  'conversation_created_by_missing_profile' as issue,
  conversation.id as conversation_id,
  conversation.created_by as user_id,
  conversation.created_at
from public.chat_conversations conversation
left join public.profiles profile on profile.id = conversation.created_by
where profile.id is null

union all

select
  'conversation_member_missing_profile' as issue,
  member.conversation_id,
  member.user_id,
  member.created_at
from public.chat_conversation_members member
left join public.profiles profile on profile.id = member.user_id
where profile.id is null

union all

select
  'message_sender_missing_profile' as issue,
  message.conversation_id,
  message.sender_user_id as user_id,
  message.created_at
from public.chat_messages message
left join public.profiles profile on profile.id = message.sender_user_id
where profile.id is null

union all

select
  'message_recipient_missing_profile' as issue,
  message.conversation_id,
  message.recipient_user_id as user_id,
  message.created_at
from public.chat_messages message
left join public.profiles profile on profile.id = message.recipient_user_id
where message.recipient_user_id is not null
  and profile.id is null;

grant select on public.chat_identity_integrity_issues to authenticated;

notify pgrst, 'reload schema';
