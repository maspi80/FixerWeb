import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

export const PROJECT_STATUSES = ['Planowany', 'W trakcie', 'Wstrzymany', 'Zakończony', 'Anulowany'];
export const PROJECT_PRIORITIES = ['Niski', 'Normalny', 'Wysoki', 'Pilny'];
export const PROJECT_TERMINAL_STATUSES = ['Zakończony', 'Anulowany'];
export const PROJECT_TASK_STATUSES = ['Do zrobienia', 'W trakcie', 'Oczekuje', 'Zrobione', 'Anulowane'];
export const PROJECT_TASK_PRIORITIES = ['Niski', 'Normalny', 'Wysoki', 'Pilny'];
export const PROJECT_TASK_TERMINAL_STATUSES = ['Zrobione', 'Anulowane'];

function normalizeCompletedStatusKey(status) {
  return String(status ?? '')
    .trim()
    .toLocaleLowerCase('pl')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function isCompletedStatus(status) {
  const key = normalizeCompletedStatusKey(status);
  if (!key) return false;
  if (PROJECT_TERMINAL_STATUSES.some((item) => normalizeCompletedStatusKey(item) === key)) return true;
  if (PROJECT_TASK_TERMINAL_STATUSES.some((item) => normalizeCompletedStatusKey(item) === key)) return true;
  const completedTokens = ['wykonan', 'zakoncz', 'zamkniet', 'zamkni', 'zrobion', 'anulowan'];
  return completedTokens.some((token) => key.includes(token));
}
export const PROJECT_TASK_COMMENT_TYPES = ['Komentarz', 'Postęp', 'Decyzja', 'Problem'];

const LOCAL_PROJECTS_KEY = 'fixer-projects';
const LOCAL_PROJECT_TASKS_KEY = 'fixer-project-tasks';
const LOCAL_SECTIONS_KEY = 'fixer-project-task-sections';
const LOCAL_COMMENTS_KEY = 'fixer-project-task-comments';
const LOCAL_SECTION_COLORS_KEY = 'fixer-project-section-colors';
const LOCAL_PROJECT_ACCENT_COLORS_KEY = 'fixer-project-accent-colors';

function readLocal(key) {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
}

function writeLocal(key, rows) {
  localStorage.setItem(key, JSON.stringify(rows));
}

function readAccentColorMap() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_PROJECT_ACCENT_COLORS_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeAccentColorMap(map) {
  localStorage.setItem(LOCAL_PROJECT_ACCENT_COLORS_KEY, JSON.stringify(map));
}

export function normalizeAccentColor(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw)) return null;
  const hex = raw.slice(1).toUpperCase();
  const expanded = hex.length === 3 ? hex.split('').map((part) => `${part}${part}`).join('') : hex;
  return `#${expanded}`;
}

function getProjectStorageKey(project) {
  return String(project?.id ?? project?.localId ?? '').trim();
}

function persistProjectAccentColor(projectKey, accentColor) {
  if (!projectKey) return;
  const map = readAccentColorMap();
  const normalized = normalizeAccentColor(accentColor);
  if (normalized) map[projectKey] = normalized;
  else delete map[projectKey];
  writeAccentColorMap(map);
}

function mergeProjectAccentColors(projects) {
  const map = readAccentColorMap();
  return (projects ?? []).map((project) => {
    const key = getProjectStorageKey(project);
    const fromProject = normalizeAccentColor(project?.accent_color);
    const fromMap = normalizeAccentColor(map[key]);
    return { ...project, accent_color: fromProject ?? fromMap ?? null };
  });
}

function splitSupabaseProjectPayload(payload) {
  const { accent_color, ...dbPayload } = payload;
  return { dbPayload, accent_color };
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
    notes: String(project.notes ?? '').trim(),
    accent_color: normalizeAccentColor(project?.accent_color)
  };
}

function readSectionColorMap() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_SECTION_COLORS_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeSectionColorMap(map) {
  localStorage.setItem(LOCAL_SECTION_COLORS_KEY, JSON.stringify(map));
}

function getSectionStorageKey(section) {
  return String(section?.id ?? section?.localId ?? '').trim();
}

function persistSectionColor(sectionKey, headerColor) {
  if (!sectionKey) return;
  const map = readSectionColorMap();
  const normalized = normalizeAccentColor(headerColor);
  if (normalized) map[sectionKey] = normalized;
  else delete map[sectionKey];
  writeSectionColorMap(map);
}

function mergeSectionColors(sections) {
  const map = readSectionColorMap();
  return (sections ?? []).map((section) => {
    const key = getSectionStorageKey(section);
    const fromSection = normalizeAccentColor(section?.header_color);
    const fromMap = normalizeAccentColor(map[key]);
    return { ...section, header_color: fromSection ?? fromMap ?? null };
  });
}

