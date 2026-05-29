import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

export async function fetchEquipment() {
  if (!isSupabaseConfigured) {
    return { data: [], error: new Error('Supabase nie jest skonfigurowany') };
  }

  const { data, error } = await supabase
    .from('equipment')
    .select('id, name, category, brand, model, serial, inventory_number, barcode, status, location, purchase_date, notes, description, condition, purchase_value, deposit, price_day, price_week, gallery, attachments, set_items, service_notes, history_notes, created_at, updated_at')
    .order('created_at', { ascending: false });

  return { data: data ?? [], error };
}

export async function createEquipmentRecord(equipment) {
  if (!isSupabaseConfigured) {
    return { data: null, error: new Error('Supabase nie jest skonfigurowany') };
  }

  const { data, error } = await supabase
    .from('equipment')
    .insert(equipment)
    .select()
    .single();

  return { data, error };
}

export async function updateEquipmentRecord(id, equipment) {
  if (!isSupabaseConfigured) {
    return { data: null, error: new Error('Supabase nie jest skonfigurowany') };
  }

  const { data, error } = await supabase
    .from('equipment')
    .update({ ...equipment, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  return { data, error };
}

export async function deleteEquipmentRecord(id) {
  if (!isSupabaseConfigured) {
    return { error: new Error('Supabase nie jest skonfigurowany') };
  }

  const { error } = await supabase
    .from('equipment')
    .delete()
    .eq('id', id);

  return { error };
}
