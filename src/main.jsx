import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Bell, CalendarDays, CheckCircle2, ChevronRight, Columns3, LayoutDashboard, LockKeyhole,
  LogOut, Package, PanelLeft, Search, Settings, SlidersHorizontal, Users, Wrench,
  ClipboardList, Barcode, Eye, EyeOff, GripVertical, Plus, Save, Trash2, X
} from 'lucide-react';
import './styles.css';
import { supabase, isSupabaseConfigured } from './lib/supabaseClient';
import { dashboardCards, alerts, rentals, serviceOrders, clients as demoClients, equipment } from './data/mockData';
import { createClientRecord, deleteClientRecord, fetchClients, updateClientRecord } from './services/clientsService';

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
        <p className="muted">System jest przygotowany pod Supabase Auth. Bez zmiennych środowiskowych działa tryb demo.</p>
        <form onSubmit={handleSupabaseLogin} className="login-form">
          <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="email użytkownika" /></label>
          <label>Hasło<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="hasło" /></label>
          <button className="primary-button" type="submit"><LockKeyhole size={18} />Zaloguj</button>
        </form>
        <button className="secondary-button full-width" onClick={onDemoLogin}>Wejdź w trybie demo</button>
        <div className="login-note">Supabase: {isSupabaseConfigured ? 'skonfigurowany' : 'brak konfiguracji — działa tryb demo'}</div>
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
  const [rows, setRows] = useState(demoClients);
  const [loading, setLoading] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [notice, setNotice] = useState('');

  const loadClients = async () => {
    setLoading(true);
    setNotice('');
    const { data, error } = await fetchClients();
    if (error) {
      setRows(demoClients);
      setNotice('Tryb demo: tabela Supabase nie jest jeszcze podpięta albo nie utworzono schematu.');
    } else {
      setRows(data.length ? data : demoClients);
      setNotice('Dane pobrane z Supabase.');
    }
    setLoading(false);
  };

  useEffect(() => { loadClients(); }, []);

  const handleSave = async (client) => {
    const payload = { name: client.name, type: client.type, phone: client.phone, email: client.email, rating: client.rating, notes: client.notes };
    if (isSupabaseConfigured) {
      const result = client.id ? await updateClientRecord(client.id, payload) : await createClientRecord(payload);
      if (result.error) alert(result.error.message);
      await loadClients();
    } else {
      setRows((current) => client.localId
        ? current.map((row) => row.localId === client.localId ? client : row)
        : [{ ...client, localId: crypto.randomUUID() }, ...current]);
    }
    setEditorOpen(false);
  };

  const handleDelete = async (client) => {
    if (!confirm(`Usunąć klienta: ${client.name}?`)) return;
    if (client.id && isSupabaseConfigured) {
      const { error } = await deleteClientRecord(client.id);
      if (error) alert(error.message);
      await loadClients();
    } else {
      setRows((current) => current.filter((row) => row !== client));
    }
  };

  return (
    <div className="module-page">
      <section className="panel hero-panel">
        <p className="eyebrow">Moduł</p><h2>Baza klientów</h2>
        <p className="muted">Kartoteka klientów, historia współpracy, wypożyczenia, serwisy i ocena wiarygodności.</p>
        <div className="module-actions">
          <button className="primary-button" onClick={() => { setEditingClient(null); setEditorOpen(true); }}><Plus size={18} />Dodaj klienta</button>
          <button className="secondary-button" onClick={loadClients}>Odśwież</button>
          <button className="secondary-button">Eksport PDF</button>
          <button className="secondary-button">Ustawienia modułu</button>
        </div>
        {notice && <div className="notice">{notice}</div>}
      </section>
      <section className="panel">
        <DataTable storageKey="clients-table" loading={loading} columns={[{ key: 'name', label: 'Nazwa' },{ key: 'type', label: 'Typ' },{ key: 'phone', label: 'Telefon' },{ key: 'email', label: 'Email' },{ key: 'rating', label: 'Ocena' }]} rows={rows} onEdit={(client) => { setEditingClient(client); setEditorOpen(true); }} onDelete={handleDelete} />
      </section>
      {editorOpen && <ClientEditor client={editingClient} onClose={() => setEditorOpen(false)} onSave={handleSave} />}
    </div>
  );
}

function ClientEditor({ client, onClose, onSave }) {
  const [form, setForm] = useState(() => ({
    id: client?.id ?? null, localId: client?.localId ?? null, name: client?.name ?? '', type: client?.type ?? 'Firma',
    phone: client?.phone ?? '', email: client?.email ?? '', rating: client?.rating ?? 'Dobry', notes: client?.notes ?? ''
  }));
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="modal-header"><div><p className="eyebrow">Klient</p><h2>{client ? 'Edycja klienta' : 'Nowy klient'}</h2></div><button className="icon-button" onClick={onClose}><X size={18} /></button></div>
        <div className="form-grid">
          <label>Nazwa klienta<input value={form.name} onChange={(event) => update('name', event.target.value)} /></label>
          <label>Typ<select value={form.type} onChange={(event) => update('type', event.target.value)}><option>Firma</option><option>Osoba prywatna</option></select></label>
          <label>Telefon<input value={form.phone} onChange={(event) => update('phone', event.target.value)} /></label>
          <label>Email<input value={form.email} onChange={(event) => update('email', event.target.value)} /></label>
          <label>Ocena<select value={form.rating} onChange={(event) => update('rating', event.target.value)}><option>Bardzo dobry</option><option>Dobry</option><option>Neutralny</option><option>Ryzykowny</option><option>Zablokowany</option></select></label>
          <label className="wide-field">Notatki<textarea value={form.notes} onChange={(event) => update('notes', event.target.value)} /></label>
        </div>
        <div className="modal-actions"><button className="secondary-button" onClick={onClose}>Anuluj</button><button className="primary-button" onClick={() => onSave(form)}><Save size={18} />Zapisz</button></div>
      </div>
    </div>
  );
}

