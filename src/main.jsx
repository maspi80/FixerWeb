import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Bell, CalendarDays, CheckCircle2, ChevronRight, LayoutDashboard, LockKeyhole,
  LogOut, Package, PanelLeft, Search, Settings, SlidersHorizontal, Users, Wrench,
  ClipboardList, Barcode, Copy, FilePlus2, FolderOpen, GripVertical, History, Plus, Save, Trash2, X
} from 'lucide-react';
import './styles.css';
import { supabase, isSupabaseConfigured } from './lib/supabaseClient';
import { dashboardCards, alerts, rentals, serviceOrders, clients as demoClients, equipment as demoEquipment } from './data/mockData';
import { createClientRecord, deleteClientRecord, fetchClients, updateClientRecord } from './services/clientsService';
import { addClientTypeRecord, deleteClientTypeRecord, fetchClientTypes, resetClientTypesRecords } from './services/clientTypesService';
import { fetchTablePreference, getLocalTablePreference, saveTablePreference } from './services/tablePreferencesService';
import { createEquipmentRecord, deleteEquipmentRecord, fetchEquipment, updateEquipmentRecord } from './services/equipmentService';


function onlyDigits(value) {
  return String(value ?? '').replace(/\D/g, '');
}

function isValidEmail(value) {
  const text = String(value ?? '').trim();
  if (!text) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(text);
}

function isValidPhone(value) {
  const text = String(value ?? '').trim();
  if (!text) return true;
  const digits = onlyDigits(text);
  return /^[+\d\s()-]+$/.test(text) && digits.length >= 7 && digits.length <= 15;
}

function isValidPostalCode(value) {
  const text = String(value ?? '').trim();
  if (!text) return true;
  return /^\d{2}-\d{3}$/.test(text);
}

function isValidNip(value) {
  const digits = onlyDigits(value);
  if (!digits) return true;
  if (digits.length !== 10) return false;
  const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7];
  const sum = weights.reduce((total, weight, index) => total + weight * Number(digits[index]), 0);
  return sum % 11 === Number(digits[9]);
}

function isValidRegon(value) {
  const digits = onlyDigits(value);
  if (!digits) return true;
  const check = (numbers, weights) => {
    const sum = weights.reduce((total, weight, index) => total + weight * Number(numbers[index]), 0);
    const control = sum % 11 === 10 ? 0 : sum % 11;
    return control === Number(numbers[weights.length]);
  };
  if (digits.length === 9) return check(digits, [8, 9, 2, 3, 4, 5, 6, 7]);
  if (digits.length === 14) return check(digits.slice(0, 9), [8, 9, 2, 3, 4, 5, 6, 7]) && check(digits, [2, 4, 8, 5, 0, 9, 7, 3, 6, 1, 2, 4, 8]);
  return false;
}

function validateClientForm(form) {
  const errors = {};
  if (!String(form.name ?? '').trim()) errors.name = 'Podaj nazwę klienta.';
  if (!isValidEmail(form.email)) errors.email = 'Podaj poprawny adres email.';
  if (!isValidPhone(form.phone)) errors.phone = 'Podaj poprawny numer telefonu.';
  if (!isValidPostalCode(form.postal_code)) errors.postal_code = 'Kod pocztowy wpisz w formacie 00-000.';
  if (form.type === 'Firma' && !isValidNip(form.nip)) errors.nip = 'NIP powinien mieć poprawną sumę kontrolną.';
  if (form.type === 'Firma' && !isValidRegon(form.regon)) errors.regon = 'REGON powinien mieć 9 lub 14 cyfr i poprawną sumę kontrolną.';
  return errors;
}

const DEFAULT_CLIENT_TYPES = ['Stały', 'Pracownik', 'VIP', 'Problematyczny', 'Nowy', 'Zablokowany'];

function getClientTypes() {
  try {
    const saved = localStorage.getItem('fixer-client-types');
    const parsed = saved ? JSON.parse(saved) : null;
    return Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_CLIENT_TYPES;
  } catch {
    return DEFAULT_CLIENT_TYPES;
  }
}

function saveClientTypes(types) {
  localStorage.setItem('fixer-client-types', JSON.stringify(types));
}

function getClientAddress(client) {
  return [client.street, client.building_number, client.apartment_number ? `/${client.apartment_number}` : '', client.postal_code, client.city]
    .filter(Boolean)
    .join(' ');
}

function getSafeMenuPosition(event, width = 240, height = 320) {
  const padding = 18;
  const bottomSafeArea = 48;
  const viewport = window.visualViewport;
  const viewportWidth = viewport?.width ?? window.innerWidth;
  const viewportHeight = viewport?.height ?? window.innerHeight;
  const offsetLeft = viewport?.offsetLeft ?? 0;
  const offsetTop = viewport?.offsetTop ?? 0;
  const minX = offsetLeft + padding;
  const minY = offsetTop + padding;
  const maxX = Math.max(minX, offsetLeft + viewportWidth - width - padding);
  const maxY = Math.max(minY, offsetTop + viewportHeight - height - bottomSafeArea);
  const x = Math.min(Math.max(minX, event.clientX), maxX);
  const openUp = event.clientY + height + bottomSafeArea > offsetTop + viewportHeight;
  const preferredY = openUp ? event.clientY - height - 8 : event.clientY;
  const y = Math.min(Math.max(minY, preferredY), maxY);
  return { x, y };
}

const modules = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'clients', label: 'Klienci', icon: Users },
  { id: 'equipment', label: 'Sprzęt', icon: Package },
  { id: 'rentals', label: 'Wypożyczenia', icon: ClipboardList },
  { id: 'service', label: 'Serwis', icon: Wrench },
  { id: 'calendar', label: 'Kalendarz', icon: CalendarDays },
  { id: 'organizer', label: 'Organizer', icon: CheckCircle2 },
  { id: 'settings', label: 'Ustawienia', icon: Settings }
];

const demoUser = { name: 'Mariusz', role: 'Administrator', email: 'admin@fixer.local' };

