-- FIXER WEB — Sekcje zadań projektów i komentarze do zadań
-- Tabele: project_task_sections, project_task_comments
-- Dodaje section_id do project_tasks

CREATE TABLE IF NOT EXISTS public.project_task_sections (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    name text NOT NULL,
    sort_order integer NOT NULL DEFAULT 100,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_task_sections_project_id ON public.project_task_sections(project_id);
CREATE INDEX IF NOT EXISTS idx_project_task_sections_sort ON public.project_task_sections(project_id, sort_order);

ALTER TABLE public.project_task_sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pts_select" ON public.project_task_sections FOR SELECT TO authenticated USING (true);
CREATE POLICY "pts_insert" ON public.project_task_sections FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "pts_update" ON public.project_task_sections FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "pts_delete" ON public.project_task_sections FOR DELETE TO authenticated USING (true);

-- ---------------------------------------------------------------------------

ALTER TABLE public.project_tasks
    ADD COLUMN IF NOT EXISTS section_id uuid REFERENCES public.project_task_sections(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_project_tasks_section_id ON public.project_tasks(section_id);

-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.project_task_comments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id uuid NOT NULL REFERENCES public.project_tasks(id) ON DELETE CASCADE,
    body text NOT NULL DEFAULT '',
    type text NOT NULL DEFAULT 'Komentarz',
    author text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_task_comments_task_id ON public.project_task_comments(task_id);

ALTER TABLE public.project_task_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ptc_select" ON public.project_task_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "ptc_insert" ON public.project_task_comments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "ptc_update" ON public.project_task_comments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "ptc_delete" ON public.project_task_comments FOR DELETE TO authenticated USING (true);

NOTIFY pgrst, 'reload schema';
