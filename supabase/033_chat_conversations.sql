-- FIXER WEB - prywatne rozmowy 1:1 z tematami.
-- Migracja przygotowana do recznego uruchomienia w Supabase.
-- Nie usuwa istniejacych wiadomosci; prywatne legacy chat_messages sa przepinane do rozmow.

create table if not exists public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  title text not null check (length(btrim(title)) > 0 and length(title) <= 120),
  created_at timestamptz not null default now()
);

create table if not exists public.chat_conversation_members (
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

alter table public.chat_messages
  add column if not exists conversation_id uuid references public.chat_conversations(id) on delete cascade;

create index if not exists chat_conversations_created_by_idx
  on public.chat_conversations (created_by);
create index if not exists chat_conversation_members_user_id_idx
  on public.chat_conversation_members (user_id);
create index if not exists chat_messages_conversation_id_idx
  on public.chat_messages (conversation_id);

alter table public.chat_conversations enable row level security;
alter table public.chat_conversation_members enable row level security;
alter table public.chat_conversations replica identity full;
alter table public.chat_conversation_members replica identity full;

create or replace function public.is_chat_conversation_member(conversation_id uuid, user_id uuid default auth.uid())
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
      and profile.is_active = true
  );
$$;

revoke all on function public.is_chat_conversation_member(uuid, uuid) from public;
grant execute on function public.is_chat_conversation_member(uuid, uuid) to authenticated;

drop policy if exists chat_conversations_select_member on public.chat_conversations;
drop policy if exists chat_conversations_insert_creator on public.chat_conversations;
drop policy if exists chat_conversations_delete_member on public.chat_conversations;

create policy chat_conversations_select_member on public.chat_conversations
for select to authenticated
using (
  public.has_permission('chat.view')
  and (
    created_by = auth.uid()
    or public.is_chat_conversation_member(id)
  )
);

create policy chat_conversations_insert_creator on public.chat_conversations
for insert to authenticated
with check (
  public.has_permission('chat.create')
  and created_by = auth.uid()
);

create policy chat_conversations_delete_member on public.chat_conversations
for delete to authenticated
using (
  public.has_permission('chat.view')
  and public.is_chat_conversation_member(id)
);

drop policy if exists chat_conversation_members_select_member on public.chat_conversation_members;
drop policy if exists chat_conversation_members_insert_creator on public.chat_conversation_members;
drop policy if exists chat_conversation_members_delete_member on public.chat_conversation_members;

create policy chat_conversation_members_select_member on public.chat_conversation_members
for select to authenticated
using (
  public.has_permission('chat.view')
  and public.is_chat_conversation_member(conversation_id)
);

create policy chat_conversation_members_insert_creator on public.chat_conversation_members
for insert to authenticated
with check (
  public.has_permission('chat.create')
  and (
    user_id = auth.uid()
    or exists (
      select 1
      from public.chat_conversations conversation
      join public.profiles profile on profile.id = chat_conversation_members.user_id
      where conversation.id = chat_conversation_members.conversation_id
        and conversation.created_by = auth.uid()
        and profile.is_active = true
    )
  )
);

create policy chat_conversation_members_delete_member on public.chat_conversation_members
for delete to authenticated
using (
  public.has_permission('chat.view')
  and public.is_chat_conversation_member(conversation_id)
);

-- Bezpieczne przepiecie istniejacych prywatnych wiadomosci legacy do rozmow 1:1.
do $$
declare
  pair record;
  new_conversation_id uuid;
begin
  for pair in
    select
      least(sender_user_id, recipient_user_id) as user_a,
      greatest(sender_user_id, recipient_user_id) as user_b,
      min(created_at) as first_created_at
    from public.chat_messages
    where conversation_id is null
      and recipient_user_id is not null
    group by 1, 2
  loop
    insert into public.chat_conversations (created_by, title, created_at)
    values (pair.user_a, 'Rozmowa', pair.first_created_at)
    returning id into new_conversation_id;

    insert into public.chat_conversation_members (conversation_id, user_id, created_at)
    values
      (new_conversation_id, pair.user_a, pair.first_created_at),
      (new_conversation_id, pair.user_b, pair.first_created_at)
    on conflict do nothing;

    update public.chat_messages
    set conversation_id = new_conversation_id,
        recipient_user_id = null
    where conversation_id is null
      and recipient_user_id is not null
      and least(sender_user_id, recipient_user_id) = pair.user_a
      and greatest(sender_user_id, recipient_user_id) = pair.user_b;
  end loop;
end $$;

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
  or (
    conversation_id is null
    and recipient_user_id is not null
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
    (
      conversation_id is null
      and recipient_user_id is null
    )
    or (
      conversation_id is not null
      and recipient_user_id is null
      and public.is_chat_conversation_member(conversation_id)
    )
    or (
      conversation_id is null
      and recipient_user_id is not null
      and exists (
        select 1
        from public.profiles recipient
        where recipient.id = recipient_user_id
          and recipient.is_active = true
          and recipient.id <> auth.uid()
      )
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
      conversation_id is null
      and recipient_user_id is null
      and exists (
        select 1
        from public.profiles profile
        where profile.id = auth.uid()
          and profile.is_active = true
          and profile.role = 'admin'
      )
    )
    or (
      conversation_id is not null
      and public.is_chat_conversation_member(conversation_id)
    )
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