function App() {
  const [activeModule, setActiveModule] = useState('dashboard');
  const [session, setSession] = useState(null);
  const [demoAuth, setDemoAuth] = useState(() => localStorage.getItem('fixer-demo-auth') === 'true');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('fixer-sidebar') === 'collapsed');
  const [globalSearch, setGlobalSearch] = useState('');
  const [themeCompact, setThemeCompact] = useState(() => localStorage.getItem('fixer-density') === 'compact');

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => listener.subscription.unsubscribe();
  }, []);

  const isAuthenticated = isSupabaseConfigured ? Boolean(session) : demoAuth;
  const currentUser = isSupabaseConfigured && session?.user
    ? { name: session.user.email?.split('@')[0] ?? 'Użytkownik', role: 'Użytkownik', email: session.user.email ?? '' }
    : demoUser;

  const currentModule = modules.find((module) => module.id === activeModule) ?? modules[0];

  const handleLogout = async () => {
    if (isSupabaseConfigured) await supabase.auth.signOut();
    localStorage.removeItem('fixer-demo-auth');
    setDemoAuth(false);
    setSession(null);
  };

  if (!isAuthenticated) {
    return <LoginScreen onDemoLogin={() => { localStorage.setItem('fixer-demo-auth', 'true'); setDemoAuth(true); }} />;
  }

  return (
    <div className={`app-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''} ${themeCompact ? 'compact' : ''}`}>
      <Sidebar
        activeModule={activeModule}
        setActiveModule={setActiveModule}
        collapsed={sidebarCollapsed}
        onToggle={() => {
          const next = !sidebarCollapsed;
          setSidebarCollapsed(next);
          localStorage.setItem('fixer-sidebar', next ? 'collapsed' : 'expanded');
        }}
        onLogout={handleLogout}
        user={currentUser}
      />
      <main className="main-area">
        <Topbar
          module={currentModule}
          globalSearch={globalSearch}
          setGlobalSearch={setGlobalSearch}
          onToggleDensity={() => {
            const next = !themeCompact;
            setThemeCompact(next);
            localStorage.setItem('fixer-density', next ? 'compact' : 'comfortable');
          }}
          themeCompact={themeCompact}
        />
        <section className="page-content">
          {activeModule === 'dashboard' && <Dashboard setActiveModule={setActiveModule} />}
          {activeModule === 'clients' && <ClientsModule />}
          {activeModule === 'equipment' && <EquipmentModule />}
          {activeModule === 'rentals' && <RentalsModule />}
          {activeModule === 'service' && <ServiceModule />}
          {activeModule === 'calendar' && <CalendarModule />}
          {activeModule === 'organizer' && <OrganizerModule />}
          {activeModule === 'settings' && <SettingsModule />}
        </section>
      </main>
    </div>
  );
}

