import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

const DEFAULT_PROFILE_ROLE = 'user';
const DEFAULT_USER_COLOR = '#2563EB';

function normalizeEmail(value) {
  return String(value ?? '').trim();
}

function isMissingOptionalProfileColumnError(error) {
  const text = `${error?.code ?? ''} ${error?.message ?? ''} ${error?.details ?? ''}`.toLowerCase();
  return (text.includes('user_color') || text.includes('username')) && (text.includes('column') || text.includes('schema cache') || text.includes('pgrst204'));
}

function getProfileFallback(user) {
  if (!user?.id) return null;
  return {
    id: user.id,
    email: normalizeEmail(user.email),
    username: null,
    full_name: '',
    role: DEFAULT_PROFILE_ROLE,
    user_color: DEFAULT_USER_COLOR,
    is_active: true,
    created_at: null,
    updated_at: null
  };
}

function normalizePermission(row) {
  return {
    id: row.id,
    user_id: row.user_id,
    permission_key: String(row.permission_key ?? '').trim(),
    allowed: Boolean(row.allowed),
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null
  };
}

export function createPermissionChecker(permissions = [], profile = null) {
  if (profile?.role === 'admin' && profile?.is_active !== false) return () => true;

  const permissionMap = new Map(
    permissions
      .filter((permission) => permission.permission_key)
      .map((permission) => [permission.permission_key, Boolean(permission.allowed)])
  );

  return (permissionKey) => permissionMap.get(permissionKey) === true;
}

export async function fetchUserProfile(user) {
  if (!isSupabaseConfigured || !user?.id) return { data: getProfileFallback(user), error: null, fallback: true };

  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, username, full_name, role, user_color, is_active, created_at, updated_at')
    .eq('id', user.id)
    .maybeSingle();

  if (error && isMissingOptionalProfileColumnError(error)) {
    const fallbackProfileResult = await supabase
      .from('profiles')
      .select('id, email, full_name, role, is_active, created_at, updated_at')
      .eq('id', user.id)
      .maybeSingle();
    if (fallbackProfileResult.error) return { data: getProfileFallback(user), error: fallbackProfileResult.error, fallback: true };
    if (fallbackProfileResult.data) return { data: { ...fallbackProfileResult.data, username: null, user_color: DEFAULT_USER_COLOR }, error: null, fallback: false };
  }

  if (error) return { data: getProfileFallback(user), error, fallback: true };
  if (data) return { data, error: null, fallback: false };

  const profile = getProfileFallback(user);
  const { data: created, error: insertError } = await supabase
    .from('profiles')
    .insert({
      id: profile.id,
      email: profile.email,
      full_name: profile.full_name,
      role: profile.role,
      user_color: profile.user_color,
      is_active: profile.is_active
    })
    .select('id, email, username, full_name, role, user_color, is_active, created_at, updated_at')
    .single();

  if (insertError && isMissingOptionalProfileColumnError(insertError)) {
    const { data: createdWithoutColor, error: insertWithoutColorError } = await supabase
      .from('profiles')
      .insert({
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
        role: profile.role,
        is_active: profile.is_active
      })
      .select('id, email, full_name, role, is_active, created_at, updated_at')
      .single();
    if (insertWithoutColorError) return { data: profile, error: insertWithoutColorError, fallback: true };
    return { data: { ...(createdWithoutColor ?? profile), user_color: DEFAULT_USER_COLOR }, error: null, fallback: false };
  }

  if (insertError) return { data: profile, error: insertError, fallback: true };
  return { data: created ?? profile, error: null, fallback: false };
}

export async function fetchUserPermissions(userId) {
  if (!isSupabaseConfigured || !userId) return { data: [], error: null, fallback: true };

  const { data, error } = await supabase
    .from('user_permissions')
    .select('id, user_id, permission_key, allowed, created_at, updated_at')
    .eq('user_id', userId)
    .order('permission_key', { ascending: true });

  if (error) return { data: [], error, fallback: true };
  return { data: (data ?? []).map(normalizePermission), error: null, fallback: false };
}

export async function loadUserAccess(user) {
  const profileResult = await fetchUserProfile(user);
  const permissionsResult = await fetchUserPermissions(user?.id);
  const permissions = permissionsResult.data ?? [];

  return {
    profile: profileResult.data,
    permissions,
    hasPermission: createPermissionChecker(permissions, profileResult.data),
    errors: [profileResult.error, permissionsResult.error].filter(Boolean),
    fallback: Boolean(profileResult.fallback || permissionsResult.fallback)
  };
}
