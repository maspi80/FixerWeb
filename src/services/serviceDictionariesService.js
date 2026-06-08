import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

export const SERVICE_DICTIONARY_TYPES = {
  status: 'status',
  priority: 'priority',
  customerDeviceCategory: 'customer_device_category',
  intakeCondition: 'intake_condition',
  externalService: 'external_service',
  progressTemplate: 'progress_template'
};

export const DEFAULT_SERVICE_STATUSES = [
  'Przyjęte',
  'W diagnozie',
  'Oczekuje na części',
  'W naprawie',
  'Gotowe do odbioru',
  'Wydane',
  'Anulowane'
];

export const DEFAULT_SERVICE_PRIORITIES = ['Niski', 'Normalny', 'Wysoki', 'Pilny'];
export const DEFAULT_SERVICE_DEVICE_CATEGORIES = ['Kamera', 'Obiektyw', 'Audio', 'Oświetlenie', 'Komputer', 'Akcesoria'];
export const DEFAULT_SERVICE_INTAKE_CONDITIONS = ['Idealny', 'Dobry', 'Dostateczny', 'Uszkodzony'];
export const DEFAULT_SERVICE_EXTERNAL_SERVICES = ['Sony Polska', 'Panasonic Polska', 'Foto-Technika', 'CSE', 'Własny serwis'];
export const DEFAULT_SERVICE_PROGRESS_TEMPLATES = [
  'Wysłano do serwisu zewnętrznego',
  'Otrzymano kosztorys',
  'Oczekiwanie na decyzję klienta',
  'Naprawa zakończona',
  'Sprzęt gotowy do odbioru',
  'Klient poinformowany telefonicznie'
];

const storageKey = 'fixer-service-dictionaries';
const columns = 'id, dictionary_type, name, sort_order, created_at, updated_at';

function defaultsByType(type) {
  if (type === SERVICE_DICTIONARY_TYPES.priority) return DEFAULT_SERVICE_PRIORITIES;
  if (type === SERVICE_DICTIONARY_TYPES.customerDeviceCategory) return DEFAULT_SERVICE_DEVICE_CATEGORIES;
  if (type === SERVICE_DICTIONARY_TYPES.intakeCondition) return DEFAULT_SERVICE_INTAKE_CONDITIONS;
  if (type === SERVICE_DICTIONARY_TYPES.externalService) return DEFAULT_SERVICE_EXTERNAL_SERVICES;
  if (type === SERVICE_DICTIONARY_TYPES.progressTemplate) return DEFAULT_SERVICE_PROGRESS_TEMPLATES;
  return DEFAULT_SERVICE_STATUSES;
}

function readLocal() {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (parsed && Array.isArray(parsed.status) && Array.isArray(parsed.priority)) {
      return {
        status: parsed.status,
        priority: parsed.priority,
        customer_device_category: Array.isArray(parsed.customer_device_category) ? parsed.customer_device_category : DEFAULT_SERVICE_DEVICE_CATEGORIES,
        intake_condition: Array.isArray(parsed.intake_condition) ? parsed.intake_condition : DEFAULT_SERVICE_INTAKE_CONDITIONS,
        external_service: Array.isArray(parsed.external_service) ? parsed.external_service : DEFAULT_SERVICE_EXTERNAL_SERVICES,
        progress_template: Array.isArray(parsed.progress_template) ? parsed.progress_template : DEFAULT_SERVICE_PROGRESS_TEMPLATES
      };
    }
  } catch {}
  return {
    status: DEFAULT_SERVICE_STATUSES,
    priority: DEFAULT_SERVICE_PRIORITIES,
    customer_device_category: DEFAULT_SERVICE_DEVICE_CATEGORIES,
    intake_condition: DEFAULT_SERVICE_INTAKE_CONDITIONS,
    external_service: DEFAULT_SERVICE_EXTERNAL_SERVICES,
    progress_template: DEFAULT_SERVICE_PROGRESS_TEMPLATES
  };
}

