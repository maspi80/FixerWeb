-- FIXER WEB — Etap 3: egzekwowanie permissions dla tabel projektowych.
-- UWAGA: migracja przygotowana do ręcznego uruchomienia w Supabase.
-- Dotyczy wyłącznie: projects, project_tasks, project_task_sections, project_task_comments.

create or replace function public.has_permission(permission_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and profile.is_active = true
      and (
        profile.role = 'admin'
        or exists (
          select 1
          from public.user_permissions permission
          where permission.user_id = profile.id
            and permission.permission_key = lower(trim($1))
            and permission.allowed = true
        )
      )
  );
$$;

revoke all on function public.has_permission(text) from public;
grant execute on function public.has_permission(text) to authenticated;

alter table public.projects enable row level security;
alter table public.project_tasks enable row level security;
alter table public.project_task_sections enable row level security;
alter table public.project_task_comments enable row level security;

drop policy if exists "projects_select" on public.projects;
drop policy if exists "projects_insert" on public.projects;
drop policy if exists "projects_update" on public.projects;
drop policy if exists "projects_delete" on public.projects;
drop policy if exists projects_select_permissions on public.projects;
drop policy if exists projects_insert_permissions on public.projects;
drop policy if exists projects_update_permissions on public.projects;
drop policy if exists projects_delete_permissions on public.projects;

create policy projects_select_permissions on public.projects
for select to authenticated
using (public.has_permission('projects.view'));

create policy projects_insert_permissions on public.projects
for insert to authenticated
with check (public.has_permission('projects.create'));

create policy projects_update_permissions on public.projects
for update to authenticated
using (public.has_permission('projects.edit'))
with check (public.has_permission('projects.edit'));

create policy projects_delete_permissions on public.projects
for delete to authenticated
using (public.has_permission('projects.delete'));

drop policy if exists "project_tasks_select" on public.project_tasks;
drop policy if exists "project_tasks_insert" on public.project_tasks;
drop policy if exists "project_tasks_update" on public.project_tasks;
drop policy if exists "project_tasks_delete" on public.project_tasks;
drop policy if exists project_tasks_select_permissions on public.project_tasks;
drop policy if exists project_tasks_insert_permissions on public.project_tasks;
drop policy if exists project_tasks_update_permissions on public.project_tasks;
drop policy if exists project_tasks_delete_permissions on public.project_tasks;

create policy project_tasks_select_permissions on public.project_tasks
for select to authenticated
using (public.has_permission('projects.view'));

create policy project_tasks_insert_permissions on public.project_tasks
for insert to authenticated
with check (public.has_permission('projects.create'));

create policy project_tasks_update_permissions on public.project_tasks
for update to authenticated
using (public.has_permission('projects.edit'))
with check (public.has_permission('projects.edit'));

create policy project_tasks_delete_permissions on public.project_tasks
for delete to authenticated
using (public.has_permission('projects.delete'));

drop policy if exists "pts_select" on public.project_task_sections;
drop policy if exists "pts_insert" on public.project_task_sections;
drop policy if exists "pts_update" on public.project_task_sections;
drop policy if exists "pts_delete" on public.project_task_sections;
drop policy if exists project_task_sections_select_permissions on public.project_task_sections;
drop policy if exists project_task_sections_insert_permissions on public.project_task_sections;
drop policy if exists project_task_sections_update_permissions on public.project_task_sections;
drop policy if exists project_task_sections_delete_permissions on public.project_task_sections;

create policy project_task_sections_select_permissions on public.project_task_sections
for select to authenticated
using (public.has_permission('projects.view'));

create policy project_task_sections_insert_permissions on public.project_task_sections
for insert to authenticated
with check (public.has_permission('projects.create'));

create policy project_task_sections_update_permissions on public.project_task_sections
for update to authenticated
using (public.has_permission('projects.edit'))
with check (public.has_permission('projects.edit'));

create policy project_task_sections_delete_permissions on public.project_task_sections
for delete to authenticated
using (public.has_permission('projects.delete'));

drop policy if exists "ptc_select" on public.project_task_comments;
drop policy if exists "ptc_insert" on public.project_task_comments;
drop policy if exists "ptc_update" on public.project_task_comments;
drop policy if exists "ptc_delete" on public.project_task_comments;
drop policy if exists project_task_comments_select_permissions on public.project_task_comments;
drop policy if exists project_task_comments_insert_permissions on public.project_task_comments;
drop policy if exists project_task_comments_update_permissions on public.project_task_comments;
drop policy if exists project_task_comments_delete_permissions on public.project_task_comments;

create policy project_task_comments_select_permissions on public.project_task_comments
for select to authenticated
using (public.has_permission('projects.view'));

create policy project_task_comments_insert_permissions on public.project_task_comments
for insert to authenticated
with check (public.has_permission('projects.create'));

create policy project_task_comments_update_permissions on public.project_task_comments
for update to authenticated
using (public.has_permission('projects.edit'))
with check (public.has_permission('projects.edit'));

create policy project_task_comments_delete_permissions on public.project_task_comments
for delete to authenticated
using (public.has_permission('projects.delete'));

notify pgrst, 'reload schema';
