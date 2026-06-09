import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

export const PROJECT_STATUSES = ['Planowany', 'W trakcie', 'Wstrzymany', 'Zakończony', 'Anulowany'];
export const PROJECT_PRIORITIES = ['Niski', 'Normalny', 'Wysoki', 'Pilny'];
export const PROJECT_TERMINAL_STATUSES = ['Zakończony', 'Anulowany'];
export const PROJECT_TASK_STATUSES = ['Do zrobienia', 'W trakcie', 'Oczekuje', 'Zrobione', 'Anulowane'];
export const PROJECT_TASK_PRIORITIES = ['Niski', 'Normalny', 'Wysoki', 'Pilny'];
export const PROJECT_TASK_TERMINAL_STATUSES = ['Zrobione', 'Anulowane'];
export const PROJECT_TASK_COMMENT_TYPES = ['Komentarz', 'Decyzja', 'Problem'];

const LOCAL_PROJECTS_KEY = 'fixer-projects';
const LOCAL_PROJECT_TASKS_KEY = 'fixer-project-tasks';
const LOCAL_SECTIONS_KEY = 'fixer-project-task-sections';
const LOCAL_COMMENTS_KEY = 'fixer-project-task-comments';

function readLocal(key) {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
}

function writeLocal(key, rows) {
  localStorage.setItem(key, JSON.stringify(rows));
}

function normalizeProject(project) {
  return {
    project_number: String(project.project_number ?? '').trim(),
    name: String(project.name ?? '').trim(),
    description: String(project.description ?? '').trim(),
    client_id: project.client_id || null,
    status: project.status ?? 'Planowany',
    priority: project.priority ?? 'Normalny',
    start_date: project.start_date || null,
    due_date: project.due_date || null,
    completed_at: project.completed_at || null,
    archived: Boolean(project.archived),
    notes: String(project.notes ?? '').trim()
  };
}

function normalizeProjectTask(task) {
  return {
    project_id: task.project_id,
    section_id: task.section_id || null,
    title: String(task.title ?? '').trim(),
    description: String(task.description ?? '').trim(),
    status: task.status ?? 'Do zrobienia',
    priority: task.priority ?? 'Normalny',
    due_date: task.due_date || null,
    reminder_at: task.reminder_at || null,
    completed_at: task.completed_at || null,
    archived: Boolean(task.archived)
  };
}

// ─── Projects ─────────────────────────────────────────────────────────────────

export async function fetchProjects() {
  if (!isSupabaseConfigured) {
    return { data: readLocal(LOCAL_PROJECTS_KEY), error: null, local: true };
  }
  const { data, error } = await supabase
    .from('projects')
    .select('*, clients(id, name)')
    .order('created_at', { ascending: false });
  return { data: data ?? [], error, local: false };
}

export async function createProject(project) {
  const payload = normalizeProject(project);
  if (!payload.name) return { data: null, error: new Error('Nazwa projektu jest wymagana.'), local: false };
  if (!isSupabaseConfigured) {
    const now = new Date().toISOString();
    const created = { ...payload, id: crypto.randomUUID(), localId: crypto.randomUUID(), created_at: now, updated_at: now };
    writeLocal(LOCAL_PROJECTS_KEY, [created, ...readLocal(LOCAL_PROJECTS_KEY)]);
    return { data: created, error: null, local: true };
  }
  const { data, error } = await supabase
    .from('projects')
    .insert(payload)
    .select('*, clients(id, name)')
    .single();
  return { data, error, local: false };
}

export async function updateProject(id, project) {
  const payload = normalizeProject(project);
  if (!isSupabaseConfigured || project.localId) {
    const now = new Date().toISOString();
    const next = readLocal(LOCAL_PROJECTS_KEY).map((row) =>
      String(row.id ?? row.localId) === String(id) ? { ...row, ...payload, updated_at: now } : row
    );
    writeLocal(LOCAL_PROJECTS_KEY, next);
    return { data: next.find((row) => String(row.id ?? row.localId) === String(id)) ?? null, error: null, local: true };
  }
  const { data, error } = await supabase
    .from('projects')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*, clients(id, name)')
    .single();
  return { data, error, local: false };
}

export async function deleteProject(id, project = null) {
  if (!isSupabaseConfigured || project?.localId) {
    writeLocal(LOCAL_PROJECTS_KEY, readLocal(LOCAL_PROJECTS_KEY).filter((row) => String(row.id ?? row.localId) !== String(id)));
    return { error: null, local: true };
  }
  const { error } = await supabase.from('projects').delete().eq('id', id);
  return { error, local: false };
}

// ─── Project Tasks ─────────────────────────────────────────────────────────────

