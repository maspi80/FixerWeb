-- FIXER WEB — Moduł Projekty
-- Tabele: projects, project_tasks
-- RLS zgodny ze standardem projektu

CREATE TABLE IF NOT EXISTS public.projects (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_number text NOT NULL DEFAULT '',
    name text NOT NULL,
    description text NOT NULL DEFAULT '',
    client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
    status text NOT NULL DEFAULT 'Planowany',
    priority text NOT NULL DEFAULT 'Normalny',
    start_date date,
    due_date date,
    completed_at timestamptz,
    archived boolean NOT NULL DEFAULT false,
    notes text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projects_status      ON public.projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_priority    ON public.projects(priority);
CREATE INDEX IF NOT EXISTS idx_projects_due_date    ON public.projects(due_date);
CREATE INDEX IF NOT EXISTS idx_projects_archived    ON public.projects(archived);
CREATE INDEX IF NOT EXISTS idx_projects_client_id   ON public.projects(client_id);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "projects_select" ON public.projects
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "projects_insert" ON public.projects
    FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "projects_update" ON public.projects
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "projects_delete" ON public.projects
    FOR DELETE TO authenticated USING (true);

-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.project_tasks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    title text NOT NULL,
    description text NOT NULL DEFAULT '',
    status text NOT NULL DEFAULT 'Do zrobienia',
    priority text NOT NULL DEFAULT 'Normalny',
    due_date date,
    reminder_at timestamptz,
    completed_at timestamptz,
    archived boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_tasks_project_id ON public.project_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_status     ON public.project_tasks(status);
CREATE INDEX IF NOT EXISTS idx_project_tasks_priority   ON public.project_tasks(priority);
CREATE INDEX IF NOT EXISTS idx_project_tasks_due_date   ON public.project_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_project_tasks_archived   ON public.project_tasks(archived);
CREATE INDEX IF NOT EXISTS idx_project_tasks_reminder   ON public.project_tasks(reminder_at);

ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_tasks_select" ON public.project_tasks
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "project_tasks_insert" ON public.project_tasks
    FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "project_tasks_update" ON public.project_tasks
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "project_tasks_delete" ON public.project_tasks
    FOR DELETE TO authenticated USING (true);

NOTIFY pgrst, 'reload schema';