function EquipmentModule() {
  return <ModulePage title="Magazyn sprzętu" description="Sprzęt, numery seryjne, kody kreskowe, zestawy, statusy i skaner." table={<DataTable storageKey="equipment-table" columns={[{ key: 'name', label: 'Nazwa' },{ key: 'brand', label: 'Marka' },{ key: 'model', label: 'Model' },{ key: 'serial', label: 'Numer seryjny' },{ key: 'status', label: 'Status' }]} rows={equipment} />} />;
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
  return <ModulePage title="Ustawienia" description="Konfiguracja firmy, statusów, numeracji dokumentów, marek, modeli i preferencji." table={<SettingsGrid />} />;
}
function ModulePage({ title, description, table }) {
  return <div className="module-page"><section className="panel hero-panel"><p className="eyebrow">Moduł</p><h2>{title}</h2><p className="muted">{description}</p><div className="module-actions"><button className="primary-button">Dodaj wpis</button><button className="secondary-button">Eksport PDF</button><button className="secondary-button">Ustawienia modułu</button></div></section><section className="panel">{table}</section></div>;
}
function PanelHeader({ title, action, onClick }) {
  return <div className="panel-header"><h2>{title}</h2>{action && <button onClick={onClick}>{action}<ChevronRight size={16} /></button>}</div>;
}

function DataTable({ columns, rows, storageKey, loading = false, onEdit, onDelete }) {
  const [sortKey, setSortKey] = useState(columns[0]?.key);
  const [sortDir, setSortDir] = useState('asc');
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem(`${storageKey}-columns`);
    return saved ? JSON.parse(saved) : columns.map((column) => column.key);
  });

  const sortedRows = useMemo(() => [...rows].sort((a, b) => {
    const left = String(a[sortKey] ?? '');
    const right = String(b[sortKey] ?? '');
    return sortDir === 'asc' ? left.localeCompare(right, 'pl') : right.localeCompare(left, 'pl');
  }), [rows, sortKey, sortDir]);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const toggleColumn = (key) => {
    const next = visibleColumns.includes(key) ? visibleColumns.filter((columnKey) => columnKey !== key) : [...visibleColumns, key];
    setVisibleColumns(next);
    localStorage.setItem(`${storageKey}-columns`, JSON.stringify(next));
  };

  const activeColumns = columns.filter((column) => visibleColumns.includes(column.key));
  const hasActions = onEdit || onDelete;

  return (
    <div className="table-shell">
      <div className="table-tools"><div className="table-tool-label"><Columns3 size={16} />Widoczność kolumn</div><div className="column-toggles">{columns.map((column) => <button key={column.key} className={visibleColumns.includes(column.key) ? 'active' : ''} onClick={() => toggleColumn(column.key)}>{visibleColumns.includes(column.key) ? <Eye size={14} /> : <EyeOff size={14} />}{column.label}</button>)}</div></div>
      {loading && <div className="loading-line">Ładowanie danych...</div>}
      <table><thead><tr>{activeColumns.map((column) => <th key={column.key} onClick={() => handleSort(column.key)}><span><GripVertical size={14} />{column.label}</span>{sortKey === column.key && <em>{sortDir === 'asc' ? '↑' : '↓'}</em>}</th>)}{hasActions && <th>Akcje</th>}</tr></thead>
      <tbody>{sortedRows.map((row, index) => <tr key={`${row.id ?? row.localId ?? row.number ?? row.name}-${index}`}>{activeColumns.map((column) => <td key={column.key}>{column.key === 'status' || column.key === 'rating' ? <StatusPill value={row[column.key]} /> : row[column.key]}</td>)}{hasActions && <td><div className="row-actions">{onEdit && <button onClick={() => onEdit(row)}>Edytuj</button>}{onDelete && <button className="danger-action" onClick={() => onDelete(row)}><Trash2 size={14} />Usuń</button>}</div></td>}</tr>)}</tbody></table>
    </div>
  );
}

function StatusPill({ value }) {
  const text = String(value ?? '');
  const lower = text.toLowerCase();
  const tone = lower.includes('po terminie') || lower.includes('ryzykowny') || lower.includes('zablokowany') ? 'danger'
    : lower.includes('gotowe') || lower.includes('bardzo dobry') ? 'success'
    : lower.includes('rezerwacja') || lower.includes('neutralny') ? 'warning'
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
  const items = ['Dane firmy', 'Statusy sprzętu', 'Statusy serwisu', 'Numeracja dokumentów', 'Marki i modele', 'Szablony PDF'];
  return <div className="settings-grid">{items.map((item) => <button key={item}><Settings size={18} /><span>{item}</span></button>)}</div>;
}

createRoot(document.getElementById('root')).render(<App />);
