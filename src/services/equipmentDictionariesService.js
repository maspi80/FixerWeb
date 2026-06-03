import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

export const DEFAULT_EQUIPMENT_CATEGORIES = ['Kamera', 'Obiektyw', 'Audio', 'Mikser Video', 'Streaming', 'Oświetlenie', 'Komputer', 'Akcesoria', 'Zestaw'];
export const DEFAULT_EQUIPMENT_STATUSES = ['Dostępny', 'Wypożyczony', 'Rezerwacja', 'Serwis', 'Uszkodzony', 'Wycofany', 'Składnik zestawu'];
export const DEFAULT_EQUIPMENT_LOCATIONS = ['Magazyn'];

const storageKey = 'fixer-equipment-dictionaries';
const columns = 'id, dictionary_type, name, sort_order, created_at, updated_at';

function defaultsByType(type) {
  if (type === 'status') return DEFAULT_EQUIPMENT_STATUSES;
  if (type === 'location') return DEFAULT_EQUIPMENT_LOCATIONS;
  return DEFAULT_EQUIPMENT_CATEGORIES;
}

function readLocal() {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (parsed && Array.isArray(parsed.category) && Array.isArray(parsed.status)) {
      return { category: parsed.category, status: parsed.status, location: Array.isArray(parsed.location) ? parsed.location : DEFAULT_EQUIPMENT_LOCATIONS };
    }
  } catch {}
  return { category: DEFAULT_EQUIPMENT_CATEGORIES, status: DEFAULT_EQUIPMENT_STATUSES, location: DEFAULT_EQUIPMENT_LOCATIONS };
}

function writeLocal(next) {
  localStorage.setItem(storageKey, JSON.stringify(next));
}

function localRows(type) {
  return readLocal()[type].map((name, index) => ({ id: `${type}-${name}`, dictionary_type: type, name, sort_order: index + 1 }));
}

function localFallbackResult(payload = {}) {
  return { ...payload, error: null, local: true };
}

function addLocal(type, value) {
  const current = readLocal();
  const list = current[type] ?? defaultsByType(type);
  if (!list.some((item) => item.toLowerCase() === value.toLowerCase())) {
    writeLocal({ ...current, [type]: [...list, value] });
  }
}

function updateLocal(id, type, value) {
  const current = readLocal();
  const list = current[type] ?? defaultsByType(type);
  const oldName = String(id).replace(`${type}-`, '');
  const next = list.map((item) => item === oldName ? value : item);
  writeLocal({ ...current, [type]: Array.from(new Set(next)) });
}

function deleteLocal(id, type) {
  const current = readLocal();
  const oldName = String(id).replace(`${type}-`, '');
  const fallback = defaultsByType(type);
  const next = (current[type] ?? fallback).filter((item) => item !== oldName);
  writeLocal({ ...current, [type]: next.length ? next : fallback });
}

function resetLocal(type) {
  const current = readLocal();
  writeLocal({ ...current, [type]: defaultsByType(type) });
}

export function getLocalEquipmentDictionaryNames(type) {
  return readLocal()[type] ?? defaultsByType(type);
}

export async function fetchEquipmentDictionary(type) {
  if (!isSupabaseConfigured) return { data: localRows(type), error: null };

  const { data, error } = await supabase
    .from('equipment_dictionaries')
    .select(columns)
    .eq('dictionary_type', type)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) return localFallbackResult({ data: localRows(type) });
  const rows = data?.length ? data : localRows(type);
  return { data: rows, error: null };
}

export async function addEquipmentDictionaryRecord(type, name, sortOrder) {
  const value = String(name ?? '').trim();
  if (!value) return { error: null };

  if (!isSupabaseConfigured) {
    addLocal(type, value);
    return { error: null, local: true };
  }

  const { error } = await supabase
    .from('equipment_dictionaries')
    .insert({ dictionary_type: type, name: value, sort_order: sortOrder });

  if (error) {
    addLocal(type, value);
    return localFallbackResult();
  }
  return { error };
}

export async function updateEquipmentDictionaryRecord(id, type, name) {
  const value = String(name ?? '').trim();
  if (!value) return { error: null };

  if (!isSupabaseConfigured || String(id).startsWith(`${type}-`)) {
    updateLocal(id, type, value);
    return { error: null, local: true };
  }

  const { error } = await supabase
    .from('equipment_dictionaries')
    .update({ name: value, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    updateLocal(id, type, value);
    return localFallbackResult();
  }
  return { error };
}

export async function deleteEquipmentDictionaryRecord(id, type) {
  if (!isSupabaseConfigured || String(id).startsWith(`${type}-`)) {
    deleteLocal(id, type);
    return { error: null, local: true };
  }

  const { error } = await supabase
    .from('equipment_dictionaries')
    .delete()
    .eq('id', id);

  if (error) {
    deleteLocal(id, type);
    return localFallbackResult();
  }
  return { error };
}

export async function resetEquipmentDictionaryRecords(type) {
  const names = defaultsByType(type);
  if (!isSupabaseConfigured) {
    resetLocal(type);
    return { error: null, local: true };
  }

  const { error: deleteError } = await supabase
    .from('equipment_dictionaries')
    .delete()
    .eq('dictionary_type', type);
  if (deleteError) {
    resetLocal(type);
    return localFallbackResult();
  }

  const rows = names.map((name, index) => ({ dictionary_type: type, name, sort_order: index + 1 }));
  const { error } = await supabase.from('equipment_dictionaries').insert(rows);
  if (error) {
    resetLocal(type);
    return localFallbackResult();
  }
  return { error };
}
