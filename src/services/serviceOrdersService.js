import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { DEFAULT_SERVICE_PRIORITIES, DEFAULT_SERVICE_STATUSES } from './serviceDictionariesService';

export const SERVICE_STATUSES = DEFAULT_SERVICE_STATUSES;
export const SERVICE_PRIORITIES = DEFAULT_SERVICE_PRIORITIES;
export const SERVICE_ESTIMATE_STATUSES = ['Roboczy', 'Zaakceptowany', 'Odrzucony'];

const LOCAL_SERVICE_ORDERS_KEY = 'fixer-service-orders-fallback';
const LOCAL_SERVICE_PROGRESS_KEY = 'fixer-service-progress-fallback';

const serviceSelectColumns = `
  id,
  service_number,
  claim_type,
  status,
  priority,
  client_id,
  equipment_id,
  accepted_date,
  planned_date,
  completed_date,
  customer_device_name,
  customer_device_brand,
  customer_device_model,
  customer_device_serial,
  customer_device_code,
  customer_device_category,
  intake_condition,
  intake_accessories,
  intake_visual_notes,
  fault_description,
  diagnosis,
  work_performed,
  parts_materials,
  external_service,
  external_rma_number,
  external_sent_date,
  external_return_date,
  external_cost,
  external_notes,
  labor_cost,
  parts_cost,
  other_cost,
  total_cost,
  estimate_items,
  estimate_status,
  internal_notes,
  attachments,
  notes,
  created_at,
  updated_at,
  clients(id, name, phone, email),
  equipment(id, name, serial, inventory_number, barcode, status)
`;

const progressSelectColumns = `
  id,
  service_order_id,
  entry_text,
  operator_name,
  created_at,
  updated_at
`;

function readLocal(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocal(key, rows) {
  localStorage.setItem(key, JSON.stringify(rows));
  return rows;
}

function normalizeMoney(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(String(value).replace(',', '.'));
  return Number.isFinite(number) ? number : null;
}

function normalizeText(value) {
  return String(value ?? '').trim();
}

function normalizeAttachments(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => ({
    name: String(item?.name ?? '').trim(),
    url: String(item?.url ?? '').trim(),
    type: String(item?.type ?? '').trim()
  })).filter((item) => item.name || item.url);
}

function normalizeEstimateItems(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const amount = normalizeMoney(item?.amount);
    return {
      name: normalizeText(item?.name),
      amount: amount ?? 0
    };
  }).filter((item) => item.name || item.amount);
}

function normalizeServiceError(error) {
  if (!error) return error;
  const code = String(error.code ?? '');
  const message = String(error.message ?? '');
  if (code === 'PGRST205' && message.includes('service_orders')) {
    return new Error('Brak tabeli public.service_orders w Supabase. Uruchom migrację supabase/005_service_orders_schema.sql w Supabase SQL Editor i odśwież schemat.');
  }
  if (code === 'PGRST205' && message.includes('service_order_progress')) {
    return new Error('Brak tabeli public.service_order_progress w Supabase. Uruchom migrację supabase/005_service_orders_schema.sql w Supabase SQL Editor i odśwież schemat.');
  }
  return error;
}

function normalizeServicePayload(order) {
  const laborCost = normalizeMoney(order.labor_cost);
  const partsCost = normalizeMoney(order.parts_cost);
  const otherCost = normalizeMoney(order.other_cost);
  const externalCost = normalizeMoney(order.external_cost);
  const estimateItems = normalizeEstimateItems(order.estimate_items);
  const estimateItemsTotal = estimateItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  return {
    service_number: String(order.service_number ?? '').trim(),
    claim_type: ['Gwarancyjna', 'Pogwarancyjna'].includes(order.claim_type) ? order.claim_type : 'Pogwarancyjna',
    status: String(order.status ?? '').trim() || 'Przyjęte',
    priority: String(order.priority ?? '').trim() || 'Normalny',
    client_id: order.client_id || null,
    equipment_id: order.equipment_id || null,
    accepted_date: order.accepted_date || new Date().toISOString().slice(0, 10),
    planned_date: order.planned_date || null,
    completed_date: order.completed_date || null,
    customer_device_name: order.customer_device_name ?? '',
    customer_device_brand: order.customer_device_brand ?? '',
    customer_device_model: order.customer_device_model ?? '',
    customer_device_serial: order.customer_device_serial ?? '',
    customer_device_code: order.customer_device_code ?? '',
    customer_device_category: order.customer_device_category ?? '',
    intake_condition: order.intake_condition ?? '',
    intake_accessories: order.intake_accessories ?? '',
    intake_visual_notes: order.intake_visual_notes ?? '',
    fault_description: order.fault_description ?? '',
    diagnosis: order.diagnosis ?? '',
    work_performed: order.work_performed ?? '',
    parts_materials: order.parts_materials ?? '',
    external_service: normalizeText(order.external_service),
    external_rma_number: normalizeText(order.external_rma_number),
    external_sent_date: order.external_sent_date || null,
    external_return_date: order.external_return_date || null,
    external_cost: externalCost,
    external_notes: order.external_notes ?? '',
    labor_cost: laborCost,
    parts_cost: partsCost,
    other_cost: otherCost,
    total_cost: estimateItems.length ? estimateItemsTotal : (normalizeMoney(order.total_cost) ?? (laborCost ?? 0) + (partsCost ?? 0) + (otherCost ?? 0)),
    estimate_items: estimateItems,
    estimate_status: SERVICE_ESTIMATE_STATUSES.includes(order.estimate_status) ? order.estimate_status : 'Roboczy',
    internal_notes: order.internal_notes ?? order.notes ?? '',
    attachments: normalizeAttachments(order.attachments),
    notes: order.notes ?? ''
  };
}

