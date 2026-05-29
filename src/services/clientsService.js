import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

export async function fetchClients() {
  if (!isSupabaseConfigured) {
    return { data: [], error: new Error('Supabase nie jest skonfigurowany') };
  }

  const { data, error } = await supabase
    .from('clients')
    .select('id, name, type, phone, email, rating, notes, created_at, updated_at')
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
    .select()
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
    .select()
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
