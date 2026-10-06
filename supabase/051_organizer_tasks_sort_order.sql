-- Stabilna, ręcznie ustawiana kolejność zwykłych zadań.
-- Migracja zachowuje wszystkie istniejące rekordy i ich treść.

ALTER TABLE public.organizer_tasks
  ADD COLUMN IF NOT EXISTS sort_order integer;

ALTER TABLE public.organizer_tasks
  ALTER COLUMN sort_order SET DEFAULT 100;

WITH ordered_tasks AS (
  SELECT
    id,
    row_number() OVER (
      ORDER BY created_at DESC NULLS LAST, id
    ) * 100 AS position
  FROM public.organizer_tasks
)
UPDATE public.organizer_tasks
SET sort_order = ordered_tasks.position
FROM ordered_tasks
WHERE organizer_tasks.id = ordered_tasks.id
  AND organizer_tasks.sort_order IS NULL;

ALTER TABLE public.organizer_tasks
  ALTER COLUMN sort_order SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_organizer_tasks_sort_order
  ON public.organizer_tasks(sort_order, created_at DESC);

NOTIFY pgrst, 'reload schema';
