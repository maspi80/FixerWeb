import React, { useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCcw, Save, ShieldCheck, Trash2, UserCheck } from 'lucide-react';
import {
  AppButton,
  AppInput,
  AppNotice,
  AppSelect,
  FormField,
  ModalFrame,
  StatusPill
} from '../design-system';
import {
  buildEmptyPermissionMap,
  buildPermissionKey,
  createAdminUser,
  deleteAdminUser,
  listAdminUsers,
  permissionsToMap,
  saveAdminUserPermissions,
  updateAdminUserPassword,
  updateAdminUser,
  USER_PERMISSION_ACTIONS,
  USER_PERMISSION_MODULES
} from '../services/adminUsersService';

const ROLE_LABELS = {
  admin: 'Administrator',
  user: 'Użytkownik'
};

const DEFAULT_USER_COLOR = '#2563EB';
const HEX_COLOR_PATTERN = /^#([0-9a-f]{6})$/i;

function normalizeUserColor(value) {
  const raw = String(value ?? '').trim();
  return HEX_COLOR_PATTERN.test(raw) ? raw.toUpperCase() : DEFAULT_USER_COLOR;
}

function normalizeUserForm(profile = {}) {
  return {
    fullName: profile.full_name ?? '',
    username: profile.username ?? '',
    email: profile.email ?? '',
    role: profile.role === 'admin' ? 'admin' : 'user',
    userColor: normalizeUserColor(profile.user_color),
    isActive: profile.is_active !== false
  };
}

function getDisplayName(profile) {
  return profile.full_name?.trim() || profile.username?.trim() || profile.email?.split('@')[0] || 'Użytkownik';
}

function isValidUserEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? '').trim());
}

function normalizeUsernameInput(value) {
  return String(value ?? '').trim().toLowerCase();
}

function isValidUsername(value) {
  return /^[a-z0-9._-]{3,40}$/.test(normalizeUsernameInput(value));
}