function isFinishedStatus(status) {
  return ['Wydane', 'Anulowane'].includes(String(status ?? '').trim());
}

function buildServiceEvents(previous, next, isNew = false) {
  if (isNew) return ['Utworzono zgłoszenie serwisowe'];
  if (!previous || !next) return [];
  const events = [];
  if (previous.status !== next.status) {
    events.push(`Zmieniono status z: ${previous.status || 'brak'} → ${next.status || 'brak'}`);
  }
  if (previous.external_service !== next.external_service && next.external_service) {
    events.push(`Przekazano do serwisu: ${next.external_service}`);
  }
  if (previous.external_sent_date !== next.external_sent_date && next.external_sent_date) {
    events.push('Oznaczono wysłanie do serwisu zewnętrznego');
  }
  if (previous.external_return_date !== next.external_return_date && next.external_return_date) {
    events.push('Sprzęt wrócił z serwisu zewnętrznego');
  }
  if (!isFinishedStatus(previous.status) && isFinishedStatus(next.status)) {
    events.push('Zgłoszenie zakończone');
  }
  return events;
}

async function appendLocalProgressEntries(serviceOrderId, entries, operatorName = 'System') {
  if (!entries.length) return { error: null, local: true };
  const now = new Date().toISOString();
  const rows = entries.map((entryText) => ({
    id: crypto.randomUUID(),
    localId: crypto.randomUUID(),
    service_order_id: serviceOrderId,
    entry_text: entryText,
    operator_name: operatorName,
    created_at: now,
    updated_at: now
  }));
  writeLocal(LOCAL_SERVICE_PROGRESS_KEY, [...rows, ...readLocal(LOCAL_SERVICE_PROGRESS_KEY)]);
  return { error: null, local: true };
}

async function appendServiceProgressEntries(serviceOrderId, entries, operatorName = 'System', local = false) {
  const cleanEntries = entries.map((entry) => normalizeText(entry)).filter(Boolean);
  if (!serviceOrderId || !cleanEntries.length) return { error: null, local };
  if (!isSupabaseConfigured || local) return appendLocalProgressEntries(serviceOrderId, cleanEntries, operatorName);

  const rows = cleanEntries.map((entry_text) => ({ service_order_id: serviceOrderId, entry_text, operator_name: operatorName }));
  const { error } = await supabase.from('service_order_progress').insert(rows);
  return { error: normalizeServiceError(error), local: false };
}

async function markEquipmentServiceStatus(equipmentId, status) {
  if (!isSupabaseConfigured || !equipmentId) return { error: null };
  const targetStatus = ['Wydane', 'Anulowane'].includes(status) ? 'Dostępny' : 'Serwis';
  const { error } = await supabase
    .from('equipment')
    .update({ status: targetStatus, updated_at: new Date().toISOString() })
    .eq('id', equipmentId);
  return { error };
}

export async function fetchServiceOrders() {
  if (!isSupabaseConfigured) {
    return { data: readLocal(LOCAL_SERVICE_ORDERS_KEY), error: null, local: true };
  }

  const { data, error } = await supabase
    .from('service_orders')
    .select(serviceSelectColumns)
    .order('created_at', { ascending: false });

  return { data: data ?? [], error: normalizeServiceError(error), local: false };
}

export async function createServiceOrderRecord(order) {
  const payload = normalizeServicePayload(order);
  if (!isSupabaseConfigured) {
    const now = new Date().toISOString();
    const created = { ...payload, id: crypto.randomUUID(), localId: crypto.randomUUID(), created_at: now, updated_at: now };
    writeLocal(LOCAL_SERVICE_ORDERS_KEY, [created, ...readLocal(LOCAL_SERVICE_ORDERS_KEY)]);
    await appendServiceProgressEntries(created.id ?? created.localId, buildServiceEvents(null, created, true), 'System', true);
    return { data: created, error: null, local: true };
  }

  const { data, error } = await supabase
    .from('service_orders')
    .insert(payload)
    .select(serviceSelectColumns)
    .single();

  if (!error) {
    const progressResult = await appendServiceProgressEntries(data.id, buildServiceEvents(null, data, true));
    if (progressResult.error) return { data, error: progressResult.error, local: false };
    await markEquipmentServiceStatus(payload.equipment_id, payload.status);
  }
  return { data, error: normalizeServiceError(error), local: false };
}

