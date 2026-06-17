/**
 * Verifies app_settings read priority rules (standalone, no imports).
 */

const APP_SETTING_KEYS = {
  companyProfile: 'company_profile',
  documentSettings: 'document_settings',
  rentalNumbering: 'rental_numbering',
  documentTemplates: 'document_templates',
  documentDesigner: 'document_designer'
};

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

function isAuthoritativeSettingValue(settingKey, value) {
  if (value === null || value === undefined) return false;
  if (settingKey === APP_SETTING_KEYS.companyProfile) return hasMeaningfulCompanyProfile(value);
  if (settingKey === APP_SETTING_KEYS.rentalNumbering) return Boolean(String(value?.prefix ?? '').trim());
  if (settingKey === APP_SETTING_KEYS.documentDesigner) return Array.isArray(value?.templates) && value.templates.length > 0;
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

function simulateResolve({ remote, local, settingKey }) {
  if (isAuthoritativeSettingValue(settingKey, remote)) {
    return { value: remote, source: 'supabase' };
  }
  if (isAuthoritativeSettingValue(settingKey, local)) {
    return { value: local, source: 'migrated-local' };
  }
  return { value: undefined, source: null };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const keys = Object.values(APP_SETTING_KEYS);

const companyRemote = { name: 'Supabase Firma', nip: '123' };
const companyLocal = { name: 'Local Firma', nip: '999' };

assert(simulateResolve({ remote: companyRemote, local: companyLocal, settingKey: APP_SETTING_KEYS.companyProfile }).source === 'supabase', 'company_profile: Supabase > localStorage');
assert(simulateResolve({ remote: {}, local: companyLocal, settingKey: APP_SETTING_KEYS.companyProfile }).source === 'migrated-local', 'company_profile: migration when Supabase empty');
assert(simulateResolve({ remote: null, local: companyLocal, settingKey: APP_SETTING_KEYS.companyProfile }).source === 'migrated-local', 'company_profile: migration when Supabase missing');

const numberingRemote = { prefix: 'WYP' };
const numberingLocal = { prefix: 'LOC' };
assert(simulateResolve({ remote: numberingRemote, local: numberingLocal, settingKey: APP_SETTING_KEYS.rentalNumbering }).source === 'supabase', 'rental_numbering: Supabase > localStorage');

const docSettingsRemote = { numbering: { service: { prefix: 'SRV' } } };
const docSettingsLocal = { numbering: { service: { prefix: 'OLD' } } };
assert(simulateResolve({ remote: docSettingsRemote, local: docSettingsLocal, settingKey: APP_SETTING_KEYS.documentSettings }).source === 'supabase', 'document_settings: Supabase > localStorage');

const templatesRemote = { rentalAgreement: { title: 'Z Supabase' } };
const templatesLocal = { rentalAgreement: { title: 'Z localStorage' } };
assert(simulateResolve({ remote: templatesRemote, local: templatesLocal, settingKey: APP_SETTING_KEYS.documentTemplates }).source === 'supabase', 'document_templates: Supabase > localStorage');

const designerRemote = { templates: [{ id: 't1' }] };
const designerLocal = { templates: [{ id: 't2' }] };
assert(simulateResolve({ remote: designerRemote, local: designerLocal, settingKey: APP_SETTING_KEYS.documentDesigner }).source === 'supabase', 'document_designer: Supabase > localStorage');
assert(simulateResolve({ remote: designerRemote, local: designerLocal, settingKey: APP_SETTING_KEYS.documentDesigner }).value.templates[0].id === 't1', 'document_designer: value from Supabase on repeat load');

console.log('OK — priority checks passed:', keys.join(', '));