export async function fetchProjectTasks(projectId) {
  if (!isSupabaseConfigured) {
    const all = readLocal(LOCAL_PROJECT_TASKS_KEY);
    return { data: all.filter((t) => String(t.project_id) === String(projectId)), error: null, local: true };
  }
  const { data, error } = await supabase
    .from('project_tasks')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });
  return { data: data ?? [], error, local: false };
}

export async function fetchAllProjectTasks() {
  if (!isSupabaseConfigured) {
    return { data: readLocal(LOCAL_PROJECT_TASKS_KEY), error: null, local: true };
  }
  const { data, error } = await supabase
    .from('project_tasks')
    .select('*')
    .order('created_at', { ascending: false });
  return { data: data ?? [], error, local: false };
}

export async function createProjectTask(task) {
  const payload = normalizeProjectTask(task);
  if (!payload.title) return { data: null, error: new Error('Tytuł zadania jest wymagany.'), local: false };
  if (!payload.project_id) return { data: null, error: new Error('ID projektu jest wymagane.'), local: false };
  if (!isSupabaseConfigured) {
    const now = new Date().toISOString();
    const created = { ...payload, id: crypto.randomUUID(), localId: crypto.randomUUID(), created_at: now, updated_at: now };
    writeLocal(LOCAL_PROJECT_TASKS_KEY, [...readLocal(LOCAL_PROJECT_TASKS_KEY), created]);
    return { data: created, error: null, local: true };
  }
  const { data, error } = await supabase.from('project_tasks').insert(payload).select('*').single();
  return { data, error, local: false };
}

export async function updateProjectTask(id, task) {
  const payload = normalizeProjectTask(task);
  if (!isSupabaseConfigured || task.localId) {
    const now = new Date().toISOString();
    const next = readLocal(LOCAL_PROJECT_TASKS_KEY).map((row) =>
      String(row.id ?? row.localId) === String(id) ? { ...row, ...payload, updated_at: now } : row
    );
    writeLocal(LOCAL_PROJECT_TASKS_KEY, next);
    return { data: next.find((row) => String(row.id ?? row.localId) === String(id)) ?? null, error: null, local: true };
  }
  const { data, error } = await supabase
    .from('project_tasks')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  return { data, error, local: false };
}

export async function deleteProjectTask(id, task = null) {
  if (!isSupabaseConfigured || task?.localId) {
    writeLocal(LOCAL_PROJECT_TASKS_KEY, readLocal(LOCAL_PROJECT_TASKS_KEY).filter((row) => String(row.id ?? row.localId) !== String(id)));
    writeLocal(LOCAL_COMMENTS_KEY, readLocal(LOCAL_COMMENTS_KEY).filter((row) => String(row.task_id) !== String(id)));
    return { error: null, local: true };
  }
  const { error } = await supabase.from('project_tasks').delete().eq('id', id);
  return { error, local: false };
}

// ─── Project Task Sections ─────────────────────────────────────────────────────

export async function fetchProjectSections(projectId) {
  if (!isSupabaseConfigured) {
    return { data: readLocal(LOCAL_SECTIONS_KEY).filter((s) => String(s.project_id) === String(projectId)), error: null, local: true };
  }
  const { data, error } = await supabase
    .from('project_task_sections')
    .select('*')
    .eq('project_id', projectId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  return { data: data ?? [], error, local: false };
}

export async function createProjectSection(projectId, name, sortOrder = 100) {
  if (!projectId) return { data: null, error: new Error('ID projektu jest wymagane.'), local: false };
  if (!name?.trim()) return { data: null, error: new Error('Nazwa sekcji jest wymagana.'), local: false };
  if (!isSupabaseConfigured) {
    const now = new Date().toISOString();
    const created = { id: crypto.randomUUID(), localId: crypto.randomUUID(), project_id: projectId, name: name.trim(), sort_order: sortOrder, created_at: now, updated_at: now };
    writeLocal(LOCAL_SECTIONS_KEY, [...readLocal(LOCAL_SECTIONS_KEY), created]);
    return { data: created, error: null, local: true };
  }
  const { data, error } = await supabase.from('project_task_sections').insert({ project_id: projectId, name: name.trim(), sort_order: sortOrder }).select('*').single();
  return { data, error, local: false };
}

export async function updateProjectSection(id, name) {
  if (!name?.trim()) return { data: null, error: new Error('Nazwa sekcji jest wymagana.'), local: false };
  if (!isSupabaseConfigured) {
    const now = new Date().toISOString();
    const next = readLocal(LOCAL_SECTIONS_KEY).map((s) => String(s.id ?? s.localId) === String(id) ? { ...s, name: name.trim(), updated_at: now } : s);
    writeLocal(LOCAL_SECTIONS_KEY, next);
    return { data: next.find((s) => String(s.id ?? s.localId) === String(id)) ?? null, error: null, local: true };
  }
  const { data, error } = await supabase.from('project_task_sections').update({ name: name.trim(), updated_at: new Date().toISOString() }).eq('id', id).select('*').single();
  return { data, error, local: false };
}

export async function deleteProjectSection(id) {
  if (!isSupabaseConfigured) {
    writeLocal(LOCAL_SECTIONS_KEY, readLocal(LOCAL_SECTIONS_KEY).filter((s) => String(s.id ?? s.localId) !== String(id)));
    writeLocal(LOCAL_PROJECT_TASKS_KEY, readLocal(LOCAL_PROJECT_TASKS_KEY).map((t) => String(t.section_id) === String(id) ? { ...t, section_id: null } : t));
    return { error: null, local: true };
  }
  const { error } = await supabase.from('project_task_sections').delete().eq('id', id);
  return { error, local: false };
}

// ─── Project Task Comments ─────────────────────────────────────────────────────

export async function fetchTaskComments(taskId) {
  if (!isSupabaseConfigured) {
    return { data: readLocal(LOCAL_COMMENTS_KEY).filter((c) => String(c.task_id) === String(taskId)), error: null, local: true };
  }
  const { data, error } = await supabase
    .from('project_task_comments')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true });
  return { data: data ?? [], error, local: false };
}

