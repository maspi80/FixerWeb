import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

const DEFAULT_PROFILE_ROLE = 'user';

function normalizeEmail(value) {
  return String(value ?? '').trim();
}

function getProfileFallback(user) {
  if (!user?.id) return null;
  return {
    id: user.id,
    email: normalizeEmail(user.email),
    full_name: '',
    role: DEFAULT_PROFILE_ROLE,
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

export function createPermissionChecker(permissions = []) {
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
    .select('id, email, full_name, role, is_active, created_at, updated_at')
    .eq('id', user.id)
    .maybeSingle();

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
      is_active: profile.is_active
    })
    .select('id, email, full_name, role, is_active, created_at, updated_at')
    .single();

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
    hasPermission: createPermissionChecker(permissions),
    errors: [profileResult.error, permissionsResult.error].filter(Boolean),
    fallback: Boolean(profileResult.fallback || permissionsResult.fallback)
  };
}
