import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

export const ORGANIZER_TASK_STATUSES = ['Do zrobienia', 'W trakcie', 'Oczekuje', 'Zrobione', 'Anulowane'];
export const ORGANIZER_TASK_PRIORITIES = ['Niski', 'Normalny', 'Wysoki', 'Pilne'];
export const ORGANIZER_TERMINAL_STATUSES = ['Zrobione', 'Anulowane'];
export const DEFAULT_ORGANIZER_CATEGORIES = ['Ogólne', 'Serwis', 'Wypożyczenia', 'Klienci', 'Administracja'];

const LOCAL_TASKS_KEY = 'fixer-organizer-tasks';
const LOCAL_CATEGORIES_KEY = 'fixer-organizer-categories';

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
    status: ORGANIZER_TASK_STATUSES.includes(task.status) ? task.status : 'Do zrobienia',
    priority: ORGANIZER_TASK_PRIORITIES.includes(task.priority) ? task.priority : 'Normalny',
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
    return { error: null, local: true };
  }
  const { error } = await supabase.from('organizer_tasks').delete().eq('id', id);
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
