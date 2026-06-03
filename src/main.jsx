import React, { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Bell, CalendarDays, CheckCircle2, ChevronRight, LayoutDashboard, LockKeyhole,
  LogOut, Package, PanelLeft, Search, Settings, SlidersHorizontal, Users, Wrench,
  ClipboardList, Barcode, Copy, Download, FilePlus2, FileText, FolderOpen, GripVertical, History, Plus, RotateCcw, Save, Trash2, X, Sun, Moon
} from 'lucide-react';
import './design-system/tokens.css';
import './design-system/components.css';
import {
  AppButton,
  AppInput,
  AppSelect,
  AppTable,
  AppTextarea,
  ButtonPrimary,
  ButtonSecondary,
  ButtonGhost,
  ModalFrame,
  FormField,
  SectionPanel,
  StatusPill as DSStatusPill,
  EmptyState
} from './design-system';
import './styles.css';
import { supabase, isSupabaseConfigured } from './lib/supabaseClient';
import { dashboardCards, alerts, rentals, serviceOrders, clients as demoClients, equipment as demoEquipment } from './data/mockData';
import { createClientRecord, deleteClientRecord, fetchClients, updateClientRecord } from './services/clientsService';
import { addClientTypeRecord, deleteClientTypeRecord, fetchClientTypes, resetClientTypesRecords, updateClientTypeRecord } from './services/clientTypesService';
import { fetchTablePreference, getLocalTablePreference, saveTablePreference } from './services/tablePreferencesService';
import { createEquipmentRecord, deleteEquipmentRecord, fetchEquipment, updateEquipmentRecord } from './services/equipmentService';
import { createRentalRecord, deleteRentalRecord, fetchRentals, registerRentalReturn, restoreRentalAsActive, updateRentalRecord } from './services/rentalsService';
import {
  createServiceOrderProgress,
  createServiceOrderRecord,
  deleteServiceOrderProgress,
  deleteServiceOrderRecord,
  fetchServiceOrderProgress,
  fetchServiceOrders,
  SERVICE_ESTIMATE_STATUSES,
  SERVICE_PRIORITIES,
  SERVICE_STATUSES,
  updateServiceOrderProgress,
  updateServiceOrderRecord
} from './services/serviceOrdersService';
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

function clampFloatingModalSize(size, minSize) {
  if (typeof window === 'undefined') return size;
  const maxWidth = Math.max(minSize.width, window.innerWidth - 32);
  const maxHeight = Math.max(minSize.height, window.innerHeight - 32);
  return {
    width: Math.min(Math.max(size.width, minSize.width), maxWidth),
    height: Math.min(Math.max(size.height, minSize.height), maxHeight)
  };
}

function getCenteredFloatingModalPosition(size, screenMargin = 16) {
  if (typeof window === 'undefined') return { left: screenMargin, top: screenMargin };
  return {
    left: Math.max(screenMargin, Math.round((window.innerWidth - size.width) / 2)),
    top: Math.max(screenMargin, Math.round((window.innerHeight - size.height) / 2))
  };
}

function clampFloatingModalPosition(position, size, screenMargin = 16) {
  if (typeof window === 'undefined') return position;
  const maxLeft = Math.max(screenMargin, window.innerWidth - size.width - screenMargin);
  const maxTop = Math.max(screenMargin, window.innerHeight - size.height - screenMargin);
  return {
    left: Math.min(Math.max(position.left, screenMargin), maxLeft),
    top: Math.min(Math.max(position.top, screenMargin), maxTop)
  };
}

function getSavedFloatingModalSize(storageKey, defaultSize, minSize) {
  if (typeof window === 'undefined') return defaultSize;
  try {
    const parsed = JSON.parse(localStorage.getItem(`${storageKey}:size`) || 'null');
    if (parsed && Number.isFinite(parsed.width) && Number.isFinite(parsed.height)) {
      return clampFloatingModalSize(parsed, minSize);
    }
  } catch {}
  return clampFloatingModalSize(defaultSize, minSize);
}

function getSavedFloatingModalPosition(storageKey, size) {
  if (typeof window === 'undefined') return getCenteredFloatingModalPosition(size);
  try {
    const parsed = JSON.parse(localStorage.getItem(`${storageKey}:position`) || 'null');
    if (parsed && Number.isFinite(parsed.left) && Number.isFinite(parsed.top)) {
      return clampFloatingModalPosition(parsed, size);
    }
  } catch {}
  return clampFloatingModalPosition(getCenteredFloatingModalPosition(size), size);
}

