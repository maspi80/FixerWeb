-- FIXER WEB — autor zalogowanego użytkownika dla nowych komentarzy projektowych.
-- Migracja nie zmienia istniejących komentarzy.

alter table public.project_task_comments
  add column if not exists author_user_id uuid references public.profiles(id) on delete set null;

create index if not exists idx_project_task_comments_author_user_id
  on public.project_task_comments(author_user_id);

notify pgrst, 'reload schema';
