import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

const tablePreferencesColumns = 'id, user_id, table_key, visible_columns, column_order, column_widths, created_at, updated_at';

function localKey(tableKey) {
  return `fixer-table-preferences-${tableKey}`;
}

export function getLocalTablePreference(tableKey, fallback) {
  try {
    const saved = localStorage.getItem(localKey(tableKey));
    return saved ? { ...fallback, ...JSON.parse(saved) } : fallback;
  } catch {
    return fallback;
  }
}

export function saveLocalTablePreference(tableKey, preference) {
  localStorage.setItem(localKey(tableKey), JSON.stringify(preference));
}

export async function fetchTablePreference(tableKey, fallback) {
  const localPreference = getLocalTablePreference(tableKey, fallback);
  if (!isSupabaseConfigured) return { data: localPreference, error: null };

  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (!userId) return { data: localPreference, error: null };

  const { data, error } = await supabase
    .from('user_table_preferences')
    .select(tablePreferencesColumns)
    .eq('user_id', userId)
    .eq('table_key', tableKey)
    .maybeSingle();

  if (error) return { data: localPreference, error };
  if (!data) return { data: localPreference, error: null };

  const localSortKey = localPreference.sortKey ?? fallback.sortKey ?? null;
  const localSortDir = localPreference.sortDir ?? fallback.sortDir ?? 'asc';
  const preference = {
    visibleColumns: Array.isArray(data.visible_columns) ? data.visible_columns : fallback.visibleColumns,
    columnOrder: Array.isArray(data.column_order) ? data.column_order : fallback.columnOrder,
    columnWidths: data.column_widths && typeof data.column_widths === 'object' ? data.column_widths : fallback.columnWidths,
    sortKey: localSortKey,
    sortDir: localSortDir
  };

  saveLocalTablePreference(tableKey, preference);
  return { data: preference, error: null };
}

export async function saveTablePreference(tableKey, preference) {
  saveLocalTablePreference(tableKey, preference);
  if (!isSupabaseConfigured) return { error: null };

  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (!userId) return { error: null };

  const { error } = await supabase
    .from('user_table_preferences')
    .upsert({
      user_id: userId,
      table_key: tableKey,
      visible_columns: preference.visibleColumns,
      column_order: preference.columnOrder,
      column_widths: preference.columnWidths,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id,table_key' });

  return { error };
}