function normalizeSectionUpdates(updates) {
  if (typeof updates === 'string') return { name: updates.trim() };
  return {
    ...(updates?.name !== undefined ? { name: String(updates.name).trim() } : {}),
    ...(updates?.header_color !== undefined ? { header_color: normalizeAccentColor(updates.header_color) } : {})
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
    return { data: mergeProjectAccentColors(readLocal(LOCAL_PROJECTS_KEY)), error: null, local: true };
  }
  const { data, error } = await supabase
    .from('projects')
    .select('*, clients(id, name)')
    .order('created_at', { ascending: false });
  return { data: mergeProjectAccentColors(data ?? []), error, local: false };
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
  const { dbPayload, accent_color } = splitSupabaseProjectPayload(payload);
  const { data, error } = await supabase
    .from('projects')
    .insert(dbPayload)
    .select('*, clients(id, name)')
    .single();
  if (!error && data) {
    persistProjectAccentColor(getProjectStorageKey(data), accent_color);
    return { data: { ...data, accent_color: accent_color ?? null }, error, local: false };
  }
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
  const { dbPayload, accent_color } = splitSupabaseProjectPayload(payload);
  const { data, error } = await supabase
    .from('projects')
    .update({ ...dbPayload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*, clients(id, name)')
    .single();
  if (!error) {
    persistProjectAccentColor(String(id), accent_color);
    return { data: data ? { ...data, accent_color: accent_color ?? null } : null, error, local: false };
  }
  return { data, error, local: false };
}

export async function deleteProject(id, project = null) {
  persistProjectAccentColor(String(id ?? project?.localId ?? ''), null);
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
    return { data: mergeSectionColors(readLocal(LOCAL_SECTIONS_KEY).filter((s) => String(s.project_id) === String(projectId))), error: null, local: true };
  }
  const { data, error } = await supabase
    .from('project_task_sections')
    .select('*')
    .eq('project_id', projectId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  return { data: mergeSectionColors(data ?? []), error, local: false };
}

export async function createProjectSection(projectId, name, sortOrder = 100, headerColor = null) {
  if (!projectId) return { data: null, error: new Error('ID projektu jest wymagane.'), local: false };
  if (!name?.trim()) return { data: null, error: new Error('Nazwa sekcji jest wymagana.'), local: false };
  const color = normalizeAccentColor(headerColor);
  if (!isSupabaseConfigured) {
    const now = new Date().toISOString();
    const created = {
      id: crypto.randomUUID(),
      localId: crypto.randomUUID(),
      project_id: projectId,
      name: name.trim(),
      sort_order: sortOrder,
      header_color: color,
      created_at: now,
      updated_at: now
    };
    writeLocal(LOCAL_SECTIONS_KEY, [...readLocal(LOCAL_SECTIONS_KEY), created]);
    return { data: created, error: null, local: true };
  }
  const { data, error } = await supabase
    .from('project_task_sections')
    .insert({ project_id: projectId, name: name.trim(), sort_order: sortOrder })
    .select('*')
    .single();
  if (!error && data) {
    persistSectionColor(getSectionStorageKey(data), color);
    return { data: { ...data, header_color: color ?? null }, error, local: false };
  }
  return { data, error, local: false };
}

export async function updateProjectSection(id, updates, section = null) {
  const patch = normalizeSectionUpdates(updates);
  if (patch.name !== undefined && !patch.name) return { data: null, error: new Error('Nazwa sekcji jest wymagana.'), local: false };
  if (!isSupabaseConfigured || section?.localId) {
    const now = new Date().toISOString();
    const next = readLocal(LOCAL_SECTIONS_KEY).map((s) => {
      if (String(s.id ?? s.localId) !== String(id)) return s;
      const merged = { ...s, updated_at: now };
      if (patch.name !== undefined) merged.name = patch.name;
      if (patch.header_color !== undefined) merged.header_color = patch.header_color;
      return merged;
    });
    writeLocal(LOCAL_SECTIONS_KEY, next);
    return { data: next.find((s) => String(s.id ?? s.localId) === String(id)) ?? null, error: null, local: true };
  }
  const dbPayload = { updated_at: new Date().toISOString() };
  if (patch.name !== undefined) dbPayload.name = patch.name;
  const { data, error } = await supabase
    .from('project_task_sections')
    .update(dbPayload)
    .eq('id', id)
    .select('*')
    .single();
  if (!error) {
    if (patch.header_color !== undefined) persistSectionColor(String(id), patch.header_color);
    return {
      data: data ? { ...data, header_color: patch.header_color !== undefined ? patch.header_color : mergeSectionColors([data])[0]?.header_color ?? null } : null,
      error,
      local: false
    };
  }
  return { data, error, local: false };
}

export async function deleteProjectSection(id) {
  persistSectionColor(String(id), null);
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
