-- FIXER WEB — Realtime dla modułu "Zadania i projekty".
-- Dodaje wyłącznie wskazane tabele do publikacji Supabase Realtime.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'projects'
  ) then
    execute 'alter publication supabase_realtime add table public.projects';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'project_tasks'
  ) then
    execute 'alter publication supabase_realtime add table public.project_tasks';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'project_task_sections'
  ) then
    execute 'alter publication supabase_realtime add table public.project_task_sections';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'project_task_comments'
  ) then
    execute 'alter publication supabase_realtime add table public.project_task_comments';
  end if;
end $$;
