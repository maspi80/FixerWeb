-- FIXER WEB - read_state dla nowych rozmow chat_conversations.
-- Migracja przygotowana do recznego uruchomienia w Supabase.

alter table public.chat_read_state
  drop constraint if exists chat_read_state_conversation_key_check;

alter table public.chat_read_state
  add constraint chat_read_state_conversation_key_check
  check (
    conversation_key = 'all'
    or conversation_key ~ '^user:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or conversation_key ~ '^conversation:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  );

notify pgrst, 'reload schema';