function LoginScreen({ onDemoLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSupabaseLogin = async (event) => {
    event.preventDefault();
    if (!isSupabaseConfigured) {
      onDemoLogin();
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert(error.message);
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="brand-mark">F</div>
        <p className="eyebrow">Fixer WEB</p>
        <h1>Logowanie do systemu</h1>
        <p className="muted">System logowania i zapisu danych działa przez Supabase.</p>
        <form onSubmit={handleSupabaseLogin} className="login-form">
          <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="email użytkownika" /></label>
          <label>Hasło<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="hasło" /></label>
          <button className="primary-button" type="submit"><LockKeyhole size={18} />Zaloguj</button>
        </form>
        {!isSupabaseConfigured && <button className="secondary-button full-width" onClick={onDemoLogin}>Wejdź lokalnie</button>}
        <div className="login-note">Baza danych: {isSupabaseConfigured ? 'połączona' : 'brak konfiguracji Supabase'}</div>
      </div>
    </div>
  );
}

function Sidebar({ activeModule, setActiveModule, collapsed, onToggle, onLogout, user }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="brand-mark">F</div>
        {!collapsed && <div><h2>Fixer WEB</h2><p>Service · Rental · CRM</p></div>}
      </div>
      <nav className="nav-list">
        {modules.map((module) => {
          const Icon = module.icon;
          return <button key={module.id} className={`nav-item ${activeModule === module.id ? 'active' : ''}`} onClick={() => setActiveModule(module.id)} title={module.label}><Icon size={18} />{!collapsed && <span>{module.label}</span>}</button>;
        })}
      </nav>
      <div className="sidebar-footer">
        <button className="ghost-button" onClick={onToggle}><PanelLeft size={18} />{!collapsed && <span>Zwiń panel</span>}</button>
        <div className="user-card"><div className="avatar">{user.name[0]?.toUpperCase() ?? 'U'}</div>{!collapsed && <div><strong>{user.name}</strong><span>{user.role}</span></div>}</div>
        <button className="ghost-button danger" onClick={onLogout}><LogOut size={18} />{!collapsed && <span>Wyloguj</span>}</button>
      </div>
    </aside>
  );
}

function Topbar({ module, globalSearch, setGlobalSearch, onToggleDensity, themeCompact }) {
  return (
    <header className="topbar">
      <div><p className="eyebrow">Panel systemu</p><h1>{module.label}</h1></div>
      <div className="topbar-actions">
        <div className="global-search"><Search size={18} /><input value={globalSearch} onChange={(event) => setGlobalSearch(event.target.value)} placeholder="Szukaj globalnie: klient, sprzęt, serwis, wypożyczenie..." /></div>
        <button className="icon-button" onClick={onToggleDensity}><SlidersHorizontal size={18} /><span>{themeCompact ? 'Kompakt' : 'Wygodny'}</span></button>
        <button className="icon-button"><Bell size={18} /></button>
      </div>
    </header>
  );
}

function Dashboard({ setActiveModule }) {
  return (
    <div className="dashboard-grid">
      <div className="stats-grid">
        {dashboardCards.map((card) => <button key={card.label} className="stat-card" onClick={() => setActiveModule(card.target)}><div><p>{card.label}</p><strong>{card.value}</strong><span className={card.warning ? 'warning-text' : ''}>{card.caption}</span></div><card.icon size={26} /></button>)}
      </div>
      <section className="panel wide"><PanelHeader title="Alerty i zadania na dziś" action="Otwórz" onClick={() => setActiveModule('organizer')} /><div className="alert-list">{alerts.map((alert) => <button key={alert.title} className={`alert-row ${alert.tone}`} onClick={() => setActiveModule(alert.target)}><div><strong>{alert.title}</strong><span>{alert.description}</span></div><em>{alert.time}</em></button>)}</div></section>
      <section className="panel"><PanelHeader title="Szybkie akcje" /><div className="quick-actions"><button><Barcode size={18} />Skanuj kod</button><button><ClipboardList size={18} />Nowa umowa</button><button><Wrench size={18} />Przyjęcie serwisu</button><button><Users size={18} />Dodaj klienta</button></div></section>
      <section className="panel"><PanelHeader title="Wypożyczenia i rezerwacje" action="Otwórz" onClick={() => setActiveModule('rentals')} /><DataTable storageKey="dashboard-rentals" columns={[{ key: 'number', label: 'Numer' },{ key: 'client', label: 'Klient' },{ key: 'item', label: 'Sprzęt' },{ key: 'status', label: 'Status' },{ key: 'date', label: 'Termin' }]} rows={rentals} /></section>
      <section className="panel"><PanelHeader title="Serwis" action="Otwórz" onClick={() => setActiveModule('service')} /><DataTable storageKey="dashboard-service" columns={[{ key: 'number', label: 'Numer' },{ key: 'client', label: 'Klient' },{ key: 'item', label: 'Sprzęt' },{ key: 'status', label: 'Status' }]} rows={serviceOrders} /></section>
    </div>
  );
}

function ClientsModule() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [editorInitialTab, setEditorInitialTab] = useState('data');
  const [notice, setNotice] = useState('');
  const [clientTypeFilter, setClientTypeFilter] = useState('all');
  const [clientKindFilter, setClientKindFilter] = useState('all');
  const [clientSearch, setClientSearch] = useState('');

  const clientKinds = useMemo(() => {
    const values = [...DEFAULT_CLIENT_TYPES, ...rows.map((client) => client.client_kind).filter(Boolean)];
    return [...new Set(values)];
  }, [rows]);

  const filteredRows = useMemo(() => {
    const query = clientSearch.trim().toLocaleLowerCase('pl');
    return rows.filter((client) => {
      const matchesType = clientTypeFilter === 'all' || client.type === clientTypeFilter;
      const matchesKind = clientKindFilter === 'all' || client.client_kind === clientKindFilter;
      const searchable = [client.name, client.type, client.client_kind, client.phone, client.email, client.city, client.nip]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('pl');
      return matchesType && matchesKind && (!query || searchable.includes(query));
    });
  }, [rows, clientTypeFilter, clientKindFilter, clientSearch]);

  const clearClientFilters = () => {
    setClientTypeFilter('all');
    setClientKindFilter('all');
    setClientSearch('');
  };

  const loadClients = async () => {
    setLoading(true);
    setNotice('');
    const { data, error } = await fetchClients();
    if (error) {
      setRows([]);
      setNotice(`Nie udało się pobrać klientów z bazy: ${error.message}`);
    } else {
      setRows(data);
    }
    setLoading(false);
  };

  useEffect(() => { loadClients(); }, []);

  const openClientEditor = (client = null, tab = 'data') => {
    setEditingClient(client);
    setEditorInitialTab(tab);
    setEditorOpen(true);
  };

  const duplicateClient = (client) => {
    const copy = {
      ...client,
      id: null,
      localId: null,
      name: `${client.name || 'Klient'} kopia`
    };
    openClientEditor(copy, 'data');
  };

  const handleSave = async (client) => {
    const payload = {
      name: client.name,
      type: client.type,
      client_kind: client.client_kind,
      phone: client.phone,
      email: client.email,
      street: client.street,
      building_number: client.building_number,
      apartment_number: client.apartment_number,
      postal_code: client.postal_code,
      city: client.city,
      country: client.country,
      nip: client.type === 'Firma' ? client.nip : '',
      regon: client.type === 'Firma' ? client.regon : '',
      notes: client.notes
    };
    if (!client.name.trim()) {
      alert('Nazwa klienta jest wymagana.');
      return;
    }
    if (!isSupabaseConfigured) {
      alert('Brak konfiguracji bazy danych Supabase. Dane klientów nie mogą zostać zapisane.');
      return;
    }
    const result = client.id ? await updateClientRecord(client.id, payload) : await createClientRecord(payload);
    if (result.error) {
      alert(result.error.message);
      return;
    }
    await loadClients();
    setEditorOpen(false);
  };

  const handleDelete = async (client) => {
    if (!confirm(`Usunąć klienta: ${client.name}?`)) return;
    if (!client.id || !isSupabaseConfigured) {
      alert('Brak konfiguracji bazy danych Supabase. Nie można usunąć klienta.');
      return;
    }
    const { error } = await deleteClientRecord(client.id);
    if (error) {
      alert(error.message);
      return;
    }
    await loadClients();
  };

  return (
    <div className="module-page">
      <section className="panel hero-panel">
        <p className="eyebrow">Moduł</p><h2>Baza klientów</h2>
        <p className="muted">Kartoteka klientów, dane adresowe, dane firmowe, rodzaje klientów i historia współpracy.</p>
        <div className="module-actions">
          <button className="primary-button" onClick={() => openClientEditor(null, 'data')}><Plus size={18} />Dodaj klienta</button>
          <button className="secondary-button" onClick={loadClients}>Odśwież</button>
          <button className="secondary-button">Eksport PDF</button>

        </div>
        {notice && <div className="notice">{notice}</div>}
      </section>
      <section className="panel clients-list-panel">
        <div className="client-filter-bar">
          <label>
            Szukaj
            <input value={clientSearch} onChange={(event) => setClientSearch(event.target.value)} placeholder="Nazwa, miasto, telefon, email, NIP" />
          </label>
          <label>
            Typ
            <select value={clientTypeFilter} onChange={(event) => setClientTypeFilter(event.target.value)}>
              <option value="all">Wszyscy</option>
              <option value="Firma">Tylko firmy</option>
              <option value="Osoba prywatna">Tylko osoby prywatne</option>
            </select>
          </label>
          <label>
            Rodzaj klienta
            <select value={clientKindFilter} onChange={(event) => setClientKindFilter(event.target.value)}>
              <option value="all">Wszystkie rodzaje</option>
              {clientKinds.map((kind) => <option key={kind} value={kind}>{kind}</option>)}
            </select>
          </label>
          <button type="button" className="secondary-button compact-button" onClick={clearClientFilters}>Wyczyść filtry</button>
          <span className="filter-count">{filteredRows.length} / {rows.length}</span>
        </div>
        <DataTable storageKey="clients-table" loading={loading} columns={[{ key: 'name', label: 'Nazwa' },{ key: 'type', label: 'Typ' },{ key: 'client_kind', label: 'Rodzaj klienta' },{ key: 'phone', label: 'Telefon' },{ key: 'email', label: 'Email' },{ key: 'city', label: 'Miasto' },{ key: 'nip', label: 'NIP' }]} rows={filteredRows} onOpen={(client) => openClientEditor(client, 'data')} onEdit={(client) => openClientEditor(client, 'data')} onHistory={(client) => openClientEditor(client, 'history')} onDuplicate={duplicateClient} onDelete={handleDelete} />
      </section>
      {editorOpen && <ClientEditor client={editingClient} initialTab={editorInitialTab} onClose={() => setEditorOpen(false)} onSave={handleSave} />}
    </div>
  );
}

