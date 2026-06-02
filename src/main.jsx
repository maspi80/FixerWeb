import React, { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Bell, CalendarDays, CheckCircle2, ChevronRight, LayoutDashboard, LockKeyhole,
  LogOut, Package, PanelLeft, Search, Settings, SlidersHorizontal, Users, Wrench,
  ClipboardList, Barcode, Copy, Download, FilePlus2, FileText, FolderOpen, GripVertical, History, Plus, Save, Trash2, X, Sun, Moon
} from 'lucide-react';
import './styles.css';
import { supabase, isSupabaseConfigured } from './lib/supabaseClient';
import { dashboardCards, alerts, rentals, serviceOrders, clients as demoClients, equipment as demoEquipment } from './data/mockData';
import { createClientRecord, deleteClientRecord, fetchClients, updateClientRecord } from './services/clientsService';
import { addClientTypeRecord, deleteClientTypeRecord, fetchClientTypes, resetClientTypesRecords } from './services/clientTypesService';
import { fetchTablePreference, getLocalTablePreference, saveTablePreference } from './services/tablePreferencesService';
import { createEquipmentRecord, deleteEquipmentRecord, fetchEquipment, updateEquipmentRecord } from './services/equipmentService';
import {
  addEquipmentDictionaryRecord,
  deleteEquipmentDictionaryRecord,
  fetchEquipmentDictionary,
  getLocalEquipmentDictionaryNames,
  resetEquipmentDictionaryRecords,
  updateEquipmentDictionaryRecord
} from './services/equipmentDictionariesService';


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


function normalizeFileNamePart(value) {
  const text = String(value ?? 'tabela').trim().toLocaleLowerCase('pl');
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'tabela';
}

function formatExportCell(value) {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value).replace(/\s+/g, ' ').trim();
}

