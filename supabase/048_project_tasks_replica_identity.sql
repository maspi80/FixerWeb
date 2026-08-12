-- FIXER WEB — Pełna tożsamość repliki dla realtime DELETE/UPDATE w zadaniach projektów.

alter table public.project_tasks replica identity full;
alter table public.project_task_sections replica identity full;