function ClientEditor({ client, initialTab = 'data', onClose, onSave }) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [clientTypes, setClientTypes] = useState(DEFAULT_CLIENT_TYPES);
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState(() => ({
    id: client?.id ?? null,
    localId: client?.localId ?? null,
    name: client?.name ?? '',
    type: client?.type ?? 'Firma',
    client_kind: client?.client_kind ?? client?.rating ?? getClientTypes()[0],
    phone: client?.phone ?? '',
    email: client?.email ?? '',
    street: client?.street ?? '',
    building_number: client?.building_number ?? '',
    apartment_number: client?.apartment_number ?? '',
    postal_code: client?.postal_code ?? '',
    city: client?.city ?? '',
    country: client?.country ?? 'Polska',
    nip: client?.nip ?? '',
    regon: client?.regon ?? '',
    notes: client?.notes ?? ''
  }));
  const update = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const saveClient = () => {
    const nextErrors = validateClientForm(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    onSave(form);
  };

  const fieldClass = (key) => errors[key] ? 'field-error' : undefined;

  useEffect(() => {
    let active = true;
    fetchClientTypes().then(({ data }) => {
      if (!active) return;
      const names = data.map((item) => item.name).filter(Boolean);
      setClientTypes(names.length ? names : getClientTypes());
    });
    return () => { active = false; };
  }, []);

  const clientHistoryRows = [
    ...rentals.filter((rental) => rental.client === form.name).map((rental) => ({ date: rental.date, type: 'Wypożyczenie', description: `${rental.number} — ${rental.item}`, status: rental.status })),
    ...serviceOrders.filter((order) => order.client === form.name).map((order) => ({ date: '—', type: 'Serwis', description: `${order.number} — ${order.item}`, status: order.status }))
  ];

  return (
    <div className="modal-backdrop">
      <div className="modal-card client-modal">
        <div className="modal-header"><div><p className="eyebrow">Klient</p><h2>{client ? 'Kartoteka klienta' : 'Nowy klient'}</h2></div><button className="icon-button" onClick={onClose}><X size={18} /></button></div>
        <div className="tabs">
          <button className={activeTab === 'data' ? 'active' : ''} onClick={() => setActiveTab('data')}>Dane klienta</button>
          <button className={activeTab === 'history' ? 'active' : ''} onClick={() => setActiveTab('history')}>Historia</button>
          <button className={activeTab === 'notes' ? 'active' : ''} onClick={() => setActiveTab('notes')}>Notatki</button>
        </div>
        {activeTab === 'data' && <div className="client-form-compact">
          <div className="form-section flat-form-section">
            <div className="section-title">Dane podstawowe</div>
            <div className="form-grid client-basic-grid">
              <label className="client-name-field">Nazwa klienta<input className={fieldClass('name')} value={form.name} onChange={(event) => update('name', event.target.value)} />{errors.name && <small>{errors.name}</small>}</label>
              <label className="client-type-field">Typ<select value={form.type} onChange={(event) => update('type', event.target.value)}><option>Firma</option><option>Osoba prywatna</option></select></label>
              <label className="client-kind-field">Rodzaj klienta<select value={form.client_kind} onChange={(event) => update('client_kind', event.target.value)}>{clientTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
              <label className="phone-field">Telefon<input className={fieldClass('phone')} value={form.phone} onChange={(event) => update('phone', event.target.value)} />{errors.phone && <small>{errors.phone}</small>}</label>
              <label className="email-field">Email<input className={fieldClass('email')} value={form.email} onChange={(event) => update('email', event.target.value)} />{errors.email && <small>{errors.email}</small>}</label>
            </div>
          </div>
          <div className="form-section flat-form-section">
            <div className="section-title">Adres</div>
            <div className="form-grid compact-address-grid">
              <label className="street-field">Ulica<input value={form.street} onChange={(event) => update('street', event.target.value)} /></label>
              <label className="building-field">Nr budynku<input value={form.building_number} onChange={(event) => update('building_number', event.target.value)} /></label>
              <label className="apartment-field">Nr lokalu<input value={form.apartment_number} onChange={(event) => update('apartment_number', event.target.value)} /></label>
              <label className="postal-field">Kod pocztowy<input className={fieldClass('postal_code')} value={form.postal_code} onChange={(event) => update('postal_code', event.target.value)} />{errors.postal_code && <small>{errors.postal_code}</small>}</label>
              <label className="city-field">Miasto<input value={form.city} onChange={(event) => update('city', event.target.value)} /></label>
              <label className="country-field">Kraj<input value={form.country} onChange={(event) => update('country', event.target.value)} /></label>
            </div>
          </div>
          {form.type === 'Firma' && <div className="form-section flat-form-section">
            <div className="section-title">Dane firmowe</div>
            <div className="form-grid company-data-grid">
              <label>NIP<input className={fieldClass('nip')} value={form.nip} onChange={(event) => update('nip', event.target.value)} />{errors.nip && <small>{errors.nip}</small>}</label>
              <label>REGON<input className={fieldClass('regon')} value={form.regon} onChange={(event) => update('regon', event.target.value)} />{errors.regon && <small>{errors.regon}</small>}</label>
            </div>
          </div>}
        </div>}
        {activeTab === 'notes' && <div className="notes-panel">
          <div className="form-section notes-section">
            <div className="section-title">Notatki</div>
            <label className="notes-label" htmlFor="client-notes">Informacje wewnętrzne o kliencie</label>
            <textarea id="client-notes" className="notes-textarea" value={form.notes} onChange={(event) => update('notes', event.target.value)} />
          </div>
        </div>}
        {activeTab === 'history' && <div className="history-panel">
          <div className="summary-box"><strong>Informacje o kliencie</strong><span>{form.notes || 'Brak notatek.'}</span></div>
          {clientHistoryRows.length ? <DataTable storageKey={`client-history-${form.id ?? form.localId ?? 'new'}`} columns={[{ key: 'date', label: 'Data' },{ key: 'type', label: 'Typ' },{ key: 'description', label: 'Opis' },{ key: 'status', label: 'Status' }]} rows={clientHistoryRows} /> : <div className="notice">Brak powiązanych wypożyczeń lub zleceń serwisowych dla tego klienta.</div>}
        </div>}
        <div className="modal-actions"><button className="secondary-button" onClick={onClose}>Anuluj</button><button className="primary-button" onClick={saveClient}><Save size={18} />Zapisz</button></div>
      </div>
    </div>
  );
}

function EquipmentModule() {
  const [rows, setRows] = useState(demoEquipment);
  const [loading, setLoading] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState(null);
  const [notice, setNotice] = useState('');

  const loadEquipment = async () => {
    setLoading(true);
    setNotice('');
    const { data, error } = await fetchEquipment();
    if (error) {
      setRows(demoEquipment);
      setNotice('Nie udało się pobrać sprzętu z bazy danych. Sprawdź konfigurację Supabase i schema.sql.');
    } else {
      setRows(data.length ? data : demoEquipment);
      setNotice('Dane sprzętu pobrane z Supabase.');
    }
    setLoading(false);
  };

  useEffect(() => { loadEquipment(); }, []);

  const openEquipmentEditor = (item = null) => {
    setEditingEquipment(item);
    setEditorOpen(true);
  };

  const duplicateEquipment = (item) => {
    const copy = {
      ...item,
      id: null,
      localId: null,
      name: `${item.name || 'Sprzęt'} kopia`,
      serial: '',
      inventory_number: '',
      barcode: ''
    };
    openEquipmentEditor(copy);
  };

  const normalizePayload = (item) => ({
    name: item.name,
    category: item.category,
    brand: item.brand,
    model: item.model,
    serial: item.serial,
    inventory_number: item.inventory_number,
    barcode: item.barcode,
    status: item.status,
    location: item.location,
    purchase_date: item.purchase_date || null,
    notes: item.notes
  });

  const handleSave = async (item) => {
    if (!item.name.trim()) {
      alert('Nazwa sprzętu jest wymagana.');
      return;
    }

    const payload = normalizePayload(item);
    if (isSupabaseConfigured) {
      const result = item.id ? await updateEquipmentRecord(item.id, payload) : await createEquipmentRecord(payload);
      if (result.error) alert(result.error.message);
      await loadEquipment();
    } else {
      setRows((current) => item.localId
        ? current.map((row) => row.localId === item.localId ? item : row)
        : [{ ...item, localId: crypto.randomUUID() }, ...current]);
    }
    setEditorOpen(false);
  };

  const handleDelete = async (item) => {
    if (!confirm(`Usunąć sprzęt: ${item.name}?`)) return;
    if (item.id && isSupabaseConfigured) {
      const { error } = await deleteEquipmentRecord(item.id);
      if (error) alert(error.message);
      await loadEquipment();
    } else {
      setRows((current) => current.filter((row) => row !== item));
    }
  };

  return (
    <div className="module-page">
      <section className="panel hero-panel">
        <p className="eyebrow">Moduł</p><h2>Magazyn sprzętu</h2>
        <p className="muted">Kartoteka urządzeń, numery seryjne, kody, lokalizacje, statusy i przygotowanie pod zestawy oraz wypożyczenia.</p>
        <div className="module-actions">
          <button className="primary-button" onClick={() => openEquipmentEditor(null)}><Plus size={18} />Dodaj sprzęt</button>
          <button className="secondary-button" onClick={loadEquipment}>Odśwież</button>
          <button className="secondary-button">Eksport PDF</button>
          <button className="secondary-button">Ustawienia modułu</button>
        </div>
        {notice && <div className="notice">{notice}</div>}
      </section>
      <section className="panel">
        <DataTable storageKey="equipment-table" loading={loading} columns={[
          { key: 'name', label: 'Nazwa' },
          { key: 'category', label: 'Kategoria' },
          { key: 'brand', label: 'Marka' },
          { key: 'model', label: 'Model' },
          { key: 'serial', label: 'Numer seryjny' },
          { key: 'inventory_number', label: 'Nr inw.' },
          { key: 'status', label: 'Status' },
          { key: 'location', label: 'Lokalizacja' }
        ]} rows={rows} onOpen={openEquipmentEditor} onEdit={openEquipmentEditor} onDuplicate={duplicateEquipment} onDelete={handleDelete} />
      </section>
      {editorOpen && <EquipmentEditor equipment={editingEquipment} onClose={() => setEditorOpen(false)} onSave={handleSave} />}
    </div>
  );
}

function EquipmentEditor({ equipment, onClose, onSave }) {
  const [form, setForm] = useState(() => ({
    id: equipment?.id ?? null,
    localId: equipment?.localId ?? null,
    name: equipment?.name ?? '',
    category: equipment?.category ?? 'Kamera',
    brand: equipment?.brand ?? '',
    model: equipment?.model ?? '',
    serial: equipment?.serial ?? '',
    inventory_number: equipment?.inventory_number ?? '',
    barcode: equipment?.barcode ?? equipment?.serial ?? '',
    status: equipment?.status ?? 'Dostępny',
    location: equipment?.location ?? 'Magazyn',
    purchase_date: equipment?.purchase_date ?? '',
    notes: equipment?.notes ?? ''
  }));
  const update = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const saveClient = () => {
    const nextErrors = validateClientForm(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    onSave(form);
  };

  const fieldClass = (key) => errors[key] ? 'field-error' : undefined;

  return (
    <div className="modal-backdrop">
      <div className="modal-card equipment-modal">
        <div className="modal-header"><div><p className="eyebrow">Sprzęt</p><h2>{equipment ? 'Edycja sprzętu' : 'Nowy sprzęt'}</h2></div><button className="icon-button" onClick={onClose}><X size={18} /></button></div>
        <div className="form-grid">
          <label className="wide-field">Nazwa sprzętu<input value={form.name} onChange={(event) => update('name', event.target.value)} /></label>
          <label>Kategoria<select value={form.category} onChange={(event) => update('category', event.target.value)}><option>Kamera</option><option>Obiektyw</option><option>Audio</option><option>Streaming</option><option>Oświetlenie</option><option>Komputer</option><option>Akcesoria</option><option>Zestaw</option></select></label>
          <label>Status<select value={form.status} onChange={(event) => update('status', event.target.value)}><option>Dostępny</option><option>Wypożyczony</option><option>Rezerwacja</option><option>Serwis</option><option>Uszkodzony</option><option>Wycofany</option><option>Zestaw</option></select></label>
          <label>Marka<input value={form.brand} onChange={(event) => update('brand', event.target.value)} /></label>
          <label>Model<input value={form.model} onChange={(event) => update('model', event.target.value)} /></label>
          <label>Numer seryjny<input value={form.serial} onChange={(event) => update('serial', event.target.value)} /></label>
          <label>Numer inwentarzowy<input value={form.inventory_number} onChange={(event) => update('inventory_number', event.target.value)} /></label>
          <label>Kod kreskowy / QR<input value={form.barcode} onChange={(event) => update('barcode', event.target.value)} /></label>
          <label>Lokalizacja<input value={form.location} onChange={(event) => update('location', event.target.value)} /></label>
          <label>Data zakupu<input type="date" value={form.purchase_date} onChange={(event) => update('purchase_date', event.target.value)} /></label>
          <label className="wide-field">Notatki<textarea value={form.notes} onChange={(event) => update('notes', event.target.value)} /></label>
        </div>
        <div className="modal-actions"><button className="secondary-button" onClick={onClose}>Anuluj</button><button className="primary-button" onClick={saveClient}><Save size={18} />Zapisz</button></div>
      </div>
    </div>
  );
}
function RentalsModule() {
  return <ModulePage title="Wypożyczenia" description="Wypożyczenia, zwroty, rezerwacje, checklisty zestawów i automatyczna historia klienta." table={<DataTable storageKey="rentals-table" columns={[{ key: 'number', label: 'Numer' },{ key: 'client', label: 'Klient' },{ key: 'item', label: 'Sprzęt' },{ key: 'status', label: 'Status' },{ key: 'date', label: 'Termin' }]} rows={rentals} />} />;
}
function ServiceModule() {
  return <ModulePage title="Serwis" description="Zlecenia serwisowe, statusy, postępy, dokumenty przyjęcia i wydania." table={<DataTable storageKey="service-table" columns={[{ key: 'number', label: 'Numer' },{ key: 'client', label: 'Klient' },{ key: 'item', label: 'Sprzęt' },{ key: 'status', label: 'Status' }]} rows={serviceOrders} />} />;
}
function CalendarModule() {
  return <ModulePage title="Kalendarz" description="Widok rezerwacji, wypożyczeń, terminów serwisowych i zadań na osi czasu." table={<Timeline />} />;
}
function OrganizerModule() {
  return <ModulePage title="Organizer" description="Projekty, zadania, komentarze, załączniki i przypomnienia inspirowane Asaną." table={<OrganizerBoard />} />;
}
function SettingsModule() {
  return <ModulePage title="Ustawienia" description="Konfiguracja firmy, statusów, rodzajów klientów, numeracji dokumentów i preferencji." table={<SettingsGrid />} />;
}
function ModulePage({ title, description, table }) {
  return <div className="module-page"><section className="panel hero-panel"><p className="eyebrow">Moduł</p><h2>{title}</h2><p className="muted">{description}</p><div className="module-actions"><button className="primary-button">Dodaj wpis</button><button className="secondary-button">Eksport PDF</button><button className="secondary-button">Ustawienia modułu</button></div></section><section className="panel">{table}</section></div>;
}
function PanelHeader({ title, action, onClick }) {
  return <div className="panel-header"><h2>{title}</h2>{action && <button onClick={onClick}>{action}<ChevronRight size={16} /></button>}</div>;
}

function getStoredJson(key, fallback) {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
}

function DataTable({ columns, rows, storageKey, loading = false, onOpen, onEdit, onDuplicate, onHistory, onDelete }) {
  const columnsSignature = columns.map((column) => column.key).join('|');
  const defaultPreference = useMemo(() => ({
    visibleColumns: columns.map((column) => column.key),
    columnOrder: columns.map((column) => column.key),
    columnWidths: {},
    sortKey: null,
    sortDir: 'asc'
  }), [columnsSignature]);
  const initialPreference = getLocalTablePreference(storageKey, defaultPreference);
  const [sortKey, setSortKey] = useState(initialPreference.sortKey);
  const [sortDir, setSortDir] = useState(initialPreference.sortDir ?? 'asc');
  const [draggedColumn, setDraggedColumn] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [rowContextMenu, setRowContextMenu] = useState(null);
  const [visibleColumns, setVisibleColumns] = useState(initialPreference.visibleColumns);
  const [columnOrder, setColumnOrder] = useState(initialPreference.columnOrder);
  const [columnWidths, setColumnWidths] = useState(initialPreference.columnWidths);

  const persistTablePreference = (nextPreference) => {
    saveTablePreference(storageKey, {
      visibleColumns: nextPreference.visibleColumns ?? visibleColumns,
      columnOrder: nextPreference.columnOrder ?? columnOrder,
      columnWidths: nextPreference.columnWidths ?? columnWidths,
      sortKey: Object.prototype.hasOwnProperty.call(nextPreference, 'sortKey') ? nextPreference.sortKey : sortKey,
      sortDir: nextPreference.sortDir ?? sortDir
    });
  };

  useEffect(() => {
    let active = true;
    fetchTablePreference(storageKey, defaultPreference).then(({ data }) => {
      if (!active || !data) return;
      setVisibleColumns(data.visibleColumns);
      setColumnOrder(data.columnOrder);
      setColumnWidths(data.columnWidths);
      setSortKey(data.sortKey ?? null);
      setSortDir(data.sortDir ?? 'asc');
    });
    return () => { active = false; };
  }, [storageKey, defaultPreference]);

  useEffect(() => {
    const availableKeys = columns.map((column) => column.key);
    setColumnOrder((current) => {
      const orderedExisting = current.filter((key) => availableKeys.includes(key));
      const missing = availableKeys.filter((key) => !orderedExisting.includes(key));
      return [...orderedExisting, ...missing];
    });
    setVisibleColumns((current) => {
      const next = current.filter((key) => availableKeys.includes(key));
      return next.length ? next : availableKeys;
    });
  }, [columnsSignature]);

  useEffect(() => {
    if (!contextMenu && !rowContextMenu) return undefined;
    const closeMenu = () => { setContextMenu(null); setRowContextMenu(null); };
    window.addEventListener('click', closeMenu);
    window.addEventListener('keydown', closeMenu);
    window.addEventListener('resize', closeMenu);
    return () => {
      window.removeEventListener('click', closeMenu);
      window.removeEventListener('keydown', closeMenu);
      window.removeEventListener('resize', closeMenu);
    };
  }, [contextMenu, rowContextMenu]);

  const sortedRows = useMemo(() => {
    if (!sortKey) return rows;
    const normalize = (value) => {
      if (value === null || value === undefined) return '';
      if (typeof value === 'number') return value;
      const text = String(value).trim();
      const numberText = text.replace(/\s/g, '').replace(',', '.');
      if (numberText && !Number.isNaN(Number(numberText))) return Number(numberText);
      const timestamp = Date.parse(text);
      if (!Number.isNaN(timestamp) && /\d{4}-\d{2}-\d{2}|\d{2}[./-]\d{2}[./-]\d{4}/.test(text)) return timestamp;
      return text.toLocaleLowerCase('pl');
    };
    return [...rows].sort((a, b) => {
      const left = normalize(a[sortKey]);
      const right = normalize(b[sortKey]);
      if (left === right) return 0;
      if (left === '') return 1;
      if (right === '') return -1;
      const result = typeof left === 'number' && typeof right === 'number'
        ? left - right
        : String(left).localeCompare(String(right), 'pl', { numeric: true, sensitivity: 'base' });
      return sortDir === 'asc' ? result : -result;
    });
  }, [rows, sortKey, sortDir]);

  const orderedColumns = useMemo(() => {
    const columnMap = new Map(columns.map((column) => [column.key, column]));
    return columnOrder.map((key) => columnMap.get(key)).filter(Boolean);
  }, [columns, columnOrder]);

  const activeColumns = orderedColumns.filter((column) => visibleColumns.includes(column.key));
  const hasActions = onOpen || onEdit || onDuplicate || onHistory || onDelete;

  const applySort = (key, direction = 'asc') => {
    setSortKey(key);
    setSortDir(direction);
    persistTablePreference({ sortKey: key, sortDir: direction });
  };

  const clearSort = () => {
    setSortKey(null);
    setSortDir('asc');
    persistTablePreference({ sortKey: null, sortDir: 'asc' });
  };

  const handleSort = (key) => {
    if (sortKey !== key) {
      applySort(key, 'asc');
      return;
    }
    if (sortDir === 'asc') {
      applySort(key, 'desc');
      return;
    }
    clearSort();
  };

  const toggleColumn = (key) => {
    const isVisible = visibleColumns.includes(key);
    if (isVisible && visibleColumns.length === 1) return;
    const next = isVisible ? visibleColumns.filter((columnKey) => columnKey !== key) : [...visibleColumns, key];
    setVisibleColumns(next);
    persistTablePreference({ visibleColumns: next });
  };

  const moveColumn = (sourceKey, targetKey) => {
    if (!sourceKey || sourceKey === targetKey) return;
    setColumnOrder((current) => {
      const next = [...current];
      const sourceIndex = next.indexOf(sourceKey);
      const targetIndex = next.indexOf(targetKey);
      if (sourceIndex === -1 || targetIndex === -1) return current;
      next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, sourceKey);
      persistTablePreference({ columnOrder: next });
      return next;
    });
  };

  const startResize = (event, key) => {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const th = event.currentTarget.closest('th');
    const startWidth = th?.offsetWidth ?? columnWidths[key] ?? 140;

    const onMouseMove = (moveEvent) => {
      const nextWidth = Math.max(72, startWidth + moveEvent.clientX - startX);
      setColumnWidths((current) => {
        const next = { ...current, [key]: nextWidth };
        persistTablePreference({ columnWidths: next });
        return next;
      });
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.classList.remove('resizing-table-column');
    };

    document.body.classList.add('resizing-table-column');
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const resetColumns = () => {
    const keys = columns.map((column) => column.key);
    setVisibleColumns(keys);
    setColumnOrder(keys);
    setColumnWidths({});
    setSortKey(null);
    setSortDir('asc');
    persistTablePreference({ visibleColumns: keys, columnOrder: keys, columnWidths: {}, sortKey: null, sortDir: 'asc' });
    setContextMenu(null);
  };

  const openColumnMenu = (event, columnKey = null) => {
    event.preventDefault();
    setRowContextMenu(null);
    setContextMenu({ ...getSafeMenuPosition(event, 250, 420), columnKey });
  };

  const openRowMenu = (event, row) => {
    if (!hasActions) return;
    event.preventDefault();
    setContextMenu(null);
    setRowContextMenu({ ...getSafeMenuPosition(event, 230, 420), row });
  };

  const copyText = async (text) => {
    const value = String(text ?? '').trim();
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const input = document.createElement('textarea');
      input.value = value;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
    }
  };

  const runRowAction = (action) => {
    const row = rowContextMenu?.row;
    setRowContextMenu(null);
    if (!row) return;
    if (action === 'open') (onOpen ?? onEdit)?.(row);
    if (action === 'edit') onEdit?.(row);
    if (action === 'duplicate') onDuplicate?.(row);
    if (action === 'history') onHistory?.(row);
    if (action === 'copyName') copyText(row.name ?? row.number ?? row.client ?? '');
    if (action === 'copyId') copyText(row.id ?? row.localId ?? row.number ?? '');
    if (action === 'delete') onDelete?.(row);
  };

  return (
    <div className="table-shell">
      {loading && <div className="loading-line">Ładowanie danych...</div>}
      <div className="table-scroll">
        <table>
          <colgroup>{activeColumns.map((column) => <col key={column.key} style={{ width: columnWidths[column.key] ? `${columnWidths[column.key]}px` : undefined }} />)}</colgroup>
          <thead><tr>{activeColumns.map((column) => <th key={column.key} draggable onContextMenu={(event) => openColumnMenu(event, column.key)} onDragStart={(event) => { setDraggedColumn(column.key); event.dataTransfer.effectAllowed = 'move'; }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); moveColumn(draggedColumn, column.key); setDraggedColumn(null); }} onDragEnd={() => setDraggedColumn(null)} onClick={() => handleSort(column.key)} className={draggedColumn === column.key ? 'dragging-column' : ''}><span><GripVertical size={14} />{column.label}</span>{sortKey === column.key && <em>{sortDir === 'asc' ? '↑' : '↓'}</em>}<button type="button" className="column-resizer" aria-label={`Zmień szerokość kolumny ${column.label}`} onMouseDown={(event) => startResize(event, column.key)} /></th>)}</tr></thead>
          <tbody>{sortedRows.map((row, index) => <tr key={`${row.id ?? row.localId ?? row.number ?? row.name}-${index}`} className={hasActions ? 'editable-row' : ''} onDoubleClick={() => (onOpen ?? onEdit)?.(row)} onContextMenu={(event) => openRowMenu(event, row)} title={hasActions ? 'Dwuklik otwiera kartotekę. Prawy klik pokazuje operacje.' : undefined}>{activeColumns.map((column) => <td key={column.key}>{column.key === 'status' || column.key === 'client_kind' ? <StatusPill value={row[column.key]} /> : row[column.key]}</td>)}</tr>)}</tbody>
        </table>
      </div>

      {rowContextMenu && <div className="row-context-menu" style={{ left: rowContextMenu.x, top: rowContextMenu.y }} onClick={(event) => event.stopPropagation()}>
        <div className="context-menu-title">Operacje</div>
        {(onOpen || onEdit) && <button type="button" onClick={() => runRowAction('open')}><FolderOpen size={14} />Otwórz</button>}
        {onEdit && <button type="button" onClick={() => runRowAction('edit')}><Save size={14} />Edytuj</button>}
        {onDuplicate && <button type="button" onClick={() => runRowAction('duplicate')}><FilePlus2 size={14} />Duplikuj</button>}
        {onHistory && <button type="button" onClick={() => runRowAction('history')}><History size={14} />Historia</button>}
        <div className="context-menu-separator" />
        <button type="button" onClick={() => runRowAction('copyName')}><Copy size={14} />Kopiuj nazwę</button>
        {(rowContextMenu.row?.id || rowContextMenu.row?.localId || rowContextMenu.row?.number) && <button type="button" onClick={() => runRowAction('copyId')}><Copy size={14} />Kopiuj ID / numer</button>}
        {onDelete && <><div className="context-menu-separator" /><button type="button" className="danger-action" onClick={() => runRowAction('delete')}><Trash2 size={14} />Usuń</button></>}
      </div>}
      {contextMenu && <div className="column-context-menu" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={(event) => event.stopPropagation()}>
        <div className="context-menu-title">Widoczne kolumny</div>
        {orderedColumns.map((column) => {
          const checked = visibleColumns.includes(column.key);
          const disabled = checked && visibleColumns.length === 1;
          return <label key={column.key} className={disabled ? 'disabled' : ''}><input type="checkbox" checked={checked} disabled={disabled} onChange={() => toggleColumn(column.key)} />{column.label}</label>;
        })}
        <button type="button" onClick={resetColumns}>Przywróć domyślne kolumny</button>
      </div>}
    </div>
  );
}

