import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { WORK_STATUSES, WORK_TERMINAL_STATUSES, normalizeWorkStatus } from './projectsService';
import { DEFAULT_WORK_PRIORITIES, normalizeWorkPriority } from './workDictionariesService';

export const ORGANIZER_TASK_STATUSES = WORK_STATUSES;
export const ORGANIZER_TASK_PRIORITIES = DEFAULT_WORK_PRIORITIES;
export const ORGANIZER_TERMINAL_STATUSES = WORK_TERMINAL_STATUSES;
export const DEFAULT_ORGANIZER_CATEGORIES = ['Ogólne', 'Serwis', 'Wypożyczenia', 'Klienci', 'Administracja'];

const LOCAL_TASKS_KEY = 'fixer-organizer-tasks';
const LOCAL_CATEGORIES_KEY = 'fixer-organizer-categories';
const LOCAL_COMMENTS_KEY = 'fixer-organizer-task-comments';

const taskColumns = `
  id, title, description, status, priority, due_date, reminder_at,
  category, linked_module, linked_id, linked_label,
  archived, completed_date, created_at, updated_at
`;

function readLocal(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocal(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
  return data;
}

function normalizeTask(task) {
  return {
    title: String(task.title ?? '').trim(),
    description: String(task.description ?? '').trim(),
    status: normalizeWorkStatus(task.status),
    priority: normalizeWorkPriority(task.priority),
    due_date: task.due_date || null,
    reminder_at: task.reminder_at || null,
    category: String(task.category ?? '').trim() || null,
    linked_module: task.linked_module || null,
    linked_id: task.linked_id || null,
    linked_label: String(task.linked_label ?? '').trim() || null,
    archived: Boolean(task.archived),
    completed_date: task.completed_date || null
  };
}

export async function fetchOrganizerTasks() {
  if (!isSupabaseConfigured) {
    return { data: readLocal(LOCAL_TASKS_KEY), error: null, local: true };
  }
  const { data, error } = await supabase
    .from('organizer_tasks')
    .select(taskColumns)
    .order('created_at', { ascending: false });
  return { data: data ?? [], error, local: false };
}

export async function createOrganizerTask(task) {
  const payload = normalizeTask(task);
  if (!payload.title) return { data: null, error: new Error('Tytuł zadania jest wymagany.'), local: false };
  if (!isSupabaseConfigured) {
    const now = new Date().toISOString();
    const created = { ...payload, id: crypto.randomUUID(), localId: crypto.randomUUID(), created_at: now, updated_at: now };
    writeLocal(LOCAL_TASKS_KEY, [created, ...readLocal(LOCAL_TASKS_KEY)]);
    return { data: created, error: null, local: true };
  }
  const { data, error } = await supabase
    .from('organizer_tasks')
    .insert(payload)
    .select(taskColumns)
    .single();
  return { data, error, local: false };
}

export async function updateOrganizerTask(id, task) {
  const payload = normalizeTask(task);
  if (!isSupabaseConfigured || task.localId) {
    const now = new Date().toISOString();
    const next = readLocal(LOCAL_TASKS_KEY).map((row) =>
      String(row.id ?? row.localId) === String(id) ? { ...row, ...payload, updated_at: now } : row
    );
    writeLocal(LOCAL_TASKS_KEY, next);
    return { data: next.find((row) => String(row.id ?? row.localId) === String(id)) ?? null, error: null, local: true };
  }
  const { data, error } = await supabase
    .from('organizer_tasks')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(taskColumns)
    .single();
  return { data, error, local: false };
}

export async function deleteOrganizerTask(id, task = null) {
  if (!isSupabaseConfigured || task?.localId) {
    writeLocal(LOCAL_TASKS_KEY, readLocal(LOCAL_TASKS_KEY).filter((row) => String(row.id ?? row.localId) !== String(id)));
    writeLocal(LOCAL_COMMENTS_KEY, readLocal(LOCAL_COMMENTS_KEY).filter((row) => String(row.task_id) !== String(id)));
    return { error: null, local: true };
  }
  const { error } = await supabase.from('organizer_tasks').delete().eq('id', id);
  return { error, local: false };
}

// ─── Organizer Task Comments ─────────────────────────────────────────────────

export async function fetchOrganizerTaskComments(taskId) {
  if (!taskId) return { data: [], error: null, local: !isSupabaseConfigured };
  if (!isSupabaseConfigured) {
    return { data: readLocal(LOCAL_COMMENTS_KEY).filter((row) => String(row.task_id) === String(taskId)), error: null, local: true };
  }
  const { data, error } = await supabase
    .from('organizer_task_comments')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true });
  return { data: data ?? [], error, local: false };
}

