-- FIXER WEB — owner/admin rules for editing and deleting project task comments.
-- This migration does not modify rows, tables, columns, users, or project view/create policies.

drop policy if exists project_task_comments_update_permissions on public.project_task_comments;
drop policy if exists project_task_comments_delete_permissions on public.project_task_comments;
drop policy if exists project_task_comments_update_owner_or_admin on public.project_task_comments;
drop policy if exists project_task_comments_delete_owner_or_admin on public.project_task_comments;

create policy project_task_comments_update_owner_or_admin on public.project_task_comments
for update to authenticated
using (
  author_user_id = auth.uid()
  or exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and profile.role = 'admin'
      and profile.is_active = true
  )
)
with check (
  author_user_id = auth.uid()
  or exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and profile.role = 'admin'
      and profile.is_active = true
  )
);

create policy project_task_comments_delete_owner_or_admin on public.project_task_comments
for delete to authenticated
using (
  author_user_id = auth.uid()
  or exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and profile.role = 'admin'
      and profile.is_active = true
  )
);

notify pgrst, 'reload schema';
