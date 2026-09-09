import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

export const NOTE_STATUSES = ['Aktywna', 'Archiwum'];
export const NOTE_PRIORITIES = ['Niski', 'Normalny', 'Wysoki', 'Pilne'];
export const DEFAULT_NOTE_COLOR = 'default';
export const NOTE_COLORS = [
  { id: 'default', label: 'Domyślny' },
  { id: 'blue', label: 'Niebieski' },
  { id: 'green', label: 'Zielony' },
  { id: 'yellow', label: 'Żółty' },
  { id: 'orange', label: 'Pomarańczowy' },
  { id: 'red', label: 'Czerwony' },
  { id: 'purple', label: 'Fioletowy' },
  { id: 'gray', label: 'Szary' }
];

const LOCAL_NOTES_KEY = 'fixer-notes';
const NOTE_COLOR_IDS = new Set(NOTE_COLORS.map((color) => color.id));
const NOTE_ORDER_STEP = 100;

const noteColumns = `
  id, title, content, status, priority, pinned, note_color, sort_order, created_at, updated_at
`;
const noteColumnsLegacy = noteColumns.replace(', sort_order', '');

function isMissingSortOrderError(error) {
  const message = String(error?.message ?? '').toLocaleLowerCase('pl');
  return String(error?.code ?? '') === '42703' || (message.includes('sort_order') && (
    message.includes('does not exist') || message.includes('could not find') || message.includes('schema cache')
  ));
}

function getNoteOrderError(error) {
  if (isMissingSortOrderError(error)) {
    return new Error('Brak obsługi kolejności notatek w bazie. Uruchom migrację supabase/023_notes_sort_order.sql.');
  }
  return error;
}

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

function normalizeNoteColor(color) {
  const value = String(color ?? DEFAULT_NOTE_COLOR).trim();
  return NOTE_COLOR_IDS.has(value) ? value : DEFAULT_NOTE_COLOR;
}

function normalizeNote(note) {
  const sortOrder = Number(note.sort_order);
  return {
    title: String(note.title ?? '').trim(),
    content: String(note.content ?? ''),
    status: NOTE_STATUSES.includes(note.status) ? note.status : 'Aktywna',
    priority: NOTE_PRIORITIES.includes(note.priority) ? note.priority : 'Normalny',
    pinned: Boolean(note.pinned),
    note_color: normalizeNoteColor(note.note_color),
    ...(Number.isFinite(sortOrder) ? { sort_order: sortOrder } : {})
  };
}

export async function fetchNotes() {
  if (!isSupabaseConfigured) {
    return {
      data: readLocal(LOCAL_NOTES_KEY).map((row) => ({ ...row, note_color: normalizeNoteColor(row.note_color) })),
      error: null,
      local: true
    };
  }
  let result = await supabase
    .from('notes')
    .select(noteColumns)
    .order('sort_order', { ascending: true })
    .order('updated_at', { ascending: false });
  if (result.error && isMissingSortOrderError(result.error)) {
    result = await supabase
      .from('notes')
      .select(noteColumnsLegacy)
      .order('updated_at', { ascending: false });
  }
  const { data, error } = result;
  return { data: (data ?? []).map((row) => ({ ...row, note_color: normalizeNoteColor(row.note_color) })), error, local: false };
}

export async function createNote(note) {
  const payload = normalizeNote(note);
  if (!payload.title) return { data: null, error: new Error('Tytuł notatki jest wymagany.'), local: false };
  if (!isSupabaseConfigured) {
    const now = new Date().toISOString();
    const created = { ...payload, id: crypto.randomUUID(), localId: crypto.randomUUID(), created_at: now, updated_at: now };
    writeLocal(LOCAL_NOTES_KEY, [created, ...readLocal(LOCAL_NOTES_KEY)]);
    return { data: created, error: null, local: true };
  }
  let result = await supabase
    .from('notes')
    .insert(payload)
    .select(noteColumns)
    .single();
  if (result.error && isMissingSortOrderError(result.error)) {
    const { sort_order: _sortOrder, ...legacyPayload } = payload;
    result = await supabase.from('notes').insert(legacyPayload).select(noteColumnsLegacy).single();
  }
  const { data, error } = result;
  return { data: data ? { ...data, note_color: normalizeNoteColor(data.note_color) } : null, error, local: false };
}

export async function updateNote(id, note) {
  const payload = normalizeNote(note);
  if (!isSupabaseConfigured || note.localId) {
    const now = new Date().toISOString();
    const next = readLocal(LOCAL_NOTES_KEY).map((row) =>
      String(row.id ?? row.localId) === String(id) ? { ...row, ...payload, updated_at: now } : row
    );
    writeLocal(LOCAL_NOTES_KEY, next);
    const saved = next.find((row) => String(row.id ?? row.localId) === String(id)) ?? null;
    return { data: saved ? { ...saved, note_color: normalizeNoteColor(saved.note_color) } : null, error: null, local: true };
  }
  let result = await supabase
    .from('notes')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(noteColumns)
    .single();
  if (result.error && isMissingSortOrderError(result.error)) {
    const { sort_order: _sortOrder, ...legacyPayload } = payload;
    result = await supabase
      .from('notes')
      .update({ ...legacyPayload, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select(noteColumnsLegacy)
      .single();
  }
  const { data, error } = result;
  return { data: data ? { ...data, note_color: normalizeNoteColor(data.note_color) } : null, error, local: false };
}

export async function deleteNote(id, note = null) {
  if (!isSupabaseConfigured || note?.localId) {
    writeLocal(LOCAL_NOTES_KEY, readLocal(LOCAL_NOTES_KEY).filter((row) => String(row.id ?? row.localId) !== String(id)));
    return { error: null, local: true };
  }
  const { error } = await supabase.from('notes').delete().eq('id', id);
  return { error, local: false };
}

export async function reorderNotes(orderedNotes = []) {
  const updates = orderedNotes
    .map((note, index) => ({ id: note.id ?? note.localId, sort_order: (index + 1) * NOTE_ORDER_STEP }))
    .filter((row) => row.id);
  if (!updates.length) return { error: null, local: !isSupabaseConfigured };

  if (!isSupabaseConfigured || orderedNotes.some((note) => note.localId)) {
    const orderById = new Map(updates.map((row) => [String(row.id), row.sort_order]));
    const next = readLocal(LOCAL_NOTES_KEY).map((note) => {
      const id = String(note.id ?? note.localId);
      return orderById.has(id) ? { ...note, sort_order: orderById.get(id) } : note;
    });
    writeLocal(LOCAL_NOTES_KEY, next);
    return { error: null, local: true };
  }

  const results = await Promise.all(updates.map((row) => supabase
    .from('notes')
    .update({ sort_order: row.sort_order })
    .eq('id', row.id)));
  const failed = results.find((result) => result.error);
  return { error: failed?.error ? getNoteOrderError(failed.error) : null, local: false };
}