function StatusPill({ value }) {
  const text = String(value ?? '');
  const lower = text.toLowerCase();
  const tone = lower.includes('po terminie') || lower.includes('problematyczny') || lower.includes('zablokowany') ? 'danger'
    : lower.includes('gotowe') || lower.includes('vip') || lower.includes('stały') ? 'success'
    : lower.includes('rezerwacja') || lower.includes('pracownik') || lower.includes('nowy') ? 'warning'
    : 'neutral';
  return <span className={`status-pill ${tone}`}>{text}</span>;
}

function Timeline() {
  return <div className="timeline">{['Walizka stream — rezerwacja', 'Sony PXW-Z190 — wypożyczenie', 'Yamaha MG12XU — odbiór serwisu'].map((item, index) => <div className="timeline-row" key={item}><span>{index === 0 ? 'Dzisiaj' : index === 1 ? 'Jutro' : 'Za 7 dni'}</span><div><strong>{item}</strong></div></div>)}</div>;
}
function OrganizerBoard() {
  const columns = ['Do zrobienia', 'W trakcie', 'Gotowe'];
  return <div className="kanban">{columns.map((column, index) => <div className="kanban-column" key={column}><h3>{column}</h3><div className="task-card"><strong>{index === 0 ? 'Uzupełnić dane klienta' : index === 1 ? 'Zweryfikować zestaw CASE-04' : 'Przygotować szablon umowy'}</strong><span>{index === 0 ? 'Klienci' : index === 1 ? 'Wypożyczenia' : 'Dokumenty'}</span></div></div>)}</div>;
}
function SettingsGrid() {
  const [clientTypes, setClientTypes] = useState([]);
  const [newType, setNewType] = useState('');
  const [notice, setNotice] = useState('');
  const items = ['Dane firmy', 'Statusy sprzętu', 'Statusy serwisu', 'Numeracja dokumentów', 'Marki i modele', 'Szablony PDF'];

  const loadTypes = async () => {
    const { data, error } = await fetchClientTypes();
    if (error) {
      setNotice(`Nie udało się pobrać rodzajów klientów z bazy: ${error.message}`);
      setClientTypes(getClientTypes().map((name, index) => ({ id: name, name, sort_order: index })));
      return;
    }
    setClientTypes(data);
    saveClientTypes(data.map((item) => item.name));
    setNotice('');
  };

  useEffect(() => { loadTypes(); }, []);

  const addType = async () => {
    const value = newType.trim();
    if (!value) return;
    if (clientTypes.some((item) => item.name.toLowerCase() === value.toLowerCase())) {
      setNewType('');
      return;
    }
    const { error } = await addClientTypeRecord(value, clientTypes.length + 1);
    if (error) {
      alert(error.message);
      return;
    }
    setNewType('');
    await loadTypes();
  };

  const removeType = async (type) => {
    if (clientTypes.length <= 1) {
      alert('Musi zostać przynajmniej jeden rodzaj klienta.');
      return;
    }
    const { error } = await deleteClientTypeRecord(type.id);
    if (error) {
      alert(error.message);
      return;
    }
    await loadTypes();
  };

  const resetTypes = async () => {
    const { error } = await resetClientTypesRecords(DEFAULT_CLIENT_TYPES);
    if (error) {
      alert(error.message);
      return;
    }
    await loadTypes();
  };

  return <div className="settings-section">
    <div className="settings-grid">{items.map((item) => <button key={item}><Settings size={18} /><span>{item}</span></button>)}</div>
    <div className="panel settings-editor">
      <div className="panel-header"><h2>Ustawienia programu / Klienci</h2><button onClick={resetTypes}>Przywróć domyślne</button></div>
      <p className="muted">Rodzaje klientów są zapisywane w bazie i zasilają pole „Rodzaj klienta” w kartotece klienta.</p>
      {notice && <div className="notice">{notice}</div>}
      <div className="inline-form"><input value={newType} onChange={(event) => setNewType(event.target.value)} placeholder="np. Partner, VIP, Problemowy" /><button className="primary-button" onClick={addType}>Dodaj</button></div>
      <div className="tag-list">{clientTypes.map((type) => <span className="config-tag" key={type.id}>{type.name}<button onClick={() => removeType(type)}>×</button></span>)}</div>
    </div>
  </div>;
}


createRoot(document.getElementById('root')).render(<App />);
