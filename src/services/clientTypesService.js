import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

const clientTypesColumns = 'id, name, sort_order, created_at, updated_at';

const DEFAULT_CLIENT_TYPES = ['Stały', 'Pracownik', 'VIP', 'Problematyczny', 'Nowy', 'Zablokowany'];

function localFallbackTypes() {
  try {
    const saved = localStorage.getItem('fixer-client-types');
    const parsed = saved ? JSON.parse(saved) : null;
    const names = Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_CLIENT_TYPES;
    return names.map((name, index) => ({ id: name, name, sort_order: index + 1 }));
  } catch {
    return DEFAULT_CLIENT_TYPES.map((name, index) => ({ id: name, name, sort_order: index + 1 }));
  }
}

export async function fetchClientTypes() {
  if (!isSupabaseConfigured) {
    return { data: localFallbackTypes(), error: null };
  }

  const { data, error } = await supabase
    .from('client_types')
    .select(clientTypesColumns)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) return { data: [], error };
  return { data: data ?? [], error: null };
}

export async function addClientTypeRecord(name, sortOrder) {
  if (!isSupabaseConfigured) {
    const current = localFallbackTypes().map((item) => item.name);
    const next = Array.from(new Set([...current, name]));
    localStorage.setItem('fixer-client-types', JSON.stringify(next));
    return { error: null };
  }

  const { error } = await supabase
    .from('client_types')
    .insert({ name, sort_order: sortOrder });

  return { error };
}

export async function deleteClientTypeRecord(id) {
  if (!isSupabaseConfigured) {
    const current = localFallbackTypes().map((item) => item.name);
    const next = current.filter((item) => item !== id);
    localStorage.setItem('fixer-client-types', JSON.stringify(next.length ? next : DEFAULT_CLIENT_TYPES));
    return { error: null };
  }

  const { error } = await supabase
    .from('client_types')
    .delete()
    .eq('id', id);

  return { error };
}

export async function resetClientTypesRecords(names = DEFAULT_CLIENT_TYPES) {
  if (!isSupabaseConfigured) {
    localStorage.setItem('fixer-client-types', JSON.stringify(names));
    return { error: null };
  }

  const { error: deleteError } = await supabase.from('client_types').delete().neq('name', '');
  if (deleteError) return { error: deleteError };

  const rows = names.map((name, index) => ({ name, sort_order: index + 1 }));
  const { error } = await supabase.from('client_types').insert(rows);
  return { error };
}