function buildCsv(columns, rows) {
  const separator = ';';
  const escapeCell = (value) => {
    const text = formatExportCell(value);
    const escaped = text.replace(/"/g, '""');
    return /[";\n\r]/.test(escaped) ? `"${escaped}"` : escaped;
  };
  const header = columns.map((column) => escapeCell(column.label)).join(separator);
  const body = rows.map((row) => columns.map((column) => escapeCell(row[column.key])).join(separator));
  return `\ufeff${[header, ...body].join('\r\n')}`;
}

function downloadTextFile(fileName, content, mimeType = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function normalizeExportValue(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return value;
  const text = String(value).trim();
  const numberText = text.replace(/\s/g, '').replace(',', '.');
  if (numberText && !Number.isNaN(Number(numberText))) return Number(numberText);
  const timestamp = Date.parse(text);
  if (!Number.isNaN(timestamp) && /\d{4}-\d{2}-\d{2}|\d{2}[./-]\d{2}[./-]\d{4}/.test(text)) return timestamp;
  return text.toLocaleLowerCase('pl');
}

function sortRowsForExport(rows, sortKey, sortDir = 'asc') {
  if (!sortKey) return rows;
  return [...rows].sort((a, b) => {
    const left = normalizeExportValue(a[sortKey]);
    const right = normalizeExportValue(b[sortKey]);
    if (left === right) return 0;
    if (left === '') return 1;
    if (right === '') return -1;
    const result = typeof left === 'number' && typeof right === 'number'
      ? left - right
      : String(left).localeCompare(String(right), 'pl', { numeric: true, sensitivity: 'base' });
    return sortDir === 'asc' ? result : -result;
  });
}

function getExportTableData(storageKey, columns, rows) {
  const fallback = {
    visibleColumns: columns.map((column) => column.key),
    columnOrder: columns.map((column) => column.key),
    columnWidths: {},
    sortKey: null,
    sortDir: 'asc'
  };
  const preference = getLocalTablePreference(storageKey, fallback);
  const columnMap = new Map(columns.map((column) => [column.key, column]));
  const orderedColumns = (preference.columnOrder ?? fallback.columnOrder).map((key) => columnMap.get(key)).filter(Boolean);
  const visible = preference.visibleColumns ?? fallback.visibleColumns;
  const activeColumns = orderedColumns.filter((column) => visible.includes(column.key));
  const safeColumns = activeColumns.length ? activeColumns : columns;
  return {
    columns: safeColumns,
    rows: sortRowsForExport(rows, preference.sortKey, preference.sortDir)
  };
}

function exportTableToCsv(storageKey, columns, rows) {
  const exportData = getExportTableData(storageKey, columns, rows);
  const csv = buildCsv(exportData.columns, exportData.rows);
  const date = new Date().toISOString().slice(0, 10);
  const fileName = `${normalizeFileNamePart(storageKey)}-${date}.csv`;
  downloadTextFile(fileName, csv);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function exportTableToPdf(title, storageKey, columns, rows) {
  const exportData = getExportTableData(storageKey, columns, rows);
  const company = getCompanyProfile();
  const date = new Date().toLocaleDateString('pl-PL');
  const header = exportData.columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join('');
  const body = exportData.rows.map((row) => `<tr>${exportData.columns.map((column) => `<td>${escapeHtml(formatExportCell(row[column.key]))}</td>`).join('')}</tr>`).join('');
  const companyName = company.name || company.legalName || 'FIXER WEB';
  const companyAddress = formatCompanyAddress(company);
  const companyTax = formatCompanyTaxData(company);
  const companyContact = formatCompanyContact(company);
  const companyFooter = company.documentFooter?.trim();
  const logo = company.logoDataUrl ? `<img src="${escapeHtml(company.logoDataUrl)}" alt="Logo firmy"/>` : `<div class="print-logo-fallback">${escapeHtml(companyName.slice(0, 1).toUpperCase())}</div>`;
  const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=1100,height=800');
  if (!printWindow) {
    alert('Przeglądarka zablokowała okno eksportu PDF. Zezwól na wyskakujące okna dla FIXER WEB.');
    return;
  }
  printWindow.document.write(`<!doctype html><html lang="pl"><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title><style>
    @page{size:A4 landscape;margin:12mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#111827;margin:0}.document-header{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;border-bottom:2px solid #e2e8f0;padding-bottom:12px;margin-bottom:14px}.company-block{display:flex;gap:12px;align-items:flex-start}.company-logo{width:72px;height:72px;border:1px solid #cbd5e1;border-radius:12px;display:grid;place-items:center;overflow:hidden;flex:0 0 auto}.company-logo img{max-width:100%;max-height:100%;object-fit:contain}.print-logo-fallback{width:100%;height:100%;display:grid;place-items:center;background:#2563eb;color:#fff;font-size:28px;font-weight:800}.company-name{font-size:18px;font-weight:800;margin:0 0 4px}.company-line{margin:0 0 3px;color:#475569;font-size:10.5px}.document-meta{text-align:right}.document-meta h1{font-size:20px;margin:0 0 5px}.document-meta p{margin:0 0 3px;color:#475569;font-size:11px}table{width:100%;border-collapse:collapse;font-size:10px}th,td{border:1px solid #cbd5e1;padding:6px 7px;text-align:left;vertical-align:top}th{background:#e2e8f0;color:#0f172a;font-weight:700}tr:nth-child(even) td{background:#f8fafc}.document-footer{border-top:1px solid #e2e8f0;margin-top:12px;padding-top:8px;color:#64748b;font-size:10px}@media print{button{display:none}}
  </style></head><body><div class="document-header"><div class="company-block"><div class="company-logo">${logo}</div><div><p class="company-name">${escapeHtml(companyName)}</p>${companyAddress ? `<p class="company-line">${escapeHtml(companyAddress)}</p>` : ''}${companyTax ? `<p class="company-line">${escapeHtml(companyTax)}</p>` : ''}${companyContact ? `<p class="company-line">${escapeHtml(companyContact)}</p>` : ''}${company.bankAccount ? `<p class="company-line">Konto: ${escapeHtml(company.bankAccount)}</p>` : ''}</div></div><div class="document-meta"><h1>${escapeHtml(title)}</h1><p>Data eksportu: ${escapeHtml(date)}</p><p>Liczba wpisów: ${exportData.rows.length}</p></div></div><table><thead><tr>${header}</tr></thead><tbody>${body || `<tr><td colspan="${exportData.columns.length}">Brak danych do eksportu.</td></tr>`}</tbody></table>${companyFooter ? `<div class="document-footer">${escapeHtml(companyFooter)}</div>` : ''}<script>window.onload=function(){window.focus();window.print();};</script></body></html>`);
  printWindow.document.close();
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
  const [colorTheme, setColorTheme] = useState(() => localStorage.getItem('fixer-color-theme') === 'light' ? 'light' : 'dark');

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
    <div className={`app-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''} ${themeCompact ? 'compact' : ''} theme-${colorTheme}`}>
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
          colorTheme={colorTheme}
          onChangeColorTheme={(nextTheme) => {
            setColorTheme(nextTheme);
            localStorage.setItem('fixer-color-theme', nextTheme);
          }}
        />
        <section className="page-content">
          {activeModule === 'dashboard' && <Dashboard setActiveModule={setActiveModule} />}
          {activeModule === 'clients' && <ClientsModule />}
          {activeModule === 'equipment' && <EquipmentModule />}
          {activeModule === 'rentals' && <RentalsModule />}
          {activeModule === 'service' && <ServiceModule />}
          {activeModule === 'calendar' && <CalendarModule />}
          {activeModule === 'organizer' && <OrganizerModule />}
          {activeModule === 'settings' && <SettingsModule colorTheme={colorTheme} onChangeColorTheme={(nextTheme) => { setColorTheme(nextTheme); localStorage.setItem('fixer-color-theme', nextTheme); }} />}
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

function Topbar({ module, globalSearch, setGlobalSearch, onToggleDensity, themeCompact, colorTheme, onChangeColorTheme }) {
  return (
    <header className="topbar">
      <div><p className="eyebrow">Panel systemu</p><h1>{module.label}</h1></div>
      <div className="topbar-actions">
        <div className="global-search"><Search size={18} /><input value={globalSearch} onChange={(event) => setGlobalSearch(event.target.value)} placeholder="Szukaj globalnie: klient, sprzęt, serwis, wypożyczenie..." /></div>
        <button className="icon-button" onClick={onToggleDensity}><SlidersHorizontal size={18} /><span>{themeCompact ? 'Kompakt' : 'Wygodny'}</span></button>
        <button className="icon-button" onClick={() => onChangeColorTheme(colorTheme === 'light' ? 'dark' : 'light')} title="Zmień motyw">{colorTheme === 'light' ? <Moon size={18} /> : <Sun size={18} />}<span>{colorTheme === 'light' ? 'Ciemny' : 'Jasny'}</span></button>
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

const CLIENTS_TABLE_KEY = 'clients-table';
const CLIENTS_TABLE_COLUMNS = [
  { key: 'name', label: 'Nazwa' },
  { key: 'type', label: 'Typ' },
  { key: 'client_kind', label: 'Rodzaj klienta' },
  { key: 'phone', label: 'Telefon' },
  { key: 'email', label: 'Email' },
  { key: 'city', label: 'Miasto' },
  { key: 'nip', label: 'NIP' }
];

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

  const handleBulkDelete = async (clients) => {
    const selected = clients.filter((client) => client?.id);
    if (!selected.length) {
      alert('Zaznaczone pozycje nie mają identyfikatorów w bazie.');
      return;
    }
    if (!confirm(`Usunąć zaznaczone pozycje: ${selected.length}?`)) return;
    if (!isSupabaseConfigured) {
      alert('Brak konfiguracji bazy danych Supabase. Nie można usunąć klientów.');
      return;
    }
    for (const client of selected) {
      const { error } = await deleteClientRecord(client.id);
      if (error) {
        alert(`Nie udało się usunąć klienta ${client.name}: ${error.message}`);
        return;
      }
    }
    await loadClients();
  };


  return (
    <div className="module-page">
      <section className="panel hero-panel">
        <p className="eyebrow">Moduł</p><h2>Baza klientów</h2>
        <p className="muted">Kartoteka klientów, dane adresowe, dane firmowe, rodzaje klientów i historia współpracy.</p>
        <div className="module-actions">
          <button className="primary-button module-action-button" onClick={() => openClientEditor(null, 'data')}><Plus size={18} />Dodaj klienta</button>
          <button className="secondary-button module-action-button" onClick={loadClients}>Odśwież</button>
          <button className="secondary-button module-action-button" onClick={() => exportTableToCsv(CLIENTS_TABLE_KEY, CLIENTS_TABLE_COLUMNS, filteredRows)} disabled={!filteredRows.length}><Download size={16} />Eksport CSV</button>
          <button className="secondary-button module-action-button" onClick={() => exportTableToPdf('Baza klientów', CLIENTS_TABLE_KEY, CLIENTS_TABLE_COLUMNS, filteredRows)} disabled={!filteredRows.length}><FileText size={16} />Eksport PDF</button>

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
        <DataTable storageKey={CLIENTS_TABLE_KEY} loading={loading} columns={CLIENTS_TABLE_COLUMNS} rows={filteredRows} onOpen={(client) => openClientEditor(client, 'data')} onEdit={(client) => openClientEditor(client, 'data')} onHistory={(client) => openClientEditor(client, 'history')} onDuplicate={duplicateClient} onDelete={handleDelete} onBulkDelete={handleBulkDelete} />
      </section>
      {editorOpen && <ClientEditor client={editingClient} initialTab={editorInitialTab} onClose={() => setEditorOpen(false)} onSave={handleSave} />}
    </div>
  );
}


const CLIENT_MODAL_SIZE_KEY = 'fixer-client-modal-size';
const CLIENT_MODAL_POSITION_KEY = 'fixer-client-modal-position';
const DEFAULT_CLIENT_MODAL_SIZE = { width: 940, height: 560 };
const MIN_CLIENT_MODAL_SIZE = { width: 720, height: 420 };
const CLIENT_MODAL_SCREEN_MARGIN = 16;

function clampClientModalSize(size) {
  if (typeof window === 'undefined') return size;
  const maxWidth = Math.max(MIN_CLIENT_MODAL_SIZE.width, window.innerWidth - 32);
  const maxHeight = Math.max(MIN_CLIENT_MODAL_SIZE.height, window.innerHeight - 32);
  return {
    width: Math.min(Math.max(size.width, MIN_CLIENT_MODAL_SIZE.width), maxWidth),
    height: Math.min(Math.max(size.height, MIN_CLIENT_MODAL_SIZE.height), maxHeight)
  };
}

function getSavedClientModalSize() {
  if (typeof window === 'undefined') return DEFAULT_CLIENT_MODAL_SIZE;
  try {
    const parsed = JSON.parse(localStorage.getItem(CLIENT_MODAL_SIZE_KEY) || 'null');
    if (parsed && Number.isFinite(parsed.width) && Number.isFinite(parsed.height)) {
      return clampClientModalSize(parsed);
    }
  } catch {}
  return clampClientModalSize(DEFAULT_CLIENT_MODAL_SIZE);
}

function getCenteredClientModalPosition(size) {
  if (typeof window === 'undefined') return { left: CLIENT_MODAL_SCREEN_MARGIN, top: CLIENT_MODAL_SCREEN_MARGIN };
  return {
    left: Math.max(CLIENT_MODAL_SCREEN_MARGIN, Math.round((window.innerWidth - size.width) / 2)),
    top: Math.max(CLIENT_MODAL_SCREEN_MARGIN, Math.round((window.innerHeight - size.height) / 2))
  };
}

function clampClientModalPosition(position, size) {
  if (typeof window === 'undefined') return position;
  const maxLeft = Math.max(CLIENT_MODAL_SCREEN_MARGIN, window.innerWidth - size.width - CLIENT_MODAL_SCREEN_MARGIN);
  const maxTop = Math.max(CLIENT_MODAL_SCREEN_MARGIN, window.innerHeight - size.height - CLIENT_MODAL_SCREEN_MARGIN);
  return {
    left: Math.min(Math.max(position.left, CLIENT_MODAL_SCREEN_MARGIN), maxLeft),
    top: Math.min(Math.max(position.top, CLIENT_MODAL_SCREEN_MARGIN), maxTop)
  };
}

function getSavedClientModalPosition(size) {
  if (typeof window === 'undefined') return getCenteredClientModalPosition(size);
  try {
    const parsed = JSON.parse(localStorage.getItem(CLIENT_MODAL_POSITION_KEY) || 'null');
    if (parsed && Number.isFinite(parsed.left) && Number.isFinite(parsed.top)) {
      return clampClientModalPosition(parsed, size);
    }
  } catch {}
  return clampClientModalPosition(getCenteredClientModalPosition(size), size);
}

function ClientEditor({ client, initialTab = 'data', onClose, onSave }) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [clientTypes, setClientTypes] = useState(DEFAULT_CLIENT_TYPES);
  const [errors, setErrors] = useState({});
  const [modalSize, setModalSize] = useState(getSavedClientModalSize);
  const [modalPosition, setModalPosition] = useState(() => getSavedClientModalPosition(getSavedClientModalSize()));
  const modalSizeRef = useRef(modalSize);
  const modalPositionRef = useRef(modalPosition);
  const resizeStateRef = useRef(null);
  const dragStateRef = useRef(null);
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

  const setItemKeys = useMemo(() => new Set((form.set_items ?? []).map(getSetItemKey).filter(Boolean).map(String)), [form.set_items]);
  const availableSetComponents = useMemo(() => equipmentRows.filter((item) => {
    if (sameEquipmentKey(item, form)) return false;
    if (isEquipmentSet(item)) return false;
    if (isEquipmentSetComponent(item) && !setItemKeys.has(String(getEquipmentKey(item)))) return false;
    if (setItemKeys.has(String(getEquipmentKey(item)))) return false;
    if (isItemUsedInOtherSet(item, equipmentRows, form)) return false;
    return true;
  }), [equipmentRows, form, setItemKeys]);

  const isSetCard = form.category === EQUIPMENT_SET_CATEGORY;
  const safeStatuses = statuses.includes(EQUIPMENT_SET_COMPONENT_STATUS) ? statuses : [...statuses, EQUIPMENT_SET_COMPONENT_STATUS];

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
    modalSizeRef.current = modalSize;
    localStorage.setItem(CLIENT_MODAL_SIZE_KEY, JSON.stringify(modalSize));
    setModalPosition((current) => clampClientModalPosition(current, modalSize));
  }, [modalSize]);

  useEffect(() => {
    modalPositionRef.current = modalPosition;
    localStorage.setItem(CLIENT_MODAL_POSITION_KEY, JSON.stringify(modalPosition));
  }, [modalPosition]);

  useEffect(() => {
    const handleWindowResize = () => {
      setModalSize((current) => clampClientModalSize(current));
      setModalPosition((current) => clampClientModalPosition(current, modalSizeRef.current));
    };
    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, []);

  useEffect(() => {
    const handlePointerMove = (event) => {
      const resizeState = resizeStateRef.current;
      if (resizeState) {
        event.preventDefault();
        setModalSize(clampClientModalSize({
          width: resizeState.startWidth + event.clientX - resizeState.startX,
          height: resizeState.startHeight + event.clientY - resizeState.startY
        }));
        return;
      }
      const dragState = dragStateRef.current;
      if (!dragState) return;
      event.preventDefault();
      setModalPosition(clampClientModalPosition({
        left: dragState.startLeft + event.clientX - dragState.startX,
        top: dragState.startTop + event.clientY - dragState.startY
      }, modalSizeRef.current));
    };
    const handlePointerUp = () => {
      resizeStateRef.current = null;
      dragStateRef.current = null;
    };
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, []);

  const startResize = (event) => {
    event.preventDefault();
    event.stopPropagation();
    resizeStateRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      startWidth: modalSizeRef.current.width,
      startHeight: modalSizeRef.current.height
    };
  };

  const startDrag = (event) => {
    if (event.target.closest('button, input, select, textarea, a')) return;
    event.preventDefault();
    dragStateRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      startLeft: modalPositionRef.current.left,
      startTop: modalPositionRef.current.top
    };
  };

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
    <div className="modal-backdrop draggable-modal-backdrop">
      <div className="modal-card client-modal resizable-client-modal draggable-client-modal" style={{ width: `${modalSize.width}px`, height: `${modalSize.height}px`, left: `${modalPosition.left}px`, top: `${modalPosition.top}px` }}>
        <div className="modal-header draggable-modal-header" onPointerDown={startDrag}><div><p className="eyebrow">Klient</p><h2>{client ? 'Kartoteka klienta' : 'Nowy klient'}</h2></div><button className="icon-button" onClick={onClose}><X size={18} /></button></div>
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
        <div className="modal-resize-handle" onPointerDown={startResize} title="Zmień rozmiar okna" aria-label="Zmień rozmiar okna" />
      </div>
    </div>
  );
}


const EQUIPMENT_SET_CATEGORY = 'Zestaw';
const EQUIPMENT_SET_COMPONENT_STATUS = 'Składnik zestawu';
const EQUIPMENT_AVAILABLE_STATUS = 'Dostępny';

function getEquipmentKey(item) {
  return item?.id ?? item?.localId ?? item?.inventory_number ?? item?.serial ?? item?.barcode ?? item?.name ?? '';
}

function getEquipmentDisplayName(item) {
  return [item?.name, item?.brand, item?.model, item?.serial ? `SN: ${item.serial}` : '', item?.inventory_number ? `Nr inw.: ${item.inventory_number}` : '']
    .filter(Boolean)
    .join(' · ');
}

function isEquipmentSet(item) {
  return item?.category === EQUIPMENT_SET_CATEGORY || Array.isArray(item?.set_items) && item.set_items.length > 0 && item?.status !== EQUIPMENT_SET_COMPONENT_STATUS;
}

function isEquipmentSetComponent(item) {
  return item?.status === EQUIPMENT_SET_COMPONENT_STATUS;
}

function normalizeSetItemFromEquipment(item) {
  return {
    id: item?.id ?? null,
    localId: item?.localId ?? null,
    key: getEquipmentKey(item),
    name: item?.name ?? '',
    category: item?.category ?? '',
    brand: item?.brand ?? '',
    model: item?.model ?? '',
    serial: item?.serial ?? '',
    inventory_number: item?.inventory_number ?? '',
    barcode: item?.barcode ?? '',
    status: item?.status ?? '',
    location: item?.location ?? '',
    required: true
  };
}

function getSetItemKey(item) {
  return item?.id ?? item?.localId ?? item?.key ?? item?.inventory_number ?? item?.serial ?? item?.barcode ?? item?.name ?? '';
}

function sameEquipmentKey(left, right) {
  const leftKey = typeof left === 'string' ? left : getEquipmentKey(left) || getSetItemKey(left);
  const rightKey = typeof right === 'string' ? right : getEquipmentKey(right) || getSetItemKey(right);
  return Boolean(leftKey && rightKey && String(leftKey) === String(rightKey));
}

function isItemUsedInOtherSet(item, equipmentRows, currentSet) {
  const itemKey = getEquipmentKey(item);
  if (!itemKey) return false;
  return equipmentRows.some((row) => {
    if (!isEquipmentSet(row)) return false;
    if (currentSet && sameEquipmentKey(row, currentSet)) return false;
    return (row.set_items ?? []).some((setItem) => sameEquipmentKey(setItem, itemKey));
  });
}

function getEquipmentSetStatus(setItems = []) {
  const items = Array.isArray(setItems) ? setItems : [];
  if (!items.length) return 'Niekompletny';
  const statuses = items.map((item) => String(item?.status ?? '').toLocaleLowerCase('pl'));
  if (statuses.some((status) => status.includes('wypo'))) return 'Wypożyczony';
  if (statuses.some((status) => status.includes('serwis') || status.includes('uszk') || status.includes('kontro'))) return 'Serwis';
  return EQUIPMENT_AVAILABLE_STATUS;
}

function EquipmentModule() {
  const [rows, setRows] = useState(demoEquipment);
  const [loading, setLoading] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState(null);
  const [notice, setNotice] = useState('');
  const [equipmentCategories, setEquipmentCategories] = useState(() => getLocalEquipmentDictionaryNames('category'));
  const [equipmentStatuses, setEquipmentStatuses] = useState(() => getLocalEquipmentDictionaryNames('status'));
  const [equipmentLocations, setEquipmentLocations] = useState(() => getLocalEquipmentDictionaryNames('location'));

  const loadEquipmentDictionaries = async () => {
    const [categoriesResult, statusesResult, locationsResult] = await Promise.all([fetchEquipmentDictionary('category'),fetchEquipmentDictionary('status'),fetchEquipmentDictionary('location')]);
    setEquipmentCategories(categoriesResult.data.map((item) => item.name));
    setEquipmentStatuses(statusesResult.data.map((item) => item.name));
    setEquipmentLocations((locationsResult.data||[]).map((item)=>item.name));
  };

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

  useEffect(() => { loadEquipment(); loadEquipmentDictionaries(); }, []);

  const openEquipmentEditor = (item = null, options = {}) => {
    if (item && isEquipmentSetComponent(item) && !options.force) {
      alert('Ten sprzęt jest składnikiem zestawu. Najpierw usuń go z zestawu, żeby można było go edytować.');
      return;
    }
    setEditingEquipment(item);
    setEditorOpen(true);
  };

  const openSetEditor = () => {
    openEquipmentEditor({
      name: '',
      category: EQUIPMENT_SET_CATEGORY,
      status: EQUIPMENT_AVAILABLE_STATUS,
      location: 'Magazyn',
      condition: 'Bardzo dobry',
      set_items: [],
      description: ''
    }, { force: true });
  };

  const duplicateEquipment = (item) => {
    if (isEquipmentSetComponent(item)) {
      alert('Nie można duplikować składnika zestawu.');
      return;
    }
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
    notes: item.notes,
    description: item.description ?? '',
    condition: item.condition ?? 'Bardzo dobry',
    purchase_value: item.purchase_value ?? '',
    deposit: item.deposit ?? '',
    price_day: item.price_day ?? '',
    price_week: item.price_week ?? '',
    gallery: Array.isArray(item.gallery) ? item.gallery : [],
    attachments: Array.isArray(item.attachments) ? item.attachments : [],
    set_items: Array.isArray(item.set_items) ? item.set_items : [],
    service_notes: item.service_notes ?? '',
    history_notes: item.history_notes ?? ''
  });

  const updateSetComponentStatuses = async (previousItems = [], nextItems = [], parentItem = null) => {
    const previousKeys = new Set(previousItems.map(getSetItemKey).filter(Boolean).map(String));
    const nextKeys = new Set(nextItems.map(getSetItemKey).filter(Boolean).map(String));
    const toRelease = [...previousKeys].filter((key) => !nextKeys.has(key));
    const setLocation = String(parentItem?.location ?? '').trim();

    const findRowByKey = (key) => rows.find((row) => sameEquipmentKey(row, key));

    if (isSupabaseConfigured) {
      for (const key of nextKeys) {
        const row = findRowByKey(key);
        if (!row?.id) continue;
        const updatePayload = { status: EQUIPMENT_SET_COMPONENT_STATUS };
        if (setLocation) updatePayload.location = setLocation;
        const { error } = await updateEquipmentRecord(row.id, updatePayload);
        if (error) throw error;
      }
      for (const key of toRelease) {
        const row = findRowByKey(key);
        if (!row?.id) continue;
        const stillUsed = rows.some((candidate) => {
          if (!isEquipmentSet(candidate)) return false;
          if (parentItem && sameEquipmentKey(candidate, parentItem)) return false;
          return (candidate.set_items ?? []).some((setItem) => sameEquipmentKey(setItem, key));
        });
        if (stillUsed) continue;
        const { error } = await updateEquipmentRecord(row.id, { status: EQUIPMENT_AVAILABLE_STATUS, location: 'Magazyn' });
        if (error) throw error;
      }
      return;
    }

    setRows((current) => current.map((row) => {
      const key = String(getEquipmentKey(row) ?? '');
      if (nextKeys.has(key)) return { ...row, status: EQUIPMENT_SET_COMPONENT_STATUS, ...(setLocation ? { location: setLocation } : {}) };
      if (toRelease.includes(key)) return { ...row, status: EQUIPMENT_AVAILABLE_STATUS, location: 'Magazyn' };
      return row;
    }));
  };

  const handleSave = async (item) => {
    if (!item.name.trim()) {
      alert('Nazwa sprzętu jest wymagana.');
      return;
    }

    if (isEquipmentSetComponent(item)) {
      alert('Ten sprzęt jest składnikiem zestawu i nie może być edytowany bez usunięcia go z zestawu.');
      return;
    }

    const previousSetItems = editingEquipment?.set_items ?? [];
    const nextSetItems = item.category === EQUIPMENT_SET_CATEGORY ? item.set_items ?? [] : [];
    const payload = normalizePayload({ ...item, set_items: nextSetItems });

    try {
      if (isSupabaseConfigured) {
        const result = item.id ? await updateEquipmentRecord(item.id, payload) : await createEquipmentRecord(payload);
        if (result.error) {
          alert(result.error.message);
          return;
        }
        await updateSetComponentStatuses(previousSetItems, nextSetItems, result.data ?? item);
        await loadEquipment();
      } else {
        const savedItem = item.localId
          ? item
          : { ...item, localId: crypto.randomUUID() };
        setRows((current) => item.localId
          ? current.map((row) => row.localId === item.localId ? savedItem : row)
          : [savedItem, ...current]);
        await updateSetComponentStatuses(previousSetItems, nextSetItems, savedItem);
      }
      setEditorOpen(false);
    } catch (error) {
      alert(error.message ?? 'Nie udało się zapisać zestawu sprzętu.');
    }
  };

  const handleDelete = async (item) => {
    if (isEquipmentSetComponent(item)) {
      alert('Nie można usunąć składnika zestawu. Najpierw usuń go z zestawu.');
      return;
    }
    if (!confirm(`Usunąć sprzęt: ${item.name}?`)) return;
    try {
      if (isEquipmentSet(item)) await updateSetComponentStatuses(item.set_items ?? [], [], item);
    } catch (error) {
      alert(error.message ?? 'Nie udało się zwolnić składników zestawu.');
      return;
    }
    if (item.id && isSupabaseConfigured) {
      const { error } = await deleteEquipmentRecord(item.id);
      if (error) alert(error.message);
      await loadEquipment();
    } else {
      setRows((current) => current.filter((row) => row !== item));
    }
  };

  const handleBulkDelete = async (items) => {
    const locked = items.filter(isEquipmentSetComponent);
    if (locked.length) {
      alert(`Pominięto składniki zestawu, których nie można usunąć: ${locked.length}.`);
    }
    const selected = items.filter((item) => !isEquipmentSetComponent(item) && (item?.id || item?.localId || item?.name || item?.serial));
    if (!selected.length) return;
    if (!confirm(`Usunąć zaznaczone pozycje sprzętu: ${selected.length}?`)) return;

    if (isSupabaseConfigured) {
      for (const item of selected) {
        if (isEquipmentSet(item)) {
          try { await updateSetComponentStatuses(item.set_items ?? [], [], item); } catch (error) { alert(error.message); return; }
        }
      }
      for (const item of selected) {
        if (!item.id) continue;
        const { error } = await deleteEquipmentRecord(item.id);
        if (error) alert(error.message);
      }
      await loadEquipment();
      return;
    }

    for (const item of selected) {
      if (isEquipmentSet(item)) {
        try { await updateSetComponentStatuses(item.set_items ?? [], [], item); } catch (error) { alert(error.message); return; }
      }
    }
    setRows((current) => current.filter((row) => !selected.includes(row)));
  };


  const displayRows = useMemo(() => rows.filter((item) => !isEquipmentSetComponent(item)), [rows]);

  const renderSetContents = (setRow) => {
    const components = Array.isArray(setRow.set_items) ? setRow.set_items : [];
    if (!components.length) return <div className="expanded-set-empty">Ten zestaw nie ma jeszcze przypisanych składników.</div>;
    const resolveComponent = (setItem) => rows.find((row) => sameEquipmentKey(row, setItem)) ?? setItem;
    return <div className="expanded-set-panel">
      <div className="expanded-set-header"><strong>Zawartość zestawu</strong><span>{components.length} pozycji</span></div>
      <table className="expanded-set-table">
        <thead><tr><th>Kategoria</th><th>Nazwa</th><th>Marka</th><th>Model</th><th>Numer seryjny</th><th>Kod / Nr inw.</th><th>Status</th><th>Lokalizacja</th></tr></thead>
        <tbody>{components.map((setItem, index) => {
          const item = resolveComponent(setItem);
          return <tr key={`${getSetItemKey(setItem)}-${index}`}><td>{item.category || '—'}</td><td><strong>{item.name || '—'}</strong></td><td>{item.brand || '—'}</td><td>{item.model || '—'}</td><td>{item.serial || '—'}</td><td>{item.barcode || item.inventory_number || '—'}</td><td><StatusPill value={item.status || EQUIPMENT_SET_COMPONENT_STATUS} /></td><td>{item.location || '—'}</td></tr>;
        })}</tbody>
      </table>
    </div>;
  };

  return (
    <div className="module-page">
      <section className="panel hero-panel">
        <p className="eyebrow">Moduł</p><h2>Magazyn sprzętu</h2>
        <p className="muted">Kartoteka urządzeń, numery seryjne, kody, lokalizacje, statusy i przygotowanie pod zestawy oraz wypożyczenia.</p>
        <div className="module-actions">
          <button className="primary-button" onClick={() => openEquipmentEditor(null)}><Plus size={18} />Dodaj sprzęt</button>
          <button className="secondary-button" onClick={openSetEditor}><Package size={18} />Dodaj zestaw</button>
          <button className="secondary-button" onClick={loadEquipment}>Odśwież</button>
          <button className="secondary-button">Eksport PDF</button>
          <button className="secondary-button">Ustawienia modułu</button>
        </div>
        {notice && <div className="notice">{notice}</div>}
      </section>
      <section className="panel">
        <DataTable storageKey="equipment-table" loading={loading} columns={[
          { key: 'item_type', label: 'Typ' },
          { key: 'name', label: 'Nazwa' },
          { key: 'category', label: 'Kategoria' },
          { key: 'brand', label: 'Marka' },
          { key: 'model', label: 'Model' },
          { key: 'serial', label: 'Numer seryjny' },
          { key: 'inventory_number', label: 'Nr inw.' },
          { key: 'status', label: 'Status' },
          { key: 'location', label: 'Lokalizacja' },
          { key: 'set_items_count', label: 'Składniki' }
        ]} rows={displayRows.map((item) => ({ ...item, item_type: isEquipmentSet(item) ? 'Zestaw' : 'Sprzęt', set_items_count: Array.isArray(item.set_items) && item.set_items.length ? item.set_items.length : '' }))} onOpen={openEquipmentEditor} onEdit={openEquipmentEditor} onDuplicate={duplicateEquipment} onDelete={handleDelete} onBulkDelete={handleBulkDelete} isRowLocked={isEquipmentSetComponent} isRowExpandable={isEquipmentSet} renderExpandedRow={renderSetContents} />
      </section>
      {editorOpen && <EquipmentEditor equipment={editingEquipment} equipmentRows={rows} categories={equipmentCategories} statuses={equipmentStatuses} onClose={() => setEditorOpen(false)} onSave={handleSave} />}
    </div>
  );
}

const EQUIPMENT_CARD_MARKER = '__fixerEquipmentCard';

function parseEquipmentCardNotes(notes) {
  const raw = String(notes ?? '').trim();
  const fallback = {
    description: raw,
    condition: 'Bardzo dobry',
    purchase_value: '',
    deposit: '',
    price_day: '',
    price_week: '',
    gallery: [],
    attachments: [],
    set_items: [],
    service_notes: '',
    history_notes: ''
  };

  if (!raw) return fallback;

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || parsed[EQUIPMENT_CARD_MARKER] !== 1) return fallback;
    return {
      description: parsed.description ?? '',
      condition: parsed.condition ?? 'Bardzo dobry',
      purchase_value: parsed.purchase_value ?? '',
      deposit: parsed.deposit ?? '',
      price_day: parsed.price_day ?? '',
      price_week: parsed.price_week ?? '',
      gallery: Array.isArray(parsed.gallery) ? parsed.gallery : [],
      attachments: Array.isArray(parsed.attachments) ? parsed.attachments : [],
      set_items: Array.isArray(parsed.set_items) ? parsed.set_items : [],
      service_notes: parsed.service_notes ?? '',
      history_notes: parsed.history_notes ?? ''
    };
  } catch {
    return fallback;
  }
}