export default function UsersPermissionsPanel({ currentUser = null }) {
  const [profiles, setProfiles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [userForm, setUserForm] = useState(normalizeUserForm());
  const [permissionMap, setPermissionMap] = useState(buildEmptyPermissionMap);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ fullName: '', username: '', email: '', password: '', role: 'user' });
  const [passwordForm, setPasswordForm] = useState({ password: '', repeatPassword: '' });
  const [passwordNotice, setPasswordNotice] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const selectedProfile = profiles.find((profile) => profile.id === selectedUserId) ?? profiles[0] ?? null;
  const selectedPermissions = useMemo(
    () => permissions.filter((permission) => permission.user_id === selectedProfile?.id),
    [permissions, selectedProfile?.id]
  );
  const selectedIsAdmin = userForm.role === 'admin';
  const isSelectedCurrentUser = selectedProfile?.id && currentUser?.id && selectedProfile.id === currentUser.id;

  const loadUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await listAdminUsers();
      setProfiles(result.profiles);
      setPermissions(result.permissions);
      const nextSelected = selectedUserId && result.profiles.some((profile) => profile.id === selectedUserId)
        ? selectedUserId
        : result.profiles[0]?.id ?? '';
      setSelectedUserId(nextSelected);
    } catch (loadError) {
      setError(loadError.message || 'Nie udało się pobrać użytkowników.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    if (!selectedProfile) {
      setUserForm(normalizeUserForm());
      setPermissionMap(buildEmptyPermissionMap());
      return;
    }
    setUserForm(normalizeUserForm(selectedProfile));
    setPermissionMap(permissionsToMap(selectedPermissions));
    setPasswordForm({ password: '', repeatPassword: '' });
    setPasswordNotice('');
  }, [selectedProfile?.id, selectedProfile?.user_color, selectedProfile?.username, selectedProfile?.email, selectedProfile?.full_name, selectedProfile?.role, selectedProfile?.is_active, selectedPermissions]);

  const selectProfile = (profileId) => {
    setSelectedUserId(profileId);
    setNotice('');
    setError('');
  };

  const updateCreateForm = (key, value) => {
    setCreateForm((current) => ({ ...current, [key]: value }));
  };

  const updatePasswordForm = (key, value) => {
    setPasswordForm((current) => ({ ...current, [key]: value }));
    setPasswordNotice('');
  };

  const submitCreateUser = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const username = normalizeUsernameInput(createForm.username);
      if (!username || !isValidUsername(username)) throw new Error('Login musi mieć 3-40 znaków i może zawierać litery, cyfry, kropkę, myślnik lub podkreślenie.');
      if (profiles.some((profile) => normalizeUsernameInput(profile.username) === username)) throw new Error('Ten login jest już używany.');
      const result = await createAdminUser({
        fullName: createForm.fullName,
        username,
        email: createForm.email,
        password: createForm.password,
        role: createForm.role
      });
      setCreateModalOpen(false);
      setCreateForm({ fullName: '', username: '', email: '', password: '', role: 'user' });
      await loadUsers();
      if (result.profile?.id) setSelectedUserId(result.profile.id);
      setNotice('Użytkownik został utworzony.');
    } catch (createError) {
      setError(createError.message || 'Nie udało się utworzyć użytkownika.');
    } finally {
      setSaving(false);
    }
  };

  const saveSelectedUser = async () => {
    if (!selectedProfile) return;
    const nextUsername = normalizeUsernameInput(userForm.username);
    if (!nextUsername || !isValidUsername(nextUsername)) {
      setError('Login musi mieć 3-40 znaków i może zawierać litery, cyfry, kropkę, myślnik lub podkreślenie.');
      return;
    }
    const usernameOwner = profiles.find((profile) => profile.id !== selectedProfile.id && normalizeUsernameInput(profile.username) === nextUsername);
    if (usernameOwner) {
      setError('Ten login jest już używany.');
      return;
    }
    const nextEmail = userForm.email.trim().toLowerCase();
    if (!nextEmail || !isValidUserEmail(nextEmail)) {
      setError('Podaj poprawny adres email użytkownika.');
      return;
    }
    const emailOwner = profiles.find((profile) => profile.id !== selectedProfile.id && String(profile.email ?? '').trim().toLowerCase() === nextEmail);
    if (emailOwner) {
      setError('Ten email jest już przypisany do innego użytkownika.');
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await updateAdminUser({
        userId: selectedProfile.id,
        fullName: userForm.fullName,
        username: nextUsername,
        email: nextEmail,
        role: userForm.role,
        userColor: userForm.userColor,
        isActive: userForm.isActive
      });
      if (userForm.role !== 'admin') {
        const rows = Object.entries(permissionMap).map(([permission_key, allowed]) => ({ permission_key, allowed }));
        await saveAdminUserPermissions(selectedProfile.id, rows);
      }
      await loadUsers();
      setSelectedUserId(selectedProfile.id);
      setNotice('Dane użytkownika zostały zapisane.');
    } catch (saveError) {
      setError(saveError.message || 'Nie udało się zapisać użytkownika.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteSelectedUser = async () => {
    if (!selectedProfile) return;
    if (isSelectedCurrentUser) {
      setError('Nie można usunąć własnego konta z aktywnej sesji.');
      setDeleteModalOpen(false);
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await deleteAdminUser(selectedProfile.id);
      setDeleteModalOpen(false);
      await loadUsers();
      setNotice('Użytkownik został usunięty.');
    } catch (deleteError) {
      setError(deleteError.message || 'Nie udało się usunąć użytkownika.');
    } finally {
      setSaving(false);
    }
  };

  const togglePermission = (permissionKey) => {
    setPermissionMap((current) => ({ ...current, [permissionKey]: !current[permissionKey] }));
  };

  const submitPasswordChange = async (event) => {
    event.preventDefault();
    if (!selectedProfile) return;
    const password = passwordForm.password;
    if (!password || !passwordForm.repeatPassword) {
      setPasswordNotice('Podaj i powtórz nowe hasło.');
      return;
    }
    if (password !== passwordForm.repeatPassword) {
      setPasswordNotice('Hasła muszą być identyczne.');
      return;
    }
    if (password.length < 6) {
      setPasswordNotice('Hasło musi mieć co najmniej 6 znaków.');
      return;
    }
    setSaving(true);
    setPasswordNotice('');
    setError('');
    try {
      await updateAdminUserPassword(selectedProfile.id, password);
      setPasswordForm({ password: '', repeatPassword: '' });
      setPasswordNotice('Hasło zostało zmienione.');
    } catch (passwordError) {
      setPasswordNotice(passwordError.message || 'Nie udało się zmienić hasła.');
    } finally {
      setSaving(false);
    }
  };

  return <div className="users-permissions-panel">
    <section className="settings-config-card users-admin-card">
      <div className="settings-config-card-header">
        <div>
          <p className="eyebrow">Administracja</p>
          <h3>Użytkownicy i uprawnienia</h3>
          <p className="muted">Prosty panel zarządzania kontami i przyszłymi permissions.</p>
        </div>
        <div className="settings-action-row">
          <AppButton variant="secondary" size="sm" onClick={loadUsers} disabled={loading || saving}><RefreshCcw size={14} />Odśwież</AppButton>
          <AppButton variant="primary" size="sm" onClick={() => setCreateModalOpen(true)} disabled={saving}><Plus size={14} />Dodaj użytkownika</AppButton>
          <AppButton variant="danger" size="sm" onClick={() => setDeleteModalOpen(true)} disabled={saving || !selectedProfile || isSelectedCurrentUser}><Trash2 size={14} />Usuń użytkownika</AppButton>
        </div>
      </div>

      {loading && <div className="notice settings-inline-notice">Ładowanie użytkowników…</div>}
      {notice && <AppNotice variant="info">{notice}</AppNotice>}
      {error && <AppNotice variant="warning">{error}</AppNotice>}

      <div className="users-admin-layout">
        <div className="users-admin-list" role="list">
          {profiles.map((profile) => {
            const active = selectedProfile?.id === profile.id;
            return <button key={profile.id} type="button" className={`users-admin-row ${active ? 'active' : ''}`} onClick={() => selectProfile(profile.id)}>
              <span>
                <strong>{getDisplayName(profile)}</strong>
                <small>{profile.username ? `${profile.username} · ${profile.email}` : profile.email}</small>
              </span>
              <span className="users-admin-row-meta">
                <StatusPill value={ROLE_LABELS[profile.role] ?? 'Użytkownik'} tone={profile.role === 'admin' ? 'info' : 'neutral'} />
                <StatusPill value={profile.is_active === false ? 'Nieaktywny' : 'Aktywny'} tone={profile.is_active === false ? 'danger' : 'success'} />
              </span>
            </button>;
          })}
          {!profiles.length && !loading && <div className="settings-sidebar-empty">Brak użytkowników do wyświetlenia.</div>}
        </div>

        {selectedProfile && <div className="users-admin-detail">
          <section className="settings-form-section">
            <div className="settings-section-title">
              <h4>Dane użytkownika</h4>
              <p className="muted">Email jest synchronizowany z kontem Supabase Auth.</p>
            </div>
            <div className="users-profile-form-grid">
              <FormField label="Imię / nazwa">
                <AppInput value={userForm.fullName} onChange={(event) => setUserForm((current) => ({ ...current, fullName: event.target.value }))} />
              </FormField>
              <FormField label="Login">
                <AppInput value={userForm.username} onChange={(event) => setUserForm((current) => ({ ...current, username: event.target.value }))} placeholder="np. maspixtest" />
              </FormField>
              <FormField label="Email">
                <AppInput type="email" value={userForm.email} onChange={(event) => setUserForm((current) => ({ ...current, email: event.target.value }))} />
              </FormField>
              <FormField label="Rola">
                <AppSelect value={userForm.role} onChange={(event) => setUserForm((current) => ({ ...current, role: event.target.value }))}>
                  <option value="admin">Administrator</option>
                  <option value="user">Użytkownik</option>
                </AppSelect>
              </FormField>
              <FormField label="Kolor użytkownika">
                <AppInput className="users-color-input" type="color" value={userForm.userColor} onChange={(event) => setUserForm((current) => ({ ...current, userColor: normalizeUserColor(event.target.value) }))} />
              </FormField>
              <label className="users-active-toggle">
                <input type="checkbox" checked={userForm.isActive} onChange={(event) => setUserForm((current) => ({ ...current, isActive: event.target.checked }))} />
                <span>{userForm.isActive ? 'Aktywny' : 'Nieaktywny'}</span>
              </label>
            </div>
          </section>

          <section className="settings-form-section users-password-section">
            <div className="settings-section-title">
              <h4>Zmień hasło</h4>
              <p className="muted">Hasło jest zmieniane przez bezpieczną funkcję administracyjną.</p>
            </div>
            <form className="users-password-form" onSubmit={submitPasswordChange}>
              <FormField label="Nowe hasło">
                <AppInput type="password" value={passwordForm.password} onChange={(event) => updatePasswordForm('password', event.target.value)} minLength={6} autoComplete="new-password" />
              </FormField>
              <FormField label="Powtórz hasło">
                <AppInput type="password" value={passwordForm.repeatPassword} onChange={(event) => updatePasswordForm('repeatPassword', event.target.value)} minLength={6} autoComplete="new-password" />
              </FormField>
              <AppButton variant="secondary" size="sm" type="submit" disabled={saving}>Zmień hasło</AppButton>
            </form>
            {passwordNotice && <AppNotice variant={passwordNotice === 'Hasło zostało zmienione.' ? 'info' : 'warning'}>{passwordNotice}</AppNotice>}
          </section>

          <section className="settings-form-section">
            <div className="settings-section-title">
              <h4>Uprawnienia modułów</h4>
              <p className="muted">{selectedIsAdmin ? 'Administrator ma pełny dostęp bez ręcznego zaznaczania checkboxów.' : 'Zaznaczenia są zapisywane w tabeli user_permissions.'}</p>
            </div>
            <div className="permissions-grid">
              <div className="permissions-grid-header">
                <span>Moduł</span>
                {USER_PERMISSION_ACTIONS.map((action) => <span key={action.id}>{action.label}</span>)}
              </div>
              {USER_PERMISSION_MODULES.map((module) => <div className="permissions-grid-row" key={module.id}>
                <strong>{module.label}</strong>
                {USER_PERMISSION_ACTIONS.map((action) => {
                  const key = buildPermissionKey(module.id, action.id);
                  return <label key={key} className="permissions-check" title={key}>
                    <input
                      type="checkbox"
                      checked={selectedIsAdmin || Boolean(permissionMap[key])}
                      disabled={selectedIsAdmin}
                      onChange={() => togglePermission(key)}
                    />
                  </label>;
                })}
              </div>)}
            </div>
          </section>

          <div className="settings-action-row users-admin-save-row">
            <AppButton variant="secondary" size="sm" onClick={() => {
              setUserForm(normalizeUserForm(selectedProfile));
              setPermissionMap(permissionsToMap(selectedPermissions));
              setNotice('');
              setError('');
            }} disabled={saving}>Cofnij zmiany</AppButton>
            <AppButton variant="primary" size="sm" onClick={saveSelectedUser} disabled={saving}><Save size={14} />Zapisz użytkownika</AppButton>
          </div>
        </div>}
      </div>
    </section>

    {createModalOpen && <ModalFrame
      title="Dodaj użytkownika"
      description="Konto zostanie utworzone przez bezpieczną funkcję serwerową Supabase."
      onClose={() => setCreateModalOpen(false)}
      footer={<>
        <AppButton variant="secondary" size="sm" onClick={() => setCreateModalOpen(false)} disabled={saving}>Anuluj</AppButton>
        <AppButton variant="primary" size="sm" type="submit" form="create-user-form" disabled={saving}><UserCheck size={14} />Utwórz</AppButton>
      </>}
    >
      <form id="create-user-form" className="users-create-form" onSubmit={submitCreateUser}>
        <FormField label="Imię / nazwa">
          <AppInput value={createForm.fullName} onChange={(event) => updateCreateForm('fullName', event.target.value)} placeholder="np. Jan" />
        </FormField>
        <FormField label="Login" required>
          <AppInput value={createForm.username} onChange={(event) => updateCreateForm('username', event.target.value)} placeholder="np. maspixtest" required />
        </FormField>
        <FormField label="Email" required>
          <AppInput type="email" value={createForm.email} onChange={(event) => updateCreateForm('email', event.target.value)} placeholder="jan@example.com" required />
        </FormField>
        <FormField label="Hasło tymczasowe" required>
          <AppInput type="password" value={createForm.password} onChange={(event) => updateCreateForm('password', event.target.value)} minLength={6} required />
        </FormField>
        <FormField label="Rola">
          <AppSelect value={createForm.role} onChange={(event) => updateCreateForm('role', event.target.value)}>
            <option value="user">Użytkownik</option>
            <option value="admin">Administrator</option>
          </AppSelect>
        </FormField>
        <AppNotice variant="info"><ShieldCheck size={14} />Hasło nie jest zapisywane w tabelach FIXERA.</AppNotice>
      </form>
    </ModalFrame>}
    {deleteModalOpen && selectedProfile && <ModalFrame
      title="Usuń użytkownika"
      onClose={() => setDeleteModalOpen(false)}
      footer={<>
        <AppButton variant="secondary" size="sm" onClick={() => setDeleteModalOpen(false)} disabled={saving}>Anuluj</AppButton>
        <AppButton variant="danger" size="sm" onClick={confirmDeleteSelectedUser} disabled={saving}>Usuń</AppButton>
      </>}
    >
      <p className="confirm-dialog-message">Czy na pewno chcesz usunąć tego użytkownika?</p>
      {isSelectedCurrentUser && <AppNotice variant="warning">Nie można usunąć własnego konta z aktywnej sesji.</AppNotice>}
    </ModalFrame>}
  </div>;
}
