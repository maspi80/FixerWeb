import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

export const clientSelectColumns = [
  'id',
  'name',
  'type',
  'client_kind',
  'phone',
  'email',
  'street',
  'building_number',
  'apartment_number',
  'postal_code',
  'city',
  'country',
  'nip',
  'regon',
  'notes',
  'created_at',
  'updated_at'
].join(', ');

export async function fetchClients() {
  if (!isSupabaseConfigured) {
    return { data: [], error: new Error('Supabase nie jest skonfigurowany') };
  }

  const { data, error } = await supabase
    .from('clients')
    .select(clientSelectColumns)
    .order('created_at', { ascending: false });

  return { data: data ?? [], error };
}

export async function createClientRecord(client) {
  if (!isSupabaseConfigured) {
    return { data: null, error: new Error('Supabase nie jest skonfigurowany') };
  }

  const { data, error } = await supabase
    .from('clients')
    .insert(client)
    .select(clientSelectColumns)
    .single();

  return { data, error };
}

export async function updateClientRecord(id, client) {
  if (!isSupabaseConfigured) {
    return { data: null, error: new Error('Supabase nie jest skonfigurowany') };
  }

  const { data, error } = await supabase
    .from('clients')
    .update({ ...client, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(clientSelectColumns)
    .single();

  return { data, error };
}

export async function deleteClientRecord(id) {
  if (!isSupabaseConfigured) {
    return { error: new Error('Supabase nie jest skonfigurowany') };
  }

  const { error } = await supabase
    .from('clients')
    .delete()
    .eq('id', id);

  return { error };
}
