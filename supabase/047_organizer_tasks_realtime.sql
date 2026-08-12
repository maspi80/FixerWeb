-- FIXER WEB — Realtime dla prostych zadań organizera (lista w module Projektów).

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'organizer_tasks'
  ) then
    execute 'alter publication supabase_realtime add table public.organizer_tasks';
  end if;
end $$;
