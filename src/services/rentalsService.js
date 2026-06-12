import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

export const RENTAL_STATUSES = ['active', 'partially_returned', 'returned'];
export const RENTAL_ITEM_STATUSES = ['issued', 'returned', 'damaged', 'lost', 'service_required'];
export const RENTAL_VAT_RATES = ['zw', '0', '5', '8', '23'];

const rentalSelectColumns = `
  id,
  rental_number,
  client_id,
  status,
  start_date,
  planned_return_date,
  actual_return_date,
  notes,
  total_deposit,
  total_price,
  vat_rate,
  created_at,
  updated_at,
  clients(id, name, type, client_kind, phone, email, street, building_number, apartment_number, postal_code, city, country, nip, regon),
  rental_items(
    id,
    rental_id,
    equipment_id,
    parent_set_equipment_id,
    item_type,
    name_snapshot,
    serial_snapshot,
    inventory_number_snapshot,
    barcode_snapshot,
    status,
    planned_return_date,
    returned_at,
    price_day,
    price_week,
    deposit,
    condition_out,
    condition_in,
    damage_notes,
    settlement_notes,
    created_at,
    updated_at
  )
`;

const rentalSelectColumnsLegacy = rentalSelectColumns.replace(/\n\s*vat_rate,\n/, '\n');

function isMissingVatRateColumnError(error) {
  const message = String(error?.message ?? '').toLocaleLowerCase('pl');
  return message.includes('vat_rate') && message.includes('does not exist');
}

function withDefaultRentalVatRate(rows = []) {
  return rows.map((row) => ({ ...row, vat_rate: row?.vat_rate ?? '23' }));
}

async function queryRentals(selectColumns, options = {}) {
  let query = supabase.from('rentals').select(selectColumns);
  if (options.id) query = query.eq('id', options.id);
  if (options.orderByCreatedAt) query = query.order('created_at', { ascending: false });
  if (options.single) query = query.single();
  return query;
}

async function fetchRentalsDataset(options = {}) {
  let result = await queryRentals(rentalSelectColumns, options);
  if (result.error && isMissingVatRateColumnError(result.error)) {
    result = await queryRentals(rentalSelectColumnsLegacy, options);
    if (!result.error && result.data) {
      result.data = Array.isArray(result.data)
        ? withDefaultRentalVatRate(result.data)
        : withDefaultRentalVatRate([result.data])[0];
    }
  }
  return result;
}

function generateRentalNumber() {
  const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  return `WYP/${stamp}`;
}

function uniqueIds(ids) {
  return [...new Set(ids.filter(Boolean))];
}

function normalizeMoneyValue(value, fieldName) {
  if (value === '' || value === null || value === undefined) return null;
  if (typeof value === 'number') {
    if (Number.isFinite(value)) return value;
    throw new Error(`Nieprawidłowa kwota w polu ${fieldName}.`);
  }

  const normalized = String(value).trim().replace(/\s/g, '').replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) {
    throw new Error(`Nieprawidłowa kwota w polu ${fieldName}: "${value}". Wpisz samą liczbę, np. 120,50.`);
  }

  const number = Number(normalized);
  if (!Number.isFinite(number)) throw new Error(`Nieprawidłowa kwota w polu ${fieldName}.`);
  return number;
}

function getRentalRpcError(error) {
  const message = String(error?.message ?? '');
  const code = String(error?.code ?? '');
  if (code === '42883' || code === 'PGRST202' || message.toLocaleLowerCase('pl').includes('update_rental_with_items')) {
    return new Error('Nie znaleziono funkcji RPC update_rental_with_items w Supabase. Uruchom migrację supabase/006_atomic_rental_update.sql i spróbuj ponownie.');
  }
  if (message.toLocaleLowerCase('pl').includes('create_rental_with_items')) {
    return new Error('Nie znaleziono funkcji RPC create_rental_with_items w Supabase. Uruchom migrację supabase/012_production_safety_rpc.sql i spróbuj ponownie.');
  }
  if (isMissingVatRateColumnError(error)) {
    return new Error('Brak kolumny rentals.vat_rate w Supabase. Uruchom migrację supabase/019_rentals_vat_rate.sql i spróbuj ponownie.');
  }
  if (String(error?.code ?? '') === '23505') return new Error('Dokument o takim numerze już istnieje. Zmień numer wypożyczenia i spróbuj ponownie.');
  if (String(error?.code ?? '') === '23503') return new Error('Nie można zapisać wypożyczenia, bo wybrany klient lub sprzęt nie istnieje w bazie.');
  return error;
}