export async function createOrganizerTaskComment(taskId, body, type = 'Komentarz', author = '') {
  if (!taskId) return { data: null, error: new Error('ID zadania jest wymagane.'), local: false };
  if (!body?.trim()) return { data: null, error: new Error('Treść komentarza jest wymagana.'), local: false };
  if (!isSupabaseConfigured) {
    const now = new Date().toISOString();
    const created = { id: crypto.randomUUID(), localId: crypto.randomUUID(), task_id: taskId, body: body.trim(), type, author, created_at: now, updated_at: now };
    writeLocal(LOCAL_COMMENTS_KEY, [...readLocal(LOCAL_COMMENTS_KEY), created]);
    return { data: created, error: null, local: true };
  }
  const { data, error } = await supabase
    .from('organizer_task_comments')
    .insert({ task_id: taskId, body: body.trim(), type, author })
    .select('*')
    .single();
  return { data, error, local: false };
}

export async function updateOrganizerTaskComment(id, body, comment = null) {
  if (!body?.trim()) return { data: null, error: new Error('Treść komentarza jest wymagana.'), local: false };
  if (!isSupabaseConfigured || comment?.localId) {
    const now = new Date().toISOString();
    const next = readLocal(LOCAL_COMMENTS_KEY).map((row) => (
      String(row.id ?? row.localId) === String(id) ? { ...row, body: body.trim(), updated_at: now } : row
    ));
    writeLocal(LOCAL_COMMENTS_KEY, next);
    return { data: next.find((row) => String(row.id ?? row.localId) === String(id)) ?? null, error: null, local: true };
  }
  const { data, error } = await supabase
    .from('organizer_task_comments')
    .update({ body: body.trim(), updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  return { data, error, local: false };
}

export async function deleteOrganizerTaskComment(id, comment = null) {
  if (!id) return { error: new Error('ID komentarza jest wymagane.'), local: false };
  if (!isSupabaseConfigured || comment?.localId) {
    writeLocal(LOCAL_COMMENTS_KEY, readLocal(LOCAL_COMMENTS_KEY).filter((row) => String(row.id ?? row.localId) !== String(id)));
    return { error: null, local: true };
  }
  const { error } = await supabase.from('organizer_task_comments').delete().eq('id', id);
  return { error, local: false };
}

export async function fetchOrganizerCategories() {
  if (!isSupabaseConfigured) {
    const stored = readLocal(LOCAL_CATEGORIES_KEY);
    const names = stored.length ? stored : DEFAULT_ORGANIZER_CATEGORIES;
    return { data: names.map((name, index) => ({ id: `cat-${name}`, name, sort_order: index + 1 })), error: null, local: true };
  }
  const { data, error } = await supabase
    .from('organizer_categories')
    .select('id, name, sort_order')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  return { data: data ?? [], error, local: false };
}

export async function addOrganizerCategory(name, sortOrder) {
  const value = String(name ?? '').trim();
  if (!value) return { error: null, local: !isSupabaseConfigured };
  if (!isSupabaseConfigured) {
    const current = readLocal(LOCAL_CATEGORIES_KEY);
    const names = current.length ? current : DEFAULT_ORGANIZER_CATEGORIES;
    if (!names.some((n) => n.toLowerCase() === value.toLowerCase())) {
      writeLocal(LOCAL_CATEGORIES_KEY, [...names, value]);
    }
    return { error: null, local: true };
  }
  const { error } = await supabase.from('organizer_categories').insert({ name: value, sort_order: sortOrder });
  return { error, local: false };
}

export async function updateOrganizerCategory(id, name) {
  const value = String(name ?? '').trim();
  if (!value) return { error: null, local: !isSupabaseConfigured };
  if (!isSupabaseConfigured || String(id).startsWith('cat-')) {
    const oldName = String(id).replace('cat-', '');
    const current = readLocal(LOCAL_CATEGORIES_KEY);
    const names = current.length ? current : DEFAULT_ORGANIZER_CATEGORIES;
    writeLocal(LOCAL_CATEGORIES_KEY, names.map((n) => (n === oldName ? value : n)));
    return { error: null, local: true };
  }
  const { error } = await supabase
    .from('organizer_categories')
    .update({ name: value, updated_at: new Date().toISOString() })
    .eq('id', id);
  return { error, local: false };
}

export async function deleteOrganizerCategory(id) {
  if (!isSupabaseConfigured || String(id).startsWith('cat-')) {
    const oldName = String(id).replace('cat-', '');
    const current = readLocal(LOCAL_CATEGORIES_KEY);
    const names = current.length ? current : DEFAULT_ORGANIZER_CATEGORIES;
    const next = names.filter((n) => n !== oldName);
    writeLocal(LOCAL_CATEGORIES_KEY, next.length ? next : DEFAULT_ORGANIZER_CATEGORIES);
    return { error: null, local: true };
  }
  const { error } = await supabase.from('organizer_categories').delete().eq('id', id);
  return { error, local: false };
}

export async function resetOrganizerCategories() {
  if (!isSupabaseConfigured) {
    writeLocal(LOCAL_CATEGORIES_KEY, DEFAULT_ORGANIZER_CATEGORIES);
    return { error: null, local: true };
  }
  await supabase.from('organizer_categories').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  const rows = DEFAULT_ORGANIZER_CATEGORIES.map((name, index) => ({ name, sort_order: index + 1 }));
  const { error } = await supabase.from('organizer_categories').insert(rows);
  return { error, local: false };
}