export async function updateServiceOrderRecord(id, order) {
  const payload = normalizeServicePayload(order);
  if (!isSupabaseConfigured || order.localId) {
    const now = new Date().toISOString();
    const previous = readLocal(LOCAL_SERVICE_ORDERS_KEY).find((row) => String(row.id ?? row.localId) === String(id)) ?? null;
    const next = readLocal(LOCAL_SERVICE_ORDERS_KEY).map((row) => String(row.id ?? row.localId) === String(id) ? { ...row, ...payload, updated_at: now } : row);
    writeLocal(LOCAL_SERVICE_ORDERS_KEY, next);
    const updated = next.find((row) => String(row.id ?? row.localId) === String(id)) ?? null;
    await appendServiceProgressEntries(id, buildServiceEvents(previous, updated), 'System', true);
    return { data: updated, error: null, local: true };
  }

  const { data: previous } = await supabase
    .from('service_orders')
    .select(serviceSelectColumns)
    .eq('id', id)
    .maybeSingle();

  const { data, error } = await supabase
    .from('service_orders')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(serviceSelectColumns)
    .single();

  if (!error) {
    const progressResult = await appendServiceProgressEntries(id, buildServiceEvents(previous, data));
    if (progressResult.error) return { data, error: progressResult.error, local: false };
    await markEquipmentServiceStatus(payload.equipment_id, payload.status);
  }
  return { data, error: normalizeServiceError(error), local: false };
}

export async function deleteServiceOrderRecord(id, order = null) {
  if (!isSupabaseConfigured || order?.localId) {
    writeLocal(LOCAL_SERVICE_PROGRESS_KEY, readLocal(LOCAL_SERVICE_PROGRESS_KEY).filter((row) => String(row.service_order_id) !== String(id)));
    writeLocal(LOCAL_SERVICE_ORDERS_KEY, readLocal(LOCAL_SERVICE_ORDERS_KEY).filter((row) => String(row.id ?? row.localId) !== String(id)));
    return { error: null, local: true };
  }

  const { error } = await supabase.from('service_orders').delete().eq('id', id);
  return { error: normalizeServiceError(error), local: false };
}

export async function fetchServiceOrderProgress(serviceOrderId) {
  if (!serviceOrderId) return { data: [], error: null, local: !isSupabaseConfigured };
  if (!isSupabaseConfigured) {
    return { data: readLocal(LOCAL_SERVICE_PROGRESS_KEY).filter((row) => String(row.service_order_id) === String(serviceOrderId)), error: null, local: true };
  }

  const { data, error } = await supabase
    .from('service_order_progress')
    .select(progressSelectColumns)
    .eq('service_order_id', serviceOrderId)
    .order('created_at', { ascending: false });

  return { data: data ?? [], error: normalizeServiceError(error), local: false };
}

export async function createServiceOrderProgress(serviceOrderId, entryText, operatorName = 'Operator') {
  const text = String(entryText ?? '').trim();
  if (!text) return { data: null, error: null, local: !isSupabaseConfigured };
  if (!isSupabaseConfigured) {
    const now = new Date().toISOString();
    const created = { id: crypto.randomUUID(), localId: crypto.randomUUID(), service_order_id: serviceOrderId, entry_text: text, operator_name: operatorName, created_at: now, updated_at: now };
    writeLocal(LOCAL_SERVICE_PROGRESS_KEY, [created, ...readLocal(LOCAL_SERVICE_PROGRESS_KEY)]);
    return { data: created, error: null, local: true };
  }

  const { data, error } = await supabase
    .from('service_order_progress')
    .insert({ service_order_id: serviceOrderId, entry_text: text, operator_name: operatorName })
    .select(progressSelectColumns)
    .single();

  return { data, error: normalizeServiceError(error), local: false };
}

export async function updateServiceOrderProgress(id, entryText, row = null) {
  const text = String(entryText ?? '').trim();
  if (!isSupabaseConfigured || row?.localId) {
    const now = new Date().toISOString();
    const next = readLocal(LOCAL_SERVICE_PROGRESS_KEY).map((item) => String(item.id ?? item.localId) === String(id) ? { ...item, entry_text: text, updated_at: now } : item);
    writeLocal(LOCAL_SERVICE_PROGRESS_KEY, next);
    return { data: next.find((item) => String(item.id ?? item.localId) === String(id)) ?? null, error: null, local: true };
  }

  const { data, error } = await supabase
    .from('service_order_progress')
    .update({ entry_text: text, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(progressSelectColumns)
    .single();

  return { data, error: normalizeServiceError(error), local: false };
}

export async function deleteServiceOrderProgress(id, row = null) {
  if (!isSupabaseConfigured || row?.localId) {
    writeLocal(LOCAL_SERVICE_PROGRESS_KEY, readLocal(LOCAL_SERVICE_PROGRESS_KEY).filter((item) => String(item.id ?? item.localId) !== String(id)));
    return { error: null, local: true };
  }

  const { error } = await supabase.from('service_order_progress').delete().eq('id', id);
  return { error: normalizeServiceError(error), local: false };
}