function normalizeVatRate(value) {
  const normalized = String(value ?? '23').trim().toLocaleLowerCase('pl').replace('.', '');
  if (normalized === 'zw' || normalized === 'zwolnione') return 'zw';
  if (RENTAL_VAT_RATES.includes(normalized)) return normalized;
  return '23';
}

function normalizeRentalPayload(rental) {
  return {
    rental_number: String(rental.rental_number ?? '').trim() || generateRentalNumber(),
    client_id: rental.client_id,
    status: RENTAL_STATUSES.includes(rental.status) ? rental.status : 'active',
    start_date: rental.start_date || new Date().toISOString().slice(0, 10),
    planned_return_date: rental.planned_return_date || null,
    actual_return_date: rental.actual_return_date || null,
    notes: rental.notes ?? '',
    total_deposit: normalizeMoneyValue(rental.total_deposit, 'total_deposit'),
    total_price: normalizeMoneyValue(rental.total_price, 'total_price'),
    vat_rate: normalizeVatRate(rental.vat_rate)
  };
}

function normalizeRentalItemPayload(item, rentalId) {
  return {
    rental_id: rentalId,
    equipment_id: item.equipment_id || null,
    parent_set_equipment_id: item.parent_set_equipment_id || null,
    item_type: ['single', 'set', 'set_component'].includes(item.item_type) ? item.item_type : 'single',
    name_snapshot: item.name_snapshot || item.name || 'Sprzęt',
    serial_snapshot: item.serial_snapshot ?? item.serial ?? '',
    inventory_number_snapshot: item.inventory_number_snapshot ?? item.inventory_number ?? '',
    barcode_snapshot: item.barcode_snapshot ?? item.barcode ?? '',
    status: RENTAL_ITEM_STATUSES.includes(item.status) ? item.status : 'issued',
    planned_return_date: item.planned_return_date || null,
    returned_at: item.returned_at || null,
    price_day: normalizeMoneyValue(item.price_day, 'price_day'),
    price_week: normalizeMoneyValue(item.price_week, 'price_week'),
    deposit: normalizeMoneyValue(item.deposit, 'deposit'),
    condition_out: item.condition_out ?? '',
    condition_in: item.condition_in ?? '',
    damage_notes: item.damage_notes ?? '',
    settlement_notes: item.settlement_notes ?? ''
  };
}

async function markEquipmentIssued(equipmentIds) {
  const ids = uniqueIds(equipmentIds);
  if (!ids.length) return { error: null };
  const { error } = await supabase
    .from('equipment')
    .update({ status: 'Wypożyczony', updated_at: new Date().toISOString() })
    .in('id', ids);
  return { error };
}

async function releaseEquipmentIfUnused(equipmentIds) {
  const ids = uniqueIds(equipmentIds);
  if (!ids.length) return { error: null };

  const { data, error } = await supabase
    .from('rental_items')
    .select('equipment_id')
    .in('equipment_id', ids)
    .eq('status', 'issued');
  if (error) return { error };

  const stillIssued = new Set((data ?? []).map((item) => item.equipment_id).filter(Boolean));
  const idsToRelease = ids.filter((id) => !stillIssued.has(id));
  if (!idsToRelease.length) return { error: null };

  const { error: updateError } = await supabase
    .from('equipment')
    .update({ status: 'Dostępny', updated_at: new Date().toISOString() })
    .in('id', idsToRelease);
  return { error: updateError };
}

export async function fetchRentals() {
  if (!isSupabaseConfigured) {
    return { data: [], error: new Error('Supabase nie jest skonfigurowany') };
  }

  const { data, error } = await fetchRentalsDataset({ orderByCreatedAt: true });

  return { data: data ?? [], error };
}

export async function createRentalRecord(rental, items = []) {
  if (!isSupabaseConfigured) {
    return { data: null, error: new Error('Supabase nie jest skonfigurowany') };
  }

  let rentalPayload;
  let itemRows;
  try {
    rentalPayload = normalizeRentalPayload(rental);
    itemRows = items.map((item) => normalizeRentalItemPayload(item, null));
  } catch (error) {
    return { data: null, error };
  }

  const { data: createdRentalId, error: rpcError } = await supabase.rpc('create_rental_with_items', {
    p_rental: rentalPayload,
    p_items: itemRows
  });
  if (rpcError) return { data: null, error: getRentalRpcError(rpcError) };

  return fetchRentalRecord(createdRentalId);
}

