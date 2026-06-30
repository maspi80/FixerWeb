export const WORK_DICTIONARY_TYPES = {
  priority: 'priority'
};

export const DEFAULT_WORK_PRIORITIES = ['Niski', 'Normalny', 'Wysoki', 'Pilny'];

const STORAGE_KEY = 'fixer-work-dictionaries';

function normalizePriorityRow(item, index) {
  if (typeof item === 'string') {
    const name = String(item).trim();
    return name ? { name, sort_order: index + 1, active: true } : null;
  }
  const name = String(item?.name ?? '').trim();
  if (!name) return null;
  return {
    name,
    sort_order: Number(item?.sort_order) || index + 1,
    active: item?.active !== false
  };
}

function readPriorityRows() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    const rows = Array.isArray(parsed?.priority) ? parsed.priority : null;
    const normalized = (rows ?? DEFAULT_WORK_PRIORITIES.map((name, index) => ({ name, sort_order: index + 1, active: true })))
      .map(normalizePriorityRow)
      .filter(Boolean);
    return normalized.length ? normalized : DEFAULT_WORK_PRIORITIES.map((name, index) => ({ name, sort_order: index + 1, active: true }));
  } catch {
    return DEFAULT_WORK_PRIORITIES.map((name, index) => ({ name, sort_order: index + 1, active: true }));
  }
}

function writePriorityRows(rows) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    priority: rows.map((row, index) => ({
      name: row.name,
      sort_order: index + 1,
      active: row.active !== false
    }))
  }));
}

function toDictionaryRecords(rows) {
  return rows
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name, 'pl'))
    .map((row, index) => ({
      id: `priority-${row.name}`,
      dictionary_type: WORK_DICTIONARY_TYPES.priority,
      name: row.name,
      sort_order: index + 1,
      active: row.active !== false
    }));
}

export function getActiveWorkPriorityNames() {
  return toDictionaryRecords(readPriorityRows()).filter((row) => row.active !== false).map((row) => row.name);
}

export function normalizeWorkPriority(priority) {
  const raw = String(priority ?? '').trim();
  if (!raw) return getDefaultWorkPriority();
  const rows = readPriorityRows();
  const match = rows.find((row) => row.name.toLocaleLowerCase('pl') === raw.toLocaleLowerCase('pl'));
  if (match) return match.name;
  const fallback = DEFAULT_WORK_PRIORITIES.find((item) => item.toLocaleLowerCase('pl') === raw.toLocaleLowerCase('pl'));
  if (fallback) return fallback;
  return raw;
}

export function getDefaultWorkPriority() {
  const active = getActiveWorkPriorityNames();
  if (active.includes('Normalny')) return 'Normalny';
  return active[0] ?? DEFAULT_WORK_PRIORITIES[1] ?? 'Normalny';
}

export async function fetchWorkDictionary(type = WORK_DICTIONARY_TYPES.priority) {
  if (type !== WORK_DICTIONARY_TYPES.priority) return { data: [], error: null, local: true };
  return { data: toDictionaryRecords(readPriorityRows()), error: null, local: true };
}

export async function addWorkDictionaryRecord(type, name, sortOrder) {
  const value = String(name ?? '').trim();
  if (!value || type !== WORK_DICTIONARY_TYPES.priority) return { error: null, local: true };
  const rows = readPriorityRows();
  if (rows.some((row) => row.name.toLocaleLowerCase('pl') === value.toLocaleLowerCase('pl'))) {
    return { error: new Error('Taki priorytet już istnieje.'), local: true };
  }
  writePriorityRows([...rows, { name: value, sort_order: sortOrder, active: true }]);
  return { error: null, local: true };
}

export async function updateWorkDictionaryRecord(id, type, name) {
  const value = String(name ?? '').trim();
  if (!value || type !== WORK_DICTIONARY_TYPES.priority) return { error: null, local: true };
  const oldName = String(id).replace('priority-', '');
  const rows = readPriorityRows();
  if (rows.some((row) => row.name.toLocaleLowerCase('pl') === value.toLocaleLowerCase('pl') && row.name !== oldName)) {
    return { error: new Error('Taki priorytet już istnieje.'), local: true };
  }
  writePriorityRows(rows.map((row) => (row.name === oldName ? { ...row, name: value } : row)));
  return { error: null, local: true };
}

export async function deleteWorkDictionaryRecord(id, type) {
  if (type !== WORK_DICTIONARY_TYPES.priority) return { error: null, local: true };
  const oldName = String(id).replace('priority-', '');
  const rows = readPriorityRows();
  if (rows.length <= 1) return { error: new Error('Musi zostać przynajmniej jedna pozycja.'), local: true };
  const next = rows.filter((row) => row.name !== oldName);
  writePriorityRows(next.length ? next : readPriorityRows());
  return { error: null, local: true };
}

export async function reorderWorkDictionaryRecords(type, rows) {
  if (type !== WORK_DICTIONARY_TYPES.priority) return { error: null, local: true };
  const byName = new Map(readPriorityRows().map((row) => [row.name, row]));
  writePriorityRows(rows.map((row, index) => ({
    ...(byName.get(row.name) ?? { name: row.name, active: true }),
    name: row.name,
    sort_order: index + 1
  })));
  return { error: null, local: true };
}

export async function toggleWorkDictionaryRecordActive(id, type) {
  if (type !== WORK_DICTIONARY_TYPES.priority) return { error: null, local: true };
  const oldName = String(id).replace('priority-', '');
  const rows = readPriorityRows();
  const activeCount = rows.filter((row) => row.active !== false).length;
  const target = rows.find((row) => row.name === oldName);
  if (!target) return { error: new Error('Nie znaleziono priorytetu.'), local: true };
  if (target.active !== false && activeCount <= 1) {
    return { error: new Error('Musi zostać przynajmniej jeden aktywny priorytet.'), local: true };
  }
  writePriorityRows(rows.map((row) => (row.name === oldName ? { ...row, active: row.active === false } : row)));
  return { error: null, local: true };
}

export async function resetWorkDictionaryRecords(type) {
  if (type !== WORK_DICTIONARY_TYPES.priority) return { error: null, local: true };
  writePriorityRows(DEFAULT_WORK_PRIORITIES.map((name, index) => ({ name, sort_order: index + 1, active: true })));
  return { error: null, local: true };
}
