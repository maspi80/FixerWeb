-- FIXER WEB - naprawa DELETE rozmow widocznych dla creator, ale bez membership.
-- Migracja przygotowana do recznego uruchomienia w Supabase.

insert into public.chat_conversation_members (conversation_id, user_id, created_at)
select
  conversation.id,
  conversation.created_by,
  conversation.created_at
from public.chat_conversations conversation
join public.profiles profile on profile.id = conversation.created_by
where profile.is_active = true
  and not exists (
    select 1
    from public.chat_conversation_members member
    where member.conversation_id = conversation.id
      and member.user_id = conversation.created_by
  )
on conflict do nothing;

drop policy if exists chat_conversations_delete_member on public.chat_conversations;

create policy chat_conversations_delete_member on public.chat_conversations
for delete to authenticated
using (
  public.has_permission('chat.view')
  and (
    created_by = auth.uid()
    or public.is_chat_conversation_member(id)
  )
);

create or replace view public.chat_delete_integrity_issues
with (security_invoker = true)
as
select
  conversation.id as conversation_id,
  conversation.created_by,
  conversation.title,
  conversation.created_at,
  not exists (
    select 1
    from public.chat_conversation_members creator_member
    where creator_member.conversation_id = conversation.id
      and creator_member.user_id = conversation.created_by
  ) as missing_creator_membership,
  (
    select count(*)
    from public.chat_conversation_members member
    where member.conversation_id = conversation.id
  ) as member_count,
  (
    select count(*)
    from public.chat_messages message
    where message.conversation_id = conversation.id
  ) as message_count,
  (
    select count(*)
    from public.chat_read_state read_state
    where read_state.conversation_key = 'conversation:' || conversation.id::text
  ) as read_state_count
from public.chat_conversations conversation;

grant select on public.chat_delete_integrity_issues to authenticated;

notify pgrst, 'reload schema';
