import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

const LOCAL_CALENDAR_EVENTS_KEY = 'fixer-calendar-events';

const calendarColumns = `
  id, title, description, start_at, end_at, all_day, color, location,
  created_at, updated_at
`;

function readLocalEvents() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_CALENDAR_EVENTS_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalEvents(rows) {
  localStorage.setItem(LOCAL_CALENDAR_EVENTS_KEY, JSON.stringify(rows));
  return rows;
}

function normalizeManualEvent(event) {
  return {
    title: String(event.title ?? '').trim(),
    description: String(event.description ?? '').trim(),
    start_at: event.start_at || null,
    end_at: event.end_at || null,
    all_day: event.all_day !== false,
    color: String(event.color ?? '').trim() || null,
    location: String(event.location ?? '').trim() || null
  };
}

export async function fetchCalendarManualEvents() {
  if (!isSupabaseConfigured) return { data: readLocalEvents(), error: null, local: true };

  const { data, error } = await supabase
    .from('calendar_events')
    .select(calendarColumns)
    .order('start_at', { ascending: true });

  return { data: data ?? [], error, local: false };
}

export async function createCalendarManualEvent(event) {
  const payload = normalizeManualEvent(event);
  if (!payload.title) return { data: null, error: new Error('Tytuł wydarzenia jest wymagany.'), local: !isSupabaseConfigured };
  if (!payload.start_at) return { data: null, error: new Error('Data rozpoczęcia jest wymagana.'), local: !isSupabaseConfigured };

  if (!isSupabaseConfigured) {
    const now = new Date().toISOString();
    const created = { ...payload, id: crypto.randomUUID(), localId: crypto.randomUUID(), created_at: now, updated_at: now };
    writeLocalEvents([created, ...readLocalEvents()]);
    return { data: created, error: null, local: true };
  }

  const { data, error } = await supabase
    .from('calendar_events')
    .insert(payload)
    .select(calendarColumns)
    .single();

  return { data, error, local: false };
}

export async function updateCalendarManualEvent(id, event) {
  const payload = normalizeManualEvent(event);
  if (!payload.title) return { data: null, error: new Error('Tytuł wydarzenia jest wymagany.'), local: !isSupabaseConfigured };
  if (!payload.start_at) return { data: null, error: new Error('Data rozpoczęcia jest wymagana.'), local: !isSupabaseConfigured };

  if (!isSupabaseConfigured || event.localId) {
    const now = new Date().toISOString();
    const next = readLocalEvents().map((row) =>
      String(row.id ?? row.localId) === String(id) ? { ...row, ...payload, updated_at: now } : row
    );
    writeLocalEvents(next);
    return { data: next.find((row) => String(row.id ?? row.localId) === String(id)) ?? null, error: null, local: true };
  }

  const { data, error } = await supabase
    .from('calendar_events')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(calendarColumns)
    .single();

  return { data, error, local: false };
}

export async function deleteCalendarManualEvent(id, event = null) {
  if (!isSupabaseConfigured || event?.localId) {
    writeLocalEvents(readLocalEvents().filter((row) => String(row.id ?? row.localId) !== String(id)));
    return { error: null, local: true };
  }

  const { error } = await supabase.from('calendar_events').delete().eq('id', id);
  return { error, local: false };
}
