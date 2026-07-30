import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

export const USER_PERMISSION_MODULES = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'clients', label: 'Klienci' },
  { id: 'equipment', label: 'Magazyn' },
  { id: 'rentals', label: 'Wypożyczenia' },
  { id: 'service', label: 'Serwis' },
  { id: 'projects', label: 'Zadania i projekty' },
  { id: 'notes', label: 'Notatki' },
  { id: 'calendar', label: 'Kalendarz' },
  { id: 'settings', label: 'Ustawienia' }
];

export const USER_PERMISSION_ACTIONS = [
  { id: 'view', label: 'Podgląd' },
  { id: 'create', label: 'Dodawanie' },
  { id: 'edit', label: 'Edycja' },
  { id: 'delete', label: 'Usuwanie' }
];

export function buildPermissionKey(moduleId, actionId) {
  return `${moduleId}.${actionId}`;
}

export function buildEmptyPermissionMap() {
  return Object.fromEntries(
    USER_PERMISSION_MODULES.flatMap((module) =>
      USER_PERMISSION_ACTIONS.map((action) => [buildPermissionKey(module.id, action.id), false])
    )
  );
}

export function permissionsToMap(permissions = []) {
  const next = buildEmptyPermissionMap();
  permissions.forEach((permission) => {
    const key = String(permission.permission_key ?? '').trim();
    if (Object.prototype.hasOwnProperty.call(next, key)) next[key] = Boolean(permission.allowed);
  });
  return next;
}

function ensureConfigured() {
  if (!isSupabaseConfigured) throw new Error('Supabase nie jest skonfigurowany.');
}

async function invokeAdminUsers(action, payload = {}) {
  ensureConfigured();
  const { data, error } = await supabase.functions.invoke('admin-users', {
    body: { action, ...payload }
  });
  if (error) throw new Error(error.message || 'Operacja administracyjna nie powiodła się.');
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function listAdminUsers() {
  const data = await invokeAdminUsers('listUsers');
  return {
    profiles: data.profiles ?? [],
    permissions: data.permissions ?? []
  };
}

export async function createAdminUser(payload) {
  return invokeAdminUsers('createUser', payload);
}

export async function updateAdminUser(payload) {
  return invokeAdminUsers('updateUser', payload);
}

export async function deleteAdminUser(userId) {
  return invokeAdminUsers('deleteUser', { userId });
}

export async function saveAdminUserPermissions(userId, permissions) {
  return invokeAdminUsers('savePermissions', { userId, permissions });
}

export async function updateAdminUserPassword(userId, password) {
  return invokeAdminUsers('updatePassword', { userId, password });
}
