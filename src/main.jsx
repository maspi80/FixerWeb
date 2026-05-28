import React from 'react';
import { createRoot } from 'react-dom/client';
import { Search, Bell, LayoutDashboard, Users, Package, Wrench, CalendarDays, ClipboardList, Settings, AlertTriangle, CheckCircle2, Clock, Barcode, FileText, Boxes } from 'lucide-react';
import './styles.css';

const modules = [
  { name: 'Dashboard', icon: LayoutDashboard, active: true },
  { name: 'Klienci', icon: Users },
  { name: 'Sprzęt', icon: Package },
  { name: 'Wypożyczenia', icon: Boxes },
  { name: 'Serwis', icon: Wrench },
  { name: 'Kalendarz', icon: CalendarDays },
  { name: 'Organizer', icon: ClipboardList },
  { name: 'Ustawienia', icon: Settings },
];

const alerts = [
  { type: 'warning', title: 'Zwrot przeterminowany', desc: 'Kamera Sony PXW-Z190 — Adam Kowalski', time: '2 dni po terminie' },
  { type: 'info', title: 'Serwis czeka na odbiór', desc: 'Mikser Yamaha MG12XU — Studio Alfa', time: '7 dni' },
  { type: 'ok', title: 'Rezerwacja na dziś', desc: 'Walizka realizacyjna #CASE-04', time: '10:00' },
];

const rentals = [
  { id: 'WYP/2026/001', client: 'Adam Kowalski', item: 'Sony PXW-Z190', status: 'Po terminie', date: '2026-05-26' },
  { id: 'WYP/2026/002', client: 'Studio Alfa', item: 'Walizka stream', status: 'Aktywne', date: '2026-05-30' },
  { id: 'REZ/2026/004', client: 'BMX Media', item: 'Blackmagic ATEM Mini', status: 'Rezerwacja', date: '2026-06-12' },
];

const service = [
  { id: 'SRV/2026/011', client: 'Jan Nowak', item: 'Canon XF605', status: 'Serwis zewnętrzny' },
  { id: 'SRV/2026/012', client: 'Event Pro', item: 'Sennheiser EW-D', status: 'Czeka na części' },
  { id: 'SRV/2026/013', client: 'Studio Alfa', item: 'Yamaha MG12XU', status: 'Gotowe do odbioru' },
];

function App() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">F</div>
          <div>
            <h1>Fixer WEB</h1>
            <span>Service • Rental • CRM</span>
          </div>
        </div>
        <nav>
          {modules.map((module) => {
            const Icon = module.icon;
            return <button className={module.active ? 'nav-item active' : 'nav-item'} key={module.name}><Icon size={18}/>{module.name}</button>
          })}
        </nav>
        <div className="user-card">
          <div className="avatar">M</div>
          <div>
            <strong>Mariusz</strong>
            <span>Administrator</span>
          </div>
        </div>
      </aside>

      <main className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">Panel główny</p>
            <h2>Dashboard operacyjny</h2>
          </div>
          <div className="search-box"><Search size={18}/><input placeholder="Szukaj globalnie: klient, sprzęt, serwis, wypożyczenie..." /></div>
          <button className="icon-button"><Bell size={18}/></button>
        </header>

        <section className="stats-grid">
          <Stat icon={Package} label="Sprzęt w magazynie" value="128" note="12 zestawów" />
          <Stat icon={Boxes} label="Aktywne wypożyczenia" value="9" note="1 po terminie" danger />
          <Stat icon={Wrench} label="Zlecenia serwisowe" value="14" note="3 wymagają reakcji" />
          <Stat icon={CalendarDays} label="Rezerwacje" value="6" note="najbliższa dziś" />
        </section>

        <section className="dashboard-grid">
          <Panel title="Alerty i zadania na dziś" wide>
            <div className="alert-list">
              {alerts.map((alert) => <AlertItem key={alert.title} {...alert} />)}
            </div>
          </Panel>
          <Panel title="Szybkie akcje">
            <div className="quick-actions">
              <button><Barcode size={18}/>Skanuj kod</button>
              <button><FileText size={18}/>Nowa umowa</button>
              <button><Wrench size={18}/>Przyjęcie serwisu</button>
              <button><Users size={18}/>Dodaj klienta</button>
            </div>
          </Panel>
        </section>

        <section className="tables-grid">
          <Panel title="Wypożyczenia i rezerwacje">
            <DataTable rows={rentals} columns={["id", "client", "item", "status", "date"]} />
          </Panel>
          <Panel title="Serwis">
            <DataTable rows={service} columns={["id", "client", "item", "status"]} />
          </Panel>
        </section>
      </main>
    </div>
  );
}

function Stat({ icon: Icon, label, value, note, danger }) {
  return <div className="stat-card"><Icon size={22}/><div><span>{label}</span><strong>{value}</strong><small className={danger ? 'danger' : ''}>{note}</small></div></div>
}

function Panel({ title, children, wide }) {
  return <section className={wide ? 'panel wide' : 'panel'}><div className="panel-header"><h3>{title}</h3><button>Otwórz</button></div>{children}</section>
}

function AlertItem({ type, title, desc, time }) {
  const Icon = type === 'warning' ? AlertTriangle : type === 'ok' ? CheckCircle2 : Clock;
  return <div className={`alert-item ${type}`}><Icon size={20}/><div><strong>{title}</strong><span>{desc}</span></div><em>{time}</em></div>
}

function DataTable({ rows, columns }) {
  const labels = { id: 'Numer', client: 'Klient', item: 'Sprzęt', status: 'Status', date: 'Termin' };
  return <table><thead><tr>{columns.map(c => <th key={c}>{labels[c]}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.id}>{columns.map(c => <td key={c}><span className={c === 'status' ? 'status-pill' : ''}>{row[c]}</span></td>)}</tr>)}</tbody></table>
}

createRoot(document.getElementById('root')).render(<App />);
