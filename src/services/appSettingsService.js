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
const hydrationSources = {};
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

function clearLocal(settingKey) {
  const storageKey = LOCAL_STORAGE_KEYS[settingKey];
  if (!storageKey) return;
  localStorage.removeItem(storageKey);
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

function hasMeaningfulCompanyProfile(value) {
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

/** Returns true when a stored value should be treated as authoritative (non-empty). */
export function isAuthoritativeSettingValue(settingKey, value) {
  if (value === null || value === undefined) return false;

  if (settingKey === APP_SETTING_KEYS.companyProfile) {
    return hasMeaningfulCompanyProfile(value);
  }

  if (settingKey === APP_SETTING_KEYS.rentalNumbering) {
    return Boolean(String(value?.prefix ?? '').trim());
  }

  if (settingKey === APP_SETTING_KEYS.documentDesigner) {
    return Array.isArray(value?.templates) && value.templates.length > 0;
  }

  if (settingKey === APP_SETTING_KEYS.documentSettings) {
    return Boolean(
      (value?.numbering && Object.keys(value.numbering).length > 0)
      || (value?.documentTemplates && Object.keys(value.documentTemplates).length > 0)
      || (value?.templates && Object.keys(value.templates).length > 0)
    );
  }

  if (settingKey === APP_SETTING_KEYS.documentTemplates) {
    return typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length > 0;
  }

  if (typeof value === 'object') {
    if (Array.isArray(value)) return value.length > 0;
    return Object.keys(value).length > 0;
  }

  return true;
}

function bootstrapCacheFromLocalStorage() {
  // When Supabase is configured, never preload cache from localStorage.
  // Remote hydration must run first so local cannot override Supabase.
  if (isSupabaseConfigured) return;

  Object.keys(LOCAL_STORAGE_KEYS).forEach((settingKey) => {
    if (cache[settingKey] !== undefined) return;
    const localValue = readLocal(settingKey);
    if (isAuthoritativeSettingValue(settingKey, localValue)) {
      cache[settingKey] = localValue;
      hydrationSources[settingKey] = 'local';
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

export function getAppSettingHydrationSource(settingKey) {
  return hydrationSources[settingKey] ?? null;
}

export function getAppSetting(settingKey) {
  if (cache[settingKey] !== undefined) return cache[settingKey];

  // With Supabase configured, app settings are remote-only.
  // Never read localStorage as a data source, regardless of hydration state.
  if (isSupabaseConfigured) return undefined;

  const localValue = readLocal(settingKey);
  if (isAuthoritativeSettingValue(settingKey, localValue)) {
    cache[settingKey] = localValue;
    hydrationSources[settingKey] = hydrationSources[settingKey] ?? 'local';
    return localValue;
  }

  return undefined;
}

export function setAppSettingCache(settingKey, value) {
  cache[settingKey] = value;
  writeLocal(settingKey, value);
  hydrationSources[settingKey] = isSupabaseConfigured ? 'cache' : 'local';
  notifyListeners();
}

async function fetchRemoteSetting(settingKey) {
  const { data, error } = await supabase
    .from('app_settings')
    .select('setting_value, updated_at')
    .eq('setting_key', settingKey)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { value: null, updatedAt: null };
  return { value: data.setting_value ?? null, updatedAt: data.updated_at ?? null };
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

async function resolveSettingValue(settingKey) {
  const localValue = readLocal(settingKey);

  if (!isSupabaseConfigured) {
    if (isAuthoritativeSettingValue(settingKey, localValue)) {
      return { value: localValue, source: 'local' };
    }
    return { value: undefined, source: null };
  }

  let remoteValue = null;
  try {
    const remote = await fetchRemoteSetting(settingKey);
    remoteValue = remote.value;
  } catch (error) {
    console.error(`Failed to fetch app setting "${settingKey}"`, error);
    throw error;
  }

  // Priority 1: Supabase when it contains authoritative data.
  if (isAuthoritativeSettingValue(settingKey, remoteValue)) {
    return { value: remoteValue, source: 'supabase' };
  }

  // When Supabase does not contain a saved value, caller uses in-code defaults.
  // This prevents stale localStorage from diverging between environments/devices.
  return { value: undefined, source: null };
}

export async function hydrateAppSettings({ force = false } = {}) {
  if (hydrated && !force) return;
  if (hydratePromise && !force) return hydratePromise;

  hydratePromise = (async () => {
    const keys = Object.values(APP_SETTING_KEYS);

    if (!isSupabaseConfigured) {
      keys.forEach((settingKey) => {
        const localValue = readLocal(settingKey);
        if (isAuthoritativeSettingValue(settingKey, localValue)) {
          cache[settingKey] = localValue;
          hydrationSources[settingKey] = 'local';
        }
      });
      hydrated = true;
      notifyListeners();
      return;
    }

    // Clear pre-hydration cache so local bootstrap cannot win over Supabase.
    keys.forEach((settingKey) => {
      delete cache[settingKey];
      delete hydrationSources[settingKey];
    });

    await Promise.all(keys.map(async (settingKey) => {
      try {
        const resolved = await resolveSettingValue(settingKey);
        if (resolved.value !== undefined) {
          cache[settingKey] = resolved.value;
          hydrationSources[settingKey] = resolved.source;
          // Mirror remote value to local cache storage only.
          writeLocal(settingKey, resolved.value);
        } else {
          clearLocal(settingKey);
        }
      } catch (error) {
        console.warn(`Skipped hydrating app setting "${settingKey}"`, error);
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
  if (!isAuthoritativeSettingValue(settingKey, value)
    && settingKey === APP_SETTING_KEYS.companyProfile) {
    throw new Error('EMPTY_COMPANY_PROFILE');
  }

  setAppSettingCache(settingKey, value);
  if (!isSupabaseConfigured) return value;

  await upsertRemoteSetting(settingKey, value);
  hydrationSources[settingKey] = 'supabase';
  return value;
}
