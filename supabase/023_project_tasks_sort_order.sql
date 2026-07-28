ALTER TABLE public.project_tasks
ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 100;

CREATE INDEX IF NOT EXISTS idx_project_tasks_section_sort
ON public.project_tasks(project_id, section_id, sort_order, created_at);