function buildEquipmentCardNotes(form) {
  return JSON.stringify({
    [EQUIPMENT_CARD_MARKER]: 1,
    description: form.description ?? '',
    condition: form.condition ?? 'Bardzo dobry',
    purchase_value: form.purchase_value ?? '',
    deposit: form.deposit ?? '',
    price_day: form.price_day ?? '',
    price_week: form.price_week ?? '',
    gallery: Array.isArray(form.gallery) ? form.gallery : [],
    attachments: Array.isArray(form.attachments) ? form.attachments : [],
    set_items: Array.isArray(form.set_items) ? form.set_items : [],
    service_notes: form.service_notes ?? '',
    history_notes: form.history_notes ?? ''
  });
}


const EQUIPMENT_MODAL_SIZE_KEY = 'fixer-equipment-modal-size';
const EQUIPMENT_MODAL_POSITION_KEY = 'fixer-equipment-modal-position';
const DEFAULT_EQUIPMENT_MODAL_SIZE = { width: 1120, height: 720 };
const MIN_EQUIPMENT_MODAL_SIZE = { width: 860, height: 560 };
const EQUIPMENT_MODAL_SCREEN_MARGIN = 16;

function clampEquipmentModalSize(size) {
  if (typeof window === 'undefined') return size;
  const maxWidth = Math.max(MIN_EQUIPMENT_MODAL_SIZE.width, window.innerWidth - 32);
  const maxHeight = Math.max(MIN_EQUIPMENT_MODAL_SIZE.height, window.innerHeight - 32);
  return {
    width: Math.min(Math.max(size.width, MIN_EQUIPMENT_MODAL_SIZE.width), maxWidth),
    height: Math.min(Math.max(size.height, MIN_EQUIPMENT_MODAL_SIZE.height), maxHeight)
  };
}

