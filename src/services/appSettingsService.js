import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

export const APP_SETTING_KEYS = {
  companyProfile: 'company_profile',
  documentSettings: 'document_settings',
  rentalNumbering: 'rental_numbering',
  documentTemplates: 'document_templates',
  documentDesigner: 'document_designer'
};

const LOCAL_STORAGE_KEYS = {
  [APP_SETTING_KEYS.companyProfile]: 'fixer-company-profile',
  [APP_SETTING_KEYS.documentSettings]: 'fixer-document-settings',
  [APP_SETTING_KEYS.rentalNumbering]: 'fixer-rental-numbering',
  [APP_SETTING_KEYS.documentTemplates]: 'fixer:document-templates',
  [APP_SETTING_KEYS.documentDesigner]: 'fixer:document-designer'
};

const cache = {};
let hydrated = false;
let hydratePromise = null;
const listeners = new Set();

function readLocal(settingKey) {
  const storageKey = LOCAL_STORAGE_KEYS[settingKey];
  if (!storageKey) return null;
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeLocal(settingKey, value) {
  const storageKey = LOCAL_STORAGE_KEYS[settingKey];
  if (!storageKey) return;
  localStorage.setItem(storageKey, JSON.stringify(value));
}

function notifyListeners() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (error) {
      console.error('App settings listener failed', error);
    }
  });
}

function bootstrapCacheFromLocalStorage() {
  Object.keys(LOCAL_STORAGE_KEYS).forEach((settingKey) => {
    if (cache[settingKey] !== undefined) return;
    const localValue = readLocal(settingKey);
    if (localValue !== null && localValue !== undefined) {
      cache[settingKey] = localValue;
    }
  });
}

bootstrapCacheFromLocalStorage();

export function subscribeAppSettings(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function isAppSettingsHydrated() {
  return hydrated || !isSupabaseConfigured;
}

export function getAppSetting(settingKey) {
  if (cache[settingKey] !== undefined) return cache[settingKey];
  const localValue = readLocal(settingKey);
  if (localValue !== null && localValue !== undefined) {
    cache[settingKey] = localValue;
    return localValue;
  }
  return undefined;
}

export function setAppSettingCache(settingKey, value) {
  cache[settingKey] = value;
  writeLocal(settingKey, value);
  notifyListeners();
}

async function fetchRemoteSetting(settingKey) {
  const { data, error } = await supabase
    .from('app_settings')
    .select('setting_value')
    .eq('setting_key', settingKey)
    .maybeSingle();
  if (error) throw error;
  return data?.setting_value ?? null;
}

async function upsertRemoteSetting(settingKey, value) {
  const { error } = await supabase
    .from('app_settings')
    .upsert({
      setting_key: settingKey,
      setting_value: value,
      updated_at: new Date().toISOString()
    }, { onConflict: 'setting_key' });
  if (error) throw error;
}

function hasMeaningfulLocalValue(settingKey, value) {
  if (value === null || value === undefined) return false;
  if (settingKey === APP_SETTING_KEYS.companyProfile) {
    const profile = value ?? {};
    return Boolean(
      String(profile.name ?? '').trim()
      || String(profile.legalName ?? '').trim()
      || String(profile.nip ?? '').trim()
      || String(profile.email ?? '').trim()
      || String(profile.phone ?? '').trim()
      || String(profile.logoDataUrl ?? '').trim()
    );
  }
  if (typeof value === 'object') {
    if (Array.isArray(value)) return value.length > 0;
    return Object.keys(value).length > 0;
  }
  return true;
}

async function resolveSettingValue(settingKey) {
  const localValue = readLocal(settingKey);
  if (!isSupabaseConfigured) {
    if (localValue !== null && localValue !== undefined) return localValue;
    return undefined;
  }

  let remoteValue = null;
  try {
    remoteValue = await fetchRemoteSetting(settingKey);
  } catch (error) {
    console.error(`Failed to fetch app setting "${settingKey}"`, error);
    if (localValue !== null && localValue !== undefined) return localValue;
    throw error;
  }

  if (remoteValue !== null && remoteValue !== undefined) {
    return remoteValue;
  }

  if (hasMeaningfulLocalValue(settingKey, localValue)) {
    try {
      await upsertRemoteSetting(settingKey, localValue);
    } catch (error) {
      console.warn(`Failed to migrate local app setting "${settingKey}" to Supabase`, error);
    }
    return localValue;
  }

  return undefined;
}

export async function hydrateAppSettings({ force = false } = {}) {
  if (hydrated && !force) return;
  if (hydratePromise && !force) return hydratePromise;

  hydratePromise = (async () => {
    const keys = Object.values(APP_SETTING_KEYS);
    if (!isSupabaseConfigured) {
      keys.forEach((settingKey) => {
        const localValue = readLocal(settingKey);
        if (localValue !== null && localValue !== undefined) {
          cache[settingKey] = localValue;
        }
      });
      hydrated = true;
      notifyListeners();
      return;
    }

    await Promise.all(keys.map(async (settingKey) => {
      const resolved = await resolveSettingValue(settingKey);
      if (resolved !== undefined) {
        cache[settingKey] = resolved;
        writeLocal(settingKey, resolved);
      }
    }));

    hydrated = true;
    notifyListeners();
  })().finally(() => {
    hydratePromise = null;
  });

  return hydratePromise;
}

export async function persistAppSetting(settingKey, value) {
  setAppSettingCache(settingKey, value);
  if (!isSupabaseConfigured) return value;
  await upsertRemoteSetting(settingKey, value);
  return value;
}
