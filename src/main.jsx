import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Columns3,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Package,
  PanelLeft,
  Search,
  Settings,
  SlidersHorizontal,
  Users,
  Wrench,
  ClipboardList,
  Barcode,
  Eye,
  EyeOff,
  GripVertical
} from 'lucide-react';
import './styles.css';
import { supabase, isSupabaseConfigured } from './lib/supabaseClient';
import { dashboardCards, alerts, rentals, serviceOrders, clients, equipment } from './data/mockData';

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

const defaultUser = {
  name: 'Mariusz',
  role: 'Administrator',
  email: 'admin@fixer.local'
};

function App() {
  const [activeModule, setActiveModule] = useState('dashboard');
  const [isAuthenticated, setIsAuthenticated] = useState(() => localStorage.getItem('fixer-auth') === 'true');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('fixer-sidebar') === 'collapsed');
  const [globalSearch, setGlobalSearch] = useState('');
  const [themeCompact, setThemeCompact] = useState(() => localStorage.getItem('fixer-density') === 'compact');

  const currentModule = modules.find((module) => module.id === activeModule) ?? modules[0];

  const handleLogin = (event) => {
    event.preventDefault();
    localStorage.setItem('fixer-auth', 'true');
    setIsAuthenticated(true);
  };

  const handleLogout = async () => {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
    localStorage.removeItem('fixer-auth');
    setIsAuthenticated(false);
  };

  const toggleSidebar = () => {
    const next = !sidebarCollapsed;
    setSidebarCollapsed(next);
    localStorage.setItem('fixer-sidebar', next ? 'collapsed' : 'expanded');
  };

  const toggleDensity = () => {
    const next = !themeCompact;
    setThemeCompact(next);
    localStorage.setItem('fixer-density', next ? 'compact' : 'comfortable');
  };

  if (!isAuthenticated) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <div className={`app-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''} ${themeCompact ? 'compact' : ''}`}>
      <Sidebar
        activeModule={activeModule}
        setActiveModule={setActiveModule}
        collapsed={sidebarCollapsed}
        onToggle={toggleSidebar}
        onLogout={handleLogout}
      />

      <main className="main-area">
        <Topbar
          module={currentModule}
          globalSearch={globalSearch}
          setGlobalSearch={setGlobalSearch}
          onToggleDensity={toggleDensity}
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

function LoginScreen({ onLogin }) {
  return (
    <div className="login-page">
      <div className="login-card">
        <div className="brand-mark">F</div>
        <p className="eyebrow">Fixer WEB</p>
        <h1>Logowanie do systemu</h1>
        <p className="muted">
          Ten ekran jest fundamentem pod docelowe logowanie Supabase. Na tym etapie działa jako tryb testowy.
        </p>

        <form onSubmit={onLogin} className="login-form">
          <label>
            Email
            <input type="email" defaultValue="admin@fixer.local" />
          </label>
          <label>
            Hasło
            <input type="password" defaultValue="fixer-demo" />
          </label>
          <button className="primary-button" type="submit">
            <LockKeyhole size={18} />
            Wejdź do aplikacji
          </button>
        </form>

        <div className="login-note">
          Supabase: {isSupabaseConfigured ? 'gotowe do konfiguracji produkcyjnej' : 'brak zmiennych środowiskowych'}
        </div>
      </div>
    </div>
  );
}