export async function fetchRentalRecord(id) {
  if (!isSupabaseConfigured) {
    return { data: null, error: new Error('Supabase nie jest skonfigurowany') };
  }

  const { data, error } = await fetchRentalsDataset({ id, single: true });

  return { data, error };
}

export async function updateRentalRecord(id, rental, items = []) {
  if (!isSupabaseConfigured) {
    return { data: null, error: new Error('Supabase nie jest skonfigurowany') };
  }

  let rentalPayload;
  let itemRows;
  try {
    rentalPayload = normalizeRentalPayload(rental);
    itemRows = items.map((item) => normalizeRentalItemPayload(item, id));
  } catch (error) {
    return { data: null, error };
  }

  const { error: rpcError } = await supabase.rpc('update_rental_with_items', {
    p_rental_id: id,
    p_rental: rentalPayload,
    p_items: itemRows
  });
  if (rpcError) return { data: null, error: getRentalRpcError(rpcError) };

  return fetchRentalRecord(id);
}

export async function registerRentalReturn(id, returnedItemIds = [], closeRental = false) {
  if (!isSupabaseConfigured) {
    return { data: null, error: new Error('Supabase nie jest skonfigurowany') };
  }

  const selectedIds = uniqueIds(returnedItemIds);
  const { data: items, error: itemsError } = await supabase
    .from('rental_items')
    .select('id, equipment_id, parent_set_equipment_id, item_type, status')
    .eq('rental_id', id);
  if (itemsError) return { data: null, error: itemsError };

  const selectedBaseEquipmentIds = new Set((items ?? [])
    .filter((item) => selectedIds.includes(item.id))
    .map((item) => item.equipment_id)
    .filter(Boolean));

  const targetItems = (items ?? []).filter((item) => {
    if (item.status !== 'issued') return false;
    if (selectedIds.includes(item.id)) return true;
    return item.parent_set_equipment_id && selectedBaseEquipmentIds.has(item.parent_set_equipment_id);
  });

  const targetItemIds = targetItems.map((item) => item.id);
  const remainingIssued = (items ?? []).filter((item) => item.status === 'issued' && !targetItemIds.includes(item.id));
  const fullyReturned = remainingIssued.length === 0;

  if (!targetItems.length && (!closeRental || !fullyReturned)) {
    return { data: null, error: new Error('Wybrane pozycje są już oznaczone jako zwrócone.') };
  }

  const now = new Date().toISOString();
  if (targetItemIds.length) {
    const { error: returnItemsError } = await supabase
      .from('rental_items')
      .update({ status: 'returned', returned_at: now, updated_at: now })
      .in('id', targetItemIds);
    if (returnItemsError) return { data: null, error: returnItemsError };
  }

  const closed = closeRental && fullyReturned;
  const rentalStatus = closed ? 'returned' : 'partially_returned';
  const rentalUpdate = {
    status: rentalStatus,
    updated_at: now,
    ...(closed ? { actual_return_date: now.slice(0, 10) } : {})
  };

  const { error: rentalError } = await supabase
    .from('rentals')
    .update(rentalUpdate)
    .eq('id', id);
  if (rentalError) return { data: null, error: rentalError };

  if (targetItems.length) {
    const { error: releaseError } = await releaseEquipmentIfUnused(targetItems.map((item) => item.equipment_id));
    if (releaseError) return { data: null, error: releaseError };
  }

  const record = await fetchRentalRecord(id);
  return {
    data: record.data ? { ...record.data, _return_closed: closed, _return_fully_returned: fullyReturned } : null,
    error: record.error
  };
}

export async function restoreRentalAsActive(id) {
  if (!isSupabaseConfigured) {
    return { data: null, error: new Error('Supabase nie jest skonfigurowany') };
  }

  const { error } = await supabase
    .from('rentals')
    .update({ status: 'active', actual_return_date: null, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return { data: null, error };

  return fetchRentalRecord(id);
}

export async function deleteRentalRecord(id) {
  if (!isSupabaseConfigured) {
    return { error: new Error('Supabase nie jest skonfigurowany') };
  }

  const { data: items, error: itemsError } = await supabase
    .from('rental_items')
    .select('equipment_id')
    .eq('rental_id', id);
  if (itemsError) return { error: itemsError };

  const equipmentIds = (items ?? []).map((item) => item.equipment_id);
  const { error } = await supabase
    .from('rentals')
    .delete()
    .eq('id', id);
  if (error) return { error };

  return releaseEquipmentIfUnused(equipmentIds);
}