function getSavedEquipmentModalSize() {
  if (typeof window === 'undefined') return DEFAULT_EQUIPMENT_MODAL_SIZE;
  try {
    const parsed = JSON.parse(localStorage.getItem(EQUIPMENT_MODAL_SIZE_KEY) || 'null');
    if (parsed && Number.isFinite(parsed.width) && Number.isFinite(parsed.height)) {
      return clampEquipmentModalSize(parsed);
    }
  } catch {}
  return clampEquipmentModalSize(DEFAULT_EQUIPMENT_MODAL_SIZE);
}

function getCenteredEquipmentModalPosition(size) {
  if (typeof window === 'undefined') return { left: EQUIPMENT_MODAL_SCREEN_MARGIN, top: EQUIPMENT_MODAL_SCREEN_MARGIN };
  return {
    left: Math.max(EQUIPMENT_MODAL_SCREEN_MARGIN, Math.round((window.innerWidth - size.width) / 2)),
    top: Math.max(EQUIPMENT_MODAL_SCREEN_MARGIN, Math.round((window.innerHeight - size.height) / 2))
  };
}

function clampEquipmentModalPosition(position, size) {
  if (typeof window === 'undefined') return position;
  const maxLeft = Math.max(EQUIPMENT_MODAL_SCREEN_MARGIN, window.innerWidth - size.width - EQUIPMENT_MODAL_SCREEN_MARGIN);
  const maxTop = Math.max(EQUIPMENT_MODAL_SCREEN_MARGIN, window.innerHeight - size.height - EQUIPMENT_MODAL_SCREEN_MARGIN);
  return {
    left: Math.min(Math.max(position.left, EQUIPMENT_MODAL_SCREEN_MARGIN), maxLeft),
    top: Math.min(Math.max(position.top, EQUIPMENT_MODAL_SCREEN_MARGIN), maxTop)
  };
}

function getSavedEquipmentModalPosition(size) {
  if (typeof window === 'undefined') return getCenteredEquipmentModalPosition(size);
  try {
    const parsed = JSON.parse(localStorage.getItem(EQUIPMENT_MODAL_POSITION_KEY) || 'null');
    if (parsed && Number.isFinite(parsed.left) && Number.isFinite(parsed.top)) {
      return clampEquipmentModalPosition(parsed, size);
    }
  } catch {}
  return clampEquipmentModalPosition(getCenteredEquipmentModalPosition(size), size);
}