function Sidebar({ activeModule, setActiveModule, collapsed, onToggle, onLogout }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="brand-mark">F</div>
        {!collapsed && (
          <div>
            <h2>Fixer WEB</h2>
            <p>Service · Rental · CRM</p>
          </div>
        )}
      </div>

      <nav className="nav-list">
        {modules.map((module) => {
          const Icon = module.icon;
          return (
            <button
              key={module.id}
              className={`nav-item ${activeModule === module.id ? 'active' : ''}`}
              onClick={() => setActiveModule(module.id)}
              title={module.label}
            >
              <Icon size={18} />
              {!collapsed && <span>{module.label}</span>}
            </button>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <button className="ghost-button" onClick={onToggle} title="Zwiń panel">
          <PanelLeft size={18} />
          {!collapsed && <span>{collapsed ? 'Rozwiń' : 'Zwiń panel'}</span>}
        </button>

        <div className="user-card">
          <div className="avatar">M</div>
          {!collapsed && (
            <div>
              <strong>{defaultUser.name}</strong>
              <span>{defaultUser.role}</span>
            </div>
          )}
        </div>

        <button className="ghost-button danger" onClick={onLogout} title="Wyloguj">
          <LogOut size={18} />
          {!collapsed && <span>Wyloguj</span>}
        </button>
      </div>
    </aside>
  );
}

function Topbar({ module, globalSearch, setGlobalSearch, onToggleDensity, themeCompact }) {
  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">Panel systemu</p>
        <h1>{module.label}</h1>
      </div>

      <div className="topbar-actions">
        <div className="global-search">
          <Search size={18} />
          <input
            value={globalSearch}
            onChange={(event) => setGlobalSearch(event.target.value)}
            placeholder="Szukaj globalnie: klient, sprzęt, serwis, wypożyczenie..."
          />
        </div>
        <button className="icon-button" onClick={onToggleDensity} title="Gęstość interfejsu">
          <SlidersHorizontal size={18} />
          <span>{themeCompact ? 'Kompakt' : 'Wygodny'}</span>
        </button>
        <button className="icon-button" title="Powiadomienia">
          <Bell size={18} />
        </button>
      </div>
    </header>
  );
}

function Dashboard({ setActiveModule }) {
  return (
    <div className="dashboard-grid">
      <div className="stats-grid">
        {dashboardCards.map((card) => (
          <button key={card.label} className="stat-card" onClick={() => setActiveModule(card.target)}>
            <div>
              <p>{card.label}</p>
              <strong>{card.value}</strong>
              <span className={card.warning ? 'warning-text' : ''}>{card.caption}</span>
            </div>
            <card.icon size={26} />
          </button>
        ))}
      </div>

      <section className="panel wide">
        <PanelHeader title="Alerty i zadania na dziś" action="Otwórz" onClick={() => setActiveModule('organizer')} />
        <div className="alert-list">
          {alerts.map((alert) => (
            <button key={alert.title} className={`alert-row ${alert.tone}`} onClick={() => setActiveModule(alert.target)}>
              <div>
                <strong>{alert.title}</strong>
                <span>{alert.description}</span>
              </div>
              <em>{alert.time}</em>
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <PanelHeader title="Szybkie akcje" action="Otwórz" />
        <div className="quick-actions">
          <button><Barcode size={18} />Skanuj kod</button>
          <button><ClipboardList size={18} />Nowa umowa</button>
          <button><Wrench size={18} />Przyjęcie serwisu</button>
          <button><Users size={18} />Dodaj klienta</button>
        </div>
      </section>

      <section className="panel">
        <PanelHeader title="Wypożyczenia i rezerwacje" action="Otwórz" onClick={() => setActiveModule('rentals')} />
        <DataTable
          storageKey="dashboard-rentals"
          columns={[
            { key: 'number', label: 'Numer' },
            { key: 'client', label: 'Klient' },
            { key: 'item', label: 'Sprzęt' },
            { key: 'status', label: 'Status' },
            { key: 'date', label: 'Termin' }
          ]}
          rows={rentals}
        />
      </section>

      <section className="panel">
        <PanelHeader title="Serwis" action="Otwórz" onClick={() => setActiveModule('service')} />
        <DataTable
          storageKey="dashboard-service"
          columns={[
            { key: 'number', label: 'Numer' },
            { key: 'client', label: 'Klient' },
            { key: 'item', label: 'Sprzęt' },
            { key: 'status', label: 'Status' }
          ]}
          rows={serviceOrders}
        />
      </section>
    </div>
  );
}

function ClientsModule() {
  return (
    <ModulePage
      title="Baza klientów"
      description="Kartoteka klientów, historia współpracy, wypożyczenia, serwisy i ocena wiarygodności."
      table={<DataTable storageKey="clients-table" columns={[
        { key: 'name', label: 'Nazwa' },
        { key: 'type', label: 'Typ' },
        { key: 'phone', label: 'Telefon' },
        { key: 'email', label: 'Email' },
        { key: 'rating', label: 'Ocena' }
      ]} rows={clients} />}
    />
  );
}

function EquipmentModule() {
  return (
    <ModulePage
      title="Magazyn sprzętu"
      description="Sprzęt, numery seryjne, kody kreskowe, zestawy, statusy i skaner."
      table={<DataTable storageKey="equipment-table" columns={[
        { key: 'name', label: 'Nazwa' },
        { key: 'brand', label: 'Marka' },
        { key: 'model', label: 'Model' },
        { key: 'serial', label: 'Numer seryjny' },
        { key: 'status', label: 'Status' }
      ]} rows={equipment} />}
    />
  );
}

function RentalsModule() {
  return (
    <ModulePage
      title="Wypożyczenia"
      description="Wypożyczenia, zwroty, rezerwacje, checklisty zestawów i automatyczna historia klienta."
      table={<DataTable storageKey="rentals-table" columns={[
        { key: 'number', label: 'Numer' },
        { key: 'client', label: 'Klient' },
        { key: 'item', label: 'Sprzęt' },
        { key: 'status', label: 'Status' },
        { key: 'date', label: 'Termin' }
      ]} rows={rentals} />}
    />
  );
}

function ServiceModule() {
  return (
    <ModulePage
      title="Serwis"
      description="Zlecenia serwisowe, statusy, postępy, dokumenty przyjęcia i wydania."
      table={<DataTable storageKey="service-table" columns={[
        { key: 'number', label: 'Numer' },
        { key: 'client', label: 'Klient' },
        { key: 'item', label: 'Sprzęt' },
        { key: 'status', label: 'Status' }
      ]} rows={serviceOrders} />}
    />
  );
}

function CalendarModule() {
  return (
    <ModulePage
      title="Kalendarz"
      description="Widok rezerwacji, wypożyczeń, terminów serwisowych i zadań na osi czasu."
      table={<Timeline />}
    />
  );
}

function OrganizerModule() {
  return (
    <ModulePage
      title="Organizer"
      description="Projekty, zadania, komentarze, załączniki i przypomnienia inspirowane Asaną."
      table={<OrganizerBoard />}
    />
  );
}

function SettingsModule() {
  return (
    <ModulePage
      title="Ustawienia"
      description="Konfiguracja firmy, statusów, numeracji dokumentów, marek, modeli i preferencji."
      table={<SettingsGrid />}
    />
  );
}

function ModulePage({ title, description, table }) {
  return (
    <div className="module-page">
      <section className="panel hero-panel">
        <p className="eyebrow">Moduł</p>
        <h2>{title}</h2>
        <p className="muted">{description}</p>
        <div className="module-actions">
          <button className="primary-button">Dodaj wpis</button>
          <button className="secondary-button">Eksport PDF</button>
          <button className="secondary-button">Ustawienia modułu</button>
        </div>
      </section>
      <section className="panel">{table}</section>
    </div>
  );
}

function PanelHeader({ title, action, onClick }) {
  return (
    <div className="panel-header">
      <h2>{title}</h2>
      {action && <button onClick={onClick}>{action}<ChevronRight size={16} /></button>}
    </div>
  );
}

function DataTable({ columns, rows, storageKey }) {
  const [sortKey, setSortKey] = useState(columns[0]?.key);
  const [sortDir, setSortDir] = useState('asc');
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem(`${storageKey}-columns`);
    return saved ? JSON.parse(saved) : columns.map((column) => column.key);
  });

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      const left = String(a[sortKey] ?? '');
      const right = String(b[sortKey] ?? '');
      return sortDir === 'asc' ? left.localeCompare(right) : right.localeCompare(left);
    });
  }, [rows, sortKey, sortDir]);

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
      return;
    }
    setSortKey(key);
    setSortDir('asc');
  };

  const toggleColumn = (key) => {
    const next = visibleColumns.includes(key)
      ? visibleColumns.filter((columnKey) => columnKey !== key)
      : [...visibleColumns, key];

    setVisibleColumns(next);
    localStorage.setItem(`${storageKey}-columns`, JSON.stringify(next));
  };

  const activeColumns = columns.filter((column) => visibleColumns.includes(column.key));

  return (
    <div className="table-shell">
      <div className="table-tools">
        <div className="table-tool-label">
          <Columns3 size={16} />
          Widoczność kolumn
        </div>
        <div className="column-toggles">
          {columns.map((column) => (
            <button key={column.key} className={visibleColumns.includes(column.key) ? 'active' : ''} onClick={() => toggleColumn(column.key)}>
              {visibleColumns.includes(column.key) ? <Eye size={14} /> : <EyeOff size={14} />}
              {column.label}
            </button>
          ))}
        </div>
      </div>

      <table>
        <thead>
          <tr>
            {activeColumns.map((column) => (
              <th key={column.key} onClick={() => handleSort(column.key)}>
                <span><GripVertical size={14} />{column.label}</span>
                {sortKey === column.key && <em>{sortDir === 'asc' ? '↑' : '↓'}</em>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row, index) => (
            <tr key={`${row.number ?? row.name}-${index}`}>
              {activeColumns.map((column) => (
                <td key={column.key}>
                  {column.key === 'status' ? <StatusPill value={row[column.key]} /> : row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusPill({ value }) {
  const tone = String(value).toLowerCase().includes('po terminie') ? 'danger'
    : String(value).toLowerCase().includes('gotowe') ? 'success'
    : String(value).toLowerCase().includes('rezerwacja') ? 'warning'
    : 'neutral';

  return <span className={`status-pill ${tone}`}>{value}</span>;
}

function Timeline() {
  return (
    <div className="timeline">
      {['Walizka stream — rezerwacja', 'Sony PXW-Z190 — wypożyczenie', 'Yamaha MG12XU — odbiór serwisu'].map((item, index) => (
        <div className="timeline-row" key={item}>
          <span>{index === 0 ? 'Dzisiaj' : index === 1 ? 'Jutro' : 'Za 7 dni'}</span>
          <div><strong>{item}</strong></div>
        </div>
      ))}
    </div>
  );
}

function OrganizerBoard() {
  const columns = ['Do zrobienia', 'W trakcie', 'Gotowe'];
  return (
    <div className="kanban">
      {columns.map((column, index) => (
        <div className="kanban-column" key={column}>
          <h3>{column}</h3>
          <div className="task-card">
            <strong>{index === 0 ? 'Uzupełnić dane klienta' : index === 1 ? 'Zweryfikować zestaw CASE-04' : 'Przygotować szablon umowy'}</strong>
            <span>{index === 0 ? 'Klienci' : index === 1 ? 'Wypożyczenia' : 'Dokumenty'}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function SettingsGrid() {
  const items = ['Dane firmy', 'Statusy sprzętu', 'Statusy serwisu', 'Numeracja dokumentów', 'Marki i modele', 'Szablony PDF'];
  return (
    <div className="settings-grid">
      {items.map((item) => (
        <button key={item}>
          <Settings size={18} />
          <span>{item}</span>
        </button>
      ))}
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