function useFloatingModalGeometry(storageKey, defaultSize, minSize) {
  const [modalSize, setModalSize] = useState(() => getSavedFloatingModalSize(storageKey, defaultSize, minSize));
  const [modalPosition, setModalPosition] = useState(() => {
    const size = getSavedFloatingModalSize(storageKey, defaultSize, minSize);
    return getSavedFloatingModalPosition(storageKey, size);
  });
  const modalSizeRef = useRef(modalSize);
  const modalPositionRef = useRef(modalPosition);
  const resizeStateRef = useRef(null);
  const dragStateRef = useRef(null);
  const visibleModalPosition = clampFloatingModalPosition(modalPosition, modalSize);

  useEffect(() => {
    modalSizeRef.current = modalSize;
    localStorage.setItem(`${storageKey}:size`, JSON.stringify(modalSize));
    setModalPosition((current) => clampFloatingModalPosition(current, modalSize));
  }, [modalSize, storageKey]);

  useEffect(() => {
    modalPositionRef.current = modalPosition;
    localStorage.setItem(`${storageKey}:position`, JSON.stringify(modalPosition));
  }, [modalPosition, storageKey]);

  useEffect(() => {
    const handleWindowResize = () => {
      const nextSize = clampFloatingModalSize(modalSizeRef.current, minSize);
      setModalSize(nextSize);
      setModalPosition((position) => clampFloatingModalPosition(position, nextSize));
    };
    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, [minSize]);

  useEffect(() => {
    const handlePointerMove = (event) => {
      const resizeState = resizeStateRef.current;
      if (resizeState) {
        event.preventDefault();
        setModalSize(clampFloatingModalSize({
          width: resizeState.startWidth + event.clientX - resizeState.startX,
          height: resizeState.startHeight + event.clientY - resizeState.startY
        }, minSize));
        return;
      }
      const dragState = dragStateRef.current;
      if (!dragState) return;
      event.preventDefault();
      setModalPosition(clampFloatingModalPosition({
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
  }, [minSize]);

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

  return { modalSize, visibleModalPosition, startDrag, startResize };
}

function ResizableModalFrame({ className = '', storageKey, defaultSize, minSize, eyebrow, title, description, onClose, footer, children }) {
  const { modalSize, visibleModalPosition, startDrag, startResize } = useFloatingModalGeometry(storageKey, defaultSize, minSize);
  return <div className="modal-backdrop draggable-modal-backdrop">
    <div className={`modal-card ds-modal-frame resizable-picker-modal ${className}`.trim()} style={{ width: `${modalSize.width}px`, height: `${modalSize.height}px`, left: `${visibleModalPosition.left}px`, top: `${visibleModalPosition.top}px` }}>
      <div className="modal-header ds-modal-header draggable-modal-header" onPointerDown={startDrag}>
        <div>
          {eyebrow && <p className="ds-eyebrow eyebrow">{eyebrow}</p>}
          {title && <h2>{title}</h2>}
          {description && <p className="ds-muted muted">{description}</p>}
        </div>
        {onClose && <button type="button" className="icon-button" onClick={onClose} aria-label="Zamknij"><X size={18} /></button>}
      </div>
      <div className="ds-modal-content">{children}</div>
      {footer && <div className="modal-actions ds-modal-footer">{footer}</div>}
      <div className="modal-resize-handle" onPointerDown={startResize} title="Zmień rozmiar okna" aria-label="Zmień rozmiar okna" />
    </div>
  </div>;
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
  const [moduleIntent, setModuleIntent] = useState(null);

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
          {activeModule === 'dashboard' && <Dashboard onNavigate={(moduleId, intent = null) => { setModuleIntent(intent); setActiveModule(moduleId); }} />}
          {activeModule === 'clients' && <ClientsModule />}
          {activeModule === 'equipment' && <EquipmentModule dashboardIntent={moduleIntent} onConsumeDashboardIntent={() => setModuleIntent(null)} />}
          {activeModule === 'rentals' && <RentalsModule dashboardIntent={moduleIntent} onConsumeDashboardIntent={() => setModuleIntent(null)} />}
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
          <label>Email<AppInput type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="email użytkownika" /></label>
          <label>Hasło<AppInput type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="hasło" /></label>
          <AppButton variant="primary" type="submit"><LockKeyhole size={18} />Zaloguj</AppButton>
        </form>
        {!isSupabaseConfigured && <AppButton variant="secondary" className="full-width" onClick={onDemoLogin}>Wejdź lokalnie</AppButton>}
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

function normalizeStatusText(value) {
  return String(value ?? '').trim().toLocaleLowerCase('pl');
}

function equipmentStatusMatches(item, patterns) {
  const status = normalizeStatusText(item?.status);
  return patterns.some((pattern) => status.includes(pattern));
}

function formatDashboardDate(value) {
  if (!value) return '—';
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function daysUntilDate(value) {
  if (!value) return null;
  const date = String(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const dayMs = 24 * 60 * 60 * 1000;
  const today = Date.parse(`${getLocalIsoDate()}T00:00:00`);
  const target = Date.parse(`${date}T00:00:00`);
  return Math.round((target - today) / dayMs);
}

function getUpcomingReturnTone(rental) {
  const days = daysUntilDate(rental?.planned_return_date);
  if (days === null) return 'neutral';
  if (days < 0) return 'danger';
  if (days <= 3) return 'warning';
  return 'success';
}

function buildDashboardActivity(rentalsRows, equipmentRows, clientRows) {
  const events = [];
  rentalsRows.forEach((rental) => {
    if (rental.created_at) events.push({ date: rental.created_at, operation: 'Utworzono wypożyczenie', object: rental.rental_number || 'Wypożyczenie' });
    if (rental.actual_return_date || rental.status === 'returned') events.push({ date: rental.actual_return_date || rental.updated_at || rental.created_at, operation: 'Zarejestrowano zwrot', object: rental.rental_number || 'Wypożyczenie' });
    if (rental.updated_at && rental.created_at && rental.updated_at !== rental.created_at && rental.status !== 'returned') events.push({ date: rental.updated_at, operation: 'Zmieniono wypożyczenie', object: rental.rental_number || 'Wypożyczenie' });
  });
  equipmentRows.forEach((item) => {
    if (item.created_at) events.push({ date: item.created_at, operation: 'Dodano sprzęt', object: item.name || item.serial || 'Sprzęt' });
    if (item.updated_at && item.created_at && item.updated_at !== item.created_at) events.push({ date: item.updated_at, operation: 'Edytowano sprzęt', object: item.name || item.serial || 'Sprzęt' });
  });
  clientRows.forEach((client) => {
    if (client.created_at) events.push({ date: client.created_at, operation: 'Dodano klienta', object: client.name || 'Klient' });
    if (client.updated_at && client.created_at && client.updated_at !== client.created_at) events.push({ date: client.updated_at, operation: 'Zmieniono dane klienta', object: client.name || 'Klient' });
  });
  return events
    .filter((event) => event.date)
    .sort((left, right) => Date.parse(right.date) - Date.parse(left.date))
    .slice(0, 10);
}

function getDashboardActivityKind(operation) {
  const text = normalizeStatusText(operation);
  if (text.includes('zwrot')) return { label: 'Zwrot', className: 'return' };
  if (text.includes('wypożyczenie') || text.includes('wypozyczenie')) return { label: text.includes('utworzono') ? 'Wypożyczono' : 'Wypożyczenie', className: 'rental' };
  if (text.includes('edytowano') || text.includes('zmieniono')) return { label: 'Edycja', className: 'edit' };
  if (text.includes('serwis')) return { label: 'Serwis', className: 'service' };
  if (text.includes('dodano')) return { label: 'Dodano', className: 'add' };
  return { label: 'Operacja', className: 'neutral' };
}

const DASHBOARD_SETTINGS_STORAGE_KEY = 'fixer-dashboard-layout-v1';
const DASHBOARD_SIZE_ORDER = ['small', 'medium', 'large'];
const DASHBOARD_ITEMS = [
  { id: 'activeRentals', label: 'Aktywne wypożyczenia', area: 'attention', defaultSize: 'medium' },
  { id: 'overdueRentals', label: 'Po terminie', area: 'attention', defaultSize: 'medium' },
  { id: 'todayReturns', label: 'Zwroty dzisiaj', area: 'attention', defaultSize: 'medium' },
  { id: 'readyToIssue', label: 'Gotowe do wydania', area: 'attention', defaultSize: 'medium' },
  { id: 'serviceEquipment', label: 'Sprzęt w serwisie', area: 'attention', defaultSize: 'medium' },
  { id: 'damagedEquipment', label: 'Sprzęt uszkodzony', area: 'attention', defaultSize: 'medium' },
  { id: 'allEquipment', label: 'Wszystkie urządzenia', area: 'stock', defaultSize: 'medium' },
  { id: 'availableEquipment', label: 'Dostępne', area: 'stock', defaultSize: 'medium' },
  { id: 'rentedEquipment', label: 'Wypożyczone', area: 'stock', defaultSize: 'medium' },
  { id: 'serviceStock', label: 'W serwisie', area: 'stock', defaultSize: 'medium' },
  { id: 'withdrawnEquipment', label: 'Wycofane', area: 'stock', defaultSize: 'medium' },
  { id: 'upcomingReturns', label: 'Nadchodzące zwroty', area: 'panel', defaultSize: 'large' },
  { id: 'recentActivity', label: 'Ostatnia aktywność', area: 'panel', defaultSize: 'large' },
  { id: 'clientsPanel', label: 'Klienci', area: 'panel', defaultSize: 'medium' }
];

function getDefaultDashboardSettings() {
  return {
    visible: Object.fromEntries(DASHBOARD_ITEMS.map((item) => [item.id, true])),
    sizes: Object.fromEntries(DASHBOARD_ITEMS.map((item) => [item.id, item.defaultSize]))
  };
}

function normalizeDashboardSettings(settings) {
  const defaults = getDefaultDashboardSettings();
  const visible = { ...defaults.visible, ...(settings?.visible ?? {}) };
  const sizes = { ...defaults.sizes, ...(settings?.sizes ?? {}) };
  DASHBOARD_ITEMS.forEach((item) => {
    if (!DASHBOARD_SIZE_ORDER.includes(sizes[item.id])) sizes[item.id] = item.defaultSize;
    visible[item.id] = visible[item.id] !== false;
  });
  return { visible, sizes };
}

function getDashboardSettings() {
  try {
    return normalizeDashboardSettings(JSON.parse(localStorage.getItem(DASHBOARD_SETTINGS_STORAGE_KEY) || 'null'));
  } catch {
    return getDefaultDashboardSettings();
  }
}

function saveDashboardSettings(settings) {
  const normalized = normalizeDashboardSettings(settings);
  localStorage.setItem(DASHBOARD_SETTINGS_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

function resetDashboardSettings() {
  const defaults = getDefaultDashboardSettings();
  localStorage.setItem(DASHBOARD_SETTINGS_STORAGE_KEY, JSON.stringify(defaults));
  return defaults;
}

function getNextDashboardSize(size, direction) {
  const index = DASHBOARD_SIZE_ORDER.indexOf(size);
  const safeIndex = index === -1 ? 1 : index;
  return DASHBOARD_SIZE_ORDER[Math.min(DASHBOARD_SIZE_ORDER.length - 1, Math.max(0, safeIndex + direction))];
}

function Dashboard({ onNavigate }) {
  const [rentalsRows, setRentalsRows] = useState([]);
  const [equipmentRows, setEquipmentRows] = useState([]);
  const [clientRows, setClientRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [dashboardSettings, setDashboardSettings] = useState(getDashboardSettings);
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    let active = true;
    const loadDashboard = async () => {
      setLoading(true);
      const [rentalsResult, equipmentResult, clientsResult] = await Promise.all([fetchRentals(), fetchEquipment(), fetchClients()]);
      if (!active) return;
      setRentalsRows(rentalsResult.data ?? []);
      setEquipmentRows(equipmentResult.error ? demoEquipment : (equipmentResult.data ?? []));
      setClientRows(clientsResult.data ?? []);
      const errors = [
        rentalsResult.error ? 'wypożyczenia' : '',
        equipmentResult.error ? 'sprzęt' : '',
        clientsResult.error ? 'klienci' : ''
      ].filter(Boolean);
      setNotice(errors.length ? `Nie udało się pobrać danych: ${errors.join(', ')}. Część sekcji może być niepełna.` : '');
      setLoading(false);
    };
    loadDashboard();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const handleStorage = (event) => {
      if (event.key === DASHBOARD_SETTINGS_STORAGE_KEY) setDashboardSettings(getDashboardSettings());
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const updateDashboardSettings = (updater) => {
    setDashboardSettings((current) => saveDashboardSettings(typeof updater === 'function' ? updater(current) : updater));
  };

  const isDashboardItemVisible = (id) => dashboardSettings.visible[id] !== false;
  const getDashboardItemSize = (id) => dashboardSettings.sizes[id] ?? DASHBOARD_ITEMS.find((item) => item.id === id)?.defaultSize ?? 'medium';

  const setDashboardItemSize = (id, size) => {
    updateDashboardSettings((current) => ({ ...current, sizes: { ...current.sizes, [id]: size } }));
  };

  const startDashboardResize = (event, id) => {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startSize = getDashboardItemSize(id);
    const startIndex = Math.max(0, DASHBOARD_SIZE_ORDER.indexOf(startSize));

    const handlePointerMove = (moveEvent) => {
      const steps = Math.round((moveEvent.clientX - startX) / 90);
      const nextIndex = Math.min(DASHBOARD_SIZE_ORDER.length - 1, Math.max(0, startIndex + steps));
      setDashboardItemSize(id, DASHBOARD_SIZE_ORDER[nextIndex]);
    };

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  const renderResizeHandle = (id) => editMode
    ? <span className="dashboard-resize-handle" role="presentation" onPointerDown={(event) => startDashboardResize(event, id)} title="Przeciągnij, żeby zmienić szerokość"><GripVertical size={14} /></span>
    : null;

  const resetDashboardLayout = () => {
    setDashboardSettings(resetDashboardSettings());
  };

  const activeRentals = rentalsRows.filter((rental) => rental.status !== 'returned');
  const overdueRentals = activeRentals.filter((rental) => getRentalOverdueDays(rental) > 0);
  const todayReturns = activeRentals.filter((rental) => String(rental.planned_return_date ?? '').slice(0, 10) === getLocalIsoDate());
  const serviceEquipment = equipmentRows.filter((item) => equipmentStatusMatches(item, ['serwis']));
  const damagedEquipment = equipmentRows.filter((item) => equipmentStatusMatches(item, ['uszk']));
  const availableEquipment = equipmentRows.filter((item) => equipmentStatusMatches(item, ['dostęp', 'dostep']));
  const rentedEquipment = equipmentRows.filter((item) => equipmentStatusMatches(item, ['wypo']));
  const withdrawnEquipment = equipmentRows.filter((item) => equipmentStatusMatches(item, ['wycof']));
  const upcomingReturns = [...activeRentals]
    .filter((rental) => rental.planned_return_date)
    .sort((left, right) => Date.parse(String(left.planned_return_date).slice(0, 10)) - Date.parse(String(right.planned_return_date).slice(0, 10)))
    .slice(0, 10);
  const activityRows = buildDashboardActivity(rentalsRows, equipmentRows, clientRows);
  const currentMonth = getLocalIsoDate().slice(0, 7);
  const clientStats = {
    all: clientRows.length,
    companies: clientRows.filter((client) => client.type === 'Firma').length,
    privatePeople: clientRows.filter((client) => client.type === 'Osoba prywatna').length,
    newThisMonth: clientRows.filter((client) => String(client.created_at ?? '').slice(0, 7) === currentMonth).length
  };

  const attentionCards = [
    { id: 'activeRentals', label: 'Aktywne wypożyczenia', value: activeRentals.length, target: ['rentals', { type: 'rentals', filter: 'active' }] },
    { id: 'overdueRentals', label: 'Po terminie', value: overdueRentals.length, tone: 'warning', target: ['rentals', { type: 'rentals', filter: 'overdue' }] },
    { id: 'todayReturns', label: 'Zwroty dzisiaj', value: todayReturns.length, target: ['rentals', { type: 'rentals', filter: 'today' }] },
    { id: 'readyToIssue', label: 'Gotowe do wydania', value: availableEquipment.length, tone: 'success', target: ['equipment', { type: 'equipment', status: 'Dostępny' }] },
    { id: 'serviceEquipment', label: 'Sprzęt w serwisie', value: serviceEquipment.length, target: ['equipment', { type: 'equipment', status: 'Serwis' }] },
    { id: 'damagedEquipment', label: 'Sprzęt uszkodzony', value: damagedEquipment.length, tone: 'danger', target: ['equipment', { type: 'equipment', status: 'Uszkodzony' }] }
  ];
  const stockCards = [
    { id: 'allEquipment', label: 'Wszystkie urządzenia', value: equipmentRows.length, target: ['equipment', { type: 'equipment', status: 'all' }] },
    { id: 'availableEquipment', label: 'Dostępne', value: availableEquipment.length, target: ['equipment', { type: 'equipment', status: 'Dostępny' }] },
    { id: 'rentedEquipment', label: 'Wypożyczone', value: rentedEquipment.length, target: ['equipment', { type: 'equipment', status: 'Wypożyczony' }] },
    { id: 'serviceStock', label: 'W serwisie', value: serviceEquipment.length, target: ['equipment', { type: 'equipment', status: 'Serwis' }] },
    { id: 'withdrawnEquipment', label: 'Wycofane', value: withdrawnEquipment.length, target: ['equipment', { type: 'equipment', status: 'Wycofany' }] }
  ];
  const visibleAttentionCards = attentionCards.filter((card) => isDashboardItemVisible(card.id));
  const visibleStockCards = stockCards.filter((card) => isDashboardItemVisible(card.id));

  return <div className={`dashboard-operational ${editMode ? 'editing' : ''}`}>
    {notice && <div className="notice dashboard-notice">{notice}</div>}
    <section className="dashboard-section">
      <div className="dashboard-section-header"><div><p className="eyebrow">Priorytet</p><h2>Co wymaga uwagi</h2></div><div className="dashboard-edit-actions">{loading && <span className="dashboard-loading">Odświeżanie...</span>}<AppButton variant="secondary" size="sm" onClick={() => setEditMode((current) => !current)}>{editMode ? 'Gotowe' : 'Dostosuj'}</AppButton><AppButton variant="secondary" size="sm" onClick={resetDashboardLayout}><RotateCcw size={14} />Resetuj układ</AppButton></div></div>
      <div className="dashboard-attention-grid">
        {visibleAttentionCards.map((card) => <button key={card.id} type="button" className={`dashboard-metric-card dashboard-size-${getDashboardItemSize(card.id)} ${card.tone ?? ''} ${editMode ? 'editing' : ''}`} onClick={() => { if (!editMode) onNavigate(...card.target); }}>
          <span>{card.label}</span>
          <strong>{card.value}</strong>
          {renderResizeHandle(card.id)}
        </button>)}
        {!visibleAttentionCards.length && <div className="dashboard-empty-layout">Wszystkie kafle tej sekcji są ukryte.</div>}
      </div>
    </section>

    <section className="dashboard-section">
      <div className="dashboard-section-header"><div><p className="eyebrow">Magazyn</p><h2>Stan magazynu</h2></div></div>
      <div className="dashboard-stock-grid">
        {visibleStockCards.map((card) => <button key={card.id} type="button" className={`dashboard-stock-card dashboard-size-${getDashboardItemSize(card.id)} ${editMode ? 'editing' : ''}`} onClick={() => { if (!editMode) onNavigate(...card.target); }}><span>{card.label}</span><strong>{card.value}</strong>{renderResizeHandle(card.id)}</button>)}
        {!visibleStockCards.length && <div className="dashboard-empty-layout">Wszystkie kafle tej sekcji są ukryte.</div>}
      </div>
    </section>

    <div className="dashboard-main-grid">
      {isDashboardItemVisible('upcomingReturns') && <section className={`panel dashboard-table-panel dashboard-size-${getDashboardItemSize('upcomingReturns')} ${editMode ? 'editing' : ''}`}>
        <PanelHeader title="Nadchodzące zwroty" />
        {renderResizeHandle('upcomingReturns')}
        <div className="dashboard-table-scroll">
          <table className="dashboard-mini-table">
            <thead><tr><th>Termin</th><th>Klient</th><th>Pozycje</th><th>Status</th></tr></thead>
            <tbody>{upcomingReturns.map((rental) => {
              const tone = getUpcomingReturnTone(rental);
              const itemsCount = getRentalBaseItems(rental).length;
              return <tr key={rental.id ?? rental.rental_number} className={`return-${tone}`} onClick={() => onNavigate('rentals', { type: 'rentals', filter: 'open', rentalId: rental.id })}>
                <td>{formatDashboardDate(rental.planned_return_date)}</td>
                <td>{rental.clients?.name ?? '—'}</td>
                <td>{itemsCount}</td>
                <td><StatusPill value={getRentalOverdueDays(rental) ? 'Po terminie' : formatRentalStatus(rental.status)} /></td>
              </tr>;
            })}
            {!upcomingReturns.length && <tr><td colSpan="4">Brak zaplanowanych zwrotów.</td></tr>}</tbody>
          </table>
        </div>
      </section>}

      {isDashboardItemVisible('recentActivity') && <section className={`panel dashboard-table-panel dashboard-size-${getDashboardItemSize('recentActivity')} ${editMode ? 'editing' : ''}`}>
        <PanelHeader title="Ostatnia aktywność" />
        {renderResizeHandle('recentActivity')}
        <div className="dashboard-table-scroll">
          <table className="dashboard-mini-table">
            <thead><tr><th>Data</th><th>Operacja</th><th>Obiekt</th></tr></thead>
            <tbody>{activityRows.map((event, index) => {
              const kind = getDashboardActivityKind(event.operation);
              return <tr key={`${event.date}-${event.operation}-${index}`}>
                <td>{formatDashboardDate(event.date)}</td><td><span className={`dashboard-activity-badge ${kind.className}`}>{kind.label}</span><span className="dashboard-activity-operation">{event.operation}</span></td><td>{event.object}</td>
              </tr>;
            })}
            {!activityRows.length && <tr><td colSpan="3">Brak danych aktywności w dostępnych tabelach.</td></tr>}</tbody>
          </table>
        </div>
      </section>}

      {isDashboardItemVisible('clientsPanel') && <section className={`panel dashboard-clients-panel dashboard-size-${getDashboardItemSize('clientsPanel')} ${editMode ? 'editing' : ''}`}>
        <PanelHeader title="Klienci" />
        {renderResizeHandle('clientsPanel')}
        <div className="dashboard-client-summary">
          <div><span>Klienci</span><strong>{clientStats.all}</strong></div>
          <div><span>Firmy</span><strong>{clientStats.companies}</strong></div>
          <div><span>Osoby prywatne</span><strong>{clientStats.privatePeople}</strong></div>
          <div><span>Nowi</span><strong>{clientStats.newThisMonth}</strong></div>
        </div>
      </section>}
    </div>
  </div>;
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
          <AppButton variant="primary" className="module-action-button" onClick={() => openClientEditor(null, 'data')}><Plus size={18} />Dodaj klienta</AppButton>
          <AppButton variant="secondary" className="module-action-button" onClick={loadClients}>Odśwież</AppButton>
          <AppButton variant="secondary" className="module-action-button" onClick={() => exportTableToCsv(CLIENTS_TABLE_KEY, CLIENTS_TABLE_COLUMNS, filteredRows)} disabled={!filteredRows.length}><Download size={16} />Eksport CSV</AppButton>
          <AppButton variant="secondary" className="module-action-button" onClick={() => exportTableToPdf('Baza klientów', CLIENTS_TABLE_KEY, CLIENTS_TABLE_COLUMNS, filteredRows)} disabled={!filteredRows.length}><FileText size={16} />Eksport PDF</AppButton>

        </div>
        {notice && <div className="notice">{notice}</div>}
      </section>
      <section className="panel clients-list-panel">
        <div className="client-filter-bar">
          <label>
            Szukaj
            <AppInput value={clientSearch} onChange={(event) => setClientSearch(event.target.value)} placeholder="Nazwa, miasto, telefon, email, NIP" />
          </label>
          <label>
            Typ
            <AppSelect value={clientTypeFilter} onChange={(event) => setClientTypeFilter(event.target.value)}>
              <option value="all">Wszyscy</option>
              <option value="Firma">Tylko firmy</option>
              <option value="Osoba prywatna">Tylko osoby prywatne</option>
            </AppSelect>
          </label>
          <label>
            Rodzaj klienta
            <AppSelect value={clientKindFilter} onChange={(event) => setClientKindFilter(event.target.value)}>
              <option value="all">Wszystkie rodzaje</option>
              {clientKinds.map((kind) => <option key={kind} value={kind}>{kind}</option>)}
            </AppSelect>
          </label>
          <AppButton variant="secondary" size="sm" className="compact-button" onClick={clearClientFilters}>Wyczyść filtry</AppButton>
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
        <div className="modal-actions"><AppButton variant="secondary" onClick={onClose}>Anuluj</AppButton><AppButton variant="primary" onClick={saveClient}><Save size={18} />Zapisz</AppButton></div>
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

function EquipmentModule({ dashboardIntent, onConsumeDashboardIntent }) {
  const [rows, setRows] = useState(demoEquipment);
  const [loading, setLoading] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState(null);
  const [notice, setNotice] = useState('');
  const [equipmentCategories, setEquipmentCategories] = useState(() => getLocalEquipmentDictionaryNames('category'));
  const [equipmentStatuses, setEquipmentStatuses] = useState(() => getLocalEquipmentDictionaryNames('status'));
  const [equipmentLocations, setEquipmentLocations] = useState(() => getLocalEquipmentDictionaryNames('location'));
  const [equipmentConditions, setEquipmentConditions] = useState(() => getActiveConfigDictionaryNames('equipmentConditions'));
  const [dashboardStatusFilter, setDashboardStatusFilter] = useState('all');

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

  useEffect(() => { loadEquipment(); loadEquipmentDictionaries(); setEquipmentConditions(getActiveConfigDictionaryNames('equipmentConditions')); }, []);

  useEffect(() => {
    if (dashboardIntent?.type !== 'equipment') return;
    setDashboardStatusFilter(dashboardIntent.status ?? 'all');
    onConsumeDashboardIntent?.();
  }, [dashboardIntent, onConsumeDashboardIntent]);

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


  const displayRows = useMemo(() => rows
    .filter((item) => !isEquipmentSetComponent(item))
    .filter((item) => {
      if (dashboardStatusFilter === 'all') return true;
      const status = normalizeStatusText(item.status);
      const filter = normalizeStatusText(dashboardStatusFilter);
      return status === filter || status.includes(filter);
    }), [rows, dashboardStatusFilter]);

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
          <AppButton variant="primary" onClick={() => openEquipmentEditor(null)}><Plus size={18} />Dodaj sprzęt</AppButton>
          <AppButton variant="secondary" onClick={openSetEditor}><Package size={18} />Dodaj zestaw</AppButton>
          <AppButton variant="secondary" onClick={loadEquipment}>Odśwież</AppButton>
          <AppButton variant="secondary">Eksport PDF</AppButton>
          <AppButton variant="secondary">Ustawienia modułu</AppButton>
        </div>
        {notice && <div className="notice">{notice}</div>}
        {dashboardStatusFilter !== 'all' && <div className="notice">Filtr z Dashboardu: status {dashboardStatusFilter}. <button type="button" className="inline-notice-button" onClick={() => setDashboardStatusFilter('all')}>Pokaż wszystko</button></div>}
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
      {editorOpen && <EquipmentEditor equipment={editingEquipment} equipmentRows={rows} categories={equipmentCategories} statuses={equipmentStatuses} locations={equipmentLocations} conditions={equipmentConditions} onClose={() => setEditorOpen(false)} onSave={handleSave} />}
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

function EquipmentEditor({ equipment, equipmentRows = [], categories = getLocalEquipmentDictionaryNames('category'), statuses = getLocalEquipmentDictionaryNames('status'), locations = getLocalEquipmentDictionaryNames('location'), conditions = getActiveConfigDictionaryNames('equipmentConditions'), onClose, onSave }) {
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
  const safeConditions = [...new Set([...(conditions?.length ? conditions : DEFAULT_CONFIG_DICTIONARIES.equipmentConditions), form.condition].filter(Boolean))];
  const safeLocations = [...new Set([...(locations?.length ? locations : ['Magazyn']), form.location].filter(Boolean))];

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
  const visibleModalPosition = clampEquipmentModalPosition(modalPosition, modalSize);

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
      const nextSize = clampEquipmentModalSize(modalSizeRef.current);
      setModalSize(nextSize);
      setModalPosition((position) => clampEquipmentModalPosition(position, nextSize));
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
        <div className="modal-card equipment-card-modal set-card-modal resizable-equipment-modal draggable-equipment-modal" style={{ width: `${modalSize.width}px`, height: `${modalSize.height}px`, left: `${visibleModalPosition.left}px`, top: `${visibleModalPosition.top}px` }}>
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
                <label>Lokalizacja<select value={form.location} onChange={(event)=>update('location', event.target.value)}>{safeLocations.map(location=><option key={location} value={location}>{location}</option>)}</select></label>
                <label>Stan techniczny<select value={form.condition} onChange={(event) => update('condition', event.target.value)}>{safeConditions.map((condition) => <option key={condition} value={condition}>{condition}</option>)}</select></label>
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
                  <AppButton variant="secondary" size="sm" className="compact-table-button" onClick={() => setSetPickerOpen(true)}><Plus size={15} />Dodaj składniki</AppButton>
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

          <div className="modal-actions"><AppButton variant="secondary" onClick={onClose}>Anuluj</AppButton><AppButton variant="primary" onClick={saveEquipment}><Save size={18} />Zapisz zestaw</AppButton></div>
          <div className="modal-resize-handle" onPointerDown={startResize} title="Zmień rozmiar okna" aria-label="Zmień rozmiar okna" />
        </div>
        {setPickerOpen && <EquipmentSetPicker availableItems={availableSetComponents} onClose={() => setSetPickerOpen(false)} onConfirm={(items) => { addSetItems(items); setSetPickerOpen(false); }} />}
      </div>
    );
  }

  return (
    <div className="modal-backdrop draggable-modal-backdrop">
      <div className="modal-card equipment-card-modal resizable-equipment-modal draggable-equipment-modal" style={{ width: `${modalSize.width}px`, height: `${modalSize.height}px`, left: `${visibleModalPosition.left}px`, top: `${visibleModalPosition.top}px` }}>
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
            <label>Stan techniczny<select value={form.condition} onChange={(event) => update('condition', event.target.value)}>{safeConditions.map((condition) => <option key={condition} value={condition}>{condition}</option>)}</select></label>
            <label>Lokalizacja<select value={form.location} onChange={(event) => update('location', event.target.value)}>{safeLocations.map((location) => <option key={location} value={location}>{location}</option>)}</select></label>
            <label>Wartość zakupu<input value={form.purchase_value} onChange={(event) => update('purchase_value', event.target.value)} placeholder="np. 2500" /></label>
            <label>Kaucja<input value={form.deposit} onChange={(event) => update('deposit', event.target.value)} placeholder="np. 500" /></label>
            <label>Cena / dzień<input value={form.price_day} onChange={(event) => update('price_day', event.target.value)} placeholder="np. 120" /></label>
            <label>Cena / tydzień<input value={form.price_week} onChange={(event) => update('price_week', event.target.value)} placeholder="np. 600" /></label>
            <label className="equipment-description-field">Opis / zawartość zestawu<textarea value={form.description} onChange={(event) => update('description', event.target.value)} /></label>
          </div>}

          {activeTab === 'gallery' && <div className="equipment-section-panel">
            <div className="section-title">Galeria sprzętu</div>
            <div className="inline-add-row"><AppInput value={newGalleryItem} onChange={(event) => setNewGalleryItem(event.target.value)} placeholder="Adres zdjęcia lub opis zdjęcia" /><AppButton variant="secondary" size="sm" className="compact-table-button" onClick={addGalleryItem}>Dodaj</AppButton></div>
            <div className="equipment-list-box">
              {form.gallery.length ? form.gallery.map((item, index) => <div key={`${item}-${index}`} className="equipment-list-row"><span>{item}</span><button type="button" className="ghost-mini-button" onClick={() => removeGalleryItem(index)}>Usuń</button></div>) : <p className="muted">Brak zdjęć w galerii.</p>}
            </div>
          </div>}

          {activeTab === 'attachments' && <div className="equipment-section-panel">
            <div className="section-title">Załączniki</div>
            <div className="attachment-add-grid"><AppInput value={newAttachmentName} onChange={(event) => setNewAttachmentName(event.target.value)} placeholder="Nazwa załącznika" /><AppInput value={newAttachmentUrl} onChange={(event) => setNewAttachmentUrl(event.target.value)} placeholder="Link lub numer dokumentu" /><AppButton variant="secondary" size="sm" className="compact-table-button" onClick={addAttachment}>Dodaj</AppButton></div>
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

        <div className="modal-actions"><AppButton variant="secondary" onClick={onClose}>Anuluj</AppButton><AppButton variant="primary" onClick={saveEquipment}><Save size={18} />Zapisz sprzęt</AppButton></div>
        <div className="modal-resize-handle" onPointerDown={startResize} title="Zmień rozmiar okna" aria-label="Zmień rozmiar okna" />
      </div>
    </div>
  );
}

function EquipmentSetPicker({ availableItems, onClose, onConfirm }) {
  return <EquipmentPickerModal title="Wybierz składniki z magazynu" availableItems={availableItems} selectedIds={[]} onClose={onClose} onConfirm={onConfirm} />;
}
const RENTALS_TABLE_KEY = 'rentals-table';
const RENTAL_MODAL_SIZE_KEY = 'fixer-rental-modal-size';
const RENTAL_MODAL_POSITION_KEY = 'fixer-rental-modal-position';
const DEFAULT_RENTAL_MODAL_SIZE = { width: 1160, height: 760 };
const MIN_RENTAL_MODAL_SIZE = { width: 960, height: 640 };
const RENTAL_MODAL_SCREEN_MARGIN = 16;
const RENTALS_TABLE_COLUMNS = [
  { key: 'rental_number', label: 'Numer' },
  { key: 'client', label: 'Klient' },
  { key: 'items_count', label: 'Pozycje' },
  { key: 'items_summary', label: 'Sprzęt' },
  { key: 'status', label: 'Status' },
  { key: 'start_date', label: 'Wydanie' },
  { key: 'planned_return_date', label: 'Termin zwrotu' }
];

function formatRentalStatus(status) {
  if (status === 'partially_returned') return 'Częściowo zwrócone';
  if (status === 'returned') return 'Zwrócone';
  return 'Aktywne';
}

function getLocalIsoDate() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function getRentalOverdueDays(rental) {
  if (!rental?.planned_return_date || rental.status === 'returned') return 0;
  const planned = String(rental.planned_return_date).slice(0, 10);
  const today = getLocalIsoDate();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(planned) || planned >= today) return 0;
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.max(0, Math.floor((Date.parse(`${today}T00:00:00`) - Date.parse(`${planned}T00:00:00`)) / dayMs));
}

function clampRentalModalSize(size) {
  if (typeof window === 'undefined') return size;
  const maxWidth = Math.max(MIN_RENTAL_MODAL_SIZE.width, window.innerWidth - 32);
  const maxHeight = Math.max(MIN_RENTAL_MODAL_SIZE.height, window.innerHeight - 32);
  return {
    width: Math.min(Math.max(size.width, MIN_RENTAL_MODAL_SIZE.width), maxWidth),
    height: Math.min(Math.max(size.height, MIN_RENTAL_MODAL_SIZE.height), maxHeight)
  };
}

function getSavedRentalModalSize() {
  if (typeof window === 'undefined') return DEFAULT_RENTAL_MODAL_SIZE;
  try {
    const parsed = JSON.parse(localStorage.getItem(RENTAL_MODAL_SIZE_KEY) || 'null');
    if (parsed && Number.isFinite(parsed.width) && Number.isFinite(parsed.height)) {
      return clampRentalModalSize(parsed);
    }
  } catch {}
  return clampRentalModalSize(DEFAULT_RENTAL_MODAL_SIZE);
}

function getCenteredRentalModalPosition(size) {
  if (typeof window === 'undefined') return { left: RENTAL_MODAL_SCREEN_MARGIN, top: RENTAL_MODAL_SCREEN_MARGIN };
  return {
    left: Math.max(RENTAL_MODAL_SCREEN_MARGIN, Math.round((window.innerWidth - size.width) / 2)),
    top: Math.max(RENTAL_MODAL_SCREEN_MARGIN, Math.round((window.innerHeight - size.height) / 2))
  };
}

function clampRentalModalPosition(position, size) {
  if (typeof window === 'undefined') return position;
  const maxLeft = Math.max(RENTAL_MODAL_SCREEN_MARGIN, window.innerWidth - size.width - RENTAL_MODAL_SCREEN_MARGIN);
  const maxTop = Math.max(RENTAL_MODAL_SCREEN_MARGIN, window.innerHeight - size.height - RENTAL_MODAL_SCREEN_MARGIN);
  return {
    left: Math.min(Math.max(position.left, RENTAL_MODAL_SCREEN_MARGIN), maxLeft),
    top: Math.min(Math.max(position.top, RENTAL_MODAL_SCREEN_MARGIN), maxTop)
  };
}

function getSavedRentalModalPosition(size) {
  if (typeof window === 'undefined') return getCenteredRentalModalPosition(size);
  try {
    const parsed = JSON.parse(localStorage.getItem(RENTAL_MODAL_POSITION_KEY) || 'null');
    if (parsed && Number.isFinite(parsed.left) && Number.isFinite(parsed.top)) {
      return clampRentalModalPosition(parsed, size);
    }
  } catch {}
  return clampRentalModalPosition(getCenteredRentalModalPosition(size), size);
}

function getRentalItemEquipmentId(item) {
  return item?.equipment_id ?? item?.id ?? '';
}

function getRentalBaseItems(rental) {
  return (rental?.rental_items ?? []).filter((item) => item.item_type !== 'set_component');
}

function buildRentalItemsFromEquipmentSelection(selectedEquipment, equipmentRows) {
  const rows = [];
  selectedEquipment.forEach((item) => {
    const isSet = isEquipmentSet(item);
    rows.push({
      equipment_id: item.id,
      parent_set_equipment_id: null,
      item_type: isSet ? 'set' : 'single',
      name_snapshot: item.name ?? '',
      serial_snapshot: item.serial ?? '',
      inventory_number_snapshot: item.inventory_number ?? '',
      barcode_snapshot: item.barcode ?? '',
      status: 'issued',
      price_day: item.price_day ?? '',
      price_week: item.price_week ?? '',
      deposit: item.deposit ?? '',
      condition_out: item.condition ?? ''
    });

    if (!isSet) return;
    (item.set_items ?? []).forEach((setItem) => {
      const component = equipmentRows.find((row) => sameEquipmentKey(row, setItem)) ?? setItem;
      const componentId = component.id ?? setItem.id ?? null;
      if (!componentId) return;
      rows.push({
        equipment_id: componentId,
        parent_set_equipment_id: item.id,
        item_type: 'set_component',
        name_snapshot: component.name ?? '',
        serial_snapshot: component.serial ?? '',
        inventory_number_snapshot: component.inventory_number ?? '',
        barcode_snapshot: component.barcode ?? '',
        status: 'issued',
        price_day: '',
        price_week: '',
        deposit: '',
        condition_out: component.condition ?? ''
      });
    });
  });
  return rows;
}

function getRentalEquipmentCode(item) {
  return item?.serial || item?.barcode || item?.inventory_number || '—';
}

function RentalsModule({ dashboardIntent, onConsumeDashboardIntent }) {
  const [rows, setRows] = useState([]);
  const [clients, setClients] = useState([]);
  const [equipmentRows, setEquipmentRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingRental, setEditingRental] = useState(null);
  const [returningRental, setReturningRental] = useState(null);
  const [returnedCollapsed, setReturnedCollapsed] = useState(true);
  const [rentalSettings, setRentalSettings] = useState(getRentalNumberingSettings);
  const [rentalTypes, setRentalTypes] = useState(() => getActiveConfigDictionaryNames('rentalTypes'));
  const [returnConditions, setReturnConditions] = useState(() => getActiveConfigDictionaryNames('returnConditions'));
  const [dashboardRentalFilter, setDashboardRentalFilter] = useState('all');
  const [pendingOpenRentalId, setPendingOpenRentalId] = useState(null);
  const [notice, setNotice] = useState('');

  const loadRentals = async () => {
    setLoading(true);
    setNotice('');
    const { data, error } = await fetchRentals();
    if (error) {
      setRows([]);
      setNotice(`Nie udało się pobrać wypożyczeń z bazy: ${error.message}`);
    } else {
      setRows(data);
    }
    setLoading(false);
  };

  const loadRentalDictionaries = async () => {
    const [clientsResult, equipmentResult] = await Promise.all([fetchClients(), fetchEquipment()]);
    if (clientsResult.error || equipmentResult.error) {
      setNotice('Nie udało się pobrać klientów lub sprzętu z bazy. Sprawdź konfigurację Supabase i schemat.');
    }
    setClients(clientsResult.data ?? []);
    setEquipmentRows(equipmentResult.data ?? []);
  };

  useEffect(() => {
    loadRentals();
    loadRentalDictionaries();
    setRentalSettings(getRentalNumberingSettings());
    setRentalTypes(getActiveConfigDictionaryNames('rentalTypes'));
    setReturnConditions(getActiveConfigDictionaryNames('returnConditions'));
  }, []);

  useEffect(() => {
    if (dashboardIntent?.type !== 'rentals') return;
    setDashboardRentalFilter(dashboardIntent.filter ?? 'all');
    if (dashboardIntent.rentalId) setPendingOpenRentalId(dashboardIntent.rentalId);
    onConsumeDashboardIntent?.();
  }, [dashboardIntent, onConsumeDashboardIntent]);

  useEffect(() => {
    if (!pendingOpenRentalId || !rows.length) return;
    const rental = rows.find((row) => row.id === pendingOpenRentalId);
    if (!rental) return;
    openRentalEditor(rental);
    setPendingOpenRentalId(null);
  }, [pendingOpenRentalId, rows]);

  const openRentalEditor = (rental = null) => {
    setEditingRental(rental);
    setEditorOpen(true);
  };

  const handleSave = async ({ rental, selectedEquipmentIds }) => {
    if (!rental.client_id) {
      alert('Wybierz klienta.');
      return;
    }
    const selectedEquipment = equipmentRows.filter((item) => selectedEquipmentIds.includes(item.id));
    if (!selectedEquipment.length) {
      alert('Wybierz przynajmniej jedną pozycję sprzętu.');
      return;
    }
    const items = buildRentalItemsFromEquipmentSelection(selectedEquipment, equipmentRows);
    const rentalToSave = {
      ...rental,
      rental_number: String(rental.rental_number ?? '').trim() || generateNextRentalNumber(rows)
    };
    const result = rental.id
      ? await updateRentalRecord(rental.id, rentalToSave, items)
      : await createRentalRecord(rentalToSave, items);
    if (result.error) {
      alert(result.error.message);
      return;
    }
    await loadRentals();
    await loadRentalDictionaries();
    setEditorOpen(false);
  };

  const handleDelete = async (row) => {
    const rental = row._rental ?? row;
    if (!confirm(`Usunąć wypożyczenie: ${rental.rental_number}? Sprzęt wróci do statusu „Dostępny”.`)) return;
    const { error } = await deleteRentalRecord(rental.id);
    if (error) {
      alert(error.message);
      return;
    }
    await loadRentals();
    await loadRentalDictionaries();
  };

  const handleBulkDelete = async (items) => {
    if (!items.length) return;
    if (!confirm(`Usunąć zaznaczone wypożyczenia: ${items.length}? Sprzęt wróci do statusu „Dostępny”.`)) return;
    for (const row of items) {
      const rental = row._rental ?? row;
      const { error } = await deleteRentalRecord(rental.id);
      if (error) {
        alert(`Nie udało się usunąć wypożyczenia ${rental.rental_number}: ${error.message}`);
        return;
      }
    }
    await loadRentals();
    await loadRentalDictionaries();
  };

  const handleRegisterReturn = async (rental, returnedItemIds, returnedCount, totalCount) => {
    if (!returnedItemIds.length && returnedCount < totalCount) {
      alert('Zaznacz przynajmniej jedną pozycję do zwrotu.');
      return;
    }
    const shouldClose = confirm('Czy zamknąć wypożyczenie?');
    if (!returnedItemIds.length && !shouldClose) return;
    if (shouldClose && returnedCount < totalCount) {
      alert('Nie wszystkie pozycje są oznaczone jako zwrócone. Wypożyczenie pozostanie aktywne jako częściowo zwrócone.');
    }
    const result = await registerRentalReturn(rental.id, returnedItemIds, shouldClose);
    if (result.error) {
      alert(result.error.message);
      return;
    }
    await loadRentals();
    await loadRentalDictionaries();
    setReturningRental(null);
    if (result.data?._return_closed) setReturnedCollapsed(false);
  };
  const handleRestoreReturnedRental = async (row) => {
    const rental = row._rental ?? row;
    if (!confirm(`Przywrócić wypożyczenie ${rental.rental_number} jako aktywne?`)) return;
    const result = await restoreRentalAsActive(rental.id);
    if (result.error) {
      alert(result.error.message);
      return;
    }
    await loadRentals();
    await loadRentalDictionaries();
  };
  const handleDeleteReturnedRental = async (row) => {
    const rental = row._rental ?? row;
    if (!confirm(`Usunąć wypożyczenie ${rental.rental_number} z historii?`)) return;
    const { error } = await deleteRentalRecord(rental.id);
    if (error) {
      alert(error.message);
      return;
    }
    await loadRentals();
    await loadRentalDictionaries();
  };

  const displayRows = rows.map((rental) => {
    const baseItems = getRentalBaseItems(rental);
    const overdueDays = getRentalOverdueDays(rental);
    return {
      ...rental,
      _rental: rental,
      _rowTone: overdueDays ? 'overdue' : '',
      rental_number: rental.rental_number,
      client: rental.clients?.name ?? '—',
      items_count: baseItems.length,
      items_summary: baseItems.map((item) => item.name_snapshot).filter(Boolean).join(', ') || '—',
      status: overdueDays ? 'Przeterminowane' : formatRentalStatus(rental.status),
      planned_return_date: overdueDays ? `${rental.planned_return_date} · po terminie ${overdueDays} ${overdueDays === 1 ? 'dzień' : 'dni'}` : rental.planned_return_date ?? '—'
    };
  });
  const activeRows = displayRows.filter((row) => {
    const rental = row._rental;
    if (rental?.status === 'returned') return false;
    if (dashboardRentalFilter === 'overdue') return getRentalOverdueDays(rental) > 0;
    if (dashboardRentalFilter === 'today') return String(rental?.planned_return_date ?? '').slice(0, 10) === getLocalIsoDate();
    return true;
  });
  const returnedRows = displayRows.filter((row) => row._rental?.status === 'returned');
  const canRegisterReturn = (row) => {
    const rental = row._rental ?? row;
    return rental?.status !== 'returned' && getRentalBaseItems(rental).length > 0;
  };

  const renderRentalItems = (row) => {
    const rental = row._rental ?? row;
    const items = rental.rental_items ?? [];
    if (!items.length) return <div className="expanded-set-empty">Brak pozycji w wypożyczeniu.</div>;
    return <div className="expanded-set-panel">
      <div className="expanded-set-header"><strong>Pozycje wypożyczenia</strong><span>{items.length} pozycji</span></div>
      <table className="expanded-set-table">
        <thead><tr><th>Typ</th><th>Nazwa</th><th>Numer seryjny</th><th>Kod / Nr inw.</th><th>Status</th></tr></thead>
        <tbody>{items.map((item, index) => <tr key={`${item.id ?? item.equipment_id}-${index}`}><td>{item.item_type === 'set' ? 'Zestaw' : item.item_type === 'set_component' ? 'Składnik' : 'Sprzęt'}</td><td><strong>{item.name_snapshot}</strong></td><td>{item.serial_snapshot || '—'}</td><td>{item.barcode_snapshot || item.inventory_number_snapshot || '—'}</td><td><StatusPill value={item.status} /></td></tr>)}</tbody>
      </table>
    </div>;
  };

  return <div className="module-page rentals-module-page">
    <section className="panel rentals-command-panel">
      <div className="rentals-command-copy">
        <p className="eyebrow">Operacje</p>
        <h2>Wypożyczenia</h2>
        <p className="muted">Dokumenty wydań, pozycje sprzętowe i statusy pracy magazynu.</p>
      </div>
      <div className="module-actions">
        <ButtonPrimary onClick={() => openRentalEditor(null)}><Plus size={17} />Nowe wypożyczenie</ButtonPrimary>
        <ButtonSecondary onClick={() => { loadRentals(); loadRentalDictionaries(); }}>Odśwież</ButtonSecondary>
        <ButtonSecondary onClick={() => exportTableToCsv(RENTALS_TABLE_KEY, RENTALS_TABLE_COLUMNS, displayRows)} disabled={!displayRows.length}><Download size={15} />CSV</ButtonSecondary>
        <ButtonSecondary onClick={() => exportTableToPdf('Wypożyczenia', RENTALS_TABLE_KEY, RENTALS_TABLE_COLUMNS, displayRows)} disabled={!displayRows.length}><FileText size={15} />PDF</ButtonSecondary>
      </div>
      {notice && <div className="notice rentals-command-notice">{notice}</div>}
      {dashboardRentalFilter !== 'all' && <div className="notice rentals-command-notice">Filtr z Dashboardu: {dashboardRentalFilter === 'overdue' ? 'po terminie' : dashboardRentalFilter === 'today' ? 'zwroty dzisiaj' : 'aktywne wypożyczenia'}. <button type="button" className="inline-notice-button" onClick={() => setDashboardRentalFilter('all')}>Pokaż wszystko</button></div>}
    </section>
    <section className="panel rentals-table-panel rentals-records-section">
      <div className="rentals-section-heading">
        <div>
          <p className="eyebrow">Aktywne</p>
          <h3>Aktywne wypożyczenia</h3>
        </div>
        <span>{activeRows.length} pozycji</span>
      </div>
      <DataTable storageKey={RENTALS_TABLE_KEY} loading={loading} columns={RENTALS_TABLE_COLUMNS} rows={activeRows} onOpen={(row) => openRentalEditor(row._rental)} onEdit={(row) => openRentalEditor(row._rental)} onDelete={handleDelete} onBulkDelete={handleBulkDelete} customRowActions={[{ key: 'return', label: 'Zarejestruj zwrot', icon: CheckCircle2, visible: canRegisterReturn, onClick: (row) => setReturningRental(row._rental ?? row) }]} isRowExpandable={(row) => Boolean((row._rental?.rental_items ?? []).length)} renderExpandedRow={renderRentalItems} />
    </section>
    <section className="panel rentals-table-panel rentals-records-section returned-rentals-section">
      <div className="rentals-section-heading">
        <div>
          <p className="eyebrow">Historia</p>
          <h3>Wypożyczenia zwrócone</h3>
        </div>
        <ButtonSecondary onClick={() => setReturnedCollapsed((value) => !value)}>{returnedCollapsed ? 'Rozwiń' : 'Zwiń'} · {returnedRows.length}</ButtonSecondary>
      </div>
      {!returnedCollapsed && <DataTable storageKey={`${RENTALS_TABLE_KEY}-returned`} loading={loading} columns={RENTALS_TABLE_COLUMNS} rows={returnedRows} onOpen={(row) => openRentalEditor(row._rental)} onDelete={handleDeleteReturnedRental} openLabel="Podgląd wypożyczenia" deleteLabel="Usuń z historii" customRowActions={[{ key: 'restore', label: 'Przywróć jako aktywne wypożyczenie', icon: RotateCcw, onClick: handleRestoreReturnedRental }]} isRowExpandable={(row) => Boolean((row._rental?.rental_items ?? []).length)} renderExpandedRow={renderRentalItems} />}
    </section>
    {editorOpen && <RentalEditor rental={editingRental} nextRentalNumber={generateNextRentalNumber(rows)} clients={clients} equipmentRows={equipmentRows} rentalTypes={rentalTypes} rentalSettings={rentalSettings} onClose={() => setEditorOpen(false)} onSave={handleSave} />}
    {returningRental && <RentalReturnModal rental={returningRental} returnConditions={returnConditions} onClose={() => setReturningRental(null)} onConfirm={handleRegisterReturn} />}
  </div>;
}

function RentalReturnModal({ rental, returnConditions = getActiveConfigDictionaryNames('returnConditions'), onClose, onConfirm }) {
  const returnConditionOptions = returnConditions.length ? returnConditions : DEFAULT_CONFIG_DICTIONARIES.returnConditions;
  const warningConditions = new Set(['Uszkodzony', 'Wymaga kontroli', 'Serwis']);
  const baseItems = getRentalBaseItems(rental);
  const initiallyReturnedIds = baseItems.filter((item) => item.status !== 'issued').map((item) => item.id).filter(Boolean);
  const [returnedItemIds, setReturnedItemIds] = useState(() => new Set(initiallyReturnedIds));
  const [returnDetails, setReturnDetails] = useState(() => Object.fromEntries(baseItems.map((item) => [item.id, { condition: 'Sprawny', notes: '' }])));
  const returnedCount = returnedItemIds.size;
  const totalCount = baseItems.length;
  const hasIssuedSelection = baseItems.some((item) => item.status === 'issued' && returnedItemIds.has(item.id));
  const allReturned = totalCount > 0 && returnedCount === totalCount;

  const toggleReturnItem = (item) => {
    if (!item.id || item.status !== 'issued') return;
    setReturnedItemIds((current) => {
      const next = new Set(current);
      if (next.has(item.id)) next.delete(item.id);
      else next.add(item.id);
      return next;
    });
  };
  const updateReturnDetail = (itemId, key, value) => {
    setReturnDetails((current) => ({
      ...current,
      [itemId]: {
        condition: current[itemId]?.condition ?? 'Sprawny',
        notes: current[itemId]?.notes ?? '',
        [key]: value
      }
    }));
  };

  const confirmReturn = () => {
    const newlyReturnedIds = baseItems
      .filter((item) => item.status === 'issued' && returnedItemIds.has(item.id))
      .map((item) => item.id);
    onConfirm(rental, newlyReturnedIds, returnedCount, totalCount);
  };

  return <ResizableModalFrame className="rental-return-modal" storageKey="fixer-rental-return-modal" defaultSize={{ width: 820, height: 620 }} minSize={{ width: 680, height: 460 }} eyebrow="Zwrot" title="Rejestracja zwrotu" onClose={onClose} footer={<><ButtonSecondary onClick={onClose}>Anuluj</ButtonSecondary><ButtonPrimary onClick={confirmReturn} disabled={!hasIssuedSelection && !allReturned}><CheckCircle2 size={16} />Zatwierdź zwrot</ButtonPrimary></>}>
    <div className="rental-return-summary">
      <strong>{rental.rental_number}</strong>
      <span>{rental.clients?.name ?? '—'}</span>
      <em>Zwrócono {returnedCount} z {totalCount}</em>
    </div>
    <div className="rental-return-list" role="list">
      {baseItems.map((item) => {
        const returned = returnedItemIds.has(item.id);
        const locked = item.status !== 'issued';
        const detail = returnDetails[item.id] ?? { condition: 'Sprawny', notes: '' };
        const warning = warningConditions.has(detail.condition);
        return <div key={item.id ?? item.equipment_id} role="listitem" className={`rental-return-row ${returned ? 'returned' : ''} ${locked ? 'locked' : ''} ${warning ? 'warning' : ''}`.trim()} onClick={() => toggleReturnItem(item)}>
          <div className="rental-return-check">{returned ? <CheckCircle2 size={18} /> : null}</div>
          <div className="rental-return-name">
            <strong>{item.name_snapshot || 'Sprzęt'}</strong>
            <small>SN: {item.serial_snapshot || '—'}</small>
          </div>
          <label className="rental-return-condition" onClick={(event) => event.stopPropagation()}>
            <span>Stan zwrotu</span>
            <AppSelect value={detail.condition} onChange={(event) => updateReturnDetail(item.id, 'condition', event.target.value)} disabled={locked}>
              {returnConditionOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </AppSelect>
          </label>
          <label className="rental-return-notes" onClick={(event) => event.stopPropagation()}>
            <span>Uwagi</span>
            <AppTextarea value={detail.notes} onChange={(event) => updateReturnDetail(item.id, 'notes', event.target.value)} placeholder="np. zwrot kompletny" disabled={locked} />
          </label>
          <div className="rental-return-status"><DSStatusPill value={returned ? warning ? 'Zwrócono · uwaga' : 'Zwrócono' : 'Nie zwrócono'} /></div>
        </div>;
      })}
      {!baseItems.length && <EmptyState title="Brak sprzętu w wypożyczeniu." />}
    </div>
  </ResizableModalFrame>;
}

function RentalEditor({ rental, nextRentalNumber = '', clients, equipmentRows, rentalTypes = getActiveConfigDictionaryNames('rentalTypes'), rentalSettings = getRentalNumberingSettings(), onClose, onSave }) {
  const selectedBaseItems = getRentalBaseItems(rental);
  const initialClient = clients.find((client) => client.id === rental?.client_id) ?? null;
  const defaultStartDate = new Date().toISOString().slice(0, 10);
  const safeRentalTypes = [...new Set([...(rentalTypes.length ? rentalTypes : DEFAULT_CONFIG_DICTIONARIES.rentalTypes), rental?.rental_type].filter(Boolean))];
  const [form, setForm] = useState(() => ({
    id: rental?.id ?? null,
    rental_number: rental?.rental_number ?? nextRentalNumber,
    client_id: rental?.client_id ?? '',
    status: rental?.status ?? 'active',
    rental_type: rental?.rental_type ?? safeRentalTypes[0] ?? 'Płatne',
    start_date: rental?.start_date ?? defaultStartDate,
    planned_return_date: rental?.planned_return_date ?? addDaysToIsoDate(defaultStartDate, rentalSettings.defaultReturnDays),
    actual_return_date: rental?.actual_return_date ?? '',
    notes: rental?.notes ?? '',
    total_deposit: rental?.total_deposit ?? '',
    total_price: rental?.total_price ?? ''
  }));
  const [selectedEquipmentIds, setSelectedEquipmentIds] = useState(() => selectedBaseItems.map(getRentalItemEquipmentId).filter(Boolean));
  const [localClients, setLocalClients] = useState(clients);
  const [selectedClient, setSelectedClient] = useState(initialClient);
  const [clientPickerOpen, setClientPickerOpen] = useState(false);
  const [clientEditorOpen, setClientEditorOpen] = useState(false);
  const [equipmentPickerOpen, setEquipmentPickerOpen] = useState(false);
  const [selectedRentalItemIds, setSelectedRentalItemIds] = useState(new Set());
  const [rentalItemContextMenu, setRentalItemContextMenu] = useState(null);
  const [previewEquipment, setPreviewEquipment] = useState(null);
  const [modalSize, setModalSize] = useState(getSavedRentalModalSize);
  const [modalPosition, setModalPosition] = useState(() => getSavedRentalModalPosition(getSavedRentalModalSize()));
  const modalSizeRef = useRef(modalSize);
  const modalPositionRef = useRef(modalPosition);
  const resizeStateRef = useRef(null);
  const dragStateRef = useRef(null);

  const availableEquipment = equipmentRows.filter((item) => {
    if (!item.id) return false;
    if (isEquipmentSetComponent(item)) return false;
    if (selectedEquipmentIds.includes(item.id)) return true;
    return item.status !== 'Wypożyczony';
  });

  const selectedEquipment = equipmentRows.filter((item) => selectedEquipmentIds.includes(item.id));
  const selectedSetCount = selectedEquipment.filter(isEquipmentSet).length;
  const settlementOptional = form.rental_type === 'Bezpłatne' || form.rental_type === 'Wewnętrzne';
  const rentalSummary = {
    items: selectedEquipment.length,
    sets: selectedSetCount,
    price: form.total_price || '0',
    deposit: form.total_deposit || '0'
  };

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const chooseClient = (client) => {
    setSelectedClient(client);
    update('client_id', client.id);
    setClientPickerOpen(false);
  };
  const openNewClientEditor = () => {
    setClientPickerOpen(false);
    setClientEditorOpen(true);
  };
  const saveNewClientFromRental = async (client) => {
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
    const result = await createClientRecord(payload);
    if (result.error) {
      alert(result.error.message);
      return;
    }
    setClientEditorOpen(false);
    setLocalClients((current) => [result.data, ...current.filter((item) => item.id !== result.data.id)]);
    setSelectedClient(result.data);
    update('client_id', result.data.id);
  };
  const addEquipment = (items) => {
    const ids = items.map((item) => item.id).filter(Boolean);
    setSelectedEquipmentIds((current) => [...new Set([...current, ...ids])]);
    setEquipmentPickerOpen(false);
  };
  const toggleRentalItemSelection = (id) => {
    setSelectedRentalItemIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const removeSelectedEquipment = () => {
    setSelectedEquipmentIds((current) => current.filter((id) => !selectedRentalItemIds.has(id)));
    setSelectedRentalItemIds(new Set());
  };
  const removeRentalEquipment = (id) => {
    setSelectedEquipmentIds((current) => current.filter((itemId) => itemId !== id));
    setSelectedRentalItemIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  };
  const openRentalItemMenu = (event, item) => {
    event.preventDefault();
    event.stopPropagation();
    setRentalItemContextMenu({ ...getSafeMenuPosition(event, 240, 260), item });
  };
  const runRentalItemAction = (action) => {
    const item = rentalItemContextMenu?.item;
    setRentalItemContextMenu(null);
    if (!item) return;
    if (action === 'preview') setPreviewEquipment(item);
    if (action === 'toggle') toggleRentalItemSelection(item.id);
    if (action === 'remove') removeRentalEquipment(item.id);
    if (action === 'removeSelected') removeSelectedEquipment();
  };

  useEffect(() => {
    setSelectedRentalItemIds((current) => new Set([...current].filter((id) => selectedEquipmentIds.includes(id))));
  }, [selectedEquipmentIds]);

  useEffect(() => { setLocalClients(clients); }, [clients]);

  useEffect(() => {
    if (!rentalItemContextMenu) return undefined;
    const closeMenu = () => setRentalItemContextMenu(null);
    window.addEventListener('click', closeMenu);
    window.addEventListener('keydown', closeMenu);
    window.addEventListener('resize', closeMenu);
    return () => {
      window.removeEventListener('click', closeMenu);
      window.removeEventListener('keydown', closeMenu);
      window.removeEventListener('resize', closeMenu);
    };
  }, [rentalItemContextMenu]);

  const visibleModalPosition = clampRentalModalPosition(modalPosition, modalSize);

  useEffect(() => {
    modalSizeRef.current = modalSize;
    localStorage.setItem(RENTAL_MODAL_SIZE_KEY, JSON.stringify(modalSize));
    setModalPosition((current) => clampRentalModalPosition(current, modalSize));
  }, [modalSize]);

  useEffect(() => {
    modalPositionRef.current = modalPosition;
    localStorage.setItem(RENTAL_MODAL_POSITION_KEY, JSON.stringify(modalPosition));
  }, [modalPosition]);

  useEffect(() => {
    const handleWindowResize = () => {
      const nextSize = clampRentalModalSize(modalSizeRef.current);
      setModalSize(nextSize);
      setModalPosition((position) => clampRentalModalPosition(position, nextSize));
    };
    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, []);

  useEffect(() => {
    const handlePointerMove = (event) => {
      const resizeState = resizeStateRef.current;
      if (resizeState) {
        event.preventDefault();
        setModalSize(clampRentalModalSize({
          width: resizeState.startWidth + event.clientX - resizeState.startX,
          height: resizeState.startHeight + event.clientY - resizeState.startY
        }));
        return;
      }
      const dragState = dragStateRef.current;
      if (!dragState) return;
      event.preventDefault();
      setModalPosition(clampRentalModalPosition({
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

  if (clientPickerOpen) {
    return <ClientPickerModal clients={localClients} selectedClientId={form.client_id} onClose={() => setClientPickerOpen(false)} onConfirm={chooseClient} onCreateClient={openNewClientEditor} />;
  }

  if (clientEditorOpen) {
    return <ClientEditor client={null} initialTab="data" onClose={() => { setClientEditorOpen(false); setClientPickerOpen(true); }} onSave={saveNewClientFromRental} />;
  }

  if (equipmentPickerOpen) {
    return <EquipmentPickerModal title="Wybierz sprzęt do wypożyczenia" availableItems={availableEquipment} selectedIds={selectedEquipmentIds} onClose={() => setEquipmentPickerOpen(false)} onConfirm={addEquipment} />;
  }

  if (previewEquipment) {
    return <RentalEquipmentPreviewModal equipment={previewEquipment} onClose={() => setPreviewEquipment(null)} />;
  }

  return <div className="modal-backdrop draggable-modal-backdrop">
    <div className="modal-card equipment-card-modal rental-record-modal resizable-equipment-modal draggable-equipment-modal" style={{ width: `${modalSize.width}px`, height: `${modalSize.height}px`, left: `${visibleModalPosition.left}px`, top: `${visibleModalPosition.top}px` }}>
      <div className="modal-header draggable-modal-header" onPointerDown={startDrag}>
        <div>
          <p className="eyebrow">Wypożyczenia</p>
          <h2>{rental ? 'Kartoteka wypożyczenia' : 'Nowe wypożyczenie'}</h2>
          <p className="muted">Dokument wydania sprzętu do klienta.</p>
        </div>
        <button className="icon-button" onClick={onClose}><X size={18} /></button>
      </div>
      <div className="rental-record-layout">
        <SectionPanel className="rental-record-section rental-record-header-section" title="Dokument">
          <div className="rental-document-grid">
            <FormField className="rental-number-field" label="Numer"><AppInput value={form.rental_number} onChange={(event) => update('rental_number', event.target.value)} placeholder="automatycznie" /></FormField>
            <div className="rental-status-field"><span>Status</span><DSStatusPill value={formatRentalStatus(form.status)} /></div>
            <div className="rental-client-field">
              <span>Klient</span>
              <ButtonSecondary className={selectedClient ? 'rental-choice-button selected' : 'rental-choice-button'} onClick={() => setClientPickerOpen(true)}>
                <strong>{selectedClient ? selectedClient.name : 'Wybierz klienta'}</strong>
                {selectedClient?.client_kind && <small>({selectedClient.client_kind})</small>}
              </ButtonSecondary>
            </div>
            <FormField label="Typ wypożyczenia">
              <AppSelect value={form.rental_type} onChange={(event) => update('rental_type', event.target.value)}>
                {safeRentalTypes.map((type) => <option key={type} value={type}>{type}</option>)}
              </AppSelect>
            </FormField>
            <FormField className="rental-date-field rental-issue-date-field" label="Wydanie"><AppInput type="date" value={form.start_date} onChange={(event) => update('start_date', event.target.value)} /></FormField>
            <FormField className="rental-date-field rental-return-date-field" label="Termin zwrotu"><AppInput type="date" value={form.planned_return_date} onChange={(event) => update('planned_return_date', event.target.value)} /></FormField>
          </div>
        </SectionPanel>

        <SectionPanel className="rental-record-section rental-items-section" title="Sprzęt do wydania" actions={<ButtonPrimary className="rental-add-equipment-button" onClick={() => setEquipmentPickerOpen(true)}><Plus size={14} />Dodaj sprzęt</ButtonPrimary>}>
          <div className="rental-items-meta">
            <span>{selectedRentalItemIds.size ? `${selectedRentalItemIds.size} zaznaczono` : 'Brak zaznaczenia'}</span>
            <span className="rental-document-summary">{rentalSummary.items} pozycji · {rentalSummary.sets} zestawów · cena {rentalSummary.price} · kaucja {rentalSummary.deposit}</span>
          </div>
          <div className="rental-items-table-shell">
            {selectedEquipment.length ? <AppTable className="set-components-table rental-items-table">
              <thead><tr><th className="selection-cell"></th><th>Nazwa</th><th>Typ</th><th>Kod / SN</th><th>Kategoria</th><th>Lokalizacja</th><th>Status</th></tr></thead>
              <tbody>{selectedEquipment.map((item) => (
                <tr key={item.id} className={selectedRentalItemIds.has(item.id) ? 'selected-row' : ''} onClick={() => toggleRentalItemSelection(item.id)} onContextMenu={(event) => openRentalItemMenu(event, item)} onDoubleClick={() => setPreviewEquipment(item)} title="Pozycja sprzętu">
                  <td className="selection-cell"><input type="checkbox" checked={selectedRentalItemIds.has(item.id)} onChange={() => toggleRentalItemSelection(item.id)} onClick={(event) => event.stopPropagation()} /></td>
                  <td className="rental-item-name-cell"><strong>{item.name || '—'}</strong><small>{[item.brand, item.model].filter(Boolean).join(' ') || '—'}</small></td>
                  <td>{isEquipmentSet(item) ? 'Zestaw' : 'Sprzęt'}</td>
                  <td className="rental-item-code-cell">{getRentalEquipmentCode(item)}</td>
                  <td>{item.category || '—'}</td>
                  <td>{item.location || '—'}</td>
                  <td><DSStatusPill value="Do wydania" /></td>
                </tr>
              ))}</tbody>
            </AppTable> : <EmptyState title="Nie dodano sprzętu do wypożyczenia" description="Użyj akcji Dodaj sprzęt w nagłówku tabeli, aby utworzyć dokument wydania." />}
          </div>
        </SectionPanel>

        <SectionPanel className="rental-record-section rental-record-terms-section" title="Warunki i rozliczenie">
          <div className="rental-terms-grid">
            <FormField className="rental-price-field" label="Cena łączna"><div className="money-input"><AppInput value={form.total_price} onChange={(event) => update('total_price', event.target.value)} placeholder={settlementOptional ? 'opcjonalnie' : 'np. 1200'} /><span>{rentalSettings.currency || 'zł'}</span></div></FormField>
            <FormField label="Kaucja"><AppInput value={form.total_deposit} onChange={(event) => update('total_deposit', event.target.value)} placeholder={settlementOptional ? 'opcjonalnie' : 'np. 500'} /></FormField>
            <FormField className="rental-notes-field" label="Notatki"><AppTextarea value={form.notes} onChange={(event) => update('notes', event.target.value)} placeholder="Warunki wydania, uwagi do klienta lub sprzętu." /></FormField>
          </div>
        </SectionPanel>
      </div>
      <div className="modal-actions"><ButtonSecondary onClick={onClose}>Anuluj</ButtonSecondary><ButtonPrimary onClick={() => onSave({ rental: form, selectedEquipmentIds })}><Save size={17} />Zapisz dokument</ButtonPrimary></div>
      <div className="modal-resize-handle" onPointerDown={startResize} title="Zmień rozmiar okna" aria-label="Zmień rozmiar okna" />
    </div>
    {rentalItemContextMenu && <div className="row-context-menu rental-item-context-menu" style={{ left: rentalItemContextMenu.x, top: rentalItemContextMenu.y }} onClick={(event) => event.stopPropagation()}>
      <div className="context-menu-title">Sprzęt</div>
      <button type="button" onClick={() => runRentalItemAction('preview')}><FolderOpen size={14} />Podgląd sprzętu</button>
      <button type="button" onClick={() => runRentalItemAction('toggle')}>{selectedRentalItemIds.has(rentalItemContextMenu.item?.id) ? <X size={14} /> : <CheckCircle2 size={14} />}{selectedRentalItemIds.has(rentalItemContextMenu.item?.id) ? 'Odznacz pozycję' : 'Zaznacz pozycję'}</button>
      <div className="context-menu-separator" />
      {selectedRentalItemIds.size > 1 && <button type="button" className="danger-action" onClick={() => runRentalItemAction('removeSelected')}><Trash2 size={14} />Usuń zaznaczone</button>}
      <button type="button" className="danger-action" onClick={() => runRentalItemAction('remove')}><Trash2 size={14} />Usuń pozycję</button>
    </div>}
  </div>;
}

function RentalEquipmentPreviewModal({ equipment, onClose }) {
  const rows = [
    ['Typ', isEquipmentSet(equipment) ? 'Zestaw' : 'Sprzęt'],
    ['Kategoria', equipment.category || '—'],
    ['Marka / model', [equipment.brand, equipment.model].filter(Boolean).join(' ') || '—'],
    ['Numer seryjny', equipment.serial || '—'],
    ['Kod / nr inw.', equipment.barcode || equipment.inventory_number || '—'],
    ['Lokalizacja', equipment.location || '—'],
    ['Kaucja', equipment.deposit || '—'],
    ['Cena / dzień', equipment.price_day || '—']
  ];

  return <ModalFrame className="rental-equipment-preview-modal" eyebrow="Sprzęt" title={equipment.name || 'Podgląd sprzętu'} onClose={onClose} footer={<ButtonSecondary onClick={onClose}>Zamknij</ButtonSecondary>}>
    <div className="rental-equipment-preview-status"><DSStatusPill value={equipment.status || '—'} /></div>
    <AppTable className="rental-equipment-preview-table">
      <tbody>{rows.map(([label, value]) => <tr key={label}><th>{label}</th><td>{value}</td></tr>)}</tbody>
    </AppTable>
  </ModalFrame>;
}

function ClientPickerModal({ clients, selectedClientId, onClose, onConfirm, onCreateClient = null }) {
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState('name');
  const [highlightedClientId, setHighlightedClientId] = useState(selectedClientId ?? '');

  const filteredClients = useMemo(() => {
    const text = query.trim().toLocaleLowerCase('pl');
    return clients
      .filter((client) => {
        const searchable = [client.name, client.type, client.client_kind, client.phone, client.email, client.city, client.nip].filter(Boolean).join(' ').toLocaleLowerCase('pl');
        return !text || searchable.includes(text);
      })
      .sort((left, right) => String(left[sortKey] ?? '').localeCompare(String(right[sortKey] ?? ''), 'pl', { numeric: true, sensitivity: 'base' }));
  }, [clients, query, sortKey]);

  useEffect(() => {
    if (filteredClients.some((client) => client.id === highlightedClientId)) return;
    setHighlightedClientId(filteredClients[0]?.id ?? '');
  }, [filteredClients, highlightedClientId]);

  const highlightedClient = filteredClients.find((client) => client.id === highlightedClientId) ?? null;
  const confirmHighlightedClient = () => {
    if (highlightedClient) onConfirm(highlightedClient);
  };

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return <ResizableModalFrame className="shared-picker-modal client-picker-modal" storageKey="fixer-client-picker-modal" defaultSize={{ width: 980, height: 640 }} minSize={{ width: 720, height: 480 }} eyebrow="Klienci" title="Wybierz klienta" onClose={onClose} footer={<ButtonSecondary onClick={onClose}>Anuluj</ButtonSecondary>}>
      <div className="shared-picker-toolbar">
        <FormField label="Szukaj"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nazwa, telefon, email, miasto, NIP" autoFocus /></FormField>
        <FormField label="Sortuj"><select value={sortKey} onChange={(event) => setSortKey(event.target.value)}><option value="name">Nazwa</option><option value="client_kind">Rodzaj</option><option value="city">Miasto</option></select></FormField>
        {onCreateClient && <AppButton variant="primary" size="sm" className="compact-button picker-create-button" onClick={onCreateClient}><Plus size={15} />Nowy klient</AppButton>}
      </div>
      <div className="shared-picker-table-shell" tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter') confirmHighlightedClient(); }}>
        <table className="set-picker-table">
          <thead><tr><th>Nazwa</th><th>Typ</th><th>Rodzaj</th><th>Telefon</th><th>Email</th><th>Miasto</th></tr></thead>
          <tbody>{filteredClients.map((client) => {
            const selected = client.id === highlightedClientId;
            return <tr key={client.id} tabIndex={0} className={selected ? 'selected-row' : ''} onClick={() => setHighlightedClientId(client.id)} onFocus={() => setHighlightedClientId(client.id)} onKeyDown={(event) => { if (event.key === 'Enter') onConfirm(client); }} onDoubleClick={() => onConfirm(client)}><td><strong>{client.name}</strong></td><td>{client.type || '—'}</td><td>{client.client_kind || '—'}</td><td>{client.phone || '—'}</td><td>{client.email || '—'}</td><td>{client.city || '—'}</td></tr>;
          })}</tbody>
        </table>
        {!filteredClients.length && <EmptyState title="Brak klientów spełniających kryteria wyszukiwania." />}
      </div>
    </ResizableModalFrame>;
}

function EquipmentPickerModal({ title = 'Wybierz sprzęt', availableItems, selectedIds = [], onClose, onConfirm }) {
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [sortKey, setSortKey] = useState('name');
  const [selectedKeys, setSelectedKeys] = useState(() => new Set(selectedIds.map(String)));

  const categories = useMemo(() => [...new Set(availableItems.map((item) => item.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pl')), [availableItems]);
  const statuses = useMemo(() => [...new Set(availableItems.map((item) => item.status).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pl')), [availableItems]);
  const locations = useMemo(() => [...new Set(availableItems.map((item) => item.location).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pl')), [availableItems]);

  const filteredItems = useMemo(() => {
    const text = query.trim().toLocaleLowerCase('pl');
    return availableItems
      .filter((item) => {
        const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
        const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
        const matchesLocation = locationFilter === 'all' || item.location === locationFilter;
        const searchable = [item.name, item.category, item.brand, item.model, item.serial, item.inventory_number, item.barcode, item.location, item.status].filter(Boolean).join(' ').toLocaleLowerCase('pl');
        return matchesCategory && matchesStatus && matchesLocation && (!text || searchable.includes(text));
      })
      .sort((left, right) => String(left[sortKey] ?? '').localeCompare(String(right[sortKey] ?? ''), 'pl', { numeric: true, sensitivity: 'base' }));
  }, [availableItems, query, categoryFilter, statusFilter, locationFilter, sortKey]);

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
    setSortKey('name');
  };

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return <ResizableModalFrame className="shared-picker-modal equipment-picker-modal" storageKey="fixer-equipment-picker-modal" defaultSize={{ width: 1080, height: 720 }} minSize={{ width: 760, height: 520 }} eyebrow="Sprzęt" title={title} onClose={onClose} footer={<><ButtonSecondary onClick={onClose}>Anuluj</ButtonSecondary><ButtonPrimary onClick={() => onConfirm(selectedItems)} disabled={!selectedItems.length}><Plus size={16} />Dodaj wybrane</ButtonPrimary></>}>
      <div className="equipment-picker-toolbar">
        <FormField label="Szukaj"><AppInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nazwa, marka, model, SN, kod" autoFocus /></FormField>
        <FormField label="Kategoria"><AppSelect value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="all">Wszystkie</option>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</AppSelect></FormField>
        <FormField label="Status"><AppSelect value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">Wszystkie</option>{statuses.map((item) => <option key={item} value={item}>{item}</option>)}</AppSelect></FormField>
        <FormField label="Lokalizacja"><AppSelect value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)}><option value="all">Wszystkie</option>{locations.map((item) => <option key={item} value={item}>{item}</option>)}</AppSelect></FormField>
        <FormField label="Sortuj"><AppSelect value={sortKey} onChange={(event) => setSortKey(event.target.value)}><option value="name">Nazwa</option><option value="category">Kategoria</option><option value="status">Status</option><option value="location">Lokalizacja</option></AppSelect></FormField>
        <ButtonGhost className="compact-table-button" onClick={clearFilters}>Wyczyść</ButtonGhost>
      </div>
      <div className="set-picker-summary"><strong>{selectedItems.length} zaznaczono</strong><span>{filteredItems.length} / {availableItems.length} dostępnych pozycji</span></div>
      <div className="shared-picker-table-shell" tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter' && selectedItems.length) onConfirm(selectedItems); }}>
        <AppTable className="set-picker-table">
          <thead><tr><th className="selection-cell"><input type="checkbox" checked={visibleAllSelected} onChange={toggleVisible} /></th><th>Nazwa</th><th>Kategoria</th><th>Marka</th><th>Model</th><th>Numer seryjny</th><th>Status</th><th>Lokalizacja</th></tr></thead>
          <tbody>{filteredItems.map((item) => {
            const key = String(getEquipmentKey(item));
            const selected = selectedKeys.has(key);
            return <tr key={key} className={selected ? 'selected-row' : ''} onDoubleClick={() => toggleItem(item)}><td className="selection-cell"><input type="checkbox" checked={selected} onChange={() => toggleItem(item)} /></td><td><strong>{item.name}</strong></td><td>{isEquipmentSet(item) ? 'Zestaw' : item.category || '—'}</td><td>{item.brand || '—'}</td><td>{item.model || '—'}</td><td>{item.serial || '—'}</td><td><DSStatusPill value={item.status} /></td><td>{item.location || '—'}</td></tr>;
          })}</tbody>
        </AppTable>
        {!filteredItems.length && <EmptyState title="Brak pozycji spełniających aktualne filtry." />}
      </div>
    </ResizableModalFrame>;
}
const SERVICE_TABLE_KEY = 'service-orders-table';
const SERVICE_TABLE_COLUMNS = [
  { key: 'service_number', label: 'Numer' },
  { key: 'client_name', label: 'Klient' },
  { key: 'equipment_name', label: 'Sprzęt' },
  { key: 'status', label: 'Status' },
  { key: 'priority', label: 'Priorytet' },
  { key: 'accepted_date_display', label: 'Przyjęcie' },
  { key: 'planned_date_display', label: 'Planowany termin' },
  { key: 'total_cost_display', label: 'Suma' }
];

function formatServiceMoney(value) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? `${number.toFixed(2).replace('.', ',')} zł` : '0,00 zł';
}

function generateServiceNumber(existingRows = []) {
  const today = new Date();
  const day = String(today.getDate()).padStart(2, '0');
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const year = String(today.getFullYear());
  const sequence = existingRows.reduce((max, row) => {
    const match = String(row.service_number ?? '').match(/SER\/(\d+)/);
    return Math.max(max, match ? Number(match[1]) : 0);
  }, 0) + 1;
  return `SER/${String(sequence).padStart(3, '0')}/${day}/${month}/${year}`;
}

function buildServiceDocumentData(order, type) {
  return {
    documentType: type === 'acceptance' ? 'Przyjęcie do serwisu' : 'Wydanie z serwisu',
    serviceNumber: order.service_number,
    status: order.status,
    priority: order.priority,
    client: order.client_name,
    equipment: order.equipment_name,
    customerDeviceName: order.customer_device_name,
    customerDeviceBrand: order.customer_device_brand,
    customerDeviceModel: order.customer_device_model,
    customerDeviceSerial: order.customer_device_serial,
    customerDeviceCode: order.customer_device_code,
    intakeCondition: order.intake_condition,
    intakeAccessories: order.intake_accessories,
    intakeVisualNotes: order.intake_visual_notes,
    acceptedDate: order.accepted_date,
    plannedDate: order.planned_date,
    completedDate: order.completed_date,
    faultDescription: order.fault_description,
    diagnosis: order.diagnosis,
    workPerformed: order.work_performed,
    partsMaterials: order.parts_materials,
    laborCost: order.labor_cost,
    partsCost: order.parts_cost,
    otherCost: order.other_cost,
    totalCost: order.total_cost
  };
}

function ServiceModule() {
  const [rows, setRows] = useState([]);
  const [clients, setClients] = useState([]);
  const [equipmentRows, setEquipmentRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  const loadServiceData = async () => {
    setLoading(true);
    const [ordersResult, clientsResult, equipmentResult] = await Promise.all([fetchServiceOrders(), fetchClients(), fetchEquipment()]);
    setRows(ordersResult.data ?? []);
    setClients(clientsResult.data ?? []);
    setEquipmentRows(equipmentResult.error ? demoEquipment : (equipmentResult.data ?? []));
    if (ordersResult.error) setNotice(`Nie udało się pobrać zleceń serwisowych z Supabase: ${ordersResult.error.message}. Sprawdź migrację 005_service_orders_schema.sql.`);
    else if (ordersResult.local) setNotice('Serwis działa w lokalnym trybie zapisu.');
    else setNotice('');
    setLoading(false);
  };

  useEffect(() => { loadServiceData(); }, []);

  const resolveClient = (order) => order.clients ?? clients.find((client) => client.id === order.client_id) ?? null;
  const resolveEquipment = (order) => order.equipment ?? equipmentRows.find((item) => item.id === order.equipment_id) ?? null;

  const tableRows = useMemo(() => rows.map((order) => {
    const client = resolveClient(order);
    const equipment = resolveEquipment(order);
    return {
      ...order,
      number: order.service_number,
      client_name: client?.name ?? '—',
      equipment_name: order.customer_device_name || equipment?.name || '—',
      accepted_date_display: formatDashboardDate(order.accepted_date),
      planned_date_display: formatDashboardDate(order.planned_date),
      total_cost_display: formatServiceMoney(order.total_cost)
    };
  }), [rows, clients, equipmentRows]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('pl');
    return tableRows.filter((order) => {
      const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
      const matchesPriority = priorityFilter === 'all' || order.priority === priorityFilter;
      const searchable = [order.service_number, order.client_name, order.equipment_name, order.customer_device_brand, order.customer_device_model, order.customer_device_serial, order.status, order.priority, order.fault_description, order.diagnosis]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('pl');
      return matchesStatus && matchesPriority && (!query || searchable.includes(query));
    });
  }, [tableRows, search, statusFilter, priorityFilter]);

  const openServiceEditor = (order = null) => {
    setEditingOrder(order);
    setEditorOpen(true);
  };

  const createNewOrder = () => {
    openServiceEditor({
      service_number: generateServiceNumber(rows),
      status: 'Przyjęte',
      priority: 'Normalny',
      accepted_date: getLocalIsoDate(),
      planned_date: '',
      completed_date: '',
      fault_description: '',
      diagnosis: '',
      work_performed: '',
      parts_materials: '',
      labor_cost: '',
      parts_cost: '',
      other_cost: '',
      total_cost: '',
      estimate_status: 'Roboczy',
      internal_notes: '',
      attachments: [],
      notes: ''
    });
  };

  const saveServiceOrder = async (order) => {
    if (!String(order.service_number ?? '').trim()) {
      alert('Numer zlecenia jest wymagany.');
      return;
    }
    if (!String(order.customer_device_name ?? '').trim() && !order.equipment_id) {
      alert('Podaj nazwę serwisowanego urządzenia albo wybierz powiązany sprzęt z bazy.');
      return;
    }
    if (!String(order.fault_description ?? '').trim()) {
      alert('Opis usterki jest wymagany.');
      return;
    }
    const result = order.id || order.localId
      ? await updateServiceOrderRecord(order.id ?? order.localId, order)
      : await createServiceOrderRecord(order);
    if (result.error) {
      alert(result.error.message);
      return;
    }
    if (result.local) setNotice('Zlecenie zapisano lokalnie, ponieważ Supabase nie jest skonfigurowany.');
    setEditorOpen(false);
    await loadServiceData();
  };

  const deleteServiceOrder = async (order) => {
    if (order.status === 'Wydane') {
      alert('Nie można usunąć zlecenia wydanego.');
      return;
    }
    if (!confirm(`Usunąć zlecenie ${order.service_number}?`)) return;
    const { error, local } = await deleteServiceOrderRecord(order.id ?? order.localId, order);
    if (error) {
      alert(error.message);
      return;
    }
    if (local) setNotice('Zlecenie usunięto lokalnie.');
    await loadServiceData();
  };

  const changeServiceStatus = async (order) => {
    const nextStatus = prompt(`Nowy status:\n${SERVICE_STATUSES.join('\n')}`, order.status);
    if (!nextStatus) return;
    const normalized = SERVICE_STATUSES.find((status) => status.toLocaleLowerCase('pl') === nextStatus.trim().toLocaleLowerCase('pl'));
    if (!normalized) {
      alert('Wybierz jeden z domyślnych statusów serwisu.');
      return;
    }
    await saveServiceOrder({ ...order, status: normalized, completed_date: normalized === 'Wydane' ? (order.completed_date || getLocalIsoDate()) : order.completed_date });
  };

  const createServiceDocument = (order, type) => {
    const data = buildServiceDocumentData(order, type);
    const suffix = type === 'acceptance' ? 'przyjecie' : 'wydanie';
    downloadTextFile(`${normalizeFileNamePart(order.service_number)}-${suffix}.json`, JSON.stringify(data, null, 2), 'application/json;charset=utf-8');
    setNotice(type === 'acceptance' ? 'Przygotowano dane dokumentu przyjęcia do serwisu.' : 'Przygotowano dane dokumentu wydania z serwisu.');
  };

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setPriorityFilter('all');
  };

  return <div className="module-page service-module-page">
    <section className="panel hero-panel service-hero-panel">
      <p className="eyebrow">Moduł</p><h2>Serwis</h2>
      <p className="muted">Zlecenia serwisowe, przyjęcia sprzętu, diagnoza, naprawa, koszty oraz dokumenty przyjęcia i wydania.</p>
      <div className="module-actions">
        <AppButton variant="primary" className="module-action-button" onClick={createNewOrder}><Plus size={18} />Nowe zlecenie</AppButton>
        <AppButton variant="secondary" className="module-action-button" onClick={loadServiceData}>Odśwież</AppButton>
      </div>
      {notice && <div className="notice">{notice}</div>}
    </section>
    <section className="panel service-list-panel">
      <div className="client-filter-bar service-filter-bar">
        <label>Szukaj<AppInput value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Numer, klient, sprzęt, opis, diagnoza" /></label>
        <label>Status<AppSelect value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">Wszystkie</option>{SERVICE_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</AppSelect></label>
        <label>Priorytet<AppSelect value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}><option value="all">Wszystkie</option>{SERVICE_PRIORITIES.map((priority) => <option key={priority} value={priority}>{priority}</option>)}</AppSelect></label>
        <AppButton variant="secondary" size="sm" className="compact-button" onClick={clearFilters}>Wyczyść filtry</AppButton>
        <span className="filter-count">{filteredRows.length} / {rows.length}</span>
      </div>
      <DataTable
        storageKey={SERVICE_TABLE_KEY}
        loading={loading}
        columns={SERVICE_TABLE_COLUMNS}
        rows={filteredRows}
        onOpen={openServiceEditor}
        onEdit={openServiceEditor}
        onDelete={deleteServiceOrder}
        canDelete={(order) => order.status !== 'Wydane'}
        openLabel="Otwórz"
        editLabel="Otwórz kartotekę"
        deleteLabel="Usuń zlecenie"
        customRowActions={[
          { key: 'status', label: 'Zmień status', icon: SlidersHorizontal, onClick: changeServiceStatus },
          { key: 'acceptance', label: 'Utwórz dokument przyjęcia', icon: FileText, onClick: (order) => createServiceDocument(order, 'acceptance') },
          { key: 'release', label: 'Utwórz dokument wydania', icon: Download, onClick: (order) => createServiceDocument(order, 'release') }
        ]}
      />
    </section>
    {editorOpen && <ServiceOrderEditor order={editingOrder} clients={clients} equipmentRows={equipmentRows} existingRows={rows} onClose={() => setEditorOpen(false)} onSave={saveServiceOrder} />}
  </div>;
}

function formatServiceDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function ServiceOrderEditor({ order, clients, equipmentRows, existingRows, onClose, onSave }) {
  const [activeTab, setActiveTab] = useState('basic');
  const [form, setForm] = useState(() => ({
    service_number: order?.service_number || generateServiceNumber(existingRows),
    status: order?.status || 'Przyjęte',
    priority: order?.priority || 'Normalny',
    client_id: order?.client_id || order?.clients?.id || '',
    equipment_id: order?.equipment_id || order?.equipment?.id || '',
    accepted_date: order?.accepted_date || getLocalIsoDate(),
    planned_date: order?.planned_date || '',
    completed_date: order?.completed_date || '',
    customer_device_name: order?.customer_device_name || order?.equipment?.name || '',
    customer_device_brand: order?.customer_device_brand || '',
    customer_device_model: order?.customer_device_model || '',
    customer_device_serial: order?.customer_device_serial || order?.equipment?.serial || '',
    customer_device_code: order?.customer_device_code || order?.equipment?.barcode || order?.equipment?.inventory_number || '',
    customer_device_category: order?.customer_device_category || '',
    intake_condition: order?.intake_condition || 'Dobry',
    intake_accessories: order?.intake_accessories || '',
    intake_visual_notes: order?.intake_visual_notes || '',
    fault_description: order?.fault_description || '',
    diagnosis: order?.diagnosis || '',
    work_performed: order?.work_performed || '',
    parts_materials: order?.parts_materials || '',
    labor_cost: order?.labor_cost ?? '',
    parts_cost: order?.parts_cost ?? '',
    other_cost: order?.other_cost ?? '',
    total_cost: order?.total_cost ?? '',
    estimate_status: order?.estimate_status || 'Roboczy',
    internal_notes: order?.internal_notes || order?.notes || '',
    attachments: Array.isArray(order?.attachments) ? order.attachments : [],
    notes: order?.notes || '',
    id: order?.id,
    localId: order?.localId
  }));
  const [localClients, setLocalClients] = useState(clients);
  const [clientPickerOpen, setClientPickerOpen] = useState(false);
  const [clientEditorOpen, setClientEditorOpen] = useState(false);
  const [equipmentPickerOpen, setEquipmentPickerOpen] = useState(false);
  const [progressRows, setProgressRows] = useState([]);
  const [progressNotice, setProgressNotice] = useState('');
  const [newProgressText, setNewProgressText] = useState('');
  const [editingProgressId, setEditingProgressId] = useState(null);
  const [editingProgressText, setEditingProgressText] = useState('');
  const [newAttachmentName, setNewAttachmentName] = useState('');
  const [newAttachmentUrl, setNewAttachmentUrl] = useState('');
  const [newAttachmentType, setNewAttachmentType] = useState('Zdjęcie');

  const orderId = form.id ?? form.localId;
  const selectedClient = localClients.find((client) => client.id === form.client_id) ?? order?.clients ?? null;
  const selectedEquipment = equipmentRows.find((item) => item.id === form.equipment_id) ?? order?.equipment ?? null;
  const categories = [...new Set(['Kamera', 'Obiektyw', 'Audio', 'Oświetlenie', 'Komputer', 'Akcesoria', ...equipmentRows.map((item) => item.category).filter(Boolean), form.customer_device_category].filter(Boolean))];
  const conditions = [...new Set([...(DEFAULT_CONFIG_DICTIONARIES.equipmentConditions ?? []), form.intake_condition].filter(Boolean))];
  const laborCost = Number(String(form.labor_cost || 0).replace(',', '.')) || 0;
  const partsCost = Number(String(form.parts_cost || 0).replace(',', '.')) || 0;
  const otherCost = Number(String(form.other_cost || 0).replace(',', '.')) || 0;
  const calculatedTotal = laborCost + partsCost + otherCost;

  const update = (key, value) => {
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (['labor_cost', 'parts_cost', 'other_cost'].includes(key)) {
        const nextLabor = Number(String((key === 'labor_cost' ? value : current.labor_cost) || 0).replace(',', '.')) || 0;
        const nextParts = Number(String((key === 'parts_cost' ? value : current.parts_cost) || 0).replace(',', '.')) || 0;
        const nextOther = Number(String((key === 'other_cost' ? value : current.other_cost) || 0).replace(',', '.')) || 0;
        next.total_cost = (nextLabor + nextParts + nextOther).toFixed(2);
      }
      if (key === 'status' && value === 'Wydane' && !next.completed_date) next.completed_date = getLocalIsoDate();
      return next;
    });
  };

  const loadProgress = async () => {
    if (!orderId) return;
    const { data, error, local } = await fetchServiceOrderProgress(orderId);
    if (error) {
      setProgressNotice(`Nie udało się pobrać postępów z Supabase: ${error.message}`);
      return;
    }
    setProgressRows(data ?? []);
    setProgressNotice(local ? 'Postępy działają lokalnie, ponieważ Supabase nie jest skonfigurowany.' : '');
  };

  useEffect(() => { loadProgress(); }, [orderId]);
  useEffect(() => { setLocalClients(clients); }, [clients]);

  const chooseClient = (client) => {
    update('client_id', client.id);
    setClientPickerOpen(false);
  };

  const openNewClientEditor = () => {
    setClientPickerOpen(false);
    setClientEditorOpen(true);
  };

  const saveNewClientFromService = async (client) => {
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
    const result = await createClientRecord(payload);
    if (result.error) {
      alert(result.error.message);
      return;
    }
    setClientEditorOpen(false);
    setLocalClients((current) => [result.data, ...current.filter((item) => item.id !== result.data.id)]);
    setForm((current) => ({ ...current, client_id: result.data.id }));
  };

  const chooseEquipment = (items) => {
    const item = Array.isArray(items) ? items[0] : items;
    if (!item) return;
    setForm((current) => ({
      ...current,
      equipment_id: item.id,
      customer_device_name: current.customer_device_name || item.name || '',
      customer_device_brand: current.customer_device_brand || item.brand || '',
      customer_device_model: current.customer_device_model || item.model || '',
      customer_device_serial: current.customer_device_serial || item.serial || '',
      customer_device_code: current.customer_device_code || item.barcode || item.inventory_number || '',
      customer_device_category: current.customer_device_category || item.category || ''
    }));
    setEquipmentPickerOpen(false);
  };

  const clearEquipmentLink = () => update('equipment_id', '');

  const submit = () => {
    onSave({ ...order, ...form, total_cost: form.total_cost || calculatedTotal.toFixed(2) });
  };

  const addProgress = async () => {
    if (!orderId) {
      setProgressNotice('Najpierw zapisz zlecenie, potem dodaj wpis postępu.');
      return;
    }
    const { error, local } = await createServiceOrderProgress(orderId, newProgressText, demoUser.name);
    if (error) {
      setProgressNotice(`Nie udało się zapisać postępu w Supabase: ${error.message}`);
      return;
    }
    setNewProgressText('');
    setProgressNotice(local ? 'Wpis postępu zapisano lokalnie.' : '');
    await loadProgress();
  };

  const saveProgressEdit = async (entry) => {
    const { error, local } = await updateServiceOrderProgress(entry.id ?? entry.localId, editingProgressText, entry);
    if (error) {
      setProgressNotice(`Nie udało się zaktualizować wpisu w Supabase: ${error.message}`);
      return;
    }
    setEditingProgressId(null);
    setEditingProgressText('');
    setProgressNotice(local ? 'Wpis postępu zapisano lokalnie.' : '');
    await loadProgress();
  };

  const removeProgress = async (entry) => {
    if (!confirm('Usunąć wpis postępu?')) return;
    const { error, local } = await deleteServiceOrderProgress(entry.id ?? entry.localId, entry);
    if (error) {
      setProgressNotice(`Nie udało się usunąć wpisu w Supabase: ${error.message}`);
      return;
    }
    setProgressNotice(local ? 'Wpis postępu usunięto lokalnie.' : '');
    await loadProgress();
  };

  const addAttachment = () => {
    const name = newAttachmentName.trim();
    const url = newAttachmentUrl.trim();
    if (!name && !url) return;
    update('attachments', [...form.attachments, { name: name || url, url, type: newAttachmentType }]);
    setNewAttachmentName('');
    setNewAttachmentUrl('');
    setNewAttachmentType('Zdjęcie');
  };

  const removeAttachment = (index) => update('attachments', form.attachments.filter((_, itemIndex) => itemIndex !== index));

  const tabs = [
    { id: 'basic', label: 'Dane podstawowe' },
    { id: 'progress', label: 'Postępy' },
    { id: 'photos', label: 'Zdjęcia' },
    { id: 'estimate', label: 'Kosztorys' },
    { id: 'notes', label: 'Notatki' }
  ];

  if (clientPickerOpen) {
    return <ClientPickerModal clients={localClients} selectedClientId={form.client_id} onClose={() => setClientPickerOpen(false)} onConfirm={chooseClient} onCreateClient={openNewClientEditor} />;
  }

  if (clientEditorOpen) {
    return <ClientEditor client={null} initialTab="data" onClose={() => { setClientEditorOpen(false); setClientPickerOpen(true); }} onSave={saveNewClientFromService} />;
  }

  if (equipmentPickerOpen) {
    return <EquipmentPickerModal title="Opcjonalnie powiąż ze sprzętem z magazynu" availableItems={equipmentRows.filter((item) => !isEquipmentSetComponent(item))} selectedIds={form.equipment_id ? [form.equipment_id] : []} onClose={() => setEquipmentPickerOpen(false)} onConfirm={chooseEquipment} />;
  }

  return <ResizableModalFrame
    className="service-order-modal"
    storageKey="fixer-service-order-modal"
    defaultSize={{ width: 1160, height: 740 }}
    minSize={{ width: 820, height: 580 }}
    eyebrow="Serwis"
    title={form.service_number || 'Nowe zlecenie'}
    description="Kartoteka zlecenia serwisowego"
    onClose={onClose}
    footer={<><ButtonSecondary onClick={onClose}>Anuluj</ButtonSecondary><ButtonPrimary onClick={submit}><Save size={16} />Zapisz</ButtonPrimary></>}
  >
    <div className="service-order-tabs" role="tablist" aria-label="Sekcje zlecenia serwisowego">
      {tabs.map((tab) => <button key={tab.id} type="button" className={activeTab === tab.id ? 'active' : ''} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>)}
    </div>
    <div className="service-order-tab-panel">
      {activeTab === 'basic' && <div className="service-tab-content">
        <SectionPanel className="service-record-section service-record-main" title="Dane zlecenia">
          <div className="service-form-grid service-form-grid-main">
            <FormField label="Numer zlecenia"><AppInput value={form.service_number} onChange={(event) => update('service_number', event.target.value)} /></FormField>
            <FormField label="Status"><AppSelect value={form.status} onChange={(event) => update('status', event.target.value)}>{SERVICE_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</AppSelect></FormField>
            <FormField label="Priorytet"><AppSelect value={form.priority} onChange={(event) => update('priority', event.target.value)}>{SERVICE_PRIORITIES.map((priority) => <option key={priority} value={priority}>{priority}</option>)}</AppSelect></FormField>
            <FormField label="Data przyjęcia"><AppInput type="date" value={form.accepted_date} onChange={(event) => update('accepted_date', event.target.value)} /></FormField>
            <FormField label="Planowany termin"><AppInput type="date" value={form.planned_date || ''} onChange={(event) => update('planned_date', event.target.value)} /></FormField>
            <FormField label="Data zakończenia"><AppInput type="date" value={form.completed_date || ''} onChange={(event) => update('completed_date', event.target.value)} /></FormField>
          </div>
        </SectionPanel>

        <SectionPanel className="service-record-section" title="Klient i sprzęt klienta">
          <div className="service-customer-device-grid">
            <div className="service-link-row">
              <button type="button" className={`service-link-card service-client-chip ${selectedClient ? 'selected' : ''}`} onClick={() => setClientPickerOpen(true)}>
                <span>Klient</span>
                <strong>{selectedClient?.name || 'Wybierz klienta'}</strong>
                <small>{selectedClient?.phone || selectedClient?.email || 'Kliknij, aby wybrać'}</small>
                <em>Zmień</em>
              </button>
              <div className="service-linked-equipment-box">
                <span>Powiązanie z magazynem</span>
                <strong>{selectedEquipment?.name || 'Brak powiązania'}</strong>
                <div className="service-inline-actions"><AppButton variant="secondary" size="sm" onClick={() => setEquipmentPickerOpen(true)}>Wybierz</AppButton>{form.equipment_id && <AppButton variant="secondary" size="sm" onClick={clearEquipmentLink}>Odłącz</AppButton>}</div>
              </div>
            </div>
            <div className="service-device-fields-grid">
              <FormField label="Nazwa urządzenia"><AppInput value={form.customer_device_name} onChange={(event) => update('customer_device_name', event.target.value)} placeholder="np. Sony PXW-Z190 klienta" /></FormField>
              <FormField label="Marka"><AppInput value={form.customer_device_brand} onChange={(event) => update('customer_device_brand', event.target.value)} /></FormField>
              <FormField label="Model"><AppInput value={form.customer_device_model} onChange={(event) => update('customer_device_model', event.target.value)} /></FormField>
              <FormField label="Numer seryjny"><AppInput value={form.customer_device_serial} onChange={(event) => update('customer_device_serial', event.target.value)} /></FormField>
              <FormField label="Kod / numer"><AppInput value={form.customer_device_code} onChange={(event) => update('customer_device_code', event.target.value)} /></FormField>
              <FormField label="Kategoria"><AppSelect value={form.customer_device_category} onChange={(event) => update('customer_device_category', event.target.value)}><option value="">Wybierz</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</AppSelect></FormField>
            </div>
            <div className="service-intake-fields-grid">
              <FormField label="Stan przyjęcia"><AppSelect value={form.intake_condition} onChange={(event) => update('intake_condition', event.target.value)}>{conditions.map((condition) => <option key={condition} value={condition}>{condition}</option>)}</AppSelect></FormField>
              <FormField label="Akcesoria"><AppTextarea value={form.intake_accessories} onChange={(event) => update('intake_accessories', event.target.value)} placeholder="np. zasilacz, futerał, karta pamięci" /></FormField>
              <FormField label="Opis wizualny / uwagi"><AppTextarea value={form.intake_visual_notes} onChange={(event) => update('intake_visual_notes', event.target.value)} placeholder="np. rysy na obudowie, brak zaślepki, ślady zalania" /></FormField>
            </div>
          </div>
        </SectionPanel>

        <SectionPanel className="service-record-section service-text-section" title="Opis i przebieg">
          <div className="service-text-grid">
            <FormField label="Opis usterki"><AppTextarea value={form.fault_description} onChange={(event) => update('fault_description', event.target.value)} placeholder="Co zgłasza klient / operator?" /></FormField>
            <FormField label="Diagnoza"><AppTextarea value={form.diagnosis} onChange={(event) => update('diagnosis', event.target.value)} /></FormField>
            <FormField label="Wykonane czynności"><AppTextarea value={form.work_performed} onChange={(event) => update('work_performed', event.target.value)} /></FormField>
          </div>
        </SectionPanel>
      </div>}

      {activeTab === 'progress' && <div className="service-tab-content">
        <SectionPanel className="service-record-section" title="Postępy serwisowania">
          {progressNotice && <div className="notice">{progressNotice}</div>}
          <div className="service-progress-add">
            <FormField label="Nowy wpis"><AppTextarea value={newProgressText} onChange={(event) => setNewProgressText(event.target.value)} placeholder="Krótki opis wykonanej czynności lub statusu prac" /></FormField>
            <AppButton variant="primary" size="sm" onClick={addProgress}>Dodaj wpis</AppButton>
          </div>
          <div className="service-progress-list">
            {progressRows.map((entry) => {
              const isEditing = editingProgressId === (entry.id ?? entry.localId);
              return <div className="service-progress-row" key={entry.id ?? entry.localId}>
                <div className="service-progress-meta"><strong>{entry.operator_name || 'Operator'}</strong><span>{formatServiceDateTime(entry.created_at)}{entry.updated_at && entry.updated_at !== entry.created_at ? ` · ed. ${formatServiceDateTime(entry.updated_at)}` : ''}</span></div>
                {isEditing ? <AppTextarea value={editingProgressText} onChange={(event) => setEditingProgressText(event.target.value)} /> : <p>{entry.entry_text}</p>}
                <div className="service-inline-actions">{isEditing ? <><AppButton variant="secondary" size="sm" onClick={() => saveProgressEdit(entry)}>Zapisz</AppButton><AppButton variant="secondary" size="sm" onClick={() => { setEditingProgressId(null); setEditingProgressText(''); }}>Anuluj</AppButton></> : <><AppButton variant="secondary" size="sm" onClick={() => { setEditingProgressId(entry.id ?? entry.localId); setEditingProgressText(entry.entry_text); }}>Edytuj</AppButton><AppButton variant="secondary" size="sm" onClick={() => removeProgress(entry)}>Usuń</AppButton></>}</div>
              </div>;
            })}
            {!progressRows.length && <EmptyState title={orderId ? 'Brak wpisów postępu.' : 'Zapisz zlecenie, aby dodać postępy.'} />}
          </div>
        </SectionPanel>
      </div>}

      {activeTab === 'photos' && <div className="service-tab-content">
        <SectionPanel className="service-record-section" title="Zdjęcia i załączniki">
          <div className="attachment-add-grid service-attachment-add-grid">
            <AppInput value={newAttachmentName} onChange={(event) => setNewAttachmentName(event.target.value)} placeholder="Nazwa zdjęcia / załącznika" />
            <AppInput value={newAttachmentUrl} onChange={(event) => setNewAttachmentUrl(event.target.value)} placeholder="Link, opis lub identyfikator pliku" />
            <AppSelect value={newAttachmentType} onChange={(event) => setNewAttachmentType(event.target.value)}><option>Zdjęcie</option><option>Protokół</option><option>Inny</option></AppSelect>
            <AppButton variant="secondary" size="sm" onClick={addAttachment}>Dodaj</AppButton>
          </div>
          <div className="equipment-list-box">
            {form.attachments.length ? form.attachments.map((item, index) => <div key={`${item.name}-${index}`} className="equipment-list-row"><span><strong>{item.type || 'Załącznik'}:</strong> {item.name || item.url}{item.url && item.name ? ` — ${item.url}` : ''}</span><button type="button" className="ghost-mini-button" onClick={() => removeAttachment(index)}>Usuń</button></div>) : <p className="muted">Upload plików nie jest jeszcze podłączony. Możesz zapisać opis/link załącznika w strukturze zlecenia.</p>}
          </div>
        </SectionPanel>
      </div>}

      {activeTab === 'estimate' && <div className="service-tab-content">
        <SectionPanel className="service-record-section" title="Kosztorys">
          <div className="service-estimate-grid">
            <FormField className="service-wide-field" label="Części / materiały"><AppTextarea value={form.parts_materials} onChange={(event) => update('parts_materials', event.target.value)} /></FormField>
            <FormField label="Koszt części"><div className="money-input"><AppInput value={form.parts_cost} onChange={(event) => update('parts_cost', event.target.value)} placeholder="0,00" /><span>zł</span></div></FormField>
            <FormField label="Koszt robocizny"><div className="money-input"><AppInput value={form.labor_cost} onChange={(event) => update('labor_cost', event.target.value)} placeholder="0,00" /><span>zł</span></div></FormField>
            <FormField label="Inne koszty"><div className="money-input"><AppInput value={form.other_cost} onChange={(event) => update('other_cost', event.target.value)} placeholder="0,00" /><span>zł</span></div></FormField>
            <FormField label="Status kosztorysu"><AppSelect value={form.estimate_status} onChange={(event) => update('estimate_status', event.target.value)}>{SERVICE_ESTIMATE_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</AppSelect></FormField>
            <div className="service-total-box"><span>Suma</span><strong>{formatServiceMoney(form.total_cost || calculatedTotal)}</strong></div>
          </div>
        </SectionPanel>
      </div>}

      {activeTab === 'notes' && <div className="service-tab-content">
        <SectionPanel className="service-record-section" title="Notatki wewnętrzne">
          <FormField label="Notatki operatora"><AppTextarea className="large-notes" value={form.internal_notes} onChange={(event) => update('internal_notes', event.target.value)} placeholder="Wewnętrzne informacje dla obsługi. Nie mieszać z postępami serwisowymi." /></FormField>
        </SectionPanel>
      </div>}
    </div>
  </ResizableModalFrame>;
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
  return <div className="module-page"><section className="panel hero-panel"><p className="eyebrow">Moduł</p><h2>{title}</h2><p className="muted">{description}</p><div className="module-actions"><AppButton variant="primary">Dodaj wpis</AppButton><AppButton variant="secondary">Eksport PDF</AppButton><AppButton variant="secondary">Ustawienia modułu</AppButton></div></section><section className="panel">{table}</section></div>;
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

const RENTAL_NUMBERING_STORAGE_KEY = 'fixer-rental-numbering';
const DEFAULT_RENTAL_NUMBERING = {
  prefix: 'WYP',
  format: 'PREFIX/NR/DD/MM/YYYY',
  padding: 3,
  defaultReturnDays: 7,
  currency: 'zł'
};
const RENTAL_NUMBER_FORMATS = [
  { value: 'PREFIX/NR/DD/MM/YYYY', label: 'WYP/nr/DD/MM/RRRR' },
  { value: 'PREFIX/YYYY/MM/NR', label: 'WYP/RRRR/MM/nr' },
  { value: 'PREFIX/YYYY/NR', label: 'WYP/RRRR/nr' }
];
const CONFIG_DICTIONARY_STORAGE_KEY = 'fixer-config-dictionaries';
const DEFAULT_CONFIG_DICTIONARIES = {
  equipmentConditions: ['Nowy', 'Bardzo dobry', 'Dobry', 'Do kontroli', 'Uszkodzony', 'Wycofany'],
  rentalTypes: ['Płatne', 'Bezpłatne', 'Wewnętrzne'],
  returnConditions: ['Sprawny', 'Uszkodzony', 'Brak akcesoriów', 'Wymaga kontroli', 'Serwis']
};

function getRentalNumberingSettings() {
  const saved = getStoredJson(RENTAL_NUMBERING_STORAGE_KEY, DEFAULT_RENTAL_NUMBERING);
  return {
    ...DEFAULT_RENTAL_NUMBERING,
    ...saved,
    prefix: String(saved.prefix ?? DEFAULT_RENTAL_NUMBERING.prefix).trim() || DEFAULT_RENTAL_NUMBERING.prefix
  };
}

function saveRentalNumberingSettings(settings) {
  const next = {
    ...DEFAULT_RENTAL_NUMBERING,
    ...settings,
    prefix: String(settings.prefix ?? '').trim().toUpperCase() || DEFAULT_RENTAL_NUMBERING.prefix
  };
  localStorage.setItem(RENTAL_NUMBERING_STORAGE_KEY, JSON.stringify(next));
  return next;
}

function formatRentalNumber(settings, sequence, date = new Date()) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear());
  const nr = String(sequence).padStart(Number(settings.padding) || 3, '0');
  const parts = {
    PREFIX: settings.prefix || DEFAULT_RENTAL_NUMBERING.prefix,
    NR: nr,
    DD: day,
    MM: month,
    YYYY: year
  };
  return (settings.format || DEFAULT_RENTAL_NUMBERING.format)
    .split('/')
    .map((part) => parts[part] ?? part)
    .join('/');
}

function getNextRentalSequence(rentalsList, settings) {
  const formatParts = (settings.format || DEFAULT_RENTAL_NUMBERING.format).split('/');
  const nrIndex = formatParts.indexOf('NR');
  const prefixIndex = formatParts.indexOf('PREFIX');
  const expectedPrefix = settings.prefix || DEFAULT_RENTAL_NUMBERING.prefix;
  return (rentalsList ?? []).reduce((max, rental) => {
    const parts = String(rental?.rental_number ?? '').split('/');
    if (nrIndex < 0 || prefixIndex < 0 || parts[prefixIndex] !== expectedPrefix) return max;
    return Math.max(max, Number(parts[nrIndex]) || 0);
  }, 0) + 1;
}

function generateNextRentalNumber(rentalsList, settings = getRentalNumberingSettings()) {
  return formatRentalNumber(settings, getNextRentalSequence(rentalsList, settings));
}

function normalizeConfigDictionary(key, value) {
  const fallback = DEFAULT_CONFIG_DICTIONARIES[key] ?? [];
  const rows = Array.isArray(value) ? value : fallback.map((name) => ({ name, active: true }));
  const normalized = rows
    .map((item) => typeof item === 'string' ? { name: item, active: true } : { name: String(item?.name ?? '').trim(), active: item?.active !== false })
    .filter((item) => item.name);
  return normalized.length ? normalized : fallback.map((name) => ({ name, active: true }));
}

function getConfigDictionaries() {
  const saved = getStoredJson(CONFIG_DICTIONARY_STORAGE_KEY, {});
  return Object.fromEntries(Object.keys(DEFAULT_CONFIG_DICTIONARIES).map((key) => [key, normalizeConfigDictionary(key, saved[key])]));
}

function saveConfigDictionaries(next) {
  const normalized = Object.fromEntries(Object.keys(DEFAULT_CONFIG_DICTIONARIES).map((key) => [key, normalizeConfigDictionary(key, next[key])]));
  localStorage.setItem(CONFIG_DICTIONARY_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

function getActiveConfigDictionaryNames(key) {
  return normalizeConfigDictionary(key, getConfigDictionaries()[key]).filter((item) => item.active).map((item) => item.name);
}

function addDaysToIsoDate(isoDate, days) {
  if (!isoDate || !Number(days)) return '';
  const date = new Date(`${isoDate}T00:00:00`);
  date.setDate(date.getDate() + Number(days));
  return date.toISOString().slice(0, 10);
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

function DataTable({ columns, rows, storageKey, loading = false, onOpen, onEdit, onDuplicate, onHistory, onDelete, onBulkDelete, customRowActions = [], isRowLocked = null, isRowExpandable = null, renderExpandedRow = null, canDelete = () => true, openLabel = 'Otwórz', editLabel = 'Edytuj', deleteLabel = 'Usuń' }) {
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
        <AppButton variant="secondary" size="sm" className="compact-table-button" onClick={clearSelection} disabled={bulkBusy}>Odznacz</AppButton>
        {onBulkDelete && <AppButton variant="danger" size="sm" className="compact-table-button danger-bulk-button" onClick={runBulkDelete} disabled={bulkBusy}><Trash2 size={14} />Usuń zaznaczone</AppButton>}
      </div>}
      <div className="table-scroll">
        <AppTable>
          <colgroup>{hasSelectionActions && <col className="selection-col" />}{hasExpandableRows && <col className="expand-col" />}{activeColumns.map((column) => <col key={column.key} style={{ width: columnWidths[column.key] ? `${columnWidths[column.key]}px` : undefined }} />)}</colgroup>
          <thead><tr>{hasSelectionActions && <th className="selection-cell selection-header" onClick={(event) => event.stopPropagation()}><input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisibleRows} aria-label="Zaznacz wszystkie widoczne pozycje" /></th>}{hasExpandableRows && <th className="expand-cell expand-header" aria-label="Rozwiń wiersz" />}{activeColumns.map((column) => <th key={column.key} draggable onContextMenu={(event) => openColumnMenu(event, column.key)} onDragStart={(event) => { setDraggedColumn(column.key); event.dataTransfer.effectAllowed = 'move'; }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); moveColumn(draggedColumn, column.key); setDraggedColumn(null); }} onDragEnd={() => setDraggedColumn(null)} onClick={() => handleSort(column.key)} className={draggedColumn === column.key ? 'dragging-column' : ''}><span><GripVertical size={14} />{column.label}</span>{sortKey === column.key && <em>{sortDir === 'asc' ? '↑' : '↓'}</em>}<button type="button" className="column-resizer" aria-label={`Zmień szerokość kolumny ${column.label}`} onMouseDown={(event) => startResize(event, column.key)} /></th>)}</tr></thead>
          <tbody>{sortedRows.map((row, index) => {
            const rowKey = getRowKey(row, index);
            const selected = selectedRowKeys.has(rowKey);
            const expandable = hasExpandableRows && isRowExpandable?.(row);
            const expanded = expandable && expandedRowKeys.has(rowKey);
            const rowToneClass = row._rowTone ? `row-tone-${row._rowTone}` : '';
            const rowClass = `${hasActions ? 'editable-row' : ''} ${selected ? 'selected-row' : ''} ${expandable ? 'expandable-row' : ''} ${expanded ? 'expanded-row' : ''} ${rowToneClass}`.trim();
            return <Fragment key={`${row.id ?? row.localId ?? row.number ?? row.name}-${index}`}>
              <tr tabIndex={hasActions ? 0 : undefined} className={rowClass} onClick={(event) => { if (event.target.closest('button, input, select, textarea, a')) return; if (expandable) toggleExpandedRow(row, index); }} onKeyDown={(event) => { if (event.key === 'Enter' && hasActions) (onOpen ?? onEdit)?.(row); }} onDoubleClick={() => (typeof isRowLocked === 'function' && isRowLocked(row)) ? alert('Ta pozycja jest składnikiem zestawu. Operacje są zablokowane do czasu usunięcia jej z zestawu.') : (onOpen ?? onEdit)?.(row)} onContextMenu={(event) => openRowMenu(event, row)} title={expandable ? 'Kliknij, żeby rozwinąć zawartość zestawu. Dwuklik otwiera kartotekę.' : hasActions ? 'Dwuklik lub Enter otwiera kartotekę. Prawy klik pokazuje operacje.' : 'Prawy klik pokazuje operacje tabeli.'}>{hasSelectionActions && <td className="selection-cell"><input type="checkbox" checked={selected} onChange={() => toggleRowSelection(row, index)} onClick={(event) => event.stopPropagation()} aria-label="Zaznacz pozycję" /></td>}{hasExpandableRows && <td className="expand-cell">{expandable && <button type="button" className="row-expand-button" onClick={(event) => { event.stopPropagation(); toggleExpandedRow(row, index); }} aria-label={expanded ? 'Zwiń zestaw' : 'Rozwiń zestaw'}>{expanded ? '▾' : '▸'}</button>}</td>}{activeColumns.map((column) => <td key={column.key}>{column.key === 'status' || column.key === 'client_kind' ? <StatusPill value={row[column.key]} /> : row[column.key]}</td>)}</tr>
              {expanded && <tr className="expanded-content-row"><td colSpan={activeColumns.length + (hasSelectionActions ? 1 : 0) + (hasExpandableRows ? 1 : 0)}>{renderExpandedRow(row)}</td></tr>}
            </Fragment>;
          })}</tbody>
        </AppTable>
      </div>

      {rowContextMenu && <div className="row-context-menu" style={{ left: rowContextMenu.x, top: rowContextMenu.y }} onClick={(event) => event.stopPropagation()}>
        <div className="context-menu-title">Operacje</div>
        {(onOpen || onEdit) && <button type="button" onClick={() => runRowAction('open')}><FolderOpen size={14} />{openLabel}</button>}
        {onEdit && <button type="button" onClick={() => runRowAction('edit')}><Save size={14} />{editLabel}</button>}
        {onDuplicate && <button type="button" onClick={() => runRowAction('duplicate')}><FilePlus2 size={14} />Duplikuj</button>}
        {onHistory && <button type="button" onClick={() => runRowAction('history')}><History size={14} />Historia</button>}
        {customRowActions.filter((action) => !action.visible || action.visible(rowContextMenu.row)).map((action) => {
          const Icon = action.icon ?? Package;
          return <button key={action.key} type="button" className={action.className ?? ''} onClick={() => runRowAction(`custom:${action.key}`)}><Icon size={14} />{action.label}</button>;
        })}
        <div className="context-menu-separator" />
        <button type="button" onClick={() => runRowAction('copyName')}><Copy size={14} />Kopiuj nazwę</button>
        {(rowContextMenu.row?.id || rowContextMenu.row?.localId || rowContextMenu.row?.number) && <button type="button" onClick={() => runRowAction('copyId')}><Copy size={14} />Kopiuj ID / numer</button>}
        {onDelete && canDelete(rowContextMenu.row) && <><div className="context-menu-separator" /><button type="button" className="danger-action" onClick={() => runRowAction('delete')}><Trash2 size={14} />{deleteLabel}</button></>}
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
  const tone = lower.includes('przetermin') || lower.includes('po terminie') || lower.includes('problematyczny') || lower.includes('zablokowany') || lower.includes('uszk') ? 'danger'
    : lower.includes('zwró') || lower.includes('zwro') || lower.includes('dostęp') || lower.includes('dostep') || lower.includes('sprawny') || lower.includes('gotowe') || lower.includes('vip') || lower.includes('stały') || lower.includes('staly') ? 'success'
    : lower.includes('serwis') || lower.includes('kontrol') || lower.includes('brak akces') || lower.includes('rezerwacja') || lower.includes('pracownik') || lower.includes('nowy') ? 'warning'
    : lower.includes('aktywn') || lower.includes('wypo') || lower.includes('wydania') ? 'info'
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
  const [editingClientType, setEditingClientType] = useState(null);
  const [editingClientTypeValue, setEditingClientTypeValue] = useState('');
  const [equipmentCategories, setEquipmentCategories] = useState([]);
  const [equipmentStatuses, setEquipmentStatuses] = useState([]);
  const [equipmentLocations, setEquipmentLocations] = useState([]);
  const [newEquipmentCategory, setNewEquipmentCategory] = useState('');
  const [newEquipmentStatus, setNewEquipmentStatus] = useState('');
  const [newEquipmentLocation, setNewEquipmentLocation] = useState('');
  const [editingDictionaryItem, setEditingDictionaryItem] = useState(null);
  const [editingDictionaryValue, setEditingDictionaryValue] = useState('');
  const [configDictionaries, setConfigDictionaries] = useState(getConfigDictionaries);
  const [newConfigValues, setNewConfigValues] = useState({});
  const [editingConfigItem, setEditingConfigItem] = useState(null);
  const [editingConfigValue, setEditingConfigValue] = useState('');
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
  const [rentalNumbering, setRentalNumbering] = useState(getRentalNumberingSettings);
  const [rentalNumberingNotice, setRentalNumberingNotice] = useState('');
  const [dashboardSettings, setDashboardSettings] = useState(getDashboardSettings);

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

  const saveDashboardPreferenceState = (next) => {
    setDashboardSettings(saveDashboardSettings(next));
  };

  const toggleDashboardItem = (id) => {
    const currentVisible = dashboardSettings.visible[id] !== false;
    saveDashboardPreferenceState({ ...dashboardSettings, visible: { ...dashboardSettings.visible, [id]: !currentVisible } });
  };

  const updateDashboardItemSize = (id, size) => {
    saveDashboardPreferenceState({ ...dashboardSettings, sizes: { ...dashboardSettings.sizes, [id]: size } });
  };

  const resetDashboardPreferences = () => {
    setDashboardSettings(resetDashboardSettings());
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

  const updateRentalNumbering = (key, value) => {
    setRentalNumbering((current) => ({ ...current, [key]: value }));
    setRentalNumberingNotice('');
  };

  const saveRentalNumbering = () => {
    const saved = saveRentalNumberingSettings(rentalNumbering);
    setRentalNumbering(saved);
    setRentalNumberingNotice('Numeracja wypożyczeń zapisana.');
  };

  const resetRentalNumbering = () => {
    const saved = saveRentalNumberingSettings(DEFAULT_RENTAL_NUMBERING);
    setRentalNumbering(saved);
    setRentalNumberingNotice('Przywrócono domyślną numerację wypożyczeń.');
  };

  const saveConfigDictionaryState = (next) => {
    const saved = saveConfigDictionaries(next);
    setConfigDictionaries(saved);
  };

  const addConfigDictionaryItem = (key) => {
    const value = String(newConfigValues[key] ?? '').trim();
    if (!value) return;
    const list = normalizeConfigDictionary(key, configDictionaries[key]);
    if (list.some((item) => item.name.toLowerCase() === value.toLowerCase())) {
      setNewConfigValues((current) => ({ ...current, [key]: '' }));
      return;
    }
    saveConfigDictionaryState({ ...configDictionaries, [key]: [...list, { name: value, active: true }] });
    setNewConfigValues((current) => ({ ...current, [key]: '' }));
  };

  const startEditConfigItem = (key, index, item) => {
    setEditingConfigItem({ key, index });
    setEditingConfigValue(item.name);
  };

  const saveConfigDictionaryItem = () => {
    if (!editingConfigItem) return;
    const value = editingConfigValue.trim();
    if (!value) return;
    const list = normalizeConfigDictionary(editingConfigItem.key, configDictionaries[editingConfigItem.key]);
    const next = list.map((item, index) => index === editingConfigItem.index ? { ...item, name: value } : item);
    saveConfigDictionaryState({ ...configDictionaries, [editingConfigItem.key]: next });
    setEditingConfigItem(null);
    setEditingConfigValue('');
  };

  const toggleConfigDictionaryItem = (key, index) => {
    const list = normalizeConfigDictionary(key, configDictionaries[key]);
    const activeCount = list.filter((item) => item.active).length;
    const item = list[index];
    if (item.active && activeCount <= 1) {
      alert('Musi zostać przynajmniej jedna aktywna pozycja.');
      return;
    }
    const next = list.map((row, rowIndex) => rowIndex === index ? { ...row, active: !row.active } : row);
    saveConfigDictionaryState({ ...configDictionaries, [key]: next });
  };

  const removeConfigDictionaryItem = (key, index) => {
    const list = normalizeConfigDictionary(key, configDictionaries[key]);
    if (list.length <= 1) {
      alert('Musi zostać przynajmniej jedna pozycja.');
      return;
    }
    if (!confirm(`Usunąć pozycję: ${list[index].name}? Jeśli była używana w starych rekordach, lepiej ją dezaktywować.`)) return;
    const next = list.filter((_, rowIndex) => rowIndex !== index);
    saveConfigDictionaryState({ ...configDictionaries, [key]: next });
  };

  const resetConfigDictionary = (key) => {
    if (!confirm('Przywrócić domyślną listę?')) return;
    saveConfigDictionaryState({ ...configDictionaries, [key]: DEFAULT_CONFIG_DICTIONARIES[key].map((name) => ({ name, active: true })) });
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
    const { data, error, local } = await fetchClientTypes();
    if (error) {
      setNotice('Nie udało się pobrać rodzajów klientów. Program używa lokalnej listy zapasowej.');
      console.error('Client types load error:', error.message);
      setClientTypes(getClientTypes().map((name, index) => ({ id: name, name, sort_order: index })));
      return;
    }
    setClientTypes(data);
    saveClientTypes(data.map((item) => item.name));
    setNotice(local ? 'Ustawienia działają w trybie lokalnym.' : '');
  };

  useEffect(() => { loadTypes(); }, []);

  const loadEquipmentSettings = async () => {
    const [categoriesResult, statusesResult, locationsResult] = await Promise.all([
      fetchEquipmentDictionary('category'),
      fetchEquipmentDictionary('status'),
      fetchEquipmentDictionary('location')
    ]);
    setEquipmentCategories(categoriesResult.data);
    setEquipmentStatuses(statusesResult.data);
    setEquipmentLocations(locationsResult.data);
    if (categoriesResult.error || statusesResult.error || locationsResult.error) {
      setNotice('Nie udało się pobrać ustawień sprzętu z bazy. Program używa lokalnej listy zapasowej.');
    } else if (categoriesResult.local || statusesResult.local || locationsResult.local) {
      setNotice('Ustawienia działają w trybie lokalnym.');
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
    const value = (type === 'category' ? newEquipmentCategory : type === 'location' ? newEquipmentLocation : newEquipmentStatus).trim();
    if (!value) return;
    const list = type === 'category' ? equipmentCategories : type === 'location' ? equipmentLocations : equipmentStatuses;
    if (list.some((item) => item.name.toLowerCase() === value.toLowerCase())) {
      type === 'category' ? setNewEquipmentCategory('') : type === 'location' ? setNewEquipmentLocation('') : setNewEquipmentStatus('');
      return;
    }
    const { error, local } = await addEquipmentDictionaryRecord(type, value, list.length + 1);
    if (error) {
      alert('Nie udało się zapisać ustawienia. Program zachowa lokalną listę zapasową.');
      return;
    }
    type === 'category' ? setNewEquipmentCategory('') : type === 'location' ? setNewEquipmentLocation('') : setNewEquipmentStatus('');
    await loadEquipmentSettings();
    if (local) setNotice('Ustawienia zapisano lokalnie.');
  };

  const saveEquipmentDictionaryItem = async () => {
    const value = editingDictionaryValue.trim();
    if (!editingDictionaryItem || !value) return;
    const { error, local } = await updateEquipmentDictionaryRecord(editingDictionaryItem.id, editingDictionaryItem.type, value);
    if (error) {
      alert('Nie udało się zapisać ustawienia. Program zachowa lokalną listę zapasową.');
      return;
    }
    cancelEditDictionaryItem();
    await loadEquipmentSettings();
    if (local) setNotice('Ustawienia zapisano lokalnie.');
  };

  const removeEquipmentDictionaryItem = async (type, item) => {
    const list = type === 'category' ? equipmentCategories : type === 'location' ? equipmentLocations : equipmentStatuses;
    if (list.length <= 1) {
      alert('Musi zostać przynajmniej jedna pozycja.');
      return;
    }
    if (!confirm(`Usunąć pozycję: ${item.name}? Jeśli była używana w starych rekordach, lepiej zostawić ją na liście.`)) return;
    const { error, local } = await deleteEquipmentDictionaryRecord(item.id, type);
    if (error) {
      alert('Nie udało się zapisać ustawienia. Program zachowa lokalną listę zapasową.');
      return;
    }
    await loadEquipmentSettings();
    if (local) setNotice('Ustawienia zapisano lokalnie.');
  };

  const resetEquipmentDictionary = async (type) => {
    if (!confirm('Przywrócić domyślną listę?')) return;
    const { error, local } = await resetEquipmentDictionaryRecords(type);
    if (error) {
      alert('Nie udało się zapisać ustawienia. Program zachowa lokalną listę zapasową.');
      return;
    }
    await loadEquipmentSettings();
    if (local) setNotice('Ustawienia zapisano lokalnie.');
  };

  const renderEquipmentDictionaryCard = (type, title, description, items, value, setValue) => (
    <div className="settings-card compact-admin-card settings-dictionary-card dictionary-card-compact-list">
      <div className="settings-card-header compact-card-header dictionary-card-header">
        <div>
          <h3>{title}</h3>
          <p className="muted">{description}</p>
        </div>
        <AppButton variant="secondary" size="sm" className="dictionary-reset-button" onClick={() => resetEquipmentDictionary(type)}>Domyślne</AppButton>
      </div>
      <div className="dictionary-add-compact">
        <AppInput value={value} onChange={(event) => setValue(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') addEquipmentDictionaryItem(type); }} placeholder={type === 'category' ? 'np. Reżyserka, Statyw, Recorder' : 'np. Do sprawdzenia, Zarezerwowany'} />
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

  const renderConfigDictionaryCard = (key, title, description) => {
    const items = normalizeConfigDictionary(key, configDictionaries[key]);
    return <div className="settings-card compact-admin-card settings-dictionary-card dictionary-card-compact-list">
      <div className="settings-card-header compact-card-header dictionary-card-header">
        <div>
          <h3>{title}</h3>
          <p className="muted">{description}</p>
        </div>
        <AppButton variant="secondary" size="sm" className="dictionary-reset-button" onClick={() => resetConfigDictionary(key)}>Domyślne</AppButton>
      </div>
      <div className="dictionary-add-compact">
        <AppInput value={newConfigValues[key] ?? ''} onChange={(event) => setNewConfigValues((current) => ({ ...current, [key]: event.target.value }))} onKeyDown={(event) => { if (event.key === 'Enter') addConfigDictionaryItem(key); }} placeholder="Nowa pozycja" />
        <button type="button" className="dictionary-icon-button add" onClick={() => addConfigDictionaryItem(key)} aria-label="Dodaj" title="Dodaj"><Plus size={16} /></button>
      </div>
      <div className="dictionary-list dictionary-list-compact">
        {items.map((item, index) => {
          const isEditing = editingConfigItem?.key === key && editingConfigItem?.index === index;
          return <div className={`dictionary-row dictionary-row-compact ${isEditing ? 'editing' : ''} ${item.active ? '' : 'inactive'}`} key={`${key}-${item.name}-${index}`}>
            {isEditing
              ? <input value={editingConfigValue} onChange={(event) => setEditingConfigValue(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') saveConfigDictionaryItem(); if (event.key === 'Escape') { setEditingConfigItem(null); setEditingConfigValue(''); } }} autoFocus />
              : <button type="button" className="dictionary-name-button" onClick={() => startEditConfigItem(key, index, item)} title="Edytuj">{item.name}</button>}
            <div className="dictionary-row-actions dictionary-icon-actions">
              {isEditing
                ? <><button type="button" className="dictionary-icon-button save" onClick={saveConfigDictionaryItem} aria-label="Zapisz" title="Zapisz"><Save size={15} /></button><button type="button" className="dictionary-icon-button cancel" onClick={() => { setEditingConfigItem(null); setEditingConfigValue(''); }} aria-label="Anuluj" title="Anuluj"><X size={15} /></button></>
                : <><button type="button" className={`dictionary-icon-button ${item.active ? 'save' : 'cancel'}`} onClick={() => toggleConfigDictionaryItem(key, index)} aria-label={item.active ? 'Aktywna' : 'Nieaktywna'} title={item.active ? 'Aktywna' : 'Nieaktywna'}>{item.active ? '✓' : '○'}</button><button type="button" className="dictionary-icon-button edit" onClick={() => startEditConfigItem(key, index, item)} aria-label="Edytuj" title="Edytuj">✎</button><button type="button" className="dictionary-icon-button remove" onClick={() => removeConfigDictionaryItem(key, index)} aria-label="Usuń" title="Usuń">−</button></>}
            </div>
          </div>;
        })}
      </div>
    </div>;
  };


  const addType = async () => {
    const value = newType.trim();
    if (!value) return;
    if (clientTypes.some((item) => item.name.toLowerCase() === value.toLowerCase())) {
      setNewType('');
      return;
    }
    const { error, local } = await addClientTypeRecord(value, clientTypes.length + 1);
    if (error) {
      alert('Nie udało się zapisać ustawienia. Program zachowa lokalną listę zapasową.');
      return;
    }
    setNewType('');
    await loadTypes();
    if (local) setNotice('Ustawienia zapisano lokalnie.');
  };

  const startEditClientType = (type) => {
    setEditingClientType(type.id);
    setEditingClientTypeValue(type.name);
  };

  const cancelEditClientType = () => {
    setEditingClientType(null);
    setEditingClientTypeValue('');
  };

  const saveClientType = async () => {
    const value = editingClientTypeValue.trim();
    if (!editingClientType || !value) return;
    const { error, local } = await updateClientTypeRecord(editingClientType, value);
    if (error) {
      alert('Nie udało się zapisać ustawienia. Program zachowa lokalną listę zapasową.');
      return;
    }
    cancelEditClientType();
    await loadTypes();
    if (local) setNotice('Ustawienia zapisano lokalnie.');
  };

  const removeType = async (type) => {
    if (clientTypes.length <= 1) {
      alert('Musi zostać przynajmniej jeden rodzaj klienta.');
      return;
    }
    if (!confirm(`Usunąć pozycję: ${type.name}? Jeśli była używana w starych rekordach, lepiej zostawić ją na liście.`)) return;
    const { error, local } = await deleteClientTypeRecord(type.id);
    if (error) {
      alert('Nie udało się zapisać ustawienia. Program zachowa lokalną listę zapasową.');
      return;
    }
    await loadTypes();
    if (local) setNotice('Ustawienia zapisano lokalnie.');
  };

  const resetTypes = async () => {
    if (!confirm('Przywrócić domyślną listę?')) return;
    const { error, local } = await resetClientTypesRecords(DEFAULT_CLIENT_TYPES);
    if (error) {
      alert('Nie udało się zapisać ustawienia. Program zachowa lokalną listę zapasową.');
      return;
    }
    await loadTypes();
    if (local) setNotice('Ustawienia zapisano lokalnie.');
  };

  const renderClientTypesDictionaryCard = () => (
    <div className="settings-card compact-admin-card settings-dictionary-card dictionary-card-compact-list">
      <div className="settings-card-header compact-card-header dictionary-card-header">
        <div>
          <h3>Statusy klientów</h3>
          <p className="muted">Lista wartości widoczna w kartotece klienta.</p>
        </div>
        <AppButton variant="secondary" size="sm" className="dictionary-reset-button" onClick={resetTypes}>Domyślne</AppButton>
      </div>
      {notice && <div className="notice">{notice}</div>}
      <div className="dictionary-add-compact">
        <AppInput value={newType} onChange={(event) => setNewType(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') addType(); }} placeholder="np. Partner, VIP, Problemowy" />
        <button type="button" className="dictionary-icon-button add" onClick={addType} aria-label="Dodaj" title="Dodaj"><Plus size={16} /></button>
      </div>
      <div className="dictionary-list dictionary-list-compact">
        {clientTypes.map((type) => {
          const isEditing = editingClientType === type.id;
          return <div className={`dictionary-row dictionary-row-compact ${isEditing ? 'editing' : ''}`} key={type.id}>
            {isEditing
              ? <input value={editingClientTypeValue} onChange={(event) => setEditingClientTypeValue(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') saveClientType(); if (event.key === 'Escape') cancelEditClientType(); }} autoFocus />
              : <button type="button" className="dictionary-name-button" onClick={() => startEditClientType(type)} title="Edytuj">{type.name}</button>}
            <div className="dictionary-row-actions dictionary-icon-actions">
              {isEditing
                ? <><button type="button" className="dictionary-icon-button save" onClick={saveClientType} aria-label="Zapisz" title="Zapisz"><Save size={15} /></button><button type="button" className="dictionary-icon-button cancel" onClick={cancelEditClientType} aria-label="Anuluj" title="Anuluj"><X size={15} /></button></>
                : <><button type="button" className="dictionary-icon-button edit" onClick={() => startEditClientType(type)} aria-label="Edytuj" title="Edytuj">✎</button><button type="button" className="dictionary-icon-button remove" onClick={() => removeType(type)} aria-label="Usuń" title="Usuń">−</button></>}
            </div>
          </div>;
        })}
      </div>
    </div>
  );

  const placeholderGroups = {
    service: ['Statusy serwisu', 'Priorytety', 'Typy zgłoszeń', 'Numeracja zleceń'],
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

      {activeSection === 'company' && <div className="firm-settings-pane">
        <div className="firm-settings-header">
          <div>
            <h3>Dane firmy</h3>
            <p className="muted">Dane używane na dokumentach, wydrukach i w systemie.</p>
          </div>
          <div className="settings-action-row">
            <AppButton variant="secondary" size="sm" onClick={resetCompanySettings}>Wyczyść</AppButton>
            <AppButton variant="primary" size="sm" onClick={saveCompanySettings}><Save size={15} />Zapisz</AppButton>
          </div>
        </div>
        {companySaveNotice && <div className="notice firm-save-notice">{companySaveNotice}</div>}

        <div className="firm-settings-grid">
          <div className="firm-settings-main">
            <section className="settings-card compact-admin-card firm-card">
              <h3>Podstawowe</h3>
              <div className="firm-form-grid firm-basic-grid">
                <label className="firm-field firm-field-wide">Nazwa firmy<AppInput value={companyProfile.name} onChange={(event) => updateCompanyProfile('name', event.target.value)} placeholder="np. BMX Media" /></label>
                <label className="firm-field firm-field-wide">Nazwa na dokumentach<AppInput value={companyProfile.legalName} onChange={(event) => updateCompanyProfile('legalName', event.target.value)} placeholder="np. BMX Media Sp. z o.o." /></label>
                <label className="firm-field firm-field-nip">NIP<AppInput value={companyProfile.nip} onChange={(event) => updateCompanyProfile('nip', event.target.value)} placeholder="0000000000" /></label>
                <label className="firm-field firm-field-regon">REGON<AppInput value={companyProfile.regon} onChange={(event) => updateCompanyProfile('regon', event.target.value)} /></label>
              </div>
            </section>

            <section className="settings-card compact-admin-card firm-card">
              <h3>Adres</h3>
              <div className="firm-form-grid firm-address-grid">
                <label className="firm-field firm-field-street">Ulica<AppInput value={companyProfile.street} onChange={(event) => updateCompanyProfile('street', event.target.value)} /></label>
                <label className="firm-field firm-field-building">Nr budynku<AppInput value={companyProfile.buildingNumber} onChange={(event) => updateCompanyProfile('buildingNumber', event.target.value)} /></label>
                <label className="firm-field firm-field-apartment">Nr lokalu<AppInput value={companyProfile.apartmentNumber} onChange={(event) => updateCompanyProfile('apartmentNumber', event.target.value)} /></label>
                <label className="firm-field firm-field-postal">Kod pocztowy<AppInput value={companyProfile.postalCode} onChange={(event) => updateCompanyProfile('postalCode', event.target.value)} placeholder="00-000" /></label>
                <label className="firm-field firm-field-city">Miasto<AppInput value={companyProfile.city} onChange={(event) => updateCompanyProfile('city', event.target.value)} /></label>
                <label className="firm-field firm-field-country">Kraj<AppInput value={companyProfile.country} onChange={(event) => updateCompanyProfile('country', event.target.value)} /></label>
              </div>
            </section>

            <section className="settings-card compact-admin-card firm-card">
              <h3>Kontakt</h3>
              <div className="firm-form-grid firm-contact-grid">
                <label className="firm-field firm-field-phone">Telefon<AppInput value={companyProfile.phone} onChange={(event) => updateCompanyProfile('phone', event.target.value)} /></label>
                <label className="firm-field firm-field-email">Email<AppInput value={companyProfile.email} onChange={(event) => updateCompanyProfile('email', event.target.value)} /></label>
                <label className="firm-field firm-field-www">Strona WWW<AppInput value={companyProfile.website} onChange={(event) => updateCompanyProfile('website', event.target.value)} placeholder="https://..." /></label>
              </div>
            </section>
          </div>

          <div className="firm-settings-side">
            <section className="settings-card compact-admin-card firm-card firm-logo-card">
              <h3>Logo</h3>
              <div className="firm-logo-layout">
                <div className="firm-logo-preview">
                  {companyProfile.logoDataUrl ? <img src={companyProfile.logoDataUrl} alt="Logo firmy" /> : <span>Logo</span>}
                </div>
                <div className="firm-logo-actions">
                  <label className="app-button app-button-secondary app-button-sm file-button"><FolderOpen size={14} />Wczytaj logo<input type="file" accept="image/*" onChange={handleCompanyLogoUpload} /></label>
                  <AppButton variant="secondary" size="sm" onClick={removeCompanyLogo} disabled={!companyProfile.logoDataUrl}>Usuń logo</AppButton>
                </div>
              </div>
            </section>

            <section className="settings-card compact-admin-card firm-card">
              <h3>Rozliczenia</h3>
              <div className="firm-form-grid firm-billing-grid">
                <label className="firm-field firm-field-account">Numer konta<AppInput value={companyProfile.bankAccount} onChange={(event) => updateCompanyProfile('bankAccount', event.target.value)} /></label>
                <label className="firm-field firm-field-currency">Waluta<AppInput value={rentalNumbering.currency || 'zł'} disabled /></label>
              </div>
            </section>

            <section className="settings-card compact-admin-card firm-card">
              <h3>Dokumenty</h3>
              <label className="firm-field firm-field-footer">Stopka dokumentów<AppTextarea value={companyProfile.documentFooter} onChange={(event) => updateCompanyProfile('documentFooter', event.target.value)} placeholder="np. Dziękujemy za współpracę." /></label>
            </section>

            <section className="settings-card compact-admin-card firm-card firm-preview-card">
              <h3>Podgląd</h3>
              <div className="firm-preview">
                <strong>{companyProfile.legalName || companyProfile.name || 'Nazwa na dokumentach'}</strong>
                <span>{formatCompanyAddress(companyProfile) || 'Adres firmy'}</span>
                <span>{formatCompanyTaxData(companyProfile) || 'NIP / REGON'}</span>
                <span>{formatCompanyContact(companyProfile) || 'Telefon / email / WWW'}</span>
                <span>{companyProfile.bankAccount ? `Konto: ${companyProfile.bankAccount}` : 'Numer konta'}</span>
              </div>
            </section>
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
        <div className="settings-card wide-settings-card dashboard-settings-card">
          <div className="settings-card-header compact-card-header">
            <div>
              <p className="eyebrow">Dashboard</p>
              <h3>Widoczność i szerokość kafli</h3>
              <p className="muted">Ustawienia są zapisywane lokalnie w przeglądarce i odtwarzane po odświeżeniu strony.</p>
            </div>
            <AppButton variant="secondary" size="sm" onClick={resetDashboardPreferences}><RotateCcw size={14} />Resetuj</AppButton>
          </div>
          <div className="dashboard-settings-list">
            {DASHBOARD_ITEMS.map((item) => <div className="dashboard-settings-row" key={item.id}>
              <label className="settings-check dashboard-settings-toggle">
                <input type="checkbox" checked={dashboardSettings.visible[item.id] !== false} onChange={() => toggleDashboardItem(item.id)} />
                {item.label}
              </label>
              <AppSelect value={dashboardSettings.sizes[item.id] ?? item.defaultSize} onChange={(event) => updateDashboardItemSize(item.id, event.target.value)}>
                <option value="small">Mały</option>
                <option value="medium">Średni</option>
                <option value="large">Duży</option>
              </AppSelect>
            </div>)}
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
          <label className="settings-field">Domyślna liczba wierszy<AppSelect value={preferences.defaultRowsPerPage} onChange={(event) => updatePreference('defaultRowsPerPage', event.target.value)}><option>10</option><option>25</option><option>50</option><option>100</option></AppSelect></label>
        </div>
        <div className="settings-card">
          <p className="eyebrow">Bezpieczeństwo pracy</p>
          <h3>Potwierdzenia</h3>
          <label className="settings-check"><input type="checkbox" checked={preferences.confirmDelete} onChange={(event) => updatePreference('confirmDelete', event.target.checked)} />Pokazuj potwierdzenie usunięcia</label>
        </div>
      </div>}

      {activeSection === 'clients' && <div className="settings-pane-grid settings-pane-grid-wide compact-settings-grid">
        {renderClientTypesDictionaryCard()}
        <div className="settings-card compact-admin-card settings-dictionary-card dictionary-card-compact-list">
          <div className="settings-card-header compact-card-header dictionary-card-header">
            <div>
              <h3>Typy klientów</h3>
              <p className="muted">Wartości systemowe używane w kartotece klienta.</p>
            </div>
          </div>
          <div className="dictionary-list dictionary-list-compact readonly-dictionary-list">
            {['Firma', 'Osoba prywatna'].map((type) => <div className="dictionary-row dictionary-row-compact readonly" key={type}>
              <span className="dictionary-name-button readonly">{type}</span>
              <span className="dictionary-readonly-badge">Systemowe</span>
            </div>)}
          </div>
        </div>
        <div className="settings-card compact-admin-card">
          <h3>Widok klientów</h3>
          <p className="muted">Domyślne filtry, kolumny i pola dodatkowe będą konfigurowane w tej sekcji.</p>
        </div>
      </div>}

      {activeSection === 'equipment' && <div className="settings-pane-grid settings-pane-grid-wide compact-settings-grid equipment-settings-grid">
        {renderEquipmentDictionaryCard('category', 'Kategorie sprzętu', 'Lista kategorii widoczna w karcie sprzętu.', equipmentCategories, newEquipmentCategory, setNewEquipmentCategory)}
        {renderEquipmentDictionaryCard('status', 'Statusy sprzętu', 'Lista statusów widoczna w karcie sprzętu i tabelach.', equipmentStatuses, newEquipmentStatus, setNewEquipmentStatus)}
        {renderEquipmentDictionaryCard('location', 'Lokalizacje sprzętu', 'Lista lokalizacji widoczna w karcie sprzętu i wyborze sprzętu.', equipmentLocations, newEquipmentLocation, setNewEquipmentLocation)}
        {renderConfigDictionaryCard('equipmentConditions', 'Stany techniczne sprzętu', 'Lista stanów technicznych widoczna w karcie sprzętu.')}
        <div className="settings-card compact-admin-card settings-dictionary-card">
          <h3>Widok sprzętu</h3>
          <p className="muted">Układ tabeli, ukrywanie kolumn i menu kontekstowe działają globalnie tak jak w module Klienci.</p>
          <div className="tag-list"><span className="config-tag">Tabela</span><span className="config-tag">Kartoteka</span><span className="config-tag">Zestawy</span></div>
        </div>
      </div>}

      {activeSection === 'rentals' && <div className="settings-pane-grid settings-pane-grid-wide compact-settings-grid rental-settings-grid">
        <div className="settings-card wide-settings-card rental-numbering-card compact-admin-card">
          <div>
            <p className="eyebrow">Numeracja</p>
            <h3>Numeracja wypożyczeń</h3>
            <p className="muted">Nowe dokumenty użyją wybranego prefiksu i formatu. Istniejące wypożyczenia pozostają bez zmian.</p>
          </div>
          <div className="rental-numbering-form">
            <label className="settings-field">Prefiks<AppInput value={rentalNumbering.prefix} onChange={(event) => updateRentalNumbering('prefix', event.target.value)} placeholder="WYP" /></label>
            <label className="settings-field">Format<AppSelect value={rentalNumbering.format} onChange={(event) => updateRentalNumbering('format', event.target.value)}>{RENTAL_NUMBER_FORMATS.map((format) => <option key={format.value} value={format.value}>{format.label}</option>)}</AppSelect></label>
            <label className="settings-field">Termin zwrotu<AppInput type="number" min="0" value={rentalNumbering.defaultReturnDays} onChange={(event) => updateRentalNumbering('defaultReturnDays', event.target.value)} /></label>
            <label className="settings-field">Waluta<AppInput value={rentalNumbering.currency} onChange={(event) => updateRentalNumbering('currency', event.target.value)} /></label>
            <div className="rental-number-preview"><span>Przykład</span><strong>{formatRentalNumber(rentalNumbering, 1, new Date('2026-06-03T12:00:00'))}</strong></div>
            <div className="settings-action-row rental-numbering-actions">
              <AppButton variant="secondary" onClick={resetRentalNumbering}>Domyślne</AppButton>
              <AppButton variant="primary" onClick={saveRentalNumbering}><Save size={16} />Zapisz</AppButton>
            </div>
          </div>
          {rentalNumberingNotice && <div className="notice">{rentalNumberingNotice}</div>}
        </div>
        {renderConfigDictionaryCard('rentalTypes', 'Typy wypożyczeń', 'Lista typów widoczna w kartotece wypożyczenia.')}
        {renderConfigDictionaryCard('returnConditions', 'Stany zwrotu', 'Lista stanów widoczna w oknie rejestracji zwrotu.')}
        <div className="settings-card compact-admin-card">
          <h3>Statusy i zwroty</h3>
          <p className="muted">Statusy wypożyczeń i zwrotów korzystają z istniejących wartości systemowych.</p>
          <div className="tag-list"><span className="config-tag">Aktywne</span><span className="config-tag">Częściowo zwrócone</span><span className="config-tag">Zwrócone</span></div>
        </div>
        <div className="settings-card compact-admin-card">
          <h3>Domyślne okresy</h3>
          <p className="muted">Konfiguracja domyślnych okresów będzie dostępna bez wpływu na obecną obsługę zwrotów.</p>
          <AppButton variant="secondary" disabled>W przygotowaniu</AppButton>
        </div>
      </div>}

      {placeholderGroups[activeSection] && <div className="settings-pane-grid settings-pane-grid-wide">
        {placeholderGroups[activeSection].map((item) => <div className="settings-card compact-admin-card settings-dictionary-card" key={item}>
          <p className="eyebrow">{activeSectionData.label}</p>
          <h3>{item}</h3>
          <p className="muted">Sekcja przygotowana pod konfigurację. Nie zmienia jeszcze działania istniejących modułów.</p>
          <AppButton variant="secondary" disabled>W przygotowaniu</AppButton>
        </div>)}
      </div>}
    </section>
  </div>;
}

createRoot(document.getElementById('root')).render(<App />);