function EquipmentEditor({ equipment, equipmentRows = [], categories = getLocalEquipmentDictionaryNames('category'), statuses = getLocalEquipmentDictionaryNames('status'), onClose, onSave }) {
  const cardData = parseEquipmentCardNotes(equipment?.notes);
  const isInitialSetCard = equipment?.category === EQUIPMENT_SET_CATEGORY || Array.isArray(equipment?.set_items) && equipment.set_items.length > 0;
  const [activeTab, setActiveTab] = useState('basic');
  const [errors, setErrors] = useState({});
  const [modalSize, setModalSize] = useState(getSavedEquipmentModalSize);
  const [modalPosition, setModalPosition] = useState(() => getSavedEquipmentModalPosition(getSavedEquipmentModalSize()));
  const modalSizeRef = useRef(modalSize);
  const modalPositionRef = useRef(modalPosition);
  const resizeStateRef = useRef(null);
  const dragStateRef = useRef(null);
  const [newGalleryItem, setNewGalleryItem] = useState('');
  const [newAttachmentName, setNewAttachmentName] = useState('');
  const [newAttachmentUrl, setNewAttachmentUrl] = useState('');
  const [setPickerOpen, setSetPickerOpen] = useState(false);
  const [form, setForm] = useState(() => ({
    id: equipment?.id ?? null,
    localId: equipment?.localId ?? null,
    name: equipment?.name ?? '',
    category: isInitialSetCard ? EQUIPMENT_SET_CATEGORY : equipment?.category ?? categories[0] ?? 'Kamera',
    brand: isInitialSetCard ? '' : equipment?.brand ?? '',
    model: isInitialSetCard ? '' : equipment?.model ?? '',
    serial: equipment?.serial ?? '',
    inventory_number: equipment?.inventory_number ?? '',
    barcode: equipment?.barcode ?? equipment?.serial ?? '',
    status: isInitialSetCard ? getEquipmentSetStatus(equipment?.set_items ?? cardData.set_items) : equipment?.status ?? statuses[0] ?? 'Dostępny',
    location: equipment?.location ?? 'Magazyn',
    purchase_date: equipment?.purchase_date ?? '',
    condition: equipment?.condition ?? cardData.condition,
    purchase_value: isInitialSetCard ? '' : equipment?.purchase_value ?? cardData.purchase_value,
    deposit: isInitialSetCard ? '' : equipment?.deposit ?? cardData.deposit,
    price_day: isInitialSetCard ? '' : equipment?.price_day ?? cardData.price_day,
    price_week: isInitialSetCard ? '' : equipment?.price_week ?? cardData.price_week,
    description: equipment?.description ?? cardData.description,
    gallery: isInitialSetCard ? [] : Array.isArray(equipment?.gallery) ? equipment.gallery : cardData.gallery,
    attachments: isInitialSetCard ? [] : Array.isArray(equipment?.attachments) ? equipment.attachments : cardData.attachments,
    set_items: Array.isArray(equipment?.set_items) ? equipment.set_items : cardData.set_items,
    service_notes: isInitialSetCard ? '' : equipment?.service_notes ?? cardData.service_notes,
    history_notes: isInitialSetCard ? '' : equipment?.history_notes ?? cardData.history_notes
  }));

  const isSetCard = form.category === EQUIPMENT_SET_CATEGORY;
  const calculatedSetStatus = isSetCard ? getEquipmentSetStatus(form.set_items) : form.status;
  const setItemKeys = useMemo(() => new Set((form.set_items ?? []).map(getSetItemKey).filter(Boolean).map(String)), [form.set_items]);
  const availableSetComponents = useMemo(() => equipmentRows.filter((item) => {
    if (sameEquipmentKey(item, form)) return false;
    if (isEquipmentSet(item)) return false;
    if (isEquipmentSetComponent(item) && !setItemKeys.has(String(getEquipmentKey(item)))) return false;
    if (setItemKeys.has(String(getEquipmentKey(item)))) return false;
    if (isItemUsedInOtherSet(item, equipmentRows, form)) return false;
    return true;
  }), [equipmentRows, form, setItemKeys]);

  const safeStatuses = statuses.includes(EQUIPMENT_SET_COMPONENT_STATUS) ? statuses : [...statuses, EQUIPMENT_SET_COMPONENT_STATUS];

  const update = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const addGalleryItem = () => {
    const value = newGalleryItem.trim();
    if (!value) return;
    update('gallery', [...form.gallery, value]);
    setNewGalleryItem('');
  };

  const removeGalleryItem = (index) => {
    update('gallery', form.gallery.filter((_, itemIndex) => itemIndex !== index));
  };

  const addAttachment = () => {
    const name = newAttachmentName.trim();
    const url = newAttachmentUrl.trim();
    if (!name && !url) return;
    update('attachments', [...form.attachments, { name: name || url, url }]);
    setNewAttachmentName('');
    setNewAttachmentUrl('');
  };

  const removeAttachment = (index) => {
    update('attachments', form.attachments.filter((_, itemIndex) => itemIndex !== index));
  };

  const addSetItems = (items) => {
    const existingKeys = new Set((form.set_items ?? []).map(getSetItemKey).filter(Boolean).map(String));
    const nextItems = items
      .filter((item) => !existingKeys.has(String(getEquipmentKey(item))))
      .map(normalizeSetItemFromEquipment);
    if (!nextItems.length) return;
    update('set_items', [...form.set_items, ...nextItems]);
  };

  const removeSetItem = (index) => {
    const item = form.set_items[index];
    const itemName = item?.name || 'wybrany składnik';
    if (!confirm(`Usunąć składnik „${itemName}” z zestawu? Po zapisaniu sprzęt wróci do magazynu ze statusem „${EQUIPMENT_AVAILABLE_STATUS}”.`)) return;
    update('set_items', form.set_items.filter((_, itemIndex) => itemIndex !== index));
  };

  const saveEquipment = () => {
    const nextErrors = {};
    if (!form.name.trim()) nextErrors.name = isSetCard ? 'Nazwa zestawu jest wymagana.' : 'Nazwa sprzętu jest wymagana.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setActiveTab('basic');
      return;
    }

    onSave({
      id: form.id,
      localId: form.localId,
      name: form.name.trim(),
      category: isSetCard ? EQUIPMENT_SET_CATEGORY : form.category,
      brand: isSetCard ? '' : form.brand.trim(),
      model: isSetCard ? '' : form.model.trim(),
      serial: form.serial.trim(),
      inventory_number: form.inventory_number.trim(),
      barcode: form.barcode.trim(),
      status: isSetCard ? calculatedSetStatus : form.status,
      location: form.location.trim(),
      purchase_date: isSetCard ? '' : form.purchase_date,
      notes: buildEquipmentCardNotes({
        ...form,
        category: isSetCard ? EQUIPMENT_SET_CATEGORY : form.category,
        status: isSetCard ? calculatedSetStatus : form.status,
        brand: isSetCard ? '' : form.brand,
        model: isSetCard ? '' : form.model,
        purchase_value: isSetCard ? '' : form.purchase_value,
        deposit: isSetCard ? '' : form.deposit,
        price_day: isSetCard ? '' : form.price_day,
        price_week: isSetCard ? '' : form.price_week,
        gallery: isSetCard ? [] : form.gallery,
        attachments: isSetCard ? [] : form.attachments,
        service_notes: isSetCard ? '' : form.service_notes,
        history_notes: isSetCard ? '' : form.history_notes
      }),
      description: form.description,
      condition: form.condition,
      purchase_value: isSetCard ? '' : form.purchase_value,
      deposit: isSetCard ? '' : form.deposit,
      price_day: isSetCard ? '' : form.price_day,
      price_week: isSetCard ? '' : form.price_week,
      gallery: isSetCard ? [] : form.gallery,
      attachments: isSetCard ? [] : form.attachments,
      set_items: isSetCard ? form.set_items.map((item) => ({ ...item, location: form.location.trim() || item.location || 'Magazyn' })) : [],
      service_notes: isSetCard ? '' : form.service_notes,
      history_notes: isSetCard ? '' : form.history_notes
    });
  };

  const fieldClass = (key) => errors[key] ? 'field-error' : undefined;

  useEffect(() => {
    modalSizeRef.current = modalSize;
    localStorage.setItem(EQUIPMENT_MODAL_SIZE_KEY, JSON.stringify(modalSize));
    setModalPosition((current) => clampEquipmentModalPosition(current, modalSize));
  }, [modalSize]);

  useEffect(() => {
    modalPositionRef.current = modalPosition;
    localStorage.setItem(EQUIPMENT_MODAL_POSITION_KEY, JSON.stringify(modalPosition));
  }, [modalPosition]);

  useEffect(() => {
    const handleWindowResize = () => {
      setModalSize((current) => clampEquipmentModalSize(current));
      setModalPosition((current) => clampEquipmentModalPosition(current, modalSizeRef.current));
    };
    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, []);

  useEffect(() => {
    const handlePointerMove = (event) => {
      const resizeState = resizeStateRef.current;
      if (resizeState) {
        event.preventDefault();
        setModalSize(clampEquipmentModalSize({
          width: resizeState.startWidth + event.clientX - resizeState.startX,
          height: resizeState.startHeight + event.clientY - resizeState.startY
        }));
        return;
      }
      const dragState = dragStateRef.current;
      if (!dragState) return;
      event.preventDefault();
      setModalPosition(clampEquipmentModalPosition({
        left: dragState.startLeft + event.clientX - dragState.startX,
        top: dragState.startTop + event.clientY - dragState.startY
      }, modalSizeRef.current));
    };
    const handlePointerUp = () => {
      resizeStateRef.current = null;
      dragStateRef.current = null;
    };
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, []);

  const startResize = (event) => {
    event.preventDefault();
    event.stopPropagation();
    resizeStateRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      startWidth: modalSizeRef.current.width,
      startHeight: modalSizeRef.current.height
    };
  };

  const startDrag = (event) => {
    if (event.target.closest('button, input, select, textarea, a')) return;
    event.preventDefault();
    dragStateRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      startLeft: modalPositionRef.current.left,
      startTop: modalPositionRef.current.top
    };
  };

  const tabs = [
    { id: 'basic', label: 'Dane podstawowe' },
    { id: 'gallery', label: 'Galeria' },
    { id: 'attachments', label: 'Załączniki' },
    { id: 'history', label: 'Historia' },
    { id: 'service', label: 'Serwis' },
    { id: 'relations', label: 'Powiązania / Zestawy' }
  ];

  if (isSetCard) {
    return (
      <div className="modal-backdrop draggable-modal-backdrop">
        <div className="modal-card equipment-card-modal set-card-modal resizable-equipment-modal draggable-equipment-modal" style={{ width: `${modalSize.width}px`, height: `${modalSize.height}px`, left: `${modalPosition.left}px`, top: `${modalPosition.top}px` }}>
          <div className="modal-header draggable-modal-header" onPointerDown={startDrag}>
            <div>
              <p className="eyebrow">Zestaw sprzętu</p>
              <h2>Karta zestawu</h2>
              <p className="muted">Definicja zestawu składającego się z wielu urządzeń magazynowych.</p>
            </div>
            <button className="icon-button" onClick={onClose}><X size={18} /></button>
          </div>

          <div className="set-card-content">
            <div className="equipment-section-panel set-details-panel">
              <div className="section-title">Dane zestawu</div>
              <div className="set-basic-grid">
                <label className="set-name-field">Nazwa zestawu *<input className={fieldClass('name')} value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="np. Walizka streamingowa" />{errors.name && <span className="field-hint">{errors.name}</span>}</label>
                <label>Numer seryjny<input value={form.serial} onChange={(event) => update('serial', event.target.value)} placeholder="opcjonalnie" /></label>
                <label>Kod kreskowy / QR<input value={form.barcode} onChange={(event) => update('barcode', event.target.value)} placeholder="opcjonalnie" /></label>
                <label>Status<input value={calculatedSetStatus} readOnly className="readonly-input" /></label>
                <label>Lokalizacja<select value={form.location} onChange={(event)=>update('location', event.target.value)}>{(equipmentLocations?.length?equipmentLocations:['Magazyn']).map(location=><option key={location} value={location}>{location}</option>)}</select></label>
                <label>Stan techniczny<select value={form.condition} onChange={(event) => update('condition', event.target.value)}><option>Nowy</option><option>Bardzo dobry</option><option>Dobry</option><option>Do kontroli</option><option>Uszkodzony</option><option>Wycofany</option></select></label>
                <label className="set-description-field">Opis zestawu<textarea value={form.description} onChange={(event) => update('description', event.target.value)} placeholder="Krótki opis, przeznaczenie lub zawartość zestawu." /></label>
              </div>
            </div>

            <div className="equipment-section-panel set-builder-panel set-card-components-panel">
              <div className="set-builder-header">
                <div>
                  <div className="section-title">Składniki zestawu</div>
                  <p className="muted">Składniki wybierasz z magazynu. Po zapisaniu zostaną zablokowane jako „Składnik zestawu”.</p>
                </div>
                <div className="set-card-action-row">
                  <button type="button" className="secondary-button compact-table-button" onClick={() => setSetPickerOpen(true)}><Plus size={15} />Dodaj składniki</button>
                </div>
              </div>
              {form.set_items.length ? <div className="set-components-table-shell">
                <table className="set-components-table">
                  <thead><tr><th>Nazwa</th><th>Kategoria</th><th>Marka</th><th>Model</th><th>Numer seryjny</th><th>Kod / Nr inw.</th><th>Status</th><th>Lokalizacja</th><th></th></tr></thead>
                  <tbody>{form.set_items.map((item, index) => <tr key={`${getSetItemKey(item)}-${index}`}><td><strong>{item.name}</strong></td><td>{item.category || '—'}</td><td>{item.brand || '—'}</td><td>{item.model || '—'}</td><td>{item.serial || '—'}</td><td>{item.barcode || item.inventory_number || '—'}</td><td><StatusPill value={item.status || EQUIPMENT_SET_COMPONENT_STATUS} /></td><td>{item.location || '—'}</td><td><button type="button" className="ghost-mini-button" onClick={() => removeSetItem(index)}>Usuń</button></td></tr>)}</tbody>
                </table>
              </div> : <div className="empty-set-box">Brak składników zestawu. Użyj przycisku „Dodaj składniki”, żeby wybrać pozycje z magazynu.</div>}
            </div>
          </div>

          <div className="modal-actions"><button className="secondary-button" onClick={onClose}>Anuluj</button><button className="primary-button" onClick={saveEquipment}><Save size={18} />Zapisz zestaw</button></div>
          <div className="modal-resize-handle" onPointerDown={startResize} title="Zmień rozmiar okna" aria-label="Zmień rozmiar okna" />
        </div>
        {setPickerOpen && <EquipmentSetPicker availableItems={availableSetComponents} onClose={() => setSetPickerOpen(false)} onConfirm={(items) => { addSetItems(items); setSetPickerOpen(false); }} />}
      </div>
    );
  }

  return (
    <div className="modal-backdrop draggable-modal-backdrop">
      <div className="modal-card equipment-card-modal resizable-equipment-modal draggable-equipment-modal" style={{ width: `${modalSize.width}px`, height: `${modalSize.height}px`, left: `${modalPosition.left}px`, top: `${modalPosition.top}px` }}>
        <div className="modal-header draggable-modal-header" onPointerDown={startDrag}>
          <div>
            <p className="eyebrow">Sprzęt</p>
            <h2>Karta sprzętu</h2>
            <p className="muted">Dodawanie i edycja urządzenia w module Sprzęt.</p>
          </div>
          <button className="icon-button" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="equipment-tabs" role="tablist" aria-label="Sekcje karty sprzętu">
          {tabs.map((tab) => (
            <button key={tab.id} type="button" className={activeTab === tab.id ? 'active' : ''} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>
          ))}
        </div>

        <div className="equipment-tab-panel">
          {activeTab === 'basic' && <div className="equipment-basic-grid">
            <label className="equipment-name-field">Nazwa sprzętu *<input className={fieldClass('name')} value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="np. Mikser Video" />{errors.name && <span className="field-hint">{errors.name}</span>}</label>
            <label>Marka<input value={form.brand} onChange={(event) => update('brand', event.target.value)} placeholder="np. Blackmagic" /></label>
            <label>Model<input value={form.model} onChange={(event) => update('model', event.target.value)} placeholder="np. ATEM Mini Pro" /></label>
            <label>Numer seryjny<input value={form.serial} onChange={(event) => update('serial', event.target.value)} /></label>
            <label>Kod kreskowy / QR<input value={form.barcode} onChange={(event) => update('barcode', event.target.value)} /></label>
            <label>Kategoria<select value={form.category} onChange={(event) => update('category', event.target.value)}>{categories.filter((option) => option !== EQUIPMENT_SET_CATEGORY).map((option) => <option key={option}>{option}</option>)}</select></label>
            <label>Status<select value={form.status} onChange={(event) => update('status', event.target.value)}>{safeStatuses.map((option) => <option key={option}>{option}</option>)}</select></label>
            <label>Stan techniczny<select value={form.condition} onChange={(event) => update('condition', event.target.value)}><option>Nowy</option><option>Bardzo dobry</option><option>Dobry</option><option>Do kontroli</option><option>Uszkodzony</option><option>Wycofany</option></select></label>
            <label>Lokalizacja<input value={form.location} onChange={(event) => update('location', event.target.value)} placeholder="np. Szafka Magazyn" /></label>
            <label>Wartość zakupu<input value={form.purchase_value} onChange={(event) => update('purchase_value', event.target.value)} placeholder="np. 2500" /></label>
            <label>Kaucja<input value={form.deposit} onChange={(event) => update('deposit', event.target.value)} placeholder="np. 500" /></label>
            <label>Cena / dzień<input value={form.price_day} onChange={(event) => update('price_day', event.target.value)} placeholder="np. 120" /></label>
            <label>Cena / tydzień<input value={form.price_week} onChange={(event) => update('price_week', event.target.value)} placeholder="np. 600" /></label>
            <label className="equipment-description-field">Opis / zawartość zestawu<textarea value={form.description} onChange={(event) => update('description', event.target.value)} /></label>
          </div>}

          {activeTab === 'gallery' && <div className="equipment-section-panel">
            <div className="section-title">Galeria sprzętu</div>
            <div className="inline-add-row"><input value={newGalleryItem} onChange={(event) => setNewGalleryItem(event.target.value)} placeholder="Adres zdjęcia lub opis zdjęcia" /><button type="button" className="secondary-button compact-table-button" onClick={addGalleryItem}>Dodaj</button></div>
            <div className="equipment-list-box">
              {form.gallery.length ? form.gallery.map((item, index) => <div key={`${item}-${index}`} className="equipment-list-row"><span>{item}</span><button type="button" className="ghost-mini-button" onClick={() => removeGalleryItem(index)}>Usuń</button></div>) : <p className="muted">Brak zdjęć w galerii.</p>}
            </div>
          </div>}

          {activeTab === 'attachments' && <div className="equipment-section-panel">
            <div className="section-title">Załączniki</div>
            <div className="attachment-add-grid"><input value={newAttachmentName} onChange={(event) => setNewAttachmentName(event.target.value)} placeholder="Nazwa załącznika" /><input value={newAttachmentUrl} onChange={(event) => setNewAttachmentUrl(event.target.value)} placeholder="Link lub numer dokumentu" /><button type="button" className="secondary-button compact-table-button" onClick={addAttachment}>Dodaj</button></div>
            <div className="equipment-list-box">
              {form.attachments.length ? form.attachments.map((item, index) => <div key={`${item.name}-${index}`} className="equipment-list-row"><span><strong>{item.name}</strong>{item.url ? ` — ${item.url}` : ''}</span><button type="button" className="ghost-mini-button" onClick={() => removeAttachment(index)}>Usuń</button></div>) : <p className="muted">Brak załączników.</p>}
            </div>
          </div>}

          {activeTab === 'history' && <div className="equipment-section-panel">
            <div className="section-title">Historia sprzętu</div>
            <textarea className="large-notes" value={form.history_notes} onChange={(event) => update('history_notes', event.target.value)} placeholder="Historia wypożyczeń, zmian lokalizacji, uwagi magazynowe." />
          </div>}

          {activeTab === 'service' && <div className="equipment-section-panel">
            <div className="section-title">Serwis</div>
            <textarea className="large-notes" value={form.service_notes} onChange={(event) => update('service_notes', event.target.value)} placeholder="Historia napraw, przeglądów, usterek i zaleceń serwisowych." />
          </div>}

          {activeTab === 'relations' && <div className="equipment-section-panel">
            <div className="section-title">Powiązania / zestawy</div>
            <div className="notice">Ten ekran służy do sprzętu pojedynczego. Zestawy tworzy się przez przycisk „Dodaj zestaw” w module Sprzęt.</div>
          </div>}
        </div>

        <div className="modal-actions"><button className="secondary-button" onClick={onClose}>Anuluj</button><button className="primary-button" onClick={saveEquipment}><Save size={18} />Zapisz sprzęt</button></div>
        <div className="modal-resize-handle" onPointerDown={startResize} title="Zmień rozmiar okna" aria-label="Zmień rozmiar okna" />
      </div>
    </div>
  );
}

