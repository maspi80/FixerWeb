import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { fetchClients } from './clientsService';
import { fetchEquipment } from './equipmentService';
import { fetchOrganizerTasks } from './organizerService';
import { fetchProjects, fetchAllProjectTasks } from './projectsService';
import { fetchRentals } from './rentalsService';
import { fetchServiceOrders } from './serviceOrdersService';

export const BACKUP_VERSION = '1.0.0';

const BACKUP_TABLES = [
  'clients',
  'client_types',
  'equipment',
  'equipment_dictionaries',
  'rentals',
  'rental_items',
  'service_orders',
  'service_order_progress',
  'service_order_attachments',
  'service_dictionaries',
  'organizer_categories',
  'organizer_tasks',
  'organizer_task_comments',
  'calendar_events',
  'projects',
  'project_tasks',
  'project_task_sections',
  'project_task_comments'
];

const DELETE_ORDER = [
  'service_order_attachments',
  'service_order_progress',
  'rental_items',
  'calendar_events',
  'organizer_task_comments',
  'organizer_tasks',
  'project_task_comments',
  'project_tasks',
  'project_task_sections',
  'projects',
  'service_orders',
  'rentals',
  'organizer_categories',
  'service_dictionaries',
  'equipment_dictionaries',
  'client_types',
  'equipment',
  'clients'
];

const INSERT_ORDER = [
  'clients',
  'equipment',
  'client_types',
  'equipment_dictionaries',
  'service_dictionaries',
  'organizer_categories',
  'projects',
  'project_task_sections',
  'rentals',
  'rental_items',
  'service_orders',
  'service_order_progress',
  'service_order_attachments',
  'organizer_tasks',
  'organizer_task_comments',
  'calendar_events',
  'project_tasks',
  'project_task_comments'
];

const SETTINGS_KEYS = [
  'fixer-company-profile',
  'fixer-document-settings',
  'fixer-rental-numbering',
  'fixer-config-dictionaries',
  'fixer-status-colors',
  'fixer-dashboard-layout-v2',
  'fixer-ui-preferences',
  'fixer-client-types',
  'fixer-equipment-dictionaries',
  'fixer-service-dictionaries',
  'fixer-organizer-categories',
  'fixer-organizer-tasks',
  'fixer-organizer-task-comments',
  'fixer-projects',
  'fixer-project-tasks',
  'fixer-project-task-sections',
  'fixer-project-task-comments',
  'fixer-calendar-events',
  'fixer-calendar-view',
  'fixer-calendar-sources',
  'fixer.calendar.sourceSettings',
  'fixer.calendar.activeSources',
  'fixer-density',
  'fixer-color-theme',
  'fixer-sidebar'
];

const REQUIRED_SETTINGS_KEYS = [
  'fixer-company-profile',
  'fixer-document-settings',
  'fixer-rental-numbering',
  'fixer-config-dictionaries',
  'fixer-status-colors'
];

const FULL_BACKUP_ERROR = 'Nie udało się utworzyć pełnej kopii bezpieczeństwa. Backup nie został zapisany.';

const CSV_DEFINITIONS = {
  clients: {
    filePrefix: 'fixer-klienci',
    loader: fetchClients,
    columns: [
      ['name', 'Nazwa'],
      ['type', 'Typ'],
      ['client_kind', 'Rodzaj'],
      ['phone', 'Telefon'],
      ['email', 'Email'],
      ['nip', 'NIP'],
      ['city', 'Miasto']
    ]
  },
  equipment: {
    filePrefix: 'fixer-sprzet',
    loader: fetchEquipment,
    columns: [
      ['name', 'Nazwa'],
      ['brand', 'Marka'],
      ['model', 'Model'],
      ['serial', 'Numer seryjny'],
      ['inventory_number', 'Nr inw.'],
      ['barcode', 'Kod'],
      ['category', 'Kategoria'],
      ['status', 'Status'],
      ['location', 'Lokalizacja']
    ]
  },
  rentals: {
    filePrefix: 'fixer-wypozyczenia',
    loader: fetchRentals,
    mapRow: (row) => ({
      ...row,
      client_name: row.clients?.name ?? '',
      items_summary: (row.rental_items ?? []).map((item) => item.name_snapshot).filter(Boolean).join(', ')
    }),
    columns: [
      ['rental_number', 'Numer'],
      ['client_name', 'Klient'],
      ['items_summary', 'Sprzęt'],
      ['status', 'Status'],
      ['start_date', 'Wydanie'],
      ['planned_return_date', 'Planowany zwrot']
    ]
  },
  service: {
    filePrefix: 'fixer-serwis',
    loader: fetchServiceOrders,
    mapRow: (row) => ({
      ...row,
      client_name: row.clients?.name ?? '',
      equipment_name: row.customer_device_name || row.equipment?.name || ''
    }),
    columns: [
      ['service_number', 'Numer'],
      ['client_name', 'Klient'],
      ['equipment_name', 'Urządzenie'],
      ['customer_device_serial', 'Numer seryjny'],
      ['status', 'Status'],
      ['priority', 'Priorytet'],
      ['planned_date', 'Planowany termin'],
      ['fault_description', 'Opis usterki']
    ]
  },
  organizer: {
    filePrefix: 'fixer-organizer',
    loader: fetchOrganizerTasks,
    columns: [
      ['title', 'Tytuł'],
      ['description', 'Opis'],
      ['status', 'Status'],
      ['priority', 'Priorytet'],
      ['category', 'Kategoria'],
      ['due_date', 'Termin'],
      ['reminder_at', 'Przypomnienie']
    ]
  },
  projects: {
    filePrefix: 'fixer-projekty',
    loader: fetchProjects,
    mapRow: (row) => ({ ...row, client_name: row.clients?.name ?? '' }),
    columns: [
      ['project_number', 'Numer'],
      ['name', 'Nazwa'],
      ['client_name', 'Klient'],
      ['status', 'Status'],
      ['priority', 'Priorytet'],
      ['start_date', 'Start'],
      ['due_date', 'Termin'],
      ['description', 'Opis']
    ]
  },
  project_tasks: {
    filePrefix: 'fixer-zadania-projektow',
    loader: fetchAllProjectTasks,
    columns: [
      ['title', 'Tytuł'],
      ['description', 'Opis'],
      ['status', 'Status'],
      ['priority', 'Priorytet'],
      ['due_date', 'Termin'],
      ['reminder_at', 'Przypomnienie']
    ]
  }
};

function backupTimestamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
}

function checksum(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function readLocalStorageSettings() {
  const settings = {};
  SETTINGS_KEYS.forEach((key) => {
    try {
      const value = localStorage.getItem(key);
      if (value !== null) settings[key] = value;
    } catch {}
  });
  return settings;
}

function writeLocalStorageSettings(settings = {}) {
  Object.entries(settings).forEach(([key, value]) => {
    if (!SETTINGS_KEYS.includes(key)) return;
    try {
      if (value === null || value === undefined) localStorage.removeItem(key);
      else localStorage.setItem(key, String(value));
    } catch {}
  });
}

async function fetchTable(table) {
  if (!isSupabaseConfigured) return { rows: [], error: new Error('Supabase nie jest skonfigurowany.') };
  const { data, error } = await supabase.from(table).select('*');
  if (error) return { rows: [], error };
  return { rows: data ?? [], error: null };
}

function buildPayload(backup) {
  const { checksum: _checksum, ...payload } = backup;
  return payload;
}

export function getBackupFileName(date = new Date()) {
  return `fixer-backup-${backupTimestamp(date)}.json`;
}

export async function createBackupArchive() {
  const tables = {};
  const failures = [];

  for (const table of BACKUP_TABLES) {
    const result = await fetchTable(table);
    if (result.error) {
      failures.push(`${table}: ${result.error.message}`);
      continue;
    }
    tables[table] = result.rows;
  }

  if (failures.length) {
    console.error('Full backup failed', failures);
    throw new Error(FULL_BACKUP_ERROR);
  }

  const settings = readLocalStorageSettings();
  REQUIRED_SETTINGS_KEYS.forEach((key) => {
    if (!Object.prototype.hasOwnProperty.call(settings, key)) settings[key] = '{}';
  });

  const backup = {
    app: 'FIXER WEB',
    version: BACKUP_VERSION,
    created_at: new Date().toISOString(),
    tables,
    settings,
    meta: {
      tables: BACKUP_TABLES,
      warnings: [],
      type: 'full'
    }
  };
  backup.checksum = checksum(buildPayload(backup));
  return { backup, fileName: getBackupFileName(), warnings: [] };
}

function ensureArrayTable(tables, table) {
  if (!Object.prototype.hasOwnProperty.call(tables, table)) throw new Error(`Backup nie zawiera wymaganej tabeli: ${table}.`);
  if (!Array.isArray(tables[table])) throw new Error(`Tabela ${table} w backupie ma nieprawidłowy format.`);
}

function ensureReference(rows, field, allowedIds, message) {
  rows.forEach((row) => {
    const value = row?.[field];
    if (value && !allowedIds.has(String(value))) throw new Error(message);
  });
}

function validateBackupRelations(backup) {
  const tables = backup.tables ?? {};
  if (!Object.prototype.hasOwnProperty.call(tables, 'organizer_task_comments')) tables.organizer_task_comments = [];
  BACKUP_TABLES.forEach((table) => ensureArrayTable(tables, table));

  REQUIRED_SETTINGS_KEYS.forEach((key) => {
    if (!Object.prototype.hasOwnProperty.call(backup.settings ?? {}, key)) {
      throw new Error(`Backup nie zawiera wymaganych ustawień: ${key}.`);
    }
  });

  const clientIds = new Set(tables.clients.map((row) => String(row.id)).filter(Boolean));
  const equipmentIds = new Set(tables.equipment.map((row) => String(row.id)).filter(Boolean));
  const rentalIds = new Set(tables.rentals.map((row) => String(row.id)).filter(Boolean));
  const serviceOrderIds = new Set(tables.service_orders.map((row) => String(row.id)).filter(Boolean));
  const organizerTaskIds = new Set(tables.organizer_tasks.map((row) => String(row.id)).filter(Boolean));

  ensureReference(tables.rentals, 'client_id', clientIds, 'Backup zawiera wypożyczenie powiązane z nieistniejącym klientem.');
  ensureReference(tables.rental_items, 'rental_id', rentalIds, 'Backup zawiera pozycję wypożyczenia bez dokumentu źródłowego.');
  ensureReference(tables.rental_items, 'equipment_id', equipmentIds, 'Backup zawiera pozycję wypożyczenia powiązaną z nieistniejącym sprzętem.');
  ensureReference(tables.rental_items, 'parent_set_equipment_id', equipmentIds, 'Backup zawiera składnik zestawu powiązany z nieistniejącym zestawem.');
  ensureReference(tables.service_orders, 'client_id', clientIds, 'Backup zawiera zlecenie serwisowe powiązane z nieistniejącym klientem.');
  ensureReference(tables.service_orders, 'equipment_id', equipmentIds, 'Backup zawiera zlecenie serwisowe powiązane z nieistniejącym sprzętem.');
  ensureReference(tables.service_order_progress, 'service_order_id', serviceOrderIds, 'Backup zawiera wpis postępu bez zlecenia serwisowego.');
  ensureReference(tables.service_order_attachments, 'service_order_id', serviceOrderIds, 'Backup zawiera załącznik bez zlecenia serwisowego.');
  ensureReference(tables.organizer_task_comments, 'task_id', organizerTaskIds, 'Backup zawiera komentarz prostego zadania bez zadania źródłowego.');
}

export function validateBackupObject(backup) {
  if (!backup || typeof backup !== 'object') throw new Error('Plik backupu jest pusty albo ma nieprawidłowy format.');
  if (backup.app !== 'FIXER WEB') throw new Error('To nie jest backup FIXER WEB.');
  if (backup.version !== BACKUP_VERSION) throw new Error(`Nieobsługiwana wersja backupu: ${backup.version || 'brak'}.`);
  if (!backup.tables || typeof backup.tables !== 'object') throw new Error('Backup nie zawiera sekcji danych.');
  if (!backup.settings || typeof backup.settings !== 'object') throw new Error('Backup nie zawiera sekcji ustawień.');
  if (!backup.checksum) throw new Error('Backup nie zawiera sumy kontrolnej.');
  const expected = checksum(buildPayload(backup));
  if (expected !== backup.checksum) throw new Error('Backup jest uszkodzony albo został zmieniony poza programem.');
  validateBackupRelations(backup);
  return true;
}

export function parseBackupText(text) {
  let backup;
  try {
    backup = JSON.parse(text);
  } catch {
    throw new Error('Nie udało się odczytać pliku JSON.');
  }
  validateBackupObject(backup);
  return backup;
}

export async function restoreBackupArchive(backup) {
  validateBackupObject(backup);

  if (isSupabaseConfigured) {
    const { error } = await supabase.rpc('restore_fixer_backup', { p_tables: backup.tables });
    if (error) {
      console.error('Transactional backup restore failed', error);
      throw new Error('Nie udało się przywrócić backupu. Dane w bazie nie zostały zmienione.');
    }
  } else {
    throw new Error('Supabase nie jest skonfigurowany. Przywracanie pełnego backupu jest zablokowane.');
  }

  writeLocalStorageSettings(backup.settings);
  return { warnings: [] };
}

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  const escaped = text.replace(/"/g, '""');
  return /[";\n\r]/.test(escaped) ? `"${escaped}"` : escaped;
}

function buildCsv(columns, rows) {
  const header = columns.map(([, label]) => csvEscape(label)).join(';');
  const body = rows.map((row) => columns.map(([key]) => csvEscape(row[key])).join(';'));
  return `\ufeff${[header, ...body].join('\r\n')}`;
}

export async function createCsvExport(moduleKey) {
  const definition = CSV_DEFINITIONS[moduleKey];
  if (!definition) throw new Error('Nieznany typ eksportu CSV.');
  const { data, error } = await definition.loader();
  if (error) throw new Error('Nie udało się pobrać danych do eksportu CSV.');
  const rows = (data ?? []).map((row) => definition.mapRow ? definition.mapRow(row) : row);
  return {
    fileName: `${definition.filePrefix}-${backupTimestamp()}.csv`,
    content: buildCsv(definition.columns, rows)
  };
}

export const BACKUP_INCLUDED_TABLES = BACKUP_TABLES;
export const BACKUP_FULL_ERROR_MESSAGE = FULL_BACKUP_ERROR;
