import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

const clientTypesColumns = 'id, name, sort_order, created_at, updated_at';

const DEFAULT_CLIENT_TYPES = ['Stały', 'Pracownik', 'VIP', 'Problematyczny', 'Nowy', 'Zablokowany'];

function readLocalNames() {
  try {
    const saved = localStorage.getItem('fixer-client-types');
    const parsed = saved ? JSON.parse(saved) : null;
    return Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_CLIENT_TYPES;
  } catch {
    return DEFAULT_CLIENT_TYPES;
  }
}

function writeLocalNames(names) {
  localStorage.setItem('fixer-client-types', JSON.stringify(names.length ? names : DEFAULT_CLIENT_TYPES));
}

function localFallbackTypes() {
  return readLocalNames().map((name, index) => ({ id: name, name, sort_order: index + 1 }));
}

function addLocalType(name) {
  const value = String(name ?? '').trim();
  if (!value) return;
  const current = readLocalNames();
  const next = current.some((item) => item.toLowerCase() === value.toLowerCase()) ? current : [...current, value];
  writeLocalNames(next);
}

function updateLocalType(id, name) {
  const value = String(name ?? '').trim();
  if (!value) return;
  const current = readLocalNames();
  const next = current.map((item) => item === id ? value : item);
  writeLocalNames(Array.from(new Set(next)));
}

function deleteLocalType(id) {
  const current = readLocalNames();
  writeLocalNames(current.filter((item) => item !== id));
}

function localFallbackResult(payload = {}) {
  return { ...payload, error: null, local: true };
}

export async function fetchClientTypes() {
  if (!isSupabaseConfigured) {
    return localFallbackResult({ data: localFallbackTypes() });
  }

  const { data, error } = await supabase
    .from('client_types')
    .select(clientTypesColumns)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) return localFallbackResult({ data: localFallbackTypes() });
  return { data: data ?? [], error: null };
}

export async function addClientTypeRecord(name, sortOrder) {
  const value = String(name ?? '').trim();
  if (!value) return { error: null };

  if (!isSupabaseConfigured) {
    addLocalType(value);
    return localFallbackResult();
  }

  const { error } = await supabase
    .from('client_types')
    .insert({ name: value, sort_order: sortOrder });

  if (error) {
    addLocalType(value);
    return localFallbackResult();
  }
  return { error };
}

export async function updateClientTypeRecord(id, name) {
  const value = String(name ?? '').trim();
  if (!value) return { error: null };

  if (!isSupabaseConfigured || readLocalNames().includes(id)) {
    updateLocalType(id, value);
    return localFallbackResult();
  }

  const { error } = await supabase
    .from('client_types')
    .update({ name: value, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    updateLocalType(id, value);
    return localFallbackResult();
  }
  return { error };
}

export async function deleteClientTypeRecord(id) {
  if (!isSupabaseConfigured) {
    deleteLocalType(id);
    return localFallbackResult();
  }

  const { error } = await supabase
    .from('client_types')
    .delete()
    .eq('id', id);

  if (error) {
    deleteLocalType(id);
    return localFallbackResult();
  }
  return { error };
}

export async function resetClientTypesRecords(names = DEFAULT_CLIENT_TYPES) {
  if (!isSupabaseConfigured) {
    writeLocalNames(names);
    return localFallbackResult();
  }

  const { error: deleteError } = await supabase.from('client_types').delete().neq('name', '');
  if (deleteError) {
    writeLocalNames(names);
    return localFallbackResult();
  }

  const rows = names.map((name, index) => ({ name, sort_order: index + 1 }));
  const { error } = await supabase.from('client_types').insert(rows);
  if (error) {
    writeLocalNames(names);
    return localFallbackResult();
  }
  return { error };
}
