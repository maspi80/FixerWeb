-- Trwała, ręczna kolejność projektów na liście „Zadania i projekty”.

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS sort_order integer;

WITH ordered_projects AS (
  SELECT
    id,
    row_number() OVER (
      ORDER BY created_at DESC NULLS LAST, id
    ) * 100 AS position
  FROM public.projects
)
UPDATE public.projects AS projects
SET sort_order = ordered_projects.position
FROM ordered_projects
WHERE projects.id = ordered_projects.id
  AND projects.sort_order IS NULL;

ALTER TABLE public.projects
  ALTER COLUMN sort_order SET DEFAULT 100,
  ALTER COLUMN sort_order SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_projects_sort_order
  ON public.projects(sort_order, created_at DESC);

NOTIFY pgrst, 'reload schema';