function EquipmentSetPicker({ availableItems, onClose, onConfirm }) {
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [selectedKeys, setSelectedKeys] = useState(() => new Set());

  const categories = useMemo(() => [...new Set(availableItems.map((item) => item.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pl')), [availableItems]);
  const statuses = useMemo(() => [...new Set(availableItems.map((item) => item.status).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pl')), [availableItems]);
  const locations = useMemo(() => [...new Set(availableItems.map((item) => item.location).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pl')), [availableItems]);

  const filteredItems = useMemo(() => {
    const text = query.trim().toLocaleLowerCase('pl');
    return availableItems.filter((item) => {
      const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      const matchesLocation = locationFilter === 'all' || item.location === locationFilter;
      const searchable = [item.name, item.category, item.brand, item.model, item.serial, item.inventory_number, item.barcode, item.location, item.status].filter(Boolean).join(' ').toLocaleLowerCase('pl');
      return matchesCategory && matchesStatus && matchesLocation && (!text || searchable.includes(text));
    });
  }, [availableItems, query, categoryFilter, statusFilter, locationFilter]);

  const selectedItems = availableItems.filter((item) => selectedKeys.has(String(getEquipmentKey(item))));
  const visibleAllSelected = filteredItems.length > 0 && filteredItems.every((item) => selectedKeys.has(String(getEquipmentKey(item))));

  const toggleItem = (item) => {
    const key = String(getEquipmentKey(item));
    setSelectedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleVisible = () => {
    setSelectedKeys((current) => {
      const next = new Set(current);
      filteredItems.forEach((item) => {
        const key = String(getEquipmentKey(item));
        if (visibleAllSelected) next.delete(key);
        else next.add(key);
      });
      return next;
    });
  };

  const clearFilters = () => {
    setQuery('');
    setCategoryFilter('all');
    setStatusFilter('all');
    setLocationFilter('all');
  };

  return <div className="nested-modal-backdrop">
    <div className="modal-card set-picker-modal">
      <div className="modal-header">
        <div><p className="eyebrow">Zestaw sprzętu</p><h2>Wybierz składniki z magazynu</h2><p className="muted">Możesz zaznaczyć wiele pozycji jednocześnie, użyć wyszukiwania i filtrów.</p></div>
        <button className="icon-button" onClick={onClose}><X size={18} /></button>
      </div>
      <div className="set-picker-filters">
        <label>Szukaj<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nazwa, marka, model, SN, kod" autoFocus /></label>
        <label>Kategoria<select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="all">Wszystkie</option>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <label>Status<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">Wszystkie</option>{statuses.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <label>Lokalizacja<select value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)}><option value="all">Wszystkie</option>{locations.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <button type="button" className="secondary-button compact-table-button" onClick={clearFilters}>Wyczyść</button>
      </div>
      <div className="set-picker-summary"><strong>{selectedItems.length} zaznaczono</strong><span>{filteredItems.length} / {availableItems.length} dostępnych pozycji</span></div>
      <div className="set-picker-table-shell">
        <table className="set-picker-table">
          <thead><tr><th className="selection-cell"><input type="checkbox" checked={visibleAllSelected} onChange={toggleVisible} /></th><th>Nazwa</th><th>Kategoria</th><th>Marka</th><th>Model</th><th>Numer seryjny</th><th>Status</th><th>Lokalizacja</th></tr></thead>
          <tbody>{filteredItems.map((item) => {
            const key = String(getEquipmentKey(item));
            const selected = selectedKeys.has(key);
            return <tr key={key} className={selected ? 'selected-row' : ''} onDoubleClick={() => toggleItem(item)}><td className="selection-cell"><input type="checkbox" checked={selected} onChange={() => toggleItem(item)} /></td><td><strong>{item.name}</strong></td><td>{item.category || '—'}</td><td>{item.brand || '—'}</td><td>{item.model || '—'}</td><td>{item.serial || '—'}</td><td><StatusPill value={item.status} /></td><td>{item.location || '—'}</td></tr>;
          })}</tbody>
        </table>
        {!filteredItems.length && <div className="empty-set-box">Brak pozycji spełniających aktualne filtry.</div>}
      </div>
      <div className="modal-actions"><button className="secondary-button" onClick={onClose}>Anuluj</button><button className="primary-button" onClick={() => onConfirm(selectedItems)} disabled={!selectedItems.length}><Plus size={16} />Dodaj zaznaczone</button></div>
    </div>
  </div>;
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
function SettingsModule({ colorTheme, onChangeColorTheme }) {
  return <div className="module-page settings-module-page compact-settings-page">
    <SettingsGrid colorTheme={colorTheme} onChangeColorTheme={onChangeColorTheme} />
  </div>;
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

const COMPANY_PROFILE_STORAGE_KEY = 'fixer-company-profile';
const DEFAULT_COMPANY_PROFILE = {
  name: '',
  legalName: '',
  nip: '',
  regon: '',
  street: '',
  buildingNumber: '',
  apartmentNumber: '',
  postalCode: '',
  city: '',
  country: 'Polska',
  phone: '',
  email: '',
  website: '',
  bankAccount: '',
  documentFooter: '',
  logoDataUrl: ''
};

function getCompanyProfile() {
  return { ...DEFAULT_COMPANY_PROFILE, ...getStoredJson(COMPANY_PROFILE_STORAGE_KEY, DEFAULT_COMPANY_PROFILE) };
}

function saveCompanyProfile(profile) {
  const nextProfile = { ...DEFAULT_COMPANY_PROFILE, ...profile };
  localStorage.setItem(COMPANY_PROFILE_STORAGE_KEY, JSON.stringify(nextProfile));
  return nextProfile;
}

function formatCompanyAddress(profile) {
  const line1 = [profile.street, profile.buildingNumber, profile.apartmentNumber ? `/${profile.apartmentNumber}` : ''].filter(Boolean).join(' ');
  const line2 = [profile.postalCode, profile.city].filter(Boolean).join(' ');
  return [line1, line2, profile.country].filter(Boolean).join(', ');
}

function formatCompanyTaxData(profile) {
  return [profile.nip ? `NIP: ${profile.nip}` : '', profile.regon ? `REGON: ${profile.regon}` : ''].filter(Boolean).join(' · ');
}

function formatCompanyContact(profile) {
  return [profile.phone, profile.email, profile.website].filter(Boolean).join(' · ');
}

function DataTable({ columns, rows, storageKey, loading = false, onOpen, onEdit, onDuplicate, onHistory, onDelete, onBulkDelete, customRowActions = [], isRowLocked = null, isRowExpandable = null, renderExpandedRow = null }) {
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
  const [selectedRowKeys, setSelectedRowKeys] = useState(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [expandedRowKeys, setExpandedRowKeys] = useState(() => new Set());

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

  const getRowKey = (row, index) => String(row.id ?? row.localId ?? row.number ?? row.name ?? index);
  const selectedRows = sortedRows.filter((row, index) => selectedRowKeys.has(getRowKey(row, index)));
  const allVisibleSelected = sortedRows.length > 0 && sortedRows.every((row, index) => selectedRowKeys.has(getRowKey(row, index)));
  const hasSelectionActions = true;
  const hasExpandableRows = Boolean(isRowExpandable && renderExpandedRow);

  useEffect(() => {
    setSelectedRowKeys((current) => {
      if (!current.size) return current;
      const available = new Set(sortedRows.map((row, index) => getRowKey(row, index)));
      const next = new Set([...current].filter((key) => available.has(key)));
      return next.size === current.size ? current : next;
    });
  }, [sortedRows]);

  useEffect(() => {
    if (!hasExpandableRows) return undefined;
    setExpandedRowKeys((current) => {
      if (!current.size) return current;
      const available = new Set(sortedRows.map((row, index) => getRowKey(row, index)));
      const next = new Set([...current].filter((key) => available.has(key)));
      return next.size === current.size ? current : next;
    });
    return undefined;
  }, [sortedRows, hasExpandableRows]);

  const orderedColumns = useMemo(() => {
    const columnMap = new Map(columns.map((column) => [column.key, column]));
    return columnOrder.map((key) => columnMap.get(key)).filter(Boolean);
  }, [columns, columnOrder]);

  const activeColumns = orderedColumns.filter((column) => visibleColumns.includes(column.key));
  const hasActions = Boolean(onOpen || onEdit || onDuplicate || onHistory || onDelete || customRowActions.length);

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

  const toggleRowSelection = (row, index) => {
    const key = getRowKey(row, index);
    setSelectedRowKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleAllVisibleRows = () => {
    setSelectedRowKeys((current) => {
      const next = new Set(current);
      if (allVisibleSelected) {
        sortedRows.forEach((row, index) => next.delete(getRowKey(row, index)));
      } else {
        sortedRows.forEach((row, index) => next.add(getRowKey(row, index)));
      }
      return next;
    });
  };

  const clearSelection = () => setSelectedRowKeys(new Set());

  const toggleExpandedRow = (row, index) => {
    if (!hasExpandableRows || !isRowExpandable?.(row)) return;
    const key = getRowKey(row, index);
    setExpandedRowKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const runBulkDelete = async () => {
    if (!selectedRows.length || !onBulkDelete) return;
    setBulkBusy(true);
    try {
      await onBulkDelete(selectedRows);
      clearSelection();
    } finally {
      setBulkBusy(false);
    }
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
    const locked = typeof isRowLocked === 'function' ? isRowLocked(row) : false;
    if (locked && ['open', 'edit', 'duplicate', 'delete'].includes(action)) {
      alert('Ta pozycja jest składnikiem zestawu. Operacje są zablokowane do czasu usunięcia jej z zestawu.');
      return;
    }
    if (action === 'open') (onOpen ?? onEdit)?.(row);
    if (action === 'edit') onEdit?.(row);
    if (action === 'duplicate') onDuplicate?.(row);
    if (action === 'history') onHistory?.(row);
    if (action === 'copyName') copyText(row.name ?? row.number ?? row.client ?? '');
    if (action === 'copyId') copyText(row.id ?? row.localId ?? row.number ?? '');
    if (action === 'delete') onDelete?.(row);
    if (String(action).startsWith('custom:')) {
      const customKey = String(action).replace('custom:', '');
      const customAction = customRowActions.find((item) => item.key === customKey);
      customAction?.onClick?.(row);
    }
  };

  return (
    <div className="table-shell">
      {loading && <div className="loading-line">Ładowanie danych...</div>}
      {selectedRows.length > 0 && <div className="bulk-actions-bar">
        <strong>{selectedRows.length} zaznaczono</strong>
        <button type="button" className="secondary-button compact-table-button" onClick={clearSelection} disabled={bulkBusy}>Odznacz</button>
        {onBulkDelete && <button type="button" className="secondary-button compact-table-button danger-bulk-button" onClick={runBulkDelete} disabled={bulkBusy}><Trash2 size={14} />Usuń zaznaczone</button>}
      </div>}
      <div className="table-scroll">
        <table>
          <colgroup>{hasSelectionActions && <col className="selection-col" />}{hasExpandableRows && <col className="expand-col" />}{activeColumns.map((column) => <col key={column.key} style={{ width: columnWidths[column.key] ? `${columnWidths[column.key]}px` : undefined }} />)}</colgroup>
          <thead><tr>{hasSelectionActions && <th className="selection-cell selection-header" onClick={(event) => event.stopPropagation()}><input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisibleRows} aria-label="Zaznacz wszystkie widoczne pozycje" /></th>}{hasExpandableRows && <th className="expand-cell expand-header" aria-label="Rozwiń wiersz" />}{activeColumns.map((column) => <th key={column.key} draggable onContextMenu={(event) => openColumnMenu(event, column.key)} onDragStart={(event) => { setDraggedColumn(column.key); event.dataTransfer.effectAllowed = 'move'; }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); moveColumn(draggedColumn, column.key); setDraggedColumn(null); }} onDragEnd={() => setDraggedColumn(null)} onClick={() => handleSort(column.key)} className={draggedColumn === column.key ? 'dragging-column' : ''}><span><GripVertical size={14} />{column.label}</span>{sortKey === column.key && <em>{sortDir === 'asc' ? '↑' : '↓'}</em>}<button type="button" className="column-resizer" aria-label={`Zmień szerokość kolumny ${column.label}`} onMouseDown={(event) => startResize(event, column.key)} /></th>)}</tr></thead>
          <tbody>{sortedRows.map((row, index) => {
            const rowKey = getRowKey(row, index);
            const selected = selectedRowKeys.has(rowKey);
            const expandable = hasExpandableRows && isRowExpandable?.(row);
            const expanded = expandable && expandedRowKeys.has(rowKey);
            const rowClass = `${hasActions ? 'editable-row' : ''} ${selected ? 'selected-row' : ''} ${expandable ? 'expandable-row' : ''} ${expanded ? 'expanded-row' : ''}`.trim();
            return <Fragment key={`${row.id ?? row.localId ?? row.number ?? row.name}-${index}`}>
              <tr className={rowClass} onClick={(event) => { if (event.target.closest('button, input, select, textarea, a')) return; if (expandable) toggleExpandedRow(row, index); }} onDoubleClick={() => (typeof isRowLocked === 'function' && isRowLocked(row)) ? alert('Ta pozycja jest składnikiem zestawu. Operacje są zablokowane do czasu usunięcia jej z zestawu.') : (onOpen ?? onEdit)?.(row)} onContextMenu={(event) => openRowMenu(event, row)} title={expandable ? 'Kliknij, żeby rozwinąć zawartość zestawu. Dwuklik otwiera kartotekę.' : hasActions ? 'Dwuklik otwiera kartotekę. Prawy klik pokazuje operacje.' : 'Prawy klik pokazuje operacje tabeli.'}>{hasSelectionActions && <td className="selection-cell"><input type="checkbox" checked={selected} onChange={() => toggleRowSelection(row, index)} onClick={(event) => event.stopPropagation()} aria-label="Zaznacz pozycję" /></td>}{hasExpandableRows && <td className="expand-cell">{expandable && <button type="button" className="row-expand-button" onClick={(event) => { event.stopPropagation(); toggleExpandedRow(row, index); }} aria-label={expanded ? 'Zwiń zestaw' : 'Rozwiń zestaw'}>{expanded ? '▾' : '▸'}</button>}</td>}{activeColumns.map((column) => <td key={column.key}>{column.key === 'status' || column.key === 'client_kind' ? <StatusPill value={row[column.key]} /> : row[column.key]}</td>)}</tr>
              {expanded && <tr className="expanded-content-row"><td colSpan={activeColumns.length + (hasSelectionActions ? 1 : 0) + (hasExpandableRows ? 1 : 0)}>{renderExpandedRow(row)}</td></tr>}
            </Fragment>;
          })}</tbody>
        </table>
      </div>

      {rowContextMenu && <div className="row-context-menu" style={{ left: rowContextMenu.x, top: rowContextMenu.y }} onClick={(event) => event.stopPropagation()}>
        <div className="context-menu-title">Operacje</div>
        {(onOpen || onEdit) && <button type="button" onClick={() => runRowAction('open')}><FolderOpen size={14} />Otwórz</button>}
        {onEdit && <button type="button" onClick={() => runRowAction('edit')}><Save size={14} />Edytuj</button>}
        {onDuplicate && <button type="button" onClick={() => runRowAction('duplicate')}><FilePlus2 size={14} />Duplikuj</button>}
        {onHistory && <button type="button" onClick={() => runRowAction('history')}><History size={14} />Historia</button>}
        {customRowActions.filter((action) => !action.visible || action.visible(rowContextMenu.row)).map((action) => {
          const Icon = action.icon ?? Package;
          return <button key={action.key} type="button" className={action.className ?? ''} onClick={() => runRowAction(`custom:${action.key}`)}><Icon size={14} />{action.label}</button>;
        })}
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
function SettingsGrid({ colorTheme, onChangeColorTheme }) {
  const themeOptions = [
    { id: 'dark', label: 'Ciemny', icon: Moon },
    { id: 'light', label: 'Jasny', icon: Sun }
  ];
  const sections = [
    { id: 'company', label: 'Firma', icon: FileText, description: 'Dane firmy, logo i dane do dokumentów.' },
    { id: 'clients', label: 'Klienci', icon: Users, description: 'Typy klientów, rodzaje klientów i domyślne ustawienia kartoteki.' },
    { id: 'equipment', label: 'Sprzęt', icon: Package, description: 'Kategorie, marki, lokalizacje i statusy sprzętu.' },
    { id: 'service', label: 'Serwis', icon: Wrench, description: 'Statusy serwisowe, priorytety i typy zgłoszeń.' },
    { id: 'rentals', label: 'Wypożyczenia', icon: ClipboardList, description: 'Statusy wypożyczeń, zwrotów i domyślne okresy.' },
    { id: 'documents', label: 'Dokumenty', icon: FileText, description: 'Szablony PDF, numeracja, stopki i nagłówki.' },
    { id: 'interface', label: 'Interfejs', icon: SlidersHorizontal, description: 'Motyw, układ tabel, okna i preferencje pracy.' }
  ];
  const [activeSection, setActiveSection] = useState('company');
  const [clientTypes, setClientTypes] = useState([]);
  const [newType, setNewType] = useState('');
  const [equipmentCategories, setEquipmentCategories] = useState([]);
  const [equipmentStatuses, setEquipmentStatuses] = useState([]);
  const [newEquipmentCategory, setNewEquipmentCategory] = useState('');
  const [newEquipmentStatus, setNewEquipmentStatus] = useState('');
  const [editingDictionaryItem, setEditingDictionaryItem] = useState(null);
  const [editingDictionaryValue, setEditingDictionaryValue] = useState('');
  const [notice, setNotice] = useState('');
  const [preferences, setPreferences] = useState(() => getStoredJson('fixer-ui-preferences', {
    rememberWindowSize: true,
    rememberWindowPosition: true,
    rememberColumnLayout: true,
    confirmDelete: true,
    rememberFilters: true,
    defaultRowsPerPage: '10'
  }));
  const [companyProfile, setCompanyProfile] = useState(getCompanyProfile);
  const [companySaveNotice, setCompanySaveNotice] = useState('');

  useEffect(() => {
    if (!companySaveNotice) return undefined;

    const timer = window.setTimeout(() => {
      setCompanySaveNotice('');
    }, 4000);

    return () => window.clearTimeout(timer);
  }, [companySaveNotice]);

  const activeSectionData = sections.find((section) => section.id === activeSection) ?? sections[0];

  const updatePreference = (key, value) => {
    setPreferences((current) => {
      const next = { ...current, [key]: value };
      localStorage.setItem('fixer-ui-preferences', JSON.stringify(next));
      return next;
    });
  };

  const updateCompanyProfile = (key, value) => {
    setCompanyProfile((current) => ({ ...current, [key]: value }));
    setCompanySaveNotice('');
  };

  const saveCompanySettings = () => {
    const saved = saveCompanyProfile(companyProfile);
    setCompanyProfile(saved);
    setCompanySaveNotice('Dane firmy zapisane. Będą używane na wydrukach PDF.');
  };

  const resetCompanySettings = () => {
    if (!confirm('Przywrócić puste dane firmy?')) return;
    const saved = saveCompanyProfile(DEFAULT_COMPANY_PROFILE);
    setCompanyProfile(saved);
    setCompanySaveNotice('Dane firmy zostały wyczyszczone.');
  };

  const handleCompanyLogoUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Wybierz plik graficzny logo, np. PNG, JPG albo SVG.');
      event.target.value = '';
      return;
    }
    if (file.size > 1500 * 1024) {
      alert('Logo jest za duże. Wybierz plik do 1,5 MB.');
      event.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => updateCompanyProfile('logoDataUrl', String(reader.result || ''));
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const removeCompanyLogo = () => updateCompanyProfile('logoDataUrl', '');

  const loadTypes = async () => {
    const { data, error } = await fetchClientTypes();
    if (error) {
      setNotice('Nie udało się pobrać rodzajów klientów. Program używa lokalnej listy zapasowej.');
      console.error('Client types load error:', error.message);
      setClientTypes(getClientTypes().map((name, index) => ({ id: name, name, sort_order: index })));
      return;
    }
    setClientTypes(data);
    saveClientTypes(data.map((item) => item.name));
    setNotice('');
  };

  useEffect(() => { loadTypes(); }, []);

  const loadEquipmentSettings = async () => {
    const [categoriesResult, statusesResult] = await Promise.all([
      fetchEquipmentDictionary('category'),
      fetchEquipmentDictionary('status')
    ]);
    setEquipmentCategories(categoriesResult.data);
    setEquipmentStatuses(statusesResult.data);
    if (categoriesResult.error || statusesResult.error) {
      setNotice('Nie udało się pobrać ustawień sprzętu z bazy. Program używa lokalnej listy zapasowej.');
    }
  };

  useEffect(() => { loadEquipmentSettings(); }, []);

  const startEditDictionaryItem = (type, item) => {
    setEditingDictionaryItem({ type, id: item.id });
    setEditingDictionaryValue(item.name);
  };

  const cancelEditDictionaryItem = () => {
    setEditingDictionaryItem(null);
    setEditingDictionaryValue('');
  };

  const addEquipmentDictionaryItem = async (type) => {
    const value = (type === 'category' ? newEquipmentCategory : newEquipmentStatus).trim();
    if (!value) return;
    const list = type === 'category' ? equipmentCategories : equipmentStatuses;
    if (list.some((item) => item.name.toLowerCase() === value.toLowerCase())) {
      type === 'category' ? setNewEquipmentCategory('') : setNewEquipmentStatus('');
      return;
    }
    const { error } = await addEquipmentDictionaryRecord(type, value, list.length + 1);
    if (error) {
      alert(error.message);
      return;
    }
    type === 'category' ? setNewEquipmentCategory('') : setNewEquipmentStatus('');
    await loadEquipmentSettings();
  };

  const saveEquipmentDictionaryItem = async () => {
    const value = editingDictionaryValue.trim();
    if (!editingDictionaryItem || !value) return;
    const { error } = await updateEquipmentDictionaryRecord(editingDictionaryItem.id, editingDictionaryItem.type, value);
    if (error) {
      alert(error.message);
      return;
    }
    cancelEditDictionaryItem();
    await loadEquipmentSettings();
  };

  const removeEquipmentDictionaryItem = async (type, item) => {
    const list = type === 'category' ? equipmentCategories : equipmentStatuses;
    if (list.length <= 1) {
      alert('Musi zostać przynajmniej jedna pozycja.');
      return;
    }
    if (!confirm(`Usunąć pozycję: ${item.name}?`)) return;
    const { error } = await deleteEquipmentDictionaryRecord(item.id, type);
    if (error) {
      alert(error.message);
      return;
    }
    await loadEquipmentSettings();
  };

  const resetEquipmentDictionary = async (type) => {
    if (!confirm('Przywrócić domyślną listę?')) return;
    const { error } = await resetEquipmentDictionaryRecords(type);
    if (error) {
      alert(error.message);
      return;
    }
    await loadEquipmentSettings();
  };

  const renderEquipmentDictionaryCard = (type, title, description, items, value, setValue) => (
    <div className="settings-card compact-admin-card settings-dictionary-card dictionary-card-compact-list">
      <div className="settings-card-header compact-card-header dictionary-card-header">
        <div>
          <h3>{title}</h3>
          <p className="muted">{description}</p>
        </div>
        <button type="button" className="secondary-button dictionary-reset-button" onClick={() => resetEquipmentDictionary(type)}>Domyślne</button>
      </div>
      <div className="dictionary-add-compact">
        <input value={value} onChange={(event) => setValue(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') addEquipmentDictionaryItem(type); }} placeholder={type === 'category' ? 'np. Reżyserka, Statyw, Recorder' : 'np. Do sprawdzenia, Zarezerwowany'} />
        <button type="button" className="dictionary-icon-button add" onClick={() => addEquipmentDictionaryItem(type)} aria-label="Dodaj" title="Dodaj"><Plus size={16} /></button>
      </div>
      <div className="dictionary-list dictionary-list-compact">
        {items.map((item) => {
          const isEditing = editingDictionaryItem?.type === type && editingDictionaryItem?.id === item.id;
          return <div className={`dictionary-row dictionary-row-compact ${isEditing ? 'editing' : ''}`} key={item.id}>
            {isEditing
              ? <input value={editingDictionaryValue} onChange={(event) => setEditingDictionaryValue(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') saveEquipmentDictionaryItem(); if (event.key === 'Escape') cancelEditDictionaryItem(); }} autoFocus />
              : <button type="button" className="dictionary-name-button" onClick={() => startEditDictionaryItem(type, item)} title="Edytuj">{item.name}</button>}
            <div className="dictionary-row-actions dictionary-icon-actions">
              {isEditing
                ? <><button type="button" className="dictionary-icon-button save" onClick={saveEquipmentDictionaryItem} aria-label="Zapisz" title="Zapisz"><Save size={15} /></button><button type="button" className="dictionary-icon-button cancel" onClick={cancelEditDictionaryItem} aria-label="Anuluj" title="Anuluj"><X size={15} /></button></>
                : <><button type="button" className="dictionary-icon-button edit" onClick={() => startEditDictionaryItem(type, item)} aria-label="Edytuj" title="Edytuj">✎</button><button type="button" className="dictionary-icon-button remove" onClick={() => removeEquipmentDictionaryItem(type, item)} aria-label="Usuń" title="Usuń">−</button></>}
            </div>
          </div>;
        })}
      </div>
    </div>
  );


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

  const placeholderGroups = {
    service: ['Statusy serwisu', 'Priorytety', 'Typy zgłoszeń', 'Numeracja zleceń'],
    rentals: ['Statusy wypożyczeń', 'Statusy zwrotów', 'Domyślne okresy', 'Numeracja wypożyczeń'],
    documents: ['Szablony PDF', 'Numeracja dokumentów', 'Nagłówki dokumentów', 'Stopki dokumentów']
  };


  return <div className="settings-tabs-layout">
    <section className="panel settings-content settings-tabs-panel">
      <div className="settings-compact-header">
        <div>
          <p className="eyebrow">Moduł</p>
          <h2>Ustawienia</h2>
        </div>
        <div className="settings-top-tabs" role="tablist" aria-label="Sekcje ustawień programu">
        {sections.map((section) => {
          const Icon = section.icon;
          return <button key={section.id} type="button" role="tab" aria-selected={activeSection === section.id} className={`settings-top-tab ${activeSection === section.id ? 'active' : ''}`} onClick={() => setActiveSection(section.id)}>
            <Icon size={17} />{section.label}
          </button>;
        })}
        </div>
      </div>

      {activeSection === 'company' && <div className="settings-company-pane company-one-page">
        <div className="settings-card company-settings-card company-settings-card-full compact-admin-card company-unified-card">
          <div className="settings-card-header compact-card-header">
            <h3>Dane firmy</h3>
            <div className="settings-action-row">
              <button type="button" className="secondary-button" onClick={resetCompanySettings}>Wyczyść</button>
              <button type="button" className="primary-button" onClick={saveCompanySettings}><Save size={17} />Zapisz</button>
            </div>
          </div>
          {companySaveNotice && <div className="notice">{companySaveNotice}</div>}

          <div className="company-unified-layout">
            <div className="company-settings-form company-settings-form-wide company-settings-form-compact">
              <label className="company-field company-name">Nazwa firmy<input value={companyProfile.name} onChange={(event) => updateCompanyProfile('name', event.target.value)} placeholder="np. BMX Media" /></label>
              <label className="company-field company-legal-name">Nazwa do dokumentów<input value={companyProfile.legalName} onChange={(event) => updateCompanyProfile('legalName', event.target.value)} placeholder="np. BMX Media Sp. z o.o." /></label>
              <label className="company-field">NIP<input value={companyProfile.nip} onChange={(event) => updateCompanyProfile('nip', event.target.value)} placeholder="0000000000" /></label>
              <label className="company-field">REGON<input value={companyProfile.regon} onChange={(event) => updateCompanyProfile('regon', event.target.value)} /></label>
              <label className="company-field company-street">Ulica<input value={companyProfile.street} onChange={(event) => updateCompanyProfile('street', event.target.value)} /></label>
              <label className="company-field">Nr budynku<input value={companyProfile.buildingNumber} onChange={(event) => updateCompanyProfile('buildingNumber', event.target.value)} /></label>
              <label className="company-field">Nr lokalu<input value={companyProfile.apartmentNumber} onChange={(event) => updateCompanyProfile('apartmentNumber', event.target.value)} /></label>
              <label className="company-field">Kod pocztowy<input value={companyProfile.postalCode} onChange={(event) => updateCompanyProfile('postalCode', event.target.value)} placeholder="00-000" /></label>
              <label className="company-field company-city">Miasto<input value={companyProfile.city} onChange={(event) => updateCompanyProfile('city', event.target.value)} /></label>
              <label className="company-field">Kraj<input value={companyProfile.country} onChange={(event) => updateCompanyProfile('country', event.target.value)} /></label>
              <label className="company-field">Telefon<input value={companyProfile.phone} onChange={(event) => updateCompanyProfile('phone', event.target.value)} /></label>
              <label className="company-field">Email<input value={companyProfile.email} onChange={(event) => updateCompanyProfile('email', event.target.value)} /></label>
              <label className="company-field">Strona WWW<input value={companyProfile.website} onChange={(event) => updateCompanyProfile('website', event.target.value)} placeholder="https://..." /></label>
              <label className="company-field company-bank">Numer konta<input value={companyProfile.bankAccount} onChange={(event) => updateCompanyProfile('bankAccount', event.target.value)} /></label>
              <label className="company-field company-footer">Stopka dokumentów<textarea value={companyProfile.documentFooter} onChange={(event) => updateCompanyProfile('documentFooter', event.target.value)} placeholder="np. Dziękujemy za współpracę." /></label>
            </div>

            <aside className="company-side-panel">
              <div className="company-logo-box">
                <h3>Logo</h3>
                <div className="company-logo-preview company-logo-preview-compact">
                  {companyProfile.logoDataUrl ? <img src={companyProfile.logoDataUrl} alt="Logo firmy" /> : <span>Brak logo</span>}
                </div>
                <div className="settings-action-row logo-actions-row">
                  <label className="secondary-button file-button"><FolderOpen size={17} />Wczytaj<input type="file" accept="image/*" onChange={handleCompanyLogoUpload} /></label>
                  <button type="button" className="secondary-button" onClick={removeCompanyLogo} disabled={!companyProfile.logoDataUrl}>Usuń</button>
                </div>
              </div>

              <div className="company-preview-box company-preview-box-compact">
                <strong>{companyProfile.name || companyProfile.legalName || 'Nazwa firmy'}</strong>
                <span>{formatCompanyAddress(companyProfile) || 'Adres firmy'}</span>
                <span>{formatCompanyTaxData(companyProfile) || 'NIP / REGON'}</span>
                <span>{formatCompanyContact(companyProfile) || 'Telefon / email / WWW'}</span>
                {companyProfile.bankAccount && <span>Konto: {companyProfile.bankAccount}</span>}
              </div>
            </aside>
          </div>
        </div>
      </div>}

      {activeSection === 'interface' && <div className="settings-pane-grid settings-pane-grid-wide">
        <div className="settings-card wide-settings-card">
          <div>
            <p className="eyebrow">Wygląd</p>
            <h3>Motyw aplikacji</h3>
            <p className="muted">Motyw jest zapamiętywany w przeglądarce. Jasny i ciemny wariant mają osobną kolorystykę.</p>
          </div>
          <div className="theme-choice-row">
            {themeOptions.map((option) => {
              const Icon = option.icon;
              return <button key={option.id} type="button" className={`theme-choice-button ${colorTheme === option.id ? 'active' : ''}`} onClick={() => onChangeColorTheme(option.id)}><Icon size={18} /><span>{option.label}</span></button>;
            })}
          </div>
        </div>
        <div className="settings-card">
          <p className="eyebrow">Okna robocze</p>
          <h3>Zachowanie okien</h3>
          <label className="settings-check"><input type="checkbox" checked={preferences.rememberWindowSize} onChange={(event) => updatePreference('rememberWindowSize', event.target.checked)} />Zapamiętuj rozmiary okien</label>
          <label className="settings-check"><input type="checkbox" checked={preferences.rememberWindowPosition} onChange={(event) => updatePreference('rememberWindowPosition', event.target.checked)} />Zapamiętuj pozycje okien</label>
        </div>
        <div className="settings-card">
          <p className="eyebrow">Tabele</p>
          <h3>Układ danych</h3>
          <label className="settings-check"><input type="checkbox" checked={preferences.rememberColumnLayout} onChange={(event) => updatePreference('rememberColumnLayout', event.target.checked)} />Zapamiętuj układ kolumn</label>
          <label className="settings-check"><input type="checkbox" checked={preferences.rememberFilters} onChange={(event) => updatePreference('rememberFilters', event.target.checked)} />Zapamiętuj filtry tabel</label>
          <label className="settings-field">Domyślna liczba wierszy<select value={preferences.defaultRowsPerPage} onChange={(event) => updatePreference('defaultRowsPerPage', event.target.value)}><option>10</option><option>25</option><option>50</option><option>100</option></select></label>
        </div>
        <div className="settings-card">
          <p className="eyebrow">Bezpieczeństwo pracy</p>
          <h3>Potwierdzenia</h3>
          <label className="settings-check"><input type="checkbox" checked={preferences.confirmDelete} onChange={(event) => updatePreference('confirmDelete', event.target.checked)} />Pokazuj potwierdzenie usunięcia</label>
        </div>
      </div>}

      {activeSection === 'clients' && <div className="settings-pane-grid settings-pane-grid-wide compact-settings-grid">
        <div className="settings-card wide-settings-card settings-editor-card compact-admin-card">
          <div className="settings-card-header compact-card-header"><h3>Rodzaje klientów</h3><button className="secondary-button" onClick={resetTypes}>Przywróć domyślne</button></div>
          {notice && <div className="notice">{notice}</div>}
          <div className="inline-form compact-settings-form"><input value={newType} onChange={(event) => setNewType(event.target.value)} placeholder="np. Partner, VIP, Problemowy" /><button className="primary-button" onClick={addType}>Dodaj</button></div>
          <div className="tag-list">{clientTypes.map((type) => <span className="config-tag" key={type.id}>{type.name}<button onClick={() => removeType(type)}>×</button></span>)}</div>
        </div>
        <div className="settings-card compact-admin-card">
          <h3>Typy klientów</h3>
          <div className="tag-list"><span className="config-tag">Firma</span><span className="config-tag">Osoba prywatna</span></div>
        </div>
        <div className="settings-card compact-admin-card">
          <h3>Widok klientów</h3>
          <p className="muted">Domyślne filtry, kolumny i pola dodatkowe będą konfigurowane w tej sekcji.</p>
        </div>
      </div>}

      {activeSection === 'equipment' && <div className="settings-pane-grid settings-pane-grid-wide compact-settings-grid equipment-settings-grid">
        {renderEquipmentDictionaryCard('category', 'Kategorie sprzętu', 'Lista kategorii widoczna w karcie sprzętu.', equipmentCategories, newEquipmentCategory, setNewEquipmentCategory)}
        {renderEquipmentDictionaryCard('status', 'Statusy sprzętu', 'Lista statusów widoczna w karcie sprzętu i tabelach.', equipmentStatuses, newEquipmentStatus, setNewEquipmentStatus)}
        <div className="settings-card compact-admin-card settings-dictionary-card">
          <h3>Widok sprzętu</h3>
          <p className="muted">Układ tabeli, ukrywanie kolumn i menu kontekstowe działają globalnie tak jak w module Klienci.</p>
          <div className="tag-list"><span className="config-tag">Tabela</span><span className="config-tag">Kartoteka</span><span className="config-tag">Zestawy</span></div>
        </div>
      </div>}

      {placeholderGroups[activeSection] && <div className="settings-pane-grid settings-pane-grid-wide">
        {placeholderGroups[activeSection].map((item) => <div className="settings-card" key={item}>
          <p className="eyebrow">{activeSectionData.label}</p>
          <h3>{item}</h3>
          <p className="muted">Sekcja przygotowana pod konfigurację. Nie zmienia jeszcze działania istniejących modułów.</p>
          <button className="secondary-button" type="button" disabled>W przygotowaniu</button>
        </div>)}
      </div>}
    </section>
  </div>;
}

createRoot(document.getElementById('root')).render(<App />);
