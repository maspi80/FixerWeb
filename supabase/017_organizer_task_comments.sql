-- FIXER WEB — komentarze/postęp prostych zadań Organizera

CREATE TABLE IF NOT EXISTS public.organizer_task_comments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id uuid NOT NULL REFERENCES public.organizer_tasks(id) ON DELETE CASCADE,
    body text NOT NULL DEFAULT '',
    type text NOT NULL DEFAULT 'Komentarz',
    author text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_organizer_task_comments_task_id ON public.organizer_task_comments(task_id);

ALTER TABLE public.organizer_task_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "otc_select" ON public.organizer_task_comments;
DROP POLICY IF EXISTS "otc_insert" ON public.organizer_task_comments;
DROP POLICY IF EXISTS "otc_delete" ON public.organizer_task_comments;
CREATE POLICY "otc_select" ON public.organizer_task_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "otc_insert" ON public.organizer_task_comments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "otc_delete" ON public.organizer_task_comments FOR DELETE TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.restore_fixer_backup(p_tables jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY invoker
AS $$
DECLARE
  required_tables text[] := ARRAY[
    'clients', 'client_types', 'equipment', 'equipment_dictionaries',
    'rentals', 'rental_items', 'service_orders', 'service_order_progress',
    'service_order_attachments', 'service_dictionaries',
    'organizer_categories', 'organizer_tasks', 'organizer_task_comments', 'calendar_events',
    'projects', 'project_tasks', 'project_task_sections', 'project_task_comments'
  ];
  delete_order text[] := ARRAY[
    'service_order_attachments', 'service_order_progress', 'rental_items',
    'calendar_events', 'organizer_task_comments', 'organizer_tasks',
    'project_task_comments', 'project_tasks', 'project_task_sections', 'projects',
    'service_orders', 'rentals', 'organizer_categories', 'service_dictionaries',
    'equipment_dictionaries', 'client_types', 'equipment', 'clients'
  ];
  insert_order text[] := ARRAY[
    'clients', 'equipment', 'client_types', 'equipment_dictionaries',
    'service_dictionaries', 'organizer_categories',
    'projects', 'project_task_sections',
    'rentals', 'rental_items', 'service_orders', 'service_order_progress',
    'service_order_attachments', 'organizer_tasks', 'organizer_task_comments', 'calendar_events',
    'project_tasks', 'project_task_comments'
  ];
  table_name text;
  rows jsonb;
BEGIN
  IF p_tables IS NULL OR jsonb_typeof(p_tables) <> 'object' THEN
    RAISE EXCEPTION 'Backup tables payload is invalid.' USING errcode = '22023';
  END IF;

  FOREACH table_name IN ARRAY required_tables LOOP
    IF NOT (p_tables ? table_name) THEN
      RAISE EXCEPTION 'Backup does not contain required table: %', table_name USING errcode = '22023';
    END IF;
    IF jsonb_typeof(p_tables->table_name) <> 'array' THEN
      RAISE EXCEPTION 'Backup table % is not an array.', table_name USING errcode = '22023';
    END IF;
  END LOOP;

  FOREACH table_name IN ARRAY delete_order LOOP
    EXECUTE format('DELETE FROM public.%I', table_name);
  END LOOP;

  FOREACH table_name IN ARRAY insert_order LOOP
    rows := p_tables->table_name;
    IF jsonb_array_length(rows) > 0 THEN
      EXECUTE format(
        'INSERT INTO public.%1$I SELECT * FROM jsonb_populate_recordset(NULL::public.%1$I, $1)',
        table_name
      )
      USING rows;
    END IF;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.restore_fixer_backup(jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';