export async function createTaskComment(taskId, body, type = 'Komentarz', author = '') {
  if (!taskId) return { data: null, error: new Error('ID zadania jest wymagane.'), local: false };
  if (!body?.trim()) return { data: null, error: new Error('Treść komentarza jest wymagana.'), local: false };
  if (!isSupabaseConfigured) {
    const now = new Date().toISOString();
    const created = { id: crypto.randomUUID(), localId: crypto.randomUUID(), task_id: taskId, body: body.trim(), type, author, created_at: now, updated_at: now };
    writeLocal(LOCAL_COMMENTS_KEY, [...readLocal(LOCAL_COMMENTS_KEY), created]);
    return { data: created, error: null, local: true };
  }
  const { data, error } = await supabase.from('project_task_comments').insert({ task_id: taskId, body: body.trim(), type, author }).select('*').single();
  return { data, error, local: false };
}

export async function updateTaskComment(id, body, comment = null) {
  if (!body?.trim()) return { data: null, error: new Error('Treść komentarza jest wymagana.'), local: false };
  if (!isSupabaseConfigured || comment?.localId) {
    const now = new Date().toISOString();
    const next = readLocal(LOCAL_COMMENTS_KEY).map((c) => String(c.id ?? c.localId) === String(id) ? { ...c, body: body.trim(), updated_at: now } : c);
    writeLocal(LOCAL_COMMENTS_KEY, next);
    return { data: next.find((c) => String(c.id ?? c.localId) === String(id)) ?? null, error: null, local: true };
  }
  const { data, error } = await supabase.from('project_task_comments').update({ body: body.trim(), updated_at: new Date().toISOString() }).eq('id', id).select('*').single();
  return { data, error, local: false };
}

export async function deleteTaskComment(id, comment = null) {
  if (!isSupabaseConfigured || comment?.localId) {
    writeLocal(LOCAL_COMMENTS_KEY, readLocal(LOCAL_COMMENTS_KEY).filter((c) => String(c.id ?? c.localId) !== String(id)));
    return { error: null, local: true };
  }
  const { error } = await supabase.from('project_task_comments').delete().eq('id', id);
  return { error, local: false };
}

// ─── Comment counts for all tasks in a project ────────────────────────────────

export async function fetchProjectAllComments(projectId) {
  if (!isSupabaseConfigured) {
    const taskIds = new Set(
      readLocal(LOCAL_PROJECT_TASKS_KEY)
        .filter((t) => String(t.project_id) === String(projectId))
        .map((t) => String(t.id ?? t.localId))
    );
    return { data: readLocal(LOCAL_COMMENTS_KEY).filter((c) => taskIds.has(String(c.task_id))), error: null, local: true };
  }
  const { data: taskRows, error: taskErr } = await supabase
    .from('project_tasks')
    .select('id')
    .eq('project_id', projectId);
  if (taskErr || !taskRows?.length) return { data: [], error: taskErr, local: false };
  const { data, error } = await supabase
    .from('project_task_comments')
    .select('id, task_id')
    .in('task_id', taskRows.map((t) => t.id));
  return { data: data ?? [], error, local: false };
}
