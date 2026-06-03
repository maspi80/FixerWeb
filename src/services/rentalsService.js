import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

export const RENTAL_STATUSES = ['active', 'partially_returned', 'returned'];
export const RENTAL_ITEM_STATUSES = ['issued', 'returned', 'damaged', 'lost', 'service_required'];

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
  created_at,
  updated_at,
  clients(id, name, phone, email),
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
  return error;
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
    total_price: normalizeMoneyValue(rental.total_price, 'total_price')
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

  const { data, error } = await supabase
    .from('rentals')
    .select(rentalSelectColumns)
    .order('created_at', { ascending: false });

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

  const { data: createdRental, error: rentalError } = await supabase
    .from('rentals')
    .insert(rentalPayload)
    .select(rentalSelectColumns)
    .single();
  if (rentalError) return { data: null, error: rentalError };

  itemRows = itemRows.map((item) => ({ ...item, rental_id: createdRental.id }));
  if (itemRows.length) {
    const { error: itemsError } = await supabase.from('rental_items').insert(itemRows);
    if (itemsError) return { data: createdRental, error: itemsError };

    const { error: equipmentError } = await markEquipmentIssued(itemRows.map((item) => item.equipment_id));
    if (equipmentError) return { data: createdRental, error: equipmentError };
  }

  return fetchRentalRecord(createdRental.id);
}

export async function fetchRentalRecord(id) {
  if (!isSupabaseConfigured) {
    return { data: null, error: new Error('Supabase nie jest skonfigurowany') };
  }

  const { data, error } = await supabase
    .from('rentals')
    .select(rentalSelectColumns)
    .eq('id', id)
    .single();

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