function writeLocal(next) {
  localStorage.setItem(storageKey, JSON.stringify(next));
}

function localRows(type) {
  return (readLocal()[type] ?? defaultsByType(type)).map((name, index) => ({
    id: `${type}-${name}`,
    dictionary_type: type,
    name,
    sort_order: index + 1
  }));
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
  writeLocal({ ...current, [type]: Array.from(new Set(list.map((item) => item === oldName ? value : item))) });
}

function deleteLocal(id, type) {
  const current = readLocal();
  const oldName = String(id).replace(`${type}-`, '');
  const fallback = defaultsByType(type);
  const next = (current[type] ?? fallback).filter((item) => item !== oldName);
  writeLocal({ ...current, [type]: next.length ? next : fallback });
}

function reorderLocal(type, rows) {
  const current = readLocal();
  writeLocal({ ...current, [type]: rows.map((row) => row.name) });
}

function resetLocal(type) {
  const current = readLocal();
  writeLocal({ ...current, [type]: defaultsByType(type) });
}

export async function fetchServiceDictionary(type) {
  if (!isSupabaseConfigured) return { data: localRows(type), error: null, local: true };

  const { data, error } = await supabase
    .from('service_dictionaries')
    .select(columns)
    .eq('dictionary_type', type)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) return { data: [], error, local: false };
  return { data: data ?? [], error: null, local: false };
}

export async function addServiceDictionaryRecord(type, name, sortOrder) {
  const value = String(name ?? '').trim();
  if (!value) return { error: null, local: !isSupabaseConfigured };

  if (!isSupabaseConfigured) {
    addLocal(type, value);
    return { error: null, local: true };
  }

  const { error } = await supabase
    .from('service_dictionaries')
    .insert({ dictionary_type: type, name: value, sort_order: sortOrder });

  return { error, local: false };
}

export async function updateServiceDictionaryRecord(id, type, name) {
  const value = String(name ?? '').trim();
  if (!value) return { error: null, local: !isSupabaseConfigured };

  if (!isSupabaseConfigured || String(id).startsWith(`${type}-`)) {
    updateLocal(id, type, value);
    return { error: null, local: true };
  }

  const { error } = await supabase
    .from('service_dictionaries')
    .update({ name: value, updated_at: new Date().toISOString() })
    .eq('id', id);

  return { error, local: false };
}

export async function deleteServiceDictionaryRecord(id, type) {
  if (!isSupabaseConfigured || String(id).startsWith(`${type}-`)) {
    deleteLocal(id, type);
    return { error: null, local: true };
  }

  const { error } = await supabase
    .from('service_dictionaries')
    .delete()
    .eq('id', id);

  return { error, local: false };
}

export async function reorderServiceDictionaryRecords(type, rows) {
  const nextRows = rows.map((row, index) => ({ ...row, sort_order: index + 1 }));
  if (!isSupabaseConfigured || nextRows.some((row) => String(row.id).startsWith(`${type}-`))) {
    reorderLocal(type, nextRows);
    return { error: null, local: true };
  }

  const updates = nextRows.map((row) => supabase
    .from('service_dictionaries')
    .update({ sort_order: row.sort_order, updated_at: new Date().toISOString() })
    .eq('id', row.id));
  const results = await Promise.all(updates);
  const failed = results.find((result) => result.error);
  return { error: failed?.error ?? null, local: false };
}

export async function resetServiceDictionaryRecords(type) {
  const names = defaultsByType(type);
  if (!isSupabaseConfigured) {
    resetLocal(type);
    return { error: null, local: true };
  }

  const { error: deleteError } = await supabase
    .from('service_dictionaries')
    .delete()
    .eq('dictionary_type', type);
  if (deleteError) return { error: deleteError, local: false };

  const rows = names.map((name, index) => ({ dictionary_type: type, name, sort_order: index + 1 }));
  const { error } = await supabase.from('service_dictionaries').insert(rows);
  return { error, local: false };
}
