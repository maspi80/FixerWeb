import React, { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { createRoot } from 'react-dom/client';
import {
  AlignCenter, AlignLeft, AlignRight, ArrowDown, ArrowUp, Bell, Briefcase, CalendarDays, CheckCheck, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Eraser, LayoutDashboard, LockKeyhole,
  LogOut, MessageSquare, Package, PanelLeft, Search, Settings, SlidersHorizontal, Users, Wrench,
  ClipboardList, Barcode, Copy, Download, FilePlus2, FileText, FolderOpen, GripVertical, History, Minus, Plus, Printer, RotateCcw, Save, Trash2, X, Sun, Moon, List, Columns3, Grid3X3, Clock
} from 'lucide-react';
import './design-system/tokens.css';
import './design-system/components.css';
import {
  AppButton,
  AppInput,
  AppSection,
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
  EmptyState,
  AppNotice
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
import {
  addServiceDictionaryRecord,
  DEFAULT_SERVICE_DEVICE_CATEGORIES,
  DEFAULT_SERVICE_EXTERNAL_SERVICES,
  DEFAULT_SERVICE_INTAKE_CONDITIONS,
  DEFAULT_SERVICE_PROGRESS_TEMPLATES,
  deleteServiceDictionaryRecord,
  fetchServiceDictionary,
  reorderServiceDictionaryRecords,
  resetServiceDictionaryRecords,
  SERVICE_DICTIONARY_TYPES,
  updateServiceDictionaryRecord
} from './services/serviceDictionariesService';
import {
  addOrganizerCategory,
  DEFAULT_ORGANIZER_CATEGORIES,
  createOrganizerTaskComment,
  deleteOrganizerCategory,
  deleteOrganizerTaskComment,
  deleteOrganizerTask,
  fetchOrganizerCategories,
  fetchOrganizerTaskComments,
  fetchOrganizerTasks,
  createOrganizerTask,
  ORGANIZER_TASK_PRIORITIES,
  ORGANIZER_TASK_STATUSES,
  ORGANIZER_TERMINAL_STATUSES,
  resetOrganizerCategories,
  updateOrganizerCategory,
  updateOrganizerTask
} from './services/organizerService';
import { createCalendarManualEvent, deleteCalendarManualEvent, fetchCalendarManualEvents, updateCalendarManualEvent } from './services/calendarService';
import {
  createProject, createProjectTask, deleteProject, deleteProjectTask,
  createProjectSection, updateProjectSection, deleteProjectSection, fetchProjectSections,
  createTaskComment, updateTaskComment, deleteTaskComment, fetchTaskComments,
  fetchAllProjectTasks, fetchProjectAllComments, fetchProjects, fetchProjectTasks,
  PROJECT_PRIORITIES, PROJECT_STATUSES, PROJECT_TASK_PRIORITIES,
  PROJECT_TASK_STATUSES, PROJECT_TASK_TERMINAL_STATUSES, PROJECT_TASK_COMMENT_TYPES, PROJECT_TERMINAL_STATUSES,
  updateProject, updateProjectTask
} from './services/projectsService';
import { searchGlobalRecords } from './services/globalSearchService';
import { BACKUP_FULL_ERROR_MESSAGE, BACKUP_INCLUDED_TABLES, createBackupArchive, createCsvExport, parseBackupText, restoreBackupArchive } from './services/backupService';

const PROJECTS_TABLE_KEY = 'projects-table';
const PROJECTS_HISTORY_TABLE_KEY = 'projects-history-table';
const NOTIFICATIONS_READ_STORAGE_KEY = 'fixer-notifications-read';
const NOTIFICATIONS_DELETED_STORAGE_KEY = 'fixer-notifications-deleted';
const NOTIFICATIONS_BACKUP_FAILURE_KEY = 'fixer-last-backup-failure';
const NOTIFICATIONS_RETENTION_DAYS = 30;

function onlyDigits(value) {
  return String(value ?? '').replace(/\D/g, '');
}

function humanizeError(error, context) {
  if (!error) return 'Wystąpił nieznany błąd.';
  const msg = String(error.message ?? '');
  const code = String(error.code ?? '');
  const isFk = code === '23503' || msg.includes('foreign key') || msg.includes('violates foreign key');
  const isUnique = code === '23505' || msg.includes('duplicate key') || msg.includes('unique constraint');
  const isNotNull = code === '23502' || msg.includes('null value in column') || msg.includes('not-null');
  const isSqlTech = msg.includes('relation ') || msg.includes('column ') || msg.includes('PGRST') || msg.includes('syntax error') || msg.includes('operator') || msg.includes('constraint') || msg.includes('violates') || msg.includes('table "');

  if (isFk) {
    if (context === 'equipment') return 'Nie można usunąć sprzętu, ponieważ posiada on historię wypożyczeń, serwisów lub innych dokumentów.';
    if (context === 'client') return 'Nie można usunąć klienta, ponieważ posiada on wypożyczenia, zlecenia serwisowe lub inne powiązane dokumenty.';
    return 'Nie można usunąć tego elementu, ponieważ jest on powiązany z innymi dokumentami w systemie.';
  }
  if (isUnique) return 'Element o podanej nazwie lub numerze już istnieje w systemie.';
  if (isNotNull) return 'Brakuje wymaganych danych. Sprawdź czy wszystkie pola są wypełnione.';
  if (isSqlTech) return 'Wystąpił błąd bazy danych. Sprawdź konfigurację systemu lub skontaktuj się z administratorem.';
  return msg || 'Nie udało się wykonać operacji.';
}

function isForeignKeyError(error) {
  if (!error) return false;
  const msg = String(error.message ?? '');
  const code = String(error.code ?? '');
  return code === '23503' || msg.includes('foreign key') || msg.includes('violates foreign key');
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


function printHtmlInIframe(html) {
  const existing = document.getElementById('__fixer-print-frame');
  if (existing) existing.remove();
  const iframe = document.createElement('iframe');
  iframe.id = '__fixer-print-frame';
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:fixed;width:1px;height:1px;top:-9999px;left:-9999px;border:none;opacity:0;pointer-events:none;';
  document.body.appendChild(iframe);
  const cleanHtml = html.replace(/<script>\s*window\.onload[^<]*<\/script>/g, '');
  iframe.addEventListener('load', () => {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
  }, { once: true });
  iframe.srcdoc = cleanHtml;
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
  const polishDate = text.match(/^(\d{2})[./-](\d{2})[./-](\d{4})/);
  if (polishDate) return Date.parse(`${polishDate[3]}-${polishDate[2]}-${polishDate[1]}T00:00:00`);
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

const TABLE_COLUMN_ALIGNMENTS = ['left', 'center', 'right'];

function normalizeColumnAlignment(value) {
  return TABLE_COLUMN_ALIGNMENTS.includes(value) ? value : null;
}

function getDefaultColumnAlignment(column) {
  const explicit = normalizeColumnAlignment(column?.align);
  if (explicit) return explicit;
  const key = String(column?.key ?? '').toLocaleLowerCase('pl');
  const label = String(column?.label ?? '').toLocaleLowerCase('pl');
  const text = `${key} ${label}`;
  if (/(amount|balance|cost|count|deposit|fee|gross|items_count|net|price|quantity|set_items_count|sum|total|value|wartosc|ilość|ilosc|kaucja|kwota|liczba|pozycje|składniki|skladniki|suma|cena)/.test(text)) return 'right';
  if (/(accepted|barcode|code|completed|date|deadline|due|inventory|number|phone|planned|priority|reminder|return|serial|status|type|wybrany|data|kod|nip|nr|numer|planowany|priorytet|przypomnienie|regon|seryjny|status|telefon|termin|typ|wydanie|zakończone|zakonczone)/.test(text)) return 'center';
  return 'left';
}

function getColumnAlignment(column, columnAlignments = {}) {
  return normalizeColumnAlignment(columnAlignments?.[column.key]) ?? getDefaultColumnAlignment(column);
}

function getExportTableData(storageKey, columns, rows) {
  const fallback = {
    visibleColumns: columns.map((column) => column.key),
    columnOrder: columns.map((column) => column.key),
    columnWidths: {},
    columnAlignments: {},
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
    columns: safeColumns.map((column) => ({ ...column, align: getColumnAlignment(column, preference.columnAlignments) })),
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
  const documentSettings = getDocumentSettings();
  const date = new Date().toLocaleDateString('pl-PL');
  const header = exportData.columns.map((column) => `<th class="align-${escapeHtml(column.align)}">${escapeHtml(column.label)}</th>`).join('');
  const body = exportData.rows.map((row) => `<tr>${exportData.columns.map((column) => `<td class="align-${escapeHtml(column.align)}">${escapeHtml(formatExportCell(row[column.key]))}</td>`).join('')}</tr>`).join('');
  const companyName = company.name || company.legalName || 'FIXER WEB';
  const companyAddressLines = formatDocumentAddressLines(company);
  const companyTax = formatCompanyTaxData(company);
  const companyContact = formatCompanyContact(company);
  const companyFooter = company.documentFooter?.trim();
  const showLogo = company.showLogoOnDocuments !== false;
  const logo = showLogo
    ? company.logoDataUrl ? `<img src="${escapeHtml(company.logoDataUrl)}" alt="Logo firmy"/>` : `<div class="print-logo-fallback">${escapeHtml(companyName.slice(0, 1).toUpperCase())}</div>`
    : '';
  const headerText = String(company.documentHeader ?? '').trim();
  const templateName = documentSettings.templates?.tableExport ?? 'Standardowy';
  printHtmlInIframe(`<!doctype html><html lang="pl"><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title><style>
    @page{size:A4 landscape;margin:12mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#111827;margin:0}.document-kicker{color:#64748b;font-size:10px;text-transform:uppercase;letter-spacing:.12em;margin:0 0 8px}.document-custom-header{border:1px solid #cbd5e1;background:#f8fafc;border-radius:10px;padding:8px 10px;margin-bottom:10px;color:#334155;font-size:11px}.document-header{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;border-bottom:2px solid #e2e8f0;padding-bottom:12px;margin-bottom:14px}.company-block{display:flex;gap:12px;align-items:flex-start}.company-logo{width:72px;height:72px;border:1px solid #cbd5e1;border-radius:12px;display:grid;place-items:center;overflow:hidden;flex:0 0 auto}.company-logo:empty{display:none}.company-logo img{max-width:100%;max-height:100%;object-fit:contain}.print-logo-fallback{width:100%;height:100%;display:grid;place-items:center;background:#2563eb;color:#fff;font-size:28px;font-weight:800}.company-name{font-size:18px;font-weight:800;margin:0 0 4px}.company-line{margin:0 0 3px;color:#475569;font-size:10.5px}.document-meta{text-align:right}.document-meta h1{font-size:20px;margin:0 0 5px}.document-meta p{margin:0 0 3px;color:#475569;font-size:11px}table{width:100%;border-collapse:collapse;font-size:10px}th,td{border:1px solid #cbd5e1;padding:6px 7px;text-align:left;vertical-align:top}th{background:#e2e8f0;color:#0f172a;font-weight:700}.align-center{text-align:center}.align-right{text-align:right}.align-left{text-align:left}tr:nth-child(even) td{background:#f8fafc}.document-footer{border-top:1px solid #e2e8f0;margin-top:12px;padding-top:8px;color:#64748b;font-size:10px}
  </style></head><body><p class="document-kicker">Szablon: ${escapeHtml(templateName)}</p>${headerText ? `<div class="document-custom-header">${escapeHtml(headerText)}</div>` : ''}<div class="document-header"><div class="company-block"><div class="company-logo">${logo}</div><div><p class="company-name">${escapeHtml(companyName)}</p>${companyAddressLines.map((line) => `<p class="company-line">${escapeHtml(line)}</p>`).join('')}${companyTax ? `<p class="company-line">${escapeHtml(companyTax)}</p>` : ''}${companyContact ? `<p class="company-line">${escapeHtml(companyContact)}</p>` : ''}${company.bankAccount ? `<p class="company-line">Konto: ${escapeHtml(company.bankAccount)}</p>` : ''}</div></div><div class="document-meta"><h1>${escapeHtml(title)}</h1><p>Data eksportu: ${escapeHtml(date)}</p><p>Liczba wpisów: ${exportData.rows.length}</p></div></div><table><thead><tr>${header}</tr></thead><tbody>${body || `<tr><td colspan="${exportData.columns.length}">Brak danych do eksportu.</td></tr>`}</tbody></table>${companyFooter ? `<div class="document-footer">${escapeHtml(companyFooter)}</div>` : ''}</body></html>`);
}

const modules = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'clients', label: 'Klienci', icon: Users },
  { id: 'equipment', label: 'Sprzęt', icon: Package },
  { id: 'rentals', label: 'Wypożyczenia', icon: ClipboardList },
  { id: 'service', label: 'Serwis', icon: Wrench },
  { id: 'projects', label: 'Zadania i projekty', icon: Briefcase },
  { id: 'calendar', label: 'Kalendarz', icon: CalendarDays },
  { id: 'documents', label: 'Dokumenty', icon: FileText },
  { id: 'settings', label: 'Ustawienia', icon: Settings }
];

const BACKUP_TABLE_LABELS = {
  clients: 'Klienci',
  equipment: 'Sprzęt',
  rentals: 'Wypożyczenia',
  rental_items: 'Pozycje wypożyczeń',
  service_orders: 'Serwis',
  service_order_progress: 'Postępy serwisowe',
  service_order_attachments: 'Załączniki serwisu',
  equipment_dictionaries: 'Słowniki sprzętu',
  service_dictionaries: 'Słowniki serwisu',
  client_types: 'Statusy klientów',
  calendar_manual_events: 'Wydarzenia kalendarza',
  organizer_categories: 'Kategorie zadań',
  organizer_tasks: 'Zadania',
  organizer_task_comments: 'Komentarze zadań',
  projects: 'Projekty',
  project_tasks: 'Zadania projektów',
  project_task_sections: 'Sekcje zadań projektów',
  project_task_comments: 'Komentarze zadań projektów'
};

function formatBackupTableLabel(table) {
  return BACKUP_TABLE_LABELS[table] ?? table;
}

function normalizeModuleNavigation(moduleId, intent = null) {
  if (moduleId !== 'organizer') return { moduleId, intent };
  return {
    moduleId: 'projects',
    intent: intent ? { ...intent, type: intent.type === 'organizer' ? 'projects' : intent.type, legacySource: 'organizer' } : null
  };
}

const demoUser = { name: 'Mariusz', role: 'Administrator', email: 'admin@fixer.local' };

function NotificationsBell({ onNavigate }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [readMap, setReadMap] = useState(readNotificationReadMap);
  const [deletedMap, setDeletedMap] = useState(readNotificationDeletedMap);
  const [loadError, setLoadError] = useState('');
  const [confirmDialog, setConfirmDialog] = useState(null);
  const panelRef = useRef(null);

  const loadNotifications = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const rows = await buildOperatorNotifications();
      setNotifications(rows);
      setReadMap(readNotificationReadMap());
      setDeletedMap(readNotificationDeletedMap());
    } catch (error) {
      console.warn('Notifications failed', error);
      setLoadError('Nie udało się odświeżyć powiadomień.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
    const onFocus = () => loadNotifications();
    const onStorage = (event) => {
      if ([NOTIFICATIONS_READ_STORAGE_KEY, NOTIFICATIONS_DELETED_STORAGE_KEY, NOTIFICATIONS_BACKUP_FAILURE_KEY, COMPANY_PROFILE_STORAGE_KEY].includes(event.key)) loadNotifications();
    };
    window.addEventListener('focus', onFocus);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (!panelRef.current?.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const activeNotifications = notifications.filter((item) => !deletedMap[item.id]);
  const unreadCount = activeNotifications.filter((item) => !readMap[item.id]).length;
  const visibleNotifications = activeNotifications.slice(0, 18);
  const readVisibleCount = activeNotifications.filter((item) => readMap[item.id]).length;
  const markRead = (id) => {
    const next = saveNotificationReadMap({ ...readNotificationReadMap(), [id]: new Date().toISOString() });
    setReadMap(next);
  };
  const markAllRead = () => {
    const timestamp = new Date().toISOString();
    const next = { ...readNotificationReadMap() };
    activeNotifications.forEach((item) => { next[item.id] = timestamp; });
    setReadMap(saveNotificationReadMap(next));
  };
  const deleteReadNotifications = () => {
    const readIds = activeNotifications.filter((item) => readMap[item.id]).map((item) => item.id);
    if (!readIds.length) return;
    setConfirmDialog({
      title: 'Usuń przeczytane',
      message: `Usunąć przeczytane powiadomienia: ${readIds.length}? Nieprzeczytane pozostaną na liście.`,
      confirmLabel: 'Usuń',
      cancelLabel: 'Anuluj',
      variant: 'warning',
      onConfirm: () => {
        setConfirmDialog(null);
        const timestamp = new Date().toISOString();
        const nextDeleted = { ...readNotificationDeletedMap() };
        readIds.forEach((id) => { nextDeleted[id] = timestamp; });
        const nextRead = { ...readNotificationReadMap() };
        readIds.forEach((id) => { delete nextRead[id]; });
        setDeletedMap(saveNotificationDeletedMap(nextDeleted));
        setReadMap(saveNotificationReadMap(nextRead));
      }
    });
  };
  const clearAllNotifications = () => {
    if (!activeNotifications.length) return;
    setConfirmDialog({
      title: 'Wyczyść powiadomienia',
      message: `Wyczyścić wszystkie powiadomienia: ${activeNotifications.length}? Historia lokalna centrum powiadomień zostanie wyczyszczona.`,
      confirmLabel: 'Wyczyść',
      cancelLabel: 'Anuluj',
      variant: 'warning',
      onConfirm: () => {
        setConfirmDialog(null);
        const timestamp = new Date().toISOString();
        const nextDeleted = { ...readNotificationDeletedMap() };
        activeNotifications.forEach((item) => { nextDeleted[item.id] = timestamp; });
        setDeletedMap(saveNotificationDeletedMap(nextDeleted));
        setReadMap(saveNotificationReadMap({}));
      }
    });
  };
  const openNotification = (notification) => {
    markRead(notification.id);
    setOpen(false);
    if (notification.targetModule) onNavigate(notification.targetModule, notification.intent ?? null);
  };

  return <div className="notifications-shell" ref={panelRef}>
    <button className={`icon-button notifications-trigger ${open ? 'active' : ''}`} type="button" onClick={() => { setOpen((value) => !value); loadNotifications(); }} aria-label={`Powiadomienia${unreadCount ? `: ${unreadCount} nieprzeczytane` : ''}`} aria-expanded={open}>
      <Bell size={18} />
      {unreadCount > 0 && <span className="notifications-count">{unreadCount > 99 ? '99+' : unreadCount}</span>}
    </button>
    {open && <div className="notifications-dropdown">
      <div className="notifications-header">
        <div>
          <strong>Powiadomienia</strong>
          <span>{unreadCount ? `${unreadCount} nieprzeczytane` : 'Brak nowych powiadomień'}</span>
        </div>
        <div className="notifications-actions">
          <button type="button" onClick={markAllRead} disabled={!unreadCount} title="Oznacz wszystkie jako przeczytane" aria-label="Oznacz wszystkie jako przeczytane"><CheckCheck size={15} /></button>
          <button type="button" onClick={deleteReadNotifications} disabled={!readVisibleCount} title="Usuń przeczytane" aria-label="Usuń przeczytane"><Trash2 size={15} /></button>
          <button type="button" className="danger-action" onClick={clearAllNotifications} disabled={!activeNotifications.length} title="Wyczyść wszystkie" aria-label="Wyczyść wszystkie"><Eraser size={15} /></button>
        </div>
      </div>
      {loading && <div className="notifications-state">Odświeżam...</div>}
      {loadError && <div className="notifications-state error">{loadError}</div>}
      {!loading && !loadError && !visibleNotifications.length && <div className="notifications-empty">Brak nowych powiadomień</div>}
      {!loading && !loadError && Boolean(visibleNotifications.length) && <div className="notifications-list">
        {visibleNotifications.map((notification) => {
          const unread = !readMap[notification.id];
          return <button key={notification.id} type="button" className={`notification-item ${unread ? 'unread' : 'read'} tone-${notification.tone}`} onClick={() => openNotification(notification)}>
            <span className="notification-marker">!</span>
            <span className="notification-copy">
              <strong>{notification.title}</strong>
              <em>{notification.primary}</em>
              <small>{[notification.secondary, notification.detail].filter(Boolean).join(' · ')}</small>
            </span>
          </button>;
        })}
      </div>}
    </div>}
    {confirmDialog && <ConfirmDialog title={confirmDialog.title} message={confirmDialog.message} confirmLabel={confirmDialog.confirmLabel} cancelLabel={confirmDialog.cancelLabel} variant={confirmDialog.variant} onConfirm={confirmDialog.onConfirm} onCancel={() => setConfirmDialog(null)} />}
  </div>;
}

class AppErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error('AppErrorBoundary caught:', error, info?.componentStack); }
  render() {
    if (this.state.error) {
      return <div style={{ padding: '40px', fontFamily: 'monospace', color: '#f87171', background: '#0f172a', minHeight: '100vh' }}>
        <h2 style={{ color: '#fb923c' }}>Błąd renderowania</h2>
        <p>{String(this.state.error?.message ?? this.state.error)}</p>
        <pre style={{ fontSize: '12px', whiteSpace: 'pre-wrap', color: '#94a3b8', marginTop: '16px' }}>{this.state.error?.stack}</pre>
        <button onClick={() => this.setState({ error: null })} style={{ marginTop: '20px', padding: '8px 18px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Spróbuj ponownie</button>
      </div>;
    }
    return this.props.children;
  }
}

function App() {
  const [activeModule, setActiveModule] = useState('dashboard');
  const [session, setSession] = useState(null);
  const [demoAuth, setDemoAuth] = useState(() => localStorage.getItem('fixer-demo-auth') === 'true');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('fixer-sidebar') === 'collapsed');
  const [globalSearch, setGlobalSearch] = useState('');
  const [themeCompact, setThemeCompact] = useState(() => localStorage.getItem('fixer-density') === 'compact');
  const [colorTheme, setColorTheme] = useState(() => localStorage.getItem('fixer-color-theme') === 'light' ? 'light' : 'dark');
  const [moduleIntent, setModuleIntent] = useState(null);
  const [statusColors, setStatusColors] = useState(getStatusColors);
  const [activeUiTheme, setActiveUiTheme] = useState(() => getStoredActiveUiTheme(colorTheme === 'light' ? 'default-light' : 'default-dark'));
  const uiThemeCssVariables = useMemo(() => createUiThemeCssVariables(activeUiTheme.tokens), [activeUiTheme.tokens]);

  useEffect(() => {
    saveActiveUiTheme(activeUiTheme);
  }, [activeUiTheme]);

  useEffect(() => { injectStatusColorStyles(statusColors); }, [statusColors]);

  const handleStatusColorChange = (statusName, hex) => {
    const key = statusName.toLowerCase().trim();
    const next = { ...statusColors };
    if (hex) { next[key] = hex; } else { delete next[key]; }
    saveStatusColors(next);
    setStatusColors(next);
  };

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
  const navigateToModule = (moduleId, intent = null) => {
    const next = normalizeModuleNavigation(moduleId, intent);
    setModuleIntent(next.intent);
    setActiveModule(next.moduleId);
  };

  const handleLogout = async () => {
    if (isSupabaseConfigured) await supabase.auth.signOut();
    localStorage.removeItem('fixer-demo-auth');
    setDemoAuth(false);
    setSession(null);
  };

  const openGlobalSearchResult = (result) => {
    if (!result?.module) return;
    navigateToModule(result.module, result.intent ?? null);
    setGlobalSearch('');
  };

  if (!isAuthenticated) {
    return <LoginScreen onDemoLogin={() => { localStorage.setItem('fixer-demo-auth', 'true'); setDemoAuth(true); }} />;
  }

  return (
    <div className={`app-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''} ${themeCompact ? 'compact' : ''} theme-${colorTheme}`} style={uiThemeCssVariables}>
      <Sidebar
        activeModule={activeModule}
        setActiveModule={(moduleId) => navigateToModule(moduleId)}
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
          onOpenGlobalResult={openGlobalSearchResult}
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
          onNavigate={navigateToModule}
        />
        <section className="page-content">
          {activeModule === 'dashboard' && <Dashboard onNavigate={navigateToModule} />}
          {activeModule === 'clients' && <ClientsModule dashboardIntent={moduleIntent} onConsumeDashboardIntent={() => setModuleIntent(null)} />}
          {activeModule === 'equipment' && <EquipmentModule dashboardIntent={moduleIntent} onConsumeDashboardIntent={() => setModuleIntent(null)} onNavigate={navigateToModule} />}
          {activeModule === 'rentals' && <RentalsModule dashboardIntent={moduleIntent} onConsumeDashboardIntent={() => setModuleIntent(null)} />}
          {activeModule === 'service' && <ServiceModule dashboardIntent={moduleIntent} onConsumeDashboardIntent={() => setModuleIntent(null)} />}
          {activeModule === 'calendar' && <CalendarModule dashboardIntent={moduleIntent} onConsumeDashboardIntent={() => setModuleIntent(null)} onNavigate={navigateToModule} />}
          {activeModule === 'projects' && <ProjectsModule dashboardIntent={moduleIntent} onConsumeDashboardIntent={() => setModuleIntent(null)} />}
          {activeModule === 'documents' && <DocumentsModule dashboardIntent={moduleIntent} onConsumeDashboardIntent={() => setModuleIntent(null)} colorTheme={colorTheme} onChangeColorTheme={(nextTheme) => { setColorTheme(nextTheme); localStorage.setItem('fixer-color-theme', nextTheme); }} statusColors={statusColors} onStatusColorChange={handleStatusColorChange} activeUiTheme={activeUiTheme} onChangeActiveUiTheme={setActiveUiTheme} />}
          {activeModule === 'settings' && <SettingsModule dashboardIntent={moduleIntent} onConsumeDashboardIntent={() => setModuleIntent(null)} colorTheme={colorTheme} onChangeColorTheme={(nextTheme) => { setColorTheme(nextTheme); localStorage.setItem('fixer-color-theme', nextTheme); }} statusColors={statusColors} onStatusColorChange={handleStatusColorChange} activeUiTheme={activeUiTheme} onChangeActiveUiTheme={setActiveUiTheme} />}
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

function Topbar({ module, globalSearch, setGlobalSearch, onOpenGlobalResult, onToggleDensity, themeCompact, colorTheme, onChangeColorTheme, onNavigate }) {
  const [searchGroups, setSearchGroups] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const searchRef = useRef(null);
  const trimmedSearch = globalSearch.trim();
  const flatResults = searchGroups.flatMap((group) => group.results.map((result) => ({ ...result, groupLabel: group.label })));

  useEffect(() => {
    if (trimmedSearch.length < 2) {
      setSearchGroups([]);
      setSearchLoading(false);
      setActiveIndex(0);
      return undefined;
    }

    let active = true;
    setSearchLoading(true);
    const timer = window.setTimeout(() => {
      searchGlobalRecords(trimmedSearch).then((groups) => {
        if (!active) return;
        setSearchGroups(groups.filter((group) => group.results.length));
        setActiveIndex(0);
      }).catch((error) => {
        if (!active) return;
        console.warn('Global search failed', error);
        setSearchGroups([]);
      }).finally(() => {
        if (active) setSearchLoading(false);
      });
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [trimmedSearch]);

  useEffect(() => {
    const handleOutside = (event) => {
      if (searchRef.current?.contains(event.target)) return;
      setSearchOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const openResult = (result = flatResults[activeIndex]) => {
    if (!result) return;
    onOpenGlobalResult?.(result);
    setSearchOpen(false);
    setSearchGroups([]);
    setActiveIndex(0);
  };

  const handleSearchKeyDown = (event) => {
    if (event.key === 'Escape') {
      setSearchOpen(false);
      setActiveIndex(0);
      return;
    }
    if (trimmedSearch.length < 2) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSearchOpen(true);
      if (!flatResults.length) return;
      setActiveIndex((current) => Math.min(flatResults.length - 1, current + 1));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSearchOpen(true);
      if (!flatResults.length) return;
      setActiveIndex((current) => Math.max(0, current - 1));
      return;
    }
    if (event.key === 'Enter') {
      if (flatResults.length) {
        event.preventDefault();
        openResult();
      }
    }
  };

  let renderedIndex = 0;

  return (
    <header className="topbar">
      <div><p className="eyebrow">Panel systemu</p><h1>{module.label}</h1></div>
      <div className="topbar-actions">
        <div className="global-search-wrapper" ref={searchRef}>
          <div className={`global-search ${searchOpen && trimmedSearch.length >= 2 ? 'active' : ''}`}>
            <Search size={18} />
            <input
              value={globalSearch}
              onChange={(event) => { setGlobalSearch(event.target.value); setSearchOpen(true); }}
              onFocus={() => setSearchOpen(true)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Szukaj globalnie: klient, sprzęt, serwis, wypożyczenie..."
              aria-label="Szukaj globalnie"
              aria-expanded={searchOpen && trimmedSearch.length >= 2}
            />
          </div>
          {searchOpen && trimmedSearch.length >= 2 && <div className="global-search-dropdown">
            {searchLoading && <div className="global-search-state">Szukam...</div>}
            {!searchLoading && !flatResults.length && <div className="global-search-state">Brak wyników</div>}
            {!searchLoading && searchGroups.map((group) => <div className="global-search-group" key={group.module}>
              <div className="global-search-group-title">{group.label}</div>
              {group.results.map((result) => {
                const currentIndex = renderedIndex++;
                const active = currentIndex === activeIndex;
                return <button key={result.id} type="button" className={`global-search-result ${active ? 'active' : ''}`} onMouseEnter={() => setActiveIndex(currentIndex)} onMouseDown={(event) => { event.preventDefault(); openResult(result); }}>
                  <span className="global-search-type">{result.recordType}</span>
                  <span className="global-search-title">{result.title}</span>
                  {result.status && <StatusPill value={result.status} />}
                  <small>{result.description || '—'}</small>
                </button>;
              })}
            </div>)}
          </div>}
        </div>
        <button className="icon-button" onClick={onToggleDensity}><SlidersHorizontal size={18} /><span>{themeCompact ? 'Kompakt' : 'Wygodny'}</span></button>
        <button className="icon-button" onClick={() => onChangeColorTheme(colorTheme === 'light' ? 'dark' : 'light')} title="Zmień motyw">{colorTheme === 'light' ? <Moon size={18} /> : <Sun size={18} />}<span>{colorTheme === 'light' ? 'Ciemny' : 'Jasny'}</span></button>
        <NotificationsBell onNavigate={onNavigate} />
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

const DASHBOARD_SETTINGS_STORAGE_KEY = 'fixer-dashboard-layout-v2';
const DASHBOARD_DEFAULT_PANEL_LAYOUT = { columnPercent: 50, rowPercent: 50 };
const DASHBOARD_ITEMS = [
  { id: 'overdueRentals', label: 'Zwroty po terminie', area: 'card', tone: 'rental-danger' },
  { id: 'todayReturns', label: 'Zwroty dzisiaj', area: 'card', tone: 'rental-today' },
  { id: 'overdueServices', label: 'Zaległe serwisy', area: 'card', tone: 'service-danger' },
  { id: 'todayServices', label: 'Serwisy na dziś', area: 'card', tone: 'service-today' },
  { id: 'overdueTasksCard', label: 'Zaległe zadania', area: 'card', tone: 'task-danger' },
  { id: 'todayTasksCard', label: 'Zadania na dziś', area: 'card', tone: 'task-today' },
  { id: 'overdueProjectsCard', label: 'Projekty po terminie', area: 'card', tone: 'task-danger' },
  { id: 'attentionPanel', label: 'Najważniejsze dziś', area: 'panel', tone: 'attention' },
  { id: 'todayTasks', label: 'Zadania do zrobienia', area: 'panel', tone: 'tasks' },
  { id: 'activeServices', label: 'Aktywne serwisy', area: 'panel', tone: 'service' },
  { id: 'activeRentalsPanel', label: 'Aktywne wypożyczenia', area: 'panel', tone: 'rental' }
];

function isServiceWaitingForPickup(order) {
  const status = normalizeStatusText(order?.status);
  return ['gotowe', 'do odbioru', 'oczekuje na odbior', 'oczekuje na odbiór'].some((part) => status.includes(normalizeStatusText(part)));
}

function buildDashboardAttentionItem({ key, source, icon: Icon, tone, title, dueDate, label, priority, onClick }) {
  const days = daysUntilDate(dueDate);
  return {
    key,
    source,
    Icon,
    tone,
    title,
    dueDate,
    label,
    priority,
    days: days ?? 999,
    onClick
  };
}

function getDefaultDashboardSettings() {
  return {
    visible: Object.fromEntries(DASHBOARD_ITEMS.map((item) => [item.id, true])),
    cardOrder: DASHBOARD_ITEMS.filter((item) => item.area === 'card').map((item) => item.id),
    panelOrder: ['todayTasks', 'attentionPanel', 'activeServices', 'activeRentalsPanel'],
    panelLayout: { ...DASHBOARD_DEFAULT_PANEL_LAYOUT }
  };
}

function normalizeDashboardSettings(settings) {
  const defaults = getDefaultDashboardSettings();
  const visible = { ...defaults.visible, ...(settings?.visible ?? {}) };
  DASHBOARD_ITEMS.forEach((item) => { visible[item.id] = visible[item.id] !== false; });
  const normalizeOrder = (saved, def) => {
    const safe = Array.isArray(saved) ? saved : [];
    return [...safe.filter((id) => def.includes(id)), ...def.filter((id) => !safe.includes(id))];
  };
  const normalizePercent = (value, fallback) => {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(68, Math.max(32, number));
  };
  const legacyPanelOrder = ['attentionPanel', 'todayTasks', 'activeServices', 'activeRentalsPanel'];
  const savedPanelOrder = settings?.panelOrder;
  const panelOrder = Array.isArray(savedPanelOrder) && savedPanelOrder.join('|') === legacyPanelOrder.join('|') && !settings?.panelLayout
    ? defaults.panelOrder
    : normalizeOrder(savedPanelOrder, defaults.panelOrder);
  return {
    visible,
    cardOrder: normalizeOrder(settings?.cardOrder, defaults.cardOrder),
    panelOrder,
    panelLayout: {
      columnPercent: normalizePercent(settings?.panelLayout?.columnPercent, defaults.panelLayout.columnPercent),
      rowPercent: normalizePercent(settings?.panelLayout?.rowPercent, defaults.panelLayout.rowPercent)
    }
  };
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

function Dashboard({ onNavigate }) {
  const [rentalsRows, setRentalsRows] = useState([]);
  const [serviceRows, setServiceRows] = useState([]);
  const [organizerRows, setOrganizerRows] = useState([]);
  const [projectRows, setProjectRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [dashboardSettings, setDashboardSettings] = useState(getDashboardSettings);
  const [editMode, setEditMode] = useState(false);
  const panelsGridRef = useRef(null);

  useEffect(() => {
    let active = true;
    const loadDashboard = async () => {
      setLoading(true);
      const [rentalsResult, serviceResult, organizerResult, projectsResult] = await Promise.all([fetchRentals(), fetchServiceOrders(), fetchOrganizerTasks(), fetchProjects()]);
      if (!active) return;
      setRentalsRows(rentalsResult.data ?? []);
      setServiceRows(serviceResult.data ?? []);
      setOrganizerRows(organizerResult.data ?? []);
      setProjectRows(projectsResult.data ?? []);
      const errors = [rentalsResult.error ? 'wypożyczenia' : '', serviceResult.error ? 'serwis' : '', organizerResult.error ? 'zadania' : '', projectsResult.error ? 'projekty' : ''].filter(Boolean);
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

  const toggleItemVisible = (id) => {
    updateDashboardSettings((current) => ({ ...current, visible: { ...current.visible, [id]: !(current.visible[id] !== false) } }));
  };

  const moveCard = (index, direction) => {
    const order = [...dashboardSettings.cardOrder];
    const next = index + direction;
    if (next < 0 || next >= order.length) return;
    [order[index], order[next]] = [order[next], order[index]];
    updateDashboardSettings((current) => ({ ...current, cardOrder: order }));
  };

  const movePanel = (index, direction) => {
    const order = [...dashboardSettings.panelOrder];
    const next = index + direction;
    if (next < 0 || next >= order.length) return;
    [order[index], order[next]] = [order[next], order[index]];
    updateDashboardSettings((current) => ({ ...current, panelOrder: order }));
  };

  const resetDashboardLayout = () => setDashboardSettings(resetDashboardSettings());

  const startPanelResize = (axis, event) => {
    event.preventDefault();
    event.stopPropagation();
    const grid = panelsGridRef.current;
    if (!grid) return;
    const rect = grid.getBoundingClientRect();
    const onMouseMove = (moveEvent) => {
      const nextPercent = axis === 'x'
        ? ((moveEvent.clientX - rect.left) / rect.width) * 100
        : ((moveEvent.clientY - rect.top) / rect.height) * 100;
      const clamped = Math.min(68, Math.max(32, nextPercent));
      updateDashboardSettings((current) => ({
        ...current,
        panelLayout: {
          ...(current.panelLayout ?? DASHBOARD_DEFAULT_PANEL_LAYOUT),
          [axis === 'x' ? 'columnPercent' : 'rowPercent']: clamped
        }
      }));
    };
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.classList.remove('resizing-dashboard-layout');
    };
    document.body.classList.add('resizing-dashboard-layout');
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const today = getLocalIsoDate();
  const activeRentals = rentalsRows.filter((rental) => rental.status !== 'returned');
  const overdueRentals = activeRentals.filter((rental) => getRentalOverdueDays(rental) > 0);
  const todayReturns = activeRentals.filter((rental) => String(rental.planned_return_date ?? '').slice(0, 10) === today);
  const activeServices = serviceRows.filter((order) => order.status !== 'Wydane');
  const overdueServices = activeServices.filter((order) => order.planned_date && String(order.planned_date).slice(0, 10) < today);
  const todayServices = activeServices.filter((order) => String(order.planned_date ?? '').slice(0, 10) === today);
  const pickupServices = activeServices.filter(isServiceWaitingForPickup);
  const activeTasks = organizerRows.filter((task) => !task.archived);
  const overdueTasks = activeTasks.filter((task) => task.due_date && String(task.due_date).slice(0, 10) < today);
  const todayOrReminderTasks = activeTasks.filter((task) => {
    const dueToday = String(task.due_date ?? '').slice(0, 10) === today;
    const reminderToday = task.reminder_at && String(task.reminder_at).slice(0, 10) === today;
    return dueToday || reminderToday;
  });
  const activeProjects = projectRows.filter((p) => !p.archived);
  const overdueProjects = activeProjects.filter((p) => p.due_date && String(p.due_date).slice(0, 10) < today);
  const todayProjects = activeProjects.filter((p) => String(p.due_date ?? '').slice(0, 10) === today);

  const cardDataMap = {
    overdueRentals: { value: overdueRentals.length, isActive: overdueRentals.length > 0, target: ['rentals', { type: 'rentals', filter: 'overdue' }] },
    todayReturns: { value: todayReturns.length, isActive: todayReturns.length > 0, target: ['rentals', { type: 'rentals', filter: 'today' }] },
    overdueServices: { value: overdueServices.length, isActive: overdueServices.length > 0, target: ['service', null] },
    todayServices: { value: todayServices.length, isActive: todayServices.length > 0, target: ['service', null] },
    overdueTasksCard: { value: overdueTasks.length, isActive: overdueTasks.length > 0, target: ['projects', { type: 'projects', filter: 'tasks' }] },
    todayTasksCard: { value: todayOrReminderTasks.length, isActive: todayOrReminderTasks.length > 0, target: ['projects', { type: 'projects', filter: 'tasks' }] },
    overdueProjectsCard: { value: overdueProjects.length, isActive: overdueProjects.length > 0, target: ['projects', null] }
  };

  const metricIcons = {
    overdueRentals: Package,
    todayReturns: Clock,
    overdueServices: Wrench,
    todayServices: CalendarDays,
    overdueTasksCard: ClipboardList,
    todayTasksCard: CheckCircle2,
    overdueProjectsCard: Briefcase
  };

  const orderedCards = (dashboardSettings.cardOrder ?? []).map((id) => {
    const meta = DASHBOARD_ITEMS.find((item) => item.id === id);
    const data = cardDataMap[id];
    const Icon = metricIcons[id] ?? LayoutDashboard;
    return meta && data ? { ...meta, ...data, Icon } : null;
  }).filter(Boolean);

  const orderedPanels = (dashboardSettings.panelOrder ?? []).map((id) => DASHBOARD_ITEMS.find((item) => item.id === id)).filter(Boolean);

  const colPercent = dashboardSettings.panelLayout?.columnPercent ?? DASHBOARD_DEFAULT_PANEL_LAYOUT.columnPercent;
  const rowPercent = dashboardSettings.panelLayout?.rowPercent ?? DASHBOARD_DEFAULT_PANEL_LAYOUT.rowPercent;
  const visiblePanelIds = orderedPanels.filter((p) => isDashboardItemVisible(p.id)).map((p) => p.id);
  const visiblePanelCount = visiblePanelIds.length;

  const attentionItems = [
    ...overdueRentals.map((r) => buildDashboardAttentionItem({ key: `rental:${r.id ?? r.localId ?? r.rental_number}`, source: 'Wypożyczenie', icon: Package, tone: 'rental-danger', title: `${r.rental_number} — ${r.clients?.name ?? '—'}`, dueDate: r.planned_return_date, label: `Zwrot po terminie: ${getRentalOverdueDays(r)} ${getRentalOverdueDays(r) === 1 ? 'dzień' : 'dni'}`, priority: 10, onClick: () => onNavigate('rentals', { type: 'rentals', filter: 'open', rentalId: r.id }) })),
    ...overdueServices.map((s) => buildDashboardAttentionItem({ key: `service:${s.id ?? s.localId ?? s.service_number}`, source: 'Serwis', icon: Wrench, tone: 'service-danger', title: `${s.service_number} — ${s.customer_device_name || '—'}`, dueDate: s.planned_date, label: 'Serwis po terminie', priority: 20, onClick: () => onNavigate('service', { type: 'service', serviceOrderId: s.id }) })),
    ...overdueTasks.map((t) => buildDashboardAttentionItem({ key: `task:${t.id ?? t.localId}`, source: 'Zadanie', icon: ClipboardList, tone: 'task-danger', title: t.title || 'Zadanie bez tytułu', dueDate: t.due_date, label: 'Zadanie po terminie', priority: 30, onClick: () => onNavigate('projects', { type: 'projects', taskId: t.id ?? t.localId }) })),
    ...overdueProjects.map((p) => buildDashboardAttentionItem({ key: `project:${p.id ?? p.localId ?? p.project_number}`, source: 'Projekt', icon: Briefcase, tone: 'project-danger', title: `${p.project_number ? p.project_number + ' — ' : ''}${p.name || 'Projekt bez nazwy'}`, dueDate: p.due_date, label: 'Projekt po terminie', priority: 40, onClick: () => onNavigate('projects', { type: 'projects', projectId: p.id ?? p.localId }) })),
    ...todayReturns.map((r) => buildDashboardAttentionItem({ key: `rental:${r.id ?? r.localId ?? r.rental_number}`, source: 'Wypożyczenie', icon: Package, tone: 'rental-today', title: `${r.rental_number} — ${r.clients?.name ?? '—'}`, dueDate: r.planned_return_date, label: 'Zwrot sprzętu dzisiaj', priority: 50, onClick: () => onNavigate('rentals', { type: 'rentals', filter: 'open', rentalId: r.id }) })),
    ...todayServices.map((s) => buildDashboardAttentionItem({ key: `service:${s.id ?? s.localId ?? s.service_number}`, source: 'Serwis', icon: Wrench, tone: 'service-today', title: `${s.service_number} — ${s.customer_device_name || '—'}`, dueDate: s.planned_date, label: 'Termin serwisu dzisiaj', priority: 60, onClick: () => onNavigate('service', { type: 'service', serviceOrderId: s.id }) })),
    ...pickupServices.map((s) => buildDashboardAttentionItem({ key: `service:${s.id ?? s.localId ?? s.service_number}`, source: 'Serwis', icon: Wrench, tone: 'service-pickup', title: `${s.service_number} — ${s.customer_device_name || '—'}`, dueDate: s.planned_date, label: 'Oczekuje na odbiór', priority: 70, onClick: () => onNavigate('service', { type: 'service', serviceOrderId: s.id }) })),
    ...todayOrReminderTasks.map((t) => buildDashboardAttentionItem({ key: `task:${t.id ?? t.localId}`, source: 'Zadanie', icon: ClipboardList, tone: 'task-today', title: t.title || 'Zadanie bez tytułu', dueDate: t.due_date || t.reminder_at, label: t.due_date ? 'Zadanie na dziś' : 'Przypomnienie na dziś', priority: 80, onClick: () => onNavigate('projects', { type: 'projects', taskId: t.id ?? t.localId }) })),
    ...todayProjects.map((p) => buildDashboardAttentionItem({ key: `project:${p.id ?? p.localId ?? p.project_number}`, source: 'Projekt', icon: Briefcase, tone: 'project-today', title: `${p.project_number ? p.project_number + ' — ' : ''}${p.name || 'Projekt bez nazwy'}`, dueDate: p.due_date, label: 'Termin projektu dzisiaj', priority: 90, onClick: () => onNavigate('projects', { type: 'projects', projectId: p.id ?? p.localId }) }))
  ].sort((left, right) => left.priority - right.priority || left.days - right.days || String(left.title).localeCompare(String(right.title), 'pl'))
    .filter((item, index, items) => items.findIndex((candidate) => candidate.key === item.key) === index)
    .slice(0, 5);

  const panelTitles = { attentionPanel: 'Najważniejsze dziś', activeServices: 'Aktywne serwisy', activeRentalsPanel: 'Aktywne wypożyczenia', todayTasks: 'Zadania do zrobienia' };
  const panelIcons = { attentionPanel: Bell, activeServices: Wrench, activeRentalsPanel: Package, todayTasks: ClipboardList };
  const panelActions = { activeServices: () => onNavigate('service', null), activeRentalsPanel: () => onNavigate('rentals', { type: 'rentals', filter: 'active' }), todayTasks: () => onNavigate('projects', { type: 'projects', filter: 'tasks' }) };

  const renderDashboardEmpty = (message) => <div className="dashboard-empty-state"><CheckCircle2 size={15} /><span>{message}</span></div>;

  const renderPanelContent = (id) => {
    if (id === 'attentionPanel') return <div className="dashboard-table-scroll dashboard-attention-list">
      {attentionItems.map((item, i) => <button key={`${item.source}-${item.title}-${i}`} type="button" className={`dashboard-attention-item dashboard-attention-item--${item.tone}`} onClick={item.onClick}>
        <span className="dashboard-attention-source"><item.Icon size={14} /><span>{item.source}</span></span>
        <span className="dashboard-attention-item-text">{item.title}</span>
        <span className="dashboard-attention-item-date">{formatDashboardDate(item.dueDate)}</span>
        <span className="dashboard-attention-item-sub">{item.label}</span>
      </button>)}
      {!attentionItems.length && renderDashboardEmpty('Brak spraw wymagających uwagi.')}
    </div>;

    if (id === 'activeServices') return <div className="dashboard-table-scroll">{activeServices.length ? <table className="dashboard-mini-table">
      <thead><tr><th>Numer</th><th>Sprzęt</th><th>Status</th><th>Termin</th></tr></thead>
      <tbody>
        {activeServices.slice(0, 10).map((order) => <tr key={order.id ?? order.service_number} onClick={() => onNavigate('service', { type: 'service', serviceOrderId: order.id })}>
          <td>{order.service_number ?? '—'}</td><td>{order.customer_device_name || '—'}</td>
          <td><StatusPill value={order.status} /></td>
          <td className={order.planned_date && String(order.planned_date).slice(0, 10) < today ? 'dashboard-overdue-date' : ''}>{formatDashboardDate(order.planned_date)}</td>
        </tr>)}
      </tbody>
    </table> : renderDashboardEmpty('Brak aktywnych serwisów.')}</div>;

    if (id === 'activeRentalsPanel') return <div className="dashboard-table-scroll">{activeRentals.length ? <table className="dashboard-mini-table">
      <thead><tr><th>Numer</th><th>Klient</th><th>Termin zwrotu</th><th>Status</th></tr></thead>
      <tbody>
        {activeRentals.slice(0, 10).map((rental) => {
          const tone = getUpcomingReturnTone(rental);
          return <tr key={rental.id ?? rental.rental_number} className={`return-${tone}`} onClick={() => onNavigate('rentals', { type: 'rentals', filter: 'open', rentalId: rental.id })}>
            <td>{rental.rental_number}</td><td>{rental.clients?.name ?? '—'}</td>
            <td>{formatDashboardDate(rental.planned_return_date)}</td>
            <td><StatusPill value={getRentalOverdueDays(rental) ? 'Po terminie' : formatRentalStatus(rental.status)} /></td>
          </tr>;
        })}
      </tbody>
    </table> : renderDashboardEmpty('Brak aktywnych wypożyczeń.')}</div>;

    if (id === 'todayTasks') return <div className="dashboard-table-scroll">{activeTasks.length ? <table className="dashboard-mini-table">
      <thead><tr><th>Tytuł</th><th>Priorytet</th><th>Termin</th></tr></thead>
      <tbody>
        {activeTasks.slice(0, 10).map((task) => <tr key={task.id ?? task.localId} onClick={() => onNavigate('projects', { type: 'projects', taskId: task.id ?? task.localId })}>
          <td>{task.title}</td><td>{task.priority}</td>
          <td className={task.due_date && String(task.due_date).slice(0, 10) < today ? 'dashboard-overdue-date' : ''}>{formatDashboardDate(task.due_date)}</td>
        </tr>)}
      </tbody>
    </table> : renderDashboardEmpty('Brak zadań do wykonania.')}</div>;

    return null;
  };

  return <div className={`dashboard-operational ${editMode ? 'editing' : ''}`}>
    {notice && <div className="notice dashboard-notice">{notice}</div>}

    <div className="dashboard-metrics-bar">
      <div className="dashboard-metrics-header">
        <span className="dashboard-metrics-label">{editMode ? 'Tryb edycji — kliknij kafel aby ukryć/pokazać, strzałki aby przestawić' : 'Wskaźniki'}</span>
        <div className="dashboard-edit-actions">
          {loading && <span className="dashboard-loading">Odświeżanie...</span>}
          <AppButton variant="secondary" size="sm" onClick={() => setEditMode((current) => !current)}>{editMode ? 'Gotowe' : 'Dostosuj'}</AppButton>
          <AppButton variant="secondary" size="sm" onClick={resetDashboardLayout}><RotateCcw size={14} />Resetuj układ</AppButton>
        </div>
      </div>
      <div className="dashboard-metrics-grid">
        {orderedCards.map((card, index) => {
          const isVisible = isDashboardItemVisible(card.id);
          if (!isVisible && !editMode) return null;
          return <button key={card.id} type="button"
            className={`dashboard-metric-card dashboard-metric-card--${card.tone} ${card.isActive ? 'card-active' : ''} ${!isVisible ? 'card-hidden' : ''} ${editMode ? 'in-edit' : ''}`}
            onClick={() => { if (editMode) { toggleItemVisible(card.id); return; } onNavigate(...card.target); }}
          >
            {editMode && <div className="dashboard-card-reorder">
              <button type="button" className="dashboard-reorder-btn" onClick={(e) => { e.stopPropagation(); moveCard(index, -1); }} disabled={index === 0}>‹</button>
              <button type="button" className="dashboard-reorder-btn" onClick={(e) => { e.stopPropagation(); moveCard(index, 1); }} disabled={index === orderedCards.length - 1}>›</button>
            </div>}
            <span className="dashboard-metric-label"><card.Icon size={13} />{card.label}</span>
            <strong>{card.value}</strong>
          </button>;
        })}
        {orderedCards.every((c) => !isDashboardItemVisible(c.id)) && !editMode && <div className="dashboard-empty-layout dashboard-metrics-empty">Wszystkie wskaźniki są ukryte — użyj „Dostosuj".</div>}
      </div>
    </div>

    {(visiblePanelCount > 0 || editMode) && <div
      className="dashboard-panels-grid"
      ref={panelsGridRef}
      style={
        editMode || visiblePanelCount === 4
          ? { '--dashboard-left-column': `${colPercent}%`, '--dashboard-top-row': `${rowPercent}%` }
          : visiblePanelCount === 3
            ? { gridTemplateColumns: `minmax(0,${colPercent}%) minmax(0,1fr)`, gridTemplateRows: 'auto auto' }
            : visiblePanelCount === 2
              ? { gridTemplateColumns: `minmax(0,${colPercent}%) minmax(0,1fr)`, gridTemplateRows: 'auto' }
              : { gridTemplateColumns: '1fr', gridTemplateRows: 'auto' }
      }
    >
      {orderedPanels.map((panel, index) => {
        const isVisible = isDashboardItemVisible(panel.id);
        if (!isVisible && !editMode) return null;
        const navigate = panelActions[panel.id];
        const PanelIcon = panelIcons[panel.id] ?? LayoutDashboard;
        const spanFull = !editMode && visiblePanelCount === 3 && isVisible && visiblePanelIds.indexOf(panel.id) === 2;
        return <section key={panel.id} className={`panel dashboard-table-panel dashboard-panel--${panel.tone} ${!isVisible ? 'panel-hidden' : ''}`} style={spanFull ? { gridColumn: '1 / -1' } : undefined}>
          <div className="dashboard-panel-header-row">
            <h2 className="dashboard-panel-title"><PanelIcon size={15} />{panelTitles[panel.id] ?? panel.label}</h2>
            {editMode
              ? <div className="dashboard-panel-controls">
                  <button type="button" className="dashboard-panel-ctrl-btn" onClick={() => movePanel(index, -1)} disabled={index === 0}><ArrowUp size={11} /></button>
                  <button type="button" className="dashboard-panel-ctrl-btn" onClick={() => toggleItemVisible(panel.id)}>{isVisible ? <X size={11} /> : <Plus size={11} />}</button>
                  <button type="button" className="dashboard-panel-ctrl-btn" onClick={() => movePanel(index, 1)} disabled={index === orderedPanels.length - 1}><ArrowDown size={11} /></button>
                </div>
              : navigate && <button type="button" className="dashboard-panel-goto" onClick={navigate}>Przejdź<ChevronRight size={13} /></button>}
          </div>
          {isVisible && renderPanelContent(panel.id)}
        </section>;
      })}
      {editMode && <>
        <div className="dashboard-resize-handle dashboard-resize-handle-x" role="separator" aria-orientation="vertical" title="Zmień szerokość sekcji" onMouseDown={(event) => startPanelResize('x', event)} />
        <div className="dashboard-resize-handle dashboard-resize-handle-y" role="separator" aria-orientation="horizontal" title="Zmień wysokość sekcji" onMouseDown={(event) => startPanelResize('y', event)} />
      </>}
    </div>}
    {visiblePanelCount === 0 && !editMode && <div className="dashboard-empty-layout" style={{ marginTop: 8 }}>Wszystkie panele są ukryte — użyj „Dostosuj".</div>}
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

function ClientsModule({ dashboardIntent, onConsumeDashboardIntent }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [editorInitialTab, setEditorInitialTab] = useState('data');
  const [notice, setNotice] = useState('');
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [filters, setFilters] = useStoredState('fixer-clients-filters', { search: '', type: 'all', kind: 'all' });
  const [pendingOpenClientId, setPendingOpenClientId] = useState(null);

  const clientKinds = useMemo(() => {
    const values = [...DEFAULT_CLIENT_TYPES, ...rows.map((client) => client.client_kind).filter(Boolean)];
    return [...new Set(values)];
  }, [rows]);

  const filteredRows = useMemo(() => {
    const query = String(filters.search ?? '').trim().toLocaleLowerCase('pl');
    return rows.filter((client) => {
      const matchesType = filters.type === 'all' || client.type === filters.type;
      const matchesKind = filters.kind === 'all' || client.client_kind === filters.kind;
      const searchable = [client.name, client.type, client.client_kind, client.phone, client.email, client.city, client.nip]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('pl');
      return matchesType && matchesKind && (!query || searchable.includes(query));
    });
  }, [rows, filters]);

  const clearClientFilters = () => {
    setFilters({ search: '', type: 'all', kind: 'all' });
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

  useEffect(() => {
    if (dashboardIntent?.type !== 'clients') return;
    if (dashboardIntent.clientId) setPendingOpenClientId(dashboardIntent.clientId);
    onConsumeDashboardIntent?.();
  }, [dashboardIntent, onConsumeDashboardIntent]);

  useEffect(() => {
    if (!pendingOpenClientId || !rows.length) return;
    const client = rows.find((row) => String(row.id ?? row.localId) === String(pendingOpenClientId));
    if (client) openClientEditor(client, 'data');
    setPendingOpenClientId(null);
  }, [pendingOpenClientId, rows]);

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
    if (!client.name.trim()) return { error: new Error('Nazwa klienta jest wymagana.') };
    if (!isSupabaseConfigured) return { error: new Error('Brak konfiguracji bazy danych Supabase. Dane klientów nie mogą zostać zapisane.') };
    const result = client.id ? await updateClientRecord(client.id, payload) : await createClientRecord(payload);
    if (result.error) return { error: result.error };
    await loadClients();
    setEditorOpen(false);
    return { error: null };
  };

  const handleDelete = async (client) => {
    setConfirmDialog({
      title: 'Usuń klienta',
      message: `Usunąć klienta: ${client.name}?`,
      confirmLabel: 'Usuń',
      cancelLabel: 'Anuluj',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmDialog(null);
        if (!client.id || !isSupabaseConfigured) {
          setNotice('Brak konfiguracji bazy danych Supabase. Nie można usunąć klienta.');
          return;
        }
        const { error } = await deleteClientRecord(client.id);
        if (error) { setNotice(humanizeError(error, 'client')); return; }
        await loadClients();
      }
    });
  };

  const handleBulkDelete = async (clients) => {
    const selected = clients.filter((client) => client?.id);
    if (!selected.length) {
      setNotice('Zaznaczone pozycje nie mają identyfikatorów w bazie.');
      return;
    }
    setConfirmDialog({
      title: 'Usuń klientów',
      message: `Usunąć zaznaczone pozycje: ${selected.length}?`,
      confirmLabel: 'Usuń',
      cancelLabel: 'Anuluj',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmDialog(null);
        if (!isSupabaseConfigured) {
          setNotice('Brak konfiguracji bazy danych Supabase. Nie można usunąć klientów.');
          return;
        }
        for (const client of selected) {
          const { error } = await deleteClientRecord(client.id);
          if (error) {
            setNotice(`Nie udało się usunąć klienta ${client.name}: ${humanizeError(error, 'client')}`);
            return;
          }
        }
        await loadClients();
      }
    });
  };


  return (
    <div className="module-page">
      <section className="panel hero-panel">
        <div className="module-actions">
          <AppButton variant="primary" className="module-action-button" onClick={() => openClientEditor(null, 'data')}><Plus size={18} />Dodaj klienta</AppButton>
          <AppButton variant="secondary" className="module-action-button" onClick={loadClients}>Odśwież</AppButton>
          <AppButton variant="secondary" className="module-action-button" onClick={() => exportTableToCsv(CLIENTS_TABLE_KEY, CLIENTS_TABLE_COLUMNS, filteredRows)} disabled={!filteredRows.length}><Download size={16} />CSV</AppButton>
          <AppButton variant="secondary" className="module-action-button" onClick={() => exportTableToPdf('Baza klientów', CLIENTS_TABLE_KEY, CLIENTS_TABLE_COLUMNS, filteredRows)} disabled={!filteredRows.length}><FileText size={16} />PDF</AppButton>

        </div>
        {notice && <div className="notice">{notice}</div>}
      </section>
      <section className="panel clients-list-panel">
        <div className="client-filter-bar">
          <label>
            Szukaj
            <AppInput value={filters.search ?? ''} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Nazwa, miasto, telefon, email, NIP" />
          </label>
          <label>
            Typ
            <AppSelect value={filters.type ?? 'all'} onChange={(event) => setFilters((current) => ({ ...current, type: event.target.value }))}>
              <option value="all">Wszyscy</option>
              <option value="Firma">Tylko firmy</option>
              <option value="Osoba prywatna">Tylko osoby prywatne</option>
            </AppSelect>
          </label>
          <label>
            Rodzaj klienta
            <AppSelect value={filters.kind ?? 'all'} onChange={(event) => setFilters((current) => ({ ...current, kind: event.target.value }))}>
              <option value="all">Wszystkie rodzaje</option>
              {clientKinds.map((kind) => <option key={kind} value={kind}>{kind}</option>)}
            </AppSelect>
          </label>
          <AppButton variant="secondary" size="sm" className="compact-button" onClick={clearClientFilters}>Wyczyść filtry</AppButton>
          {rows.length > 0 && filteredRows.length < rows.length && <span className="filter-count">Wyświetlono {filteredRows.length} z {rows.length}</span>}
        </div>
        <DataTable storageKey={CLIENTS_TABLE_KEY} loading={loading} columns={CLIENTS_TABLE_COLUMNS} rows={filteredRows} onOpen={(client) => openClientEditor(client, 'data')} onEdit={(client) => openClientEditor(client, 'data')} onHistory={(client) => openClientEditor(client, 'history')} onDuplicate={duplicateClient} onDelete={handleDelete} onBulkDelete={handleBulkDelete} />
      </section>
      {editorOpen && <ClientEditor client={editingClient} initialTab={editorInitialTab} onClose={() => setEditorOpen(false)} onSave={handleSave} />}
      {confirmDialog && <ConfirmDialog title={confirmDialog.title} message={confirmDialog.message} confirmLabel={confirmDialog.confirmLabel} cancelLabel={confirmDialog.cancelLabel} variant={confirmDialog.variant} onConfirm={confirmDialog.onConfirm} onCancel={() => setConfirmDialog(null)} />}
    </div>
  );
}


function ClientEditor({ client, initialTab = 'data', onClose, onSave }) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [clientTypes, setClientTypes] = useState(DEFAULT_CLIENT_TYPES);
  const [errors, setErrors] = useState({});
  const [saveError, setSaveError] = useState('');
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

  const saveClient = async () => {
    setSaveError('');
    const nextErrors = validateClientForm(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    const result = await onSave(form);
    if (result?.error) setSaveError(result.error.message ?? humanizeError(result.error, 'client'));
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
    <ResizableModalFrame
      className="client-modal"
      storageKey="fixer-client-modal"
      defaultSize={{ width: 940, height: 560 }}
      minSize={{ width: 720, height: 420 }}
      eyebrow="Klient"
      title={client ? 'Kartoteka klienta' : 'Nowy klient'}
      onClose={onClose}
      footer={<><AppButton variant="secondary" onClick={onClose}>Anuluj</AppButton><AppButton variant="primary" onClick={saveClient}><Save size={18} />Zapisz</AppButton></>}
    >
      {saveError && <AppNotice variant="error" className="service-form-notice">{saveError}</AppNotice>}
      <div className="record-tabs" role="tablist">
        <button className={activeTab === 'data' ? 'active' : ''} onClick={() => setActiveTab('data')}>Dane klienta</button>
        <button className={activeTab === 'history' ? 'active' : ''} onClick={() => setActiveTab('history')}>Historia</button>
        <button className={activeTab === 'notes' ? 'active' : ''} onClick={() => setActiveTab('notes')}>Notatki</button>
      </div>
      <div className="client-tab-panel">
        {activeTab === 'data' && <div className="client-form-compact">
          <div className="form-section flat-form-section">
            <div className="section-title">Dane podstawowe</div>
            <div className="form-grid client-basic-grid">
              <FormField className="client-name-field" label="Nazwa klienta" error={errors.name}><AppInput className={fieldClass('name')} value={form.name} onChange={(event) => update('name', event.target.value)} /></FormField>
              <FormField className="client-type-field" label="Typ"><AppSelect value={form.type} onChange={(event) => update('type', event.target.value)}><option>Firma</option><option>Osoba prywatna</option></AppSelect></FormField>
              <FormField className="client-kind-field" label="Rodzaj klienta"><AppSelect value={form.client_kind} onChange={(event) => update('client_kind', event.target.value)}>{clientTypes.map((type) => <option key={type}>{type}</option>)}</AppSelect></FormField>
              <FormField className="phone-field" label="Telefon" error={errors.phone}><AppInput className={fieldClass('phone')} value={form.phone} onChange={(event) => update('phone', event.target.value)} /></FormField>
              <FormField className="email-field" label="Email" error={errors.email}><AppInput className={fieldClass('email')} value={form.email} onChange={(event) => update('email', event.target.value)} /></FormField>
            </div>
          </div>
          <div className="form-section flat-form-section">
            <div className="section-title">Adres</div>
            <div className="form-grid compact-address-grid">
              <FormField className="street-field" label="Ulica"><AppInput value={form.street} onChange={(event) => update('street', event.target.value)} /></FormField>
              <FormField className="building-field" label="Nr budynku"><AppInput value={form.building_number} onChange={(event) => update('building_number', event.target.value)} /></FormField>
              <FormField className="apartment-field" label="Nr lokalu"><AppInput value={form.apartment_number} onChange={(event) => update('apartment_number', event.target.value)} /></FormField>
              <FormField className="postal-field" label="Kod pocztowy" error={errors.postal_code}><AppInput className={fieldClass('postal_code')} value={form.postal_code} onChange={(event) => update('postal_code', event.target.value)} /></FormField>
              <FormField className="city-field" label="Miasto"><AppInput value={form.city} onChange={(event) => update('city', event.target.value)} /></FormField>
              <FormField className="country-field" label="Kraj"><AppInput value={form.country} onChange={(event) => update('country', event.target.value)} /></FormField>
            </div>
          </div>
          {form.type === 'Firma' && <div className="form-section flat-form-section">
            <div className="section-title">Dane firmowe</div>
            <div className="form-grid company-data-grid">
              <FormField label="NIP" error={errors.nip}><AppInput className={fieldClass('nip')} value={form.nip} onChange={(event) => update('nip', event.target.value)} /></FormField>
              <FormField label="REGON" error={errors.regon}><AppInput className={fieldClass('regon')} value={form.regon} onChange={(event) => update('regon', event.target.value)} /></FormField>
            </div>
          </div>}
        </div>}
        {activeTab === 'notes' && <div className="notes-panel">
          <div className="form-section notes-section">
            <div className="section-title">Notatki</div>
            <FormField label="Informacje wewnętrzne o kliencie"><AppTextarea resizeKey="fixer:textarea:client:notes" value={form.notes} onChange={(event) => update('notes', event.target.value)} /></FormField>
          </div>
        </div>}
        {activeTab === 'history' && <div className="history-panel">
          <div className="summary-box"><strong>Informacje o kliencie</strong><span>{form.notes || 'Brak notatek.'}</span></div>
          {clientHistoryRows.length ? <DataTable storageKey={`client-history-${form.id ?? form.localId ?? 'new'}`} columns={[{ key: 'date', label: 'Data' },{ key: 'type', label: 'Typ' },{ key: 'description', label: 'Opis' },{ key: 'status', label: 'Status' }]} rows={clientHistoryRows} /> : <div className="notice">Brak powiązanych wypożyczeń lub zleceń serwisowych dla tego klienta.</div>}
        </div>}
      </div>
    </ResizableModalFrame>
  );
}


const EQUIPMENT_SET_CATEGORY = 'Zestaw';
const EQUIPMENT_SET_COMPONENT_STATUS = 'Składnik zestawu';
const EQUIPMENT_AVAILABLE_STATUS = 'Dostępny';
const EQUIPMENT_TABLE_KEY = 'equipment-table';
const EQUIPMENT_TABLE_COLUMNS = [
  { key: 'item_type', label: 'Typ' },
  { key: 'name', label: 'Nazwa', renderCell: (row) => renderEquipmentNameWithBadge(row) },
  { key: 'category', label: 'Kategoria' },
  { key: 'brand', label: 'Marka' },
  { key: 'model', label: 'Model' },
  { key: 'serial', label: 'Numer seryjny' },
  { key: 'inventory_number', label: 'Nr inw.' },
  { key: 'status', label: 'Status' },
  { key: 'location', label: 'Lokalizacja' },
  { key: 'set_items_count', label: 'Składniki' }
];

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

function renderEquipmentNameWithBadge(row) {
  const isSet = isEquipmentSet(row) || row.item_type === 'set' || row.item_type === 'Zestaw' || row.item_type_display === 'Zestaw';
  if (!isSet) return row.name || '—';
  return (
    <span className="equipment-name-cell">
      <span className="equipment-set-badge">ZESTAW</span>
      {row.name || '—'}
    </span>
  );
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

function EquipmentModule({ dashboardIntent, onConsumeDashboardIntent, onNavigate }) {
  const [rows, setRows] = useState(demoEquipment);
  const [loading, setLoading] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState(null);
  const [notice, setNotice] = useState('');
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [equipmentCategories, setEquipmentCategories] = useState(() => getLocalEquipmentDictionaryNames('category'));
  const [equipmentStatuses, setEquipmentStatuses] = useState(() => getLocalEquipmentDictionaryNames('status'));
  const [equipmentLocations, setEquipmentLocations] = useState(() => getLocalEquipmentDictionaryNames('location'));
  const [equipmentConditions, setEquipmentConditions] = useState(() => getActiveConfigDictionaryNames('equipmentConditions'));
  const [filters, setFilters] = useStoredState('fixer-equipment-filters', { search: '', category: 'all', status: 'all', location: 'all', brand: 'all', type: 'all' });
  const [dashboardStatusFilter, setDashboardStatusFilter] = useState('all');
  const [pendingOpenEquipmentId, setPendingOpenEquipmentId] = useState(null);

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
      setNotice('');
    }
    setLoading(false);
  };

  useEffect(() => { loadEquipment(); loadEquipmentDictionaries(); setEquipmentConditions(getActiveConfigDictionaryNames('equipmentConditions')); }, []);

  useEffect(() => {
    if (dashboardIntent?.type !== 'equipment') return;
    setDashboardStatusFilter(dashboardIntent.status ?? 'all');
    if (dashboardIntent.equipmentId) setPendingOpenEquipmentId(dashboardIntent.equipmentId);
    onConsumeDashboardIntent?.();
  }, [dashboardIntent, onConsumeDashboardIntent]);

  useEffect(() => {
    if (!pendingOpenEquipmentId || !rows.length) return;
    const item = rows.find((row) => String(row.id ?? row.localId) === String(pendingOpenEquipmentId));
    if (item) openEquipmentEditor(item, { force: true });
    setPendingOpenEquipmentId(null);
  }, [pendingOpenEquipmentId, rows]);

  const openEquipmentEditor = (item = null, options = {}) => {
    if (item && isEquipmentSetComponent(item) && !options.force) {
      setNotice('Ten sprzęt jest składnikiem zestawu. Najpierw usuń go z zestawu, żeby można było go edytować.');
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
      setNotice('Nie można duplikować składnika zestawu.');
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
    if (!item.name.trim()) return { error: new Error('Nazwa sprzętu jest wymagana.') };
    if (isEquipmentSetComponent(item)) return { error: new Error('Ten sprzęt jest składnikiem zestawu i nie może być edytowany bez usunięcia go z zestawu.') };

    const previousSetItems = editingEquipment?.set_items ?? [];
    const nextSetItems = item.category === EQUIPMENT_SET_CATEGORY ? item.set_items ?? [] : [];
    const payload = normalizePayload({ ...item, set_items: nextSetItems });

    try {
      if (isSupabaseConfigured) {
        const result = item.id ? await updateEquipmentRecord(item.id, payload) : await createEquipmentRecord(payload);
        if (result.error) return { error: result.error };
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
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  const handleDelete = async (item) => {
    if (isEquipmentSetComponent(item)) {
      setNotice('Nie można usunąć składnika zestawu. Najpierw usuń go z zestawu.');
      return;
    }
    setConfirmDialog({
      title: 'Usuń sprzęt',
      message: `Usunąć sprzęt: ${item.name}?`,
      confirmLabel: 'Usuń',
      cancelLabel: 'Anuluj',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          if (isEquipmentSet(item)) await updateSetComponentStatuses(item.set_items ?? [], [], item);
        } catch {
          setNotice('Nie udało się zwolnić składników zestawu.');
          return;
        }
        if (item.id && isSupabaseConfigured) {
          const { error } = await deleteEquipmentRecord(item.id);
          if (error) {
            if (isForeignKeyError(error)) {
              setConfirmDialog({
                title: 'Nie można usunąć sprzętu',
                message: 'Sprzęt posiada historię wypożyczeń, serwisów lub innych dokumentów i nie może być usunięty.\n\nCzy zmienić status na „Wycofany"?',
                confirmLabel: 'Wycofaj sprzęt',
                cancelLabel: 'Anuluj',
                variant: 'danger',
                onConfirm: async () => {
                  setConfirmDialog(null);
                  await updateEquipmentRecord(item.id, { ...item, status: 'Wycofany' });
                  await loadEquipment();
                }
              });
            } else {
              setNotice(humanizeError(error, 'equipment'));
            }
            return;
          }
          await loadEquipment();
        } else {
          setRows((current) => current.filter((row) => row !== item));
        }
      }
    });
  };

  const handleBulkDelete = async (items) => {
    const locked = items.filter(isEquipmentSetComponent);
    const selected = items.filter((item) => !isEquipmentSetComponent(item) && (item?.id || item?.localId || item?.name || item?.serial));
    if (!selected.length) {
      if (locked.length) setNotice(`Nie można usunąć składników zestawu (${locked.length}). Najpierw usuń je z zestawu.`);
      return;
    }
    if (locked.length) setNotice(`Pominięto składniki zestawu, których nie można usunąć: ${locked.length}.`);
    setConfirmDialog({
      title: 'Usuń sprzęt',
      message: `Usunąć zaznaczone pozycje sprzętu: ${selected.length}?`,
      confirmLabel: 'Usuń',
      cancelLabel: 'Anuluj',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmDialog(null);
        if (isSupabaseConfigured) {
          for (const item of selected) {
            if (isEquipmentSet(item)) {
              try { await updateSetComponentStatuses(item.set_items ?? [], [], item); } catch { setNotice('Nie udało się zwolnić składników zestawu.'); return; }
            }
          }
          const skipped = [];
          for (const item of selected) {
            if (!item.id) continue;
            const { error } = await deleteEquipmentRecord(item.id);
            if (error) {
              if (isForeignKeyError(error)) {
                skipped.push(item.name);
              } else {
                setNotice(humanizeError(error, 'equipment'));
                await loadEquipment();
                return;
              }
            }
          }
          if (skipped.length) setNotice(`Nie można usunąć pozycji z historią w systemie (pominięto): ${skipped.join(', ')}.`);
          await loadEquipment();
          return;
        }

        for (const item of selected) {
          if (isEquipmentSet(item)) {
            try { await updateSetComponentStatuses(item.set_items ?? [], [], item); } catch { setNotice('Nie udało się zwolnić składników zestawu.'); return; }
          }
        }
        setRows((current) => current.filter((row) => !selected.includes(row)));
      }
    });
  };


  const equipmentFilterOptions = useMemo(() => ({
    categories: [...new Set([...equipmentCategories, ...rows.map((item) => item.category).filter(Boolean)])].sort((a, b) => a.localeCompare(b, 'pl')),
    statuses: [...new Set([...equipmentStatuses, ...rows.map((item) => item.status).filter(Boolean)])].sort((a, b) => a.localeCompare(b, 'pl')),
    locations: [...new Set([...equipmentLocations, ...rows.map((item) => item.location).filter(Boolean)])].sort((a, b) => a.localeCompare(b, 'pl')),
    brands: [...new Set(rows.map((item) => item.brand).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pl'))
  }), [rows, equipmentCategories, equipmentStatuses, equipmentLocations]);

  const displayRows = useMemo(() => rows
    .filter((item) => !isEquipmentSetComponent(item))
    .map((item) => ({ ...item, item_type: isEquipmentSet(item) ? 'Zestaw' : 'Sprzęt', set_items_count: Array.isArray(item.set_items) && item.set_items.length ? item.set_items.length : '' }))
    .filter((item) => {
      if (dashboardStatusFilter === 'all') return true;
      const status = normalizeStatusText(item.status);
      const filter = normalizeStatusText(dashboardStatusFilter);
      return status === filter || status.includes(filter);
    })
    .filter((item) => {
      const query = String(filters.search ?? '').trim().toLocaleLowerCase('pl');
      if ((filters.category ?? 'all') !== 'all' && item.category !== filters.category) return false;
      if ((filters.status ?? 'all') !== 'all' && item.status !== filters.status) return false;
      if ((filters.location ?? 'all') !== 'all' && item.location !== filters.location) return false;
      if ((filters.brand ?? 'all') !== 'all' && item.brand !== filters.brand) return false;
      if ((filters.type ?? 'all') !== 'all' && item.item_type !== filters.type) return false;
      if (query) {
        const searchable = [item.name, item.category, item.brand, item.model, item.serial, item.inventory_number, item.barcode, item.status, item.location, item.item_type].filter(Boolean).join(' ').toLocaleLowerCase('pl');
        if (!searchable.includes(query)) return false;
      }
      return true;
    }), [rows, dashboardStatusFilter, filters]);

  const clearEquipmentFilters = () => setFilters({ search: '', category: 'all', status: 'all', location: 'all', brand: 'all', type: 'all' });

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
        <div className="module-actions">
          <AppButton variant="primary" onClick={() => openEquipmentEditor(null)}><Plus size={18} />Dodaj sprzęt</AppButton>
          <AppButton variant="secondary" onClick={openSetEditor}><Package size={18} />Dodaj zestaw</AppButton>
          <AppButton variant="secondary" onClick={loadEquipment}>Odśwież</AppButton>
          <AppButton variant="secondary" onClick={() => exportTableToCsv(EQUIPMENT_TABLE_KEY, EQUIPMENT_TABLE_COLUMNS, displayRows)} disabled={!displayRows.length}><Download size={16} />CSV</AppButton>
          <AppButton variant="secondary" onClick={() => exportTableToPdf('Sprzęt', EQUIPMENT_TABLE_KEY, EQUIPMENT_TABLE_COLUMNS, displayRows)} disabled={!displayRows.length}><FileText size={16} />PDF</AppButton>
        </div>
        {notice && <div className="notice">{notice}</div>}
        {dashboardStatusFilter !== 'all' && <div className="notice">Filtr z Dashboardu: status {dashboardStatusFilter}. <button type="button" className="inline-notice-button" onClick={() => setDashboardStatusFilter('all')}>Pokaż wszystko</button></div>}
      </section>
      <section className="panel">
        <div className="client-filter-bar equipment-filter-bar">
          <label>Szukaj<AppInput value={filters.search ?? ''} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Nazwa, marka, model, SN, kod" /></label>
          <label>Kategoria<AppSelect value={filters.category ?? 'all'} onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))}><option value="all">Wszystkie</option>{equipmentFilterOptions.categories.map((item) => <option key={item} value={item}>{item}</option>)}</AppSelect></label>
          <label>Status<AppSelect value={filters.status ?? 'all'} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}><option value="all">Wszystkie</option>{equipmentFilterOptions.statuses.map((item) => <option key={item} value={item}>{item}</option>)}</AppSelect></label>
          <label>Lokalizacja<AppSelect value={filters.location ?? 'all'} onChange={(event) => setFilters((current) => ({ ...current, location: event.target.value }))}><option value="all">Wszystkie</option>{equipmentFilterOptions.locations.map((item) => <option key={item} value={item}>{item}</option>)}</AppSelect></label>
          <label>Producent<AppSelect value={filters.brand ?? 'all'} onChange={(event) => setFilters((current) => ({ ...current, brand: event.target.value }))}><option value="all">Wszyscy</option>{equipmentFilterOptions.brands.map((item) => <option key={item} value={item}>{item}</option>)}</AppSelect></label>
          <label>Typ<AppSelect value={filters.type ?? 'all'} onChange={(event) => setFilters((current) => ({ ...current, type: event.target.value }))}><option value="all">Wszystkie</option><option value="Sprzęt">Sprzęt</option><option value="Zestaw">Zestaw</option></AppSelect></label>
          <AppButton variant="secondary" size="sm" className="compact-button" onClick={clearEquipmentFilters}>Wyczyść</AppButton>
          {rows.filter((item) => !isEquipmentSetComponent(item)).length > 0 && displayRows.length < rows.filter((item) => !isEquipmentSetComponent(item)).length && <span className="filter-count">Wyświetlono {displayRows.length} z {rows.filter((item) => !isEquipmentSetComponent(item)).length}</span>}
        </div>
        <DataTable storageKey={EQUIPMENT_TABLE_KEY} loading={loading} columns={EQUIPMENT_TABLE_COLUMNS} rows={displayRows} onOpen={openEquipmentEditor} onEdit={openEquipmentEditor} onDuplicate={duplicateEquipment} onDelete={handleDelete} onBulkDelete={handleBulkDelete} isRowLocked={isEquipmentSetComponent} isRowExpandable={isEquipmentSet} renderExpandedRow={renderSetContents} />
      </section>
      {editorOpen && <EquipmentEditor equipment={editingEquipment} equipmentRows={rows} categories={equipmentCategories} statuses={equipmentStatuses} locations={equipmentLocations} conditions={equipmentConditions} onClose={() => setEditorOpen(false)} onSave={handleSave} />}
      {confirmDialog && <ConfirmDialog title={confirmDialog.title} message={confirmDialog.message} confirmLabel={confirmDialog.confirmLabel} cancelLabel={confirmDialog.cancelLabel} variant={confirmDialog.variant} onConfirm={confirmDialog.onConfirm} onCancel={() => setConfirmDialog(null)} />}
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


function EquipmentEditor({ equipment, equipmentRows = [], categories = getLocalEquipmentDictionaryNames('category'), statuses = getLocalEquipmentDictionaryNames('status'), locations = getLocalEquipmentDictionaryNames('location'), conditions = getActiveConfigDictionaryNames('equipmentConditions'), onClose, onSave }) {
  const cardData = parseEquipmentCardNotes(equipment?.notes);
  const isInitialSetCard = equipment?.category === EQUIPMENT_SET_CATEGORY || Array.isArray(equipment?.set_items) && equipment.set_items.length > 0;
  const [activeTab, setActiveTab] = useState('basic');
  const [errors, setErrors] = useState({});
  const [saveError, setSaveError] = useState('');
  const [confirmDialog, setConfirmDialog] = useState(null);
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
    setConfirmDialog({
      title: 'Usuń składnik z zestawu',
      message: `Usunąć składnik „${itemName}" z zestawu? Po zapisaniu sprzęt wróci do magazynu ze statusem „${EQUIPMENT_AVAILABLE_STATUS}".`,
      confirmLabel: 'Usuń składnik',
      cancelLabel: 'Anuluj',
      variant: 'danger',
      onConfirm: () => {
        setConfirmDialog(null);
        update('set_items', form.set_items.filter((_, itemIndex) => itemIndex !== index));
      }
    });
  };

  const saveEquipment = async () => {
    setSaveError('');
    const nextErrors = {};
    if (!form.name.trim()) nextErrors.name = isSetCard ? 'Nazwa zestawu jest wymagana.' : 'Nazwa sprzętu jest wymagana.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setActiveTab('basic');
      return;
    }

    const result = await onSave({
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
    if (result?.error) setSaveError(result.error.message ?? humanizeError(result.error, 'equipment'));
  };

  const fieldClass = (key) => errors[key] ? 'field-error' : undefined;

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
      <ResizableModalFrame
        className="equipment-card-modal set-card-modal"
        storageKey="fixer-equipment-modal"
        defaultSize={{ width: 1120, height: 720 }}
        minSize={{ width: 860, height: 560 }}
        eyebrow="Zestaw sprzętu"
        title="Karta zestawu"
        onClose={onClose}
        footer={<><AppButton variant="secondary" onClick={onClose}>Anuluj</AppButton><AppButton variant="primary" onClick={saveEquipment}><Save size={18} />Zapisz zestaw</AppButton></>}
      >
        {saveError && <AppNotice variant="error" className="service-form-notice">{saveError}</AppNotice>}
        <div className="set-card-content">
          <div className="equipment-section-panel set-details-panel">
            <div className="section-title">Dane zestawu</div>
            <div className="set-basic-grid">
              <FormField className="set-name-field" label="Nazwa zestawu *" error={errors.name}><AppInput className={fieldClass('name')} value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="np. Walizka streamingowa" /></FormField>
              <FormField label="Numer seryjny"><AppInput value={form.serial} onChange={(event) => update('serial', event.target.value)} placeholder="opcjonalnie" /></FormField>
              <FormField label="Kod kreskowy / QR"><AppInput value={form.barcode} onChange={(event) => update('barcode', event.target.value)} placeholder="opcjonalnie" /></FormField>
              <FormField label="Status"><AppInput value={calculatedSetStatus} readOnly className="readonly-input" /></FormField>
              <FormField label="Lokalizacja"><AppSelect value={form.location} onChange={(event) => update('location', event.target.value)}>{safeLocations.map((location) => <option key={location} value={location}>{location}</option>)}</AppSelect></FormField>
              <FormField label="Stan techniczny"><AppSelect value={form.condition} onChange={(event) => update('condition', event.target.value)}>{safeConditions.map((condition) => <option key={condition} value={condition}>{condition}</option>)}</AppSelect></FormField>
              <FormField className="set-description-field" label="Opis zestawu"><AppTextarea resizeKey="fixer:textarea:set:description" value={form.description} onChange={(event) => update('description', event.target.value)} placeholder="Krótki opis, przeznaczenie lub zawartość zestawu." /></FormField>
            </div>
          </div>
          <div className="equipment-section-panel set-builder-panel set-card-components-panel">
            <div className="set-builder-header">
              <div>
                <div className="section-title">Składniki zestawu</div>
                <p className="muted">Składniki wybierasz z magazynu. Po zapisaniu zostaną zablokowane jako „Składnik zestawu".</p>
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
            </div> : <div className="empty-set-box">Brak składników zestawu. Użyj przycisku „Dodaj składniki", żeby wybrać pozycje z magazynu.</div>}
          </div>
        </div>
        {setPickerOpen && <EquipmentSetPicker availableItems={availableSetComponents} onClose={() => setSetPickerOpen(false)} onConfirm={(items) => { addSetItems(items); setSetPickerOpen(false); }} />}
        {confirmDialog && <ConfirmDialog title={confirmDialog.title} message={confirmDialog.message} confirmLabel={confirmDialog.confirmLabel} cancelLabel={confirmDialog.cancelLabel} variant={confirmDialog.variant} onConfirm={confirmDialog.onConfirm} onCancel={() => setConfirmDialog(null)} />}
      </ResizableModalFrame>
    );
  }

  return (
    <ResizableModalFrame
      className="equipment-card-modal"
      storageKey="fixer-equipment-modal"
      defaultSize={{ width: 1120, height: 720 }}
      minSize={{ width: 860, height: 560 }}
      eyebrow="Sprzęt"
      title="Karta sprzętu"
      onClose={onClose}
        footer={<><AppButton variant="secondary" onClick={onClose}>Anuluj</AppButton><AppButton variant="primary" onClick={saveEquipment}><Save size={18} />Zapisz sprzęt</AppButton></>}
      >
      {saveError && <AppNotice variant="error" className="service-form-notice">{saveError}</AppNotice>}
      <div className="record-tabs" role="tablist" aria-label="Sekcje karty sprzętu">
        {tabs.map((tab) => (
          <button key={tab.id} type="button" className={activeTab === tab.id ? 'active' : ''} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>
        ))}
      </div>
      <div className="equipment-tab-panel">
        {activeTab === 'basic' && <div className="equipment-basic-grid">
          <FormField className="equipment-name-field" label="Nazwa sprzętu *" error={errors.name}><AppInput className={fieldClass('name')} value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="np. Mikser Video" /></FormField>
          <FormField label="Marka"><AppInput value={form.brand} onChange={(event) => update('brand', event.target.value)} placeholder="np. Blackmagic" /></FormField>
          <FormField label="Model"><AppInput value={form.model} onChange={(event) => update('model', event.target.value)} placeholder="np. ATEM Mini Pro" /></FormField>
          <FormField label="Numer seryjny"><AppInput value={form.serial} onChange={(event) => update('serial', event.target.value)} /></FormField>
          <FormField label="Kod kreskowy / QR"><AppInput value={form.barcode} onChange={(event) => update('barcode', event.target.value)} /></FormField>
          <FormField label="Kategoria"><AppSelect value={form.category} onChange={(event) => update('category', event.target.value)}>{categories.filter((option) => option !== EQUIPMENT_SET_CATEGORY).map((option) => <option key={option}>{option}</option>)}</AppSelect></FormField>
          <FormField label="Status"><AppSelect value={form.status} onChange={(event) => update('status', event.target.value)}>{safeStatuses.map((option) => <option key={option}>{option}</option>)}</AppSelect></FormField>
          <FormField label="Stan techniczny"><AppSelect value={form.condition} onChange={(event) => update('condition', event.target.value)}>{safeConditions.map((condition) => <option key={condition} value={condition}>{condition}</option>)}</AppSelect></FormField>
          <FormField label="Lokalizacja"><AppSelect value={form.location} onChange={(event) => update('location', event.target.value)}>{safeLocations.map((location) => <option key={location} value={location}>{location}</option>)}</AppSelect></FormField>
          <FormField label="Wartość zakupu"><AppInput value={form.purchase_value} onChange={(event) => update('purchase_value', event.target.value)} placeholder="np. 2500" /></FormField>
          <FormField label="Kaucja"><AppInput value={form.deposit} onChange={(event) => update('deposit', event.target.value)} placeholder="np. 500" /></FormField>
          <FormField label="Cena / dzień"><AppInput value={form.price_day} onChange={(event) => update('price_day', event.target.value)} placeholder="np. 120" /></FormField>
          <FormField label="Cena / tydzień"><AppInput value={form.price_week} onChange={(event) => update('price_week', event.target.value)} placeholder="np. 600" /></FormField>
          <FormField className="equipment-description-field" label="Opis / zawartość"><AppTextarea resizeKey="fixer:textarea:equipment:description" value={form.description} onChange={(event) => update('description', event.target.value)} /></FormField>
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
          <AppTextarea resizeKey="fixer:textarea:equipment:history_notes" className="large-notes" value={form.history_notes} onChange={(event) => update('history_notes', event.target.value)} placeholder="Historia wypożyczeń, zmian lokalizacji, uwagi magazynowe." />
        </div>}
        {activeTab === 'service' && <div className="equipment-section-panel">
          <div className="section-title">Serwis</div>
          <AppTextarea resizeKey="fixer:textarea:equipment:service_notes" className="large-notes" value={form.service_notes} onChange={(event) => update('service_notes', event.target.value)} placeholder="Historia napraw, przeglądów, usterek i zaleceń serwisowych." />
        </div>}
        {activeTab === 'relations' && <div className="equipment-section-panel">
          <div className="section-title">Powiązania / zestawy</div>
          <div className="notice">Ten ekran służy do sprzętu pojedynczego. Zestawy tworzy się przez przycisk „Dodaj zestaw" w module Sprzęt.</div>
        </div>}
      </div>
      {confirmDialog && <ConfirmDialog title={confirmDialog.title} message={confirmDialog.message} confirmLabel={confirmDialog.confirmLabel} cancelLabel={confirmDialog.cancelLabel} variant={confirmDialog.variant} onConfirm={confirmDialog.onConfirm} onCancel={() => setConfirmDialog(null)} />}
    </ResizableModalFrame>
  );
}

function EquipmentSetPicker({ availableItems, onClose, onConfirm }) {
  return <EquipmentPickerModal title="Wybierz składniki z magazynu" availableItems={availableItems} selectedIds={[]} onClose={onClose} onConfirm={onConfirm} />;
}
const RENTALS_TABLE_KEY = 'rentals-table';
const RENTAL_SELECTED_EQUIPMENT_TABLE_KEY = 'rental-selected-equipment-table';

function getRentalItemBrand(item) {
  return item?.brand_snapshot ?? item?.brand ?? item?.equipment?.brand ?? '';
}

function getRentalItemModel(item) {
  return item?.model_snapshot ?? item?.model ?? item?.equipment?.model ?? '';
}

function summarizeDistinctValues(values, limit = 2) {
  const unique = [...new Set(values.map((value) => String(value ?? '').trim()).filter(Boolean))];
  if (!unique.length) return '—';
  if (unique.length <= limit) return unique.join(', ');
  return `${unique.slice(0, limit).join(', ')} +${unique.length - limit}`;
}

const RENTALS_TABLE_COLUMNS = [
  { key: 'rental_number', label: 'Numer' },
  { key: 'client', label: 'Klient' },
  { key: 'rental_type', label: 'Typ' },
  { key: 'items_count', label: 'Pozycje' },
  { key: 'items_summary', label: 'Sprzęt' },
  { key: 'brands_summary', label: 'Marka' },
  { key: 'models_summary', label: 'Model' },
  { key: 'status', label: 'Status' },
  { key: 'start_date', label: 'Wydanie' },
  { key: 'planned_return_date', label: 'Termin zwrotu' },
  { key: 'actual_return_date', label: 'Faktyczny zwrot' }
];

const RENTAL_SELECTED_EQUIPMENT_COLUMNS = [
  { key: 'name', label: 'Nazwa', renderCell: (row) => renderEquipmentNameWithBadge(row) },
  { key: 'item_type_display', label: 'Typ' },
  { key: 'brand', label: 'Marka' },
  { key: 'model', label: 'Model' },
  { key: 'serial', label: 'Numer seryjny' },
  { key: 'code_display', label: 'Kod / Nr inw.' },
  { key: 'category', label: 'Kategoria' },
  { key: 'location', label: 'Lokalizacja' },
  { key: 'issue_status', label: 'Status', renderCell: (row) => <DSStatusPill value={row.issue_status} /> }
];

function formatRentalStatus(status) {
  if (status === 'partially_returned') return 'Częściowo zwrócone';
  if (status === 'returned') return 'Zwrócone';
  return 'Aktywne';
}

function formatRentalItemStatus(status) {
  if (status === 'issued') return 'Wydany';
  if (status === 'returned') return 'Zwrócony';
  if (status === 'damaged') return 'Uszkodzony';
  if (status === 'lost') return 'Zagubiony';
  if (status === 'service_required') return 'Wymaga serwisu';
  return status || '—';
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

function addDaysIso(dateIso, days) {
  const date = new Date(`${dateIso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function readNotificationReadMap() {
  const threshold = Date.now() - NOTIFICATIONS_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const stored = getStoredJson(NOTIFICATIONS_READ_STORAGE_KEY, {});
  const deleted = readNotificationDeletedMap();
  const next = {};
  const nextDeleted = { ...deleted };
  Object.entries(stored && typeof stored === 'object' ? stored : {}).forEach(([id, value]) => {
    const timestamp = Date.parse(value);
    if (!Number.isNaN(timestamp) && timestamp >= threshold) next[id] = value;
    else if (!Number.isNaN(timestamp)) nextDeleted[id] = value;
  });
  if (Object.keys(next).length !== Object.keys(stored ?? {}).length) localStorage.setItem(NOTIFICATIONS_READ_STORAGE_KEY, JSON.stringify(next));
  if (Object.keys(nextDeleted).length !== Object.keys(deleted).length) localStorage.setItem(NOTIFICATIONS_DELETED_STORAGE_KEY, JSON.stringify(nextDeleted));
  return next;
}

function saveNotificationReadMap(map) {
  localStorage.setItem(NOTIFICATIONS_READ_STORAGE_KEY, JSON.stringify(map));
  return map;
}

function readNotificationDeletedMap() {
  const stored = getStoredJson(NOTIFICATIONS_DELETED_STORAGE_KEY, {});
  return stored && typeof stored === 'object' ? stored : {};
}

function saveNotificationDeletedMap(map) {
  localStorage.setItem(NOTIFICATIONS_DELETED_STORAGE_KEY, JSON.stringify(map));
  return map;
}

function notificationDateTime(value) {
  if (!value) return null;
  const text = String(value);
  const date = text.includes('T') ? new Date(text) : new Date(`${text.slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function pushNotification(list, notification) {
  if (!notification?.id || !notification.title) return;
  list.push({
    priority: 3,
    source: 'system',
    tone: 'info',
    createdAt: new Date().toISOString(),
    ...notification
  });
}

async function buildOperatorNotifications() {
  const [rentalsResult, serviceResult, organizerResult, projectsResult, projectTasksResult, calendarResult] = await Promise.all([
    fetchRentals(),
    fetchServiceOrders(),
    fetchOrganizerTasks(),
    fetchProjects(),
    fetchAllProjectTasks(),
    fetchCalendarManualEvents()
  ]);
  const today = getLocalIsoDate();
  const tomorrow = addDaysIso(today, 1);
  const now = new Date();
  const retentionStart = Date.now() - NOTIFICATIONS_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const notifications = [];

  (rentalsResult.data ?? []).filter((rental) => rental.status !== 'returned').forEach((rental) => {
    const date = String(rental.planned_return_date ?? '').slice(0, 10);
    if (!date) return;
    const base = {
      source: 'rentals',
      targetModule: 'rentals',
      intent: { type: 'rentals', filter: 'open', rentalId: rental.id },
      primary: rental.rental_number || 'Wypożyczenie',
      secondary: rental.clients?.name || '',
      createdAt: `${date}T09:00:00`
    };
    const overdueDays = getRentalOverdueDays(rental);
    if (overdueDays > 0) pushNotification(notifications, { ...base, id: `rentals:overdue:${rental.id}:${date}`, title: 'Zwrot po terminie', detail: `${overdueDays} ${overdueDays === 1 ? 'dzień' : 'dni'} po terminie`, tone: 'danger', priority: 0 });
    else if (date === today) pushNotification(notifications, { ...base, id: `rentals:today:${rental.id}:${date}`, title: 'Zwrot dzisiaj', detail: 'Planowany zwrot przypada dziś', tone: 'warning', priority: 1 });
    else if (date === tomorrow) pushNotification(notifications, { ...base, id: `rentals:tomorrow:${rental.id}:${date}`, title: 'Zwrot jutro', detail: 'Planowany zwrot jutro', tone: 'info', priority: 3 });
  });

  const activeServiceRows = (serviceResult.data ?? []).filter((order) => !['Wydane', 'Anulowane'].includes(String(order.status ?? '').trim()));
  activeServiceRows.forEach((order) => {
    const date = String(order.planned_date ?? '').slice(0, 10);
    const base = {
      source: 'service',
      targetModule: 'service',
      intent: { type: 'service', serviceOrderId: order.id },
      primary: order.service_number || 'Zlecenie serwisowe',
      secondary: order.customer_device_name || order.equipment?.name || '',
      createdAt: date ? `${date}T09:00:00` : new Date().toISOString()
    };
    if (date && date < today) pushNotification(notifications, { ...base, id: `service:overdue:${order.id}:${date}`, title: 'Serwis po terminie', detail: 'Planowany termin minął', tone: 'danger', priority: 0 });
    else if (date === today) pushNotification(notifications, { ...base, id: `service:today:${order.id}:${date}`, title: 'Serwis na dziś', detail: 'Planowany termin przypada dziś', tone: 'warning', priority: 1 });
    if (['gotowe', 'do odbioru', 'oczekuje na odbior'].some((part) => normalizeScannerCode(order.status).includes(normalizeScannerCode(part)))) {
      pushNotification(notifications, { ...base, id: `service:pickup:${order.id}:${order.status}`, title: 'Serwis oczekuje na odbiór', detail: order.status, tone: 'success', priority: 2 });
    }
  });

  const recentServiceRows = activeServiceRows.slice(0, 20);
  const progressResults = await Promise.all(recentServiceRows.map(async (order) => {
    try {
      const result = await fetchServiceOrderProgress(order.id);
      return { order, rows: result.data ?? [], error: result.error };
    } catch (error) {
      console.warn('Notifications progress fetch failed', error);
      return { order, rows: [] };
    }
  }));
  progressResults.forEach(({ order, rows }) => {
    rows
      .filter((entry) => Date.parse(entry.created_at ?? '') >= retentionStart)
      .slice(0, 2)
      .forEach((entry) => pushNotification(notifications, {
        id: `service:progress:${entry.id ?? entry.localId}`,
        source: 'service',
        targetModule: 'service',
        intent: { type: 'service', serviceOrderId: order.id },
        title: 'Nowy wpis w postępach',
        primary: order.service_number || 'Zlecenie serwisowe',
        secondary: entry.entry_text || order.customer_device_name || '',
        detail: entry.operator_name ? `Operator: ${entry.operator_name}` : 'Postęp serwisu',
        tone: 'info',
        priority: 4,
        createdAt: entry.created_at || order.updated_at || new Date().toISOString()
      }));
  });

  (organizerResult.data ?? []).filter((task) => !task.archived && !ORGANIZER_TERMINAL_STATUSES.includes(task.status)).forEach((task) => {
    const taskId = task.id ?? task.localId;
    const due = String(task.due_date ?? '').slice(0, 10);
    const reminder = String(task.reminder_at ?? '').slice(0, 10);
    const base = {
      source: 'projects',
      targetModule: 'projects',
      intent: { type: 'projects', taskId },
      primary: task.title,
      secondary: task.category || task.priority || '',
      createdAt: `${due || reminder || today}T09:00:00`
    };
    if (due && due < today) pushNotification(notifications, { ...base, id: `organizer:overdue:${taskId}:${due}`, title: 'Zadanie po terminie', detail: task.priority || 'Zaległe zadanie', tone: 'danger', priority: 0 });
    else if (due === today) pushNotification(notifications, { ...base, id: `organizer:today:${taskId}:${due}`, title: 'Zadanie na dziś', detail: task.priority || 'Termin dziś', tone: 'warning', priority: 1 });
    else if (due === tomorrow) pushNotification(notifications, { ...base, id: `organizer:tomorrow:${taskId}:${due}`, title: 'Zadanie jutro', detail: task.priority || 'Termin jutro', tone: 'info', priority: 3 });
    if (reminder === today) pushNotification(notifications, { ...base, id: `organizer:reminder:${taskId}:${task.reminder_at}`, title: 'Przypomnienie', detail: task.reminder_at ? formatServiceDateTime(task.reminder_at) : 'Dzisiaj', tone: 'info', priority: 2, createdAt: task.reminder_at });
  });

  (projectsResult.data ?? []).filter((project) => !project.archived).forEach((project) => {
    const projectId = project.id ?? project.localId;
    const due = String(project.due_date ?? '').slice(0, 10);
    if (!due) return;
    const base = {
      source: 'projects',
      targetModule: 'projects',
      intent: { type: 'projects', projectId },
      primary: project.name || project.project_number || 'Projekt',
      secondary: project.clients?.name || project.priority || '',
      createdAt: `${due}T09:00:00`
    };
    if (due < today) pushNotification(notifications, { ...base, id: `projects:overdue:${projectId}:${due}`, title: 'Projekt po terminie', detail: project.priority || 'Zaległy projekt', tone: 'danger', priority: 0 });
    else if (due === today) pushNotification(notifications, { ...base, id: `projects:today:${projectId}:${due}`, title: 'Termin projektu dziś', detail: project.priority || 'Termin dziś', tone: 'warning', priority: 1 });
    else if (due === tomorrow) pushNotification(notifications, { ...base, id: `projects:tomorrow:${projectId}:${due}`, title: 'Termin projektu jutro', detail: project.priority || 'Termin jutro', tone: 'info', priority: 3 });
  });

  (projectTasksResult.data ?? []).filter((task) => !task.archived && !PROJECT_TASK_TERMINAL_STATUSES.includes(task.status)).forEach((task) => {
    const taskId = task.id ?? task.localId;
    const due = String(task.due_date ?? '').slice(0, 10);
    const reminder = String(task.reminder_at ?? '').slice(0, 10);
    const base = {
      source: 'projects',
      targetModule: 'projects',
      intent: { type: 'projects', projectId: task.project_id, taskId },
      primary: task.title,
      secondary: task.priority || '',
      createdAt: `${due || reminder || today}T09:00:00`
    };
    if (due && due < today) pushNotification(notifications, { ...base, id: `project-task:overdue:${taskId}:${due}`, title: 'Zadanie projektu po terminie', detail: task.priority || 'Zaległe', tone: 'danger', priority: 0 });
    else if (due === today) pushNotification(notifications, { ...base, id: `project-task:today:${taskId}:${due}`, title: 'Zadanie projektu na dziś', detail: task.priority || 'Termin dziś', tone: 'warning', priority: 1 });
    if (reminder === today) pushNotification(notifications, { ...base, id: `project-task:reminder:${taskId}:${task.reminder_at}`, title: 'Przypomnienie zadania', detail: task.reminder_at ? formatServiceDateTime(task.reminder_at) : 'Dzisiaj', tone: 'info', priority: 2, createdAt: task.reminder_at });
  });

  (calendarResult.data ?? []).forEach((event) => {
    const start = notificationDateTime(event.start_at);
    if (!start) return;
    const eventId = event.id ?? event.localId;
    const date = String(event.start_at ?? '').slice(0, 10);
    const minutesToStart = Math.round((start.getTime() - now.getTime()) / 60000);
    const base = {
      source: 'calendar',
      targetModule: 'calendar',
      intent: { type: 'calendar', eventId },
      primary: event.title,
      secondary: event.location || event.description || '',
      createdAt: start.toISOString()
    };
    if (minutesToStart >= 0 && minutesToStart <= 60) pushNotification(notifications, { ...base, id: `calendar:hour:${eventId}:${event.start_at}`, title: 'Wydarzenie za godzinę', detail: minutesToStart <= 5 ? 'Za chwilę' : `Za ${minutesToStart} min`, tone: 'warning', priority: 1 });
    else if (date === today) pushNotification(notifications, { ...base, id: `calendar:today:${eventId}:${date}`, title: 'Wydarzenie na dziś', detail: event.all_day ? 'Cały dzień' : formatServiceDateTime(event.start_at), tone: 'info', priority: 3 });
    else if (start.getTime() < now.getTime() && start.getTime() >= retentionStart) pushNotification(notifications, { ...base, id: `calendar:overdue:${eventId}:${event.start_at}`, title: 'Wydarzenie po terminie', detail: formatServiceDateTime(event.start_at), tone: 'danger', priority: 5 });
  });

  const company = getCompanyProfile();
  if (!company.name?.trim() && !company.legalName?.trim()) pushNotification(notifications, {
    id: 'system:company-profile-missing',
    source: 'system',
    targetModule: 'settings',
    intent: { type: 'settings', section: 'company' },
    title: 'Brak konfiguracji firmy',
    primary: 'Uzupełnij dane firmy',
    secondary: 'Potrzebne do dokumentów PDF',
    detail: 'Ustawienia → Firma',
    tone: 'warning',
    priority: 2
  });
  const backupFailure = getStoredJson(NOTIFICATIONS_BACKUP_FAILURE_KEY, null);
  if (backupFailure?.message && Date.parse(backupFailure.at ?? '') >= retentionStart) pushNotification(notifications, {
    id: `system:backup-failed:${backupFailure.at}`,
    source: 'system',
    targetModule: 'settings',
    intent: { type: 'settings', section: 'system', settingsSection: 'backup' },
    title: 'Nieudany backup',
    primary: 'Kopia bezpieczeństwa nie została utworzona',
    secondary: backupFailure.message,
    detail: formatServiceDateTime(backupFailure.at),
    tone: 'danger',
    priority: 0,
    createdAt: backupFailure.at
  });

  const errors = [rentalsResult.error ? 'wypożyczenia' : '', serviceResult.error ? 'serwis' : '', organizerResult.error ? 'zadania' : '', projectsResult.error ? 'projekty' : '', calendarResult.error ? 'kalendarz' : ''].filter(Boolean);
  if (errors.length) console.warn(`Notifications incomplete: ${errors.join(', ')}`);

  return notifications
    .filter((item) => Date.parse(item.createdAt ?? new Date().toISOString()) >= retentionStart || item.source !== 'calendar')
    .sort((left, right) => (left.priority - right.priority) || (Date.parse(right.createdAt ?? '') - Date.parse(left.createdAt ?? '')))
    .slice(0, 60);
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

function getRentalAgreementTemplate(settings = getDocumentSettings()) {
  const fallback = normalizeRentalAgreementTemplate(settings?.documentTemplates?.[RENTAL_AGREEMENT_TEMPLATE_KEY]);
  const sharedLibrary = getDocumentTemplateLibrary();
  const sharedRental = sharedLibrary.rentalAgreement;
  return sharedRental ? mapSharedTemplateToRentalAgreementTemplate(sharedRental, fallback) : fallback;
}

function formatAgreementDate(value) {
  if (!value) return '';
  const text = String(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return String(value);
  return new Date(`${text}T12:00:00`).toLocaleDateString('pl-PL');
}

function compactLines(lines) {
  return lines.map((line) => String(line ?? '').trim()).filter(Boolean);
}

function shouldShowDocumentCountry(country, options = {}) {
  if (options.includeCountry) return Boolean(String(country ?? '').trim());
  const normalized = String(country ?? '').trim().toLocaleLowerCase('pl');
  if (!normalized) return false;
  return !['polska', 'poland', 'pl'].includes(normalized);
}

function formatDocumentAddress(entity = {}, options = {}) {
  const street = String(entity.street ?? '').trim();
  const building = String(entity.building_number ?? entity.buildingNumber ?? '').trim();
  const apartment = String(entity.apartment_number ?? entity.apartmentNumber ?? '').trim();
  let streetLine = '';
  if (street && building) {
    streetLine = apartment ? `${street} ${building}/${apartment}` : `${street} ${building}`;
  } else if (street) {
    streetLine = street;
  } else if (building) {
    streetLine = apartment ? `${building}/${apartment}` : building;
  }
  const postalCode = String(entity.postal_code ?? entity.postalCode ?? '').trim();
  const city = String(entity.city ?? '').trim();
  const cityLine = [postalCode, city].filter(Boolean).join(' ');
  const country = String(entity.country ?? '').trim();
  const lines = compactLines([streetLine, cityLine]);
  if (shouldShowDocumentCountry(country, options)) lines.push(country);
  return lines.join('\n');
}

function formatDocumentAddressLines(entity = {}, options = {}) {
  return compactLines(formatDocumentAddress(entity, options).split('\n'));
}

function formatClientDocumentAddress(client = {}) {
  return formatDocumentAddress(client);
}

function isBusinessClient(client = {}) {
  return String(client.type ?? '').trim().toLocaleLowerCase('pl') === 'firma';
}

function formatClientDocumentNipNumber(value = '') {
  const digits = onlyDigits(value);
  if (digits.length !== 10) return String(value ?? '').trim();
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 8)}-${digits.slice(8, 10)}`;
}

function formatClientDocumentNip(client = {}) {
  if (!isBusinessClient(client)) return '';
  const nip = String(client.nip ?? '').trim();
  if (!nip) return '';
  return `NIP: ${formatClientDocumentNipNumber(nip)}`;
}

function formatClientDocumentDetails(client = {}) {
  return compactLines([
    client.name,
    ...formatDocumentAddressLines(client),
    formatClientDocumentNip(client)
  ]).join('\n');
}

function mapClientToDocumentContext(client = {}) {
  const contactPerson = client.contact_person || client.contact_name || client.representative || '';
  return {
    clientName: client.name || '',
    clientAddress: formatClientDocumentAddress(client),
    clientNip: formatClientDocumentNip(client),
    clientDetails: formatClientDocumentDetails(client),
    clientContact: compactLines([
      contactPerson ? `Osoba kontaktowa: ${contactPerson}` : '',
      client.phone ? `Telefon: ${client.phone}` : '',
      client.email ? `E-mail: ${client.email}` : ''
    ]).join('\n')
  };
}

function getRentalAgreementColumnValue(key, item, index) {
  const equipment = item?.equipment ?? {};
  const values = {
    lp: index + 1,
    name: item?.name_snapshot || equipment.name || 'Sprzęt',
    brand: getRentalItemBrand(item),
    model: getRentalItemModel(item),
    brandModel: compactLines([getRentalItemBrand(item), getRentalItemModel(item)]).join(' / '),
    serial: item?.serial_snapshot || equipment.serial || '',
    barcode: item?.barcode_snapshot || equipment.barcode || '',
    inventory: item?.inventory_number_snapshot || equipment.inventory_number || '',
    quantity: 1,
    conditionOut: item?.condition_out || equipment.condition || '',
    notes: compactLines([item?.damage_notes, item?.settlement_notes]).join('; ')
  };
  return values[key] ?? '';
}

function isRentalFreeType(rentalType) {
  const normalized = String(rentalType ?? '').trim().toLocaleLowerCase('pl');
  return normalized === 'bezpłatne' || normalized === 'bezplatne' || normalized === 'wewnętrzne' || normalized === 'wewnetrzne';
}

function formatRentalMoney(value, currency = 'zł') {
  const raw = String(value ?? '').trim().replace(/\s/g, '').replace(',', '.');
  if (!raw) return '';
  const number = Number(raw);
  if (!Number.isFinite(number) || number <= 0) return '';
  return `${number.toFixed(2).replace('.', ',')} ${currency}`;
}

function buildRentalFinancialContext(rental, currency = getRentalNumberingSettings()?.currency || 'zł') {
  const isFree = isRentalFreeType(rental?.rental_type);
  const priceFormatted = isFree ? '' : formatRentalMoney(rental?.total_price, currency);
  const rentalFinancialTerms = isFree
    ? 'Wypożyczenie bezpłatne.'
    : priceFormatted
      ? `Wypożyczenie płatne.\nCena wynajmu: ${priceFormatted}`
      : 'Wypożyczenie płatne.';
  return {
    rentalIsPaid: isFree ? 'nie' : 'tak',
    rentalPaymentType: isFree ? 'Wypożyczenie bezpłatne.' : 'Wypożyczenie płatne.',
    rentalPrice: priceFormatted ? priceFormatted.replace(` ${currency}`, '') : '',
    rentalPriceFormatted: priceFormatted,
    rentalFinancialTerms,
    rentalTotal: priceFormatted
  };
}

function getRentalAgreementData(rental, settings = getDocumentSettings(), company = getCompanyProfile()) {
  const template = getRentalAgreementTemplate(settings);
  const items = getRentalBaseItems(rental);
  const enabledColumns = template.columns.filter((column) => column.enabled);
  return {
    template,
    company,
    client: rental?.clients ?? {},
    rental,
    items,
    columns: enabledColumns.length ? enabledColumns : DEFAULT_RENTAL_AGREEMENT_COLUMNS.filter((column) => column.enabled),
    issueDate: getLocalIsoDate(),
    documentNumber: rental?.rental_number || '',
    title: template.documentTitle || 'Umowa wypożyczenia sprzętu'
  };
}

function canCreateRentalAgreement(rental) {
  return Boolean(rental?.client_id && getRentalBaseItems(rental).length);
}

function renderPartyBlock(title, lines) {
  const safeLines = compactLines(lines);
  return `<div class="agreement-party"><h2>${escapeHtml(title)}</h2>${safeLines.length ? safeLines.map((line) => `<p>${escapeHtml(line)}</p>`).join('') : '<p>Brak danych.</p>'}</div>`;
}

function applyTemplateVariables(text, context = {}) {
  let output = String(text ?? '');
  Object.entries(context).forEach(([key, value]) => {
    output = output.replaceAll(`{{${key}}}`, String(value ?? ''));
  });
  return output;
}

function renderTemplateMultiline(text) {
  return String(text ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p class="ag-party-line">${escapeHtml(line)}</p>`)
    .join('');
}

function renderTermsFromTemplate(text, fallbackTerms = []) {
  const lines = String(text ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) {
    return fallbackTerms.map((term, index) => `<li><span class="n">${index + 1}.</span>${escapeHtml(term)}</li>`).join('');
  }
  return lines.map((line) => {
    const normalized = line.replace(/^[-*]\s*/, '');
    return `<li>${escapeHtml(normalized)}</li>`;
  }).join('');
}

function createDocumentLayoutCss() {
  return `@page{size:A4;margin:0}*{box-sizing:border-box}body{margin:0;color:#111;font-family:Arial,Helvetica,sans-serif;font-size:10px;line-height:1.38;background:#fff}.ag-doc{position:relative;width:210mm;min-height:297mm;margin:0 auto;background:#fff;padding:22mm 20mm 18mm;box-sizing:border-box}.ag-top{display:flex;gap:12px;align-items:flex-start;margin-bottom:9px;padding-bottom:8px;border-bottom:1.2px solid #1e3a5f}.ag-logo-img{width:58px;max-height:58px;object-fit:contain;display:block;flex:0 0 58px}.ag-logo-fallback{width:58px;height:58px;display:flex;align-items:center;justify-content:center;border:1.2px solid #c0ccdb;border-radius:7px;font-size:20px;font-weight:800;color:#1e3a5f;flex:0 0 58px}.ag-co-name{font-size:12.5px;font-weight:800;color:#0f1e35;margin:0 0 2px}.ag-co-info{font-size:8.8px;color:#444;margin:0 0 1px;line-height:1.35}.ag-title-block{text-align:center;margin:10px 0 8px}.ag-doc-title{font-size:16.5px;font-weight:900;color:#0f1e35;text-transform:uppercase;letter-spacing:.035em;margin:0 0 6px}.ag-meta-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;max-width:600px;margin:0 auto}.ag-meta-chip{display:grid;gap:1px;padding:5px 7px;border:1px solid #d8e0eb;border-radius:8px;background:#f8fafc;text-align:left}.ag-meta-chip-label{font-size:7.2px;color:#64748b;text-transform:uppercase;letter-spacing:.08em;font-weight:700}.ag-meta-chip-value{font-size:9.2px;color:#0f1e35;font-weight:700;line-height:1.3}.ag-divider{border:none;border-top:1px solid #c8d4e0;margin:7px 0}.ag-custom-header{background:#f5f8fc;border-left:3px solid #1e3a5f;padding:4px 8px;margin-bottom:8px;color:#334155;font-size:9px}.ag-intro{font-size:10px;color:#222;margin:0 0 8px}.ag-parties{display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-bottom:8px}.ag-party-label{font-size:7.8px;font-weight:800;text-transform:uppercase;letter-spacing:.12em;color:#1e3a5f;margin:0 0 3px;padding-bottom:2px;border-bottom:1px solid #c8d4e0;display:block}.ag-party-name{font-size:10.2px;font-weight:800;color:#0f1e35;margin:0 0 1px}.ag-party-line{font-size:9.2px;color:#333;margin:0 0 1px}.ag-core{display:grid;grid-template-columns:34% minmax(0,1fr);gap:13px;align-items:start;margin-bottom:8px}.ag-section{margin-bottom:8px}.ag-section-heading{font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:#1e3a5f;margin:0 0 5px}.ag-period{display:grid;gap:8px;padding-top:1px}.ag-period-label{font-size:8px;color:#666;font-weight:700;text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:1px}.ag-period-value{font-weight:800;color:#0f1e35;font-size:10px}.ag-table-wrap{border:1px solid #c0c8d4;overflow:hidden}.ag-table{width:100%;border-collapse:collapse;table-layout:fixed}.ag-table th{background:#1e3a5f;color:#fff;padding:3.2px 5px;text-align:left;font-size:7.8px;font-weight:700;word-break:break-word}.ag-table td{border-bottom:1px solid #e4eaf2;padding:3px 5px;color:#222;vertical-align:top;font-size:8.5px;word-break:break-word;hyphens:auto}.ag-table tbody tr:last-child td{border-bottom:none}.ag-table.many-cols th,.ag-table.many-cols td{font-size:7.4px;padding:2.6px 3.5px}.ag-terms{margin:0;padding:0;list-style:none}.ag-terms li{display:flex;gap:5px;font-size:9.2px;color:#333;line-height:1.3;margin-bottom:2px;break-inside:avoid}.ag-terms li .n{font-weight:800;color:#1e3a5f;min-width:15px;flex-shrink:0}.ag-signatures{margin-top:14px;break-inside:avoid}.ag-sig-grid{display:grid;grid-template-columns:1fr 1fr;gap:44px}.ag-sig-label{font-size:10px;font-weight:800;color:#0f1e35;display:block;margin-bottom:40px}.ag-sig-line{border-top:1.2px dotted #8090a8;padding-top:4px;font-size:8.5px;color:#666;text-align:center}.ag-footer{border-top:1px solid #dde3ec;margin-top:8px;padding-top:4px;color:#888;font-size:8.5px;text-align:center}.ag-page-footer{position:absolute;left:20mm;right:20mm;bottom:7mm;display:flex;justify-content:space-between;font-size:8px;color:#64748b;border-top:1px solid #e2e8f0;padding-top:3px}.ag-page-number::after{content:counter(page)}.ag-toolbar{position:sticky;top:0;z-index:3;display:flex;gap:8px;justify-content:flex-end;margin:0 0 12px;padding:7px 12px;background:#fff;border-bottom:1px solid #dde3ed;box-shadow:0 2px 4px rgba(0,0,0,.06)}.ag-toolbar button{border:1.5px solid #1e3a5f;border-radius:6px;background:#1e3a5f;color:#fff;padding:6px 14px;font-weight:700;cursor:pointer;font-size:11px}@media print{.ag-toolbar{display:none}.ag-doc{margin:0 auto}}@media(max-width:760px){.ag-doc{width:100%;min-height:auto;padding:16px 14px 24px}.ag-top,.ag-parties,.ag-sig-grid,.ag-core,.ag-meta-grid{grid-template-columns:1fr}.ag-page-footer{position:static;left:auto;right:auto;bottom:auto;margin-top:10px}}`;
}

function buildDocumentSignaturesHtml(leftLabel, rightLabel) {
  return `<div class="ag-signatures"><div class="ag-sig-grid"><div><span class="ag-sig-label">${escapeHtml(leftLabel || 'Wystawiający')}</span><div class="ag-sig-line">miejscowość, data i podpis</div></div><div><span class="ag-sig-label">${escapeHtml(rightLabel || 'Odbierający')}</span><div class="ag-sig-line">miejscowość, data i podpis</div></div></div></div>`;
}

function buildDocumentMetaChips({ documentNumber = '', issueDate = '', status = '' }) {
  const chips = [
    { label: 'Numer dokumentu', value: documentNumber || '—' },
    { label: 'Data wystawienia', value: issueDate || '—' }
  ];
  if (String(status ?? '').trim()) chips.push({ label: 'Status', value: status });
  return `<div class="ag-meta-grid">${chips.map((chip) => `<div class="ag-meta-chip"><span class="ag-meta-chip-label">${escapeHtml(chip.label)}</span><span class="ag-meta-chip-value">${escapeHtml(chip.value)}</span></div>`).join('')}</div>`;
}

function buildBaseDocumentTemplateHtml({
  title,
  company,
  headerText = '',
  documentNumber = '',
  issueDate = '',
  status = '',
  partiesHtml = '',
  sectionsHtml = '',
  footerText = '',
  preview = true,
  autoPrint = false
}) {
  const companyName = company?.legalName || company?.name || 'FIXER WEB';
  const showLogo = company?.showLogoOnDocuments !== false;
  const companyTax = formatCompanyTaxData(company ?? {});
  const companyContact = formatCompanyContact(company ?? {});
  const coHeaderLines = compactLines([
    ...formatDocumentAddressLines(company ?? {}),
    companyTax,
    companyContact
  ]);
  const logoHtml = showLogo
    ? company?.logoDataUrl
      ? `<img class="ag-logo-img" src="${escapeHtml(company.logoDataUrl)}" alt="Logo firmy"/>`
      : `<div class="ag-logo-fallback">${escapeHtml(companyName.slice(0, 1).toUpperCase())}</div>`
    : '';
  const footerBase = compactLines([companyName, company?.website]).join(' · ') || companyName;
  return `<!doctype html><html lang="pl"><head><meta charset="utf-8"/><title>${escapeHtml(title || 'Dokument')}</title><style>${createDocumentLayoutCss()}</style></head><body>${preview ? '' : '<div class="ag-toolbar"><button type="button" onclick="window.print()">Drukuj / zapisz PDF</button></div>'}<main class="ag-doc">${String(headerText ?? '').trim() ? `<div class="ag-custom-header">${renderTemplateMultiline(headerText)}</div>` : ''}<div class="ag-top">${logoHtml}<div><p class="ag-co-name">${escapeHtml(companyName)}</p>${coHeaderLines.map((line) => `<p class="ag-co-info">${escapeHtml(line)}</p>`).join('')}</div></div><div class="ag-title-block"><h1 class="ag-doc-title">${escapeHtml(title || 'Dokument')}</h1>${buildDocumentMetaChips({ documentNumber, issueDate, status })}</div><hr class="ag-divider"/>${partiesHtml}${sectionsHtml}${String(footerText ?? '').trim() ? `<footer class="ag-footer">${escapeHtml(footerText)}</footer>` : ''}<div class="ag-page-footer"><span>${escapeHtml(footerBase)}</span><span>Strona <span class="ag-page-number"></span></span></div></main>${autoPrint ? '<script>window.onload=function(){window.focus();window.print();};</script>' : ''}</body></html>`;
}

function buildRentalAgreementHtml(rental, { preview = false, company = getCompanyProfile(), sharedTemplate = null } = {}) {
  return buildRentalAgreementDocumentHtml(rental, { preview, company, sharedTemplate });
}

function openRentalAgreementPrint(rental) {
  if (!canCreateRentalAgreement(rental)) return;
  printHtmlInIframe(buildRentalAgreementHtml(rental, { preview: true }));
}

function buildGenericDocumentTemplateHtml(documentType, template, context = {}, { preview = true, company = getCompanyProfile() } = {}) {
  const normalized = normalizeSharedDocumentTemplate(template, documentType?.defaultTemplate ?? {});
  const apply = (value) => applyTemplateVariables(value, context);
  const sectionVisibility = normalized.sectionVisibility ?? DEFAULT_SHARED_TEMPLATE_SECTION_VISIBILITY;
  const sectionOrder = normalized.sectionOrder?.length ? normalized.sectionOrder : DEFAULT_SHARED_TEMPLATE_SECTION_ORDER;
  const enabledColumns = (normalized.columns ?? []).filter((column) => column.enabled !== false);
  const usesRentalEquipmentTable = documentType?.id === 'issueProtocol';
  const columns = usesRentalEquipmentTable
    ? getRentalEquipmentTableColumns()
    : (enabledColumns.length ? enabledColumns : DEFAULT_GENERIC_TEMPLATE_COLUMNS.filter((column) => column.enabled));
  const tableRows = usesRentalEquipmentTable
    ? resolveIssueProtocolEquipmentTableRows(context)
    : resolveDocumentTableRows(context, documentType?.id);
  const manyColumns = columns.length > 6;
  const tableHeader = columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join('');
  const tableBody = tableRows.map((row) => `<tr>${columns.map((column) => `<td>${escapeHtml(row[column.key] ?? '—')}</td>`).join('')}</tr>`).join('');
  const mergedCompany = { ...company };
  if (!mergedCompany.name && context.companyName) mergedCompany.name = context.companyName;
  if (!mergedCompany.legalName && context.companyName) mergedCompany.legalName = context.companyName;
  if (!mergedCompany.documentHeader && context.companyHeaderText) mergedCompany.documentHeader = context.companyHeaderText;
  const sectionMap = {
    header: '',
    intro: apply(normalized.introText).trim() ? `<p class="ag-intro">${escapeHtml(apply(normalized.introText))}</p>` : '',
    issuer: apply(normalized.issuerText).trim() ? `<div><span class="ag-party-label">${escapeHtml(normalized.signatureIssuer || 'Wystawiający')}</span>${renderTemplateMultiline(apply(normalized.issuerText))}</div>` : '',
    borrower: apply(normalized.borrowerText).trim() ? `<div><span class="ag-party-label">${escapeHtml(normalized.signatureBorrower || 'Odbiorca')}</span>${renderTemplateMultiline(apply(normalized.borrowerText))}</div>` : '',
    period: `<div class="ag-section"><h2 class="ag-section-heading">Okres</h2><div class="ag-period"><div><span class="ag-period-label">Data dokumentu</span><span class="ag-period-value">${escapeHtml(context.issueDate || getLocalIsoDate())}</span></div></div></div>`,
    equipment: `<div class="ag-section"><h2 class="ag-section-heading">Tabela pozycji</h2><div class="ag-table-wrap"><table class="ag-table${manyColumns ? ' many-cols' : ''}"><thead><tr>${tableHeader}</tr></thead><tbody>${tableBody || `<tr><td colspan="${columns.length}">Brak pozycji sprzętu.</td></tr>`}</tbody></table></div></div>`,
    terms: apply(normalized.termsText).trim() ? `<div class="ag-section"><h2 class="ag-section-heading">Treść</h2><ul class="ag-terms">${renderTermsFromTemplate(apply(normalized.termsText), [])}</ul></div>` : '',
    signatures: buildDocumentSignaturesHtml(normalized.signatureIssuer || 'Wystawiający', normalized.signatureBorrower || 'Odbiorca'),
    footer: ''
  };
  const partyBlocks = [sectionMap.issuer, sectionMap.borrower].filter(Boolean);
  const ordered = sectionOrder
    .filter((sectionId) => sectionVisibility[sectionId] !== false)
    .filter((sectionId) => !['issuer', 'borrower'].includes(sectionId))
    .map((sectionId) => sectionMap[sectionId])
    .filter(Boolean)
    .join('');
  const resolvedDocumentNumber = String(context.documentNumber || context.rentalNumber || context.serviceNumber || '—');
  const resolvedIssueDate = String(context.issueDate || getLocalIsoDate());
  const resolvedStatus = String(context.status || context.serviceStatus || '');
  return buildBaseDocumentTemplateHtml({
    title: apply(normalized.title || documentType?.label || 'Dokument'),
    company: mergedCompany,
    headerText: apply(normalized.headerText),
    documentNumber: resolvedDocumentNumber,
    issueDate: resolvedIssueDate,
    status: resolvedStatus,
    partiesHtml: partyBlocks.length ? `<div class="ag-parties">${partyBlocks.join('')}</div>` : '',
    sectionsHtml: ordered,
    footerText: apply(normalized.footerText),
    preview,
    autoPrint: false
  });
}

function normalizeScannerCode(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l')
    .replace(/\s+/g, '')
    .toLocaleLowerCase('pl');
}

function getEquipmentScannerFields(item) {
  return [item?.barcode, item?.serial, item?.inventory_number].filter(Boolean);
}

function equipmentMatchesScannerCode(item, code) {
  const normalized = normalizeScannerCode(code);
  if (!normalized) return false;
  return getEquipmentScannerFields(item).some((value) => normalizeScannerCode(value) === normalized);
}

function getScannerUnavailableReason(item) {
  const status = String(item?.status ?? '').trim().toLocaleLowerCase('pl');
  if (['wypożyczony', 'w serwisie', 'uszkodzony', 'wycofany'].includes(status)) return 'unavailable';
  return '';
}

function RentalsModule({ dashboardIntent, onConsumeDashboardIntent }) {
  const [rows, setRows] = useState([]);
  const [clients, setClients] = useState([]);
  const [equipmentRows, setEquipmentRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingRental, setEditingRental] = useState(null);
  const [returningRental, setReturningRental] = useState(null);
  const [agreementRental, setAgreementRental] = useState(null);
  const [returnedCollapsed, setReturnedCollapsed] = useState(true);
  const [rentalSettings, setRentalSettings] = useState(getRentalNumberingSettings);
  const [rentalTypes, setRentalTypes] = useState(() => getActiveConfigDictionaryNames('rentalTypes'));
  const [returnConditions, setReturnConditions] = useState(() => getActiveConfigDictionaryNames('returnConditions'));
  const [filters, setFilters] = useStoredState('fixer-rentals-filters', { search: '', status: 'all', type: 'all' });
  const [dashboardRentalFilter, setDashboardRentalFilter] = useState('all');
  const [pendingOpenRentalId, setPendingOpenRentalId] = useState(null);
  const [notice, setNotice] = useState('');
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [rentalReturnPending, setRentalReturnPending] = useState(null);
  const [returnModalNotice, setReturnModalNotice] = useState('');

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
    const selectedEquipment = equipmentRows.filter((item) => selectedEquipmentIds.includes(item.id));
    if (!rental.client_id) return { error: new Error('Wybierz klienta.') };
    if (!selectedEquipment.length) return { error: new Error('Wybierz przynajmniej jedną pozycję sprzętu.') };
    const items = buildRentalItemsFromEquipmentSelection(selectedEquipment, equipmentRows);
    const rentalToSave = {
      ...rental,
      rental_number: String(rental.rental_number ?? '').trim() || generateNextRentalNumber(rows)
    };
    const result = rental.id
      ? await updateRentalRecord(rental.id, rentalToSave, items)
      : await createRentalRecord(rentalToSave, items);
    if (result.error) return { error: result.error };
    await loadRentals();
    await loadRentalDictionaries();
    setEditorOpen(false);
    return { error: null };
  };

  const handleDelete = (row) => {
    const rental = row._rental ?? row;
    setConfirmDialog({
      title: 'Usuń wypożyczenie',
      message: `Usunąć wypożyczenie ${rental.rental_number}? Sprzęt wróci do statusu „Dostępny".`,
      confirmLabel: 'Usuń wypożyczenie',
      cancelLabel: 'Anuluj',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmDialog(null);
        const { error } = await deleteRentalRecord(rental.id);
        if (error) { setNotice(humanizeError(error, 'rental')); return; }
        await loadRentals();
        await loadRentalDictionaries();
      }
    });
  };

  const handleBulkDelete = (items) => {
    if (!items.length) return;
    setConfirmDialog({
      title: 'Usuń zaznaczone wypożyczenia',
      message: `Usunąć zaznaczone wypożyczenia: ${items.length}? Sprzęt wróci do statusu „Dostępny".`,
      confirmLabel: `Usuń ${items.length} ${items.length === 1 ? 'wypożyczenie' : 'wypożyczeń'}`,
      cancelLabel: 'Anuluj',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmDialog(null);
        for (const row of items) {
          const rental = row._rental ?? row;
          const { error } = await deleteRentalRecord(rental.id);
          if (error) {
            setNotice(`Nie udało się usunąć wypożyczenia ${rental.rental_number}: ${humanizeError(error, 'rental')}`);
            break;
          }
        }
        await loadRentals();
        await loadRentalDictionaries();
      }
    });
  };

  const executeReturn = async (pendingData, shouldClose) => {
    setRentalReturnPending(null);
    const { rental, returnedItemIds } = pendingData;
    const result = await registerRentalReturn(rental.id, returnedItemIds, shouldClose);
    if (result.error) { setNotice(humanizeError(result.error, 'rental')); return; }
    await loadRentals();
    await loadRentalDictionaries();
    setReturningRental(null);
    setReturnModalNotice('');
    if (result.data?._return_closed) setReturnedCollapsed(false);
  };

  const handleRegisterReturn = (rental, returnedItemIds, returnedCount, totalCount) => {
    if (!returnedItemIds.length && returnedCount < totalCount) {
      setReturnModalNotice('Zaznacz przynajmniej jedną pozycję do zwrotu.');
      return;
    }
    setReturnModalNotice('');
    setRentalReturnPending({ rental, returnedItemIds, returnedCount, totalCount });
  };
  const handleRestoreReturnedRental = (row) => {
    const rental = row._rental ?? row;
    setConfirmDialog({
      title: 'Przywróć wypożyczenie',
      message: `Przywrócić wypożyczenie ${rental.rental_number} jako aktywne?`,
      confirmLabel: 'Przywróć',
      cancelLabel: 'Anuluj',
      variant: 'secondary',
      onConfirm: async () => {
        setConfirmDialog(null);
        const result = await restoreRentalAsActive(rental.id);
        if (result.error) { setNotice(humanizeError(result.error, 'rental')); return; }
        await loadRentals();
        await loadRentalDictionaries();
      }
    });
  };
  const handleDeleteReturnedRental = (row) => {
    const rental = row._rental ?? row;
    setConfirmDialog({
      title: 'Usuń wypożyczenie z historii',
      message: `Usunąć wypożyczenie ${rental.rental_number} z historii?`,
      confirmLabel: 'Usuń z historii',
      cancelLabel: 'Anuluj',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmDialog(null);
        const { error } = await deleteRentalRecord(rental.id);
        if (error) { setNotice(humanizeError(error, 'rental')); return; }
        await loadRentals();
        await loadRentalDictionaries();
      }
    });
  };

  const equipmentById = useMemo(() => new Map(equipmentRows.map((item) => [String(item.id), item])), [equipmentRows]);
  const enrichedRows = useMemo(() => rows.map((rental) => ({
    ...rental,
    rental_items: (rental.rental_items ?? []).map((item) => ({
      ...item,
      equipment: item.equipment ?? equipmentById.get(String(item.equipment_id)) ?? null
    }))
  })), [rows, equipmentById]);

  const displayRows = enrichedRows.map((rental) => {
    const baseItems = getRentalBaseItems(rental);
    const overdueDays = getRentalOverdueDays(rental);
    return {
      ...rental,
      _rental: rental,
      _rowTone: overdueDays ? 'overdue' : '',
      rental_number: rental.rental_number,
      rental_type: rental.rental_type ?? '—',
      client: rental.clients?.name ?? '—',
      items_count: baseItems.length,
      items_summary: baseItems.map((item) => item.name_snapshot).filter(Boolean).join(', ') || '—',
      brands_summary: summarizeDistinctValues(baseItems.map(getRentalItemBrand)),
      models_summary: summarizeDistinctValues(baseItems.map(getRentalItemModel)),
      status: overdueDays ? 'Przeterminowane' : formatRentalStatus(rental.status),
      planned_return_date: overdueDays ? `${rental.planned_return_date} · po terminie ${overdueDays} ${overdueDays === 1 ? 'dzień' : 'dni'}` : rental.planned_return_date ?? '—',
      actual_return_date: rental.actual_return_date ?? '—'
    };
  });
  const matchesRentalFilters = (row) => {
    const query = String(filters.search ?? '').trim().toLocaleLowerCase('pl');
    const rental = row._rental;
    if ((filters.status ?? 'all') !== 'all' && rental?.status !== filters.status) return false;
    if ((filters.type ?? 'all') !== 'all' && (rental?.rental_type ?? '') !== filters.type) return false;
    if (query) {
      const searchable = [row.rental_number, row.client, row.items_summary, row.brands_summary, row.models_summary, row.status, row.rental_type, row.start_date, row.planned_return_date, row.actual_return_date].filter(Boolean).join(' ').toLocaleLowerCase('pl');
      if (!searchable.includes(query)) return false;
    }
    return true;
  };
  const activeRows = displayRows.filter((row) => {
    const rental = row._rental;
    if (rental?.status === 'returned') return false;
    if (dashboardRentalFilter === 'overdue') return getRentalOverdueDays(rental) > 0;
    if (dashboardRentalFilter === 'today') return String(rental?.planned_return_date ?? '').slice(0, 10) === getLocalIsoDate();
    return matchesRentalFilters(row);
  });
  const returnedRows = displayRows.filter((row) => row._rental?.status === 'returned' && matchesRentalFilters(row));
  const clearRentalFilters = () => setFilters({ search: '', status: 'all', type: 'all' });
  const canRegisterReturn = (row) => {
    const rental = row._rental ?? row;
    return rental?.status !== 'returned' && getRentalBaseItems(rental).length > 0;
  };
  const canOpenAgreement = (row) => canCreateRentalAgreement(row._rental ?? row);

  const renderRentalItems = (row) => {
    const rental = row._rental ?? row;
    const items = rental.rental_items ?? [];
    if (!items.length) return <div className="expanded-set-empty">Brak pozycji w wypożyczeniu.</div>;
    return <div className="expanded-set-panel">
      <div className="expanded-set-header"><strong>Pozycje wypożyczenia</strong><span>{items.length} pozycji</span></div>
      <table className="expanded-set-table">
        <thead><tr><th>Typ</th><th>Nazwa</th><th>Marka</th><th>Model</th><th>Numer seryjny</th><th>Kod / Nr inw.</th><th>Status</th></tr></thead>
        <tbody>{items.map((item, index) => <tr key={`${item.id ?? item.equipment_id}-${index}`}><td>{item.item_type === 'set' ? 'Zestaw' : item.item_type === 'set_component' ? 'Składnik' : 'Sprzęt'}</td><td><strong>{item.name_snapshot}</strong></td><td>{getRentalItemBrand(item) || '—'}</td><td>{getRentalItemModel(item) || '—'}</td><td>{item.serial_snapshot || '—'}</td><td>{item.barcode_snapshot || item.inventory_number_snapshot || '—'}</td><td><StatusPill value={formatRentalItemStatus(item.status)} /></td></tr>)}</tbody>
      </table>
    </div>;
  };

  return <div className="module-page rentals-module-page">
    <section className="panel rentals-command-panel">
      <div className="module-actions">
        <ButtonPrimary onClick={() => openRentalEditor(null)}><Plus size={17} />Nowe wypożyczenie</ButtonPrimary>
        <ButtonSecondary onClick={() => { loadRentals(); loadRentalDictionaries(); }}>Odśwież</ButtonSecondary>
        <ButtonSecondary onClick={() => exportTableToCsv(RENTALS_TABLE_KEY, RENTALS_TABLE_COLUMNS, activeRows)} disabled={!activeRows.length}><Download size={15} />CSV</ButtonSecondary>
        <ButtonSecondary onClick={() => exportTableToPdf('Wypożyczenia', RENTALS_TABLE_KEY, RENTALS_TABLE_COLUMNS, activeRows)} disabled={!activeRows.length}><FileText size={15} />PDF</ButtonSecondary>
      </div>
      {notice && <div className="notice rentals-command-notice">{notice}</div>}
      {dashboardRentalFilter !== 'all' && <div className="notice rentals-command-notice">Filtr z Dashboardu: {dashboardRentalFilter === 'overdue' ? 'po terminie' : dashboardRentalFilter === 'today' ? 'zwroty dzisiaj' : 'aktywne wypożyczenia'}. <button type="button" className="inline-notice-button" onClick={() => setDashboardRentalFilter('all')}>Pokaż wszystko</button></div>}
    </section>
    <section className="panel rentals-table-panel rentals-records-section">
      <div className="client-filter-bar rentals-filter-bar">
        <label>Szukaj<AppInput value={filters.search ?? ''} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Numer, klient, sprzęt, marka, model" /></label>
        <label>Status<AppSelect value={filters.status ?? 'all'} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}><option value="all">Wszystkie</option><option value="active">Aktywne</option><option value="partially_returned">Częściowo zwrócone</option><option value="returned">Zwrócone</option></AppSelect></label>
        <label>Typ wypożyczenia<AppSelect value={filters.type ?? 'all'} onChange={(event) => setFilters((current) => ({ ...current, type: event.target.value }))}><option value="all">Wszystkie</option>{rentalTypes.map((type) => <option key={type} value={type}>{type}</option>)}</AppSelect></label>
        <AppButton variant="secondary" size="sm" className="compact-button" onClick={clearRentalFilters}>Wyczyść</AppButton>
        {displayRows.length > 0 && activeRows.length + returnedRows.length < displayRows.length && <span className="filter-count">Wyświetlono {activeRows.length + returnedRows.length} z {displayRows.length}</span>}
      </div>
      <div className="rentals-section-heading">
        <div>
          <p className="eyebrow">Aktywne</p>
          <h3>Aktywne wypożyczenia</h3>
        </div>
        <span>{activeRows.length} pozycji</span>
      </div>
      <DataTable storageKey={RENTALS_TABLE_KEY} loading={loading} columns={RENTALS_TABLE_COLUMNS} rows={activeRows} onOpen={(row) => openRentalEditor(row._rental)} onEdit={(row) => openRentalEditor(row._rental)} onDelete={handleDelete} onBulkDelete={handleBulkDelete} customRowActions={[{ key: 'agreement', label: 'Umowa', icon: FileText, visible: canOpenAgreement, onClick: (row) => setAgreementRental(row._rental ?? row) }, { key: 'return', label: 'Zarejestruj zwrot', icon: CheckCircle2, visible: canRegisterReturn, onClick: (row) => setReturningRental(row._rental ?? row) }]} isRowExpandable={(row) => Boolean((row._rental?.rental_items ?? []).length)} renderExpandedRow={renderRentalItems} />
    </section>
    <section className="panel rentals-table-panel rentals-records-section returned-rentals-section">
      <div className="rentals-section-heading">
        <div>
          <p className="eyebrow">Historia</p>
          <h3>Wypożyczenia zwrócone</h3>
        </div>
        <div className="section-export-actions">
          <ButtonSecondary onClick={() => exportTableToCsv(`${RENTALS_TABLE_KEY}-returned`, RENTALS_TABLE_COLUMNS, returnedRows)} disabled={!returnedRows.length}><Download size={15} />CSV</ButtonSecondary>
          <ButtonSecondary onClick={() => exportTableToPdf('Historia wypożyczeń', `${RENTALS_TABLE_KEY}-returned`, RENTALS_TABLE_COLUMNS, returnedRows)} disabled={!returnedRows.length}><FileText size={15} />PDF</ButtonSecondary>
          <ButtonSecondary onClick={() => setReturnedCollapsed((value) => !value)}>{returnedCollapsed ? 'Rozwiń' : 'Zwiń'} · {returnedRows.length}</ButtonSecondary>
        </div>
      </div>
      {!returnedCollapsed && <DataTable storageKey={`${RENTALS_TABLE_KEY}-returned`} loading={loading} columns={RENTALS_TABLE_COLUMNS} rows={returnedRows} onOpen={(row) => openRentalEditor(row._rental)} onDelete={handleDeleteReturnedRental} openLabel="Podgląd wypożyczenia" deleteLabel="Usuń z historii" customRowActions={[{ key: 'agreement', label: 'Umowa', icon: FileText, visible: canOpenAgreement, onClick: (row) => setAgreementRental(row._rental ?? row) }, { key: 'restore', label: 'Przywróć jako aktywne wypożyczenie', icon: RotateCcw, onClick: handleRestoreReturnedRental }]} isRowExpandable={(row) => Boolean((row._rental?.rental_items ?? []).length)} renderExpandedRow={renderRentalItems} />}
    </section>
    {editorOpen && <RentalEditor rental={editingRental} nextRentalNumber={generateNextRentalNumber(rows)} clients={clients} equipmentRows={equipmentRows} rentalTypes={rentalTypes} rentalSettings={rentalSettings} onClose={() => setEditorOpen(false)} onSave={handleSave} onAgreement={(rentalRecord) => setAgreementRental(rentalRecord)} />}
    {returningRental && <RentalReturnModal rental={returningRental} returnConditions={returnConditions} onClose={() => { setReturningRental(null); setReturnModalNotice(''); }} onConfirm={handleRegisterReturn} notice={returnModalNotice} />}
    {agreementRental && <RentalAgreementModal rental={agreementRental} onClose={() => setAgreementRental(null)} />}
    {confirmDialog && <ConfirmDialog
      title={confirmDialog.title}
      message={confirmDialog.message}
      confirmLabel={confirmDialog.confirmLabel}
      cancelLabel={confirmDialog.cancelLabel}
      variant={confirmDialog.variant}
      onConfirm={confirmDialog.onConfirm}
      onCancel={() => setConfirmDialog(null)}
    />}
    {rentalReturnPending && <ModalFrame
      className="confirm-dialog"
      title="Rejestracja zwrotu"
      onClose={() => setRentalReturnPending(null)}
      footer={<><ButtonSecondary onClick={() => executeReturn(rentalReturnPending, false)}>Zarejestruj zwrot</ButtonSecondary><ButtonPrimary onClick={() => executeReturn(rentalReturnPending, true)}>Zamknij wypożyczenie</ButtonPrimary></>}
    >
      <p className="confirm-dialog-message">Czy zamknąć wypożyczenie <strong>{rentalReturnPending.rental.rental_number}</strong> i przenieść je do historii?</p>
      {rentalReturnPending.returnedCount < rentalReturnPending.totalCount && <AppNotice variant="warning" className="service-form-notice">Nie wszystkie pozycje są oznaczone jako zwrócone. Przy zamknięciu wypożyczenie zostanie oznaczone jako częściowo zwrócone.</AppNotice>}
    </ModalFrame>}
  </div>;
}

function RentalReturnModal({ rental, returnConditions = getActiveConfigDictionaryNames('returnConditions'), onClose, onConfirm, notice = '' }) {
  const returnConditionOptions = returnConditions.length ? returnConditions : DEFAULT_CONFIG_DICTIONARIES.returnConditions;
  const warningConditions = new Set(['Uszkodzony', 'Wymaga kontroli', 'Serwis']);
  const baseItems = getRentalBaseItems(rental);
  const initiallyReturnedIds = baseItems.filter((item) => item.status !== 'issued').map((item) => item.id).filter(Boolean);
  const [returnedItemIds, setReturnedItemIds] = useState(() => new Set(initiallyReturnedIds));
  const [returnDetails, setReturnDetails] = useState(() => Object.fromEntries(baseItems.map((item) => [item.id, { condition: 'Sprawny', notes: '' }])));
  const [returnScanValue, setReturnScanValue] = useState('');
  const [returnScanNotice, setReturnScanNotice] = useState(null);
  const [scanHighlightedItemId, setScanHighlightedItemId] = useState('');
  const returnScannerRef = useRef(null);
  const returnRowRefs = useRef({});
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
  const focusReturnScanner = () => window.setTimeout(() => returnScannerRef.current?.focus(), 0);
  const showReturnScanNotice = (message, tone = 'info') => {
    setReturnScanNotice({ message, tone });
    window.setTimeout(() => setReturnScanNotice((current) => current?.message === message ? null : current), 2600);
  };
  const handleReturnScan = (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const code = returnScanValue.trim();
    if (!code) {
      focusReturnScanner();
      return;
    }
    const matches = baseItems.filter((item) => equipmentMatchesScannerCode({
      barcode: item.barcode_snapshot,
      serial: item.serial_snapshot,
      inventory_number: item.inventory_number_snapshot
    }, code));
    const item = matches[0];
    setReturnScanValue('');
    if (!item) {
      showReturnScanNotice('Sprzęt nie znajduje się w aktywnych wypożyczeniach.', 'error');
      focusReturnScanner();
      return;
    }
    if (item.status !== 'issued' || initiallyReturnedIds.includes(item.id)) {
      setScanHighlightedItemId(item.id);
      returnRowRefs.current[item.id]?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      showReturnScanNotice('Zwrot tego sprzętu został już zarejestrowany.', 'warning');
      focusReturnScanner();
      return;
    }
    if (returnedItemIds.has(item.id)) {
      setScanHighlightedItemId(item.id);
      returnRowRefs.current[item.id]?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      showReturnScanNotice('Zwrot tego sprzętu został już zarejestrowany.', 'warning');
      focusReturnScanner();
      return;
    }
    setReturnedItemIds((current) => new Set([...current, item.id]));
    setScanHighlightedItemId(item.id);
    returnRowRefs.current[item.id]?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    showReturnScanNotice('Zarejestrowano zwrot sprzętu.', 'success');
    focusReturnScanner();
  };

  const confirmReturn = () => {
    const newlyReturnedIds = baseItems
      .filter((item) => item.status === 'issued' && returnedItemIds.has(item.id))
      .map((item) => item.id);
    onConfirm(rental, newlyReturnedIds, returnedCount, totalCount);
  };

  useEffect(() => {
    focusReturnScanner();
  }, []);

  return <ResizableModalFrame className="rental-return-modal" storageKey="fixer-rental-return-modal" defaultSize={{ width: 820, height: 620 }} minSize={{ width: 680, height: 460 }} eyebrow="Zwrot" title="Rejestracja zwrotu" onClose={onClose} footer={<><ButtonSecondary onClick={onClose}>Anuluj</ButtonSecondary><ButtonPrimary onClick={confirmReturn} disabled={!hasIssuedSelection && !allReturned}><CheckCircle2 size={16} />Zatwierdź zwrot</ButtonPrimary></>}>
    {notice && <AppNotice variant="error" className="service-form-notice">{notice}</AppNotice>}
    <div className="rental-return-summary">
      <strong>{rental.rental_number}</strong>
      <span>{rental.clients?.name ?? '—'}</span>
      <em>Zwrócono {returnedCount} z {totalCount}</em>
    </div>
    <div className="rental-scanner-strip rental-return-scanner-strip">
      <label className="rental-scanner-field">
        <Barcode size={16} />
        <span>Skanuj zwracany sprzęt</span>
        <AppInput ref={returnScannerRef} value={returnScanValue} onChange={(event) => setReturnScanValue(event.target.value)} onKeyDown={handleReturnScan} placeholder="Kod / SN / nr inw. + Enter" autoComplete="off" />
      </label>
      {returnScanNotice && <div className={`rental-scanner-notice ${returnScanNotice.tone}`}>{returnScanNotice.message}</div>}
    </div>
    <div className="rental-return-list" role="list">
      {baseItems.map((item) => {
        const returned = returnedItemIds.has(item.id);
        const locked = item.status !== 'issued';
        const detail = returnDetails[item.id] ?? { condition: 'Sprawny', notes: '' };
        const warning = warningConditions.has(detail.condition);
        return <div key={item.id ?? item.equipment_id} ref={(node) => { if (item.id) returnRowRefs.current[item.id] = node; }} role="listitem" className={`rental-return-row ${returned ? 'returned' : ''} ${locked ? 'locked' : ''} ${warning ? 'warning' : ''} ${scanHighlightedItemId === item.id ? 'scan-highlight' : ''}`.trim()} onClick={() => toggleReturnItem(item)}>
          <div className="rental-return-check">{returned ? <CheckCircle2 size={18} /> : null}</div>
          <div className="rental-return-name">
            <strong>{item.name_snapshot || 'Sprzęt'}</strong>
            <small>{[getRentalItemBrand(item), getRentalItemModel(item)].filter(Boolean).join(' ') || '—'} · SN: {item.serial_snapshot || '—'} · Kod: {item.barcode_snapshot || item.inventory_number_snapshot || '—'}</small>
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

function DocumentPreviewModal({ html, title = 'Podgląd dokumentu', onClose, onPrint = null, onDownload = null, onGeneratePdf = null }) {
  const [zoomMode, setZoomMode] = useState('fit');
  const [fitScale, setFitScale] = useState(1);
  const viewportRef = useRef(null);
  const BASE_A4_WIDTH = 794;
  const BASE_A4_HEIGHT = 1123;

  useEffect(() => {
    const computeFit = () => {
      const node = viewportRef.current;
      if (!node) return;
      const w = Math.max(320, node.clientWidth - 24);
      const h = Math.max(320, node.clientHeight - 24);
      const scale = Math.min(w / BASE_A4_WIDTH, h / BASE_A4_HEIGHT);
      setFitScale(Math.max(0.3, Math.min(1, scale)));
    };
    computeFit();
    const observer = new ResizeObserver(computeFit);
    if (viewportRef.current) observer.observe(viewportRef.current);
    window.addEventListener('resize', computeFit);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', computeFit);
    };
  }, []);

  const activeScale = zoomMode === 'fit'
    ? fitScale
    : zoomMode === '50'
      ? 0.5
      : zoomMode === '75'
        ? 0.75
        : 1;

  const runPrint = () => (onPrint ?? (() => printHtmlInIframe(html)))();
  const runDownload = () => (onDownload ?? (() => printHtmlInIframe(html)))();
  const runGeneratePdf = () => (onGeneratePdf ?? (() => printHtmlInIframe(html)))();

  return <ResizableModalFrame
    className="document-preview-modal"
    storageKey="fixer-document-preview-modal-v2"
    defaultSize={{ width: 1280, height: 900 }}
    minSize={{ width: 940, height: 680 }}
    eyebrow="Podgląd"
    title={title}
    onClose={onClose}
    footer={<>
      <ButtonSecondary onClick={onClose}>Zamknij</ButtonSecondary>
      <ButtonSecondary onClick={runGeneratePdf}><FileText size={16} />Generuj PDF</ButtonSecondary>
      <ButtonSecondary onClick={runPrint}><Printer size={16} />Drukuj</ButtonSecondary>
      <ButtonPrimary onClick={runDownload}><Download size={16} />Pobierz PDF</ButtonPrimary>
    </>}
  >
    <div className="document-preview-toolbar">
      <span>Zoom</span>
      {[
        ['50', '50%'],
        ['75', '75%'],
        ['100', '100%'],
        ['fit', 'Dopasuj']
      ].map(([id, label]) => <button key={id} type="button" className={zoomMode === id ? 'active' : ''} onClick={() => setZoomMode(id)}>{label}</button>)}
    </div>
    <div ref={viewportRef} className="document-preview-canvas">
      <div className="document-preview-paper" style={{ width: `${BASE_A4_WIDTH * activeScale}px`, height: `${BASE_A4_HEIGHT * activeScale}px` }}>
        <iframe title={title} srcDoc={html} style={{ width: `${BASE_A4_WIDTH}px`, height: `${BASE_A4_HEIGHT}px`, transform: `scale(${activeScale})`, transformOrigin: 'top left' }} />
      </div>
    </div>
  </ResizableModalFrame>;
}

function RentalAgreementModal({ rental, onClose }) {
  const previewHtml = useMemo(() => buildRentalAgreementDocumentHtml(rental, { preview: true }), [rental]);
  const printHtml = useMemo(
    () => prepareServiceDocumentPrintHtml(previewHtml, `Umowa_wypozyczenia_${normalizeFileNamePart(rental?.rental_number || 'DOC')}.pdf`),
    [previewHtml, rental]
  );
  const disabled = !canCreateRentalAgreement(rental);
  const printDocument = () => printHtmlInIframe(printHtml);

  if (disabled) {
    return <ResizableModalFrame
      className="rental-agreement-modal"
      storageKey="fixer-rental-agreement-modal"
      defaultSize={{ width: 640, height: 420 }}
      minSize={{ width: 480, height: 320 }}
      eyebrow="Dokument"
      title="Umowa wypożyczenia sprzętu"
      onClose={onClose}
      footer={<ButtonSecondary onClick={onClose}>Zamknij</ButtonSecondary>}
    >
      <EmptyState title="Nie można przygotować umowy" description="Umowa wymaga wybranego klienta i przynajmniej jednej pozycji sprzętu." />
    </ResizableModalFrame>;
  }

  return <DocumentPreviewModal
    html={previewHtml}
    title="Umowa wypożyczenia sprzętu"
    onClose={onClose}
    onPrint={printDocument}
    onDownload={printDocument}
    onGeneratePdf={printDocument}
  />;
}

function RentalEditor({ rental, nextRentalNumber = '', clients, equipmentRows, rentalTypes = getActiveConfigDictionaryNames('rentalTypes'), rentalSettings = getRentalNumberingSettings(), onClose, onSave, onAgreement }) {
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
  const [equipmentPickerInitialQuery, setEquipmentPickerInitialQuery] = useState('');
  const [issueScanValue, setIssueScanValue] = useState('');
  const [issueScanNotice, setIssueScanNotice] = useState(null);
  const [selectedRentalItemIds, setSelectedRentalItemIds] = useState(new Set());
  const [rentalItemContextMenu, setRentalItemContextMenu] = useState(null);
  const [previewEquipment, setPreviewEquipment] = useState(null);
  const issueScannerRef = useRef(null);
  const [editorError, setEditorError] = useState('');

  const availableEquipment = equipmentRows.filter((item) => {
    if (!item.id) return false;
    if (isEquipmentSetComponent(item)) return false;
    if (selectedEquipmentIds.includes(item.id)) return true;
    return item.status !== 'Wypożyczony';
  });

  const selectedEquipment = equipmentRows.filter((item) => selectedEquipmentIds.includes(item.id));
  const selectedEquipmentRows = selectedEquipment.map((item) => ({
    ...item,
    item_type_display: isEquipmentSet(item) ? 'Zestaw' : 'Sprzęt',
    code_display: item.barcode || item.inventory_number || item.serial || '—',
    issue_status: 'Do wydania'
  }));
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
      alert(humanizeError(result.error, 'client'));
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
    setEquipmentPickerInitialQuery('');
  };
  const openEquipmentPicker = (initialQuery = '') => {
    setEquipmentPickerInitialQuery(initialQuery);
    setEquipmentPickerOpen(true);
  };
  const focusIssueScanner = () => window.setTimeout(() => issueScannerRef.current?.focus(), 0);
  const showIssueScanNotice = (message, tone = 'info') => {
    setIssueScanNotice({ message, tone });
    window.setTimeout(() => setIssueScanNotice((current) => current?.message === message ? null : current), 2600);
  };
  const handleIssueScan = (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const code = issueScanValue.trim();
    if (!code) {
      focusIssueScanner();
      return;
    }
    const matches = equipmentRows
      .filter((item) => item.id && !isEquipmentSetComponent(item))
      .filter((item) => equipmentMatchesScannerCode(item, code));
    setIssueScanValue('');
    if (!matches.length) {
      showIssueScanNotice('Nie znaleziono sprzętu o podanym kodzie.', 'error');
      focusIssueScanner();
      return;
    }
    if (matches.length > 1) {
      showIssueScanNotice('Znaleziono kilka pozycji. Wybierz właściwy sprzęt z listy.', 'warning');
      openEquipmentPicker(code);
      return;
    }
    const item = matches[0];
    if (selectedEquipmentIds.includes(item.id)) {
      showIssueScanNotice('Ten sprzęt jest już dodany do dokumentu.', 'warning');
      focusIssueScanner();
      return;
    }
    if (getScannerUnavailableReason(item)) {
      showIssueScanNotice('Sprzęt nie jest dostępny do wypożyczenia.', 'error');
      focusIssueScanner();
      return;
    }
    setSelectedEquipmentIds((current) => [...new Set([...current, item.id])]);
    showIssueScanNotice('Dodano sprzęt do dokumentu.', 'success');
    focusIssueScanner();
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
  const removeRentalEquipmentRows = async (items) => {
    const ids = new Set(items.map((item) => item.id).filter(Boolean));
    if (!ids.size) return;
    setSelectedEquipmentIds((current) => current.filter((itemId) => !ids.has(itemId)));
    setSelectedRentalItemIds(new Set());
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

  const submit = async () => {
    setEditorError('');
    if (!form.client_id) {
      setEditorError('Wybierz klienta.');
      return;
    }
    if (!selectedEquipmentIds.length) {
      setEditorError('Wybierz przynajmniej jedną pozycję sprzętu.');
      return;
    }
    const result = await onSave({ rental: form, selectedEquipmentIds });
    if (result?.error) {
      setEditorError(humanizeError(result.error, 'rental'));
    }
  };

  useEffect(() => {
    setSelectedRentalItemIds((current) => new Set([...current].filter((id) => selectedEquipmentIds.includes(id))));
  }, [selectedEquipmentIds]);

  useEffect(() => { setLocalClients(clients); }, [clients]);

  useEffect(() => {
    if (!equipmentPickerOpen && !clientPickerOpen && !clientEditorOpen && !previewEquipment) focusIssueScanner();
  }, [equipmentPickerOpen, clientPickerOpen, clientEditorOpen, previewEquipment]);

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

  if (clientPickerOpen) {
    return <ClientPickerModal clients={localClients} selectedClientId={form.client_id} onClose={() => setClientPickerOpen(false)} onConfirm={chooseClient} onCreateClient={openNewClientEditor} />;
  }

  if (clientEditorOpen) {
    return <ClientEditor client={null} initialTab="data" onClose={() => { setClientEditorOpen(false); setClientPickerOpen(true); }} onSave={saveNewClientFromRental} />;
  }

  if (equipmentPickerOpen) {
    return <EquipmentPickerModal title="Wybierz sprzęt do wypożyczenia" availableItems={availableEquipment} selectedIds={selectedEquipmentIds} initialQuery={equipmentPickerInitialQuery} onClose={() => { setEquipmentPickerOpen(false); setEquipmentPickerInitialQuery(''); }} onConfirm={addEquipment} />;
  }

  if (previewEquipment) {
    return <RentalEquipmentPreviewModal equipment={previewEquipment} onClose={() => setPreviewEquipment(null)} />;
  }

  return <>
    <ResizableModalFrame
      className="rental-record-modal"
      storageKey="fixer-rental-modal"
      defaultSize={{ width: 1160, height: 760 }}
      minSize={{ width: 960, height: 640 }}
      eyebrow="Wypożyczenia"
      title={rental ? 'Kartoteka wypożyczenia' : 'Nowe wypożyczenie'}
      onClose={onClose}
      footer={<>{rental && <ButtonSecondary onClick={() => onAgreement?.(rental)} disabled={!canCreateRentalAgreement(rental)}><FileText size={16} />Umowa</ButtonSecondary>}<ButtonSecondary onClick={onClose}>Anuluj</ButtonSecondary><ButtonPrimary onClick={submit}><Save size={17} />Zapisz dokument</ButtonPrimary></>}
    >
      {editorError && <AppNotice variant="error" className="service-form-notice">{editorError}</AppNotice>}
      <div className="rental-record-layout">
        <SectionPanel className="rental-record-section rental-record-header-section" title="Dokument">
          <div className="rental-document-grid">
            <div className="rental-document-row rental-document-primary-row">
              <FormField className="rental-number-field" label="Numer"><AppInput value={form.rental_number} onChange={(event) => update('rental_number', event.target.value)} placeholder="automatycznie" /></FormField>
              <FormField className="rental-status-field" label="Status"><AppSelect value={form.status} onChange={(event) => update('status', event.target.value)}><option value="active">Aktywne</option><option value="partially_returned">Częściowo zwrócone</option><option value="returned">Zwrócone</option></AppSelect></FormField>
              <div className="rental-client-field">
                <ClientChoiceCard client={selectedClient} onClick={() => setClientPickerOpen(true)} />
              </div>
            </div>
            <div className="rental-document-row rental-document-secondary-row">
              <FormField className="rental-type-field" label="Typ wypożyczenia">
                <AppSelect value={form.rental_type} onChange={(event) => update('rental_type', event.target.value)}>
                  {safeRentalTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                </AppSelect>
              </FormField>
              <FormField className="rental-date-field rental-issue-date-field" label="Wydanie"><AppInput type="date" value={form.start_date} onChange={(event) => update('start_date', event.target.value)} /></FormField>
              <FormField className="rental-date-field rental-return-date-field" label="Termin zwrotu"><AppInput type="date" value={form.planned_return_date} onChange={(event) => update('planned_return_date', event.target.value)} /></FormField>
              <FormField className="rental-date-field rental-actual-return-date-field" label="Faktyczny zwrot"><AppInput type="date" value={form.actual_return_date || ''} disabled /></FormField>
            </div>
          </div>
        </SectionPanel>
        <SectionPanel className="rental-record-section rental-items-section" title="Sprzęt do wydania" actions={<ButtonPrimary className="rental-add-equipment-button" onClick={() => openEquipmentPicker()}><Plus size={14} />Dodaj sprzęt</ButtonPrimary>}>
          <div className="rental-scanner-strip rental-issue-scanner-strip">
            <label className="rental-scanner-field">
              <Barcode size={16} />
              <span>Skanuj kod / numer seryjny / nr inwentarzowy</span>
              <AppInput ref={issueScannerRef} value={issueScanValue} onChange={(event) => setIssueScanValue(event.target.value)} onKeyDown={handleIssueScan} placeholder="Skan + Enter" autoComplete="off" />
            </label>
            {issueScanNotice && <div className={`rental-scanner-notice ${issueScanNotice.tone}`}>{issueScanNotice.message}</div>}
          </div>
          <div className="rental-items-meta">
            <span>{selectedRentalItemIds.size ? `${selectedRentalItemIds.size} zaznaczono` : 'Brak zaznaczenia'}</span>
            <span className="rental-document-summary">{rentalSummary.items} pozycji · {rentalSummary.sets} zestawów · cena {rentalSummary.price} · kaucja {rentalSummary.deposit}</span>
          </div>
          <div className="rental-items-table-shell">
            {selectedEquipmentRows.length ? <DataTable
              storageKey={RENTAL_SELECTED_EQUIPMENT_TABLE_KEY}
              columns={RENTAL_SELECTED_EQUIPMENT_COLUMNS}
              rows={selectedEquipmentRows}
              onOpen={(item) => setPreviewEquipment(item)}
              onDelete={(item) => removeRentalEquipment(item.id)}
              onBulkDelete={removeRentalEquipmentRows}
              openLabel="Podgląd sprzętu"
              deleteLabel="Usuń z dokumentu"
              customRowActions={[
                { key: 'preview', label: 'Podgląd sprzętu', icon: FolderOpen, onClick: (item) => setPreviewEquipment(item) }
              ]}
            /> : <EmptyState title="Nie dodano sprzętu do wypożyczenia" description="Użyj akcji Dodaj sprzęt w nagłówku tabeli, aby utworzyć dokument wydania." />}
          </div>
        </SectionPanel>
        <SectionPanel className="rental-record-section rental-record-terms-section" title="Warunki i rozliczenie">
          <div className="rental-terms-grid">
            <FormField className="rental-price-field" label="Cena łączna"><div className="money-input"><AppInput value={form.total_price} onChange={(event) => update('total_price', event.target.value)} placeholder={settlementOptional ? 'opcjonalnie' : 'np. 1200'} /><span>{rentalSettings.currency || 'zł'}</span></div></FormField>
            <FormField label="Kaucja"><AppInput value={form.total_deposit} onChange={(event) => update('total_deposit', event.target.value)} placeholder={settlementOptional ? 'opcjonalnie' : 'np. 500'} /></FormField>
            <FormField className="rental-notes-field" label="Notatki"><AppTextarea resizeKey="fixer:textarea:rental:notes" value={form.notes} onChange={(event) => update('notes', event.target.value)} placeholder="Warunki wydania, uwagi do klienta lub sprzętu." /></FormField>
          </div>
        </SectionPanel>
      </div>
    </ResizableModalFrame>
    {rentalItemContextMenu && <div className="row-context-menu rental-item-context-menu" style={{ left: rentalItemContextMenu.x, top: rentalItemContextMenu.y }} onClick={(event) => event.stopPropagation()}>
      <div className="context-menu-title">Sprzęt</div>
      <button type="button" onClick={() => runRentalItemAction('preview')}><FolderOpen size={14} />Podgląd sprzętu</button>
      <button type="button" onClick={() => runRentalItemAction('toggle')}>{selectedRentalItemIds.has(rentalItemContextMenu.item?.id) ? <X size={14} /> : <CheckCircle2 size={14} />}{selectedRentalItemIds.has(rentalItemContextMenu.item?.id) ? 'Odznacz pozycję' : 'Zaznacz pozycję'}</button>
      <div className="context-menu-separator" />
      {selectedRentalItemIds.size > 1 && <button type="button" className="danger-action" onClick={() => runRentalItemAction('removeSelected')}><Trash2 size={14} />Usuń zaznaczone</button>}
      <button type="button" className="danger-action" onClick={() => runRentalItemAction('remove')}><Trash2 size={14} />Usuń pozycję</button>
    </div>}
  </>;
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

function ClientChoiceCard({ client, onClick, className = '' }) {
  const contact = [client?.phone, client?.email].filter(Boolean);
  return <button type="button" className={`client-choice-card ${client ? 'selected' : ''} ${className}`.trim()} onClick={onClick}>
    <span>Klient</span>
    <strong>{client?.name || 'Wybierz klienta'}</strong>
    <small>{contact.length ? contact.join(' · ') : 'Kliknij, aby wybrać'}</small>
    <em>Zmień</em>
  </button>;
}

function ClientPickerModal({ clients, selectedClientId, onClose, onConfirm, onCreateClient = null }) {
  const [filters, setFilters] = useStoredState('fixer-client-picker-filters', { query: '' });

  const filteredClients = useMemo(() => {
    const text = String(filters.query ?? '').trim().toLocaleLowerCase('pl');
    return clients
      .filter((client) => {
        const searchable = [client.name, client.type, client.client_kind, client.phone, client.email, client.city, client.nip].filter(Boolean).join(' ').toLocaleLowerCase('pl');
        return !text || searchable.includes(text);
      })
      .map((client) => ({ ...client, picker_selected: client.id === selectedClientId ? 'Tak' : '' }));
  }, [clients, filters, selectedClientId]);

  const clientPickerColumns = [
    { key: 'picker_selected', label: 'Wybrany' },
    { key: 'name', label: 'Nazwa' },
    { key: 'type', label: 'Typ' },
    { key: 'client_kind', label: 'Rodzaj' },
    { key: 'phone', label: 'Telefon' },
    { key: 'email', label: 'Email' },
    { key: 'city', label: 'Miasto' },
    { key: 'nip', label: 'NIP' }
  ];

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return <ResizableModalFrame className="shared-picker-modal client-picker-modal" storageKey="fixer-client-picker-modal" defaultSize={{ width: 980, height: 640 }} minSize={{ width: 720, height: 480 }} eyebrow="Klienci" title="Wybierz klienta" onClose={onClose} footer={<ButtonSecondary onClick={onClose}>Anuluj</ButtonSecondary>}>
      <div className="shared-picker-toolbar">
        <FormField label="Szukaj"><input value={filters.query ?? ''} onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))} placeholder="Nazwa, telefon, email, miasto, NIP" autoFocus /></FormField>
        {onCreateClient && <AppButton variant="primary" size="sm" className="compact-button picker-create-button" onClick={onCreateClient}><Plus size={15} />Nowy klient</AppButton>}
      </div>
      <div className="shared-picker-table-shell">
        {filteredClients.length ? <DataTable storageKey="client-picker-table" columns={clientPickerColumns} rows={filteredClients} onOpen={onConfirm} openLabel="Wybierz klienta" enableSelectionActions={false} /> : <EmptyState title="Brak klientów spełniających kryteria wyszukiwania." />}
      </div>
    </ResizableModalFrame>;
}

function EquipmentPickerModal({ title = 'Wybierz sprzęt', availableItems, selectedIds = [], initialQuery = '', onClose, onConfirm }) {
  const [filters, setFilters] = useStoredState('fixer-equipment-picker-filters', { query: '', category: 'all', status: 'all', location: 'all', sort: 'name' });
  const [selectedKeys, setSelectedKeys] = useState(() => new Set(selectedIds.map(String)));

  useEffect(() => {
    if (!initialQuery) return;
    setFilters((current) => ({ ...current, query: initialQuery }));
  }, [initialQuery]);

  const categories = useMemo(() => [...new Set(availableItems.map((item) => item.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pl')), [availableItems]);
  const statuses = useMemo(() => [...new Set(availableItems.map((item) => item.status).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pl')), [availableItems]);
  const locations = useMemo(() => [...new Set(availableItems.map((item) => item.location).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pl')), [availableItems]);

  const filteredItems = useMemo(() => {
    const text = String(filters.query ?? '').trim().toLocaleLowerCase('pl');
    return availableItems
      .filter((item) => {
        const matchesCategory = (filters.category ?? 'all') === 'all' || item.category === filters.category;
        const matchesStatus = (filters.status ?? 'all') === 'all' || item.status === filters.status;
        const matchesLocation = (filters.location ?? 'all') === 'all' || item.location === filters.location;
        const searchable = [item.name, item.category, item.brand, item.model, item.serial, item.inventory_number, item.barcode, item.location, item.status].filter(Boolean).join(' ').toLocaleLowerCase('pl');
        return matchesCategory && matchesStatus && matchesLocation && (!text || searchable.includes(text));
      })
      .sort((left, right) => String(left[filters.sort ?? 'name'] ?? '').localeCompare(String(right[filters.sort ?? 'name'] ?? ''), 'pl', { numeric: true, sensitivity: 'base' }));
  }, [availableItems, filters]);

  const selectedItems = availableItems.filter((item) => selectedKeys.has(String(getEquipmentKey(item))));
  const visibleAllSelected = filteredItems.length > 0 && filteredItems.every((item) => selectedKeys.has(String(getEquipmentKey(item))));
  const pickerRows = filteredItems.map((item) => ({
    ...item,
    picker_selected: selectedKeys.has(String(getEquipmentKey(item))) ? 'Tak' : '',
    item_type_display: isEquipmentSet(item) ? 'Zestaw' : (item.category || '—'),
    code_display: item.barcode || item.inventory_number || '—'
  }));
  const pickerColumns = [
    { key: 'picker_selected', label: 'Wybierz', renderCell: (item) => <input type="checkbox" checked={selectedKeys.has(String(getEquipmentKey(item)))} onChange={() => toggleItem(item)} onClick={(event) => event.stopPropagation()} aria-label="Wybierz sprzęt" /> },
    { key: 'name', label: 'Nazwa', renderCell: (row) => renderEquipmentNameWithBadge(row) },
    { key: 'item_type_display', label: 'Kategoria' },
    { key: 'brand', label: 'Marka' },
    { key: 'model', label: 'Model' },
    { key: 'serial', label: 'Numer seryjny' },
    { key: 'code_display', label: 'Kod' },
    { key: 'status', label: 'Status', renderCell: (item) => <DSStatusPill value={item.status} /> },
    { key: 'location', label: 'Lokalizacja' }
  ];

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
    setFilters({ query: '', category: 'all', status: 'all', location: 'all', sort: 'name' });
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
        <FormField label="Szukaj"><AppInput value={filters.query ?? ''} onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))} placeholder="Nazwa, marka, model, SN, kod" autoFocus /></FormField>
        <FormField label="Kategoria"><AppSelect value={filters.category ?? 'all'} onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))}><option value="all">Wszystkie</option>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</AppSelect></FormField>
        <FormField label="Status"><AppSelect value={filters.status ?? 'all'} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}><option value="all">Wszystkie</option>{statuses.map((item) => <option key={item} value={item}>{item}</option>)}</AppSelect></FormField>
        <FormField label="Lokalizacja"><AppSelect value={filters.location ?? 'all'} onChange={(event) => setFilters((current) => ({ ...current, location: event.target.value }))}><option value="all">Wszystkie</option>{locations.map((item) => <option key={item} value={item}>{item}</option>)}</AppSelect></FormField>
        <FormField label="Sortuj"><AppSelect value={filters.sort ?? 'name'} onChange={(event) => setFilters((current) => ({ ...current, sort: event.target.value }))}><option value="name">Nazwa</option><option value="category">Kategoria</option><option value="status">Status</option><option value="location">Lokalizacja</option></AppSelect></FormField>
        <ButtonGhost className="compact-table-button" onClick={clearFilters}>Wyczyść</ButtonGhost>
      </div>
      <div className="set-picker-summary"><strong>{selectedItems.length} zaznaczono</strong><span>{filteredItems.length} z {availableItems.length} dostępnych pozycji</span></div>
      <div className="shared-picker-table-shell" tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter' && selectedItems.length) onConfirm(selectedItems); }}>
        <div className="picker-visible-toggle"><label><input type="checkbox" checked={visibleAllSelected} onChange={toggleVisible} />Zaznacz widoczne</label></div>
        {pickerRows.length ? <DataTable storageKey="equipment-picker-table" columns={pickerColumns} rows={pickerRows} onOpen={toggleItem} openLabel="Zaznacz / odznacz" enableSelectionActions={false} /> : <EmptyState title="Brak pozycji spełniających aktualne filtry." />}
      </div>
    </ResizableModalFrame>;
}
const SERVICE_TABLE_KEY = 'service-orders-table';

function ConfirmDialog({ title, message, confirmLabel = 'Tak', cancelLabel = 'Anuluj', variant = 'danger', onConfirm, onCancel }) {
  return <ModalFrame
    className="confirm-dialog"
    title={title}
    onClose={onCancel}
    footer={<><ButtonSecondary onClick={onCancel}>{cancelLabel}</ButtonSecondary><AppButton variant={variant} onClick={onConfirm}>{confirmLabel}</AppButton></>}
  >
    {message && <p className="confirm-dialog-message">{message}</p>}
  </ModalFrame>;
}

function SelectStatusDialog({ order, statuses, onConfirm, onCancel }) {
  const [selected, setSelected] = useState(order?.status ?? '');
  return <ModalFrame
    className="select-status-dialog"
    eyebrow="Serwis"
    title="Zmień status zlecenia"
    onClose={onCancel}
    footer={<><ButtonSecondary onClick={onCancel}>Anuluj</ButtonSecondary><ButtonPrimary onClick={() => onConfirm(selected)} disabled={selected === order?.status}>Zmień status</ButtonPrimary></>}
  >
    <FormField label="Nowy status">
      <AppSelect value={selected} onChange={(event) => setSelected(event.target.value)}>
        {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
      </AppSelect>
    </FormField>
  </ModalFrame>;
}

function formatServiceMoney(value) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? `${number.toFixed(2).replace('.', ',')} zł` : '0,00 zł';
}

function generateServiceNumber(existingRows = []) {
  const today = new Date();
  const settings = getDocumentSettings().numbering.service;
  const configuredFormat = settings.format || DEFAULT_DOCUMENT_NUMBERING.service.format;
  const prefix = settings.prefix || DEFAULT_DOCUMENT_NUMBERING.service.prefix;

  // Detect the actual format used in existing records — handles stale localStorage values.
  // Tries known formats in order of preference; falls back to configured format.
  const knownFormats = ['PREFIX/YYYY/MM/NR', 'PREFIX/NR/DD/MM/YYYY', 'PREFIX/YYYY/NR', configuredFormat];
  let effectiveFormat = configuredFormat;
  if (existingRows.length) {
    for (const fmt of knownFormats) {
      const fmtParts = fmt.split('/');
      const prefixIdx = fmtParts.indexOf('PREFIX');
      const nrIdx = fmtParts.indexOf('NR');
      if (prefixIdx < 0 || nrIdx < 0) continue;
      const hasMatch = existingRows.some((row) => {
        const parts = String(row.service_number ?? '').split('/');
        return parts.length === fmtParts.length && parts[prefixIdx] === prefix && Number(parts[nrIdx]) > 0;
      });
      if (hasMatch) { effectiveFormat = fmt; break; }
    }
  }

  const effectiveParts = effectiveFormat.split('/');
  const nrIndex = effectiveParts.indexOf('NR');
  const prefixIndex = effectiveParts.indexOf('PREFIX');
  const sequence = existingRows.reduce((max, row) => {
    const parts = String(row.service_number ?? '').split('/');
    if (parts.length !== effectiveParts.length) return max;
    if (prefixIndex < 0 || nrIndex < 0 || parts[prefixIndex] !== prefix) return max;
    return Math.max(max, Number(parts[nrIndex]) || 0);
  }, 0) + 1;

  return formatDocumentNumber({ ...settings, format: effectiveFormat }, sequence, today);
}

function ServiceModule({ dashboardIntent, onConsumeDashboardIntent }) {
  const [rows, setRows] = useState([]);
  const [clients, setClients] = useState([]);
  const [equipmentRows, setEquipmentRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [selectStatusDialog, setSelectStatusDialog] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [filters, setFilters] = useStoredState('fixer-service-filters', { search: '', status: 'all', priority: 'all', category: 'all' });
  const [serviceHistoryCollapsed, setServiceHistoryCollapsed] = useState(true);
  const [pendingOpenServiceId, setPendingOpenServiceId] = useState(null);
  const [serviceStatuses, setServiceStatuses] = useState(SERVICE_STATUSES);
  const [servicePriorities, setServicePriorities] = useState(SERVICE_PRIORITIES);
  const [serviceDeviceCategories, setServiceDeviceCategories] = useState(DEFAULT_SERVICE_DEVICE_CATEGORIES);
  const [serviceIntakeConditions, setServiceIntakeConditions] = useState(DEFAULT_SERVICE_INTAKE_CONDITIONS);
  const [serviceExternalServices, setServiceExternalServices] = useState(DEFAULT_SERVICE_EXTERNAL_SERVICES);
  const [serviceProgressTemplates, setServiceProgressTemplates] = useState(DEFAULT_SERVICE_PROGRESS_TEMPLATES);
  const [serviceDocumentPreview, setServiceDocumentPreview] = useState(null);

  const loadServiceData = async () => {
    setLoading(true);
    const [ordersResult, clientsResult, equipmentResult, statusesResult, prioritiesResult, categoriesResult, conditionsResult, externalServicesResult, progressTemplatesResult] = await Promise.all([
      fetchServiceOrders(),
      fetchClients(),
      fetchEquipment(),
      fetchServiceDictionary(SERVICE_DICTIONARY_TYPES.status),
      fetchServiceDictionary(SERVICE_DICTIONARY_TYPES.priority),
      fetchServiceDictionary(SERVICE_DICTIONARY_TYPES.customerDeviceCategory),
      fetchServiceDictionary(SERVICE_DICTIONARY_TYPES.intakeCondition),
      fetchServiceDictionary(SERVICE_DICTIONARY_TYPES.externalService),
      fetchServiceDictionary(SERVICE_DICTIONARY_TYPES.progressTemplate)
    ]);
    setRows(ordersResult.data ?? []);
    setClients(clientsResult.data ?? []);
    setEquipmentRows(equipmentResult.error ? demoEquipment : (equipmentResult.data ?? []));
    setServiceStatuses((statusesResult.data?.length ? statusesResult.data.map((item) => item.name) : SERVICE_STATUSES));
    setServicePriorities((prioritiesResult.data?.length ? prioritiesResult.data.map((item) => item.name) : SERVICE_PRIORITIES));
    setServiceDeviceCategories((categoriesResult.data?.length ? categoriesResult.data.map((item) => item.name) : DEFAULT_SERVICE_DEVICE_CATEGORIES));
    setServiceIntakeConditions((conditionsResult.data?.length ? conditionsResult.data.map((item) => item.name) : DEFAULT_SERVICE_INTAKE_CONDITIONS));
    setServiceExternalServices((externalServicesResult.data?.length ? externalServicesResult.data.map((item) => item.name) : DEFAULT_SERVICE_EXTERNAL_SERVICES));
    setServiceProgressTemplates((progressTemplatesResult.data?.length ? progressTemplatesResult.data.map((item) => item.name) : DEFAULT_SERVICE_PROGRESS_TEMPLATES));
    if (ordersResult.error) setNotice(`Nie udało się pobrać zleceń serwisowych z Supabase: ${ordersResult.error.message}. Sprawdź migrację 005_service_orders_schema.sql.`);
    else if (statusesResult.error || prioritiesResult.error || categoriesResult.error || conditionsResult.error || externalServicesResult.error || progressTemplatesResult.error) setNotice('Nie udało się pobrać ustawień Serwisu z Supabase. Uruchom migracje słowników Serwisu.');
    else setNotice('');
    setLoading(false);
  };

  useEffect(() => { loadServiceData(); }, []);

  useEffect(() => {
    if (dashboardIntent?.type !== 'service') return;
    if (dashboardIntent.serviceOrderId) setPendingOpenServiceId(dashboardIntent.serviceOrderId);
    onConsumeDashboardIntent?.();
  }, [dashboardIntent, onConsumeDashboardIntent]);

  useEffect(() => {
    if (!pendingOpenServiceId || !rows.length) return;
    const order = rows.find((row) => row.id === pendingOpenServiceId);
    if (order) openServiceEditor(order);
    setPendingOpenServiceId(null);
  }, [pendingOpenServiceId, rows]);

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
      brand_display: order.customer_device_brand || equipment?.brand || '—',
      model_display: order.customer_device_model || equipment?.model || '—',
      category_display: order.customer_device_category || equipment?.category || '—',
      accepted_date_display: formatDashboardDate(order.accepted_date),
      planned_date_display: formatDashboardDate(order.planned_date),
      completed_date_display: formatDashboardDate(order.completed_date),
      total_cost_display: formatServiceMoney(order.total_cost)
    };
  }), [rows, clients, equipmentRows]);

  const activeTableRows = useMemo(() => tableRows.filter((order) => order.status !== 'Wydane'), [tableRows]);
  const completedTableRows = useMemo(() => tableRows.filter((order) => order.status === 'Wydane'), [tableRows]);

  const filteredRows = useMemo(() => {
    const query = String(filters.search ?? '').trim().toLocaleLowerCase('pl');
    return activeTableRows.filter((order) => {
      const matchesStatus = filters.status === 'all' || order.status === filters.status;
      const matchesPriority = filters.priority === 'all' || order.priority === filters.priority;
      const matchesCategory = filters.category === 'all' || order.category_display === filters.category || order.customer_device_category === filters.category;
      const searchable = [order.service_number, order.client_name, order.equipment_name, order.category_display, order.customer_device_brand, order.customer_device_model, order.customer_device_serial, order.status, order.priority, order.fault_description, order.diagnosis]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('pl');
      return matchesStatus && matchesPriority && matchesCategory && (!query || searchable.includes(query));
    });
  }, [activeTableRows, filters]);

  const serviceCategoryOptions = useMemo(() => [...new Set([...serviceDeviceCategories, ...tableRows.map((order) => order.category_display).filter((item) => item && item !== '—')])].sort((a, b) => a.localeCompare(b, 'pl')), [serviceDeviceCategories, tableRows]);

  const openServiceEditor = (order = null) => {
    setEditingOrder(order);
    setEditorOpen(true);
  };

  const createNewOrder = () => {
    openServiceEditor({
      service_number: generateServiceNumber(rows),
      claim_type: 'Pogwarancyjna',
      status: serviceStatuses[0] ?? 'Przyjęte',
      priority: servicePriorities.includes('Normalny') ? 'Normalny' : (servicePriorities[0] ?? 'Normalny'),
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
      estimate_items: [],
      estimate_status: 'Roboczy',
      internal_notes: '',
      attachments: [],
      notes: ''
    });
  };

  const saveServiceOrder = async (order) => {
    const result = order.id || order.localId
      ? await updateServiceOrderRecord(order.id ?? order.localId, order)
      : await createServiceOrderRecord(order);
    if (result.error) {
      return { error: result.error };
    }
    if (order.status === 'Wydane') setServiceHistoryCollapsed(false);
    setEditorOpen(false);
    await loadServiceData();
    return { error: null };
  };

  const deleteServiceOrder = (order) => {
    if (order.status === 'Wydane') {
      setNotice('Nie można usunąć zlecenia wydanego. Zlecenia wydane znajdują się w historii.');
      return;
    }
    setConfirmDialog({
      title: 'Usuń zlecenie serwisowe',
      message: `Usunąć zlecenie ${order.service_number}? Operacja jest nieodwracalna.`,
      confirmLabel: 'Usuń zlecenie',
      cancelLabel: 'Anuluj',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmDialog(null);
        const { error } = await deleteServiceOrderRecord(order.id ?? order.localId, order);
        if (error) { setNotice(humanizeError(error, 'service')); return; }
        await loadServiceData();
      }
    });
  };

  const changeServiceStatus = (order) => {
    setSelectStatusDialog({ order });
  };

  const handleRestoreServiceOrder = async (order) => {
    if (!confirm(`Przywrócić zlecenie ${order.service_number} jako aktywne?`)) return;
    const restoredStatus = serviceStatuses.find((s) => s !== 'Wydane') ?? 'Przyjęte';
    const result = await saveServiceOrder({ ...order, status: restoredStatus, completed_date: null });
    if (result?.error) setNotice(humanizeError(result.error, 'service'));
  };

  const handleDeleteCompletedServiceOrder = async (order) => {
    if (order.status !== 'Wydane') return;
    if (!confirm(`Usunąć zlecenie ${order.service_number} z historii?`)) return;
    const { error, local } = await deleteServiceOrderRecord(order.id ?? order.localId, order);
    if (error) { alert(humanizeError(error, 'service')); return; }
    await loadServiceData();
  };

  const openServiceDocumentPreview = (order, type) => {
    const client = resolveClient(order);
    const html = buildServiceOrderDocumentHtml(order, type, { preview: true, client });
    setServiceDocumentPreview({
      html,
      title: SERVICE_DOCUMENT_TITLES[type],
      fileName: buildServiceDocumentFileName(order, type)
    });
    setNotice(type === 'acceptance' ? 'Przygotowano dokument przyjęcia do serwisu.' : 'Przygotowano dokument wydania z serwisu.');
  };

  const printServiceDocumentPreview = () => {
    if (!serviceDocumentPreview) return;
    printHtmlInIframe(prepareServiceDocumentPrintHtml(serviceDocumentPreview.html, serviceDocumentPreview.fileName));
  };

  const clearFilters = () => {
    setFilters({ search: '', status: 'all', priority: 'all', category: 'all' });
  };

  const setServiceOrderStatus = async (order, newStatus) => {
    if (newStatus === order.status) return;
    if (newStatus === 'Wydane') {
      setConfirmDialog({
        title: 'Zamknij zlecenie serwisowe',
        message: `Zamknąć zlecenie ${order.service_number || 'serwisowe'} i przenieść do historii?`,
        confirmLabel: 'Zamknij zlecenie',
        cancelLabel: 'Anuluj',
        variant: 'primary',
        onConfirm: async () => {
          setConfirmDialog(null);
          const result = await saveServiceOrder({ ...order, status: newStatus, completed_date: order.completed_date || getLocalIsoDate() });
          if (result?.error) setNotice(humanizeError(result.error, 'service'));
        }
      });
      return;
    }
    const result = await saveServiceOrder({ ...order, status: newStatus, completed_date: order.completed_date ?? null });
    if (result?.error) setNotice(humanizeError(result.error, 'service'));
  };

  const serviceColumns = [
    { key: 'service_number', label: 'Numer' },
    { key: 'client_name', label: 'Klient' },
    { key: 'equipment_name', label: 'Sprzęt' },
    { key: 'brand_display', label: 'Marka', renderCell: (row) => row.brand_display || '—' },
    { key: 'model_display', label: 'Model', renderCell: (row) => row.model_display || '—' },
    { key: 'category_display', label: 'Kategoria' },
    { key: 'status', label: 'Status', renderCell: (row) => <ServiceStatusCell value={row.status} statuses={serviceStatuses} onStatusChange={(newStatus) => setServiceOrderStatus(row, newStatus)} /> },
    { key: 'priority', label: 'Priorytet' },
    { key: 'accepted_date_display', label: 'Przyjęcie' },
    { key: 'planned_date_display', label: 'Planowany termin' },
    { key: 'external_service', label: 'Serwis zewnętrzny', renderCell: (row) => row.external_service || '—' },
    { key: 'total_cost_display', label: 'Suma' }
  ];

  const completedServiceColumns = [
    { key: 'service_number', label: 'Numer' },
    { key: 'client_name', label: 'Klient' },
    { key: 'equipment_name', label: 'Sprzęt' },
    { key: 'brand_display', label: 'Marka', renderCell: (row) => row.brand_display || '—' },
    { key: 'model_display', label: 'Model', renderCell: (row) => row.model_display || '—' },
    { key: 'category_display', label: 'Kategoria' },
    { key: 'status', label: 'Status' },
    { key: 'priority', label: 'Priorytet' },
    { key: 'accepted_date_display', label: 'Przyjęcie' },
    { key: 'completed_date_display', label: 'Zakończone' },
    { key: 'external_service', label: 'Serwis zewnętrzny', renderCell: (row) => row.external_service || '—' },
    { key: 'total_cost_display', label: 'Suma' }
  ];

  return <div className="module-page service-module-page">
    <section className="panel hero-panel service-hero-panel">
      <div className="module-actions">
        <AppButton variant="primary" className="module-action-button" onClick={createNewOrder}><Plus size={18} />Nowe zlecenie</AppButton>
        <AppButton variant="secondary" className="module-action-button" onClick={loadServiceData}>Odśwież</AppButton>
        <AppButton variant="secondary" className="module-action-button" onClick={() => exportTableToCsv(SERVICE_TABLE_KEY, serviceColumns, filteredRows)} disabled={!filteredRows.length}><Download size={16} />CSV</AppButton>
        <AppButton variant="secondary" className="module-action-button" onClick={() => exportTableToPdf('Aktywne zlecenia serwisowe', SERVICE_TABLE_KEY, serviceColumns, filteredRows)} disabled={!filteredRows.length}><FileText size={16} />PDF</AppButton>
      </div>
      {notice && <div className="notice">{notice}</div>}
    </section>
    <section className="panel service-list-panel rentals-records-section">
      <div className="rentals-section-heading">
        <div>
          <p className="eyebrow">Aktywne</p>
          <h3>Aktywne zlecenia serwisowe</h3>
        </div>
        <span>{activeTableRows.length} pozycji</span>
      </div>
      <div className="client-filter-bar service-filter-bar">
        <label>Szukaj<AppInput value={filters.search ?? ''} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Numer, klient, sprzęt, opis, diagnoza" /></label>
        <label>Status<AppSelect value={filters.status ?? 'all'} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}><option value="all">Wszystkie</option>{serviceStatuses.filter((s) => s !== 'Wydane').map((status) => <option key={status} value={status}>{status}</option>)}</AppSelect></label>
        <label>Priorytet<AppSelect value={filters.priority ?? 'all'} onChange={(event) => setFilters((current) => ({ ...current, priority: event.target.value }))}><option value="all">Wszystkie</option>{servicePriorities.map((priority) => <option key={priority} value={priority}>{priority}</option>)}</AppSelect></label>
        <label>Kategoria<AppSelect value={filters.category ?? 'all'} onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))}><option value="all">Wszystkie</option>{serviceCategoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}</AppSelect></label>
        <AppButton variant="secondary" size="sm" className="compact-button" onClick={clearFilters}>Wyczyść filtry</AppButton>
      </div>
      <DataTable
        storageKey={SERVICE_TABLE_KEY}
        loading={loading}
        columns={serviceColumns}
        rows={filteredRows}
        onOpen={openServiceEditor}
        onEdit={openServiceEditor}
        onDelete={deleteServiceOrder}
        openLabel="Otwórz"
        editLabel="Otwórz kartotekę"
        deleteLabel="Usuń zlecenie"
        customRowActions={[
          { key: 'acceptance', label: 'Utwórz dokument przyjęcia', icon: FileText, onClick: (order) => openServiceDocumentPreview(order, 'acceptance') },
          { key: 'release', label: 'Utwórz dokument wydania', icon: FileText, onClick: (order) => openServiceDocumentPreview(order, 'release') }
        ]}
      />
    </section>
    <section className="panel service-list-panel rentals-records-section service-completed-section">
      <div className="rentals-section-heading">
        <div>
          <p className="eyebrow">Historia</p>
          <h3>Zlecenia zakończone</h3>
        </div>
        <div className="section-export-actions">
          <ButtonSecondary onClick={() => exportTableToCsv(`${SERVICE_TABLE_KEY}-completed`, completedServiceColumns, completedTableRows)} disabled={!completedTableRows.length}><Download size={15} />CSV</ButtonSecondary>
          <ButtonSecondary onClick={() => exportTableToPdf('Historia serwisów', `${SERVICE_TABLE_KEY}-completed`, completedServiceColumns, completedTableRows)} disabled={!completedTableRows.length}><FileText size={15} />PDF</ButtonSecondary>
          <ButtonSecondary onClick={() => setServiceHistoryCollapsed((v) => !v)}>{serviceHistoryCollapsed ? 'Rozwiń' : 'Zwiń'} · {completedTableRows.length}</ButtonSecondary>
        </div>
      </div>
      {!serviceHistoryCollapsed && <DataTable
        storageKey={`${SERVICE_TABLE_KEY}-completed`}
        loading={loading}
        columns={completedServiceColumns}
        rows={completedTableRows}
        onOpen={openServiceEditor}
        onDelete={handleDeleteCompletedServiceOrder}
        openLabel="Podgląd zlecenia"
        deleteLabel="Usuń z historii"
        customRowActions={[
          { key: 'restore', label: 'Przywróć jako aktywne', icon: RotateCcw, onClick: handleRestoreServiceOrder },
          { key: 'acceptance', label: 'Utwórz dokument przyjęcia', icon: FileText, onClick: (order) => openServiceDocumentPreview(order, 'acceptance') },
          { key: 'release', label: 'Utwórz dokument wydania', icon: FileText, onClick: (order) => openServiceDocumentPreview(order, 'release') }
        ]}
      />}
    </section>
    {editorOpen && <ServiceOrderEditor order={editingOrder} clients={clients} equipmentRows={equipmentRows} existingRows={rows} serviceStatuses={serviceStatuses} servicePriorities={servicePriorities} serviceDeviceCategories={serviceDeviceCategories} serviceIntakeConditions={serviceIntakeConditions} serviceExternalServices={serviceExternalServices} serviceProgressTemplates={serviceProgressTemplates} onClose={() => setEditorOpen(false)} onSave={saveServiceOrder} />}
    {confirmDialog && <ConfirmDialog
      title={confirmDialog.title}
      message={confirmDialog.message}
      confirmLabel={confirmDialog.confirmLabel}
      cancelLabel={confirmDialog.cancelLabel}
      variant={confirmDialog.variant}
      onConfirm={confirmDialog.onConfirm}
      onCancel={() => setConfirmDialog(null)}
    />}
    {selectStatusDialog && <SelectStatusDialog
      order={selectStatusDialog.order}
      statuses={serviceStatuses}
      onConfirm={async (newStatus) => {
        setSelectStatusDialog(null);
        const result = await saveServiceOrder({
          ...selectStatusDialog.order,
          status: newStatus,
          completed_date: newStatus === 'Wydane' ? (selectStatusDialog.order.completed_date || getLocalIsoDate()) : selectStatusDialog.order.completed_date
        });
        if (result?.error) setNotice(humanizeError(result.error, 'service'));
      }}
      onCancel={() => setSelectStatusDialog(null)}
    />}
    {serviceDocumentPreview && <DocumentPreviewModal
      html={serviceDocumentPreview.html}
      title={serviceDocumentPreview.title}
      onClose={() => setServiceDocumentPreview(null)}
      onPrint={printServiceDocumentPreview}
      onDownload={printServiceDocumentPreview}
      onGeneratePdf={printServiceDocumentPreview}
    />}
  </div>;
}

function formatServiceDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function parseServiceAmount(value) {
  if (value === '' || value === null || value === undefined) return 0;
  const number = Number(String(value).replace(',', '.'));
  return Number.isFinite(number) ? number : 0;
}

function buildServiceEstimateItems(order) {
  if (Array.isArray(order?.estimate_items) && order.estimate_items.length) {
    return order.estimate_items.map((item) => ({
      id: item.id || crypto.randomUUID(),
      name: String(item.name ?? '').trim(),
      amount: item.amount ?? ''
    })).filter((item) => item.name || String(item.amount ?? '').trim());
  }
  return [
    { name: 'Koszt części', amount: order?.parts_cost },
    { name: 'Koszt robocizny', amount: order?.labor_cost },
    { name: 'Inne koszty', amount: order?.other_cost }
  ].filter((item) => parseServiceAmount(item.amount) > 0).map((item) => ({ ...item, id: crypto.randomUUID() }));
}

function ServiceOrderEditor({ order, clients, equipmentRows, existingRows, serviceStatuses = SERVICE_STATUSES, servicePriorities = SERVICE_PRIORITIES, serviceDeviceCategories = DEFAULT_SERVICE_DEVICE_CATEGORIES, serviceIntakeConditions = DEFAULT_SERVICE_INTAKE_CONDITIONS, serviceExternalServices = DEFAULT_SERVICE_EXTERNAL_SERVICES, serviceProgressTemplates = DEFAULT_SERVICE_PROGRESS_TEMPLATES, onClose, onSave }) {
  const [activeTab, setActiveTab] = useState('basic');
  const [form, setForm] = useState(() => ({
    service_number: order?.service_number || generateServiceNumber(existingRows),
    claim_type: order?.claim_type || 'Pogwarancyjna',
    status: order?.status || serviceStatuses[0] || 'Przyjęte',
    priority: order?.priority || (servicePriorities.includes('Normalny') ? 'Normalny' : servicePriorities[0]) || 'Normalny',
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
    intake_condition: order?.intake_condition || (serviceIntakeConditions.includes('Dobry') ? 'Dobry' : serviceIntakeConditions[0]) || 'Dobry',
    intake_accessories: order?.intake_accessories || '',
    intake_visual_notes: order?.intake_visual_notes || '',
    fault_description: order?.fault_description || '',
    diagnosis: order?.diagnosis || '',
    work_performed: order?.work_performed || '',
    parts_materials: order?.parts_materials || '',
    external_service: order?.external_service || '',
    external_rma_number: order?.external_rma_number || '',
    external_sent_date: order?.external_sent_date || '',
    external_return_date: order?.external_return_date || '',
    external_cost: order?.external_cost ?? '',
    external_notes: order?.external_notes || '',
    labor_cost: order?.labor_cost ?? '',
    parts_cost: order?.parts_cost ?? '',
    other_cost: order?.other_cost ?? '',
    total_cost: order?.total_cost ?? '',
    estimate_items: buildServiceEstimateItems(order),
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
  const [newEstimateItemName, setNewEstimateItemName] = useState('');
  const [newEstimateItemAmount, setNewEstimateItemAmount] = useState('');
  const [formError, setFormError] = useState('');

  const orderId = form.id ?? form.localId;
  const selectedClient = localClients.find((client) => client.id === form.client_id) ?? order?.clients ?? null;
  const selectedEquipment = equipmentRows.find((item) => item.id === form.equipment_id) ?? order?.equipment ?? null;
  const categories = [...new Set([...serviceDeviceCategories, ...equipmentRows.map((item) => item.category).filter(Boolean), form.customer_device_category].filter(Boolean))];
  const conditions = [...new Set([...serviceIntakeConditions, form.intake_condition].filter(Boolean))];
  const externalServices = [...new Set([...serviceExternalServices, form.external_service].filter(Boolean))];
  const calculatedTotal = form.estimate_items.reduce((sum, item) => sum + parseServiceAmount(item.amount), 0);

  const update = (key, value) => {
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === 'estimate_items') next.total_cost = value.reduce((sum, item) => sum + parseServiceAmount(item.amount), 0).toFixed(2);
      if (key === 'status' && value === 'Wydane' && !next.completed_date) next.completed_date = getLocalIsoDate();
      return next;
    });
  };

  const addEstimateItem = () => {
    update('estimate_items', [...form.estimate_items, { id: crypto.randomUUID(), name: '', amount: '' }]);
  };

  const updateEstimateItem = (id, key, value) => {
    update('estimate_items', form.estimate_items.map((item) => item.id === id ? { ...item, [key]: value } : item));
  };

  const removeEstimateItem = (id) => {
    update('estimate_items', form.estimate_items.filter((item) => item.id !== id));
  };

  const commitNewEstimateItem = () => {
    if (!newEstimateItemName.trim() || !String(newEstimateItemAmount).trim()) return;
    update('estimate_items', [...form.estimate_items, { id: crypto.randomUUID(), name: newEstimateItemName.trim(), amount: newEstimateItemAmount }]);
    setNewEstimateItemName('');
    setNewEstimateItemAmount('');
  };

  const loadProgress = async () => {
    if (!orderId) return;
    const { data, error, local } = await fetchServiceOrderProgress(orderId);
    if (error) {
      setProgressNotice(`Nie udało się pobrać postępów z Supabase: ${error.message}`);
      return;
    }
    setProgressRows(data ?? []);
    setProgressNotice('');
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
      alert(humanizeError(result.error, 'client'));
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

  const submit = async () => {
    setFormError('');
    if (!String(form.service_number ?? '').trim()) {
      setFormError('Numer zlecenia jest wymagany.');
      return;
    }
    if (!String(form.customer_device_name ?? '').trim() && !form.equipment_id) {
      setFormError('Podaj nazwę serwisowanego urządzenia albo wybierz powiązany sprzęt z bazy.');
      return;
    }
    if (!String(form.fault_description ?? '').trim()) {
      setFormError('Opis usterki jest wymagany.');
      return;
    }
    const result = await onSave({ ...order, ...form, total_cost: calculatedTotal.toFixed(2) });
    if (result?.error) {
      setFormError(humanizeError(result.error, 'service'));
    }
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
    setProgressNotice('');
    await loadProgress();
  };

  const addProgressTemplate = async (template) => {
    if (!orderId) {
      setProgressNotice('Najpierw zapisz zlecenie, potem dodaj wpis z szablonu.');
      return;
    }
    const { error, local } = await createServiceOrderProgress(orderId, template, demoUser.name);
    if (error) {
      setProgressNotice(`Nie udało się zapisać wpisu z szablonu w Supabase: ${error.message}`);
      return;
    }
    setProgressNotice('');
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
    setProgressNotice('');
    await loadProgress();
  };

  const removeProgress = async (entry) => {
    if (!confirm('Usunąć wpis postępu?')) return;
    const { error, local } = await deleteServiceOrderProgress(entry.id ?? entry.localId, entry);
    if (error) {
      setProgressNotice(`Nie udało się usunąć wpisu w Supabase: ${error.message}`);
      return;
    }
    setProgressNotice('');
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
    { id: 'external', label: 'Serwis zewnętrzny' },
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
    {formError && <AppNotice variant="error" className="service-form-notice">{formError}</AppNotice>}
    <div className="service-document-strip">
      <FormField label="Numer zlecenia"><AppInput value={form.service_number} onChange={(event) => update('service_number', event.target.value)} /></FormField>
      <FormField label="Typ zgłoszenia"><AppSelect value={form.claim_type} onChange={(event) => update('claim_type', event.target.value)}><option>Gwarancyjna</option><option>Pogwarancyjna</option></AppSelect></FormField>
      <FormField label="Status"><AppSelect value={form.status} onChange={(event) => update('status', event.target.value)}>{serviceStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</AppSelect></FormField>
      <FormField label="Priorytet"><AppSelect value={form.priority} onChange={(event) => update('priority', event.target.value)}>{servicePriorities.map((priority) => <option key={priority} value={priority}>{priority}</option>)}</AppSelect></FormField>
      <FormField label="Data przyjęcia"><AppInput type="date" value={form.accepted_date} onChange={(event) => update('accepted_date', event.target.value)} /></FormField>
      <FormField label="Planowany termin"><AppInput type="date" value={form.planned_date || ''} onChange={(event) => update('planned_date', event.target.value)} /></FormField>
      <FormField label="Data zakończenia"><AppInput type="date" value={form.completed_date || ''} onChange={(event) => update('completed_date', event.target.value)} /></FormField>
    </div>
    <div className="service-order-tabs" role="tablist" aria-label="Sekcje zlecenia serwisowego">
      {tabs.map((tab) => <button key={tab.id} type="button" className={activeTab === tab.id ? 'active' : ''} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>)}
    </div>
    <div className="service-order-tab-panel">
      {activeTab === 'basic' && <div className="service-tab-content service-tab-basic">
        <SectionPanel className="service-record-section" title="Klient i sprzęt klienta">
          <div className="service-customer-device-grid">
            <div className="service-link-row">
              <ClientChoiceCard client={selectedClient} onClick={() => setClientPickerOpen(true)} className="service-client-chip" />
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
              <FormField label="Akcesoria"><AppTextarea resizeKey="fixer:textarea:service:intake_accessories" value={form.intake_accessories} onChange={(event) => update('intake_accessories', event.target.value)} placeholder="np. zasilacz, futerał, karta pamięci" /></FormField>
              <FormField label="Opis wizualny / uwagi"><AppTextarea resizeKey="fixer:textarea:service:intake_visual_notes" value={form.intake_visual_notes} onChange={(event) => update('intake_visual_notes', event.target.value)} placeholder="np. rysy na obudowie, brak zaślepki, ślady zalania" /></FormField>
            </div>
          </div>
        </SectionPanel>
        <SectionPanel className="service-record-section service-fault-section" title="Opis usterki">
          <FormField label="Opis usterki"><AppTextarea resizeKey="fixer:textarea:service:fault_description" value={form.fault_description} onChange={(event) => update('fault_description', event.target.value)} placeholder="Co zgłasza klient / operator?" /></FormField>
        </SectionPanel>
      </div>}

      {activeTab === 'external' && <div className="service-tab-content">
        <SectionPanel className="service-record-section service-external-section" title="Obsługa zewnętrzna">
          <div className="service-external-grid">
            <FormField label="Serwis zewnętrzny"><AppSelect value={form.external_service} onChange={(event) => update('external_service', event.target.value)}><option value="">Brak</option>{externalServices.map((service) => <option key={service} value={service}>{service}</option>)}</AppSelect></FormField>
            <FormField label="Numer zgłoszenia / RMA"><AppInput value={form.external_rma_number} onChange={(event) => update('external_rma_number', event.target.value)} /></FormField>
            <FormField label="Data wysłania"><AppInput type="date" value={form.external_sent_date || ''} onChange={(event) => update('external_sent_date', event.target.value)} /></FormField>
            <FormField label="Data powrotu"><AppInput type="date" value={form.external_return_date || ''} onChange={(event) => update('external_return_date', event.target.value)} /></FormField>
            <FormField label="Koszt zewnętrzny"><div className="money-input"><AppInput value={form.external_cost} onChange={(event) => update('external_cost', event.target.value)} placeholder="0,00" /><span>zł</span></div></FormField>
            <FormField className="service-external-notes-field" label="Uwagi do serwisu zewnętrznego"><AppTextarea resizeKey="fixer:textarea:service:external_notes" value={form.external_notes} onChange={(event) => update('external_notes', event.target.value)} /></FormField>
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

      {activeTab === 'estimate' && <div className="service-tab-content">
        <SectionPanel className="service-record-section" title="Kosztorys">
          <div className="service-estimate-list">
            <div className="service-estimate-add-bar">
              <AppInput value={newEstimateItemName} onChange={(event) => setNewEstimateItemName(event.target.value)} placeholder="Nazwa pozycji" onKeyDown={(e) => e.key === 'Enter' && commitNewEstimateItem()} />
              <div className="money-input"><AppInput value={newEstimateItemAmount} onChange={(event) => setNewEstimateItemAmount(event.target.value)} placeholder="0,00" onKeyDown={(e) => e.key === 'Enter' && commitNewEstimateItem()} /><span>zł</span></div>
              <AppButton variant="secondary" size="sm" onClick={commitNewEstimateItem} disabled={!newEstimateItemName.trim() || !String(newEstimateItemAmount).trim()}>Dodaj</AppButton>
            </div>
            <div className="service-estimate-items">
              {form.estimate_items.map((item) => <div className="service-estimate-item-row" key={item.id}>
                <span className="service-estimate-item-name">{item.name}</span>
                <span className="service-estimate-item-amount">{formatServiceMoney(item.amount)}</span>
                <button type="button" className="ghost-mini-button" onClick={() => removeEstimateItem(item.id)}>Usuń</button>
              </div>)}
              {!form.estimate_items.length && <p className="muted">Brak pozycji kosztorysu.</p>}
            </div>
            <div className="service-estimate-footer">
              <FormField label="Status kosztorysu"><AppSelect value={form.estimate_status} onChange={(event) => update('estimate_status', event.target.value)}>{SERVICE_ESTIMATE_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</AppSelect></FormField>
              <div className="service-total-box"><span>Koszt końcowy / suma</span><strong>{formatServiceMoney(calculatedTotal)}</strong></div>
            </div>
          </div>
        </SectionPanel>
      </div>}

      {activeTab === 'notes' && <div className="service-tab-content">
        <SectionPanel className="service-record-section" title="Notatki wewnętrzne">
          <FormField label="Notatki operatora"><AppTextarea resizeKey="fixer:textarea:service:internal_notes" className="large-notes" value={form.internal_notes} onChange={(event) => update('internal_notes', event.target.value)} placeholder="Wewnętrzne informacje dla obsługi. Nie mieszać z postępami serwisowymi." /></FormField>
        </SectionPanel>
        <SectionPanel className="service-record-section" title="Zdjęcia i załączniki">
          <div className="attachment-add-grid service-attachment-add-grid">
            <AppInput value={newAttachmentName} onChange={(event) => setNewAttachmentName(event.target.value)} placeholder="Nazwa zdjęcia / załącznika" />
            <AppInput value={newAttachmentUrl} onChange={(event) => setNewAttachmentUrl(event.target.value)} placeholder="Link, opis lub identyfikator pliku" />
            <AppSelect value={newAttachmentType} onChange={(event) => setNewAttachmentType(event.target.value)}><option>Zdjęcie</option><option>Protokół</option><option>Inny</option></AppSelect>
            <AppButton variant="secondary" size="sm" onClick={addAttachment}>Dodaj</AppButton>
          </div>
          <div className="equipment-list-box">
            {form.attachments.length ? form.attachments.map((item, index) => <div key={`${item.name}-${index}`} className="equipment-list-row"><span><strong>{item.type || 'Załącznik'}:</strong> {item.name || item.url}{item.url && item.name ? ` — ${item.url}` : ''}</span><button type="button" className="ghost-mini-button" onClick={() => removeAttachment(index)}>Usuń</button></div>) : <p className="muted">Możesz zapisać opis, link lub numer dokumentu.</p>}
          </div>
        </SectionPanel>
      </div>}
    </div>
  </ResizableModalFrame>;
}
const CALENDAR_VIEW_STORAGE_KEY = 'fixer-calendar-view';
const CALENDAR_SOURCES_STORAGE_KEY = 'fixer-calendar-sources';
const CALENDAR_ACTIVE_SOURCES_STORAGE_KEY = 'fixer.calendar.activeSources';
const CALENDAR_SOURCE_SETTINGS_STORAGE_KEY = 'fixer.calendar.sourceSettings';
const CALENDAR_SOURCES = [
  { id: 'organizer', label: 'Zadania' },
  { id: 'projects', label: 'Projekty' },
  { id: 'rentals', label: 'Wypożyczenia' },
  { id: 'service', label: 'Serwis' },
  { id: 'manual', label: 'Ręczne' }
];
const DEFAULT_CALENDAR_SOURCE_COLORS = {
  organizer: '#3b82f6',
  projects: '#6366f1',
  rentals: '#0ea5e9',
  service: '#8b5cf6',
  manual: '#14b8a6'
};
const CALENDAR_VIEWS = [
  { id: 'day', label: 'Dzień', icon: Clock },
  { id: 'week', label: 'Tydzień', icon: Columns3 },
  { id: 'month', label: 'Miesiąc', icon: Grid3X3 },
  { id: 'agenda', label: 'Agenda', icon: List }
];
const CALENDAR_EXPORT_TABLE_KEY = 'calendar-agenda-table';
const CALENDAR_EXPORT_COLUMNS = [
  { key: 'date_display', label: 'Data' },
  { key: 'sourceLabel', label: 'Źródło' },
  { key: 'title', label: 'Tytuł' },
  { key: 'typeLabel', label: 'Typ' },
  { key: 'subtitle', label: 'Opis' },
  { key: 'statusLabel', label: 'Status' }
];

function getCalendarSettings() {
  const defaultSources = getDefaultCalendarSources();
  const activeSources = getStoredJson(CALENDAR_ACTIVE_SOURCES_STORAGE_KEY, null);
  const legacySources = getStoredJson(CALENDAR_SOURCES_STORAGE_KEY, null);
  return {
    view: localStorage.getItem(CALENDAR_VIEW_STORAGE_KEY) || 'week',
    sources: { ...defaultSources, ...(activeSources ?? legacySources ?? {}) },
    sourceSettings: getCalendarSourceSettings()
  };
}

function getCalendarSourceSettings() {
  const saved = getStoredJson(CALENDAR_SOURCE_SETTINGS_STORAGE_KEY, {});
  return Object.fromEntries(CALENDAR_SOURCES.map((source) => {
    const current = saved?.[source.id] ?? {};
    return [source.id, {
      sourceId: source.id,
      label: source.label,
      enabledByDefault: current.enabledByDefault !== false,
      color: current.color || DEFAULT_CALENDAR_SOURCE_COLORS[source.id] || '#64748b'
    }];
  }));
}

function saveCalendarSourceSettings(settings) {
  const normalized = Object.fromEntries(CALENDAR_SOURCES.map((source) => {
    const current = settings?.[source.id] ?? {};
    return [source.id, {
      sourceId: source.id,
      label: source.label,
      enabledByDefault: current.enabledByDefault !== false,
      color: current.color || DEFAULT_CALENDAR_SOURCE_COLORS[source.id] || '#64748b'
    }];
  }));
  localStorage.setItem(CALENDAR_SOURCE_SETTINGS_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

function getDefaultCalendarSources(settings = getCalendarSourceSettings()) {
  return Object.fromEntries(CALENDAR_SOURCES.map((source) => [source.id, settings?.[source.id]?.enabledByDefault !== false]));
}

function toCalendarDate(value) {
  if (!value) return null;
  const text = String(value);
  const date = text.includes('T') ? new Date(text) : new Date(`${text.slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toIsoDateValue(date) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function addCalendarDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getMonday(date) {
  const next = new Date(date);
  const day = next.getDay() || 7;
  next.setDate(next.getDate() - day + 1);
  next.setHours(0, 0, 0, 0);
  return next;
}

function isSameCalendarDay(left, right) {
  return toIsoDateValue(left) === toIsoDateValue(right);
}

function getCalendarRange(anchorDate, view) {
  const anchor = toCalendarDate(anchorDate) ?? new Date();
  if (view === 'day') {
    const start = new Date(anchor); start.setHours(0, 0, 0, 0);
    return { start, end: addCalendarDays(start, 1) };
  }
  if (view === 'month') {
    const monthStart = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const start = getMonday(monthStart);
    const end = addCalendarDays(start, 42);
    return { start, end };
  }
  if (view === 'agenda') {
    const start = new Date(anchor); start.setHours(0, 0, 0, 0);
    return { start, end: addCalendarDays(start, 45) };
  }
  const start = getMonday(anchor);
  return { start, end: addCalendarDays(start, 7) };
}

function formatCalendarRange(anchorDate, view) {
  const { start, end } = getCalendarRange(anchorDate, view);
  if (view === 'day') return start.toLocaleDateString('pl-PL', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  const last = addCalendarDays(end, -1);
  return `${start.toLocaleDateString('pl-PL', { day: '2-digit', month: 'short' })} - ${last.toLocaleDateString('pl-PL', { day: '2-digit', month: 'short', year: 'numeric' })}`;
}

function getCalendarEventColor(event, statusColors = getStatusColors(), sourceSettings = getCalendarSourceSettings()) {
  const statusKey = String(event.statusLabel ?? '').toLowerCase();
  if (statusColors[statusKey]) return statusColors[statusKey];
  if (event.source === 'rentals') return statusColors['aktywne'] ?? sourceSettings?.rentals?.color ?? '#3b82f6';
  if (event.source === 'service') return statusColors['serwis'] ?? sourceSettings?.service?.color ?? '#6366f1';
  if (event.source === 'organizer') return statusColors['do zrobienia'] ?? sourceSettings?.organizer?.color ?? '#3b82f6';
  if (event.source === 'projects') return statusColors['planowany'] ?? sourceSettings?.projects?.color ?? '#6366f1';
  return event.color || sourceSettings?.[event.source]?.color || '#14b8a6';
}

function buildCalendarEvents({ organizerRows = [], projectRows = [], projectTaskRows = [], rentalsRows = [], serviceRows = [], manualRows = [] }) {
  const push = (events, event) => {
    const start = toCalendarDate(event.start);
    if (!start) return;
    events.push({ ...event, start, dateKey: toIsoDateValue(start), id: event.id });
  };
  const events = [];

  organizerRows.filter((task) => !task.archived).forEach((task) => {
    const recordId = task.id ?? task.localId;
    if (task.due_date) push(events, {
      id: `organizer:due:${recordId}`,
      source: 'organizer',
      sourceId: recordId,
      sourceRecord: task,
      sourceLabel: 'Zadania i projekty',
      title: task.title,
      subtitle: task.category || task.priority || '',
      start: task.due_date,
      statusLabel: task.status,
      typeLabel: 'Termin zadania'
    });
    if (task.reminder_at) push(events, {
      id: `organizer:reminder:${recordId}`,
      source: 'organizer',
      sourceId: recordId,
      sourceRecord: task,
      sourceLabel: 'Zadania i projekty',
      title: `Przypomnienie: ${task.title}`,
      subtitle: task.category || task.priority || '',
      start: task.reminder_at,
      statusLabel: task.status,
      typeLabel: 'Przypomnienie'
    });
  });

  projectRows.filter((project) => !project.archived).forEach((project) => {
    const recordId = project.id ?? project.localId;
    if (project.due_date) push(events, {
      id: `projects:due:${recordId}`,
      source: 'projects',
      sourceId: recordId,
      sourceRecord: project,
      sourceLabel: 'Projekty',
      title: project.name || project.project_number || 'Projekt',
      subtitle: project.clients?.name || project.priority || '',
      start: project.due_date,
      statusLabel: project.status,
      typeLabel: 'Termin projektu'
    });
  });

  projectTaskRows.filter((task) => !task.archived).forEach((task) => {
    const recordId = task.id ?? task.localId;
    if (task.due_date) push(events, {
      id: `project-task:due:${recordId}`,
      source: 'projects',
      sourceId: task.project_id,
      sourceRecord: task,
      sourceLabel: 'Projekty',
      title: task.title,
      subtitle: task.priority || '',
      start: task.due_date,
      statusLabel: task.status,
      typeLabel: 'Termin zadania projektu'
    });
    if (task.reminder_at) push(events, {
      id: `project-task:reminder:${recordId}`,
      source: 'projects',
      sourceId: task.project_id,
      sourceRecord: task,
      sourceLabel: 'Projekty',
      title: `Przypomnienie: ${task.title}`,
      subtitle: task.priority || '',
      start: task.reminder_at,
      statusLabel: task.status,
      typeLabel: 'Przypomnienie zadania'
    });
  });

  rentalsRows.filter((rental) => rental.status !== 'returned').forEach((rental) => {
    if (rental.start_date) push(events, {
      id: `rentals:start:${rental.id}`,
      source: 'rentals',
      sourceId: rental.id,
      sourceRecord: rental,
      sourceLabel: 'Wypożyczenia',
      title: `Wydanie ${rental.rental_number || ''}`.trim(),
      subtitle: rental.clients?.name || '',
      start: rental.start_date,
      statusLabel: formatRentalStatus(rental.status),
      typeLabel: 'Planowane wydanie'
    });
    if (rental.planned_return_date) push(events, {
      id: `rentals:return:${rental.id}`,
      source: 'rentals',
      sourceId: rental.id,
      sourceRecord: rental,
      sourceLabel: 'Wypożyczenia',
      title: `Zwrot ${rental.rental_number || ''}`.trim(),
      subtitle: rental.clients?.name || '',
      start: rental.planned_return_date,
      statusLabel: getRentalOverdueDays(rental) ? 'Po terminie' : formatRentalStatus(rental.status),
      typeLabel: 'Planowany zwrot'
    });
  });

  serviceRows.forEach((order) => {
    const isClosed = order.status === 'Wydane' || order.status === 'Anulowane';
    if (order.planned_date && !isClosed) push(events, {
      id: `service:planned:${order.id}`,
      source: 'service',
      sourceId: order.id,
      sourceRecord: order,
      sourceLabel: 'Serwis',
      title: `Serwis ${order.service_number || ''}`.trim(),
      subtitle: order.customer_device_name || order.equipment?.name || '',
      start: order.planned_date,
      statusLabel: order.status,
      typeLabel: 'Planowany termin'
    });
    if (order.completed_date) push(events, {
      id: `service:completed:${order.id}`,
      source: 'service',
      sourceId: order.id,
      sourceRecord: order,
      sourceLabel: 'Serwis',
      title: `Zakończenie ${order.service_number || ''}`.trim(),
      subtitle: order.customer_device_name || '',
      start: order.completed_date,
      statusLabel: order.status,
      typeLabel: 'Data zakończenia'
    });
    if (order.external_service && order.external_return_date && !isClosed) push(events, {
      id: `service:external-return:${order.id}`,
      source: 'service',
      sourceId: order.id,
      sourceRecord: order,
      sourceLabel: 'Serwis',
      title: `Powrót z ${order.external_service}`,
      subtitle: order.service_number || order.customer_device_name || '',
      start: order.external_return_date,
      statusLabel: order.status,
      typeLabel: 'Serwis zewnętrzny'
    });
  });

  manualRows.forEach((event) => push(events, {
    id: `manual:${event.id ?? event.localId}`,
    source: 'manual',
    sourceId: event.id ?? event.localId,
    sourceRecord: event,
    sourceLabel: 'Ręczne',
    title: event.title,
    subtitle: event.location || event.description || '',
    start: event.start_at,
    end: event.end_at,
    color: event.color,
    statusLabel: 'Ręczne',
    typeLabel: 'Wydarzenie ręczne'
  }));

  return events.sort((left, right) => left.start - right.start || left.title.localeCompare(right.title, 'pl'));
}

function CalendarManualEventEditor({ event, initialDate, onClose, onSave, onDelete }) {
  const [form, setForm] = useState(() => ({
    title: event?.title ?? '',
    description: event?.description ?? '',
    start_at: event?.start_at ? String(event.start_at).slice(0, 16) : `${initialDate || getLocalIsoDate()}T09:00`,
    end_at: event?.end_at ? String(event.end_at).slice(0, 16) : '',
    all_day: event?.all_day !== false,
    location: event?.location ?? '',
    color: event?.color ?? '#14b8a6'
  }));
  const [formError, setFormError] = useState('');
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const submit = () => {
    if (!form.title.trim()) { setFormError('Tytuł wydarzenia jest wymagany.'); return; }
    setFormError('');
    onSave({ ...event, ...form, start_at: form.start_at ? new Date(form.start_at).toISOString() : null, end_at: form.end_at ? new Date(form.end_at).toISOString() : null });
  };

  return <ResizableModalFrame
    className="calendar-event-modal"
    storageKey="fixer-calendar-event-modal"
    defaultSize={{ width: 680, height: 500 }}
    minSize={{ width: 520, height: 420 }}
    eyebrow="Kalendarz"
    title={event ? 'Wydarzenie ręczne' : 'Nowe wydarzenie'}
    onClose={onClose}
    footer={<><ButtonSecondary onClick={onClose}>Anuluj</ButtonSecondary>{event && <ButtonSecondary className="danger-action" onClick={() => onDelete(event)}><Trash2 size={15} />Usuń</ButtonSecondary>}<ButtonPrimary onClick={submit}><Save size={16} />Zapisz</ButtonPrimary></>}
  >
    <div className="calendar-event-form">
      {formError && <AppNotice variant="error" className="service-form-notice">{formError}</AppNotice>}
      <FormField label="Tytuł *"><AppInput value={form.title} onChange={(event) => update('title', event.target.value)} /></FormField>
      <div className="calendar-event-form-row">
        <FormField label="Start"><AppInput type="datetime-local" value={form.start_at} onChange={(event) => update('start_at', event.target.value)} /></FormField>
        <FormField label="Koniec"><AppInput type="datetime-local" value={form.end_at} onChange={(event) => update('end_at', event.target.value)} /></FormField>
      </div>
      <div className="calendar-event-form-row calendar-event-compact-row">
        <FormField label="Miejsce"><AppInput value={form.location} onChange={(event) => update('location', event.target.value)} /></FormField>
        <FormField label="Kolor"><AppInput type="color" value={form.color} onChange={(event) => update('color', event.target.value)} /></FormField>
      </div>
      <FormField label="Opis"><AppTextarea resizeKey="fixer:textarea:calendar:description" value={form.description} onChange={(event) => update('description', event.target.value)} /></FormField>
      <label className="settings-check calendar-all-day-check"><input type="checkbox" checked={form.all_day} onChange={(event) => update('all_day', event.target.checked)} />Wydarzenie całodniowe</label>
    </div>
  </ResizableModalFrame>;
}

function CalendarModule({ dashboardIntent, onConsumeDashboardIntent, onNavigate }) {
  const settings = getCalendarSettings();
  const [view, setView] = useState(CALENDAR_VIEWS.some((item) => item.id === settings.view) ? settings.view : 'week');
  const [anchorDate, setAnchorDate] = useState(getLocalIsoDate());
  const [sources, setSources] = useState(settings.sources);
  const [sourceSettings, setSourceSettings] = useState(settings.sourceSettings);
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false);
  const [filters, setFilters] = useStoredState('fixer-calendar-filters', { type: 'all', status: 'all' });
  const [organizerRows, setOrganizerRows] = useState([]);
  const [rentalsRows, setRentalsRows] = useState([]);
  const [serviceRows, setServiceRows] = useState([]);
  const [projectRows, setProjectRows] = useState([]);
  const [projectTaskRows, setProjectTaskRows] = useState([]);
  const [manualRows, setManualRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [editingManualEvent, setEditingManualEvent] = useState(null);
  const [newEventDate, setNewEventDate] = useState(null);
  const [pendingOpenCalendarEventId, setPendingOpenCalendarEventId] = useState(null);
  const statusColors = getStatusColors();

  const loadCalendar = async () => {
    setLoading(true);
    const [organizerResult, rentalsResult, serviceResult, projectsResult, projectTasksResult, manualResult] = await Promise.all([
      fetchOrganizerTasks(),
      fetchRentals(),
      fetchServiceOrders(),
      fetchProjects(),
      fetchAllProjectTasks(),
      fetchCalendarManualEvents()
    ]);
    setOrganizerRows(organizerResult.data ?? []);
    setRentalsRows(rentalsResult.data ?? []);
    setServiceRows(serviceResult.data ?? []);
    setProjectRows(projectsResult.data ?? []);
    setProjectTaskRows(projectTasksResult.data ?? []);
    setManualRows(manualResult.data ?? []);
    const errors = [organizerResult.error ? 'Zadania' : '', rentalsResult.error ? 'Wypożyczenia' : '', serviceResult.error ? 'Serwis' : '', projectsResult.error ? 'Projekty' : '', manualResult.error ? 'Kalendarz' : ''].filter(Boolean);
    setNotice(errors.length ? `Nie udało się pobrać danych: ${errors.join(', ')}.` : '');
    setLoading(false);
  };

  useEffect(() => { loadCalendar(); }, []);

  useEffect(() => {
    const onStorage = (event) => {
      if (event.key !== CALENDAR_SOURCE_SETTINGS_STORAGE_KEY) return;
      const nextSettings = getCalendarSourceSettings();
      setSourceSettings(nextSettings);
      if (!localStorage.getItem(CALENDAR_ACTIVE_SOURCES_STORAGE_KEY)) setSources(getDefaultCalendarSources(nextSettings));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    if (!filterPopoverOpen) return undefined;
    const close = (event) => {
      if (event.type === 'keydown' && event.key !== 'Escape') return;
      setFilterPopoverOpen(false);
    };
    window.addEventListener('click', close);
    window.addEventListener('keydown', close);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('keydown', close);
    };
  }, [filterPopoverOpen]);

  useEffect(() => {
    if (dashboardIntent?.type !== 'calendar') return;
    if (dashboardIntent.eventId) setPendingOpenCalendarEventId(dashboardIntent.eventId);
    onConsumeDashboardIntent?.();
  }, [dashboardIntent, onConsumeDashboardIntent]);

  useEffect(() => {
    if (!pendingOpenCalendarEventId || !manualRows.length) return;
    const event = manualRows.find((row) => String(row.id ?? row.localId) === String(pendingOpenCalendarEventId));
    if (event) setEditingManualEvent(event);
    setPendingOpenCalendarEventId(null);
  }, [pendingOpenCalendarEventId, manualRows]);

  const changeView = (nextView) => {
    setView(nextView);
    localStorage.setItem(CALENDAR_VIEW_STORAGE_KEY, nextView);
  };
  const toggleSource = (sourceId) => {
    setSources((current) => {
      const next = { ...current, [sourceId]: !current[sourceId] };
      localStorage.setItem(CALENDAR_ACTIVE_SOURCES_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const allEvents = useMemo(() => buildCalendarEvents({ organizerRows, projectRows, projectTaskRows, rentalsRows, serviceRows, manualRows }), [organizerRows, projectRows, projectTaskRows, rentalsRows, serviceRows, manualRows]);
  const { start, end } = getCalendarRange(anchorDate, view);
  const calendarFilterOptions = useMemo(() => ({
    types: [...new Set(allEvents.map((event) => event.typeLabel).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pl')),
    statuses: [...new Set(allEvents.map((event) => event.statusLabel).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pl'))
  }), [allEvents]);
  const visibleEvents = allEvents.filter((event) => {
    if (sources[event.source] === false || event.start < start || event.start >= end) return false;
    if ((filters.type ?? 'all') !== 'all' && event.typeLabel !== filters.type) return false;
    if ((filters.status ?? 'all') !== 'all' && event.statusLabel !== filters.status) return false;
    return true;
  });
  const visibleEventRows = visibleEvents.map((event) => ({
    ...event,
    date_display: formatServiceDateTime(event.start)
  }));
  const days = Array.from({ length: Math.round((end - start) / (24 * 60 * 60 * 1000)) }, (_, index) => addCalendarDays(start, index));
  const eventsByDay = (day) => visibleEvents.filter((event) => event.dateKey === toIsoDateValue(day));

  const move = (direction) => {
    const current = toCalendarDate(anchorDate) ?? new Date();
    const next = view === 'month' ? new Date(current.getFullYear(), current.getMonth() + direction, 1) : addCalendarDays(current, direction * (view === 'day' ? 1 : view === 'agenda' ? 14 : 7));
    setAnchorDate(toIsoDateValue(next));
  };

  const openEvent = (event) => {
    if (event.source === 'manual') { setEditingManualEvent(event.sourceRecord); return; }
    if (event.source === 'organizer') onNavigate('projects', { type: 'projects', taskId: event.sourceId });
    if (event.source === 'rentals') onNavigate('rentals', { type: 'rentals', filter: 'open', rentalId: event.sourceId });
    if (event.source === 'service') onNavigate('service', { type: 'service', serviceOrderId: event.sourceId });
    if (event.source === 'projects') onNavigate('projects', { type: 'projects', projectId: event.sourceId });
  };
  const openDay = (day) => {
    setAnchorDate(toIsoDateValue(day));
    changeView('day');
  };

  const saveManualEvent = async (event) => {
    const result = event.id || event.localId
      ? await updateCalendarManualEvent(event.id ?? event.localId, event)
      : await createCalendarManualEvent(event);
    if (result.error) { setNotice(humanizeError(result.error, 'calendar')); return; }
    setEditingManualEvent(null);
    setNewEventDate(null);
    await loadCalendar();
  };

  const removeManualEvent = async (event) => {
    setConfirmDialog({
      title: 'Usuń wydarzenie',
      message: `Usunąć wydarzenie: ${event.title}?`,
      confirmLabel: 'Usuń',
      cancelLabel: 'Anuluj',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmDialog(null);
        const { error } = await deleteCalendarManualEvent(event.id ?? event.localId, event);
        if (error) { setNotice(humanizeError(error, 'calendar')); return; }
        setEditingManualEvent(null);
        await loadCalendar();
      }
    });
  };

  const renderEvent = (event) => {
    const color = getCalendarEventColor(event, statusColors, sourceSettings);
    return <button key={event.id} type="button" className={`calendar-event calendar-event-${event.source}`} style={{ '--event-color': color }} onClick={() => openEvent(event)} title={`${event.sourceLabel}: ${event.title}`}>
      <span>{event.title}</span>
      <small>{event.typeLabel}</small>
    </button>;
  };

  const renderGrid = () => <div className={`calendar-grid calendar-grid-${view}`}>
    {days.map((day) => {
      const dayEvents = eventsByDay(day);
      const visibleDayEvents = view === 'month' ? dayEvents.slice(0, 4) : dayEvents;
      const hiddenDayEvents = dayEvents.length - visibleDayEvents.length;
      const outsideMonth = view === 'month' && day.getMonth() !== (toCalendarDate(anchorDate) ?? new Date()).getMonth();
      return <div key={toIsoDateValue(day)} className={`calendar-day-cell ${isSameCalendarDay(day, new Date()) ? 'today' : ''} ${outsideMonth ? 'outside-month' : ''}`} onDoubleClick={() => setNewEventDate(toIsoDateValue(day))}>
        <div className="calendar-day-head"><strong>{day.toLocaleDateString('pl-PL', { weekday: view === 'month' ? 'short' : 'long' })}</strong><span>{day.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' })}</span></div>
        <div className="calendar-day-events">{visibleDayEvents.map(renderEvent)}{hiddenDayEvents > 0 && <button type="button" className="calendar-more-events" onClick={() => openDay(day)}>+{hiddenDayEvents} więcej</button>}{!dayEvents.length && <span className="calendar-empty-slot">+ Dodaj</span>}</div>
      </div>;
    })}
  </div>;

  const renderAgenda = () => <div className="calendar-agenda">
    {days.map((day) => {
      const dayEvents = eventsByDay(day);
      if (!dayEvents.length) return null;
      return <div className="calendar-agenda-day" key={toIsoDateValue(day)}>
        <div className="calendar-agenda-date"><strong>{day.toLocaleDateString('pl-PL', { weekday: 'long' })}</strong><span>{day.toLocaleDateString('pl-PL', { day: '2-digit', month: 'long', year: 'numeric' })}</span></div>
        <div className="calendar-agenda-events">{dayEvents.map(renderEvent)}</div>
      </div>;
    })}
    {!visibleEvents.length && <EmptyState title="Brak wydarzeń w wybranym zakresie." description="Dwuklik w widoku dnia, tygodnia lub miesiąca doda wydarzenie ręczne." />}
  </div>;

  const activeSourceCount = CALENDAR_SOURCES.filter((source) => sources[source.id] !== false).length;
  const sourceSummary = activeSourceCount === CALENDAR_SOURCES.length ? 'Wszystkie' : `${activeSourceCount}/${CALENDAR_SOURCES.length}`;
  const activeFilterCount = (activeSourceCount !== CALENDAR_SOURCES.length ? 1 : 0)
    + ((filters.type ?? 'all') !== 'all' ? 1 : 0)
    + ((filters.status ?? 'all') !== 'all' ? 1 : 0);
  const clearCalendarFilters = () => {
    const nextSources = Object.fromEntries(CALENDAR_SOURCES.map((source) => [source.id, true]));
    setSources(nextSources);
    localStorage.setItem(CALENDAR_ACTIVE_SOURCES_STORAGE_KEY, JSON.stringify(nextSources));
    setFilters({ type: 'all', status: 'all' });
  };

  return <div className="calendar-page">
    <section className="panel calendar-toolbar-panel">
      <div className="calendar-toolbar">
        <div className="calendar-toolbar-left">
          <div className="calendar-nav">
            <div className="calendar-nav-controls">
              <ButtonSecondary onClick={() => move(-1)} aria-label="Poprzedni zakres">‹</ButtonSecondary>
              <ButtonPrimary onClick={() => setAnchorDate(getLocalIsoDate())}>Dzisiaj</ButtonPrimary>
              <ButtonSecondary onClick={() => move(1)} aria-label="Następny zakres">›</ButtonSecondary>
            </div>
            <strong>{formatCalendarRange(anchorDate, view)}</strong>
          </div>
          <ButtonPrimary className="calendar-new-event-button" onClick={() => setNewEventDate(getLocalIsoDate())}><Plus size={16} />Nowe wydarzenie</ButtonPrimary>
        </div>
        <div className="calendar-toolbar-center">
          <div className="calendar-view-switch">{CALENDAR_VIEWS.map((item) => {
            const Icon = item.icon;
            return <button key={item.id} type="button" className={view === item.id ? 'active' : ''} onClick={() => changeView(item.id)} title={item.label}><Icon size={15} /><span>{item.label}</span></button>;
          })}</div>
        </div>
        <div className="calendar-toolbar-right">
          <div className="calendar-filter-popover-shell" onClick={(event) => event.stopPropagation()}>
            <ButtonSecondary className={`calendar-filter-button ${filterPopoverOpen ? 'active' : ''}`} onClick={() => setFilterPopoverOpen((value) => !value)} aria-expanded={filterPopoverOpen}>
              Filtry{activeFilterCount > 0 ? ` • ${activeFilterCount}` : ''}<ChevronDown size={14} />
            </ButtonSecondary>
            {filterPopoverOpen && <div className="calendar-filter-popover">
              <label className="calendar-filter-popover-field">
                <span>Źródła</span>
                <div className="calendar-source-menu-list">
                  {CALENDAR_SOURCES.map((source) => <label key={source.id}>
                    <input type="checkbox" checked={sources[source.id] !== false} onChange={() => toggleSource(source.id)} />
                    <span className="calendar-source-dot" style={{ background: sourceSettings[source.id]?.color || DEFAULT_CALENDAR_SOURCE_COLORS[source.id] }} />
                    {source.label}
                  </label>)}
                </div>
                <small>Aktywne: {sourceSummary}</small>
              </label>
              <label className="calendar-filter-popover-field"><span>Typ</span><AppSelect value={filters.type ?? 'all'} onChange={(event) => setFilters((current) => ({ ...current, type: event.target.value }))}><option value="all">Wszystkie</option>{calendarFilterOptions.types.map((type) => <option key={type} value={type}>{type}</option>)}</AppSelect></label>
              <label className="calendar-filter-popover-field"><span>Status</span><AppSelect value={filters.status ?? 'all'} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}><option value="all">Wszystkie</option>{calendarFilterOptions.statuses.map((status) => <option key={status} value={status}>{status}</option>)}</AppSelect></label>
              <div className="calendar-filter-popover-actions">
                <AppButton variant="secondary" size="sm" onClick={clearCalendarFilters}>Wyczyść filtry</AppButton>
              </div>
            </div>}
          </div>
          <div className="calendar-export-actions">
            <ButtonSecondary onClick={() => exportTableToCsv(CALENDAR_EXPORT_TABLE_KEY, CALENDAR_EXPORT_COLUMNS, visibleEventRows)} disabled={!visibleEventRows.length}><Download size={15} />CSV</ButtonSecondary>
            <ButtonSecondary onClick={() => exportTableToPdf('Kalendarz / agenda', CALENDAR_EXPORT_TABLE_KEY, CALENDAR_EXPORT_COLUMNS, visibleEventRows)} disabled={!visibleEventRows.length}><FileText size={15} />PDF</ButtonSecondary>
          </div>
        </div>
      </div>
      {notice && <div className="notice calendar-notice">{notice}</div>}
    </section>
    <section className="panel calendar-surface-panel">
      {loading && <div className="loading-line">Ładowanie kalendarza...</div>}
      {view === 'agenda' ? renderAgenda() : renderGrid()}
    </section>
    {(editingManualEvent || newEventDate) && <CalendarManualEventEditor event={editingManualEvent} initialDate={newEventDate} onClose={() => { setEditingManualEvent(null); setNewEventDate(null); }} onSave={saveManualEvent} onDelete={removeManualEvent} />}
    {confirmDialog && <ConfirmDialog title={confirmDialog.title} message={confirmDialog.message} confirmLabel={confirmDialog.confirmLabel} cancelLabel={confirmDialog.cancelLabel} variant={confirmDialog.variant} onConfirm={confirmDialog.onConfirm} onCancel={() => setConfirmDialog(null)} />}
  </div>;
}
/* ══════════════════════════════════════════════════════════════
   MODUŁ PROJEKTY
══════════════════════════════════════════════════════════════ */

function getNextProjectSequence(projectsList, settings) {
  const formatParts = (settings.format || DEFAULT_DOCUMENT_NUMBERING.projects.format).split('/');
  const nrIndex = formatParts.indexOf('NR');
  const prefixIndex = formatParts.indexOf('PREFIX');
  const expectedPrefix = settings.prefix || DEFAULT_DOCUMENT_NUMBERING.projects.prefix;
  return (projectsList ?? []).reduce((max, project) => {
    const parts = String(project?.project_number ?? '').split('/');
    if (nrIndex < 0 || prefixIndex < 0 || parts[prefixIndex] !== expectedPrefix) return max;
    return Math.max(max, Number(parts[nrIndex]) || 0);
  }, 0) + 1;
}

function generateNextProjectNumber(projectsList, documentSettings) {
  const settings = documentSettings?.numbering?.projects ?? DEFAULT_DOCUMENT_NUMBERING.projects;
  return formatDocumentNumber(settings, getNextProjectSequence(projectsList, settings));
}

function ProjectTaskEditor({ task, projectId, sections = [], onClose, onSave }) {
  const taskId = task?.id ?? task?.localId;
  const [activeTab, setActiveTab] = useState('data');
  const [form, setForm] = useState(() => ({
    title: task?.title ?? '',
    description: task?.description ?? '',
    status: task?.status ?? PROJECT_TASK_STATUSES[0],
    priority: task?.priority ?? 'Normalny',
    due_date: task?.due_date ?? '',
    reminder_at: task?.reminder_at ? String(task.reminder_at).slice(0, 16) : '',
    section_id: task?.section_id ?? '',
    ...(task ? { id: task.id, localId: task.localId, project_id: task.project_id, archived: task.archived, completed_at: task.completed_at, created_at: task.created_at } : { project_id: projectId })
  }));
  const set = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [newCommentType, setNewCommentType] = useState('Komentarz');
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingCommentText, setEditingCommentText] = useState('');
  const [confirmDialog, setConfirmDialog] = useState(null);

  const loadComments = async () => {
    if (!taskId) return;
    setCommentsLoading(true);
    const result = await fetchTaskComments(taskId);
    setComments(result.data ?? []);
    setCommentsLoading(false);
  };

  useEffect(() => { if (activeTab === 'comments') loadComments(); }, [activeTab, taskId]);

  const handleSave = async () => {
    if (!form.title.trim()) { setNotice('Tytuł zadania jest wymagany.'); return; }
    setBusy(true);
    await onSave({
      ...form,
      section_id: form.section_id || null,
      reminder_at: form.reminder_at ? new Date(form.reminder_at).toISOString() : null
    });
    setBusy(false);
  };

  const addComment = async () => {
    if (!newComment.trim()) return;
    if (!taskId) { setNotice('Najpierw zapisz zadanie, aby dodać komentarz.'); return; }
    const result = await createTaskComment(taskId, newComment, newCommentType, demoUser.name);
    if (result.error) { setNotice(`Błąd: ${result.error.message}`); return; }
    setNewComment('');
    await loadComments();
  };

  const saveCommentEdit = async (comment) => {
    const result = await updateTaskComment(comment.id ?? comment.localId, editingCommentText, comment);
    if (result.error) { setNotice(`Błąd: ${result.error.message}`); return; }
    setEditingCommentId(null);
    setEditingCommentText('');
    await loadComments();
  };

  const removeComment = async (comment) => {
    setConfirmDialog({
      title: 'Usuń komentarz',
      message: 'Usunąć komentarz?',
      confirmLabel: 'Usuń',
      cancelLabel: 'Anuluj',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmDialog(null);
        await deleteTaskComment(comment.id ?? comment.localId, comment);
        await loadComments();
      }
    });
  };

  const tabs = [
    { id: 'data', label: 'Dane zadania' },
    { id: 'comments', label: `Komentarze${task ? '' : ''}` }
  ].filter((tab) => !task ? tab.id === 'data' : true);

  return <ResizableModalFrame storageKey="fixer-project-task-modal" defaultSize={{ width: 680, height: 520 }} minSize={{ width: 500, height: 400 }} eyebrow="Zadanie projektu" title={task ? 'Edytuj zadanie' : 'Nowe zadanie'} onClose={onClose}
    footer={<><ButtonSecondary onClick={onClose} disabled={busy}>Anuluj</ButtonSecondary><ButtonPrimary onClick={handleSave} disabled={busy}><Save size={15} />{task ? 'Zapisz' : 'Dodaj'}</ButtonPrimary></>}>
    {notice && <div className="notice">{notice}</div>}
    <div className="record-tabs" role="tablist">
      {tabs.map((tab) => <button key={tab.id} type="button" className={activeTab === tab.id ? 'active' : ''} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>)}
    </div>

    {activeTab === 'data' && <div className="project-task-form">
      <FormField label="Tytuł *">
        <AppInput value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Tytuł zadania" autoFocus />
      </FormField>
      <FormField label="Opis">
        <AppTextarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={3} placeholder="Opis lub notatki do zadania" />
      </FormField>
      <div className="project-task-meta-grid">
        <div className="project-task-meta-column">
          <FormField label="Status">
            <AppSelect value={form.status} onChange={(e) => set('status', e.target.value)}>
              {PROJECT_TASK_STATUSES.map((s) => <option key={s}>{s}</option>)}
            </AppSelect>
          </FormField>
          <FormField label="Priorytet">
            <AppSelect value={form.priority} onChange={(e) => set('priority', e.target.value)}>
              {PROJECT_TASK_PRIORITIES.map((p) => <option key={p}>{p}</option>)}
            </AppSelect>
          </FormField>
          {sections.length > 0 && <FormField label="Sekcja">
            <AppSelect value={form.section_id ?? ''} onChange={(e) => set('section_id', e.target.value)}>
              <option value="">Brak sekcji</option>
              {sections.map((s) => <option key={s.id ?? s.localId} value={s.id ?? s.localId}>{s.name}</option>)}
            </AppSelect>
          </FormField>}
        </div>
        <div className="project-task-meta-column">
          <FormField label="Termin">
            <AppInput type="date" value={form.due_date} onChange={(e) => set('due_date', e.target.value)} />
          </FormField>
          <FormField label="Przypomnienie">
            <AppInput type="datetime-local" value={form.reminder_at} onChange={(e) => set('reminder_at', e.target.value)} />
          </FormField>
        </div>
      </div>
    </div>}

    {activeTab === 'comments' && <div className="service-tab-content">
      <div className="service-progress-add">
        <div className="service-estimate-add-bar">
          <AppSelect value={newCommentType} onChange={(e) => setNewCommentType(e.target.value)} style={{ flex: '0 0 auto', width: 130 }}>
            {PROJECT_TASK_COMMENT_TYPES.map((t) => <option key={t}>{t}</option>)}
          </AppSelect>
          <AppInput value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Treść komentarza..." onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && addComment()} style={{ flex: 1 }} />
          <button type="button" className="project-icon-action primary-action" onClick={addComment} disabled={!newComment.trim()} aria-label="Dodaj komentarz" title="Dodaj komentarz"><Plus size={15} /></button>
        </div>
      </div>
      <div className="service-progress-list">
        {commentsLoading && <div className="loading-line">Ładowanie komentarzy...</div>}
        {!commentsLoading && comments.map((c) => {
          const isEditing = editingCommentId === (c.id ?? c.localId);
          return <div className="service-progress-row" key={c.id ?? c.localId}>
            <div className="service-progress-meta">
              <strong>{c.author || 'Operator'}</strong>
              <span className="muted" style={{ marginLeft: 6, fontSize: 12 }}>{c.type}</span>
              <span>{formatServiceDateTime(c.created_at)}</span>
            </div>
            {isEditing
              ? <AppTextarea value={editingCommentText} onChange={(e) => setEditingCommentText(e.target.value)} rows={2} />
              : <p style={{ margin: '4px 0' }}>{c.body}</p>}
            <div className="service-inline-actions">
              {isEditing
                ? <><button type="button" className="project-icon-action primary-action" onClick={() => saveCommentEdit(c)} aria-label="Zapisz komentarz" title="Zapisz komentarz"><Save size={14} /></button><button type="button" className="project-icon-action" onClick={() => { setEditingCommentId(null); setEditingCommentText(''); }} aria-label="Anuluj edycję" title="Anuluj edycję"><X size={14} /></button></>
                : <><button type="button" className="project-icon-action" onClick={() => { setEditingCommentId(c.id ?? c.localId); setEditingCommentText(c.body); }} aria-label="Edytuj komentarz" title="Edytuj komentarz">✎</button><button type="button" className="project-icon-action danger-action" onClick={() => removeComment(c)} aria-label="Usuń komentarz" title="Usuń komentarz"><Trash2 size={14} /></button></>}
            </div>
          </div>;
        })}
        {!commentsLoading && !comments.length && <EmptyState title={task ? 'Brak komentarzy.' : 'Zapisz zadanie, aby dodać komentarze.'} />}
      </div>
    </div>}
    {confirmDialog && <ConfirmDialog title={confirmDialog.title} message={confirmDialog.message} confirmLabel={confirmDialog.confirmLabel} cancelLabel={confirmDialog.cancelLabel} variant={confirmDialog.variant} onConfirm={confirmDialog.onConfirm} onCancel={() => setConfirmDialog(null)} />}
  </ResizableModalFrame>;
}

function ProjectEditor({ project, clients = [], allProjects = [], documentSettings, onClose, onSave }) {
  const isNew = !project;
  const [activeTab, setActiveTab] = useState('data');
  const projectTasksListRef = useRef(null);
  const [form, setForm] = useState(() => {
    const safeProject = project ?? {};
    return {
      project_number: String(safeProject.project_number ?? generateNextProjectNumber(allProjects, documentSettings)),
      name: String(safeProject.name ?? ''),
      description: String(safeProject.description ?? ''),
      client_id: safeProject.client_id ?? '',
      status: safeProject.status ?? 'Planowany',
      priority: safeProject.priority ?? 'Normalny',
      start_date: safeProject.start_date ?? '',
      due_date: safeProject.due_date ?? '',
      notes: String(safeProject.notes ?? ''),
      archived: Boolean(safeProject.archived),
      completed_at: safeProject.completed_at ?? null,
      ...(project ? { id: project.id, localId: project.localId, created_at: project.created_at } : {})
    };
  });
  const [tasks, setTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [taskEditorOpen, setTaskEditorOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [clientPickerOpen, setClientPickerOpen] = useState(false);
  const [clientEditorOpen, setClientEditorOpen] = useState(false);
  const [localClients, setLocalClients] = useState(() => Array.isArray(clients) ? clients : []);

  useEffect(() => { setLocalClients(Array.isArray(clients) ? clients : []); }, [clients]);

  const set = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));
  const projectId = project?.id ?? project?.localId;

  const selectedClient = localClients.find((c) => c.id === form.client_id || c.localId === form.client_id) ?? null;

  const openNewClientEditor = () => { setClientPickerOpen(false); setClientEditorOpen(true); };

  const saveNewClientFromProject = async (clientForm) => {
    const payload = {
      name: clientForm.name, type: clientForm.type, client_kind: clientForm.client_kind,
      phone: clientForm.phone, email: clientForm.email, street: clientForm.street,
      building_number: clientForm.building_number, apartment_number: clientForm.apartment_number,
      postal_code: clientForm.postal_code, city: clientForm.city, country: clientForm.country,
      nip: clientForm.type === 'Firma' ? clientForm.nip : '',
      regon: clientForm.type === 'Firma' ? clientForm.regon : '',
      notes: clientForm.notes
    };
    if (!clientForm.name?.trim()) { alert('Nazwa klienta jest wymagana.'); return; }
    if (!isSupabaseConfigured) { alert('Brak konfiguracji bazy danych Supabase. Dane klientów nie mogą zostać zapisane.'); return; }
    const result = await createClientRecord(payload);
    if (result.error) { alert(humanizeError(result.error, 'client')); return; }
    setClientEditorOpen(false);
    setLocalClients((current) => [result.data, ...current.filter((c) => c.id !== result.data.id)]);
    set('client_id', result.data.id);
  };

  const [sections, setSections] = useState([]);
  const [editingSectionId, setEditingSectionId] = useState(null);
  const [editingSectionName, setEditingSectionName] = useState('');
  const [collapsedSections, setCollapsedSections] = useState(new Set());
  const [commentCounts, setCommentCounts] = useState({});
  const [sectionMenu, setSectionMenu] = useState(null);
  const [sectionModalOpen, setSectionModalOpen] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  const [sectionNameError, setSectionNameError] = useState('');

  const loadTasks = async () => {
    if (!projectId) return;
    setTasksLoading(true);
    const [tasksResult, sectionsResult, commentsResult] = await Promise.all([
      fetchProjectTasks(projectId),
      fetchProjectSections(projectId),
      fetchProjectAllComments(projectId)
    ]);
    const counts = {};
    (commentsResult.data ?? []).forEach((c) => {
      const tid = String(c.task_id);
      counts[tid] = (counts[tid] ?? 0) + 1;
    });
    setTasks(tasksResult.data ?? []);
    setSections(sectionsResult.data ?? []);
    setCommentCounts(counts);
    setTasksLoading(false);
  };

  useEffect(() => { if (activeTab === 'tasks') loadTasks(); }, [activeTab, projectId]);

  useEffect(() => {
    if (!sectionMenu) return;
    const close = () => setSectionMenu(null);
    window.addEventListener('click', close);
    window.addEventListener('keydown', close);
    return () => { window.removeEventListener('click', close); window.removeEventListener('keydown', close); };
  }, [sectionMenu]);

  const handleSave = async () => {
    if (!form.name.trim()) { setNotice('Nazwa projektu jest wymagana.'); return; }
    setBusy(true);
    await onSave({ ...form, client_id: form.client_id || null });
    setBusy(false);
  };

  const openNewTask = (sectionId = null) => {
    setEditingTask(sectionId ? { section_id: sectionId, project_id: projectId } : null);
    setTaskEditorOpen(true);
  };
  const openEditTask = (row) => { setEditingTask(row._task ?? row); setTaskEditorOpen(true); };

  const saveTask = async (taskForm) => {
    const tid = taskForm.id ?? taskForm.localId;
    const result = tid ? await updateProjectTask(tid, taskForm) : await createProjectTask(taskForm);
    if (result.error) { setNotice(humanizeError(result.error, 'Błąd zapisu zadania')); return; }
    setTaskEditorOpen(false);
    setEditingTask(null);
    await loadTasks();
  };

  const setTaskStatus = async (task, newStatus) => {
    if (newStatus === task.status) return;
    const isTerminal = PROJECT_TASK_TERMINAL_STATUSES.includes(newStatus);
    if (isTerminal) {
      setConfirmDialog({
        title: 'Przenieś zadanie do historii',
        message: 'Przenieść zadanie do historii?',
        confirmLabel: 'Przenieś do historii',
        cancelLabel: 'Anuluj',
        variant: 'secondary',
        onConfirm: async () => {
          setConfirmDialog(null);
          const tid = task.id ?? task.localId;
          await updateProjectTask(tid, { ...task, status: newStatus, archived: true, completed_at: new Date().toISOString() });
          await loadTasks();
        }
      });
      return;
    }
    const tid = task.id ?? task.localId;
    await updateProjectTask(tid, { ...task, status: newStatus, archived: false, completed_at: task.completed_at });
    await loadTasks();
  };

  const deleteTask = async (row) => {
    const task = row._task ?? row;
    setConfirmDialog({
      title: 'Usuń zadanie',
      message: `Usunąć zadanie "${task.title}"?`,
      confirmLabel: 'Usuń',
      cancelLabel: 'Anuluj',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmDialog(null);
        await deleteProjectTask(task.id ?? task.localId, task);
        await loadTasks();
      }
    });
  };

  const openSectionModal = () => {
    setNewSectionName('');
    setSectionNameError('');
    setSectionModalOpen(true);
  };

  const closeSectionModal = () => {
    setSectionModalOpen(false);
    setNewSectionName('');
    setSectionNameError('');
  };

  const addSection = async () => {
    const sectionName = newSectionName.trim();
    if (!sectionName) { setSectionNameError('Podaj nazwę sekcji.'); return; }
    if (sectionName.length > 100) { setSectionNameError('Nazwa sekcji może mieć maksymalnie 100 znaków.'); return; }
    if (!projectId) { setNotice('Najpierw zapisz projekt.'); return; }
    await createProjectSection(projectId, sectionName, (sections.length + 1) * 10);
    setNewSectionName('');
    setSectionModalOpen(false);
    await loadTasks();
    window.requestAnimationFrame(() => projectTasksListRef.current?.focus?.());
  };

  const saveSection = async (id) => {
    if (!editingSectionName.trim()) return;
    await updateProjectSection(id, editingSectionName);
    setEditingSectionId(null);
    setEditingSectionName('');
    await loadTasks();
  };

  const removeSection = async (section) => {
    const sid = section.id ?? section.localId;
    const hasTasks = tasks.some((t) => !t.archived && String(t.section_id) === String(sid));
    setConfirmDialog({
      title: 'Usuń sekcję',
      message: hasTasks ? 'Sekcja zawiera zadania. Usunięcie odłączy je od sekcji. Kontynuować?' : `Usunąć sekcję "${section.name}"?`,
      confirmLabel: 'Usuń',
      cancelLabel: 'Anuluj',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmDialog(null);
        setSectionMenu(null);
        await deleteProjectSection(sid);
        await loadTasks();
      }
    });
  };

  const toggleSectionCollapse = (sid) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(String(sid))) next.delete(String(sid)); else next.add(String(sid));
      return next;
    });
  };

  const openSectionMenu = (e, section) => {
    e.preventDefault();
    e.stopPropagation();
    setSectionMenu({ x: e.clientX, y: e.clientY, section });
  };

  const activeTasks = tasks.filter((t) => !t.archived);
  const historyTasks = tasks.filter((t) => t.archived);

  const tasksBySection = (sectionId) =>
    activeTasks.filter((t) => String(t.section_id ?? '') === String(sectionId ?? ''));
  const unsectionedTasks = activeTasks.filter((t) => !t.section_id);

  const makeTaskColumns = (storageKeyPrefix) => [
    { key: 'title', label: 'Nazwa' },
    {
      key: 'status', label: 'Status',
      renderCell: (row) => <ServiceStatusCell value={row.status} statuses={PROJECT_TASK_STATUSES} onStatusChange={(s) => setTaskStatus(row._task, s)} />
    },
    { key: 'priority', label: 'Priorytet' },
    { key: 'due_date', label: 'Termin' },
    { key: 'comment_count', label: 'Kom.', align: 'right' },
    { key: 'created_display', label: 'Utworzono' }
  ];

  const makeTaskRows = (taskList) => taskList.map((t) => ({
    ...t,
    _task: t,
    comment_count: commentCounts[String(t.id ?? t.localId)] ?? 0,
    created_display: t.created_at ? formatDashboardDate(t.created_at) : '—'
  }));

  const taskCustomActions = [
    { key: 'done', label: 'Oznacz jako zrobione', icon: CheckCheck, visible: (row) => !PROJECT_TASK_TERMINAL_STATUSES.includes(row.status), onClick: (row) => setTaskStatus(row._task, 'Zrobione') }
  ];

  const historyTaskColumns = [
    { key: 'title', label: 'Nazwa' },
    { key: 'status', label: 'Status' },
    { key: 'priority', label: 'Priorytet' },
    { key: 'due_date', label: 'Termin' }
  ];
  const historyTaskRows = historyTasks.map((t) => ({ ...t, _task: t }));

  const tabs = [
    { id: 'data', label: 'Dane projektu' },
    { id: 'tasks', label: `Zadania${activeTasks.length ? ` (${activeTasks.length})` : ''}` },
    { id: 'notes', label: 'Notatki' }
  ].filter((tab) => !isNew || tab.id === 'data');

  return <>
    <ResizableModalFrame storageKey="fixer-project-modal" defaultSize={{ width: 900, height: 640 }} minSize={{ width: 640, height: 480 }} eyebrow="Projekt" title={isNew ? 'Nowy projekt' : String(project?.name || 'Projekt bez nazwy')} onClose={onClose}
      footer={<><ButtonSecondary onClick={onClose} disabled={busy}>Anuluj</ButtonSecondary><ButtonPrimary onClick={handleSave} disabled={busy}><Save size={15} />{isNew ? 'Utwórz projekt' : 'Zapisz'}</ButtonPrimary></>}>
      {notice && <div className="notice">{notice}</div>}
      <div className="record-tabs" role="tablist">
        {tabs.map((tab) => <button key={tab.id} type="button" className={activeTab === tab.id ? 'active' : ''} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>)}
      </div>

      {activeTab === 'data' && <div className="service-order-form-body">
        <div className="service-order-strip project-main-strip">
          <FormField label="Numer projektu">
            <AppInput value={form.project_number} onChange={(e) => set('project_number', e.target.value)} placeholder="np. PRJ/001/..." />
          </FormField>
          <FormField label="Status">
            <AppSelect value={form.status} onChange={(e) => set('status', e.target.value)}>
              {PROJECT_STATUSES.map((s) => <option key={s}>{s}</option>)}
            </AppSelect>
          </FormField>
          <FormField label="Priorytet">
            <AppSelect value={form.priority} onChange={(e) => set('priority', e.target.value)}>
              {PROJECT_PRIORITIES.map((p) => <option key={p}>{p}</option>)}
            </AppSelect>
          </FormField>
        </div>
        <div className="project-date-row">
          <FormField label="Start"><AppInput type="date" value={form.start_date} onChange={(e) => set('start_date', e.target.value)} /></FormField>
          <FormField label="Termin"><AppInput type="date" value={form.due_date} onChange={(e) => set('due_date', e.target.value)} /></FormField>
        </div>
        <FormField label="Nazwa projektu *">
          <AppInput value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Nazwa projektu" autoFocus={isNew} />
        </FormField>
        <FormField label="Klient">
          <div className="client-choice-row">
            {selectedClient
              ? <span className="project-client-chip"><strong>{selectedClient.name}</strong><span className="project-client-actions"><button type="button" className="project-icon-action" onClick={() => setClientPickerOpen(true)} aria-label="Zmień klienta" title="Zmień klienta"><Search size={14} /></button><button type="button" className="project-icon-action danger-action" onClick={() => set('client_id', '')} aria-label="Usuń powiązanie klienta" title="Usuń powiązanie klienta"><X size={14} /></button></span></span>
              : <ButtonSecondary size="sm" onClick={() => setClientPickerOpen(true)}>Wybierz klienta</ButtonSecondary>}
          </div>
        </FormField>
        <FormField label="Opis">
          <AppTextarea resizeKey="fixer:textarea:project:description" value={form.description} onChange={(e) => set('description', e.target.value)} rows={3} placeholder="Opis projektu, cel, zakres..." />
        </FormField>
      </div>}

      {activeTab === 'tasks' && <div className="project-tasks-panel">
        <div className="project-tasks-toolbar">
          <AppButton variant="primary" className="compact-table-button" size="sm" onClick={() => openNewTask(null)}><Plus size={14} />Nowe zadanie</AppButton>
          <AppButton variant="secondary" className="compact-table-button project-section-add-button" size="sm" onClick={openSectionModal}><Plus size={14} />Sekcja</AppButton>
        </div>
        {tasksLoading && <div className="loading-line">Ładowanie zadań...</div>}
        {!tasksLoading && <div className="project-sections-list" ref={projectTasksListRef} tabIndex={-1}>
          {sections.map((section) => {
            const sid = String(section.id ?? section.localId);
            const sectionTasks = tasksBySection(sid);
            const collapsed = collapsedSections.has(sid);
            const isEditing = editingSectionId === sid;
            const skey = `pt-s${sid.slice(0,8)}-${projectId?.slice(0,8) ?? 'new'}`;
            return <div key={sid} className="project-section-block">
              <div className="project-section-toggle" onClick={() => !isEditing && toggleSectionCollapse(sid)} onContextMenu={(e) => openSectionMenu(e, section)}>
                <span className="project-section-chevron">{collapsed ? '▸' : '▾'}</span>
                {isEditing
                  ? <><AppInput value={editingSectionName} onChange={(e) => setEditingSectionName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') saveSection(sid); if (e.key === 'Escape') { setEditingSectionId(null); setEditingSectionName(''); } }} onClick={(e) => e.stopPropagation()} autoFocus className="project-section-edit-input" />
                    <button type="button" className="column-resizer-hint" onClick={(e) => { e.stopPropagation(); saveSection(sid); }} title="Zapisz"><Save size={12} /></button>
                    <button type="button" className="column-resizer-hint" onClick={(e) => { e.stopPropagation(); setEditingSectionId(null); setEditingSectionName(''); }} title="Anuluj"><X size={12} /></button></>
                  : <><span className="project-section-name">{section.name}</span><span className="project-section-count muted">({sectionTasks.length})</span></>}
              </div>
              {!collapsed && <DataTable
                storageKey={skey}
                columns={makeTaskColumns(skey)}
                rows={makeTaskRows(sectionTasks)}
                onOpen={openEditTask}
                onEdit={openEditTask}
                onDelete={deleteTask}
                openLabel="Otwórz zadanie"
                editLabel="Edytuj zadanie"
                deleteLabel="Usuń zadanie"
                customRowActions={taskCustomActions}
                enableSelectionActions={false}
              />}
            </div>;
          })}
          {(sections.length === 0 || unsectionedTasks.length > 0) && <div className="project-section-block">
            {sections.length > 0 && <div className="project-section-toggle" onClick={() => toggleSectionCollapse('__unsectioned__')} onContextMenu={(e) => { e.preventDefault(); openNewTask(null); }}>
              <span className="project-section-chevron">{collapsedSections.has('__unsectioned__') ? '▸' : '▾'}</span>
              <span className="project-section-name muted">Bez sekcji</span>
              <span className="project-section-count muted">({unsectionedTasks.length})</span>
            </div>}
            {(!collapsedSections.has('__unsectioned__')) && <DataTable
              storageKey={`pt-unsect-${projectId?.slice(0,8) ?? 'new'}`}
              columns={makeTaskColumns('pt-unsect')}
              rows={makeTaskRows(unsectionedTasks)}
              onOpen={openEditTask}
              onEdit={openEditTask}
              onDelete={deleteTask}
              openLabel="Otwórz zadanie"
              editLabel="Edytuj zadanie"
              deleteLabel="Usuń zadanie"
              customRowActions={taskCustomActions}
              enableSelectionActions={false}
            />}
          </div>}
          {!activeTasks.length && !tasksLoading && <EmptyState title="Brak aktywnych zadań." />}
        </div>}
        {historyTaskRows.length > 0 && <details className="project-history-section">
          <summary className="history-toggle">Historia zadań ({historyTaskRows.length})</summary>
          <DataTable storageKey={`pt-hist-${projectId?.slice(0,8) ?? 'new'}`} columns={historyTaskColumns} rows={historyTaskRows} enableSelectionActions={false}
            onOpen={openEditTask} openLabel="Podgląd zadania"
            customRowActions={[{ key: 'restore', label: 'Przywróć jako aktywne', icon: RotateCcw, onClick: (row) => { const t = row._task; updateProjectTask(t.id ?? t.localId, { ...t, status: PROJECT_TASK_STATUSES[0], archived: false, completed_at: null }).then(loadTasks); } }]}
          />
        </details>}
        {sectionMenu && <div className="row-context-menu" style={{ left: sectionMenu.x, top: sectionMenu.y }} onClick={(e) => e.stopPropagation()}>
          <div className="context-menu-title">Sekcja: {sectionMenu.section.name}</div>
          <button type="button" onClick={() => { const sid = sectionMenu.section.id ?? sectionMenu.section.localId; setSectionMenu(null); openNewTask(sid); }}><Plus size={14} />Dodaj zadanie</button>
          <button type="button" onClick={() => { const sid = sectionMenu.section.id ?? sectionMenu.section.localId; setSectionMenu(null); setEditingSectionId(sid); setEditingSectionName(sectionMenu.section.name); }}>✎ Zmień nazwę</button>
          <div className="context-menu-separator" />
          <button type="button" className="danger-action" onClick={() => removeSection(sectionMenu.section)}><Trash2 size={14} />Usuń sekcję</button>
        </div>}
      </div>}

      {activeTab === 'notes' && <div className="service-order-form-body">
        <FormField label="Notatki">
          <AppTextarea resizeKey="fixer:textarea:project:notes" value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={10} placeholder="Notatki do projektu..." />
        </FormField>
      </div>}
    </ResizableModalFrame>

    {clientPickerOpen && <ClientPickerModal clients={localClients} selectedClientId={form.client_id} onClose={() => setClientPickerOpen(false)} onConfirm={(client) => { set('client_id', client.id ?? client.localId); setClientPickerOpen(false); }} onCreateClient={openNewClientEditor} />}

    {clientEditorOpen && <ClientEditor client={null} initialTab="data" onClose={() => { setClientEditorOpen(false); setClientPickerOpen(true); }} onSave={saveNewClientFromProject} />}

    {taskEditorOpen && <ProjectTaskEditor task={editingTask} projectId={projectId} sections={sections} onClose={() => { setTaskEditorOpen(false); setEditingTask(null); }} onSave={saveTask} />}

    {sectionModalOpen && <ModalFrame className="project-section-modal" title="Nowa sekcja" onClose={closeSectionModal} footer={<><ButtonSecondary onClick={closeSectionModal}>Anuluj</ButtonSecondary><ButtonPrimary onClick={addSection}><Plus size={15} />Dodaj</ButtonPrimary></>}>
      <FormField label="Nazwa sekcji" error={sectionNameError}>
        <AppInput value={newSectionName} onChange={(event) => { setNewSectionName(event.target.value.slice(0, 100)); setSectionNameError(''); }} onKeyDown={(event) => { if (event.key === 'Enter') addSection(); }} maxLength={100} autoFocus />
      </FormField>
    </ModalFrame>}
    {confirmDialog && <ConfirmDialog title={confirmDialog.title} message={confirmDialog.message} confirmLabel={confirmDialog.confirmLabel} cancelLabel={confirmDialog.cancelLabel} variant={confirmDialog.variant} onConfirm={confirmDialog.onConfirm} onCancel={() => setConfirmDialog(null)} />}
  </>;
}

const PROJECT_DETAILS_WIDTH_KEY = 'fixer-project-details-panel-width';
const PROJECT_DETAILS_COLLAPSED_KEY = 'fixer.projects.detailsPanelCollapsed';
const PROJECT_DETAILS_SELECTED_KEY = 'fixer.projects.selectedProjectId';

function getSavedProjectDetailsWidth() {
  const saved = Number(localStorage.getItem(PROJECT_DETAILS_WIDTH_KEY));
  if (Number.isFinite(saved) && saved > 0) return saved;
  return Math.round(Math.min(620, Math.max(420, window.innerWidth * 0.38)));
}

function getSavedProjectDetailsCollapsed() {
  return localStorage.getItem(PROJECT_DETAILS_COLLAPSED_KEY) === 'true';
}

function ProjectTaskInlineComments({ task, onChanged }) {
  const taskId = task?.id ?? task?.localId;
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [newCommentType, setNewCommentType] = useState('Komentarz');
  const [notice, setNotice] = useState('');
  const [confirmDialog, setConfirmDialog] = useState(null);

  const loadComments = async () => {
    if (!taskId) return;
    setLoading(true);
    const result = await fetchTaskComments(taskId);
    if (result.error) setNotice(`Nie udało się pobrać komentarzy: ${result.error.message}`);
    setComments(result.data ?? []);
    setLoading(false);
  };

  useEffect(() => { loadComments(); }, [taskId]);

  const addComment = async () => {
    if (!newComment.trim()) return;
    const result = await createTaskComment(taskId, newComment, newCommentType, demoUser.name);
    if (result.error) { setNotice(`Błąd: ${result.error.message}`); return; }
    setNewComment('');
    await loadComments();
    onChanged?.();
  };

  const removeComment = async (comment) => {
    setConfirmDialog({
      title: 'Usuń komentarz',
      message: 'Czy na pewno usunąć ten komentarz/postęp?',
      confirmLabel: 'Usuń',
      cancelLabel: 'Anuluj',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmDialog(null);
        const result = await deleteTaskComment(comment.id ?? comment.localId, comment);
        if (result.error) { setNotice(`Błąd: ${result.error.message}`); return; }
        await loadComments();
        onChanged?.();
      }
    });
  };

  return <div className="project-task-inline-comments">
    {notice && <div className="notice">{notice}</div>}
    <div className="project-comments-add">
      <AppSelect value={newCommentType} onChange={(event) => setNewCommentType(event.target.value)}>{PROJECT_TASK_COMMENT_TYPES.map((type) => <option key={type}>{type}</option>)}</AppSelect>
      <AppTextarea value={newComment} onChange={(event) => setNewComment(event.target.value)} placeholder="Treść komentarza..." rows={3} onKeyDown={(event) => { if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) addComment(); }} />
      <button type="button" className="project-icon-action primary-action" onClick={addComment} disabled={!newComment.trim()} aria-label="Dodaj komentarz" title="Dodaj komentarz"><Plus size={15} /></button>
    </div>
    <div className="project-comments-list">
      {loading && <div className="loading-line">Ładowanie komentarzy...</div>}
      {!loading && comments.map((comment) => <div className="project-comment-row" key={comment.id ?? comment.localId}>
        <div><strong>{comment.author || 'Operator'}</strong><span>{comment.type} · {formatServiceDateTime(comment.created_at)}</span></div>
        <button type="button" className="project-comment-delete" onClick={() => removeComment(comment)} aria-label="Usuń komentarz/postęp" title="Usuń komentarz/postęp"><Trash2 size={13} /></button>
        <p>{comment.body}</p>
      </div>)}
      {!loading && !comments.length && <div className="project-detail-empty">Brak komentarzy.</div>}
    </div>
    {confirmDialog && <ConfirmDialog title={confirmDialog.title} message={confirmDialog.message} confirmLabel={confirmDialog.confirmLabel} cancelLabel={confirmDialog.cancelLabel} variant={confirmDialog.variant} onConfirm={confirmDialog.onConfirm} onCancel={() => setConfirmDialog(null)} />}
  </div>;
}

function SimpleTaskComments({ task, onChanged }) {
  const taskId = task?.id ?? task?.localId;
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [newCommentType, setNewCommentType] = useState('Komentarz');
  const [notice, setNotice] = useState('');
  const [confirmDialog, setConfirmDialog] = useState(null);

  const loadComments = async () => {
    if (!taskId) return;
    setLoading(true);
    const result = await fetchOrganizerTaskComments(taskId);
    if (result.error) setNotice(`Nie udało się pobrać komentarzy: ${result.error.message}`);
    else setNotice('');
    setComments(result.data ?? []);
    setLoading(false);
  };

  useEffect(() => { loadComments(); }, [taskId]);

  const addComment = async () => {
    if (!newComment.trim()) return;
    const result = await createOrganizerTaskComment(taskId, newComment, newCommentType, demoUser.name);
    if (result.error) { setNotice(`Błąd: ${result.error.message}`); return; }
    setNewComment('');
    await loadComments();
    onChanged?.();
  };

  const removeComment = async (comment) => {
    setConfirmDialog({
      title: 'Usuń komentarz',
      message: 'Czy na pewno usunąć ten komentarz/postęp?',
      confirmLabel: 'Usuń',
      cancelLabel: 'Anuluj',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmDialog(null);
        const result = await deleteOrganizerTaskComment(comment.id ?? comment.localId, comment);
        if (result.error) { setNotice(`Błąd: ${result.error.message}`); return; }
        await loadComments();
        onChanged?.();
      }
    });
  };

  return <div className={`simple-task-comments ${comments.length > 0 ? 'has-comments' : ''}`}>
    <div className="simple-task-comments-title">Komentarze / postęp <span>({comments.length})</span></div>
    {notice && <div className="notice">{notice}</div>}
    <div className="project-comments-add">
      <AppSelect value={newCommentType} onChange={(event) => setNewCommentType(event.target.value)}>{PROJECT_TASK_COMMENT_TYPES.map((type) => <option key={type}>{type}</option>)}</AppSelect>
      <AppTextarea value={newComment} onChange={(event) => setNewComment(event.target.value)} placeholder="Treść komentarza lub postępu..." rows={3} onKeyDown={(event) => { if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) addComment(); }} />
      <button type="button" className="project-icon-action primary-action" onClick={addComment} disabled={!newComment.trim()} aria-label="Dodaj komentarz" title="Dodaj komentarz"><Plus size={15} /></button>
    </div>
    <div className="project-comments-list">
      {loading && <div className="loading-line">Ładowanie komentarzy...</div>}
      {!loading && comments.map((comment) => <div className="project-comment-row" key={comment.id ?? comment.localId}>
        <div><strong>{comment.author || 'Operator'}</strong><span>{comment.type} · {formatServiceDateTime(comment.created_at)}</span></div>
        <button type="button" className="project-comment-delete" onClick={() => removeComment(comment)} aria-label="Usuń komentarz/postęp" title="Usuń komentarz/postęp"><Trash2 size={13} /></button>
        <p>{comment.body}</p>
      </div>)}
      {!loading && !comments.length && <div className="project-detail-empty">Brak komentarzy.</div>}
    </div>
    {confirmDialog && <ConfirmDialog title={confirmDialog.title} message={confirmDialog.message} confirmLabel={confirmDialog.confirmLabel} cancelLabel={confirmDialog.cancelLabel} variant={confirmDialog.variant} onConfirm={confirmDialog.onConfirm} onCancel={() => setConfirmDialog(null)} />}
  </div>;
}

function ProjectDetailsPanel({ project, collapsed, width, onResizeStart, onToggleCollapse, onRefreshProject }) {
  const projectId = project?.id ?? project?.localId;
  const projectTitle = String(project?.name ?? '').trim() || 'Projekt bez nazwy';
  const [tasks, setTasks] = useState([]);
  const [sections, setSections] = useState([]);
  const [commentCounts, setCommentCounts] = useState({});
  const [expandedTasks, setExpandedTasks] = useState(new Set());
  const [collapsedSections, setCollapsedSections] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [taskEditorOpen, setTaskEditorOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [sectionModalOpen, setSectionModalOpen] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  const [sectionNameError, setSectionNameError] = useState('');

  const loadPanelData = async () => {
    if (!projectId || collapsed) return;
    setLoading(true);
    const [tasksResult, sectionsResult, commentsResult] = await Promise.all([
      fetchProjectTasks(projectId),
      fetchProjectSections(projectId),
      fetchProjectAllComments(projectId)
    ]);
    const counts = {};
    (commentsResult.data ?? []).forEach((comment) => {
      const tid = String(comment.task_id);
      counts[tid] = (counts[tid] ?? 0) + 1;
    });
    if (tasksResult.error || sectionsResult.error || commentsResult.error) setNotice('Nie udało się pobrać pełnych danych panelu projektu.');
    else setNotice('');
    setTasks(tasksResult.data ?? []);
    setSections(sectionsResult.data ?? []);
    setCommentCounts(counts);
    setLoading(false);
  };

  useEffect(() => { loadPanelData(); }, [projectId, collapsed]);
  useEffect(() => { setExpandedTasks(new Set()); }, [projectId]);

  const displayTasks = tasks;
  const tasksBySection = (sectionId) => displayTasks.filter((task) => String(task.section_id ?? '') === String(sectionId ?? ''));
  const unsectionedTasks = displayTasks.filter((task) => !task.section_id);

  const openNewTask = (sectionId = null) => {
    if (sectionId) {
      setCollapsedSections((current) => {
        const next = new Set(current);
        next.delete(String(sectionId));
        return next;
      });
    }
    setEditingTask(sectionId ? { section_id: sectionId, project_id: projectId } : { project_id: projectId });
    setTaskEditorOpen(true);
  };

  const saveTask = async (taskForm) => {
    const tid = taskForm.id ?? taskForm.localId;
    const result = tid ? await updateProjectTask(tid, taskForm) : await createProjectTask(taskForm);
    if (result.error) { setNotice(humanizeError(result.error, 'Błąd zapisu zadania')); return; }
    setTaskEditorOpen(false);
    setEditingTask(null);
    await loadPanelData();
    onRefreshProject?.();
  };

  const toggleTaskDone = async (task) => {
    if (!task) return;
    const tid = task.id ?? task.localId;
    const done = task.archived || PROJECT_TASK_TERMINAL_STATUSES.includes(task.status);
    await updateProjectTask(tid, done
      ? { ...task, status: PROJECT_TASK_STATUSES[0], archived: false, completed_at: null }
      : { ...task, status: 'Zrobione', archived: true, completed_at: task.completed_at || new Date().toISOString() });
    await loadPanelData();
  };

  const addSection = async () => {
    const sectionName = newSectionName.trim();
    if (!sectionName) { setSectionNameError('Podaj nazwę sekcji.'); return; }
    if (sectionName.length > 100) { setSectionNameError('Nazwa sekcji może mieć maksymalnie 100 znaków.'); return; }
    const result = await createProjectSection(projectId, sectionName, (sections.length + 1) * 10);
    if (result.error) { setSectionNameError(result.error.message); return; }
    setNewSectionName('');
    setSectionModalOpen(false);
    await loadPanelData();
  };

  const toggleSection = (key) => {
    setCollapsedSections((current) => {
      const next = new Set(current);
      if (next.has(String(key))) next.delete(String(key));
      else next.add(String(key));
      return next;
    });
  };

  const removeSection = async (section, sectionTasks = []) => {
    const sid = String(section.id ?? section.localId);
    const hasTasks = sectionTasks.length > 0;
    const message = hasTasks
      ? 'Sekcja zawiera zadania. Usunięcie sekcji usunie również przypisane zadania i ich komentarze/postępy. Czy kontynuować?'
      : `Czy na pewno usunąć sekcję "${section.name}"?`;
    setConfirmDialog({
      title: 'Usuń sekcję',
      message,
      confirmLabel: 'Usuń',
      cancelLabel: 'Anuluj',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmDialog(null);
        setNotice('');
        for (const task of sectionTasks) {
          const result = await deleteProjectTask(task.id ?? task.localId, task);
          if (result.error) {
            setNotice(humanizeError(result.error, 'Nie udało się usunąć zadań sekcji'));
            return;
          }
        }
        const result = await deleteProjectSection(section.id ?? section.localId);
        if (result.error) {
          setNotice(humanizeError(result.error, 'Nie udało się usunąć sekcji'));
          return;
        }
        setCollapsedSections((current) => {
          const next = new Set(current);
          next.delete(sid);
          return next;
        });
        setExpandedTasks((current) => {
          const next = new Set(current);
          sectionTasks.forEach((task) => next.delete(String(task.id ?? task.localId)));
          return next;
        });
        await loadPanelData();
        onRefreshProject?.();
      }
    });
  };

  const toggleTaskExpanded = (task) => {
    const key = String(task.id ?? task.localId);
    setExpandedTasks((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const renderTask = (task) => {
    const taskKey = String(task.id ?? task.localId);
    const comments = commentCounts[taskKey] ?? 0;
    const hasComments = comments > 0;
    const done = task.archived || PROJECT_TASK_TERMINAL_STATUSES.includes(task.status);
    const expanded = expandedTasks.has(taskKey);
    return <div className={`project-detail-task-item ${done ? 'is-done' : ''} ${expanded ? 'is-expanded' : ''}`} key={taskKey}>
      <div className="project-detail-task-row">
        <button type="button" className={`project-task-done-toggle ${done ? 'checked' : ''}`} onClick={(event) => { event.stopPropagation(); toggleTaskDone(task); }} aria-label={done ? 'Przywróć zadanie jako aktywne' : 'Oznacz zadanie jako wykonane'} title={done ? 'Przywróć jako aktywne' : 'Oznacz jako wykonane'}>
          {done && <CheckCircle2 size={16} />}
        </button>
        <button type="button" className="project-detail-task-main" onClick={() => toggleTaskExpanded(task)} aria-expanded={expanded}>
          <strong>{task.title}</strong>
          <span>{task.status || '—'} · {task.due_date || 'Brak terminu'}</span>
        </button>
        <button type="button" className={`project-detail-task-comments ${hasComments ? 'has-comments' : ''}`} onClick={(event) => { event.stopPropagation(); toggleTaskExpanded(task); }} aria-label="Pokaż komentarze i postęp" title="Komentarze / postęp">{comments}</button>
        <div className="project-detail-task-actions">
          <button type="button" className={`project-icon-action comment-action ${hasComments ? 'has-comments' : ''}`} onClick={(event) => { event.stopPropagation(); toggleTaskExpanded(task); }} aria-label="Komentarze" title="Komentarze / postęp"><MessageSquare size={14} /></button>
          <button type="button" className="project-icon-action" onClick={(event) => { event.stopPropagation(); setEditingTask(task); setTaskEditorOpen(true); }} aria-label="Edytuj zadanie" title="Edytuj">✎</button>
        </div>
      </div>
      {expanded && <ProjectTaskInlineComments task={task} onChanged={loadPanelData} />}
    </div>;
  };

  if (collapsed) {
    return <aside className="project-details-collapsed" onClick={onToggleCollapse}>
      <button type="button" onClick={(event) => { event.stopPropagation(); onToggleCollapse(); }} title="Pokaż szczegóły"><ChevronRight size={15} /><span>Szczegóły</span></button>
    </aside>;
  }

  return <aside className="project-details-panel" style={{ width: `${width}px` }}>
    <div className="project-details-splitter" onMouseDown={onResizeStart} title="Zmień szerokość panelu" />
    <div className="project-details-header">
      <button type="button" className="project-icon-action" onClick={onToggleCollapse} aria-label="Zwiń panel" title="Zwiń panel"><ChevronLeft size={15} /></button>
      <div>
        <span className="project-details-type">Projekt</span>
        <strong>{project ? projectTitle : 'Wybierz projekt'}</strong>
        {project && <span>{project.status || '—'} · Termin: {project.due_date || 'brak'}</span>}
      </div>
    </div>
    {!project && <EmptyState title="Wybierz projekt z listy." description="Pojedynczy klik pokazuje zadania i sekcje. Dwuklik otwiera kartotekę." />}
    {project && <div className="project-details-body">
      {notice && <div className="notice">{notice}</div>}
      <div className="project-details-toolbar">
        <button type="button" className="project-icon-action primary-action" onClick={() => openNewTask(null)} aria-label="Dodaj zadanie" title="Dodaj zadanie"><Plus size={15} /></button>
        <button type="button" className="project-icon-action" onClick={() => { setNewSectionName(''); setSectionNameError(''); setSectionModalOpen(true); }} aria-label="Dodaj sekcję" title="Dodaj sekcję"><Columns3 size={15} /></button>
      </div>
      {loading && <div className="loading-line">Ładowanie szczegółów projektu...</div>}
      {!loading && <div className="project-detail-sections">
        {sections.map((section) => {
          const sid = String(section.id ?? section.localId);
          const sectionTasks = tasksBySection(sid);
          const sectionCollapsed = collapsedSections.has(sid);
          return <section className="project-detail-section" key={sid}>
            <div className="project-detail-section-head">
              <button type="button" className="project-detail-section-toggle" onClick={() => toggleSection(sid)}>
                <span>{sectionCollapsed ? '▸' : '▾'}</span><strong>{section.name}</strong><em>({sectionTasks.length})</em>
              </button>
              <button type="button" className="project-detail-section-action" onClick={(event) => { event.stopPropagation(); openNewTask(sid); }} aria-label={`Dodaj zadanie do sekcji ${section.name}`} title="Dodaj zadanie do sekcji"><Plus size={13} /></button>
              <button type="button" className="project-detail-section-delete" onClick={(event) => { event.stopPropagation(); removeSection(section, sectionTasks); }} aria-label={`Usuń sekcję ${section.name}`} title="Usuń sekcję"><Trash2 size={13} /></button>
            </div>
            {!sectionCollapsed && <div className="project-detail-task-list">{sectionTasks.map(renderTask)}{!sectionTasks.length && <div className="project-detail-empty">Brak zadań.</div>}</div>}
          </section>;
        })}
        {(sections.length === 0 || unsectionedTasks.length > 0) && <section className="project-detail-section">
          <div className="project-detail-section-head">
            <button type="button" className="project-detail-section-toggle" onClick={() => toggleSection('__unsectioned__')}>
              <span>{collapsedSections.has('__unsectioned__') ? '▸' : '▾'}</span><strong>Bez sekcji</strong><em>({unsectionedTasks.length})</em>
            </button>
          </div>
          {!collapsedSections.has('__unsectioned__') && <div className="project-detail-task-list">{unsectionedTasks.map(renderTask)}{!unsectionedTasks.length && <div className="project-detail-empty">Brak zadań.</div>}</div>}
        </section>}
      </div>}
    </div>}
    {taskEditorOpen && <ProjectTaskEditor task={editingTask} projectId={projectId} sections={sections} onClose={() => { setTaskEditorOpen(false); setEditingTask(null); }} onSave={saveTask} />}
    {sectionModalOpen && <ModalFrame className="project-section-modal" title="Nowa sekcja" onClose={() => setSectionModalOpen(false)} footer={<><ButtonSecondary onClick={() => setSectionModalOpen(false)}>Anuluj</ButtonSecondary><ButtonPrimary onClick={addSection}><Plus size={15} />Dodaj</ButtonPrimary></>}>
      <FormField label="Nazwa sekcji" error={sectionNameError}>
        <AppInput value={newSectionName} onChange={(event) => { setNewSectionName(event.target.value.slice(0, 100)); setSectionNameError(''); }} onKeyDown={(event) => { if (event.key === 'Enter') addSection(); }} maxLength={100} autoFocus />
      </FormField>
    </ModalFrame>}
    {confirmDialog && <ConfirmDialog title={confirmDialog.title} message={confirmDialog.message} confirmLabel={confirmDialog.confirmLabel} cancelLabel={confirmDialog.cancelLabel} variant={confirmDialog.variant} onConfirm={confirmDialog.onConfirm} onCancel={() => setConfirmDialog(null)} />}
  </aside>;
}

function SimpleTaskDetailsPanel({ task, collapsed, width, onResizeStart, onToggleCollapse, onEditTask, onStatusChange, onChanged }) {
  const done = Boolean(task?.archived) || ORGANIZER_TERMINAL_STATUSES.includes(task?.status);
  const title = String(task?.title ?? '').trim() || 'Zadanie bez tytułu';

  if (collapsed) {
    return <aside className="project-details-collapsed" onClick={onToggleCollapse}>
      <button type="button" onClick={(event) => { event.stopPropagation(); onToggleCollapse(); }} title="Pokaż szczegóły"><ChevronRight size={15} /><span>Szczegóły</span></button>
    </aside>;
  }

  return <aside className="project-details-panel simple-task-details-panel" style={{ width: `${width}px` }}>
    <div className="project-details-splitter" onMouseDown={onResizeStart} title="Zmień szerokość panelu" />
    <div className="project-details-header">
      <button type="button" className="project-icon-action" onClick={onToggleCollapse} aria-label="Zwiń panel" title="Zwiń panel"><ChevronLeft size={15} /></button>
      <div>
        <span className="project-details-type">Zadanie</span>
        <strong>{task ? title : 'Wybierz zadanie'}</strong>
        {task && <span>{task.status || '—'} · Termin: {task.due_date || 'brak'}</span>}
      </div>
    </div>
    {!task && <EmptyState title="Wybierz zadanie lub projekt z listy." />}
    {task && <div className="project-details-body">
      <div className="project-details-toolbar">
        <button type="button" className={`project-task-done-toggle ${done ? 'checked' : ''}`} onClick={() => onStatusChange(task, done ? ORGANIZER_TASK_STATUSES[0] : 'Zrobione')} aria-label={done ? 'Przywróć zadanie jako aktywne' : 'Oznacz zadanie jako wykonane'} title={done ? 'Przywróć jako aktywne' : 'Oznacz jako wykonane'}>
          {done && <CheckCircle2 size={16} />}
        </button>
        <button type="button" className="project-icon-action" onClick={() => onEditTask(task)} aria-label="Edytuj zadanie" title="Edytuj zadanie">✎</button>
      </div>
      <div className={`simple-task-details-card ${done ? 'is-done' : ''}`}>
        <strong>{title}</strong>
        <dl>
          <div><dt>Status</dt><dd>{task.status || '—'}</dd></div>
          <div><dt>Priorytet</dt><dd>{task.priority || '—'}</dd></div>
          <div><dt>Termin</dt><dd>{task.due_date || 'brak'}</dd></div>
          <div><dt>Przypomnienie</dt><dd>{task.reminder_at ? formatServiceDateTime(task.reminder_at) : 'brak'}</dd></div>
          {task.category && <div><dt>Kategoria</dt><dd>{task.category}</dd></div>}
          {task.linked_label && <div><dt>Powiązanie</dt><dd>{task.linked_label}</dd></div>}
        </dl>
        <p>{task.description || 'Brak opisu.'}</p>
      </div>
      <SimpleTaskComments task={task} onChanged={onChanged} />
    </div>}
  </aside>;
}

function ProjectsModule({ dashboardIntent, onConsumeDashboardIntent }) {
  const [rows, setRows] = useState([]);
  const [organizerRows, setOrganizerRows] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [filters, setFilters] = useStoredState('fixer-projects-filters', { search: '', type: 'all', status: '', priority: '' });
  const [historyCollapsed, setHistoryCollapsed] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [taskEditorOpen, setTaskEditorOpen] = useState(false);
  const [editingSimpleTask, setEditingSimpleTask] = useState(null);
  const [categories, setCategories] = useState(DEFAULT_ORGANIZER_CATEGORIES);
  const [pendingOpenProjectId, setPendingOpenProjectId] = useState(null);
  const [pendingOpenSimpleTaskId, setPendingOpenSimpleTaskId] = useState(null);
  const [selectedProjectKey, setSelectedProjectKey] = useState(() => localStorage.getItem(PROJECT_DETAILS_SELECTED_KEY));
  const [detailsCollapsed, setDetailsCollapsed] = useState(getSavedProjectDetailsCollapsed);
  const [detailsWidth, setDetailsWidth] = useState(getSavedProjectDetailsWidth);
  const documentSettings = getDocumentSettings();

  const loadData = async () => {
    setLoading(true);
    const [projectsResult, clientsResult, tasksResult, catsResult] = await Promise.all([fetchProjects(), fetchClients(), fetchOrganizerTasks(), fetchOrganizerCategories()]);
    setRows(projectsResult.data ?? []);
    setClients(clientsResult.data ?? []);
    setOrganizerRows(tasksResult.data ?? []);
    setCategories((catsResult.data ?? []).map((item) => item.name).filter(Boolean));
    if (projectsResult.error) setNotice(`Nie udało się pobrać projektów: ${humanizeError(projectsResult.error)}`);
    else if (tasksResult.error) setNotice(`Nie udało się pobrać prostych zadań: ${humanizeError(tasksResult.error)}`);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    localStorage.setItem(PROJECT_DETAILS_COLLAPSED_KEY, detailsCollapsed ? 'true' : 'false');
  }, [detailsCollapsed]);

  useEffect(() => {
    if (selectedProjectKey) localStorage.setItem(PROJECT_DETAILS_SELECTED_KEY, selectedProjectKey);
  }, [selectedProjectKey]);

  useEffect(() => {
    if (!['projects', 'organizer'].includes(dashboardIntent?.type)) return;
    if (dashboardIntent.projectId) setPendingOpenProjectId(dashboardIntent.projectId);
    if (dashboardIntent.taskId) setPendingOpenSimpleTaskId(dashboardIntent.taskId);
    if (dashboardIntent.filter === 'tasks') setFilters((current) => ({ ...current, type: 'task' }));
    onConsumeDashboardIntent?.();
  }, [dashboardIntent, onConsumeDashboardIntent]);

  useEffect(() => {
    if (!pendingOpenProjectId || !rows.length) return;
    const project = rows.find((r) => String(r.id ?? r.localId) === String(pendingOpenProjectId));
    if (project) setSelectedProjectKey(`project:${project.id ?? project.localId}`);
    setPendingOpenProjectId(null);
  }, [pendingOpenProjectId, rows]);

  useEffect(() => {
    if (!pendingOpenSimpleTaskId || !organizerRows.length) return;
    const task = organizerRows.find((r) => String(r.id ?? r.localId) === String(pendingOpenSimpleTaskId));
    if (task) {
      setSelectedProjectKey(`task:${task.id ?? task.localId}`);
      setFilters((current) => ({ ...current, type: 'task' }));
    }
    setPendingOpenSimpleTaskId(null);
  }, [pendingOpenSimpleTaskId, organizerRows]);

  const activeRows = rows.filter((r) => !r.archived);
  const historyRows = rows.filter((r) => r.archived);

  const saveProject = async (form) => {
    if (!String(form.name ?? '').trim()) { setNotice('Nazwa projektu jest wymagana'); return; }
    const projectId = form.id ?? form.localId;
    const isTerminal = projectId && PROJECT_TERMINAL_STATUSES.includes(form.status);
    const wasArchived = editingProject?.archived;

    const doSave = async (finalForm) => {
      const result = projectId ? await updateProject(projectId, finalForm) : await createProject(finalForm);
      if (result.error) { setNotice(humanizeError(result.error, 'Błąd zapisu projektu')); return; }
      setEditorOpen(false);
      setEditingProject(null);
      await loadData();
    };

    if (isTerminal && !wasArchived) {
      setConfirmDialog({
        title: 'Archiwizacja projektu',
        message: 'Przenieść projekt do historii?',
        confirmLabel: 'Przenieś do historii',
        cancelLabel: 'Anuluj',
        variant: 'secondary',
        onConfirm: async () => {
          setConfirmDialog(null);
          await doSave({ ...form, archived: true, completed_at: form.completed_at || new Date().toISOString() });
        }
      });
      return;
    }
    await doSave(form);
  };

  const handleDelete = async (project) => {
    setConfirmDialog({
      title: 'Usuń projekt',
      message: `Usunąć projekt "${project.name}"?`,
      confirmLabel: 'Usuń',
      cancelLabel: 'Anuluj',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmDialog(null);
        const result = await deleteProject(project.id ?? project.localId, project);
        if (result.error) { setNotice(humanizeError(result.error, 'Błąd usuwania projektu')); return; }
        await loadData();
      }
    });
  };

  const handleRestore = async (project) => {
    if (!project) return;
    await updateProject(project.id ?? project.localId, { ...project, archived: false, status: 'Planowany', completed_at: null });
    await loadData();
  };

  const setProjectStatus = async (project, nextStatus) => {
    if (!project || nextStatus === project.status) return;
    const projectId = project.id ?? project.localId;
    const isTerminal = PROJECT_TERMINAL_STATUSES.includes(nextStatus);
    const doUpdate = async (payload) => {
      const result = await updateProject(projectId, payload);
      if (result.error) { setNotice(humanizeError(result.error, 'Błąd zmiany statusu projektu')); return; }
      setRows((current) => current.map((row) => String(row.id ?? row.localId) === String(projectId) ? { ...row, ...payload, ...(result.data ?? {}) } : row));
    };
    if (isTerminal && !project.archived) {
      setConfirmDialog({
        title: 'Archiwizacja projektu',
        message: 'Przenieść projekt do historii?',
        confirmLabel: 'Przenieś do historii',
        cancelLabel: 'Anuluj',
        variant: 'secondary',
        onConfirm: async () => {
          setConfirmDialog(null);
          await doUpdate({ ...project, status: nextStatus, archived: true, completed_at: project.completed_at || new Date().toISOString() });
        }
      });
      return;
    }
    await doUpdate({ ...project, status: nextStatus, archived: isTerminal ? true : project.archived, completed_at: isTerminal ? (project.completed_at || new Date().toISOString()) : project.completed_at });
  };

  const setProjectPriority = async (project, nextPriority) => {
    if (!project || nextPriority === project.priority) return;
    const projectId = project.id ?? project.localId;
    const result = await updateProject(projectId, { ...project, priority: nextPriority });
    if (result.error) { setNotice(humanizeError(result.error, 'Błąd zmiany priorytetu projektu')); return; }
    setRows((current) => current.map((row) => String(row.id ?? row.localId) === String(projectId) ? { ...row, priority: nextPriority, ...(result.data ?? {}) } : row));
  };

  const saveSimpleTask = async (task) => {
    if (!String(task.title ?? '').trim()) { alert('Tytuł zadania jest wymagany.'); return; }
    const result = task.id || task.localId
      ? await updateOrganizerTask(task.id ?? task.localId, task)
      : await createOrganizerTask(task);
    if (result.error) { setNotice(humanizeError(result.error, 'Błąd zapisu zadania')); return; }
    setTaskEditorOpen(false);
    setEditingSimpleTask(null);
    await loadData();
  };

  const setSimpleTaskStatus = async (task, nextStatus) => {
    if (!task || nextStatus === task.status) return;
    const done = ORGANIZER_TERMINAL_STATUSES.includes(nextStatus);
    const payload = {
      ...task,
      status: nextStatus,
      archived: done,
      completed_date: done ? (task.completed_date || getLocalIsoDate()) : null
    };
    const result = await updateOrganizerTask(task.id ?? task.localId, payload);
    if (result.error) { setNotice(humanizeError(result.error, 'Błąd zmiany statusu zadania')); return; }
    setOrganizerRows((current) => current.map((row) => String(row.id ?? row.localId) === String(task.id ?? task.localId) ? { ...row, ...payload, ...(result.data ?? {}) } : row));
  };

  const setSimpleTaskPriority = async (task, nextPriority) => {
    if (!task || nextPriority === task.priority) return;
    const result = await updateOrganizerTask(task.id ?? task.localId, { ...task, priority: nextPriority });
    if (result.error) { setNotice(humanizeError(result.error, 'Błąd zmiany priorytetu zadania')); return; }
    setOrganizerRows((current) => current.map((row) => String(row.id ?? row.localId) === String(task.id ?? task.localId) ? { ...row, priority: nextPriority, ...(result.data ?? {}) } : row));
  };

  const deleteSimpleTask = async (task) => {
    setConfirmDialog({
      title: 'Usuń zadanie',
      message: `Usunąć zadanie "${task.title}"?`,
      confirmLabel: 'Usuń',
      cancelLabel: 'Anuluj',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmDialog(null);
        const result = await deleteOrganizerTask(task.id ?? task.localId, task);
        if (result.error) { setNotice(humanizeError(result.error, 'Błąd usuwania zadania')); return; }
        await loadData();
      }
    });
  };

  const openNewProject = () => { setEditingProject(null); setEditorOpen(true); };
  const openProject = (project) => { setEditingProject(project); setEditorOpen(true); };
  const openNewSimpleTask = () => { setEditingSimpleTask(null); setTaskEditorOpen(true); };
  const openSimpleTask = (task) => { setEditingSimpleTask(task); setTaskEditorOpen(true); };

  const activeColumns = [
    { key: 'type_label', label: 'Typ', align: 'center', renderCell: (row) => <span className={`work-type-pill ${row._workType}`}>{row.type_label}</span> },
    { key: 'displayTitle', label: 'Nazwa', renderCell: (row) => <span className={`${row._workType === 'project' ? 'work-title-project' : ''} ${row._workType === 'task' && row._source?.archived ? 'work-title-done' : ''}`.trim()}>{row.displayTitle}</span> },
    { key: 'client_name', label: 'Klient / powiązanie' },
    { key: 'status', label: 'Status', renderCell: (row) => <ServiceStatusCell value={row.status} statuses={row._workType === 'project' ? PROJECT_STATUSES : ORGANIZER_TASK_STATUSES} onStatusChange={(status) => row._workType === 'project' ? setProjectStatus(row._source, status) : setSimpleTaskStatus(row._source, status)} /> },
    { key: 'priority', label: 'Priorytet', renderCell: (row) => <ServiceStatusCell value={row.priority} statuses={row._workType === 'project' ? PROJECT_PRIORITIES : ORGANIZER_TASK_PRIORITIES} onStatusChange={(priority) => row._workType === 'project' ? setProjectPriority(row._source, priority) : setSimpleTaskPriority(row._source, priority)} /> },
    { key: 'due_date', label: 'Termin' }
  ];

  const historyColumns = [
    { key: 'project_number', label: 'Numer' },
    { key: 'displayTitle', label: 'Nazwa' },
    { key: 'client_name', label: 'Klient' },
    { key: 'status', label: 'Status', renderCell: (row) => <ServiceStatusCell value={row.status} statuses={PROJECT_STATUSES} onStatusChange={(status) => setProjectStatus(row._project ?? row, status)} /> },
    { key: 'priority', label: 'Priorytet' },
    { key: 'due_date', label: 'Termin' },
    { key: 'completed_display', label: 'Zakończono' }
  ];

  const mapProjectRow = (r) => ({
    ...r,
    _project: r,
    _source: r,
    _workType: 'project',
    itemType: 'project',
    work_key: `project:${r.id ?? r.localId}`,
    type_label: 'Projekt',
    displayTitle: String(r.name ?? '').trim() || 'Projekt bez nazwy',
    title: String(r.name ?? '').trim() || 'Projekt bez nazwy',
    client_name: r.clients?.name ?? '',
    completed_display: r.completed_at ? formatDashboardDate(r.completed_at) : '—'
  });

  const mapTaskRow = (task) => ({
    ...task,
    _task: task,
    _source: task,
    _workType: 'task',
    itemType: 'task',
    work_key: `task:${task.id ?? task.localId}`,
    type_label: 'Zadanie',
    displayTitle: String(task.title ?? '').trim() || 'Zadanie bez tytułu',
    title: String(task.title ?? '').trim() || 'Zadanie bez tytułu',
    client_name: task.linked_label || task.category || '',
    completed_display: task.completed_date ? formatDashboardDate(task.completed_date) : '—'
  });

  const workRows = [...activeRows.map(mapProjectRow), ...organizerRows.map(mapTaskRow)];
  const filterWorkRows = (source) => source.filter((row) => {
    const q = (filters.search ?? '').toLowerCase().trim();
    if ((filters.type ?? 'all') !== 'all' && row._workType !== filters.type) return false;
    if (filters.status && row.status !== filters.status) return false;
    if (filters.priority && row.priority !== filters.priority) return false;
    if (q && !`${row.displayTitle} ${row.project_number ?? ''} ${row.client_name ?? ''} ${row.description ?? ''} ${row.status ?? ''} ${row.priority ?? ''}`.toLowerCase().includes(q)) return false;
    return true;
  });

  const activeTableRows = filterWorkRows(workRows);
  const historyTableRows = historyRows.map(mapProjectRow);
  const selectedWork = activeTableRows.find((row) => row.work_key === selectedProjectKey)
    ?? activeTableRows.find((row) => selectedProjectKey && String(row.id ?? row.localId) === String(selectedProjectKey))
    ?? activeTableRows[0]
    ?? null;
  const selectedProject = selectedWork?._workType === 'project' ? selectedWork._source : null;
  const selectedSimpleTask = selectedWork?._workType === 'task' ? selectedWork._source : null;

  const selectWorkItem = (row) => {
    setSelectedProjectKey(row.work_key ?? `${row._workType}:${row.id ?? row.localId}`);
  };

  const openWorkItem = (row) => row._workType === 'project' ? openProject(row._source) : openSimpleTask(row._source);
  const deleteWorkItem = (row) => row._workType === 'project' ? handleDelete(row._source) : deleteSimpleTask(row._source);

  const startDetailsResize = (event) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = detailsWidth;
    const onMouseMove = (moveEvent) => {
      const nextWidth = Math.min(Math.max(340, startWidth - (moveEvent.clientX - startX)), Math.max(420, window.innerWidth * 0.68));
      setDetailsWidth(nextWidth);
      localStorage.setItem(PROJECT_DETAILS_WIDTH_KEY, String(Math.round(nextWidth)));
    };
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.classList.remove('resizing-project-details');
    };
    document.body.classList.add('resizing-project-details');
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const listSubtitle = (filters.type ?? 'all') === 'task'
    ? 'Lista zadań'
    : (filters.type ?? 'all') === 'project'
      ? 'Lista projektów'
      : 'Lista zadań i projektów';

  return <div className={`module-page projects-module-page ${detailsCollapsed ? 'details-collapsed' : ''}`}>
    <div className="projects-workspace">
      <div className="projects-list-pane">
        <section className="panel hero-panel projects-actions-panel">
          <div className="module-actions">
            <AppButton variant="primary" className="module-action-button" onClick={openNewSimpleTask}><Plus size={18} />Proste zadanie</AppButton>
            <AppButton variant="secondary" className="module-action-button" onClick={openNewProject}><Plus size={18} />Projekt</AppButton>
            <AppButton variant="secondary" className="module-action-button" onClick={loadData}>Odśwież</AppButton>
            <AppButton variant="secondary" className="module-action-button" onClick={() => exportTableToCsv(PROJECTS_TABLE_KEY, activeColumns, activeTableRows)} disabled={!activeTableRows.length}><Download size={16} />CSV</AppButton>
            <AppButton variant="secondary" className="module-action-button" onClick={() => exportTableToPdf('Zadania i projekty', PROJECTS_TABLE_KEY, activeColumns, activeTableRows)} disabled={!activeTableRows.length}><FileText size={16} />PDF</AppButton>
          </div>
          {notice && <div className="notice">{notice}</div>}
        </section>

        <section className="panel service-list-panel rentals-records-section projects-list-panel">
          <div className="rentals-section-heading">
            <div>
              <p className="eyebrow">Zadania i projekty</p>
              <h3>{listSubtitle}</h3>
            </div>
            <span>{activeTableRows.length} pozycji</span>
          </div>
          <div className="module-filters project-filter-bar">
            <div className="work-type-switch" role="group" aria-label="Typ wpisu">
              {[['all', 'Wszystko'], ['task', 'Zadania'], ['project', 'Projekty']].map(([value, label]) => (
                <button key={value} type="button" className={(filters.type ?? 'all') === value ? 'active' : ''} onClick={() => setFilters((current) => ({ ...current, type: value }))}>{label}</button>
              ))}
            </div>
            <AppInput placeholder="Szukaj..." value={filters.search ?? ''} onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))} />
            <AppSelect value={filters.status ?? ''} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
              <option value="">Wszystkie statusy</option>
              {PROJECT_STATUSES.filter((s) => !PROJECT_TERMINAL_STATUSES.includes(s)).map((s) => <option key={s}>{s}</option>)}
              {ORGANIZER_TASK_STATUSES.filter((s) => !PROJECT_STATUSES.includes(s)).map((s) => <option key={s}>{s}</option>)}
            </AppSelect>
            <AppSelect value={filters.priority ?? ''} onChange={(e) => setFilters((f) => ({ ...f, priority: e.target.value }))}>
              <option value="">Wszystkie priorytety</option>
              {[...new Set([...PROJECT_PRIORITIES, ...ORGANIZER_TASK_PRIORITIES])].map((p) => <option key={p}>{p}</option>)}
            </AppSelect>
          </div>
          <DataTable storageKey={PROJECTS_TABLE_KEY} loading={loading} columns={activeColumns} rows={activeTableRows}
            getRowClassName={(row) => row._workType ? `work-row work-row-${row._workType}` : ''}
            onRowClick={selectWorkItem} onOpen={openWorkItem} onEdit={openWorkItem} onDelete={deleteWorkItem} openLabel="Otwórz" editLabel="Edytuj" deleteLabel="Usuń" />
        </section>

        <AppSection title={<button type="button" className="history-toggle-button" onClick={() => setHistoryCollapsed((v) => !v)}>
          Historia projektów {historyCollapsed ? '▸' : '▾'} <span className="history-count">({historyRows.length})</span>
        </button>}>
          {!historyCollapsed && <DataTable storageKey={PROJECTS_HISTORY_TABLE_KEY} columns={historyColumns} rows={historyTableRows}
            onRowClick={selectWorkItem} onOpen={openProject} onEdit={openProject} onDelete={handleDelete} openLabel="Otwórz"
            customRowActions={[{ key: 'restore', label: 'Przywróć projekt', icon: RotateCcw, onClick: (row) => handleRestore(rows.find((r) => String(r.id ?? r.localId) === String(row.id ?? row.localId))) }]}
          />}
        </AppSection>
      </div>
      {selectedSimpleTask
        ? <SimpleTaskDetailsPanel task={selectedSimpleTask} collapsed={detailsCollapsed} width={detailsWidth} onResizeStart={startDetailsResize} onToggleCollapse={() => setDetailsCollapsed((value) => !value)} onEditTask={openSimpleTask} onStatusChange={setSimpleTaskStatus} onChanged={loadData} />
        : <ProjectDetailsPanel project={selectedProject} collapsed={detailsCollapsed} width={detailsWidth} onResizeStart={startDetailsResize} onToggleCollapse={() => setDetailsCollapsed((value) => !value)} onRefreshProject={loadData} />}
    </div>

    {editorOpen && <ProjectEditor project={editingProject} clients={clients} allProjects={rows} documentSettings={documentSettings} onClose={() => { setEditorOpen(false); setEditingProject(null); }} onSave={saveProject} />}
    {taskEditorOpen && <OrganizerTaskEditor task={editingSimpleTask} categories={categories} onClose={() => { setTaskEditorOpen(false); setEditingSimpleTask(null); }} onSave={saveSimpleTask} />}
    {confirmDialog && <ConfirmDialog title={confirmDialog.title} message={confirmDialog.message} confirmLabel={confirmDialog.confirmLabel} cancelLabel={confirmDialog.cancelLabel} variant={confirmDialog.variant} onConfirm={confirmDialog.onConfirm} onCancel={() => setConfirmDialog(null)} />}
  </div>;
}

function OrganizerTaskEditor({ task, categories, onClose, onSave }) {
  const [form, setForm] = useState(() => ({
    title: task?.title ?? '',
    description: task?.description ?? '',
    status: task?.status ?? ORGANIZER_TASK_STATUSES[0],
    priority: task?.priority ?? 'Normalny',
    due_date: task?.due_date ?? '',
    reminder_at: task?.reminder_at ? String(task.reminder_at).slice(0, 16) : '',
    category: task?.category ?? '',
    linked_module: task?.linked_module ?? '',
    linked_label: task?.linked_label ?? '',
    ...(task ? { id: task.id, localId: task.localId, archived: task.archived, completed_date: task.completed_date, created_at: task.created_at } : {})
  }));
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const submit = () => {
    if (!form.title.trim()) { alert('Tytuł zadania jest wymagany.'); return; }
    onSave({ ...form, reminder_at: form.reminder_at ? new Date(form.reminder_at).toISOString() : null, due_date: form.due_date || null });
  };
  return <ResizableModalFrame
    className="organizer-task-modal"
    storageKey="fixer-organizer-task-modal"
    defaultSize={{ width: 760, height: 560 }}
    minSize={{ width: 560, height: 420 }}
    eyebrow="Zadania i projekty"
    title={form.title || 'Nowe zadanie'}
    onClose={onClose}
    footer={<><ButtonSecondary onClick={onClose}>Anuluj</ButtonSecondary><ButtonPrimary onClick={submit}><Save size={16} />Zapisz</ButtonPrimary></>}
  >
    <div className="organizer-task-fields organizer-task-compact-form">
      <FormField label="Tytuł *"><AppInput value={form.title} onChange={(e) => update('title', e.target.value)} placeholder="Co trzeba zrobić?" /></FormField>
      <FormField label="Opis"><AppTextarea value={form.description} onChange={(e) => update('description', e.target.value)} rows={3} placeholder="Opcjonalne szczegóły, notatki, instrukcje..." /></FormField>
      <div className="organizer-task-meta-grid">
        <div className="organizer-task-meta-column">
          <FormField label="Status"><AppSelect value={form.status} onChange={(e) => update('status', e.target.value)}>{ORGANIZER_TASK_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</AppSelect></FormField>
          <FormField label="Priorytet"><AppSelect value={form.priority} onChange={(e) => update('priority', e.target.value)}>{ORGANIZER_TASK_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}</AppSelect></FormField>
          <FormField label="Kategoria"><AppSelect value={form.category} onChange={(e) => update('category', e.target.value)}><option value="">Brak kategorii</option>{categories.map((c) => <option key={c} value={c}>{c}</option>)}</AppSelect></FormField>
        </div>
        <div className="organizer-task-meta-column">
          <FormField label="Termin wykonania"><AppInput type="date" value={form.due_date} onChange={(e) => update('due_date', e.target.value)} /></FormField>
          <FormField label="Przypomnienie"><AppInput type="datetime-local" value={form.reminder_at} onChange={(e) => update('reminder_at', e.target.value)} /></FormField>
          <FormField label="Powiązanie z modułem"><AppSelect value={form.linked_module} onChange={(e) => update('linked_module', e.target.value)}><option value="">Brak</option><option value="service">Serwis</option><option value="rental">Wypożyczenie</option><option value="client">Klient</option><option value="equipment">Sprzęt</option></AppSelect></FormField>
        </div>
      </div>
      {form.linked_module && <FormField label="Opis powiązania"><AppInput value={form.linked_label} onChange={(e) => update('linked_label', e.target.value)} placeholder="np. numer zlecenia" /></FormField>}
    </div>
  </ResizableModalFrame>;
}

function SettingsModule({ dashboardIntent, onConsumeDashboardIntent, colorTheme, onChangeColorTheme, statusColors, onStatusColorChange, activeUiTheme, onChangeActiveUiTheme }) {
  return <div className="module-page settings-module-page compact-settings-page">
    <SettingsV2 mode="settings" dashboardIntent={dashboardIntent} onConsumeDashboardIntent={onConsumeDashboardIntent} colorTheme={colorTheme} onChangeColorTheme={onChangeColorTheme} statusColors={statusColors} onStatusColorChange={onStatusColorChange} activeUiTheme={activeUiTheme} onChangeActiveUiTheme={onChangeActiveUiTheme} />
  </div>;
}

function DocumentsModule({ dashboardIntent, onConsumeDashboardIntent, colorTheme, onChangeColorTheme, statusColors, onStatusColorChange, activeUiTheme, onChangeActiveUiTheme }) {
  return <div className="module-page settings-module-page compact-settings-page documents-module-page">
    <SettingsV2 mode="documents" dashboardIntent={dashboardIntent} onConsumeDashboardIntent={onConsumeDashboardIntent} colorTheme={colorTheme} onChangeColorTheme={onChangeColorTheme} statusColors={statusColors} onStatusColorChange={onStatusColorChange} activeUiTheme={activeUiTheme} onChangeActiveUiTheme={onChangeActiveUiTheme} />
  </div>;
}
function getStoredJson(key, fallback) {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
}

function useStoredState(key, fallback) {
  const [value, setValue] = useState(() => getStoredJson(key, fallback));
  const updateValue = (nextValue) => {
    setValue((current) => {
      const resolved = typeof nextValue === 'function' ? nextValue(current) : nextValue;
      localStorage.setItem(key, JSON.stringify(resolved));
      return resolved;
    });
  };
  return [value, updateValue];
}

const UI_THEME_PRESETS_STORAGE_KEY = 'fixer:ui-theme-presets';
const UI_THEME_ACTIVE_STORAGE_KEY = 'fixer:active-ui-theme';

const UI_THEME_TOKEN_DEFINITIONS = [
  { key: 'appBg', cssVar: '--fw-color-app-bg', label: 'Tło aplikacji', description: 'Główne tło całego interfejsu.' },
  { key: 'panelBg', cssVar: '--fw-color-surface', label: 'Tło paneli / kart', description: 'Powierzchnia kart, paneli i sekcji.' },
  { key: 'tableBg', cssVar: '--fw-color-table-bg', label: 'Tło tabel', description: 'Tło obszaru tabel i list.' },
  { key: 'border', cssVar: '--fw-color-border', label: 'Obramowania', description: 'Kolor granic i separatorów.' },
  { key: 'textMain', cssVar: '--fw-color-text', label: 'Tekst główny', description: 'Podstawowy kolor tekstu.' },
  { key: 'textMuted', cssVar: '--fw-color-text-muted', label: 'Tekst drugorzędny', description: 'Opisy, metadane i mniej ważne treści.' },
  { key: 'accent', cssVar: '--fw-color-primary', label: 'Kolor akcentu', description: 'Akcje i wyróżnienia interfejsu.' },
  { key: 'menuActive', cssVar: '--fw-color-menu-active', label: 'Aktywna pozycja menu', description: 'Kolor aktywnego elementu nawigacji.' },
  { key: 'primaryButton', cssVar: '--fw-color-button-primary', label: 'Przycisk główny', description: 'Kolor przycisków typu primary.' },
  { key: 'success', cssVar: '--fw-color-success', label: 'Sukces', description: 'Kolor komunikatów i akcji pozytywnych.' },
  { key: 'warning', cssVar: '--fw-color-warning', label: 'Ostrzeżenie', description: 'Kolor ostrzeżeń i uwag.' },
  { key: 'danger', cssVar: '--fw-color-danger', label: 'Błąd', description: 'Kolor błędów i akcji destrukcyjnych.' }
];

const BUILTIN_UI_THEME_PRESETS = [
  {
    id: 'default-light',
    name: 'Domyślny jasny',
    description: 'jasny neutralny',
    group: 'light',
    builtIn: true,
    tokens: {
      appBg: '#f4f7fb',
      panelBg: '#ffffff',
      tableBg: '#ffffff',
      border: '#cbd5e1',
      textMain: '#172033',
      textMuted: '#64748b',
      accent: '#2563eb',
      menuActive: '#1d4ed8',
      primaryButton: '#2563eb',
      success: '#16a34a',
      warning: '#d97706',
      danger: '#dc2626'
    }
  },
  {
    id: 'clean-white',
    name: 'Clean White',
    description: 'jasny czysty',
    group: 'light',
    builtIn: true,
    tokens: {
      appBg: '#FFFFFF',
      panelBg: '#FFFFFF',
      tableBg: '#FFFFFF',
      border: '#E5E7EB',
      textMain: '#111827',
      textMuted: '#6B7280',
      accent: '#3B82F6',
      menuActive: '#2563EB',
      primaryButton: '#2563EB',
      success: '#16A34A',
      warning: '#D97706',
      danger: '#DC2626'
    }
  },
  {
    id: 'soft-gray',
    name: 'Soft Gray',
    description: 'jasny miękki',
    group: 'light',
    builtIn: true,
    tokens: {
      appBg: '#E9EDF2',
      panelBg: '#F2F5F8',
      tableBg: '#F7F9FC',
      border: '#B6C0CD',
      textMain: '#202939',
      textMuted: '#5F6B7D',
      accent: '#64748B',
      menuActive: '#475569',
      primaryButton: '#4B5563',
      success: '#059669',
      warning: '#D97706',
      danger: '#DC2626'
    }
  },
  {
    id: 'blue-light',
    name: 'Blue Light',
    description: 'jasny niebieski',
    group: 'light',
    builtIn: true,
    tokens: {
      appBg: '#E6F0FF',
      panelBg: '#F1F7FF',
      tableBg: '#F8FBFF',
      border: '#93C5FD',
      textMain: '#0F2A5F',
      textMuted: '#36507A',
      accent: '#1D4ED8',
      menuActive: '#1E3A8A',
      primaryButton: '#1E40AF',
      success: '#16A34A',
      warning: '#D97706',
      danger: '#DC2626'
    }
  },
  {
    id: 'warm-paper',
    name: 'Warm Paper',
    description: 'ciepły jasny',
    group: 'light',
    builtIn: true,
    tokens: {
      appBg: '#F3EBDD',
      panelBg: '#FAF2E6',
      tableBg: '#FFF8EE',
      border: '#CDB79F',
      textMain: '#3A2D24',
      textMuted: '#7A6758',
      accent: '#B45309',
      menuActive: '#92400E',
      primaryButton: '#B45309',
      success: '#3F7D20',
      warning: '#B45309',
      danger: '#B91C1C'
    }
  },
  {
    id: 'studio-light',
    name: 'Studio Light',
    description: 'jasny studyjny',
    group: 'light',
    builtIn: true,
    tokens: {
      appBg: '#E8EEF7',
      panelBg: '#F1F5FA',
      tableBg: '#F7FAFD',
      border: '#AEBED3',
      textMain: '#1B2433',
      textMuted: '#5E6B7E',
      accent: '#2563EB',
      menuActive: '#1E40AF',
      primaryButton: '#1D4ED8',
      success: '#16A34A',
      warning: '#D97706',
      danger: '#DC2626'
    }
  },
  {
    id: 'default-dark',
    name: 'Domyślny ciemny',
    description: 'ciemny bazowy',
    group: 'dark',
    builtIn: true,
    tokens: {
      appBg: '#080d15',
      panelBg: '#111827',
      tableBg: '#0f172a',
      border: '#334155',
      textMain: '#e6edf8',
      textMuted: '#95a0b5',
      accent: '#2563eb',
      menuActive: '#a5b4fc',
      primaryButton: '#2563eb',
      success: '#22c55e',
      warning: '#f59e0b',
      danger: '#fb7185'
    }
  },
  {
    id: 'graphite-pro',
    name: 'Graphite Pro',
    description: 'ciemny grafitowy',
    group: 'dark',
    builtIn: true,
    tokens: {
      appBg: '#0C0F14',
      panelBg: '#141A22',
      tableBg: '#11171F',
      border: '#2F3A49',
      textMain: '#E5E7EB',
      textMuted: '#9CA3AF',
      accent: '#6366F1',
      menuActive: '#A5B4FC',
      primaryButton: '#4F46E5',
      success: '#22C55E',
      warning: '#F59E0B',
      danger: '#F87171'
    }
  },
  {
    id: 'slate-pro',
    name: 'Slate Pro',
    description: 'ciemny łupkowy',
    group: 'dark',
    builtIn: true,
    tokens: {
      appBg: '#0B1220',
      panelBg: '#162235',
      tableBg: '#111C2E',
      border: '#2A3D57',
      textMain: '#E2E8F0',
      textMuted: '#94A3B8',
      accent: '#3B82F6',
      menuActive: '#93C5FD',
      primaryButton: '#2563EB',
      success: '#22C55E',
      warning: '#F59E0B',
      danger: '#EF4444'
    }
  },
  {
    id: 'night-gray',
    name: 'Night Gray',
    description: 'ciemny neutralny',
    group: 'dark',
    builtIn: true,
    tokens: {
      appBg: '#0f1117',
      panelBg: '#1a1f29',
      tableBg: '#151a23',
      border: '#3a4455',
      textMain: '#e5e7eb',
      textMuted: '#9ca3af',
      accent: '#8b9cf6',
      menuActive: '#c7d2fe',
      primaryButton: '#6366f1',
      success: '#34d399',
      warning: '#fbbf24',
      danger: '#f87171'
    }
  },
  {
    id: 'steel-blue',
    name: 'Steel Blue',
    description: 'ciemny stalowy',
    group: 'dark',
    builtIn: true,
    tokens: {
      appBg: '#0b1320',
      panelBg: '#122033',
      tableBg: '#0f1a2c',
      border: '#274464',
      textMain: '#dbeafe',
      textMuted: '#93c5fd',
      accent: '#3b82f6',
      menuActive: '#60a5fa',
      primaryButton: '#2563eb',
      success: '#22c55e',
      warning: '#f59e0b',
      danger: '#ef4444'
    }
  },
  {
    id: 'warm-slate',
    name: 'Warm Slate',
    description: 'ciemny ciepły',
    group: 'dark',
    builtIn: true,
    tokens: {
      appBg: '#1b1714',
      panelBg: '#241f1b',
      tableBg: '#201b18',
      border: '#4b4037',
      textMain: '#f3e8df',
      textMuted: '#c4b2a4',
      accent: '#d97706',
      menuActive: '#f59e0b',
      primaryButton: '#ea580c',
      success: '#65a30d',
      warning: '#f59e0b',
      danger: '#ef4444'
    }
  },
  {
    id: 'broadcast-dark',
    name: 'Broadcast Dark',
    description: 'ciemny broadcast',
    group: 'dark',
    builtIn: true,
    tokens: {
      appBg: '#05070D',
      panelBg: '#0D1220',
      tableBg: '#0A101A',
      border: '#22304A',
      textMain: '#E6EDF8',
      textMuted: '#94A3B8',
      accent: '#0EA5E9',
      menuActive: '#38BDF8',
      primaryButton: '#0284C7',
      success: '#10B981',
      warning: '#F59E0B',
      danger: '#FB7185'
    }
  },
  {
    id: 'carbon-blue',
    name: 'Carbon Blue',
    description: 'ciemny węglowo-niebieski',
    group: 'dark',
    builtIn: true,
    tokens: {
      appBg: '#070C15',
      panelBg: '#111827',
      tableBg: '#0E1624',
      border: '#2A3D57',
      textMain: '#DBEAFE',
      textMuted: '#93C5FD',
      accent: '#2563EB',
      menuActive: '#60A5FA',
      primaryButton: '#1D4ED8',
      success: '#22C55E',
      warning: '#F59E0B',
      danger: '#EF4444'
    }
  },
  {
    id: 'soft-dark',
    name: 'Soft Dark',
    description: 'ciemny miękki',
    group: 'dark',
    builtIn: true,
    tokens: {
      appBg: '#131722',
      panelBg: '#1B2231',
      tableBg: '#161D2A',
      border: '#364152',
      textMain: '#E5E7EB',
      textMuted: '#A1A1AA',
      accent: '#7C3AED',
      menuActive: '#C4B5FD',
      primaryButton: '#6D28D9',
      success: '#22C55E',
      warning: '#F59E0B',
      danger: '#F87171'
    }
  }
];

const DEFAULT_ACTIVE_THEME_ID = 'default-dark';

function normalizeHexColor(value, fallback = '#000000') {
  const raw = String(value ?? '').trim();
  if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw)) return fallback;
  const hex = raw.slice(1).toUpperCase();
  return hex.length === 3
    ? `#${hex.split('').map((part) => `${part}${part}`).join('')}`
    : `#${hex}`;
}

function normalizeUiThemeTokens(tokens = {}) {
  return UI_THEME_TOKEN_DEFINITIONS.reduce((acc, token) => {
    acc[token.key] = normalizeHexColor(tokens[token.key], '#000000');
    return acc;
  }, {});
}

function getUiThemeCustomPresets() {
  const raw = getStoredJson(UI_THEME_PRESETS_STORAGE_KEY, []);
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => ({
      id: item?.id || `custom-${Date.now()}`,
      name: String(item?.name ?? '').trim(),
      builtIn: false,
      tokens: normalizeUiThemeTokens(item?.tokens ?? {})
    }))
    .filter((item) => item.name);
}

function saveUiThemeCustomPresets(items) {
  localStorage.setItem(UI_THEME_PRESETS_STORAGE_KEY, JSON.stringify(items));
}

function getAllUiThemePresets() {
  return [...BUILTIN_UI_THEME_PRESETS, ...getUiThemeCustomPresets()];
}

function getStoredActiveUiTheme(preferredPresetId = DEFAULT_ACTIVE_THEME_ID) {
  const parsed = getStoredJson(UI_THEME_ACTIVE_STORAGE_KEY, null);
  if (!parsed || typeof parsed !== 'object') {
    const fallbackPreset = BUILTIN_UI_THEME_PRESETS.find((item) => item.id === preferredPresetId) ?? BUILTIN_UI_THEME_PRESETS[0];
    return { presetId: fallbackPreset.id, tokens: normalizeUiThemeTokens(fallbackPreset.tokens) };
  }
  const presetId = String(parsed.presetId ?? DEFAULT_ACTIVE_THEME_ID);
  const preset = getAllUiThemePresets().find((item) => item.id === presetId);
  const tokens = normalizeUiThemeTokens(parsed.tokens ?? preset?.tokens ?? BUILTIN_UI_THEME_PRESETS[0].tokens);
  return { presetId: preset ? preset.id : 'custom-live', tokens };
}

function saveActiveUiTheme(state) {
  localStorage.setItem(UI_THEME_ACTIVE_STORAGE_KEY, JSON.stringify({
    presetId: state?.presetId ?? 'custom-live',
    tokens: normalizeUiThemeTokens(state?.tokens ?? {})
  }));
}

function createUiThemeCssVariables(tokens) {
  const normalized = normalizeUiThemeTokens(tokens);
  const result = {};
  UI_THEME_TOKEN_DEFINITIONS.forEach((token) => {
    result[token.cssVar] = normalized[token.key];
  });
  result['--fw-color-primary-2'] = normalized.primaryButton;
  result['--fw-color-success-text'] = normalized.success;
  result['--fw-color-warning-text'] = normalized.warning;
  result['--fw-color-danger-text'] = normalized.danger;
  result['--fw-color-primary-soft'] = `${normalized.accent}1A`;
  result['--fw-color-primary-border'] = `${normalized.accent}66`;
  result['--fw-color-selection'] = `${normalized.accent}1F`;
  result['--fw-color-selection-bar'] = `${normalized.accent}CC`;
  return result;
}

function hexToRgb(hex) {
  const normalized = normalizeHexColor(hex, '#000000');
  const value = normalized.slice(1);
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16)
  };
}

function channelToLinear(value) {
  const normalized = value / 255;
  return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

function calculateContrastRatio(bgHex, textHex) {
  const bg = hexToRgb(bgHex);
  const text = hexToRgb(textHex);
  const bgLum = 0.2126 * channelToLinear(bg.r) + 0.7152 * channelToLinear(bg.g) + 0.0722 * channelToLinear(bg.b);
  const textLum = 0.2126 * channelToLinear(text.r) + 0.7152 * channelToLinear(text.g) + 0.0722 * channelToLinear(text.b);
  const lighter = Math.max(bgLum, textLum);
  const darker = Math.min(bgLum, textLum);
  return (lighter + 0.05) / (darker + 0.05);
}

function getThemePresetPalette(preset) {
  const tokens = preset?.tokens ?? {};
  return [tokens.appBg, tokens.panelBg, tokens.accent, tokens.primaryButton, tokens.menuActive].map((value) => normalizeHexColor(value, '#000000'));
}

const COMPANY_PROFILE_STORAGE_KEY = 'fixer-company-profile';
const DEFAULT_COMPANY_PROFILE = {
  name: '',
  legalName: '',
  nip: '',
  regon: '',
  krs: '',
  street: '',
  buildingNumber: '',
  apartmentNumber: '',
  postalCode: '',
  city: '',
  documentCity: '',
  country: 'Polska',
  phone: '',
  email: '',
  website: '',
  bankAccount: '',
  documentFooter: '',
  documentHeader: '',
  showLogoOnDocuments: true,
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

const DOCUMENT_SETTINGS_STORAGE_KEY = 'fixer-document-settings';
const DOCUMENT_TEMPLATE_OPTIONS = ['Standardowy'];
const RENTAL_AGREEMENT_TEMPLATE_KEY = 'rentalAgreement';
const DEFAULT_RENTAL_AGREEMENT_COLUMNS = [
  { key: 'lp', label: 'LP', enabled: true },
  { key: 'name', label: 'Nazwa sprzętu', enabled: true },
  { key: 'brandModel', label: 'Marka / Model', enabled: true },
  { key: 'serial', label: 'Nr seryjny', enabled: true },
  { key: 'quantity', label: 'Ilość', enabled: true },
  { key: 'barcode', label: 'Kod kreskowy', enabled: false },
  { key: 'inventory', label: 'Numer ewidencyjny', enabled: false },
  { key: 'conditionOut', label: 'Stan przy wydaniu', enabled: false },
  { key: 'notes', label: 'Uwagi', enabled: false }
];
const DEFAULT_RENTAL_AGREEMENT_TERMS = [
  'Wypożyczający przekazuje sprzęt sprawny technicznie.',
  'Biorący potwierdza odbiór sprzętu.',
  'Biorący odpowiada za uszkodzenia i utratę sprzętu.',
  'Sprzęt powinien zostać zwrócony w ustalonym terminie.',
  'Zwrot po terminie może skutkować dodatkowymi opłatami.',
  'Wszelkie uszkodzenia należy zgłosić niezwłocznie.',
  'Zwrot sprzętu zostaje potwierdzony po przyjęciu przez firmę.'
];
const RENTAL_AGREEMENT_SECTION_IDS = ['intro', 'period', 'equipment', 'terms', 'signatures', 'footer'];
const DEFAULT_RENTAL_AGREEMENT_SECTION_VISIBILITY = {
  intro: true,
  period: true,
  equipment: true,
  terms: true,
  signatures: true,
  footer: true
};
const DEFAULT_RENTAL_AGREEMENT_SECTION_ORDER = [...RENTAL_AGREEMENT_SECTION_IDS];
const RENTAL_TEMPLATE_VARIABLES = [
  { key: '{{documentNumber}}', label: 'Numer dokumentu' },
  { key: '{{issueDate}}', label: 'Data wystawienia' },
  { key: '{{returnDate}}', label: 'Planowany zwrot' },
  { key: '{{clientName}}', label: 'Nazwa klienta' },
  { key: '{{clientAddress}}', label: 'Adres klienta' },
  { key: '{{clientNip}}', label: 'NIP klienta' },
  { key: '{{companyName}}', label: 'Nazwa firmy' },
  { key: '{{companyAddress}}', label: 'Adres firmy' },
  { key: '{{equipmentTable}}', label: 'Tabela sprzętu' },
  { key: '{{rentalFinancialTerms}}', label: 'Warunki finansowe wypożyczenia' },
  { key: '{{rentalPaymentType}}', label: 'Typ rozliczenia (płatne/bezpłatne)' },
  { key: '{{rentalPriceFormatted}}', label: 'Sformatowana cena wynajmu' },
  { key: '{{rentalPrice}}', label: 'Cena wynajmu' },
  { key: '{{rentalIsPaid}}', label: 'Czy wypożyczenie płatne (tak/nie)' },
  { key: '{{notes}}', label: 'Uwagi' }
];
const DEFAULT_DOCUMENT_TEMPLATES = {
  [RENTAL_AGREEMENT_TEMPLATE_KEY]: {
    name: 'Umowa wypożyczenia',
    documentTitle: 'Umowa wypożyczenia sprzętu',
    columns: DEFAULT_RENTAL_AGREEMENT_COLUMNS,
    terms: DEFAULT_RENTAL_AGREEMENT_TERMS,
    introText: 'Umowa została zawarta{{documentCityClause}} dnia {{issueDate}} pomiędzy:',
    issuerText: '{{companyName}}\n{{companyAddress}}\n{{companyTaxData}}\n{{companyContact}}',
    borrowerText: '{{clientName}}\n{{clientAddress}}\n{{clientNip}}\n{{clientContact}}',
    termsText: DEFAULT_RENTAL_AGREEMENT_TERMS.map((item) => `- ${item}`).join('\n'),
    footerText: '{{documentFooter}}',
    sectionVisibility: DEFAULT_RENTAL_AGREEMENT_SECTION_VISIBILITY,
    sectionOrder: DEFAULT_RENTAL_AGREEMENT_SECTION_ORDER
  }
};
const DOCUMENT_TEMPLATE_LIBRARY_STORAGE_KEY = 'fixer:document-templates';
const SHARED_TEMPLATE_SECTION_IDS = ['header', 'intro', 'issuer', 'borrower', 'period', 'equipment', 'terms', 'signatures', 'footer'];
const DEFAULT_SHARED_TEMPLATE_SECTION_VISIBILITY = {
  header: true,
  intro: true,
  issuer: true,
  borrower: true,
  period: true,
  equipment: true,
  terms: true,
  signatures: true,
  footer: true
};
const DEFAULT_SHARED_TEMPLATE_SECTION_ORDER = [...SHARED_TEMPLATE_SECTION_IDS];
const DEFAULT_GENERIC_TEMPLATE_COLUMNS = [
  { key: 'lp', label: 'LP', enabled: true },
  { key: 'name', label: 'Nazwa', enabled: true },
  { key: 'details', label: 'Szczegóły', enabled: true },
  { key: 'status', label: 'Status', enabled: false },
  { key: 'notes', label: 'Uwagi', enabled: false }
];
const DEFAULT_SERVICE_INTAKE_TEMPLATE_COLUMNS = [
  { key: 'lp', label: 'LP', enabled: true },
  { key: 'name', label: 'Urządzenie', enabled: true },
  { key: 'serial', label: 'Nr seryjny', enabled: true },
  { key: 'fault', label: 'Opis usterki', enabled: true }
];

function buildServiceIntakeTableRows(context = {}) {
  const name = String(context.deviceName ?? '').trim();
  if (!name) return [];
  return [{
    lp: '1',
    name,
    serial: String(context.deviceSerialNumber ?? '—').trim() || '—',
    fault: String(context.faultDescription ?? '—').trim() || '—'
  }];
}

function resolveDocumentTableRows(context = {}, documentTypeId = '') {
  if (documentTypeId === 'serviceIntake') {
    const intakeRows = buildServiceIntakeTableRows(context);
    if (intakeRows.length) return intakeRows;
    return [{ lp: '1', name: 'Kamera Sony PXW-Z190', serial: 'SN-001', fault: 'Brak obrazu po uruchomieniu' }];
  }
  if (documentTypeId === 'issueProtocol') {
    return resolveIssueProtocolEquipmentTableRows(context);
  }
  if (documentTypeId === 'rentalAgreement') {
    if (Array.isArray(context.rentalItems) && context.rentalItems.length) {
      return buildRentalEquipmentTableRows(context.rentalItems, getRentalEquipmentTableColumns());
    }
    if (Array.isArray(context.equipmentRows) && context.equipmentRows.length) {
      return context.equipmentRows;
    }
  }
  if (Array.isArray(context.equipmentRows) && context.equipmentRows.length) {
    return context.equipmentRows;
  }
  return [{ lp: '1', name: 'Przykładowa pozycja', details: 'Model / numer seryjny', status: 'OK', notes: '—' }];
}
const SHARED_DOCUMENT_TEMPLATE_VARIABLES = [
  { key: '{{documentNumber}}', description: 'Numer dokumentu' },
  { key: '{{issueDate}}', description: 'Data wystawienia / utworzenia' },
  { key: '{{companyName}}', description: 'Nazwa firmy' },
  { key: '{{companyAddress}}', description: 'Adres firmy' },
  { key: '{{clientName}}', description: 'Nazwa klienta' },
  { key: '{{clientAddress}}', description: 'Adres klienta' },
  { key: '{{clientNip}}', description: 'NIP klienta (tylko firma)' },
  { key: '{{clientDetails}}', description: 'Nazwa, adres i NIP klienta' },
  { key: '{{operatorName}}', description: 'Operator dokumentu' },
  { key: '{{notes}}', description: 'Uwagi / notatki' }
];

function withSharedDocumentVariables(variables = []) {
  const merged = new Map(SHARED_DOCUMENT_TEMPLATE_VARIABLES.map((item) => [item.key, item]));
  variables.forEach((item) => {
    if (!item?.key) return;
    merged.set(item.key, {
      key: item.key,
      description: String(item.description ?? merged.get(item.key)?.description ?? '')
    });
  });
  return Array.from(merged.values());
}

const DOCUMENT_TEMPLATE_TYPES = [
  {
    id: 'rentalAgreement',
    label: 'Umowa wypożyczenia',
    description: 'Dokument główny wypożyczenia z tabelą sprzętu.',
    variables: [
      { key: '{{documentNumber}}', description: 'Numer dokumentu' },
      { key: '{{issueDate}}', description: 'Data wystawienia' },
      { key: '{{rentalIssueDate}}', description: 'Data wydania' },
      { key: '{{plannedReturnDate}}', description: 'Planowany zwrot' },
      { key: '{{actualReturnDate}}', description: 'Faktyczny zwrot' },
      { key: '{{clientName}}', description: 'Nazwa klienta' },
      { key: '{{clientAddress}}', description: 'Adres klienta' },
      { key: '{{companyName}}', description: 'Nazwa firmy' },
      { key: '{{companyAddress}}', description: 'Adres firmy' },
      { key: '{{equipmentTable}}', description: 'Tabela sprzętu' },
      { key: '{{rentalTotal}}', description: 'Podsumowanie wypożyczenia' },
      { key: '{{rentalFinancialTerms}}', description: 'Warunki finansowe wypożyczenia' },
      { key: '{{rentalPaymentType}}', description: 'Typ rozliczenia (płatne/bezpłatne)' },
      { key: '{{rentalPriceFormatted}}', description: 'Sformatowana cena wynajmu' },
      { key: '{{rentalPrice}}', description: 'Cena wynajmu' },
      { key: '{{rentalIsPaid}}', description: 'Czy wypożyczenie płatne (tak/nie)' },
      { key: '{{notes}}', description: 'Dodatkowe uwagi' }
    ],
    defaultTemplate: {
      title: 'Umowa wypożyczenia sprzętu',
      headerText: '{{companyName}}\n{{companyAddress}}\n{{companyTaxData}}\n{{companyContact}}',
      introText: 'Umowa została zawarta{{documentCityClause}} dnia {{issueDate}} pomiędzy:',
      issuerText: '{{companyName}}\n{{companyAddress}}\n{{companyTaxData}}\n{{companyContact}}',
      borrowerText: '{{clientName}}\n{{clientAddress}}\n{{clientNip}}\n{{clientContact}}',
      termsText: DEFAULT_RENTAL_AGREEMENT_TERMS.map((item) => `- ${item}`).join('\n'),
      footerText: '{{documentFooter}}',
      signatureIssuer: 'Wypożyczający',
      signatureBorrower: 'Biorący',
      sectionVisibility: DEFAULT_SHARED_TEMPLATE_SECTION_VISIBILITY,
      sectionOrder: DEFAULT_SHARED_TEMPLATE_SECTION_ORDER,
      columns: DEFAULT_RENTAL_AGREEMENT_COLUMNS
    }
  },
  {
    id: 'issueProtocol',
    label: 'Protokół wydania sprzętu',
    description: 'Potwierdzenie wydania wyposażenia klientowi.',
    variables: [
      { key: '{{documentNumber}}', description: 'Numer protokołu' },
      { key: '{{issueDate}}', description: 'Data wydania' },
      { key: '{{clientName}}', description: 'Nazwa klienta' },
      { key: '{{operatorName}}', description: 'Operator wydania' },
      { key: '{{equipmentTable}}', description: 'Lista wydanych pozycji' },
      { key: '{{notes}}', description: 'Uwagi do wydania' }
    ],
    defaultTemplate: {
      title: 'Protokół wydania sprzętu',
      headerText: '{{companyName}}\n{{companyAddress}}',
      introText: 'Poniżej potwierdzono wydanie sprzętu dnia {{issueDate}}.',
      issuerText: '{{companyName}}\nOperator: {{operatorName}}',
      borrowerText: '{{clientName}}\n{{clientAddress}}\n{{clientNip}}',
      termsText: '- Sprzęt został wydany kompletny.\n- Klient potwierdza odbiór bez zastrzeżeń.',
      footerText: '{{documentFooter}}',
      signatureIssuer: 'Wydający',
      signatureBorrower: 'Odbierający',
      sectionVisibility: DEFAULT_SHARED_TEMPLATE_SECTION_VISIBILITY,
      sectionOrder: DEFAULT_SHARED_TEMPLATE_SECTION_ORDER,
      columns: DEFAULT_RENTAL_AGREEMENT_COLUMNS
    }
  },
  {
    id: 'returnProtocol',
    label: 'Protokół zwrotu sprzętu',
    description: 'Potwierdzenie zwrotu i stanu sprzętu.',
    variables: [
      { key: '{{documentNumber}}', description: 'Numer protokołu' },
      { key: '{{issueDate}}', description: 'Data zwrotu' },
      { key: '{{actualReturnDate}}', description: 'Faktyczny zwrot' },
      { key: '{{clientName}}', description: 'Nazwa klienta' },
      { key: '{{equipmentTable}}', description: 'Lista zwracanych pozycji' },
      { key: '{{notes}}', description: 'Uwagi przy zwrocie' }
    ],
    defaultTemplate: {
      title: 'Protokół zwrotu sprzętu',
      headerText: '{{companyName}}\n{{companyAddress}}',
      introText: 'Dokument potwierdza zwrot sprzętu dnia {{actualReturnDate}}.',
      issuerText: '{{companyName}}\nPrzyjmujący: {{operatorName}}',
      borrowerText: '{{clientName}}\n{{clientAddress}}\n{{clientNip}}',
      termsText: '- Zwrot został zweryfikowany przez operatora.\n- Ewentualne uszkodzenia opisano w uwagach.',
      footerText: '{{documentFooter}}',
      signatureIssuer: 'Przyjmujący',
      signatureBorrower: 'Zwracający',
      sectionVisibility: DEFAULT_SHARED_TEMPLATE_SECTION_VISIBILITY,
      sectionOrder: DEFAULT_SHARED_TEMPLATE_SECTION_ORDER,
      columns: DEFAULT_GENERIC_TEMPLATE_COLUMNS
    }
  },
  {
    id: 'serviceIntake',
    label: 'Potwierdzenie przyjęcia do serwisu',
    description: 'Dokument przyjęcia urządzenia do serwisu.',
    variables: [
      { key: '{{serviceNumber}}', description: 'Numer zlecenia serwisowego' },
      { key: '{{issueDate}}', description: 'Data przyjęcia' },
      { key: '{{clientName}}', description: 'Nazwa klienta' },
      { key: '{{deviceName}}', description: 'Nazwa urządzenia' },
      { key: '{{deviceSerialNumber}}', description: 'Numer seryjny urządzenia' },
      { key: '{{faultDescription}}', description: 'Opis usterki' }
    ],
    defaultTemplate: {
      title: 'Potwierdzenie przyjęcia do serwisu',
      headerText: '{{companyName}}\n{{companyAddress}}',
      introText: 'Potwierdza się przyjęcie urządzenia do serwisu dnia {{issueDate}}.',
      issuerText: '{{companyName}}\nPrzyjął: {{operatorName}}',
      borrowerText: '{{clientName}}\n{{clientAddress}}\n{{clientNip}}',
      termsText: '- Sprzęt przyjęto do diagnozy.\n- Zakres prac zostanie potwierdzony po weryfikacji.',
      footerText: '{{documentFooter}}',
      signatureIssuer: 'Serwis',
      signatureBorrower: 'Klient',
      sectionVisibility: DEFAULT_SHARED_TEMPLATE_SECTION_VISIBILITY,
      sectionOrder: DEFAULT_SHARED_TEMPLATE_SECTION_ORDER,
      columns: DEFAULT_SERVICE_INTAKE_TEMPLATE_COLUMNS
    }
  },
  {
    id: 'serviceCompletion',
    label: 'Potwierdzenie zakończenia serwisu',
    description: 'Protokół odbioru po zakończeniu naprawy.',
    variables: [
      { key: '{{serviceNumber}}', description: 'Numer zlecenia' },
      { key: '{{issueDate}}', description: 'Data zakończenia' },
      { key: '{{clientName}}', description: 'Nazwa klienta' },
      { key: '{{repairDescription}}', description: 'Opis wykonanej naprawy' },
      { key: '{{serviceCost}}', description: 'Koszt serwisu' }
    ],
    defaultTemplate: {
      title: 'Potwierdzenie zakończenia serwisu',
      headerText: '{{companyName}}\n{{companyAddress}}',
      introText: 'Niniejszym potwierdzono zakończenie serwisu dnia {{issueDate}}.',
      issuerText: '{{companyName}}\nSerwisant: {{operatorName}}',
      borrowerText: '{{clientName}}\n{{clientAddress}}\n{{clientNip}}',
      termsText: '- Urządzenie zostało sprawdzone po naprawie.\n- Klient potwierdza odbiór urządzenia.',
      footerText: '{{documentFooter}}',
      signatureIssuer: 'Serwis',
      signatureBorrower: 'Klient',
      sectionVisibility: DEFAULT_SHARED_TEMPLATE_SECTION_VISIBILITY,
      sectionOrder: DEFAULT_SHARED_TEMPLATE_SECTION_ORDER,
      columns: DEFAULT_GENERIC_TEMPLATE_COLUMNS
    }
  },
  {
    id: 'serviceReport',
    label: 'Raport serwisowy',
    description: 'Szczegółowy raport z diagnozy i naprawy.',
    variables: [
      { key: '{{serviceNumber}}', description: 'Numer zlecenia' },
      { key: '{{deviceName}}', description: 'Urządzenie' },
      { key: '{{faultDescription}}', description: 'Usterka' },
      { key: '{{diagnosis}}', description: 'Diagnoza' },
      { key: '{{repairDescription}}', description: 'Naprawa' },
      { key: '{{serviceStatus}}', description: 'Status serwisu' },
      { key: '{{serviceCost}}', description: 'Koszt serwisu' }
    ],
    defaultTemplate: {
      title: 'Raport serwisowy',
      headerText: '{{companyName}}\n{{companyAddress}}',
      introText: 'Raport serwisowy dla zlecenia {{serviceNumber}}.',
      issuerText: '{{companyName}}\nSerwisant: {{operatorName}}',
      borrowerText: '{{clientName}}\n{{clientAddress}}\n{{clientNip}}',
      termsText: '- Diagnoza: {{diagnosis}}\n- Zakres naprawy: {{repairDescription}}\n- Status: {{serviceStatus}}',
      footerText: '{{documentFooter}}',
      signatureIssuer: 'Serwisant',
      signatureBorrower: 'Klient',
      sectionVisibility: DEFAULT_SHARED_TEMPLATE_SECTION_VISIBILITY,
      sectionOrder: DEFAULT_SHARED_TEMPLATE_SECTION_ORDER,
      columns: DEFAULT_GENERIC_TEMPLATE_COLUMNS
    }
  },
  {
    id: 'rentalConfirmation',
    label: 'Potwierdzenie wypożyczenia / rezerwacji',
    description: 'Potwierdzenie rezerwacji lub wydania.',
    variables: [
      { key: '{{rentalNumber}}', description: 'Numer wypożyczenia' },
      { key: '{{issueDate}}', description: 'Data dokumentu' },
      { key: '{{clientName}}', description: 'Nazwa klienta' },
      { key: '{{plannedReturnDate}}', description: 'Planowany zwrot' },
      { key: '{{equipmentTable}}', description: 'Lista sprzętu' }
    ],
    defaultTemplate: {
      title: 'Potwierdzenie wypożyczenia / rezerwacji',
      headerText: '{{companyName}}\n{{companyAddress}}',
      introText: 'Dokument potwierdza rezerwację / wypożyczenie sprzętu.',
      issuerText: '{{companyName}}\nOperator: {{operatorName}}',
      borrowerText: '{{clientName}}\n{{clientAddress}}\n{{clientNip}}',
      termsText: '- Termin wydania: {{rentalIssueDate}}\n- Planowany zwrot: {{plannedReturnDate}}',
      footerText: '{{documentFooter}}',
      signatureIssuer: 'Wydający',
      signatureBorrower: 'Odbiorca',
      sectionVisibility: DEFAULT_SHARED_TEMPLATE_SECTION_VISIBILITY,
      sectionOrder: DEFAULT_SHARED_TEMPLATE_SECTION_ORDER,
      columns: DEFAULT_GENERIC_TEMPLATE_COLUMNS
    }
  },
  {
    id: 'internalDocument',
    label: 'Dokument wewnętrzny',
    description: 'Szablon wewnętrzny organizacyjny.',
    variables: [
      { key: '{{documentNumber}}', description: 'Numer dokumentu' },
      { key: '{{issueDate}}', description: 'Data dokumentu' },
      { key: '{{companyName}}', description: 'Nazwa firmy' },
      { key: '{{operatorName}}', description: 'Operator' },
      { key: '{{notes}}', description: 'Notatki' }
    ],
    defaultTemplate: {
      title: 'Dokument wewnętrzny',
      headerText: '{{companyName}}',
      introText: 'Dokument wewnętrzny utworzony dnia {{issueDate}}.',
      issuerText: '{{companyName}}\n{{operatorName}}',
      borrowerText: '',
      termsText: '- Treść dokumentu wewnętrznego.\n- Uzupełnij notatki i decyzje.',
      footerText: '{{documentFooter}}',
      signatureIssuer: 'Przygotował',
      signatureBorrower: 'Zatwierdził',
      sectionVisibility: DEFAULT_SHARED_TEMPLATE_SECTION_VISIBILITY,
      sectionOrder: DEFAULT_SHARED_TEMPLATE_SECTION_ORDER,
      columns: DEFAULT_GENERIC_TEMPLATE_COLUMNS
    }
  }
].map((type) => ({
  ...type,
  variables: withSharedDocumentVariables(type.variables)
}));
const DEFAULT_DOCUMENT_NUMBERING = {
  rentals: { prefix: 'WYP', format: 'PREFIX/NR/DD/MM/YYYY', padding: 3 },
  returns: { prefix: 'ZW', format: 'PREFIX/NR/DD/MM/YYYY', padding: 3 },
  service: { prefix: 'SER', format: 'PREFIX/YYYY/MM/NR', padding: 2 },
  estimates: { prefix: 'KOS', format: 'PREFIX/NR/DD/MM/YYYY', padding: 3 },
  projects: { prefix: 'PRJ', format: 'PREFIX/NR/DD/MM/YYYY', padding: 3 }
};
const DEFAULT_DOCUMENT_SETTINGS = {
  templates: {
    rentals: 'Standardowy',
    returns: 'Standardowy',
    service: 'Standardowy',
    estimates: 'Standardowy',
    tableExport: 'Standardowy'
  },
  documentTemplates: DEFAULT_DOCUMENT_TEMPLATES,
  numbering: DEFAULT_DOCUMENT_NUMBERING
};

function normalizeRentalAgreementTemplate(template = {}) {
  const incomingColumns = Array.isArray(template.columns) ? template.columns : [];
  const fallbackMap = new Map(DEFAULT_RENTAL_AGREEMENT_COLUMNS.map((column) => [column.key, column]));
  const legacyBrandColumn = incomingColumns.find((column) => column?.key === 'brand');
  const legacyModelColumn = incomingColumns.find((column) => column?.key === 'model');
  const migratedIncomingColumns = incomingColumns.some((column) => column?.key === 'brandModel')
    ? incomingColumns
    : incomingColumns.flatMap((column) => {
      if (column?.key === 'brand') return [{ key: 'brandModel', enabled: legacyBrandColumn?.enabled !== false || legacyModelColumn?.enabled !== false }];
      if (column?.key === 'model') return [];
      return [column];
    });
  const incomingKeys = new Set();
  const columns = migratedIncomingColumns
    .map((column) => {
      const fallback = fallbackMap.get(column?.key);
      if (!fallback) return null;
      incomingKeys.add(fallback.key);
      return {
        key: fallback.key,
        label: fallback.label,
        enabled: column.enabled !== false
      };
    })
    .filter(Boolean);
  DEFAULT_RENTAL_AGREEMENT_COLUMNS.forEach((fallback) => {
    if (incomingKeys.has(fallback.key)) return;
    columns.push({
      key: fallback.key,
      label: fallback.label,
      enabled: fallback.enabled !== false
    });
  });
  const terms = Array.isArray(template.terms)
    ? template.terms.map((term) => String(term ?? '').trim()).filter(Boolean)
    : DEFAULT_RENTAL_AGREEMENT_TERMS;
  const termsTextFallback = (terms.length ? terms : DEFAULT_RENTAL_AGREEMENT_TERMS).map((item) => `- ${item}`).join('\n');
  const normalizedTermsText = String(template.termsText ?? '').trim() || termsTextFallback;
  const sectionVisibility = {
    ...DEFAULT_RENTAL_AGREEMENT_SECTION_VISIBILITY,
    ...(template.sectionVisibility ?? {})
  };
  const sectionOrderSource = Array.isArray(template.sectionOrder) ? template.sectionOrder : DEFAULT_RENTAL_AGREEMENT_SECTION_ORDER;
  const sectionOrder = [...new Set([...sectionOrderSource, ...DEFAULT_RENTAL_AGREEMENT_SECTION_ORDER])]
    .filter((id) => RENTAL_AGREEMENT_SECTION_IDS.includes(id));
  return {
    name: String(template.name ?? DEFAULT_DOCUMENT_TEMPLATES[RENTAL_AGREEMENT_TEMPLATE_KEY].name),
    documentTitle: String(template.documentTitle ?? DEFAULT_DOCUMENT_TEMPLATES[RENTAL_AGREEMENT_TEMPLATE_KEY].documentTitle),
    columns: columns.length ? columns : DEFAULT_RENTAL_AGREEMENT_COLUMNS,
    terms: terms.length ? terms : DEFAULT_RENTAL_AGREEMENT_TERMS,
    introText: String(template.introText ?? DEFAULT_DOCUMENT_TEMPLATES[RENTAL_AGREEMENT_TEMPLATE_KEY].introText),
    issuerText: String(template.issuerText ?? DEFAULT_DOCUMENT_TEMPLATES[RENTAL_AGREEMENT_TEMPLATE_KEY].issuerText),
    borrowerText: String(template.borrowerText ?? DEFAULT_DOCUMENT_TEMPLATES[RENTAL_AGREEMENT_TEMPLATE_KEY].borrowerText),
    termsText: normalizedTermsText,
    footerText: String(template.footerText ?? DEFAULT_DOCUMENT_TEMPLATES[RENTAL_AGREEMENT_TEMPLATE_KEY].footerText),
    sectionVisibility,
    sectionOrder: sectionOrder.length ? sectionOrder : DEFAULT_RENTAL_AGREEMENT_SECTION_ORDER
  };
}

function getDocumentTemplateTypeById(templateTypeId) {
  return DOCUMENT_TEMPLATE_TYPES.find((item) => item.id === templateTypeId) ?? DOCUMENT_TEMPLATE_TYPES[0];
}

function normalizeSharedDocumentTemplate(template = {}, fallbackTemplate = {}) {
  const fallbackColumns = Array.isArray(fallbackTemplate.columns) && fallbackTemplate.columns.length
    ? fallbackTemplate.columns
    : DEFAULT_GENERIC_TEMPLATE_COLUMNS;
  const incomingColumns = Array.isArray(template.columns) && template.columns.length
    ? template.columns
    : fallbackColumns;
  const fallbackColumnMap = new Map(fallbackColumns.map((column) => [column.key, column]));
  const columns = incomingColumns
    .map((column) => {
      const fallback = fallbackColumnMap.get(column?.key) ?? column;
      if (!fallback?.key) return null;
      return {
        key: fallback.key,
        label: String(column?.label ?? fallback.label ?? fallback.key),
        enabled: column?.enabled !== false
      };
    })
    .filter(Boolean);
  const sectionVisibility = {
    ...DEFAULT_SHARED_TEMPLATE_SECTION_VISIBILITY,
    ...(fallbackTemplate.sectionVisibility ?? {}),
    ...(template.sectionVisibility ?? {})
  };
  const orderSource = Array.isArray(template.sectionOrder) && template.sectionOrder.length
    ? template.sectionOrder
    : Array.isArray(fallbackTemplate.sectionOrder) && fallbackTemplate.sectionOrder.length
      ? fallbackTemplate.sectionOrder
      : DEFAULT_SHARED_TEMPLATE_SECTION_ORDER;
  const sectionOrder = [...new Set([...orderSource, ...DEFAULT_SHARED_TEMPLATE_SECTION_ORDER])]
    .filter((id) => SHARED_TEMPLATE_SECTION_IDS.includes(id));
  return {
    title: String(template.title ?? fallbackTemplate.title ?? 'Dokument'),
    headerText: String(template.headerText ?? fallbackTemplate.headerText ?? ''),
    introText: String(template.introText ?? fallbackTemplate.introText ?? ''),
    issuerText: String(template.issuerText ?? fallbackTemplate.issuerText ?? ''),
    borrowerText: String(template.borrowerText ?? fallbackTemplate.borrowerText ?? ''),
    termsText: String(template.termsText ?? fallbackTemplate.termsText ?? ''),
    footerText: String(template.footerText ?? fallbackTemplate.footerText ?? ''),
    signatureIssuer: String(template.signatureIssuer ?? fallbackTemplate.signatureIssuer ?? 'Wystawiający'),
    signatureBorrower: String(template.signatureBorrower ?? fallbackTemplate.signatureBorrower ?? 'Odbierający'),
    sectionVisibility,
    sectionOrder: sectionOrder.length ? sectionOrder : DEFAULT_SHARED_TEMPLATE_SECTION_ORDER,
    columns: columns.length ? columns : fallbackColumns
  };
}

function getDefaultDocumentTemplateLibrary() {
  return Object.fromEntries(DOCUMENT_TEMPLATE_TYPES.map((type) => [type.id, normalizeSharedDocumentTemplate(type.defaultTemplate, type.defaultTemplate)]));
}

function getDocumentTemplateLibrary() {
  const defaults = getDefaultDocumentTemplateLibrary();
  const raw = getStoredJson(DOCUMENT_TEMPLATE_LIBRARY_STORAGE_KEY, {});
  if (!raw || typeof raw !== 'object') return defaults;
  const merged = { ...defaults };
  DOCUMENT_TEMPLATE_TYPES.forEach((type) => {
    merged[type.id] = normalizeSharedDocumentTemplate(raw[type.id], type.defaultTemplate);
  });
  return merged;
}

function getRentalEquipmentTableColumns() {
  const rentalType = getDocumentTemplateTypeById('rentalAgreement');
  const rentalTemplate = normalizeSharedDocumentTemplate(
    getDocumentTemplateLibrary().rentalAgreement,
    rentalType.defaultTemplate
  );
  const enabledColumns = (rentalTemplate.columns ?? DEFAULT_RENTAL_AGREEMENT_COLUMNS).filter((column) => column.enabled !== false);
  return enabledColumns.length ? enabledColumns : DEFAULT_RENTAL_AGREEMENT_COLUMNS.filter((column) => column.enabled);
}

function buildRentalEquipmentTableRows(items = [], columns = getRentalEquipmentTableColumns()) {
  return (Array.isArray(items) ? items : []).map((item, index) => {
    const row = {};
    columns.forEach((column) => {
      const value = getRentalAgreementColumnValue(column.key, item, index);
      row[column.key] = value === '' || value === null || value === undefined ? '—' : String(value);
    });
    return row;
  });
}

function resolveIssueProtocolEquipmentTableRows(context = {}) {
  if (Array.isArray(context.rentalItems) && context.rentalItems.length) {
    return buildRentalEquipmentTableRows(context.rentalItems);
  }
  if (Array.isArray(context.equipmentRows) && context.equipmentRows.length) {
    const firstRow = context.equipmentRows[0] ?? {};
    if ('brandModel' in firstRow || 'serial' in firstRow || 'quantity' in firstRow) {
      return context.equipmentRows;
    }
  }
  return buildRentalEquipmentTableRows([]);
}

function resolveDesignerEquipmentTableColumns(element, documentTypeId = '') {
  if (element.tableType === 'equipmentTable' && ['issueProtocol', 'rentalAgreement'].includes(documentTypeId)) {
    return mapTemplateColumnsToDesignerColumns(getRentalEquipmentTableColumns());
  }
  const columns = (element.columns ?? []).filter((column) => column.visible !== false);
  return columns.length ? columns : [{ key: 'name', label: 'Nazwa', width: 180, visible: true }];
}

function saveDocumentTemplateLibrary(library) {
  const next = Object.fromEntries(DOCUMENT_TEMPLATE_TYPES.map((type) => [
    type.id,
    normalizeSharedDocumentTemplate(library?.[type.id], type.defaultTemplate)
  ]));
  try {
    localStorage.setItem(DOCUMENT_TEMPLATE_LIBRARY_STORAGE_KEY, JSON.stringify(next));
  } catch (error) {
    console.error('Document template library localStorage save failed', error);
    throw error;
  }
  return next;
}

const DOCUMENT_DESIGNER_STORAGE_KEY = 'fixer:document-designer';
const DOCUMENT_DESIGNER_LEGACY_MIGRATION_KEY = 'fixer:document-designer-legacy-migrated';
const DOCUMENT_DESIGNER_LAYOUT_VERSION = 2;
const DOCUMENT_DESIGNER_PAGE = { width: 794, height: 1123 };
const DOCUMENT_DESIGNER_MIN_SIZE = { width: 40, height: 18 };
const DESIGNER_MM_TO_PX = 3.7795275591;
const DEFAULT_DESIGNER_MARGINS = { top: 22, right: 20, bottom: 18, left: 20 };
const DOCUMENT_DESIGNER_LIBRARY = [
  { id: 'logo', label: '🖼 Logo', kind: 'logo', width: 110, height: 58, hint: 'Element graficzny' },
  { id: 'companyName', label: '🏢 Nagłówek firmy', kind: 'text', width: 240, height: 24, text: '{{companyName}}', fontSize: 16, fontWeight: 700, hint: 'Nazwa w nagłówku' },
  { id: 'companyDetails', label: '🏢 Dane firmy', kind: 'text', width: 300, height: 64, text: '{{companyAddress}}\n{{companyContact}}', fontSize: 10, fontWeight: 400, hint: 'Adres i kontakt' },
  { id: 'clientDetails', label: '👤 Dane klienta', kind: 'text', width: 300, height: 64, text: '{{clientDetails}}', fontSize: 10, fontWeight: 400, hint: 'Informacje klienta' },
  { id: 'serviceDetails', label: '🔧 Dane serwisowe', kind: 'text', width: 300, height: 64, text: '{{serviceNumber}}\n{{serviceStatus}}\n{{diagnosis}}', fontSize: 10, fontWeight: 400, hint: 'Numer, status, diagnoza' },
  { id: 'rentalDetails', label: '📦 Dane wypożyczenia', kind: 'text', width: 300, height: 64, text: '{{rentalNumber}}\n{{rentalIssueDate}}\n{{plannedReturnDate}}', fontSize: 10, fontWeight: 400, hint: 'Numer i terminy' },
  { id: 'documentNumber', label: '📄 Numer dokumentu', kind: 'text', width: 210, height: 22, text: 'Numer: {{documentNumber}}', fontSize: 10, fontWeight: 600, hint: 'Numeracja dokumentu' },
  { id: 'documentDate', label: '📄 Data dokumentu', kind: 'text', width: 210, height: 22, text: 'Data: {{issueDate}}', fontSize: 10, fontWeight: 600, hint: 'Data wystawienia' },
  { id: 'documentStatus', label: '📄 Status dokumentu', kind: 'text', width: 210, height: 22, text: 'Status: {{serviceStatus}}', fontSize: 10, fontWeight: 600, hint: 'Status obsługi' },
  { id: 'equipmentTable', label: '📋 Tabela sprzętu', kind: 'table', width: 700, height: 170, tableType: 'equipmentTable', hint: 'Lista urządzeń' },
  { id: 'itemsTable', label: '📋 Tabela pozycji', kind: 'table', width: 700, height: 170, tableType: 'itemsTable', hint: 'Pozycje dokumentu' },
  { id: 'terms', label: '📝 Warunki', kind: 'text', width: 700, height: 110, text: '{{terms}}', fontSize: 10, fontWeight: 400, hint: 'Punkty i warunki' },
  { id: 'footer', label: '📄 Stopka', kind: 'text', width: 700, height: 26, text: '{{documentFooter}}', fontSize: 9, fontWeight: 400, align: 'center', hint: 'Treść stopki' },
  { id: 'signatureLeft', label: '✍ Podpis', kind: 'signature', width: 260, height: 70, text: 'Wystawiający', hint: 'Pole podpisu' },
  { id: 'signatureRight', label: '✍ Podpis', kind: 'signature', width: 260, height: 70, text: 'Odbierający', hint: 'Pole podpisu' },
  { id: 'separator', label: '📌 Separator', kind: 'line', width: 700, height: 1, color: '#cbd5e1', hint: 'Linia podziału' },
  { id: 'customText', label: '📃 Tekst własny', kind: 'text', width: 260, height: 50, text: 'Tekst własny', fontSize: 11, fontWeight: 400, hint: 'Dowolny tekst' }
];

function getDesignerLibraryItem(libraryId) {
  return DOCUMENT_DESIGNER_LIBRARY.find((item) => item.id === libraryId) ?? DOCUMENT_DESIGNER_LIBRARY[0];
}

function createDocumentDesignerElement(libraryId, index = 0) {
  const base = getDesignerLibraryItem(libraryId);
  const rowOffset = (index % 4) * 14;
  return {
    id: `${base.id}-${Date.now()}-${Math.round(Math.random() * 1000)}`,
    libraryId: base.id,
    kind: base.kind,
    x: 56 + rowOffset,
    y: 76 + rowOffset,
    width: base.width,
    height: base.height,
    text: base.text ?? '',
    align: base.align ?? 'left',
    fontSize: base.fontSize ?? 10,
    fontWeight: base.fontWeight ?? 400,
    color: base.color ?? '#111827',
    visible: true,
    tableType: base.tableType ?? 'equipmentTable',
    logoDataUrl: '',
    columns: [
      { key: 'lp', label: 'LP', width: 44, visible: true },
      { key: 'name', label: 'Nazwa', width: 180, visible: true },
      { key: 'details', label: 'Szczegóły', width: 180, visible: true },
      { key: 'status', label: 'Status', width: 90, visible: true },
      { key: 'notes', label: 'Uwagi', width: 140, visible: true }
    ]
  };
}

function mapTemplateColumnsToDesignerColumns(columns = DEFAULT_GENERIC_TEMPLATE_COLUMNS) {
  const widthMap = {
    lp: 44,
    name: 180,
    brandModel: 160,
    serial: 120,
    fault: 220,
    quantity: 60,
    details: 180,
    status: 90,
    notes: 140,
    barcode: 100,
    inventory: 120,
    conditionOut: 120
  };
  return columns
    .filter((column) => column.enabled !== false)
    .map((column) => ({
      key: column.key,
      label: column.label,
      width: widthMap[column.key] ?? 120,
      visible: true
    }));
}

function getDesignerWorkArea(margins = DEFAULT_DESIGNER_MARGINS) {
  const left = Math.round(Number(margins.left ?? DEFAULT_DESIGNER_MARGINS.left) * DESIGNER_MM_TO_PX);
  const top = Math.round(Number(margins.top ?? DEFAULT_DESIGNER_MARGINS.top) * DESIGNER_MM_TO_PX);
  const right = DOCUMENT_DESIGNER_PAGE.width - Math.round(Number(margins.right ?? DEFAULT_DESIGNER_MARGINS.right) * DESIGNER_MM_TO_PX);
  const bottom = DOCUMENT_DESIGNER_PAGE.height - Math.round(Number(margins.bottom ?? DEFAULT_DESIGNER_MARGINS.bottom) * DESIGNER_MM_TO_PX);
  return {
    left,
    top,
    right,
    bottom,
    width: Math.max(120, right - left),
    height: Math.max(120, bottom - top),
    centerX: left + (right - left) / 2,
    centerY: top + (bottom - top) / 2
  };
}

function clampDesignerElementToWorkArea(element = {}, margins = DEFAULT_DESIGNER_MARGINS) {
  const area = getDesignerWorkArea(margins);
  const minW = DOCUMENT_DESIGNER_MIN_SIZE.width;
  const minH = DOCUMENT_DESIGNER_MIN_SIZE.height;
  let width = Math.max(minW, Math.min(area.width, Number(element.width) || minW));
  let height = Math.max(minH, Math.min(area.height, Number(element.height) || minH));
  let x = Number(element.x) || area.left;
  let y = Number(element.y) || area.top;

  if (width > area.width) width = area.width;
  if (height > area.height) height = area.height;

  x = Math.min(area.right - width, Math.max(area.left, x));
  y = Math.min(area.bottom - height, Math.max(area.top, y));

  const outOfBounds = x < area.left || y < area.top || x + width > area.right || y + height > area.bottom;
  if (outOfBounds) {
    x = Math.round(area.left + (area.width - width) / 2);
    y = Math.round(area.top + (area.height - height) / 2);
  }

  return { ...element, x, y, width, height };
}

function fitDesignerTableColumns(columns = [], targetWidth = 640) {
  const visible = columns.filter((column) => column.visible !== false);
  if (!visible.length) return columns;
  const total = visible.reduce((sum, column) => sum + (Number(column.width) || 120), 0);
  if (total <= targetWidth) return columns;
  const scale = targetWidth / total;
  return columns.map((column) => ({
    ...column,
    width: Math.max(50, Math.round((Number(column.width) || 120) * scale))
  }));
}

function designerLayoutElement(libraryId, layout = {}, overrides = {}) {
  const base = createDocumentDesignerElement(libraryId, 0);
  return { ...base, ...layout, ...overrides };
}

function buildFactoryDocumentDesignerLayout(documentTypeId, margins = DEFAULT_DESIGNER_MARGINS) {
  const typeDef = getDocumentTemplateTypeById(documentTypeId);
  const defaults = typeDef.defaultTemplate ?? {};
  const area = getDesignerWorkArea(margins);
  const gap = 12;
  const colGap = 16;
  const colW = Math.floor((area.width - colGap) / 2);
  const metaW = Math.min(240, Math.floor(area.width * 0.36));
  const metaX = area.right - metaW;
  const leftColW = Math.min(300, Math.floor(area.width * 0.44));
  const logoH = 58;
  const elements = [];
  let y = area.top;

  elements.push(
    designerLayoutElement('logo', { x: area.left, y, width: 110, height: logoH }),
    designerLayoutElement('companyName', { x: area.left, y: y + logoH + 8, width: leftColW, height: 22, fontSize: 14, fontWeight: 700, text: '{{companyName}}' }),
    designerLayoutElement('companyDetails', { x: area.left, y: y + logoH + 34, width: leftColW, height: 42, fontSize: 10, fontWeight: 400, text: '{{companyAddress}}' }),
    designerLayoutElement('documentNumber', { x: metaX, y, width: metaW, height: 20, align: 'right', fontSize: 10, fontWeight: 600, text: 'Numer: {{documentNumber}}' }),
    designerLayoutElement('documentDate', { x: metaX, y: y + 22, width: metaW, height: 20, align: 'right', fontSize: 10, fontWeight: 600, text: 'Data: {{issueDate}}' })
  );

  if (['serviceIntake', 'serviceCompletion', 'serviceReport', 'returnProtocol', 'issueProtocol'].includes(documentTypeId)) {
    elements.push(designerLayoutElement('documentStatus', { x: metaX, y: y + 44, width: metaW, height: 20, align: 'right', fontSize: 10, text: 'Status: {{serviceStatus}}' }));
  }

  y = area.top + logoH + 34 + 42 + gap + 6;

  elements.push(designerLayoutElement('customText', {
    x: area.left,
    y,
    width: area.width,
    height: 30,
    align: 'center',
    fontSize: 16,
    fontWeight: 700,
    text: defaults.title ?? typeDef.label
  }));
  y += 30 + gap;

  if (String(defaults.introText ?? '').trim()) {
    elements.push(designerLayoutElement('customText', {
      x: area.left,
      y,
      width: area.width,
      height: 46,
      fontSize: 10,
      fontWeight: 400,
      text: defaults.introText
    }));
    y += 46 + gap;
  }

  const borrowerText = String(defaults.borrowerText ?? '').trim();
  if (borrowerText) {
    elements.push(
      designerLayoutElement('customText', {
        x: area.left,
        y,
        width: colW,
        height: 78,
        fontSize: 10,
        fontWeight: 400,
        text: defaults.issuerText ?? '{{companyName}}'
      }),
      designerLayoutElement('customText', {
        x: area.left + colW + colGap,
        y,
        width: colW,
        height: 78,
        fontSize: 10,
        fontWeight: 400,
        text: defaults.borrowerText ?? '{{clientName}}\n{{clientAddress}}\n{{clientNip}}'
      })
    );
    y += 78 + gap;
  } else if (String(defaults.issuerText ?? '').trim()) {
    elements.push(designerLayoutElement('customText', {
      x: area.left,
      y,
      width: area.width,
      height: 56,
      fontSize: 10,
      fontWeight: 400,
      text: defaults.issuerText
    }));
    y += 56 + gap;
  }

  if (documentTypeId === 'rentalAgreement') {
    elements.push(designerLayoutElement('customText', {
      x: area.left,
      y,
      width: area.width,
      height: 16,
      fontSize: 8,
      fontWeight: 700,
      text: 'WARUNKI FINANSOWE'
    }));
    y += 16 + 4;
    elements.push(designerLayoutElement('customText', {
      x: area.left,
      y,
      width: area.width,
      height: 40,
      fontSize: 10,
      fontWeight: 400,
      text: '{{rentalFinancialTerms}}'
    }));
    y += 40 + gap;
  }

  const tableLibraryId = ['rentalAgreement', 'rentalConfirmation', 'issueProtocol', 'returnProtocol'].includes(documentTypeId)
    ? 'equipmentTable'
    : 'itemsTable';
  const tableColumns = documentTypeId === 'serviceIntake'
    ? (defaults.columns ?? DEFAULT_SERVICE_INTAKE_TEMPLATE_COLUMNS)
    : ['issueProtocol', 'rentalAgreement'].includes(documentTypeId)
      ? getRentalEquipmentTableColumns()
      : (defaults.columns ?? DEFAULT_GENERIC_TEMPLATE_COLUMNS);

  if (documentTypeId === 'internalDocument') {
    elements.push(designerLayoutElement('customText', {
      x: area.left,
      y,
      width: area.width,
      height: 140,
      fontSize: 10,
      text: defaults.termsText ?? '{{notes}}'
    }));
    y += 140 + gap;
  } else {
    const tableHeight = Math.min(210, Math.max(160, area.bottom - y - 250));
    const tableEl = createDesignerTableElement(tableLibraryId, tableColumns, {
      x: area.left,
      y,
      width: area.width,
      height: tableHeight
    });
    tableEl.columns = fitDesignerTableColumns(tableEl.columns, area.width);
    elements.push(tableEl);
    y += tableHeight + gap;
  }

  if (documentTypeId !== 'internalDocument' && String(defaults.termsText ?? '').trim()) {
    const termsHeight = Math.min(112, Math.max(72, area.bottom - y - 150));
    elements.push(designerLayoutElement('terms', {
      x: area.left,
      y,
      width: area.width,
      height: termsHeight,
      fontSize: 10,
      text: '{{terms}}'
    }));
    y += termsHeight + gap;
  }

  const sigW = Math.min(300, Math.floor((area.width - colGap) / 2));
  const sigY = Math.min(y, area.bottom - 98);
  elements.push(
    designerLayoutElement('signatureLeft', { x: area.left, y: sigY, width: sigW, height: 70, text: defaults.signatureIssuer ?? 'Wystawiający' }),
    designerLayoutElement('signatureRight', { x: area.left + sigW + colGap, y: sigY, width: sigW, height: 70, text: defaults.signatureBorrower ?? 'Odbierający' })
  );

  const footerY = Math.min(sigY + 78, area.bottom - 26);
  elements.push(designerLayoutElement('footer', {
    x: area.left,
    y: footerY,
    width: area.width,
    height: 24,
    align: 'center',
    fontSize: 9,
    text: defaults.footerText ?? '{{documentFooter}}'
  }));

  return elements.map((element) => clampDesignerElementToWorkArea(element, margins));
}

function createDesignerTableElement(libraryId, columns, position = {}) {
  const element = createDocumentDesignerElement(libraryId, 0);
  element.columns = mapTemplateColumnsToDesignerColumns(columns);
  return { ...element, ...position };
}

function isLegacyDesignerTemplateLayout(template) {
  if (Number(template?.layoutVersion) >= DOCUMENT_DESIGNER_LAYOUT_VERSION) return false;
  if (!template?.elements?.length) return true;
  const margins = template.margins ?? DEFAULT_DESIGNER_MARGINS;
  const area = getDesignerWorkArea(margins);
  const companyNameEl = template.elements.find((element) => element.libraryId === 'companyName');
  const logoEl = template.elements.find((element) => element.libraryId === 'logo');
  const companyDetailsEl = template.elements.find((element) => element.libraryId === 'companyDetails');
  if (!companyNameEl || !logoEl) return true;
  if (Number(companyNameEl.x) > area.left + 130) return true;
  if (Number(companyNameEl.y) < Number(logoEl.y) + Number(logoEl.height) - 8) return true;
  if (companyDetailsEl && Number(companyDetailsEl.x) > area.left + 130) return true;
  if (template.documentTypeId === 'serviceIntake' && template.elements.some((element) => element.libraryId === 'serviceDetails')) return true;
  return template.elements.some((element) => Number(element.x) <= 60 && Number(element.width) >= 680);
}

function upgradeLegacyDesignerTemplate(template) {
  if (!isLegacyDesignerTemplateLayout(template)) return template;
  const fresh = createDefaultDocumentDesignerTemplate(template.documentTypeId, template.name);
  return { ...fresh, id: template.id, name: template.name };
}

function createDefaultDocumentDesignerTemplate(documentTypeId, name = 'Domyślny') {
  const margins = { ...DEFAULT_DESIGNER_MARGINS };
  const elements = buildFactoryDocumentDesignerLayout(documentTypeId, margins)
    .map((element) => clampDesignerElementToWorkArea(normalizeDocumentDesignerElement(element), margins));
  return {
    id: `layout-${documentTypeId}-${Date.now()}-${Math.round(Math.random() * 1000)}`,
    name,
    documentTypeId,
    margins,
    elements,
    layoutVersion: DOCUMENT_DESIGNER_LAYOUT_VERSION
  };
}

function normalizeDocumentDesignerElement(element = {}) {
  const base = createDocumentDesignerElement(element.libraryId || 'customText');
  const sourceColumns = Array.isArray(element.columns) && element.columns.length ? element.columns : base.columns;
  return {
    ...base,
    ...element,
    x: Math.max(0, Number(element.x ?? base.x) || 0),
    y: Math.max(0, Number(element.y ?? base.y) || 0),
    width: Math.max(DOCUMENT_DESIGNER_MIN_SIZE.width, Number(element.width ?? base.width) || base.width),
    height: Math.max(DOCUMENT_DESIGNER_MIN_SIZE.height, Number(element.height ?? base.height) || base.height),
    fontSize: Math.max(8, Number(element.fontSize ?? base.fontSize) || base.fontSize),
    fontWeight: Number(element.fontWeight ?? base.fontWeight) >= 700 ? 700 : Number(element.fontWeight ?? base.fontWeight) >= 600 ? 600 : Number(element.fontWeight ?? base.fontWeight) >= 500 ? 500 : 400,
    align: ['left', 'center', 'right'].includes(String(element.align ?? base.align)) ? String(element.align ?? base.align) : 'left',
    color: normalizeHexColor(element.color, base.color),
    logoDataUrl: String(element.logoDataUrl ?? base.logoDataUrl ?? ''),
    visible: element.visible !== false,
    columns: sourceColumns
      .map((column, index) => ({
        key: String(column?.key ?? `col-${index}`),
        label: String(column?.label ?? `Kolumna ${index + 1}`),
        width: Math.max(50, Number(column?.width ?? 120) || 120),
        visible: column?.visible !== false
      }))
      .filter((column) => column.key)
  };
}

function normalizeDocumentDesignerTemplate(template = {}, fallbackTypeId = DOCUMENT_TEMPLATE_TYPES[0].id) {
  const margins = {
    top: Math.max(0, Math.min(40, Number(template.margins?.top ?? DEFAULT_DESIGNER_MARGINS.top) || DEFAULT_DESIGNER_MARGINS.top)),
    right: Math.max(0, Math.min(40, Number(template.margins?.right ?? DEFAULT_DESIGNER_MARGINS.right) || DEFAULT_DESIGNER_MARGINS.right)),
    bottom: Math.max(0, Math.min(40, Number(template.margins?.bottom ?? DEFAULT_DESIGNER_MARGINS.bottom) || DEFAULT_DESIGNER_MARGINS.bottom)),
    left: Math.max(0, Math.min(40, Number(template.margins?.left ?? DEFAULT_DESIGNER_MARGINS.left) || DEFAULT_DESIGNER_MARGINS.left))
  };
  const normalizedElements = (Array.isArray(template.elements) ? template.elements : [])
    .map((element) => normalizeDocumentDesignerElement(element))
    .map((element) => clampDesignerElementToWorkArea(element, margins));
  return {
    id: String(template.id ?? `layout-${Date.now()}-${Math.round(Math.random() * 1000)}`),
    name: String(template.name ?? 'Szablon').trim() || 'Szablon',
    documentTypeId: String(template.documentTypeId ?? fallbackTypeId),
    margins,
    elements: normalizedElements,
    layoutVersion: DOCUMENT_DESIGNER_LAYOUT_VERSION
  };
}

function getDefaultDocumentDesignerState() {
  return {
    templates: DOCUMENT_TEMPLATE_TYPES.map((type) => createDefaultDocumentDesignerTemplate(type.id, `Domyślny • ${type.label}`))
  };
}

function normalizeDocumentDesignerState(value) {
  const defaults = getDefaultDocumentDesignerState();
  const incomingTemplates = Array.isArray(value?.templates) ? value.templates : defaults.templates;
  const normalizedTemplates = incomingTemplates
    .map((template) => normalizeDocumentDesignerTemplate(template, template?.documentTypeId))
    .filter(Boolean);
  DOCUMENT_TEMPLATE_TYPES.forEach((type) => {
    if (normalizedTemplates.some((template) => template.documentTypeId === type.id)) return;
    normalizedTemplates.push(createDefaultDocumentDesignerTemplate(type.id, `Domyślny • ${type.label}`));
  });
  return { templates: normalizedTemplates };
}

function migrateLegacyDocumentDesignerStorageOnce() {
  if (localStorage.getItem(DOCUMENT_DESIGNER_LEGACY_MIGRATION_KEY) === '1') return;
  const raw = getStoredJson(DOCUMENT_DESIGNER_STORAGE_KEY, null);
  if (!raw || !Array.isArray(raw.templates) || !raw.templates.length) {
    localStorage.setItem(DOCUMENT_DESIGNER_LEGACY_MIGRATION_KEY, '1');
    return;
  }
  const migratedTemplates = raw.templates
    .map((template) => {
      const upgraded = upgradeLegacyDesignerTemplate({
        id: String(template.id ?? ''),
        name: String(template.name ?? 'Szablon'),
        documentTypeId: String(template.documentTypeId ?? DOCUMENT_TEMPLATE_TYPES[0].id),
        margins: template.margins,
        elements: Array.isArray(template.elements) ? template.elements : [],
        layoutVersion: Number(template.layoutVersion) || 0
      });
      return normalizeDocumentDesignerTemplate(upgraded, upgraded.documentTypeId);
    });
  DOCUMENT_TEMPLATE_TYPES.forEach((type) => {
    if (migratedTemplates.some((template) => template.documentTypeId === type.id)) return;
    migratedTemplates.push(createDefaultDocumentDesignerTemplate(type.id, `Domyślny • ${type.label}`));
  });
  localStorage.setItem(DOCUMENT_DESIGNER_STORAGE_KEY, JSON.stringify({ templates: migratedTemplates }));
  localStorage.setItem(DOCUMENT_DESIGNER_LEGACY_MIGRATION_KEY, '1');
}

function getDocumentDesignerState() {
  migrateLegacyDocumentDesignerStorageOnce();
  const stored = getStoredJson(DOCUMENT_DESIGNER_STORAGE_KEY, null);
  if (stored && Array.isArray(stored.templates) && stored.templates.length) {
    return normalizeDocumentDesignerState(stored);
  }
  return normalizeDocumentDesignerState(getDefaultDocumentDesignerState());
}

function saveDocumentDesignerState(state) {
  const normalized = normalizeDocumentDesignerState(state);
  try {
    localStorage.setItem(DOCUMENT_DESIGNER_STORAGE_KEY, JSON.stringify(normalized));
  } catch (error) {
    console.error('Document designer localStorage save failed', error);
    throw error;
  }
  return normalized;
}

function getSavedDocumentTemplateByType(documentTypeId) {
  const typeDef = getDocumentTemplateTypeById(documentTypeId);
  const library = getDocumentTemplateLibrary();
  return normalizeSharedDocumentTemplate(library[documentTypeId], typeDef.defaultTemplate);
}

function enrichDocumentRenderContext(documentTypeId, context = {}, sharedTemplate = null) {
  const savedTemplate = sharedTemplate
    ? normalizeSharedDocumentTemplate(sharedTemplate, getDocumentTemplateTypeById(documentTypeId).defaultTemplate)
    : getSavedDocumentTemplateByType(documentTypeId);
  const typeDef = getDocumentTemplateTypeById(documentTypeId);
  return {
    ...context,
    documentTypeId,
    documentTitle: savedTemplate.title || typeDef.label,
    terms: savedTemplate.termsText || context.terms || '',
    introText: savedTemplate.introText || context.introText || '',
    issuerText: savedTemplate.issuerText || context.issuerText || '',
    borrowerText: savedTemplate.borrowerText || context.borrowerText || '',
    footerText: savedTemplate.footerText || context.footerText || '',
    documentFooter: context.documentFooter || savedTemplate.footerText || ''
  };
}

const SERVICE_DOCUMENT_TYPE_MAP = {
  acceptance: 'serviceIntake',
  release: 'serviceCompletion'
};

const SERVICE_DOCUMENT_TITLES = {
  acceptance: 'Potwierdzenie przyjęcia do serwisu',
  release: 'Potwierdzenie zakończenia serwisu'
};

const SERVICE_DOCUMENT_FILE_PREFIX = {
  acceptance: 'Protokol_przyjecia',
  release: 'Protokol_wydania'
};

function buildServiceCompletionTableRows(context = {}) {
  const name = String(context.deviceName ?? '').trim();
  if (!name) return [];
  return [{
    lp: '1',
    name,
    details: String(context.repairDescription ?? '—').trim() || '—',
    status: String(context.serviceStatus ?? '—').trim() || '—',
    notes: String(context.serviceCost ?? '—').trim() || '—'
  }];
}

function getServiceDocumentDesignerTemplate(documentTypeId) {
  const designerState = getDocumentDesignerState();
  const templates = designerState.templates.filter((template) => template.documentTypeId === documentTypeId);
  return templates[0] ?? createDefaultDocumentDesignerTemplate(documentTypeId);
}

function buildRentalAgreementDocumentContext(rental, company = getCompanyProfile()) {
  const client = rental?.clients ?? {};
  const items = getRentalBaseItems(rental);
  const issueDate = formatAgreementDate(rental?.start_date) || formatAgreementDate(getLocalIsoDate());
  const introCity = company.documentCity || company.city || '';
  const contactPerson = client.contact_person || client.contact_name || client.representative || '';
  return {
    ...mapClientToDocumentContext(client),
    ...buildRentalFinancialContext(rental),
    documentNumber: rental?.rental_number || '—',
    issueDate,
    rentalIssueDate: formatAgreementDate(rental?.start_date) || issueDate,
    plannedReturnDate: formatAgreementDate(rental?.planned_return_date) || '',
    actualReturnDate: formatAgreementDate(rental?.actual_return_date) || '',
    rentalNumber: rental?.rental_number || '—',
    status: rental?.status || '',
    companyName: company.legalName || company.name || 'FIXER WEB',
    companyAddress: formatCompanyAddress(company),
    companyTaxData: formatCompanyTaxData(company),
    companyContact: formatCompanyContact(company),
    clientContact: compactLines([
      contactPerson ? `Osoba kontaktowa: ${contactPerson}` : '',
      client.phone ? `Telefon: ${client.phone}` : '',
      client.email ? `E-mail: ${client.email}` : ''
    ]).join('\n'),
    operatorName: 'Operator',
    notes: rental?.notes || '',
    documentFooter: company.documentFooter || '',
    documentCityClause: introCity ? ` w ${introCity}` : '',
    documentTypeId: 'rentalAgreement',
    rentalItems: items,
    equipmentRows: buildRentalEquipmentTableRows(items, getRentalEquipmentTableColumns())
  };
}

function buildRentalAgreementDocumentHtml(rental, { preview = true, company = getCompanyProfile(), sharedTemplate = null } = {}) {
  const context = enrichDocumentRenderContext(
    'rentalAgreement',
    buildRentalAgreementDocumentContext(rental, company),
    sharedTemplate
  );
  const designerTemplate = getServiceDocumentDesignerTemplate('rentalAgreement');
  return renderDesignerDocumentHtml(designerTemplate, context, {
    preview,
    company,
    title: context.documentTitle || 'Umowa wypożyczenia sprzętu'
  });
}

function buildServiceOrderDocumentHtml(order, type, { preview = true, client = null, company = getCompanyProfile() } = {}) {
  const documentTypeId = SERVICE_DOCUMENT_TYPE_MAP[type];
  const context = enrichDocumentRenderContext(
    documentTypeId,
    buildServiceOrderDocumentContext(order, type, client, company)
  );
  const designerTemplate = getServiceDocumentDesignerTemplate(documentTypeId);
  return renderDesignerDocumentHtml(designerTemplate, context, {
    preview,
    company,
    title: SERVICE_DOCUMENT_TITLES[type]
  });
}

function buildServiceOrderDocumentContext(order, type, client = null, company = getCompanyProfile()) {
  const documentTypeId = SERVICE_DOCUMENT_TYPE_MAP[type];
  const resolvedClient = client ?? order.clients ?? null;
  const clientContext = resolvedClient
    ? mapClientToDocumentContext(resolvedClient)
    : { clientName: order.client_name || '—', clientAddress: '—', clientNip: '', clientDetails: order.client_name || '—', clientContact: '' };
  const deviceName = String(order.customer_device_name || order.equipment_name || order.equipment?.name || '').trim();
  const deviceSerial = String(order.customer_device_serial || order.equipment?.serial || '').trim();
  const issueDate = formatAgreementDate(type === 'release' ? (order.completed_date || order.accepted_date) : order.accepted_date) || formatAgreementDate(getLocalIsoDate());
  const context = {
    ...clientContext,
    documentNumber: order.service_number || '—',
    issueDate,
    serviceNumber: order.service_number || '—',
    serviceStatus: order.status || '—',
    status: order.status || '—',
    companyName: company.legalName || company.name || 'FIXER WEB',
    companyAddress: formatCompanyAddress(company),
    companyTaxData: formatCompanyTaxData(company),
    companyContact: formatCompanyContact(company),
    operatorName: 'Operator',
    deviceName: deviceName || '—',
    deviceSerialNumber: deviceSerial || '—',
    faultDescription: order.fault_description || '—',
    diagnosis: order.diagnosis || '—',
    repairDescription: order.work_performed || order.diagnosis || '—',
    serviceCost: formatServiceMoney(order.total_cost),
    notes: order.notes || '',
    documentFooter: company.documentFooter || '',
    documentTypeId
  };
  if (documentTypeId === 'serviceIntake') {
    context.equipmentRows = buildServiceIntakeTableRows(context);
  } else if (documentTypeId === 'serviceCompletion') {
    context.equipmentRows = buildServiceCompletionTableRows(context);
  }
  return context;
}

function buildServiceDocumentFileName(order, type) {
  const prefix = SERVICE_DOCUMENT_FILE_PREFIX[type] || 'Dokument_serwisowy';
  return `${prefix}_${normalizeFileNamePart(order.service_number || 'SER')}.pdf`;
}

function prepareServiceDocumentPrintHtml(html, fileName = 'dokument.pdf') {
  const safeTitle = String(fileName).replace(/\.pdf$/i, '');
  if (/<title>[^<]*<\/title>/i.test(html)) {
    return html.replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(safeTitle)}</title>`);
  }
  return html.replace(/<head[^>]*>/i, (match) => `${match}<title>${escapeHtml(safeTitle)}</title>`);
}

function applyDesignerTokens(value, context = {}) {
  return applyTemplateVariables(String(value ?? ''), context);
}

function renderDocumentDesignerElementHtml(element, context = {}, company = getCompanyProfile()) {
  if (element.visible === false) return '';
  const commonStyle = `position:absolute;left:${element.x}px;top:${element.y}px;width:${element.width}px;height:${element.height}px;overflow:hidden;`;
  const textStyle = `font-size:${element.fontSize}px;font-weight:${element.fontWeight};color:${escapeHtml(element.color)};text-align:${element.align};white-space:pre-wrap;line-height:1.35;`;
  if (element.kind === 'logo') {
    const logoSource = String(element.logoDataUrl ?? '').trim() || (company?.showLogoOnDocuments !== false ? company?.logoDataUrl : '');
    const logo = logoSource
      ? `<img src="${escapeHtml(logoSource)}" style="width:100%;height:100%;object-fit:contain;"/>`
      : `<div style="width:100%;height:100%;display:grid;place-items:center;background:#eef2ff;border:1px dashed #94a3b8;color:#475569;font-size:12px;font-weight:700;">LOGO</div>`;
    return `<div style="${commonStyle}">${logo}</div>`;
  }
  if (element.kind === 'line') {
    const thickness = Math.max(1, element.height);
    return `<div style="${commonStyle}height:${thickness}px;background:${escapeHtml(element.color)};"></div>`;
  }
  if (element.kind === 'signature') {
    const label = applyDesignerTokens(element.text || 'Podpis', context);
    return `<div style="${commonStyle}${textStyle}display:flex;flex-direction:column;justify-content:flex-end;"><div style="font-size:${Math.max(9, element.fontSize)}px;font-weight:${element.fontWeight};margin-bottom:30px;">${escapeHtml(label)}</div><div style="border-top:1px dotted #64748b;padding-top:4px;font-size:9px;color:#64748b;text-align:center;">miejscowość, data i podpis</div></div>`;
  }
  if (element.kind === 'table') {
    const sourceRows = resolveDocumentTableRows(context, context.documentTypeId);
    const safeColumns = resolveDesignerEquipmentTableColumns(element, context.documentTypeId);
    const header = safeColumns.map((column) => `<th style="padding:3px 5px;text-align:left;border-bottom:1px solid #c0c8d4;background:#1e3a5f;color:#fff;font-size:8px;font-weight:700;">${escapeHtml(column.label)}</th>`).join('');
    const body = sourceRows.map((row) => `<tr>${safeColumns.map((column) => `<td style="padding:3px 5px;border-bottom:1px solid #e2e8f0;font-size:8.5px;color:#111;">${escapeHtml(row[column.key] ?? '—')}</td>`).join('')}</tr>`).join('');
    return `<div style="${commonStyle}border:1px solid #c0c8d4;background:#fff;overflow:hidden;"><table style="width:100%;border-collapse:collapse;table-layout:fixed;"><colgroup>${safeColumns.map((column) => `<col style="width:${column.width}px;">`).join('')}</colgroup><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table></div>`;
  }
  const text = applyDesignerTokens(element.text, context);
  return `<div style="${commonStyle}${textStyle}">${escapeHtml(text).replace(/\n/g, '<br/>')}</div>`;
}

function createDesignerDocumentLayoutCss() {
  return `@page{size:A4;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;color:#111;font-family:Arial,Helvetica,sans-serif}body{display:flex;justify-content:center;align-items:flex-start;min-height:100vh;background:#e2e8f0}.designer-doc-page{position:relative;width:${DOCUMENT_DESIGNER_PAGE.width}px;height:${DOCUMENT_DESIGNER_PAGE.height}px;background:#fff;overflow:hidden;box-shadow:0 0 0 1px #cbd5e1}.designer-doc-toolbar{position:sticky;top:0;z-index:2;display:flex;justify-content:flex-end;padding:8px 12px;background:#fff;border-bottom:1px solid #dde3ed}.designer-doc-toolbar button{border:1.5px solid #1e3a5f;border-radius:6px;background:#1e3a5f;color:#fff;padding:6px 14px;font-weight:700;cursor:pointer;font-size:11px}@media print{html,body{background:#fff;min-height:auto;display:block}.designer-doc-page{box-shadow:none;margin:0 auto;page-break-after:always}.designer-doc-toolbar{display:none}}`;
}

function renderDesignerDocumentHtml(template, context = {}, { preview = true, company = getCompanyProfile(), title = '' } = {}) {
  const normalized = normalizeDocumentDesignerTemplate(template, template?.documentTypeId);
  const renderContext = { ...context, documentTypeId: normalized.documentTypeId };
  const elementsHtml = normalized.elements.map((element) => renderDocumentDesignerElementHtml(element, renderContext, company)).join('');
  const docTitle = escapeHtml(title || normalized.name || 'Dokument');
  const toolbar = preview ? '' : '<div class="designer-doc-toolbar"><button type="button" onclick="window.print()">Drukuj / zapisz PDF</button></div>';
  return `<!doctype html><html lang="pl"><head><meta charset="utf-8"/><title>${docTitle}</title><style>${createDesignerDocumentLayoutCss()}</style></head><body>${toolbar}<div class="designer-doc-page">${elementsHtml}</div></body></html>`;
}

function buildDocumentDesignerHtml(template, context = {}, options = {}) {
  return renderDesignerDocumentHtml(template, context, options);
}

function termsTextToArray(value) {
  const lines = String(value ?? '')
    .split('\n')
    .map((line) => line.trim().replace(/^[-*]\s*/, ''))
    .filter(Boolean);
  return lines.length ? lines : DEFAULT_RENTAL_AGREEMENT_TERMS;
}

function mapSharedTemplateToRentalAgreementTemplate(sharedTemplate, fallbackTemplate = getRentalAgreementTemplate()) {
  const fallback = normalizeRentalAgreementTemplate(fallbackTemplate);
  const normalized = normalizeSharedDocumentTemplate(sharedTemplate, sharedTemplate);
  return normalizeRentalAgreementTemplate({
    ...fallback,
    documentTitle: normalized.title || fallback.documentTitle,
    introText: normalized.introText || fallback.introText,
    issuerText: normalized.issuerText || fallback.issuerText,
    borrowerText: normalized.borrowerText || fallback.borrowerText,
    termsText: normalized.termsText || fallback.termsText,
    footerText: normalized.footerText || fallback.footerText,
    sectionVisibility: { ...fallback.sectionVisibility, ...normalized.sectionVisibility },
    sectionOrder: normalized.sectionOrder?.length ? normalized.sectionOrder : fallback.sectionOrder,
    columns: normalized.columns?.length ? normalized.columns : fallback.columns,
    terms: termsTextToArray(normalized.termsText || fallback.termsText)
  });
}

function normalizeDocumentNumbering(value, fallback) {
  return {
    prefix: String(value?.prefix ?? fallback.prefix).trim().toUpperCase() || fallback.prefix,
    format: String(value?.format ?? fallback.format).trim() || fallback.format,
    padding: Math.max(1, Number(value?.padding ?? fallback.padding) || fallback.padding)
  };
}

function normalizeDocumentSettings(settings) {
  const templates = { ...DEFAULT_DOCUMENT_SETTINGS.templates, ...(settings?.templates ?? {}) };
  Object.keys(templates).forEach((key) => {
    if (!DOCUMENT_TEMPLATE_OPTIONS.includes(templates[key])) templates[key] = 'Standardowy';
  });
  return {
    templates,
    documentTemplates: {
      ...DEFAULT_DOCUMENT_TEMPLATES,
      ...(settings?.documentTemplates ?? {}),
      [RENTAL_AGREEMENT_TEMPLATE_KEY]: normalizeRentalAgreementTemplate(settings?.documentTemplates?.[RENTAL_AGREEMENT_TEMPLATE_KEY])
    },
    numbering: Object.fromEntries(Object.entries(DEFAULT_DOCUMENT_NUMBERING).map(([key, fallback]) => [
      key,
      normalizeDocumentNumbering(settings?.numbering?.[key], fallback)
    ]))
  };
}

function getDocumentSettings() {
  return normalizeDocumentSettings(getStoredJson(DOCUMENT_SETTINGS_STORAGE_KEY, DEFAULT_DOCUMENT_SETTINGS));
}

function saveDocumentSettings(settings) {
  const normalized = normalizeDocumentSettings(settings);
  localStorage.setItem(DOCUMENT_SETTINGS_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

function formatDocumentNumber(settings, sequence, date = new Date()) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear());
  const nr = String(sequence).padStart(Number(settings.padding) || 3, '0');
  const parts = { PREFIX: settings.prefix, NR: nr, DD: day, MM: month, YYYY: year };
  return String(settings.format || DEFAULT_DOCUMENT_NUMBERING.service.format)
    .split('/')
    .map((part) => parts[part] ?? part)
    .join('/');
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
  return formatDocumentAddress(profile);
}

function formatCompanyTaxData(profile) {
  return [profile.nip ? `NIP: ${profile.nip}` : '', profile.regon ? `REGON: ${profile.regon}` : ''].filter(Boolean).join(' · ');
}

function formatCompanyContact(profile) {
  return [profile.phone, profile.email, profile.website].filter(Boolean).join(' · ');
}

function DataTable({ columns, rows, storageKey, loading = false, onOpen, onRowClick = null, onEdit, onDuplicate, onHistory, onDelete, onBulkDelete, customRowActions = [], isRowLocked = null, isRowExpandable = null, renderExpandedRow = null, canDelete = () => true, openLabel = 'Otwórz', editLabel = 'Edytuj', deleteLabel = 'Usuń', enableSelectionActions = true, getRowClassName = null }) {
  const columnsSignature = columns.map((column) => column.key).join('|');
  const defaultPreference = useMemo(() => ({
    visibleColumns: columns.map((column) => column.key),
    columnOrder: columns.map((column) => column.key),
    columnWidths: {},
    columnAlignments: {},
    sortKey: null,
    sortDir: 'asc',
    lpVisible: true
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
  const [columnAlignments, setColumnAlignments] = useState(initialPreference.columnAlignments ?? {});
  const [selectedRowKeys, setSelectedRowKeys] = useState(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [expandedRowKeys, setExpandedRowKeys] = useState(() => new Set());
  const [lpVisible, setLpVisible] = useState(initialPreference.lpVisible !== false);
  // Refs always reflect the latest state so event-handler closures (drag, resize)
  // never read stale values when calling persistTablePreference.
  const columnOrderRef = useRef(initialPreference.columnOrder);
  columnOrderRef.current = columnOrder;
  const visibleColumnsRef = useRef(initialPreference.visibleColumns);
  visibleColumnsRef.current = visibleColumns;
  const columnWidthsRef = useRef(initialPreference.columnWidths);
  columnWidthsRef.current = columnWidths;
  const columnAlignmentsRef = useRef(initialPreference.columnAlignments ?? {});
  columnAlignmentsRef.current = columnAlignments;
  const sortKeyRef = useRef(initialPreference.sortKey);
  sortKeyRef.current = sortKey;
  const sortDirRef = useRef(initialPreference.sortDir ?? 'asc');
  sortDirRef.current = sortDir;
  const lpVisibleRef = useRef(initialPreference.lpVisible !== false);
  lpVisibleRef.current = lpVisible;

  const persistTablePreference = (nextPreference) => {
    saveTablePreference(storageKey, {
      visibleColumns: nextPreference.visibleColumns ?? visibleColumnsRef.current,
      columnOrder: nextPreference.columnOrder ?? columnOrderRef.current,
      columnWidths: nextPreference.columnWidths ?? columnWidthsRef.current,
      columnAlignments: nextPreference.columnAlignments ?? columnAlignmentsRef.current,
      sortKey: Object.prototype.hasOwnProperty.call(nextPreference, 'sortKey') ? nextPreference.sortKey : sortKeyRef.current,
      sortDir: nextPreference.sortDir ?? sortDirRef.current,
      lpVisible: Object.prototype.hasOwnProperty.call(nextPreference, 'lpVisible') ? nextPreference.lpVisible : lpVisibleRef.current
    });
  };

  useEffect(() => {
    let active = true;
    fetchTablePreference(storageKey, defaultPreference).then(({ data }) => {
      if (!active || !data) return;
      const availableKeys = columns.map((column) => column.key);
      const savedColumnOrder = data.columnOrder ?? [];
      const orderedExisting = savedColumnOrder.filter((key) => availableKeys.includes(key));
      const missingOrder = availableKeys.filter((key) => !orderedExisting.includes(key));
      const visibleExisting = (data.visibleColumns ?? []).filter((key) => availableKeys.includes(key));
      // Only auto-show columns that are genuinely new (not in saved columnOrder).
      // Columns absent from visibleColumns but present in columnOrder were hidden by the user.
      const missingVisible = columns.filter((column) =>
        column.defaultVisible !== false &&
        !visibleExisting.includes(column.key) &&
        !savedColumnOrder.includes(column.key)
      ).map((column) => column.key);
      setVisibleColumns(visibleExisting.length ? [...visibleExisting, ...missingVisible] : availableKeys);
      setColumnOrder([...orderedExisting, ...missingOrder]);
      setColumnWidths(data.columnWidths);
      setColumnAlignments(data.columnAlignments ?? {});
      setSortKey(data.sortKey ?? null);
      setSortDir(data.sortDir ?? 'asc');
      setLpVisible(data.lpVisible !== false);
    });
    return () => { active = false; };
  }, [storageKey, defaultPreference]);

  useEffect(() => {
    const availableKeys = columns.map((column) => column.key);
    // Snapshot before setState so we can identify genuinely new columns below.
    const previousKnownKeys = columnOrderRef.current;
    setColumnOrder((current) => {
      const orderedExisting = current.filter((key) => availableKeys.includes(key));
      const missing = availableKeys.filter((key) => !orderedExisting.includes(key));
      return [...orderedExisting, ...missing];
    });
    setVisibleColumns((current) => {
      const next = current.filter((key) => availableKeys.includes(key));
      // Only auto-show columns that are genuinely new to the column definition.
      // Columns absent from visibleColumns but in previousKnownKeys were hidden by the user.
      const genuinelyNew = columns.filter((column) =>
        column.defaultVisible !== false &&
        !next.includes(column.key) &&
        !previousKnownKeys.includes(column.key)
      ).map((column) => column.key);
      return next.length ? [...next, ...genuinelyNew] : availableKeys;
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
      const polishDate = text.match(/^(\d{2})[./-](\d{2})[./-](\d{4})/);
      if (polishDate) return Date.parse(`${polishDate[3]}-${polishDate[2]}-${polishDate[1]}T00:00:00`);
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
  const hasSelectionActions = enableSelectionActions;
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
  const selectedContextColumn = contextMenu?.columnKey ? columns.find((column) => column.key === contextMenu.columnKey) : null;

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

  const setColumnAlignment = (key, alignment) => {
    const normalized = normalizeColumnAlignment(alignment);
    if (!key || !normalized) return;
    const next = { ...columnAlignmentsRef.current, [key]: normalized };
    setColumnAlignments(next);
    setContextMenu(null);
    persistTablePreference({ columnAlignments: next });
  };

  const openColumnSubmenu = (submenu, event = null) => {
    setContextMenu((current) => {
      if (!current) return current;
      if (!submenu) return { ...current, submenu: null, submenuPosition: null };
      const viewport = window.visualViewport;
      const viewportWidth = viewport?.width ?? window.innerWidth;
      const viewportHeight = viewport?.height ?? window.innerHeight;
      const offsetLeft = viewport?.offsetLeft ?? 0;
      const offsetTop = viewport?.offsetTop ?? 0;
      const padding = 18;
      const submenuWidth = 220;
      const submenuHeight = submenu === 'columns' ? Math.min(360, Math.max(180, orderedColumns.length * 36 + 16)) : 140;
      const rect = event?.currentTarget?.getBoundingClientRect?.();
      const baseX = rect ? rect.right + 6 : current.x + 226;
      const fallbackLeftX = rect ? rect.left - submenuWidth - 6 : current.x - submenuWidth - 6;
      const opensLeft = baseX + submenuWidth + padding > offsetLeft + viewportWidth;
      const x = opensLeft ? Math.max(offsetLeft + padding, fallbackLeftX) : Math.min(baseX, offsetLeft + viewportWidth - submenuWidth - padding);
      const preferredY = rect ? rect.top : current.y;
      const y = Math.min(Math.max(offsetTop + padding, preferredY), Math.max(offsetTop + padding, offsetTop + viewportHeight - submenuHeight - padding));
      return { ...current, submenu, submenuPosition: { x, y }, submenuSide: opensLeft ? 'left' : 'right' };
    });
  };

  const moveColumn = (sourceKey, targetKey) => {
    if (!sourceKey || sourceKey === targetKey) return;
    const next = [...columnOrderRef.current];
    const sourceIndex = next.indexOf(sourceKey);
    const targetIndex = next.indexOf(targetKey);
    if (sourceIndex === -1 || targetIndex === -1) return;
    next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, sourceKey);
    setColumnOrder(next);
    persistTablePreference({ columnOrder: next });
  };

  const startResize = (event, key) => {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const th = event.currentTarget.closest('th');
    const startWidth = th?.offsetWidth ?? columnWidthsRef.current[key] ?? 140;
    let lastWidth = startWidth;

    const onMouseMove = (moveEvent) => {
      lastWidth = Math.max(72, startWidth + moveEvent.clientX - startX);
      setColumnWidths((current) => ({ ...current, [key]: lastWidth }));
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.classList.remove('resizing-table-column');
      persistTablePreference({ columnWidths: { ...columnWidthsRef.current, [key]: lastWidth } });
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
    setColumnAlignments({});
    setSortKey(null);
    setSortDir('asc');
    setLpVisible(true);
    persistTablePreference({ visibleColumns: keys, columnOrder: keys, columnWidths: {}, columnAlignments: {}, sortKey: null, sortDir: 'asc', lpVisible: true });
    setContextMenu(null);
  };

  const toggleLpColumn = () => {
    const next = !lpVisible;
    setLpVisible(next);
    persistTablePreference({ lpVisible: next });
  };

  const openColumnMenu = (event, columnKey = null) => {
    event.preventDefault();
    setRowContextMenu(null);
    const position = getSafeMenuPosition(event, 230, 260);
    const viewport = window.visualViewport;
    const viewportWidth = viewport?.width ?? window.innerWidth;
    const offsetLeft = viewport?.offsetLeft ?? 0;
    const submenuSide = position.x + 230 + 230 + 18 > offsetLeft + viewportWidth ? 'left' : 'right';
    setContextMenu({ ...position, columnKey, submenu: null, submenuSide });
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
          <colgroup>{hasSelectionActions && <col className="selection-col" />}{lpVisible && <col className="lp-col" />}{hasExpandableRows && <col className="expand-col" />}{activeColumns.map((column) => <col key={column.key} style={{ width: columnWidths[column.key] ? `${columnWidths[column.key]}px` : undefined }} />)}</colgroup>
          <thead><tr>{hasSelectionActions && <th className="selection-cell selection-header" onClick={(event) => event.stopPropagation()}><input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisibleRows} aria-label="Zaznacz wszystkie widoczne pozycje" /></th>}{lpVisible && <th className="lp-cell lp-header" aria-label="Liczba porządkowa">Lp.</th>}{hasExpandableRows && <th className="expand-cell expand-header" aria-label="Rozwiń wiersz" />}{activeColumns.map((column) => {
            const alignment = getColumnAlignment(column, columnAlignments);
            return <th key={column.key} draggable aria-sort={sortKey === column.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'} onContextMenu={(event) => openColumnMenu(event, column.key)} onDragStart={(event) => { setDraggedColumn(column.key); event.dataTransfer.effectAllowed = 'move'; }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); moveColumn(draggedColumn, column.key); setDraggedColumn(null); }} onDragEnd={() => setDraggedColumn(null)} onClick={() => handleSort(column.key)} className={`${draggedColumn === column.key ? 'dragging-column' : ''} ${sortKey === column.key ? 'sorted' : ''} table-align-${alignment}`.trim()}><span>{column.label}</span>{sortKey === column.key && <em>{sortDir === 'asc' ? '↑' : '↓'}</em>}<button type="button" className="column-resizer" aria-label={`Zmień szerokość kolumny ${column.label}`} onMouseDown={(event) => startResize(event, column.key)} /></th>;
          })}</tr></thead>
          <tbody>{sortedRows.map((row, index) => {
            const rowKey = getRowKey(row, index);
            const selected = selectedRowKeys.has(rowKey);
            const expandable = hasExpandableRows && isRowExpandable?.(row);
            const expanded = expandable && expandedRowKeys.has(rowKey);
            const rowToneClass = row._rowTone ? `row-tone-${row._rowTone}` : '';
            const customRowClass = typeof getRowClassName === 'function' ? getRowClassName(row) : '';
            const rowClass = `${hasActions ? 'editable-row' : ''} ${selected ? 'selected-row' : ''} ${expandable ? 'expandable-row' : ''} ${expanded ? 'expanded-row' : ''} ${rowToneClass} ${customRowClass}`.trim();
            const rowTitle = expandable
              ? 'Kliknij, żeby rozwinąć zawartość zestawu. Dwuklik otwiera kartotekę.'
              : hasActions
                ? onRowClick ? 'Pojedynczy klik pokazuje szczegóły. Dwuklik lub Enter otwiera kartotekę. Prawy klik pokazuje operacje.' : 'Dwuklik lub Enter otwiera kartotekę. Prawy klik pokazuje operacje.'
                : 'Prawy klik pokazuje operacje tabeli.';
            return <Fragment key={`${row.id ?? row.localId ?? row.number ?? row.name}-${index}`}>
              <tr tabIndex={hasActions ? 0 : undefined} className={rowClass} onClick={(event) => { if (event.target.closest('button, input, select, textarea, a')) return; onRowClick?.(row); if (expandable) toggleExpandedRow(row, index); }} onKeyDown={(event) => { if (event.key === 'Enter' && hasActions) (onOpen ?? onEdit)?.(row); }} onDoubleClick={() => (typeof isRowLocked === 'function' && isRowLocked(row)) ? alert('Ta pozycja jest składnikiem zestawu. Operacje są zablokowane do czasu usunięcia jej z zestawu.') : (onOpen ?? onEdit)?.(row)} onContextMenu={(event) => openRowMenu(event, row)} title={rowTitle}>{hasSelectionActions && <td className="selection-cell"><input type="checkbox" checked={selected} onChange={() => toggleRowSelection(row, index)} onClick={(event) => event.stopPropagation()} aria-label="Zaznacz pozycję" /></td>}{lpVisible && <td className="lp-cell table-align-center">{index + 1}</td>}{hasExpandableRows && <td className="expand-cell">{expandable && <button type="button" className="row-expand-button" onClick={(event) => { event.stopPropagation(); toggleExpandedRow(row, index); }} aria-label={expanded ? 'Zwiń zestaw' : 'Rozwiń zestaw'}>{expanded ? '▾' : '▸'}</button>}</td>}{activeColumns.map((column) => <td key={column.key} className={`table-align-${getColumnAlignment(column, columnAlignments)}`}>{column.renderCell ? column.renderCell(row) : column.key === 'status' || column.key === 'client_kind' ? <StatusPill value={row[column.key]} /> : row[column.key]}</td>)}</tr>
              {expanded && <tr className="expanded-content-row"><td colSpan={activeColumns.length + (hasSelectionActions ? 1 : 0) + (lpVisible ? 1 : 0) + (hasExpandableRows ? 1 : 0)}>{renderExpandedRow(row)}</td></tr>}
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
      {contextMenu && <div className="column-context-menu column-menu-desktop" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={(event) => event.stopPropagation()} onMouseLeave={() => openColumnSubmenu(null)}>
        <div className="column-menu-submenu-row" onMouseEnter={(event) => openColumnSubmenu('alignment', event)}>
          <button type="button" className={contextMenu.submenu === 'alignment' ? 'active' : ''} onClick={(event) => openColumnSubmenu(contextMenu.submenu === 'alignment' ? null : 'alignment', event)}>Wyrównanie <ChevronRight size={14} /></button>
          {contextMenu.submenu === 'alignment' && selectedContextColumn && <div className={`column-submenu column-submenu-${contextMenu.submenuSide ?? 'right'}`} style={{ left: contextMenu.submenuPosition?.x, top: contextMenu.submenuPosition?.y }}>
            {[
              { value: 'left', label: 'Do lewej', icon: AlignLeft },
              { value: 'center', label: 'Do środka', icon: AlignCenter },
              { value: 'right', label: 'Do prawej', icon: AlignRight }
            ].map((item) => {
              const Icon = item.icon;
              const active = getColumnAlignment(selectedContextColumn, columnAlignments) === item.value;
              return <button key={item.value} type="button" className={active ? 'active' : ''} onClick={() => setColumnAlignment(selectedContextColumn.key, item.value)}><span className="submenu-check">{active ? '✓' : ''}</span><Icon size={14} />{item.label}</button>;
            })}
          </div>}
        </div>
        <div className="column-menu-submenu-row" onMouseEnter={(event) => openColumnSubmenu('columns', event)}>
          <button type="button" className={contextMenu.submenu === 'columns' ? 'active' : ''} onClick={(event) => openColumnSubmenu(contextMenu.submenu === 'columns' ? null : 'columns', event)}>Kolumny <ChevronRight size={14} /></button>
          {contextMenu.submenu === 'columns' && <div className={`column-submenu column-submenu-columns column-submenu-${contextMenu.submenuSide ?? 'right'}`} style={{ left: contextMenu.submenuPosition?.x, top: contextMenu.submenuPosition?.y }}>
            <label key="__lp__"><input type="checkbox" checked={lpVisible} onChange={toggleLpColumn} />Lp.</label>
            {orderedColumns.map((column) => {
              const checked = visibleColumns.includes(column.key);
              const disabled = checked && visibleColumns.length === 1;
              return <label key={column.key} className={disabled ? 'disabled' : ''}><input type="checkbox" checked={checked} disabled={disabled} onChange={() => toggleColumn(column.key)} />{column.label}</label>;
            })}
          </div>}
        </div>
        <div className="context-menu-separator" />
        <button type="button" onClick={resetColumns}>Resetuj ustawienia tabeli</button>
      </div>}
    </div>
  );
}

/* ── Global status colour system ── */
const STATUS_COLORS_STORAGE_KEY = 'fixer-status-colors';

const STATUS_COLOR_PALETTE = [
  { id: 'blue', label: 'Niebieski', hex: '#3b82f6' },
  { id: 'indigo', label: 'Indygo', hex: '#6366f1' },
  { id: 'violet', label: 'Fioletowy', hex: '#8b5cf6' },
  { id: 'teal', label: 'Morski', hex: '#14b8a6' },
  { id: 'green', label: 'Zielony', hex: '#22c55e' },
  { id: 'lime', label: 'Limonkowy', hex: '#84cc16' },
  { id: 'yellow', label: 'Żółty', hex: '#eab308' },
  { id: 'orange', label: 'Pomarańczowy', hex: '#f97316' },
  { id: 'red', label: 'Czerwony', hex: '#ef4444' },
  { id: 'rose', label: 'Różowy', hex: '#f43f5e' },
  { id: 'gray', label: 'Szary', hex: '#64748b' },
  { id: 'slate', label: 'Łupkowy', hex: '#94a3b8' }
];

const DEFAULT_STATUS_COLORS = {
  'przyjęte': '#3b82f6', 'w diagnozie': '#6366f1', 'oczekuje na części': '#f97316',
  'w naprawie': '#8b5cf6', 'gotowe do odbioru': '#22c55e', 'wydane': '#14b8a6',
  'dostępny': '#22c55e', 'wypożyczony': '#3b82f6', 'rezerwacja': '#f97316',
  'serwis': '#6366f1', 'uszkodzony': '#ef4444', 'wycofany': '#64748b', 'składnik zestawu': '#94a3b8',
  'aktywne': '#3b82f6', 'częściowo zwrócone': '#f97316', 'zwrócone': '#22c55e', 'zwrócony': '#22c55e', 'wydany': '#3b82f6', 'zagubiony': '#ef4444', 'wymaga serwisu': '#f97316', 'po terminie': '#ef4444',
  'do zrobienia': '#3b82f6', 'w trakcie': '#8b5cf6', 'oczekuje': '#f97316', 'zrobione': '#22c55e',
  'anulowane': '#ef4444',
  'stały': '#22c55e', 'nowy': '#3b82f6', 'vip': '#eab308', 'problematyczny': '#ef4444', 'pracownik': '#6366f1',
  'planowany': '#6366f1', 'wstrzymany': '#f97316', 'zakończony': '#22c55e'
};

const SYSTEM_STATUS_LABELS = {
  active: 'Aktywne',
  partially_returned: 'Częściowo zwrócone',
  returned: 'Zwrócone',
  issued: 'Wydany',
  damaged: 'Uszkodzony',
  lost: 'Zagubiony',
  service_required: 'Wymaga serwisu',
  available: 'Dostępny',
  unavailable: 'Niedostępny',
  pending: 'Oczekuje',
  completed: 'Zakończone',
  complete: 'Zakończone',
  cancelled: 'Anulowane',
  canceled: 'Anulowane'
};

function formatSystemStatusLabel(value) {
  const text = String(value ?? '');
  const key = text.trim().toLowerCase();
  return SYSTEM_STATUS_LABELS[key] ?? text;
}

function getStatusColors() {
  try {
    const saved = JSON.parse(localStorage.getItem(STATUS_COLORS_STORAGE_KEY) || 'null');
    if (saved && typeof saved === 'object') return { ...DEFAULT_STATUS_COLORS, ...saved };
  } catch {}
  return { ...DEFAULT_STATUS_COLORS };
}

function saveStatusColors(colorMap) {
  localStorage.setItem(STATUS_COLORS_STORAGE_KEY, JSON.stringify(colorMap));
}

function statusToCssClass(text) {
  return 'sp-' + String(text ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
}

function injectStatusColorStyles(colorMap) {
  let el = document.getElementById('fixer-status-colors-style');
  if (!el) { el = document.createElement('style'); el.id = 'fixer-status-colors-style'; document.head.appendChild(el); }
  const rules = [];
  Object.entries(colorMap).forEach(([name, hex]) => {
    if (!hex || !String(hex).startsWith('#')) return;
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    if (Number.isNaN(r + g + b)) return;
    const cn = statusToCssClass(name);
    rules.push(`.${cn}{background:rgba(${r},${g},${b},.17)!important;color:${hex}!important;}`);
    const rd = Math.round(r * .65), gd = Math.round(g * .65), bd = Math.round(b * .65);
    rules.push(`.app-shell.theme-light .${cn}{background:rgba(${r},${g},${b},.12)!important;color:rgb(${rd},${gd},${bd})!important;}`);
  });
  el.textContent = rules.join('');
}

function StatusPill({ value }) {
  const text = formatSystemStatusLabel(value);
  const cssClass = statusToCssClass(text);
  const lower = text.toLowerCase();
  const tone = lower.includes('przetermin') || lower.includes('po terminie') || lower.includes('problematyczny') || lower.includes('zablokowany') || lower.includes('zagub') || lower.includes('uszk') ? 'danger'
    : lower.includes('zwró') || lower.includes('zwro') || lower.includes('dostęp') || lower.includes('dostep') || lower.includes('sprawny') || lower.includes('gotowe') || lower.includes('vip') || lower.includes('stały') || lower.includes('staly') ? 'success'
    : lower.includes('serwis') || lower.includes('kontrol') || lower.includes('brak akces') || lower.includes('rezerwacja') || lower.includes('pracownik') || lower.includes('nowy') ? 'warning'
    : lower.includes('aktywn') || lower.includes('wypo') || lower.includes('wydania') || lower.includes('wydany') ? 'info'
    : 'neutral';
  return <span className={`status-pill ${cssClass} ${tone}`}>{text}</span>;
}

function StatusColorPicker({ statusName, currentHex, onSelect }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const ref = useRef(null);

  const openPicker = (e) => {
    e.stopPropagation();
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const left = Math.min(rect.left, window.innerWidth - 224);
    const pickerH = 172;
    const top = rect.bottom + pickerH > window.innerHeight ? rect.top - pickerH - 4 : rect.bottom + 4;
    setPos({ top, left });
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return undefined;
    const close = () => setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const hex = currentHex ?? DEFAULT_STATUS_COLORS[statusName.toLowerCase()] ?? '#94a3b8';
  return <>
    <button type="button" ref={ref} className="status-color-swatch" style={{ background: hex }} onClick={openPicker} title={`Kolor statusu: ${statusName}`} aria-label="Zmień kolor" />
    {open && createPortal(
      <div className="status-color-picker" style={{ top: pos.top, left: pos.left }} onMouseDown={(e) => e.stopPropagation()}>
        <p className="status-color-picker-label">{statusName}</p>
        <div className="status-color-palette">
          {STATUS_COLOR_PALETTE.map((color) => (
            <button key={color.id} type="button" className={`status-color-option${hex === color.hex ? ' selected' : ''}`} style={{ background: color.hex }} title={color.label} onClick={(e) => { e.stopPropagation(); onSelect(statusName, color.hex); setOpen(false); }} />
          ))}
        </div>
        <button type="button" className="status-color-reset-btn" onClick={(e) => { e.stopPropagation(); onSelect(statusName, DEFAULT_STATUS_COLORS[statusName.toLowerCase()] ?? null); setOpen(false); }}>Resetuj do domyślnego</button>
      </div>,
      document.body
    )}
  </>;
}

const normalizeDictionaryEditorItem = (item, index, fallbackPrefix = 'item') => {
  if (typeof item === 'string') return { id: `${fallbackPrefix}-${index}-${item}`, name: item, readonly: true, readonlyLabel: 'Systemowy' };
  return {
    id: item?.id ?? item?.key ?? `${fallbackPrefix}-${index}-${item?.name ?? ''}`,
    name: String(item?.name ?? item?.label ?? ''),
    active: item?.active,
    readonly: Boolean(item?.readonly),
    readonlyLabel: item?.readonlyLabel || (item?.readonly ? 'Tylko odczyt' : ''),
    raw: item?.raw ?? item
  };
};

function DictionaryEditor({
  title,
  description,
  items = [],
  onAdd,
  onEdit,
  onDelete,
  onMove,
  onReset,
  onToggleActive,
  supportsColor = false,
  supportsActiveState = false,
  readonlyItems = [],
  emptyText = 'Brak pozycji w słowniku.',
  addLabel = 'Dodaj',
  nameLabel = 'Nazwa',
  statusColors = {},
  onColorChange = () => {}
}) {
  const normalizedItems = items.map((item, index) => normalizeDictionaryEditorItem(item, index, title));
  const normalizedReadonlyItems = readonlyItems.map((item, index) => normalizeDictionaryEditorItem(item, index, `${title}-readonly`));
  const rows = [...normalizedItems, ...normalizedReadonlyItems];
  const [newValue, setNewValue] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingValue, setEditingValue] = useState('');
  const [error, setError] = useState('');
  const [busyKey, setBusyKey] = useState('');

  const names = rows.map((row) => row.name.trim().toLocaleLowerCase('pl')).filter(Boolean);
  const validateName = (value, currentId = null) => {
    const normalized = value.trim();
    if (!normalized) return 'Wpisz nazwę pozycji.';
    const duplicate = rows.some((row) => row.id !== currentId && row.name.trim().toLocaleLowerCase('pl') === normalized.toLocaleLowerCase('pl'));
    if (duplicate || names.filter((name) => name === normalized.toLocaleLowerCase('pl')).length > (currentId ? 1 : 0)) return 'Taka pozycja już istnieje w tym słowniku.';
    return '';
  };

  const runAction = async (action, fallbackMessage) => {
    try {
      const result = await action();
      if (typeof result === 'string' && result) throw new Error(result);
      if (result?.error) throw new Error(result.error.message || result.error || fallbackMessage);
      return true;
    } catch (actionError) {
      setError(actionError.message || fallbackMessage);
      return false;
    } finally {
      setBusyKey('');
    }
  };

  const addItem = async () => {
    if (!onAdd) return;
    const value = newValue.trim();
    const validation = validateName(value);
    if (validation) { setError(validation); return; }
    setBusyKey('add');
    const ok = await runAction(() => onAdd(value), 'Nie udało się dodać pozycji.');
    if (ok) {
      setNewValue('');
      setError('');
    }
  };

  const startEdit = (row) => {
    if (row.readonly || !onEdit) return;
    setEditingId(row.id);
    setEditingValue(row.name);
    setError('');
  };

  const saveEdit = async (row) => {
    if (!onEdit) return;
    const value = editingValue.trim();
    const validation = validateName(value, row.id);
    if (validation) { setError(validation); return; }
    setBusyKey(`edit-${row.id}`);
    const ok = await runAction(() => onEdit(row.raw, value, row), 'Nie udało się zapisać pozycji.');
    if (ok) {
      setEditingId(null);
      setEditingValue('');
      setError('');
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingValue('');
    setError('');
  };

  const deleteItem = async (row) => {
    if (row.readonly || !onDelete) return;
    setBusyKey(`delete-${row.id}`);
    await runAction(() => onDelete(row.raw, row), 'Nie udało się usunąć pozycji.');
  };

  const moveItem = async (row, direction) => {
    if (row.readonly || !onMove) return;
    setBusyKey(`move-${row.id}`);
    await runAction(() => onMove(row.raw, direction, row), 'Nie udało się zmienić kolejności.');
  };

  const toggleActive = async (row) => {
    if (row.readonly || !onToggleActive) return;
    setBusyKey(`active-${row.id}`);
    await runAction(() => onToggleActive(row.raw, row), 'Nie udało się zmienić aktywności pozycji.');
  };

  return <div className="settings-card compact-admin-card settings-dictionary-card dictionary-card-compact-list dictionary-editor">
    <div className="settings-card-header compact-card-header dictionary-card-header dictionary-editor-header">
      <div>
        <h3>{title}</h3>
        {description && <p className="muted">{description}</p>}
      </div>
      {onReset && <AppButton variant="secondary" size="sm" className="dictionary-reset-button" onClick={onReset}><RotateCcw size={13} />Domyślne</AppButton>}
    </div>
    {onAdd && <div className="dictionary-add-compact dictionary-editor-add">
      <AppInput aria-label={nameLabel} value={newValue} onChange={(event) => { setNewValue(event.target.value); if (error) setError(''); }} onKeyDown={(event) => { if (event.key === 'Enter') addItem(); if (event.key === 'Escape') { setNewValue(''); setError(''); } }} placeholder={addLabel} disabled={busyKey === 'add'} />
      <button type="button" className="dictionary-icon-button add" onClick={addItem} aria-label="Dodaj" title="Dodaj" disabled={busyKey === 'add'}><Plus size={16} /></button>
    </div>}
    {error && <p className="dictionary-field-error">{error}</p>}
    <div className="dictionary-list dictionary-list-compact dictionary-editor-list">
      {rows.length === 0 && <div className="dictionary-empty-row">{emptyText}</div>}
      {rows.map((row, index) => {
        const isEditing = editingId === row.id;
        const canMove = Boolean(onMove) && !row.readonly && index < normalizedItems.length;
        return <div className={`dictionary-row dictionary-row-compact dictionary-editor-row ${isEditing ? 'editing' : ''} ${row.active === false ? 'inactive' : ''} ${row.readonly ? 'readonly' : ''}`} key={row.id}>
          <div className="dictionary-editor-name-cell">
            {isEditing
              ? <AppInput value={editingValue} onChange={(event) => { setEditingValue(event.target.value); if (error) setError(''); }} onKeyDown={(event) => { if (event.key === 'Enter') saveEdit(row); if (event.key === 'Escape') cancelEdit(); }} autoFocus disabled={busyKey === `edit-${row.id}`} />
              : <button type="button" className={`dictionary-name-button ${row.readonly ? 'readonly' : ''}`} onClick={() => startEdit(row)} title={row.readonly ? row.readonlyLabel || 'Tylko do odczytu' : 'Edytuj'} disabled={row.readonly || !onEdit}>{row.name}</button>}
            {row.readonly && <span className="dictionary-readonly-badge" title="Pozycja systemowa nie może mieć zmienionej nazwy ani zostać usunięta.">{row.readonlyLabel || 'Systemowy'}</span>}
          </div>
          <div className="dictionary-row-actions dictionary-icon-actions">
            {supportsColor && <StatusColorPicker statusName={row.name} currentHex={statusColors[row.name.toLowerCase()]} onSelect={onColorChange} />}
            {isEditing
              ? <>
                <button type="button" className="dictionary-icon-button save" onClick={() => saveEdit(row)} aria-label="Zapisz" title="Zapisz" disabled={busyKey === `edit-${row.id}`}><Save size={15} /></button>
                <button type="button" className="dictionary-icon-button cancel" onClick={cancelEdit} aria-label="Anuluj" title="Anuluj"><X size={15} /></button>
              </>
              : <>
                {supportsActiveState && <button type="button" className={`dictionary-icon-button ${row.active === false ? 'cancel' : 'save'}`} onClick={() => toggleActive(row)} disabled={row.readonly || !onToggleActive || busyKey === `active-${row.id}`} aria-label={row.active === false ? 'Nieaktywna' : 'Aktywna'} title={row.active === false ? 'Nieaktywna' : 'Aktywna'}>{row.active === false ? '○' : '✓'}</button>}
                {onMove && <button type="button" className="dictionary-icon-button order" onClick={() => moveItem(row, -1)} disabled={!canMove || index === 0 || busyKey === `move-${row.id}`} aria-label="Przesuń wyżej" title="Przesuń wyżej"><ArrowUp size={14} /></button>}
                {onMove && <button type="button" className="dictionary-icon-button order" onClick={() => moveItem(row, 1)} disabled={!canMove || index >= normalizedItems.length - 1 || busyKey === `move-${row.id}`} aria-label="Przesuń niżej" title="Przesuń niżej"><ArrowDown size={14} /></button>}
                {onEdit && <button type="button" className="dictionary-icon-button edit" onClick={() => startEdit(row)} disabled={row.readonly} aria-label="Edytuj" title={row.readonly ? row.readonlyLabel || 'Tylko do odczytu' : 'Edytuj'}>✎</button>}
                {onDelete && <button type="button" className="dictionary-icon-button remove" onClick={() => deleteItem(row)} disabled={row.readonly || busyKey === `delete-${row.id}`} aria-label="Usuń" title={row.readonly ? row.readonlyLabel || 'Tylko do odczytu' : 'Usuń'}><Trash2 size={14} /></button>}
              </>}
          </div>
        </div>;
      })}
    </div>
  </div>;
}

function ServiceStatusCell({ value, statuses, onStatusChange }) {
  const [open, setOpen] = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0 });
  const [dropTheme, setDropTheme] = useState('');
  const triggerRef = useRef(null);
  const dropRef = useRef(null);

  const openDropdown = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const estimatedHeight = statuses.length * 36 + 16;
    const fitsBelow = rect.bottom + estimatedHeight + 8 <= window.innerHeight;
    setDropPos({
      top: fitsBelow ? rect.bottom + 4 : rect.top - estimatedHeight - 4,
      left: rect.left
    });
    setDropTheme(document.querySelector('.app-shell')?.classList.contains('theme-light') ? 'theme-light' : '');
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return undefined;
    const handleOutside = (e) => {
      if (triggerRef.current?.contains(e.target) || dropRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const handleKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    const handleScroll = () => setOpen(false);
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleKey);
    document.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('scroll', handleScroll, true);
    };
  }, [open]);

  return (
    <div className="service-status-cell" onClick={(e) => e.stopPropagation()}>
      <button ref={triggerRef} type="button" className="service-status-trigger" onClick={openDropdown} title="Kliknij, aby zmienić status">
        <StatusPill value={value} />
        <ChevronDown size={11} className="service-status-chevron" />
      </button>
      {open && createPortal(
        <div ref={dropRef} className={`service-status-dropdown${dropTheme ? ` ${dropTheme}` : ''}`} style={{ top: dropPos.top, left: dropPos.left }} onClick={(e) => e.stopPropagation()}>
          {statuses.map((s) => (
            <button key={s} type="button" className={`service-status-option${s === value ? ' active' : ''}`} onClick={() => { onStatusChange(s); setOpen(false); }}>
              <StatusPill value={s} />
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}

function SettingsSearch({ value, onChange, results = [], onOpenResult }) {
  return <div className="settings-v2-search-wrap">
    <label className="settings-search-field">
      <Search size={14} />
      <AppInput value={value} onChange={(event) => onChange(event.target.value)} placeholder="Szukaj ustawień: status, logo, backup..." />
    </label>
    {results.length > 0 && <div className="settings-search-results">
      {results.map((target) => <button key={`${target.section}-${target.label}`} type="button" onClick={() => onOpenResult(target)}>{target.label}</button>)}
    </div>}
  </div>;
}

function SettingsNavigation({ sections, activeSection, onSelect }) {
  return <nav className="panel settings-sidebar-panel settings-v2-navigation" aria-label="Sekcje ustawień">
    <ul className="settings-sidebar-nav-list">
      {sections.map((section) => {
        const Icon = section.icon;
        return <li key={section.id}>
          <button type="button" className={`settings-sidebar-item ${activeSection === section.id ? 'active' : ''}`} onClick={() => onSelect(section.id)}>
            <Icon size={16} />
            <span>{section.label}</span>
          </button>
        </li>;
      })}
      {!sections.length && <li className="settings-sidebar-empty">Brak wyników.</li>}
    </ul>
  </nav>;
}

function SettingsSectionShell({ subSections = [], activeSub, onSubChange, children }) {
  return <section className="panel settings-content settings-main-panel settings-section-shell">
    {subSections.length > 0 && <div className="settings-sub-tabs-bar">
      {subSections.map((sub) => <button key={sub.id} type="button"
        className={`settings-sub-tab ${activeSub === sub.id ? 'active' : ''}`}
        onClick={() => onSubChange(sub.id)}>
        {sub.label}
      </button>)}
    </div>}
    {children}
  </section>;
}

function CompanySettingsPanel({ children }) { return children; }
function DocumentsSettingsPanel({ children }) { return children; }
function DictionariesSettingsPanel({ children }) { return children; }
function InterfaceSettingsPanel({ children }) { return children; }
function IntegrationsSettingsPanel({ children }) { return children; }
function SystemSettingsPanel({ children }) { return children; }

function DocumentDesignerDeferredNumberInput({
  elementId,
  value,
  onFocus,
  onCommit,
  onBlurCommit,
  min = 0,
  max = 9999,
  fallback = 0
}) {
  const [draft, setDraft] = useState(String(value ?? ''));
  const focusedRef = useRef(false);

  useEffect(() => {
    if (!focusedRef.current) {
      setDraft(String(value ?? ''));
    }
  }, [elementId, value]);

  const commitDraft = () => {
    focusedRef.current = false;
    const trimmed = String(draft ?? '').trim();
    if (!trimmed || trimmed === '-') {
      setDraft(String(value ?? fallback));
      return;
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
      setDraft(String(value ?? fallback));
      return;
    }
    const clamped = Math.min(max, Math.max(min, Math.round(parsed)));
    if (clamped !== value) onCommit(clamped);
    setDraft(String(clamped));
  };

  return <AppInput
    type="number"
    value={draft}
    onFocus={() => {
      focusedRef.current = true;
      setDraft(String(value ?? ''));
      onFocus?.();
    }}
    onChange={(event) => setDraft(event.target.value)}
    onBlur={() => {
      commitDraft();
      onBlurCommit?.();
    }}
    onKeyDown={(event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        event.currentTarget.blur();
      }
      if (event.key === 'Escape') {
        focusedRef.current = false;
        setDraft(String(value ?? fallback));
        event.currentTarget.blur();
      }
    }}
  />;
}

function DocumentDesignerPanel({ companyProfile, previewContext, onNotice = () => {}, onGeneratePdf = () => {}, fullscreen = false, onClose }) {
  const initialSavedState = useMemo(getDocumentDesignerState, []);
  const [savedDesignerState, setSavedDesignerState] = useState(initialSavedState);
  const [designerState, setDesignerState] = useState(initialSavedState);
  const [historyTick, setHistoryTick] = useState(0);
  const [activeTypeId, setActiveTypeId] = useState(DOCUMENT_TEMPLATE_TYPES[0].id);
  const [activeTemplateId, setActiveTemplateId] = useState('');
  const [selectedElementId, setSelectedElementId] = useState('');
  const [zoomMode, setZoomMode] = useState('fit');
  const [fitScale, setFitScale] = useState(1);
  const [dragState, setDragState] = useState(null);
  const [columnDragKey, setColumnDragKey] = useState('');
  const [showGrid, setShowGrid] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [showGuides, setShowGuides] = useState(true);
  const [dragGuides, setDragGuides] = useState({ vertical: [], horizontal: [] });
  const [libraryCollapsed, setLibraryCollapsed] = useState(false);
  const [propertiesCollapsed, setPropertiesCollapsed] = useState(false);
  const [pendingTypeId, setPendingTypeId] = useState('');
  const [tableColumnResize, setTableColumnResize] = useState(null);
  const importInputRef = useRef(null);
  const logoInputRef = useRef(null);
  const viewportRef = useRef(null);
  const pageRef = useRef(null);
  const designerStateRef = useRef(initialSavedState);
  const historyStoreRef = useRef({});
  const propertyEditSnapshotRef = useRef(null);
  const dragSnapshotRef = useRef(null);
  const columnResizeSnapshotRef = useRef(null);
  const propertyCommitTimerRef = useRef(null);
  const HISTORY_LIMIT = 50;
  const GRID_STEP = 12;
  const SNAP_THRESHOLD = 6;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const activeTypeTemplates = useMemo(
    () => designerState.templates.filter((template) => template.documentTypeId === activeTypeId),
    [designerState.templates, activeTypeId]
  );
  const activeTemplate = useMemo(
    () => activeTypeTemplates.find((template) => template.id === activeTemplateId) ?? activeTypeTemplates[0] ?? null,
    [activeTypeTemplates, activeTemplateId]
  );
  const selectedElement = useMemo(
    () => activeTemplate?.elements.find((element) => element.id === selectedElementId) ?? null,
    [activeTemplate, selectedElementId]
  );
  const activeScale = zoomMode === 'fit' ? fitScale : Number(zoomMode) || 1;
  const isFitZoom = zoomMode === 'fit';
  const normalizeAndClampElement = (element, patch = {}, margins = activeTemplate?.margins) => clampDesignerElementToWorkArea(
    normalizeDocumentDesignerElement({ ...element, ...patch }),
    margins ?? DEFAULT_DESIGNER_MARGINS
  );
  const hasUnsavedChanges = useMemo(
    () => JSON.stringify(designerState) !== JSON.stringify(savedDesignerState),
    [designerState, savedDesignerState]
  );
  const hasUnsavedCurrentTemplateChanges = useMemo(() => {
    if (!activeTemplate) return false;
    const savedTemplate = savedDesignerState.templates.find((template) => template.id === activeTemplate.id);
    if (!savedTemplate) return true;
    return JSON.stringify(activeTemplate) !== JSON.stringify(savedTemplate);
  }, [activeTemplate, savedDesignerState]);
  const designerPreviewContext = useMemo(() => {
    const base = enrichDocumentRenderContext(activeTypeId, {
      ...previewContext,
      documentTypeId: activeTypeId
    });
    if (activeTypeId === 'serviceIntake') {
      base.equipmentRows = buildServiceIntakeTableRows(base);
    }
    return base;
  }, [previewContext, activeTypeId]);

  useEffect(() => {
    designerStateRef.current = designerState;
  }, [designerState]);

  useEffect(() => () => {
    if (propertyCommitTimerRef.current) window.clearTimeout(propertyCommitTimerRef.current);
  }, []);

  const getHistoryKey = (typeId = activeTypeId, templateId = activeTemplateId) => `${typeId}::${templateId || 'none'}`;

  const bumpHistoryUi = () => setHistoryTick((tick) => tick + 1);

  const getHistoryStacks = (key = getHistoryKey()) => {
    if (!historyStoreRef.current[key]) {
      historyStoreRef.current[key] = { past: [], future: [] };
    }
    return historyStoreRef.current[key];
  };

  const pushHistorySnapshot = (snapshot, key = getHistoryKey()) => {
    if (!snapshot) return;
    const stacks = getHistoryStacks(key);
    stacks.past = [...stacks.past.slice(-(HISTORY_LIMIT - 1)), snapshot];
    stacks.future = [];
    bumpHistoryUi();
  };

  const clearAllHistory = () => {
    historyStoreRef.current = {};
    propertyEditSnapshotRef.current = null;
    dragSnapshotRef.current = null;
    columnResizeSnapshotRef.current = null;
    if (propertyCommitTimerRef.current) {
      window.clearTimeout(propertyCommitTimerRef.current);
      propertyCommitTimerRef.current = null;
    }
    bumpHistoryUi();
  };

  const beginPropertyEditSession = () => {
    if (!propertyEditSnapshotRef.current) {
      propertyEditSnapshotRef.current = designerStateRef.current;
    }
  };

  const commitPropertyEditSession = () => {
    if (propertyCommitTimerRef.current) {
      window.clearTimeout(propertyCommitTimerRef.current);
      propertyCommitTimerRef.current = null;
    }
    const snapshot = propertyEditSnapshotRef.current;
    propertyEditSnapshotRef.current = null;
    if (!snapshot) return;
    if (JSON.stringify(snapshot) !== JSON.stringify(designerStateRef.current)) {
      pushHistorySnapshot(snapshot);
    }
  };

  const schedulePropertyEditCommit = () => {
    if (propertyCommitTimerRef.current) window.clearTimeout(propertyCommitTimerRef.current);
    propertyCommitTimerRef.current = window.setTimeout(() => commitPropertyEditSession(), 450);
  };

  const canUndo = useMemo(() => getHistoryStacks().past.length > 0, [activeTypeId, activeTemplateId, historyTick]);
  const canRedo = useMemo(() => getHistoryStacks().future.length > 0, [activeTypeId, activeTemplateId, historyTick]);

  useEffect(() => {
    if (activeTemplateId && activeTypeTemplates.some((template) => template.id === activeTemplateId)) return;
    setActiveTemplateId(activeTypeTemplates[0]?.id ?? '');
  }, [activeTypeTemplates, activeTemplateId]);

  useEffect(() => {
    if (selectedElementId && activeTemplate?.elements.some((element) => element.id === selectedElementId)) return;
    setSelectedElementId('');
  }, [activeTemplate, selectedElementId]);

  useEffect(() => {
    const computeFit = () => {
      const node = viewportRef.current;
      if (!node) return;
      const padding = 48;
      const availableWidth = Math.max(240, node.clientWidth - padding);
      const availableHeight = Math.max(240, node.clientHeight - padding);
      const scale = Math.min(
        availableWidth / DOCUMENT_DESIGNER_PAGE.width,
        availableHeight / DOCUMENT_DESIGNER_PAGE.height
      );
      setFitScale(Math.max(0.15, scale));
    };
    computeFit();
    const observer = new ResizeObserver(computeFit);
    if (viewportRef.current) observer.observe(viewportRef.current);
    window.addEventListener('resize', computeFit);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', computeFit);
    };
  }, [libraryCollapsed, propertiesCollapsed, fullscreen]);

  useEffect(() => {
    const node = viewportRef.current;
    if (!node) return undefined;
    const onWheel = (event) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const delta = event.deltaY > 0 ? -0.05 : 0.05;
      setZoomMode(String(Math.max(0.15, Math.min(2, activeScale + delta)).toFixed(2)));
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, [activeScale]);

  useEffect(() => {
    const node = viewportRef.current;
    if (!node || isFitZoom) return;
    node.scrollTop = 0;
    node.scrollLeft = 0;
  }, [zoomMode, activeScale, isFitZoom]);

  useEffect(() => {
    const beforeUnload = (event) => {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [hasUnsavedChanges]);

  const applyDesignerState = (updater, { trackHistory = true } = {}) => {
    const current = designerStateRef.current;
    const nextRaw = typeof updater === 'function' ? updater(current) : updater;
    const next = normalizeDocumentDesignerState(nextRaw);
    if (trackHistory && JSON.stringify(next) !== JSON.stringify(current)) {
      pushHistorySnapshot(current);
    }
    designerStateRef.current = next;
    setDesignerState(next);
    return next;
  };

  const undo = () => {
    commitPropertyEditSession();
    const key = getHistoryKey();
    const stacks = getHistoryStacks(key);
    if (!stacks.past.length) return;
    const previous = stacks.past[stacks.past.length - 1];
    stacks.past = stacks.past.slice(0, -1);
    stacks.future = [designerStateRef.current, ...stacks.future.slice(0, HISTORY_LIMIT - 1)];
    designerStateRef.current = previous;
    setDesignerState(previous);
    bumpHistoryUi();
  };

  const redo = () => {
    commitPropertyEditSession();
    const key = getHistoryKey();
    const stacks = getHistoryStacks(key);
    if (!stacks.future.length) return;
    const [next, ...rest] = stacks.future;
    stacks.future = rest;
    stacks.past = [...stacks.past.slice(-(HISTORY_LIMIT - 1)), designerStateRef.current];
    designerStateRef.current = next;
    setDesignerState(next);
    bumpHistoryUi();
  };

  const updateActiveTemplate = (updater, options = {}) => {
    if (!activeTemplate) return;
    applyDesignerState((current) => ({
      ...current,
      templates: current.templates.map((template) => {
        if (template.id !== activeTemplate.id) return template;
        const nextTemplate = typeof updater === 'function' ? updater(template) : updater;
        return normalizeDocumentDesignerTemplate(nextTemplate, activeTypeId);
      })
    }), options);
  };

  const saveDraft = () => {
    commitPropertyEditSession();
    try {
      const saved = saveDocumentDesignerState(designerStateRef.current);
      setSavedDesignerState(saved);
      designerStateRef.current = saved;
      setDesignerState(saved);
      onNotice('Zapisano szablon dokumentu.');
    } catch (error) {
      console.error('Document designer save failed', error);
      onNotice('Nie udało się zapisać szablonu dokumentu. Spróbuj ponownie.');
    }
  };

  const discardDraft = () => {
    commitPropertyEditSession();
    designerStateRef.current = savedDesignerState;
    setDesignerState(savedDesignerState);
    clearAllHistory();
    onNotice('Odrzucono niezapisane zmiany.');
  };

  const createTemplate = () => {
    const nextTemplate = createDefaultDocumentDesignerTemplate(activeTypeId, `Nowy szablon ${new Date().toLocaleTimeString('pl-PL')}`);
    applyDesignerState((current) => ({ ...current, templates: [...current.templates, nextTemplate] }));
    setActiveTemplateId(nextTemplate.id);
  };

  const duplicateTemplate = () => {
    if (!activeTemplate) return;
    const clone = normalizeDocumentDesignerTemplate({
      ...activeTemplate,
      id: `${activeTemplate.id}-copy-${Date.now()}`,
      name: `${activeTemplate.name} (kopia)`
    }, activeTypeId);
    applyDesignerState((current) => ({ ...current, templates: [...current.templates, clone] }));
    setActiveTemplateId(clone.id);
  };

  const deleteTemplate = () => {
    if (!activeTemplate) return;
    if (!window.confirm(`Usunąć szablon „${activeTemplate.name}”?`)) return;
    applyDesignerState((current) => {
      const remaining = current.templates.filter((template) => template.id !== activeTemplate.id);
      return { ...current, templates: remaining.length ? remaining : getDefaultDocumentDesignerState().templates };
    });
    setActiveTemplateId('');
  };

  const resetTemplateLayout = () => {
    if (!activeTemplate) return;
    const reset = createDefaultDocumentDesignerTemplate(activeTypeId, activeTemplate.name);
    updateActiveTemplate((template) => ({
      ...template,
      elements: reset.elements,
      margins: reset.margins,
      layoutVersion: DOCUMENT_DESIGNER_LAYOUT_VERSION
    }));
    setSelectedElementId('');
  };

  const exportTemplates = () => {
    downloadTextFile(`fixer-document-designer-${getLocalIsoDate()}.json`, JSON.stringify(designerState, null, 2), 'application/json;charset=utf-8');
    onNotice('Wyeksportowano szablony projektanta.');
  };

  const importTemplates = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const payload = JSON.parse(String(reader.result ?? '{}'));
        const normalized = normalizeDocumentDesignerState(payload);
        applyDesignerState(normalized);
        setActiveTemplateId('');
        onNotice('Zaimportowano szablony projektanta.');
      } catch (error) {
        console.error('Document designer import failed', error);
        onNotice('Nie udało się zaimportować szablonów projektanta.');
      }
    };
    reader.readAsText(file);
  };

  const addElementAt = (libraryId, x = null, y = null) => {
    if (!activeTemplate) return;
    commitPropertyEditSession();
    let nextElement = createDocumentDesignerElement(libraryId, activeTemplate.elements.length);
    if (Number.isFinite(x)) nextElement.x = x;
    if (Number.isFinite(y)) nextElement.y = y;
    nextElement = normalizeAndClampElement(nextElement);
    updateActiveTemplate((template) => ({ ...template, elements: [...template.elements, nextElement] }));
    setSelectedElementId(nextElement.id);
  };

  const updateSelectedElement = (patch, { history = 'immediate' } = {}) => {
    if (!selectedElement || !activeTemplate) return;
    if (history === 'silent') {
      updateActiveTemplate((template) => ({
        ...template,
        elements: template.elements.map((element) => element.id === selectedElement.id ? normalizeAndClampElement(element, patch) : element)
      }), { trackHistory: false });
      return;
    }
    if (history === 'deferred') {
      beginPropertyEditSession();
      updateActiveTemplate((template) => ({
        ...template,
        elements: template.elements.map((element) => element.id === selectedElement.id ? normalizeAndClampElement(element, patch) : element)
      }), { trackHistory: false });
      schedulePropertyEditCommit();
      return;
    }
    updateActiveTemplate((template) => ({
      ...template,
      elements: template.elements.map((element) => element.id === selectedElement.id ? normalizeAndClampElement(element, patch) : element)
    }), { trackHistory: history === 'immediate' });
  };

  const updateTemplateMargins = (patch, { history = 'deferred' } = {}) => {
    if (!activeTemplate) return;
    const applyMargins = (template) => {
      const nextMargins = { ...template.margins, ...patch };
      return {
        ...template,
        margins: nextMargins,
        elements: template.elements.map((element) => clampDesignerElementToWorkArea(element, nextMargins))
      };
    };
    if (history === 'deferred') {
      beginPropertyEditSession();
      updateActiveTemplate(applyMargins, { trackHistory: false });
      schedulePropertyEditCommit();
      return;
    }
    updateActiveTemplate(applyMargins, { trackHistory: history === 'immediate' });
  };

  const updateSelectedElementGeometry = (patch) => {
    if (!selectedElement || !activeTemplate) return;
    beginPropertyEditSession();
    updateActiveTemplate((template) => ({
      ...template,
      elements: template.elements.map((element) => element.id === selectedElement.id ? normalizeAndClampElement(element, patch) : element)
    }), { trackHistory: false });
    schedulePropertyEditCommit();
  };

  const duplicateElement = () => {
    if (!selectedElement || !activeTemplate) return;
    const clone = normalizeAndClampElement(selectedElement, {
      id: `${selectedElement.id}-copy-${Date.now()}`,
      x: selectedElement.x + 14,
      y: selectedElement.y + 14
    });
    updateActiveTemplate((template) => ({ ...template, elements: [...template.elements, clone] }));
    setSelectedElementId(clone.id);
  };

  const deleteElement = () => {
    if (!selectedElement || !activeTemplate) return;
    commitPropertyEditSession();
    updateActiveTemplate((template) => ({ ...template, elements: template.elements.filter((element) => element.id !== selectedElement.id) }));
    setSelectedElementId('');
  };

  useEffect(() => {
    const isEditableTarget = (target) => {
      if (!(target instanceof Element)) return false;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
      return Boolean(target.closest('[contenteditable="true"]'));
    };
    const onKeyDown = (event) => {
      const modKey = event.metaKey || event.ctrlKey;
      if (modKey && event.key.toLowerCase() === 'z' && !event.shiftKey) {
        if (isEditableTarget(event.target)) return;
        event.preventDefault();
        undo();
        return;
      }
      if ((modKey && event.shiftKey && event.key.toLowerCase() === 'z') || (event.ctrlKey && event.key.toLowerCase() === 'y')) {
        if (isEditableTarget(event.target)) return;
        event.preventDefault();
        redo();
        return;
      }
      if (event.key !== 'Delete' && event.key !== 'Backspace') return;
      if (isEditableTarget(event.target)) return;
      if (!selectedElementId) return;
      event.preventDefault();
      deleteElement();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedElementId, deleteElement]);

  const applyTypeSwitch = (nextTypeId) => {
    commitPropertyEditSession();
    setActiveTypeId(nextTypeId);
    setActiveTemplateId('');
    setSelectedElementId('');
    setPendingTypeId('');
  };

  const discardCurrentTemplateChanges = () => {
    if (!activeTemplate) return;
    const savedTemplate = savedDesignerState.templates.find((template) => template.id === activeTemplate.id);
    if (!savedTemplate) return;
    applyDesignerState((current) => ({
      ...current,
      templates: current.templates.map((template) => template.id === activeTemplate.id ? savedTemplate : template)
    }), { trackHistory: false });
  };

  const requestTypeSwitch = (nextTypeId) => {
    if (nextTypeId === activeTypeId) return;
    if (hasUnsavedCurrentTemplateChanges) {
      setPendingTypeId(nextTypeId);
      return;
    }
    applyTypeSwitch(nextTypeId);
  };

  const alignSelectedElement = (direction) => {
    if (!selectedElement || !activeTemplate) return;
    const area = getDesignerWorkArea(activeTemplate.margins);
    if (direction === 'left') updateSelectedElement({ x: area.left });
    if (direction === 'center') updateSelectedElement({ x: area.left + (area.width - selectedElement.width) / 2 });
    if (direction === 'right') updateSelectedElement({ x: area.right - selectedElement.width });
  };

  const getSnapForAxis = (targetLines, candidateLines) => {
    let best = null;
    candidateLines.forEach((line) => {
      targetLines.forEach((targetLine) => {
        const delta = targetLine.value - line.value;
        if (Math.abs(delta) > SNAP_THRESHOLD) return;
        if (!best || Math.abs(delta) < Math.abs(best.delta)) {
          best = { delta, target: targetLine.value };
        }
      });
    });
    return best;
  };

  const applySmartSnap = (element, x, y) => {
    if (!activeTemplate || !showGuides) return { x, y, guides: { vertical: [], horizontal: [] } };
    const otherElements = activeTemplate.elements.filter((item) => item.id !== element.id && item.visible !== false);
    const verticalTargets = otherElements.flatMap((item) => [item.x, item.x + item.width / 2, item.x + item.width]).map((value) => ({ value }));
    const horizontalTargets = otherElements.flatMap((item) => [item.y, item.y + item.height / 2, item.y + item.height]).map((value) => ({ value }));

    const verticalCandidateLines = [
      { key: 'left', value: x, offset: 0 },
      { key: 'center', value: x + element.width / 2, offset: element.width / 2 },
      { key: 'right', value: x + element.width, offset: element.width }
    ];
    const horizontalCandidateLines = [
      { key: 'top', value: y, offset: 0 },
      { key: 'center', value: y + element.height / 2, offset: element.height / 2 },
      { key: 'bottom', value: y + element.height, offset: element.height }
    ];

    const bestX = getSnapForAxis(verticalTargets, verticalCandidateLines);
    const bestY = getSnapForAxis(horizontalTargets, horizontalCandidateLines);
    const resolvedX = bestX ? x + bestX.delta : x;
    const resolvedY = bestY ? y + bestY.delta : y;
    return {
      x: resolvedX,
      y: resolvedY,
      guides: {
        vertical: bestX ? [bestX.target] : [],
        horizontal: bestY ? [bestY.target] : []
      }
    };
  };

  const startDrag = (event, element, mode = 'move') => {
    event.preventDefault();
    event.stopPropagation();
    commitPropertyEditSession();
    dragSnapshotRef.current = designerStateRef.current;
    setSelectedElementId(element.id);
    setDragState({
      id: element.id,
      mode,
      startX: event.clientX,
      startY: event.clientY,
      originX: element.x,
      originY: element.y,
      originWidth: element.width,
      originHeight: element.height
    });
  };

  useEffect(() => {
    if (!dragState || !activeTemplate) return undefined;
    const onMove = (event) => {
      const dx = (event.clientX - dragState.startX) / activeScale;
      const dy = (event.clientY - dragState.startY) / activeScale;
      const area = getDesignerWorkArea(activeTemplate.margins);
      if (dragState.mode.startsWith('resize')) {
        const mode = dragState.mode.replace('resize-', '');
        const isWest = mode.includes('w');
        const isEast = mode.includes('e');
        const isNorth = mode.includes('n');
        const isSouth = mode.includes('s');
        const anchorLeft = dragState.originX;
        const anchorTop = dragState.originY;
        const anchorRight = dragState.originX + dragState.originWidth;
        const anchorBottom = dragState.originY + dragState.originHeight;

        let nextLeft = anchorLeft;
        let nextRight = anchorRight;
        let nextTop = anchorTop;
        let nextBottom = anchorBottom;

        if (isWest) nextLeft = clamp(anchorLeft + dx, area.left, anchorRight - DOCUMENT_DESIGNER_MIN_SIZE.width);
        if (isEast) nextRight = clamp(anchorRight + dx, anchorLeft + DOCUMENT_DESIGNER_MIN_SIZE.width, area.right);
        if (isNorth) nextTop = clamp(anchorTop + dy, area.top, anchorBottom - DOCUMENT_DESIGNER_MIN_SIZE.height);
        if (isSouth) nextBottom = clamp(anchorBottom + dy, anchorTop + DOCUMENT_DESIGNER_MIN_SIZE.height, area.bottom);

        updateActiveTemplate((template) => ({
          ...template,
          elements: template.elements.map((element) => element.id === dragState.id
            ? clampDesignerElementToWorkArea(normalizeDocumentDesignerElement({
              ...element,
              x: nextLeft,
              y: nextTop,
              width: nextRight - nextLeft,
              height: nextBottom - nextTop
            }), template.margins)
            : element)
        }), { trackHistory: false });
        return;
      }
      const target = activeTemplate.elements.find((element) => element.id === dragState.id);
      if (!target) return;
      const nextX = dragState.originX + dx;
      const nextY = dragState.originY + dy;
      const snappedX = snapToGrid ? Math.round(nextX / GRID_STEP) * GRID_STEP : nextX;
      const snappedY = snapToGrid ? Math.round(nextY / GRID_STEP) * GRID_STEP : nextY;
      const snappedToElements = applySmartSnap(target, snappedX, snappedY);
      updateActiveTemplate((template) => ({
        ...template,
        elements: template.elements.map((element) => element.id === dragState.id
          ? clampDesignerElementToWorkArea(normalizeDocumentDesignerElement({
            ...element,
            x: Math.min(area.right - element.width, Math.max(area.left, snappedToElements.x)),
            y: Math.min(area.bottom - element.height, Math.max(area.top, snappedToElements.y))
          }), template.margins)
          : element)
      }), { trackHistory: false });
      setDragGuides(snappedToElements.guides);
    };
    const onUp = () => {
      const snapshot = dragSnapshotRef.current;
      dragSnapshotRef.current = null;
      if (snapshot && JSON.stringify(snapshot) !== JSON.stringify(designerStateRef.current)) {
        pushHistorySnapshot(snapshot);
      }
      setDragState(null);
      setDragGuides({ vertical: [], horizontal: [] });
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragState, activeScale, activeTemplate, snapToGrid, showGuides]);

  useEffect(() => {
    if (!tableColumnResize || !selectedElement || selectedElement.kind !== 'table') return undefined;
    const onMove = (event) => {
      const delta = (event.clientX - tableColumnResize.startX) / activeScale;
      const startColumns = tableColumnResize.startColumns;
      const index = startColumns.findIndex((column) => column.key === tableColumnResize.columnKey);
      if (index < 0) return;
      const minWidth = 50;
      const maxWidth = 560;
      const nextWidth = clamp(startColumns[index].width + delta, minWidth, maxWidth);
      const nextColumns = startColumns.map((column, columnIndex) => (columnIndex === index ? { ...column, width: nextWidth } : column));
      updateSelectedElement({ columns: nextColumns }, { history: 'silent' });
    };
    const onUp = () => {
      const snapshot = columnResizeSnapshotRef.current;
      columnResizeSnapshotRef.current = null;
      if (snapshot && JSON.stringify(snapshot) !== JSON.stringify(designerStateRef.current)) {
        pushHistorySnapshot(snapshot);
      }
      setTableColumnResize(null);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [tableColumnResize, selectedElement, activeScale, updateSelectedElement]);

  const handleCanvasDragOver = (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  };

  const handleCanvasDrop = (event) => {
    event.preventDefault();
    const libraryId = event.dataTransfer.getData('text/fixer-designer-item');
    if (!libraryId || !pageRef.current) return;
    const rect = pageRef.current.getBoundingClientRect();
    const x = (event.clientX - rect.left) / activeScale;
    const y = (event.clientY - rect.top) / activeScale;
    addElementAt(libraryId, x, y);
  };

  const replaceLogoForSelectedElement = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !selectedElement || selectedElement.kind !== 'logo') return;
    if (!file.type.startsWith('image/')) {
      onNotice('Wybierz plik obrazu dla logo.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => updateSelectedElement({ logoDataUrl: String(reader.result ?? '') });
    reader.readAsDataURL(file);
  };

  const moveColumn = (key, direction) => {
    if (!selectedElement || selectedElement.kind !== 'table') return;
    const next = [...(selectedElement.columns ?? [])];
    const index = next.findIndex((column) => column.key === key);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= next.length) return;
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    updateSelectedElement({ columns: next });
  };

  const moveColumnByDrop = (sourceKey, targetKey) => {
    if (!selectedElement || selectedElement.kind !== 'table' || !sourceKey || !targetKey || sourceKey === targetKey) return;
    const next = [...(selectedElement.columns ?? [])];
    const sourceIndex = next.findIndex((column) => column.key === sourceKey);
    const targetIndex = next.findIndex((column) => column.key === targetKey);
    if (sourceIndex < 0 || targetIndex < 0) return;
    const [moved] = next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, moved);
    updateSelectedElement({ columns: next });
  };

  const pageSelected = !selectedElement;

  return <div className={`document-designer-workspace ${fullscreen ? 'document-designer-workspace--fullscreen' : ''}`}>
    <div className="document-designer-top-toolbar">
      <div className="document-designer-toolbar-actions">
        <button type="button" className="document-designer-panel-toggle" onClick={() => setLibraryCollapsed((current) => !current)} title={libraryCollapsed ? 'Pokaż bibliotekę' : 'Ukryj bibliotekę'}>
          <PanelLeft size={16} />
        </button>
        <AppButton variant="primary" size="sm" onClick={saveDraft} disabled={!hasUnsavedChanges}><Save size={14} />Zapisz</AppButton>
        <AppButton variant="secondary" size="sm" onClick={undo} disabled={!canUndo}><RotateCcw size={14} />Cofnij</AppButton>
        <AppButton variant="secondary" size="sm" onClick={redo} disabled={!canRedo}><History size={14} />Ponów</AppButton>
        <span className="document-designer-toolbar-divider" />
        <AppButton variant="secondary" size="sm" onClick={() => setZoomMode(String(Math.min(2, activeScale + 0.1).toFixed(2)))}><Plus size={14} /></AppButton>
        <AppButton variant="secondary" size="sm" onClick={() => setZoomMode(String(Math.max(0.15, activeScale - 0.1).toFixed(2)))}><Minus size={14} /></AppButton>
        <AppButton variant={zoomMode === 'fit' ? 'primary' : 'secondary'} size="sm" onClick={() => setZoomMode('fit')}>Dopasuj</AppButton>
        <span className="document-designer-zoom-value">{Math.round(activeScale * 100)}%</span>
        <span className="document-designer-toolbar-divider" />
        <AppButton variant={showGrid ? 'primary' : 'secondary'} size="sm" onClick={() => setShowGrid((current) => !current)}><Grid3X3 size={14} />Siatka</AppButton>
        <label className="document-designer-toolbar-check"><input type="checkbox" checked={snapToGrid} onChange={(event) => setSnapToGrid(event.target.checked)} />Snap</label>
        <label className="document-designer-toolbar-check"><input type="checkbox" checked={showGuides} onChange={(event) => setShowGuides(event.target.checked)} />Prowadnice</label>
        <AppButton variant="primary" size="sm" onClick={() => {
          printHtmlInIframe(buildDocumentDesignerHtml(activeTemplate, designerPreviewContext, { preview: false, company: companyProfile }));
          onGeneratePdf({ type: activeTypeId, number: designerPreviewContext.documentNumber || 'DOC/DESIGNER', relation: 'Projektant dokumentów' });
        }} disabled={!activeTemplate}><FileText size={14} />PDF</AppButton>
        <AppButton variant="secondary" size="sm" onClick={resetTemplateLayout} disabled={!activeTemplate}><RotateCcw size={14} />Domyślny układ</AppButton>
        {hasUnsavedChanges && <span className="document-designer-unsaved-dot" title="Niezapisane zmiany">●</span>}
        {onClose && <AppButton variant="secondary" size="sm" onClick={onClose}>Zamknij</AppButton>}
      </div>
      <div className="document-designer-toolbar-right">
        <label className="firm-field document-designer-toolbar-field">
          Typ dokumentu
          <AppSelect value={activeTypeId} onChange={(event) => requestTypeSwitch(event.target.value)}>
            {DOCUMENT_TEMPLATE_TYPES.map((type) => <option key={type.id} value={type.id}>{type.label}</option>)}
          </AppSelect>
        </label>
        <label className="firm-field document-designer-toolbar-field">
          Szablon
          <AppSelect value={activeTemplate?.id ?? ''} onChange={(event) => { commitPropertyEditSession(); setActiveTemplateId(event.target.value); }}>
            {activeTypeTemplates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
          </AppSelect>
        </label>
        <button type="button" className="document-designer-panel-toggle" onClick={() => setPropertiesCollapsed((current) => !current)} title={propertiesCollapsed ? 'Pokaż właściwości' : 'Ukryj właściwości'}>
          <SlidersHorizontal size={16} />
        </button>
      </div>
    </div>

    <div className={`document-designer-layout ${libraryCollapsed ? 'library-collapsed' : ''} ${propertiesCollapsed ? 'properties-collapsed' : ''}`}>
      {!libraryCollapsed && <aside className="document-designer-library">
        <div className="document-designer-panel-head">
          <strong>Biblioteka elementów</strong>
          <button type="button" className="document-designer-panel-close" onClick={() => setLibraryCollapsed(true)} aria-label="Ukryj bibliotekę"><ChevronLeft size={16} /></button>
        </div>
        <div className="document-designer-library-list">
          {DOCUMENT_DESIGNER_LIBRARY.map((item) => <button
            key={item.id}
            type="button"
            draggable
            className="document-designer-library-tile"
            onDragStart={(event) => event.dataTransfer.setData('text/fixer-designer-item', item.id)}
            onDoubleClick={() => addElementAt(item.id)}
          >
            <strong>{item.label}</strong>
            <small>{item.hint || 'Przeciągnij na dokument A4'}</small>
          </button>)}
        </div>
      </aside>}

      <div className="document-designer-stage">
        {libraryCollapsed && <button type="button" className="document-designer-edge-toggle left" onClick={() => setLibraryCollapsed(false)} title="Pokaż bibliotekę"><PanelLeft size={16} /></button>}
        {propertiesCollapsed && <button type="button" className="document-designer-edge-toggle right" onClick={() => setPropertiesCollapsed(false)} title="Pokaż właściwości"><SlidersHorizontal size={16} /></button>}

        {hasUnsavedChanges && <div className="document-designer-unsaved-bar">
          <strong>Niezapisane zmiany</strong>
          <div className="settings-action-row">
            <AppButton variant="primary" size="sm" onClick={saveDraft}><Save size={14} />Zapisz</AppButton>
            <AppButton variant="secondary" size="sm" onClick={discardDraft}>Odrzuć</AppButton>
          </div>
        </div>}

        <div ref={viewportRef} className={`document-designer-canvas ${isFitZoom ? 'document-designer-canvas--fit' : 'document-designer-canvas--manual'}`} onDragOver={handleCanvasDragOver} onDrop={handleCanvasDrop}>
          <div className="document-designer-canvas-center">
            {activeTemplate && <div className="document-designer-page-wrap" style={{ width: `${DOCUMENT_DESIGNER_PAGE.width * activeScale}px`, height: `${DOCUMENT_DESIGNER_PAGE.height * activeScale}px` }}>
            <div
              ref={pageRef}
              className={`document-designer-page ${showGrid ? 'with-grid' : ''}`}
              style={{ transform: `scale(${activeScale})`, transformOrigin: 'top left' }}
              onMouseDown={() => setSelectedElementId('')}
            >
              <div
                className="document-designer-margins-guide"
                style={{
                  left: `${activeTemplate.margins.left * DESIGNER_MM_TO_PX}px`,
                  top: `${activeTemplate.margins.top * DESIGNER_MM_TO_PX}px`,
                  right: `${activeTemplate.margins.right * DESIGNER_MM_TO_PX}px`,
                  bottom: `${activeTemplate.margins.bottom * DESIGNER_MM_TO_PX}px`
                }}
              />
              {showGuides && dragGuides.vertical.map((value) => <div key={`v-${value}`} className="document-designer-guide-line vertical" style={{ left: `${value}px` }} />)}
              {showGuides && dragGuides.horizontal.map((value) => <div key={`h-${value}`} className="document-designer-guide-line horizontal" style={{ top: `${value}px` }} />)}
              {activeTemplate.elements.map((element) => {
                const visibleColumns = (element.columns ?? []).filter((column) => column.visible !== false);
                const safeColumns = visibleColumns.length ? visibleColumns : [{ key: 'name', label: 'Kolumna', width: 160 }];
                const selectedTable = selectedElementId === element.id && element.kind === 'table';
                return <div
                  key={element.id}
                  className={`document-designer-element ${selectedElementId === element.id ? 'selected' : ''}`}
                  style={{
                    left: `${element.x}px`,
                    top: `${element.y}px`,
                    width: `${element.width}px`,
                    height: `${element.height}px`,
                    textAlign: element.align,
                    color: element.color,
                    fontSize: `${element.fontSize}px`,
                    fontWeight: element.fontWeight,
                    display: element.visible === false ? 'none' : 'block'
                  }}
                  onMouseDown={(event) => startDrag(event, element, 'move')}
                >
                  {element.kind === 'logo' && <div className="document-designer-logo-preview">{(element.logoDataUrl || companyProfile.logoDataUrl) ? <img src={element.logoDataUrl || companyProfile.logoDataUrl} alt="Logo" /> : 'Logo'}</div>}
                  {element.kind === 'table' && <div className="document-designer-table-preview">
                    <div className="document-designer-table-head">
                      {safeColumns.map((column) => <div
                        key={column.key}
                        className="document-designer-table-col"
                        style={{ width: `${column.width}px` }}
                      >
                        <span>{column.label}</span>
                        {selectedTable && <button
                          type="button"
                          className="document-designer-col-resize"
                          onMouseDown={(event) => {
                            event.stopPropagation();
                            commitPropertyEditSession();
                            columnResizeSnapshotRef.current = designerStateRef.current;
                            setTableColumnResize({
                              columnKey: column.key,
                              startX: event.clientX,
                              startColumns: (element.columns ?? []).map((item) => ({ ...item }))
                            });
                          }}
                          aria-label={`Zmień szerokość kolumny ${column.label}`}
                        />}
                      </div>)}
                    </div>
                    <div className="document-designer-table-body">
                      {(() => {
                        const previewRows = resolveDocumentTableRows(designerPreviewContext, activeTypeId);
                        const previewRow = previewRows[0];
                        if (!previewRow) return <span>Podgląd wierszy tabeli</span>;
                        return <div className="document-designer-table-preview-row">{safeColumns.map((column) => <span key={column.key} style={{ width: `${column.width}px`, flex: `0 0 ${column.width}px` }}>{previewRow[column.key] ?? '—'}</span>)}</div>;
                      })()}
                    </div>
                  </div>}
                  {element.kind === 'line' && <div className="document-designer-line-preview" style={{ background: element.color, height: `${Math.max(1, element.height)}px` }} />}
                  {element.kind === 'signature' && <div className="document-designer-signature-preview"><strong>{applyDesignerTokens(element.text, designerPreviewContext)}</strong><em>podpis</em></div>}
                  {!['logo', 'table', 'line', 'signature'].includes(element.kind) && <div className="document-designer-text-preview">{applyDesignerTokens(element.text, designerPreviewContext)}</div>}
                  {selectedElementId === element.id && <>
                    <button type="button" className="document-designer-resize-handle top-left" onMouseDown={(event) => startDrag(event, element, 'resize-nw')} aria-label="Zmień rozmiar z lewego górnego rogu" />
                    <button type="button" className="document-designer-resize-handle top-right" onMouseDown={(event) => startDrag(event, element, 'resize-ne')} aria-label="Zmień rozmiar z prawego górnego rogu" />
                    <button type="button" className="document-designer-resize-handle bottom-left" onMouseDown={(event) => startDrag(event, element, 'resize-sw')} aria-label="Zmień rozmiar z lewego dolnego rogu" />
                    <button type="button" className="document-designer-resize-handle bottom-right" onMouseDown={(event) => startDrag(event, element, 'resize-se')} aria-label="Zmień rozmiar z prawego dolnego rogu" />
                  </>}
                </div>;
              })}
            </div>
            </div>}
          </div>
        </div>
      </div>

      {!propertiesCollapsed && <aside className="document-designer-properties">
        <div className="document-designer-panel-head">
          <strong>{pageSelected ? 'Właściwości strony' : 'Właściwości elementu'}</strong>
          <button type="button" className="document-designer-panel-close" onClick={() => setPropertiesCollapsed(true)} aria-label="Ukryj właściwości"><ChevronRight size={16} /></button>
        </div>

        <div className="document-designer-properties-scroll">
          <div className="settings-form-section">
            <div className="settings-action-row">
              <AppButton variant="secondary" size="sm" onClick={createTemplate}><Plus size={14} />Nowy</AppButton>
              <AppButton variant="secondary" size="sm" onClick={duplicateTemplate} disabled={!activeTemplate}><Copy size={14} />Duplikuj</AppButton>
              <AppButton variant="secondary" size="sm" onClick={deleteTemplate} disabled={!activeTemplate}><Trash2 size={14} />Usuń</AppButton>
            </div>
            <div className="settings-action-row">
              <AppButton variant="secondary" size="sm" onClick={exportTemplates}><Download size={14} />Eksport</AppButton>
              <AppButton variant="secondary" size="sm" onClick={() => importInputRef.current?.click()}><FolderOpen size={14} />Import</AppButton>
              <input ref={importInputRef} type="file" accept="application/json,.json" onChange={importTemplates} className="backup-file-input" />
            </div>
          </div>

          {pageSelected && activeTemplate && <div className="settings-form-section">
            <div className="settings-section-title"><h4>Strona A4</h4></div>
            <p className="muted document-designer-page-hint">Kliknij pusty obszar dokumentu, aby edytować marginesy strony.</p>
            <div className="settings-section-title"><h4>Marginesy (mm)</h4></div>
            <div className="settings-field-grid two-columns">
              <label className="firm-field">Górny<AppInput type="number" value={activeTemplate.margins.top} onFocus={beginPropertyEditSession} onChange={(event) => updateTemplateMargins({ top: Number(event.target.value) || 0 })} onBlur={commitPropertyEditSession} /></label>
              <label className="firm-field">Dolny<AppInput type="number" value={activeTemplate.margins.bottom} onFocus={beginPropertyEditSession} onChange={(event) => updateTemplateMargins({ bottom: Number(event.target.value) || 0 })} onBlur={commitPropertyEditSession} /></label>
              <label className="firm-field">Lewy<AppInput type="number" value={activeTemplate.margins.left} onFocus={beginPropertyEditSession} onChange={(event) => updateTemplateMargins({ left: Number(event.target.value) || 0 })} onBlur={commitPropertyEditSession} /></label>
              <label className="firm-field">Prawy<AppInput type="number" value={activeTemplate.margins.right} onFocus={beginPropertyEditSession} onChange={(event) => updateTemplateMargins({ right: Number(event.target.value) || 0 })} onBlur={commitPropertyEditSession} /></label>
            </div>
          </div>}

          {selectedElement && <div className="settings-form-section">
          <div className="settings-section-title"><h4>{getDesignerLibraryItem(selectedElement.libraryId).label}</h4></div>
          <div className="settings-action-row document-designer-align-actions">
            <AppButton variant="secondary" size="sm" onClick={() => alignSelectedElement('left')}><AlignLeft size={14} /></AppButton>
            <AppButton variant="secondary" size="sm" onClick={() => alignSelectedElement('center')}><AlignCenter size={14} /></AppButton>
            <AppButton variant="secondary" size="sm" onClick={() => alignSelectedElement('right')}><AlignRight size={14} /></AppButton>
            <AppButton variant="secondary" size="sm" onClick={duplicateElement}><Copy size={14} /></AppButton>
            <AppButton variant="secondary" size="sm" onClick={deleteElement}><Trash2 size={14} /></AppButton>
          </div>
          <div className="settings-field-grid two-columns">
            <label className="firm-field">Pozycja X<DocumentDesignerDeferredNumberInput elementId={selectedElement.id} value={Math.round(selectedElement.x)} min={0} max={DOCUMENT_DESIGNER_PAGE.width} fallback={0} onFocus={beginPropertyEditSession} onCommit={(nextValue) => updateSelectedElementGeometry({ x: nextValue })} onBlurCommit={commitPropertyEditSession} /></label>
            <label className="firm-field">Pozycja Y<DocumentDesignerDeferredNumberInput elementId={selectedElement.id} value={Math.round(selectedElement.y)} min={0} max={DOCUMENT_DESIGNER_PAGE.height} fallback={0} onFocus={beginPropertyEditSession} onCommit={(nextValue) => updateSelectedElementGeometry({ y: nextValue })} onBlurCommit={commitPropertyEditSession} /></label>
            <label className="firm-field">Szerokość<DocumentDesignerDeferredNumberInput elementId={selectedElement.id} value={Math.round(selectedElement.width)} min={DOCUMENT_DESIGNER_MIN_SIZE.width} max={DOCUMENT_DESIGNER_PAGE.width} fallback={DOCUMENT_DESIGNER_MIN_SIZE.width} onFocus={beginPropertyEditSession} onCommit={(nextValue) => updateSelectedElementGeometry({ width: nextValue })} onBlurCommit={commitPropertyEditSession} /></label>
            <label className="firm-field">Wysokość<DocumentDesignerDeferredNumberInput elementId={selectedElement.id} value={Math.round(selectedElement.height)} min={DOCUMENT_DESIGNER_MIN_SIZE.height} max={DOCUMENT_DESIGNER_PAGE.height} fallback={DOCUMENT_DESIGNER_MIN_SIZE.height} onFocus={beginPropertyEditSession} onCommit={(nextValue) => updateSelectedElementGeometry({ height: nextValue })} onBlurCommit={commitPropertyEditSession} /></label>
            <label className="firm-field">Rozmiar<DocumentDesignerDeferredNumberInput elementId={selectedElement.id} value={selectedElement.fontSize} min={8} max={72} fallback={10} onFocus={beginPropertyEditSession} onCommit={(nextValue) => updateSelectedElementGeometry({ fontSize: nextValue })} onBlurCommit={commitPropertyEditSession} /></label>
            <label className="firm-field">Pogrubienie<AppSelect value={String(selectedElement.fontWeight)} onChange={(event) => updateSelectedElement({ fontWeight: Number(event.target.value) })}><option value="400">Normal</option><option value="500">Średni</option><option value="700">Mocny</option></AppSelect></label>
            <label className="firm-field">Kolor<AppInput type="color" value={selectedElement.color} onFocus={beginPropertyEditSession} onChange={(event) => updateSelectedElement({ color: event.target.value }, { history: 'deferred' })} onBlur={commitPropertyEditSession} /></label>
            <label className="firm-field">Wyrównanie<AppSelect value={selectedElement.align} onChange={(event) => updateSelectedElement({ align: event.target.value })}><option value="left">Do lewej</option><option value="center">Wyśrodkuj</option><option value="right">Do prawej</option></AppSelect></label>
          </div>
          <label className="settings-check"><input type="checkbox" checked={selectedElement.visible !== false} onChange={(event) => updateSelectedElement({ visible: event.target.checked })} />Widoczny</label>

          {selectedElement.kind === 'logo' && <>
            <AppButton variant="secondary" size="sm" onClick={() => logoInputRef.current?.click()}><FolderOpen size={14} />Podmień logo</AppButton>
            <input ref={logoInputRef} type="file" accept="image/*" onChange={replaceLogoForSelectedElement} className="backup-file-input" />
          </>}

          {!['logo', 'table', 'line', 'signature'].includes(selectedElement.kind) && <label className="firm-field">Treść<AppTextarea rows={5} value={selectedElement.text} onFocus={beginPropertyEditSession} onChange={(event) => updateSelectedElement({ text: event.target.value }, { history: 'deferred' })} onBlur={commitPropertyEditSession} /></label>}
          {selectedElement.kind === 'signature' && <label className="firm-field">Nazwa podpisu<AppInput value={selectedElement.text} onFocus={beginPropertyEditSession} onChange={(event) => updateSelectedElement({ text: event.target.value }, { history: 'deferred' })} onBlur={commitPropertyEditSession} /></label>}
          {selectedElement.kind === 'table' && <div className="document-designer-columns-editor">
            <strong>Kolumny tabeli</strong>
            {(selectedElement.columns ?? []).map((column, index) => <div
              key={column.key}
              className="document-column-row compact"
              draggable
              onDragStart={() => setColumnDragKey(column.key)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => { moveColumnByDrop(columnDragKey, column.key); setColumnDragKey(''); }}
            >
              <div className="document-designer-column-main">
                <label className="settings-check"><input type="checkbox" checked={column.visible !== false} onChange={() => updateSelectedElement({
                  columns: selectedElement.columns.map((item) => item.key === column.key ? { ...item, visible: item.visible === false } : item)
                })} /><span>{column.label}</span></label>
                <label className="firm-field">Nagłówek<AppInput value={column.label} onFocus={beginPropertyEditSession} onChange={(event) => updateSelectedElement({
                  columns: selectedElement.columns.map((item) => item.key === column.key ? { ...item, label: event.target.value } : item)
                }, { history: 'deferred' })} onBlur={commitPropertyEditSession} /></label>
                <label className="firm-field">Szerokość kolumny
                  <input
                    className="document-designer-column-width-range"
                    type="range"
                    min="50"
                    max="360"
                    value={column.width}
                    onMouseDown={beginPropertyEditSession}
                    onChange={(event) => updateSelectedElement({
                      columns: selectedElement.columns.map((item) => item.key === column.key ? { ...item, width: Number(event.target.value) || item.width } : item)
                    }, { history: 'deferred' })}
                    onMouseUp={commitPropertyEditSession}
                  />
                </label>
              </div>
              <div className="dictionary-row-actions dictionary-icon-actions">
                <button type="button" className="dictionary-icon-button" onClick={() => updateSelectedElement({
                  columns: selectedElement.columns.map((item) => item.key === column.key ? { ...item, width: Math.max(50, item.width - 10) } : item)
                })}><ChevronLeft size={14} /></button>
                <button type="button" className="dictionary-icon-button" onClick={() => updateSelectedElement({
                  columns: selectedElement.columns.map((item) => item.key === column.key ? { ...item, width: item.width + 10 } : item)
                })}><ChevronRight size={14} /></button>
                <button type="button" className="dictionary-icon-button" onClick={() => moveColumn(column.key, -1)} disabled={index === 0}><ArrowUp size={14} /></button>
                <button type="button" className="dictionary-icon-button" onClick={() => moveColumn(column.key, 1)} disabled={index === selectedElement.columns.length - 1}><ArrowDown size={14} /></button>
              </div>
            </div>)}
          </div>}
          </div>}

          {!selectedElement && !activeTemplate && <div className="settings-form-section">
            <p className="muted">Wybierz szablon lub utwórz nowy, aby rozpocząć projektowanie.</p>
          </div>}
        </div>
      </aside>}
    </div>

    {pendingTypeId && <ModalFrame
      className="confirm-dialog"
      title="Niezapisane zmiany"
      onClose={() => setPendingTypeId('')}
      footer={<>
        <ButtonSecondary onClick={() => setPendingTypeId('')}>Anuluj</ButtonSecondary>
        <AppButton variant="secondary" onClick={() => {
          discardCurrentTemplateChanges();
          applyTypeSwitch(pendingTypeId);
        }}>Odrzuć i przełącz</AppButton>
        <AppButton variant="primary" onClick={() => {
          saveDraft();
          applyTypeSwitch(pendingTypeId);
        }}>Zapisz i przełącz</AppButton>
      </>}
    >
      <p className="confirm-dialog-message">Masz niezapisane zmiany w aktualnym szablonie.</p>
    </ModalFrame>}
  </div>;
}

function SettingsV2({ mode = 'settings', dashboardIntent, onConsumeDashboardIntent, colorTheme, onChangeColorTheme, statusColors = {}, onStatusColorChange = () => {}, activeUiTheme, onChangeActiveUiTheme }) {
  const isDocumentsMode = mode === 'documents';
  const themeOptions = [
    { id: 'dark', label: 'Ciemny', icon: Moon },
    { id: 'light', label: 'Jasny', icon: Sun }
  ];
  const sections = isDocumentsMode
    ? [{ id: 'documents', label: 'Dokumenty', icon: FileText, description: 'Szablony, numeracja, profil firmy i projektant.' }]
    : [
      { id: 'dictionaries', label: 'Słowniki', icon: List, description: 'Statusy, kategorie, priorytety, lokalizacje i stany w modułach.' },
      { id: 'interface', label: 'Interfejs', icon: SlidersHorizontal, description: 'Motyw, dashboard, tabele, widoki i preferencje pracy.' },
      { id: 'integrations', label: 'Integracje', icon: CalendarDays, description: 'Kalendarz, powiadomienia, import, eksport i przyszłe połączenia.' },
      { id: 'system', label: 'System', icon: Settings, description: 'Backup, restore, diagnostyka, migracje i przyszła administracja.' }
    ];
  const [activeSection, setActiveSection] = useState(isDocumentsMode ? 'documents' : 'interface');
  const [activeSubs, setActiveSubs] = useState({});
  const subSectionsMap = {
    company: [],
    dictionaries: [
      { id: 'clients', label: 'Klienci' },
      { id: 'equipment', label: 'Sprzęt' },
      { id: 'service', label: 'Serwis' },
      { id: 'rentals', label: 'Wypożyczenia' },
      { id: 'projects', label: 'Zadania i projekty' }
    ],
    integrations: [],
    system: [],
    documents: [],
    interface: []
  };
  const getActiveSub = (section) => activeSubs[section] || subSectionsMap[section]?.[0]?.id || null;
  const handleSectionChange = (sectionId) => {
    if (isDocumentsMode) {
      setActiveSection('documents');
      return;
    }
    requestDocumentTemplateExitGuard(() => setActiveSection(sectionId), { leavingSection: sectionId !== 'documents' });
  };
  const [activeDocumentPanel, setActiveDocumentPanel] = useState(isDocumentsMode ? 'agreement' : 'designer');
  const [documentsMainSection, setDocumentsMainSection] = useState('templates');
  const [documentsDesignerFullscreen, setDocumentsDesignerFullscreen] = useState(false);
  const [pdfArchiveRows, setPdfArchiveRows] = useState(() => getStoredJson('fixer:pdf-archive', []));
  const [activeAgreementTab, setActiveAgreementTab] = useState('content');
  const [documentTemplateViewMode, setDocumentTemplateViewMode] = useState('list');
  const [activeDocumentTemplateType, setActiveDocumentTemplateType] = useState('rentalAgreement');
  const [activeIntegrationPanel, setActiveIntegrationPanel] = useState('calendar');
  const [activeSystemPanel, setActiveSystemPanel] = useState('backup');
  const [settingsSearch, setSettingsSearch] = useState('');
  const [clientTypes, setClientTypes] = useState([]);
  const [equipmentCategories, setEquipmentCategories] = useState([]);
  const [equipmentStatuses, setEquipmentStatuses] = useState([]);
  const [equipmentLocations, setEquipmentLocations] = useState([]);
  const [serviceStatusesSettings, setServiceStatusesSettings] = useState([]);
  const [servicePrioritiesSettings, setServicePrioritiesSettings] = useState([]);
  const [serviceDeviceCategoriesSettings, setServiceDeviceCategoriesSettings] = useState([]);
  const [serviceIntakeConditionsSettings, setServiceIntakeConditionsSettings] = useState([]);
  const [serviceExternalServicesSettings, setServiceExternalServicesSettings] = useState([]);
  const [serviceProgressTemplatesSettings, setServiceProgressTemplatesSettings] = useState([]);
  const [configDictionaries, setConfigDictionaries] = useState(getConfigDictionaries);
  const [notice, setNotice] = useState('');
  const [confirmDialog, setConfirmDialog] = useState(null);
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
  const [documentSettings, setDocumentSettings] = useState(getDocumentSettings);
  const [documentSettingsNotice, setDocumentSettingsNotice] = useState('');
  const templateImportInputRef = useRef(null);
  const termsImportInputRef = useRef(null);
  const documentTemplateImportInputRef = useRef(null);
  const [backupNotice, setBackupNotice] = useState('');
  const [backupBusy, setBackupBusy] = useState(false);
  const [restoreCandidate, setRestoreCandidate] = useState(null);
  const restoreInputRef = useRef(null);
  const [dashboardSettings, setDashboardSettings] = useState(getDashboardSettings);
  const [organizerCategoryItems, setOrganizerCategoryItems] = useState([]);
  const [calendarSourceSettings, setCalendarSourceSettings] = useState(getCalendarSourceSettings);
  const [agreementPreviewOpen, setAgreementPreviewOpen] = useState(false);
  const [copiedTemplateVariable, setCopiedTemplateVariable] = useState('');
  const [documentTemplateLibrary, setDocumentTemplateLibrary] = useState(getDocumentTemplateLibrary);
  const [savedDocumentTemplateLibrary, setSavedDocumentTemplateLibrary] = useState(getDocumentTemplateLibrary);
  const [pendingTemplateExitAction, setPendingTemplateExitAction] = useState(null);
  const [uiThemeNameInput, setUiThemeNameInput] = useState('');
  const [uiThemeNotice, setUiThemeNotice] = useState('');

  const loadOrganizerSettings = async () => {
    const result = await fetchOrganizerCategories();
    setOrganizerCategoryItems(result.data ?? []);
  };
  useEffect(() => { loadOrganizerSettings(); }, []);

  const updateCalendarSourceSetting = (sourceId, field, value) => {
    if (field === 'enabledByDefault') localStorage.removeItem(CALENDAR_ACTIVE_SOURCES_STORAGE_KEY);
    setCalendarSourceSettings((current) => saveCalendarSourceSettings({
      ...current,
      [sourceId]: { ...current[sourceId], [field]: value }
    }));
  };

  const resetCalendarSourceSettings = () => {
    const defaults = Object.fromEntries(CALENDAR_SOURCES.map((source) => [source.id, {
      sourceId: source.id,
      label: source.label,
      enabledByDefault: true,
      color: DEFAULT_CALENDAR_SOURCE_COLORS[source.id]
    }]));
    setCalendarSourceSettings(saveCalendarSourceSettings(defaults));
    localStorage.removeItem(CALENDAR_ACTIVE_SOURCES_STORAGE_KEY);
  };

  const resetOrganizerCategoryItems = async () => {
    setConfirmDialog({
      title: 'Przywróć kategorie zadań',
      message: 'Przywrócić domyślną listę kategorii?',
      confirmLabel: 'Przywróć',
      cancelLabel: 'Anuluj',
      variant: 'warning',
      onConfirm: async () => {
        setConfirmDialog(null);
        const { error } = await resetOrganizerCategories();
        if (error) { setNotice(`Nie udało się przywrócić domyślnych kategorii: ${error.message}`); return; }
        await loadOrganizerSettings();
      }
    });
  };

  useEffect(() => {
    if (!companySaveNotice) return undefined;

    const timer = window.setTimeout(() => {
      setCompanySaveNotice('');
    }, 4000);

    return () => window.clearTimeout(timer);
  }, [companySaveNotice]);

  useEffect(() => {
    if (!documentSettingsNotice) return undefined;

    const timer = window.setTimeout(() => {
      setDocumentSettingsNotice('');
    }, 4000);

    return () => window.clearTimeout(timer);
  }, [documentSettingsNotice]);

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


  const resetDashboardPreferences = () => {
    setConfirmDialog({
      title: 'Przywróć układ Dashboardu',
      message: 'Przywrócić domyślny układ Dashboardu? Zapisane preferencje widoczności zostaną zastąpione ustawieniami domyślnymi.',
      confirmLabel: 'Przywróć',
      cancelLabel: 'Anuluj',
      variant: 'warning',
      onConfirm: () => {
        setConfirmDialog(null);
        setDashboardSettings(resetDashboardSettings());
      }
    });
  };

  const uiThemeCustomPresets = useMemo(() => getUiThemeCustomPresets(), [activeUiTheme]);
  const uiThemePresets = useMemo(() => [...BUILTIN_UI_THEME_PRESETS, ...uiThemeCustomPresets], [uiThemeCustomPresets]);
  const uiThemeLightPresets = useMemo(() => BUILTIN_UI_THEME_PRESETS.filter((item) => item.group === 'light'), []);
  const uiThemeDarkPresets = useMemo(() => BUILTIN_UI_THEME_PRESETS.filter((item) => item.group === 'dark'), []);
  const selectedUiThemePreset = useMemo(
    () => uiThemePresets.find((item) => item.id === activeUiTheme?.presetId) ?? null,
    [uiThemePresets, activeUiTheme]
  );
  const uiThemeLooksCustom = useMemo(() => {
    if (!selectedUiThemePreset) return true;
    const current = normalizeUiThemeTokens(activeUiTheme?.tokens ?? {});
    const preset = normalizeUiThemeTokens(selectedUiThemePreset.tokens ?? {});
    return UI_THEME_TOKEN_DEFINITIONS.some((token) => current[token.key] !== preset[token.key]);
  }, [selectedUiThemePreset, activeUiTheme]);
  const activeThemePreviewPreset = useMemo(() => {
    if (uiThemeLooksCustom) {
      return {
        id: 'custom-live',
        name: 'Własny',
        description: 'Aktualne kolory odbiegają od zapisanych presetów.',
        builtIn: false,
        group: 'custom',
        tokens: normalizeUiThemeTokens(activeUiTheme?.tokens ?? {})
      };
    }
    return selectedUiThemePreset ?? {
      id: 'custom-live',
      name: 'Własny',
      description: 'Aktualny zestaw niestandardowy.',
      builtIn: false,
      group: 'custom',
      tokens: normalizeUiThemeTokens(activeUiTheme?.tokens ?? {})
    };
  }, [uiThemeLooksCustom, selectedUiThemePreset, activeUiTheme]);
  const activeThemePreviewPalette = useMemo(() => getThemePresetPalette(activeThemePreviewPreset), [activeThemePreviewPreset]);

  const uiThemeContrastWarnings = useMemo(() => {
    const tokens = normalizeUiThemeTokens(activeUiTheme?.tokens ?? {});
    const appContrast = calculateContrastRatio(tokens.appBg, tokens.textMain);
    const panelContrast = calculateContrastRatio(tokens.panelBg, tokens.textMain);
    const warningContrast = calculateContrastRatio(tokens.panelBg, tokens.textMuted);
    const warnings = [];
    if (appContrast < 4.5) warnings.push(`Niski kontrast tekstu głównego do tła aplikacji (${appContrast.toFixed(2)}:1).`);
    if (panelContrast < 4.5) warnings.push(`Niski kontrast tekstu głównego do paneli (${panelContrast.toFixed(2)}:1).`);
    if (warningContrast < 3) warnings.push(`Słaby kontrast tekstu drugorzędnego (${warningContrast.toFixed(2)}:1).`);
    return warnings;
  }, [activeUiTheme]);

  const applyUiThemePreset = (presetId) => {
    const preset = uiThemePresets.find((item) => item.id === presetId);
    if (!preset) return;
    onChangeActiveUiTheme({ presetId: preset.id, tokens: normalizeUiThemeTokens(preset.tokens) });
    setUiThemeNotice('');
  };

  const updateUiThemeToken = (tokenKey, value) => {
    const nextValue = normalizeHexColor(value, activeUiTheme?.tokens?.[tokenKey] ?? '#000000');
    onChangeActiveUiTheme({
      presetId: activeUiTheme?.presetId ?? 'custom-live',
      tokens: {
        ...normalizeUiThemeTokens(activeUiTheme?.tokens ?? {}),
        [tokenKey]: nextValue
      }
    });
  };

  const saveCustomUiThemePreset = () => {
    const name = String(uiThemeNameInput ?? '').trim();
    if (!name) {
      setUiThemeNotice('Podaj nazwę presetu, aby zapisać własny motyw.');
      return;
    }
    const existing = uiThemeCustomPresets.find((item) => item.name.toLowerCase() === name.toLowerCase());
    const nextPreset = {
      id: existing?.id ?? `custom-${Date.now()}`,
      name,
      builtIn: false,
      tokens: normalizeUiThemeTokens(activeUiTheme?.tokens ?? {})
    };
    const nextCustom = existing
      ? uiThemeCustomPresets.map((item) => item.id === existing.id ? nextPreset : item)
      : [...uiThemeCustomPresets, nextPreset];
    saveUiThemeCustomPresets(nextCustom);
    onChangeActiveUiTheme({ presetId: nextPreset.id, tokens: nextPreset.tokens });
    setUiThemeNameInput('');
    setUiThemeNotice(existing ? 'Zaktualizowano istniejący preset.' : 'Zapisano nowy preset.');
  };

  const deleteCustomUiThemePreset = (presetId) => {
    const target = uiThemeCustomPresets.find((item) => item.id === presetId);
    if (!target) return;
    setConfirmDialog({
      title: 'Usuń preset motywu',
      message: `Usunąć preset „${target.name}”?`,
      confirmLabel: 'Usuń',
      cancelLabel: 'Anuluj',
      variant: 'danger',
      onConfirm: () => {
        setConfirmDialog(null);
        const nextCustom = uiThemeCustomPresets.filter((item) => item.id !== presetId);
        saveUiThemeCustomPresets(nextCustom);
        if (activeUiTheme?.presetId === presetId) applyUiThemePreset(DEFAULT_ACTIVE_THEME_ID);
        setUiThemeNotice('Preset został usunięty.');
      }
    });
  };

  const resetUiThemeToDefaults = () => {
    setConfirmDialog({
      title: 'Przywróć domyślne kolory',
      message: 'Przywrócić domyślny preset kolorów interfejsu?',
      confirmLabel: 'Przywróć',
      cancelLabel: 'Anuluj',
      variant: 'warning',
      onConfirm: () => {
        setConfirmDialog(null);
        applyUiThemePreset(DEFAULT_ACTIVE_THEME_ID);
        setUiThemeNotice('Przywrócono domyślne kolory.');
      }
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

  const addPdfArchiveRow = ({ type, number, relation }) => {
    setPdfArchiveRows((current) => {
      const next = [{
        id: `pdf-${Date.now()}-${Math.round(Math.random() * 1000)}`,
        type: String(type || 'Dokument'),
        number: String(number || '—'),
        createdAt: new Date().toISOString(),
        relation: String(relation || 'Ręcznie'),
        createdBy: demoUser.name
      }, ...current].slice(0, 500);
      localStorage.setItem('fixer:pdf-archive', JSON.stringify(next));
      return next;
    });
  };

  const deletePdfArchiveRow = (rowId) => {
    setPdfArchiveRows((current) => {
      const next = current.filter((row) => row.id !== rowId);
      localStorage.setItem('fixer:pdf-archive', JSON.stringify(next));
      return next;
    });
  };

  const updateRentalNumbering = (key, value) => {
    setRentalNumbering((current) => ({ ...current, [key]: value }));
  };

  const updateDocumentTemplate = (key, value) => {
    setDocumentSettings((current) => ({ ...current, templates: { ...current.templates, [key]: value } }));
    setDocumentSettingsNotice('');
  };

  const updateDocumentNumbering = (key, field, value) => {
    setDocumentSettings((current) => ({
      ...current,
      numbering: {
        ...current.numbering,
        [key]: {
          ...current.numbering[key],
          [field]: field === 'padding' ? Math.max(1, Number(value) || 1) : value
        }
      }
    }));
    setDocumentSettingsNotice('');
  };

  const updateRentalAgreementTemplate = (updater) => {
    setDocumentSettings((current) => {
      const currentTemplate = getRentalAgreementTemplate(current);
      const nextTemplate = normalizeRentalAgreementTemplate(typeof updater === 'function' ? updater(currentTemplate) : updater);
      return {
        ...current,
        documentTemplates: {
          ...current.documentTemplates,
          [RENTAL_AGREEMENT_TEMPLATE_KEY]: nextTemplate
        }
      };
    });
    setDocumentSettingsNotice('');
  };

  const toggleRentalAgreementColumn = (key) => {
    updateRentalAgreementTemplate((template) => ({
      ...template,
      columns: template.columns.map((column) => column.key === key ? { ...column, enabled: !column.enabled } : column)
    }));
  };

  const moveRentalAgreementColumn = (key, direction) => {
    updateRentalAgreementTemplate((template) => {
      const columns = [...template.columns];
      const index = columns.findIndex((column) => column.key === key);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= columns.length) return template;
      const [item] = columns.splice(index, 1);
      columns.splice(nextIndex, 0, item);
      return { ...template, columns };
    });
  };

  const resetRentalAgreementColumns = () => {
    updateRentalAgreementTemplate((template) => ({ ...template, columns: DEFAULT_RENTAL_AGREEMENT_COLUMNS }));
    setDocumentSettingsNotice('Przywrócono domyślne kolumny umowy.');
  };

  const updateRentalAgreementTerm = (index, value) => {
    updateRentalAgreementTemplate((template) => ({
      ...template,
      terms: template.terms.map((term, termIndex) => termIndex === index ? value : term)
    }));
  };

  const addRentalAgreementTerm = () => {
    updateRentalAgreementTemplate((template) => ({ ...template, terms: [...template.terms, 'Nowy punkt umowy.'] }));
  };

  const removeRentalAgreementTerm = (index) => {
    updateRentalAgreementTemplate((template) => ({ ...template, terms: template.terms.filter((_, termIndex) => termIndex !== index) }));
  };

  const moveRentalAgreementTerm = (index, direction) => {
    updateRentalAgreementTemplate((template) => {
      const terms = [...template.terms];
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= terms.length) return template;
      const [item] = terms.splice(index, 1);
      terms.splice(nextIndex, 0, item);
      return { ...template, terms };
    });
  };

  const updateAgreementTemplateField = (field, value) => {
    updateRentalAgreementTemplate((template) => ({ ...template, [field]: value }));
  };

  const toggleAgreementSection = (sectionId) => {
    updateRentalAgreementTemplate((template) => ({
      ...template,
      sectionVisibility: {
        ...template.sectionVisibility,
        [sectionId]: template.sectionVisibility?.[sectionId] === false
      }
    }));
  };

  const moveAgreementSection = (sectionId, direction) => {
    updateRentalAgreementTemplate((template) => {
      const order = [...(template.sectionOrder ?? DEFAULT_RENTAL_AGREEMENT_SECTION_ORDER)];
      const index = order.indexOf(sectionId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= order.length) return template;
      const [item] = order.splice(index, 1);
      order.splice(nextIndex, 0, item);
      return { ...template, sectionOrder: order };
    });
  };

  const resetAgreementTemplateToDefaults = () => {
    updateRentalAgreementTemplate(DEFAULT_DOCUMENT_TEMPLATES[RENTAL_AGREEMENT_TEMPLATE_KEY]);
    setDocumentSettingsNotice('Przywrócono domyślny szablon umowy.');
  };

  const copyAgreementVariable = async (token) => {
    try {
      await navigator.clipboard.writeText(token);
      setCopiedTemplateVariable(token);
      window.setTimeout(() => setCopiedTemplateVariable(''), 1800);
    } catch {
      setDocumentSettingsNotice('Nie udało się skopiować zmiennej do schowka.');
    }
  };

  const resetRentalAgreementTerms = () => {
    updateRentalAgreementTemplate((template) => ({ ...template, terms: DEFAULT_RENTAL_AGREEMENT_TERMS }));
    setDocumentSettingsNotice('Przywrócono domyślne warunki umowy.');
  };

  const exportRentalAgreementTemplate = () => {
    const template = getRentalAgreementTemplate(documentSettings);
    downloadTextFile(`fixer-szablon-umowy-wypozyczenia-${getLocalIsoDate()}.json`, JSON.stringify({ type: RENTAL_AGREEMENT_TEMPLATE_KEY, version: 1, template }, null, 2), 'application/json;charset=utf-8');
    setDocumentSettingsNotice('Wyeksportowano konfigurację szablonu umowy.');
  };

  const exportRentalAgreementTerms = () => {
    const template = getRentalAgreementTemplate(documentSettings);
    downloadTextFile(`fixer-warunki-umowy-wypozyczenia-${getLocalIsoDate()}.json`, JSON.stringify({ type: 'rentalAgreementTerms', version: 1, terms: template.terms }, null, 2), 'application/json;charset=utf-8');
    setDocumentSettingsNotice('Wyeksportowano warunki umowy.');
  };

  const importRentalAgreementTerms = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setConfirmDialog({
      title: 'Import warunków umowy',
      message: 'Zaimportować warunki umowy? Obecna lista warunków w formularzu zostanie zastąpiona zawartością pliku.',
      confirmLabel: 'Importuj',
      cancelLabel: 'Anuluj',
      variant: 'warning',
      onConfirm: () => {
        setConfirmDialog(null);
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const payload = JSON.parse(String(reader.result ?? ''));
            const terms = Array.isArray(payload.terms) ? payload.terms : Array.isArray(payload) ? payload : [];
            if (!terms.length) throw new Error('Brak punktów umowy.');
            updateRentalAgreementTemplate((template) => ({ ...template, terms }));
            setDocumentSettingsNotice('Zaimportowano warunki umowy. Zapisz ustawienia, aby utrwalić zmianę.');
          } catch (error) {
            console.error('Rental agreement terms import failed', error);
            setDocumentSettingsNotice('Nie udało się zaimportować warunków umowy.');
          }
        };
        reader.readAsText(file);
      }
    });
  };

  const importRentalAgreementTemplate = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setConfirmDialog({
      title: 'Import szablonu umowy',
      message: 'Zaimportować szablon umowy? Obecna konfiguracja szablonu w formularzu zostanie zastąpiona zawartością pliku.',
      confirmLabel: 'Importuj',
      cancelLabel: 'Anuluj',
      variant: 'warning',
      onConfirm: () => {
        setConfirmDialog(null);
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const payload = JSON.parse(String(reader.result ?? ''));
            const template = payload.template ?? payload;
            updateRentalAgreementTemplate(template);
            setDocumentSettingsNotice('Zaimportowano konfigurację szablonu. Zapisz ustawienia, aby utrwalić zmianę.');
          } catch (error) {
            console.error('Rental agreement template import failed', error);
            setDocumentSettingsNotice('Nie udało się zaimportować konfiguracji szablonu.');
          }
        };
        reader.readAsText(file);
      }
    });
  };

  const saveDocumentSettingsState = () => {
    const numberingRowsToValidate = [
      { label: 'Wypożyczenia', value: rentalNumbering },
      ...Object.entries(documentSettings.numbering ?? {}).map(([key, value]) => ({ label: key, value }))
    ];
    const invalidNumbering = numberingRowsToValidate.find((row) => !String(row.value?.prefix ?? '').trim() || !String(row.value?.format ?? '').trim());
    if (invalidNumbering) {
      setDocumentSettingsNotice('Uzupełnij prefiks i format numeracji przed zapisem dokumentów.');
      setActiveDocumentPanel('numbering');
      return;
    }
    const savedDocumentSettings = saveDocumentSettings(documentSettings);
    const savedCompanyProfile = saveCompanyProfile(companyProfile);
    const savedRentalSettings = saveRentalNumberingSettings(rentalNumbering);
    setDocumentSettings(savedDocumentSettings);
    setCompanyProfile(savedCompanyProfile);
    setRentalNumbering(savedRentalSettings);
    setDocumentSettingsNotice('Ustawienia dokumentów zapisane.');
  };

  const resetDocumentNumberingState = () => {
    setConfirmDialog({
      title: 'Przywróć numerację dokumentów',
      message: 'Przywrócić domyślną numerację dokumentów?',
      confirmLabel: 'Przywróć',
      cancelLabel: 'Anuluj',
      variant: 'warning',
      onConfirm: () => {
        setConfirmDialog(null);
        const savedDocumentSettings = saveDocumentSettings({ ...documentSettings, numbering: DEFAULT_DOCUMENT_SETTINGS.numbering });
        const savedRentalSettings = saveRentalNumberingSettings(DEFAULT_RENTAL_NUMBERING);
        setDocumentSettings(savedDocumentSettings);
        setRentalNumbering(savedRentalSettings);
        setDocumentSettingsNotice('Przywrócono domyślną numerację dokumentów.');
      }
    });
  };

  const createBackupFile = async ({ silent = false } = {}) => {
    if (!silent) {
      setBackupBusy(true);
      setBackupNotice('');
    }
    try {
      const { backup, fileName, warnings } = await createBackupArchive();
      downloadTextFile(fileName, JSON.stringify(backup, null, 2), 'application/json;charset=utf-8');
      localStorage.removeItem(NOTIFICATIONS_BACKUP_FAILURE_KEY);
      if (!silent) setBackupNotice(warnings.length ? `Backup utworzony z ostrzeżeniami: ${warnings.length}.` : 'Backup został utworzony.');
      return true;
    } catch (error) {
      console.error('Backup failed', error);
      localStorage.setItem(NOTIFICATIONS_BACKUP_FAILURE_KEY, JSON.stringify({ at: new Date().toISOString(), message: error?.message || 'Nie udało się utworzyć backupu.' }));
      if (!silent) setBackupNotice(error?.message === BACKUP_FULL_ERROR_MESSAGE ? BACKUP_FULL_ERROR_MESSAGE : 'Nie udało się utworzyć pełnej kopii bezpieczeństwa. Backup nie został zapisany.');
      return false;
    } finally {
      if (!silent) setBackupBusy(false);
    }
  };

  const handleRestoreFile = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result ?? '');
        const backup = parseBackupText(text);
        setRestoreCandidate({ fileName: file.name, backup });
        setBackupNotice('');
      } catch (error) {
        console.error('Backup validation failed', error);
        setBackupNotice(error.message || 'Nieprawidłowy plik backupu.');
      }
    };
    reader.onerror = () => setBackupNotice('Nie udało się odczytać pliku backupu.');
    reader.readAsText(file);
  };

  const restoreBackupFromCandidate = async (makeCurrentBackup) => {
    if (!restoreCandidate?.backup) return;
    setBackupBusy(true);
    setBackupNotice('');
    try {
      if (makeCurrentBackup) await createBackupFile({ silent: true });
      const { warnings } = await restoreBackupArchive(restoreCandidate.backup);
      setCompanyProfile(getCompanyProfile());
      setDocumentSettings(getDocumentSettings());
      setRentalNumbering(getRentalNumberingSettings());
      setConfigDictionaries(getConfigDictionaries());
      setDashboardSettings(getDashboardSettings());
      setRestoreCandidate(null);
      setBackupNotice(warnings.length ? `Backup przywrócony z ostrzeżeniami: ${warnings.length}.` : 'Backup został przywrócony.');
    } catch (error) {
      console.error('Backup restore failed', error);
      setBackupNotice(error.message || 'Nie udało się przywrócić backupu.');
    } finally {
      setBackupBusy(false);
    }
  };

  const exportBackupCsv = async (moduleKey) => {
    setBackupBusy(true);
    setBackupNotice('');
    try {
      const { fileName, content } = await createCsvExport(moduleKey);
      downloadTextFile(fileName, content);
      setBackupNotice('Eksport CSV został utworzony.');
    } catch (error) {
      console.error('CSV export failed', error);
      setBackupNotice('Nie udało się utworzyć eksportu CSV.');
    } finally {
      setBackupBusy(false);
    }
  };

  const saveConfigDictionaryState = (next) => {
    const saved = saveConfigDictionaries(next);
    setConfigDictionaries(saved);
  };

  const resetConfigDictionary = (key) => {
    setConfirmDialog({
      title: 'Przywróć listę',
      message: 'Przywrócić domyślną listę?',
      confirmLabel: 'Przywróć',
      cancelLabel: 'Anuluj',
      variant: 'warning',
      onConfirm: () => {
        setConfirmDialog(null);
        saveConfigDictionaryState({ ...configDictionaries, [key]: DEFAULT_CONFIG_DICTIONARIES[key].map((name) => ({ name, active: true })) });
      }
    });
  };

  const resetCompanySettings = () => {
    setConfirmDialog({
      title: 'Wyczyść dane firmy',
      message: 'Przywrócić puste dane firmy?',
      confirmLabel: 'Wyczyść',
      cancelLabel: 'Anuluj',
      variant: 'warning',
      onConfirm: () => {
        setConfirmDialog(null);
        const saved = saveCompanyProfile(DEFAULT_COMPANY_PROFILE);
        setCompanyProfile(saved);
        setCompanySaveNotice('Dane firmy zostały wyczyszczone.');
      }
    });
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
    setNotice('');
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
    }
  };

  useEffect(() => { loadEquipmentSettings(); }, []);

  useEffect(() => {
    if (isDocumentsMode) return;
    if (dashboardIntent?.type !== 'settings') return;
    const sectionMap = {
      company: { section: 'company' },
      documents: { section: 'documents' },
      interface: { section: 'interface' },
      clients: { section: 'dictionaries', sub: 'clients' },
      equipment: { section: 'dictionaries', sub: 'equipment' },
      service: { section: 'dictionaries', sub: 'service' },
      rentals: { section: 'dictionaries', sub: 'rentals' },
      projects: { section: 'dictionaries', sub: 'projects' },
      organizer: { section: 'dictionaries', sub: 'projects' },
      calendar: { section: 'integrations', integrationPanel: 'calendar' },
      integrations: { section: 'integrations', integrationPanel: 'calendar' },
      backups: { section: 'system', systemPanel: 'backup' },
      backup: { section: 'system', systemPanel: 'backup' },
      restore: { section: 'system', systemPanel: 'restore' },
      system: { section: 'system', systemPanel: 'backup' }
    };
    const target = sectionMap[dashboardIntent.section] ?? sectionMap[dashboardIntent.settingsSection];
    if (target?.section) {
      setActiveSection(target.section);
      if (target.sub) setActiveSubs((current) => ({ ...current, [target.section]: target.sub }));
      if (target.integrationPanel) setActiveIntegrationPanel(target.integrationPanel);
      if (target.systemPanel) setActiveSystemPanel(target.systemPanel);
    }
    onConsumeDashboardIntent?.();
  }, [dashboardIntent, onConsumeDashboardIntent]);

  const resetEquipmentDictionary = async (type) => {
    setConfirmDialog({
      title: 'Przywróć listę',
      message: 'Przywrócić domyślną listę?',
      confirmLabel: 'Przywróć',
      cancelLabel: 'Anuluj',
      variant: 'warning',
      onConfirm: async () => {
        setConfirmDialog(null);
        const { error } = await resetEquipmentDictionaryRecords(type);
        if (error) { setNotice('Nie udało się zapisać ustawienia. Program zachowa lokalną listę zapasową.'); return; }
        await loadEquipmentSettings();
      }
    });
  };

  const serviceDictionaryList = (type) => {
    if (type === SERVICE_DICTIONARY_TYPES.priority) return servicePrioritiesSettings;
    if (type === SERVICE_DICTIONARY_TYPES.customerDeviceCategory) return serviceDeviceCategoriesSettings;
    if (type === SERVICE_DICTIONARY_TYPES.intakeCondition) return serviceIntakeConditionsSettings;
    if (type === SERVICE_DICTIONARY_TYPES.externalService) return serviceExternalServicesSettings;
    if (type === SERVICE_DICTIONARY_TYPES.progressTemplate) return serviceProgressTemplatesSettings;
    return serviceStatusesSettings;
  };

  const setServiceDictionaryList = (type, rows) => {
    if (type === SERVICE_DICTIONARY_TYPES.priority) setServicePrioritiesSettings(rows);
    else if (type === SERVICE_DICTIONARY_TYPES.customerDeviceCategory) setServiceDeviceCategoriesSettings(rows);
    else if (type === SERVICE_DICTIONARY_TYPES.intakeCondition) setServiceIntakeConditionsSettings(rows);
    else if (type === SERVICE_DICTIONARY_TYPES.externalService) setServiceExternalServicesSettings(rows);
    else if (type === SERVICE_DICTIONARY_TYPES.progressTemplate) setServiceProgressTemplatesSettings(rows);
    else setServiceStatusesSettings(rows);
  };

  const loadServiceSettings = async () => {
    const [statusesResult, prioritiesResult, categoriesResult, conditionsResult, externalServicesResult, progressTemplatesResult] = await Promise.all([
      fetchServiceDictionary(SERVICE_DICTIONARY_TYPES.status),
      fetchServiceDictionary(SERVICE_DICTIONARY_TYPES.priority),
      fetchServiceDictionary(SERVICE_DICTIONARY_TYPES.customerDeviceCategory),
      fetchServiceDictionary(SERVICE_DICTIONARY_TYPES.intakeCondition),
      fetchServiceDictionary(SERVICE_DICTIONARY_TYPES.externalService),
      fetchServiceDictionary(SERVICE_DICTIONARY_TYPES.progressTemplate)
    ]);
    setServiceStatusesSettings(statusesResult.data ?? []);
    setServicePrioritiesSettings(prioritiesResult.data ?? []);
    setServiceDeviceCategoriesSettings(categoriesResult.data ?? []);
    setServiceIntakeConditionsSettings(conditionsResult.data ?? []);
    setServiceExternalServicesSettings(externalServicesResult.data ?? []);
    setServiceProgressTemplatesSettings(progressTemplatesResult.data ?? []);
    if (statusesResult.error || prioritiesResult.error || categoriesResult.error || conditionsResult.error || externalServicesResult.error || progressTemplatesResult.error) {
      setNotice('Nie udało się pobrać ustawień Serwisu z Supabase. Uruchom migracje słowników Serwisu.');
    } else if (statusesResult.local || prioritiesResult.local || categoriesResult.local || conditionsResult.local || externalServicesResult.local || progressTemplatesResult.local) {
      setNotice('');
    }
  };

  useEffect(() => { loadServiceSettings(); }, []);

  const resetServiceDictionary = async (type) => {
    setConfirmDialog({
      title: 'Przywróć listę',
      message: 'Przywrócić domyślną listę?',
      confirmLabel: 'Przywróć',
      cancelLabel: 'Anuluj',
      variant: 'warning',
      onConfirm: async () => {
        setConfirmDialog(null);
        const { error } = await resetServiceDictionaryRecords(type);
        if (error) { setNotice(`Nie udało się przywrócić domyślnych ustawień Serwisu w Supabase: ${error.message}`); return; }
        await loadServiceSettings();
      }
    });
  };

  const renderEquipmentDictionaryEditor = (type, title, description, items, addLabel) => <DictionaryEditor
    title={title}
    description={description}
    items={items}
    addLabel={addLabel}
    supportsColor={type === 'status'}
    statusColors={statusColors}
    onColorChange={onStatusColorChange}
    onAdd={async (name) => {
      const { error } = await addEquipmentDictionaryRecord(type, name, items.length + 1);
      if (error) throw new Error('Nie udało się zapisać ustawienia. Program zachowa lokalną listę zapasową.');
      await loadEquipmentSettings();
    }}
    onEdit={async (item, name) => {
      const { error } = await updateEquipmentDictionaryRecord(item.id, type, name);
      if (error) throw new Error('Nie udało się zapisać ustawienia. Program zachowa lokalną listę zapasową.');
      await loadEquipmentSettings();
    }}
    onDelete={async (item) => {
      if (items.length <= 1) throw new Error('Musi zostać przynajmniej jedna pozycja.');
      setConfirmDialog({
        title: 'Usuń pozycję',
        message: `Usunąć pozycję: ${item.name}? Jeśli była używana w starych rekordach, lepiej zostawić ją na liście.`,
        confirmLabel: 'Usuń',
        cancelLabel: 'Anuluj',
        variant: 'danger',
        onConfirm: async () => {
          setConfirmDialog(null);
          const { error } = await deleteEquipmentDictionaryRecord(item.id, type);
          if (error) { setNotice('Nie udało się zapisać ustawienia. Program zachowa lokalną listę zapasową.'); return; }
          await loadEquipmentSettings();
        }
      });
    }}
    onReset={() => resetEquipmentDictionary(type)}
  />;

  const renderServiceDictionaryEditor = (type, title, description, addLabel) => {
    const items = serviceDictionaryList(type);
    return <DictionaryEditor
      title={title}
      description={description}
      items={items}
      addLabel={addLabel}
      supportsColor={type === SERVICE_DICTIONARY_TYPES.status}
      statusColors={statusColors}
      onColorChange={onStatusColorChange}
      onAdd={async (name) => {
        const { error } = await addServiceDictionaryRecord(type, name, items.length + 1);
        if (error) throw new Error(`Nie udało się zapisać ustawienia Serwisu: ${error.message}`);
        await loadServiceSettings();
      }}
      onEdit={async (item, name) => {
        const { error } = await updateServiceDictionaryRecord(item.id, type, name);
        if (error) throw new Error(`Nie udało się zapisać ustawienia Serwisu: ${error.message}`);
        await loadServiceSettings();
      }}
      onDelete={async (item) => {
        if (items.length <= 1) throw new Error('Musi zostać przynajmniej jedna pozycja.');
        setConfirmDialog({
          title: 'Usuń pozycję',
          message: `Usunąć pozycję: ${item.name}? Jeśli była używana w starych zleceniach, lepiej zostawić ją na liście.`,
          confirmLabel: 'Usuń',
          cancelLabel: 'Anuluj',
          variant: 'danger',
          onConfirm: async () => {
            setConfirmDialog(null);
            const { error } = await deleteServiceDictionaryRecord(item.id, type);
            if (error) { setNotice(`Nie udało się usunąć ustawienia Serwisu: ${error.message}`); return; }
            await loadServiceSettings();
          }
        });
      }}
      onMove={async (item, direction) => {
        const index = items.findIndex((row) => row.id === item.id);
        const nextIndex = index + direction;
        if (index < 0 || nextIndex < 0 || nextIndex >= items.length) return;
        const next = [...items];
        next.splice(index, 1);
        next.splice(nextIndex, 0, item);
        setServiceDictionaryList(type, next.map((row, rowIndex) => ({ ...row, sort_order: rowIndex + 1 })));
        const { error } = await reorderServiceDictionaryRecords(type, next);
        if (error) {
          await loadServiceSettings();
          throw new Error(`Nie udało się zmienić kolejności: ${error.message}`);
        }
      }}
      onReset={() => resetServiceDictionary(type)}
    />;
  };

  const renderConfigDictionaryEditor = (key, title, description) => {
    const items = normalizeConfigDictionary(key, configDictionaries[key]).map((item, index) => ({ ...item, id: `${key}-${index}`, raw: { index, item } }));
    return <DictionaryEditor
      title={title}
      description={description}
      items={items}
      supportsActiveState
      onAdd={async (name) => saveConfigDictionaryState({ ...configDictionaries, [key]: [...normalizeConfigDictionary(key, configDictionaries[key]), { name, active: true }] })}
      onEdit={async (raw, name) => {
        const list = normalizeConfigDictionary(key, configDictionaries[key]);
        saveConfigDictionaryState({ ...configDictionaries, [key]: list.map((item, index) => index === raw.index ? { ...item, name } : item) });
      }}
      onToggleActive={async (raw) => {
        const list = normalizeConfigDictionary(key, configDictionaries[key]);
        const activeCount = list.filter((item) => item.active).length;
        const item = list[raw.index];
        if (item.active && activeCount <= 1) throw new Error('Musi zostać przynajmniej jedna aktywna pozycja.');
        saveConfigDictionaryState({ ...configDictionaries, [key]: list.map((row, index) => index === raw.index ? { ...row, active: !row.active } : row) });
      }}
      onDelete={async (raw) => {
        const list = normalizeConfigDictionary(key, configDictionaries[key]);
        if (list.length <= 1) throw new Error('Musi zostać przynajmniej jedna pozycja.');
        setConfirmDialog({
          title: 'Usuń pozycję',
          message: `Usunąć pozycję: ${list[raw.index].name}? Jeśli była używana w starych rekordach, lepiej ją dezaktywować.`,
          confirmLabel: 'Usuń',
          cancelLabel: 'Anuluj',
          variant: 'danger',
          onConfirm: () => {
            setConfirmDialog(null);
            saveConfigDictionaryState({ ...configDictionaries, [key]: list.filter((_, index) => index !== raw.index) });
          }
        });
      }}
      onReset={() => resetConfigDictionary(key)}
    />;
  };

  const resetTypes = async () => {
    if (!confirm('Przywrócić domyślną listę?')) return;
    const { error, local } = await resetClientTypesRecords(DEFAULT_CLIENT_TYPES);
    if (error) {
      alert('Nie udało się zapisać ustawienia. Program zachowa lokalną listę zapasową.');
      return;
    }
    await loadTypes();
  };

  const renderClientTypesDictionaryEditor = () => <DictionaryEditor
    title="Statusy klientów"
    description="Lista wartości widoczna w kartotece klienta."
    items={clientTypes}
    addLabel="np. Partner, VIP, Problemowy"
    supportsColor
    statusColors={statusColors}
    onColorChange={onStatusColorChange}
    onAdd={async (name) => {
      const { error } = await addClientTypeRecord(name, clientTypes.length + 1);
      if (error) throw new Error('Nie udało się zapisać ustawienia. Program zachowa lokalną listę zapasową.');
      await loadTypes();
    }}
    onEdit={async (item, name) => {
      const { error } = await updateClientTypeRecord(item.id, name);
      if (error) throw new Error('Nie udało się zapisać ustawienia. Program zachowa lokalną listę zapasową.');
      await loadTypes();
    }}
    onDelete={async (item) => {
      if (clientTypes.length <= 1) throw new Error('Musi zostać przynajmniej jeden status klienta.');
      if (!confirm(`Usunąć pozycję: ${item.name}? Jeśli była używana w starych rekordach, lepiej zostawić ją na liście.`)) return;
      const { error } = await deleteClientTypeRecord(item.id);
      if (error) throw new Error('Nie udało się zapisać ustawienia. Program zachowa lokalną listę zapasową.');
      await loadTypes();
    }}
    onReset={() => resetTypes()}
    emptyText="Brak statusów klientów."
  />;

  const renderReadonlyDictionaryEditor = (title, description, values, { supportsColor = false } = {}) => <DictionaryEditor
    title={title}
    description={description}
    items={values.map((name) => ({ id: name, name, readonly: true, readonlyLabel: 'Systemowy' }))}
    supportsColor={supportsColor}
    statusColors={statusColors}
    onColorChange={onStatusColorChange}
    emptyText="Brak pozycji systemowych."
  />;

  const renderOrganizerCategoryDictionaryEditor = () => <DictionaryEditor
    title="Kategorie zadań"
    description="Lista kategorii / tagów widoczna przy prostych zadaniach w module Zadania i projekty."
    items={organizerCategoryItems}
    addLabel="np. Finanse"
    onAdd={async (name) => {
      const { error } = await addOrganizerCategory(name, organizerCategoryItems.length + 1);
      if (error) throw new Error(`Nie udało się zapisać kategorii: ${error.message}`);
      await loadOrganizerSettings();
    }}
    onEdit={async (item, name) => {
      const { error } = await updateOrganizerCategory(item.id, name);
      if (error) throw new Error(`Nie udało się zapisać kategorii: ${error.message}`);
      await loadOrganizerSettings();
    }}
    onDelete={async (item) => {
      if (organizerCategoryItems.length <= 1) throw new Error('Musi zostać przynajmniej jedna kategoria.');
      setConfirmDialog({
        title: 'Usuń kategorię',
        message: `Usunąć kategorię: ${item.name}?`,
        confirmLabel: 'Usuń',
        cancelLabel: 'Anuluj',
        variant: 'danger',
        onConfirm: async () => {
          setConfirmDialog(null);
          const { error } = await deleteOrganizerCategory(item.id);
          if (error) { setNotice(`Nie udało się usunąć kategorii: ${error.message}`); return; }
          await loadOrganizerSettings();
        }
      });
    }}
    onReset={() => resetOrganizerCategoryItems()}
  />;

  const documentTemplateRows = [
    ['rentals', 'Wypożyczenie'],
    ['returns', 'Zwrot'],
    ['service', 'Zlecenie serwisowe'],
    ['estimates', 'Kosztorys serwisowy'],
    ['tableExport', 'Eksport tabel PDF']
  ];
  const documentNumberingRows = [
    { key: 'rentals', label: 'Wypożyczenia', value: rentalNumbering, onChange: (_key, field, value) => updateRentalNumbering(field, value), preview: formatRentalNumber(rentalNumbering, 1, new Date('2026-06-03T12:00:00')) },
    { key: 'returns', label: 'Zwroty', value: documentSettings.numbering.returns, onChange: updateDocumentNumbering, preview: formatDocumentNumber(documentSettings.numbering.returns, 1, new Date('2026-06-03T12:00:00')) },
    { key: 'service', label: 'Serwisy', value: documentSettings.numbering.service, onChange: updateDocumentNumbering, preview: formatDocumentNumber(documentSettings.numbering.service, 1, new Date('2026-06-03T12:00:00')) },
    { key: 'estimates', label: 'Kosztorysy', value: documentSettings.numbering.estimates, onChange: updateDocumentNumbering, preview: formatDocumentNumber(documentSettings.numbering.estimates, 1, new Date('2026-06-03T12:00:00')) },
    { key: 'projects', label: 'Projekty', value: documentSettings.numbering.projects, onChange: updateDocumentNumbering, preview: formatDocumentNumber(documentSettings.numbering.projects, 1, new Date('2026-06-03T12:00:00')) }
  ];
  const rentalAgreementTemplate = getRentalAgreementTemplate(documentSettings);
  const currentTemplateType = getDocumentTemplateTypeById(activeDocumentTemplateType);
  const currentDocumentTemplate = normalizeSharedDocumentTemplate(documentTemplateLibrary[activeDocumentTemplateType], currentTemplateType.defaultTemplate);
  const normalizeTemplateLibraryState = (library) => Object.fromEntries(DOCUMENT_TEMPLATE_TYPES.map((type) => [
    type.id,
    normalizeSharedDocumentTemplate(library?.[type.id], type.defaultTemplate)
  ]));
  const areTemplateLibrariesEqual = (left, right) => DOCUMENT_TEMPLATE_TYPES.every((type) => {
    const leftTemplate = normalizeSharedDocumentTemplate(left?.[type.id], type.defaultTemplate);
    const rightTemplate = normalizeSharedDocumentTemplate(right?.[type.id], type.defaultTemplate);
    return JSON.stringify(leftTemplate) === JSON.stringify(rightTemplate);
  });
  const templateDirtyByType = Object.fromEntries(DOCUMENT_TEMPLATE_TYPES.map((type) => [
    type.id,
    !areTemplateLibrariesEqual({ [type.id]: documentTemplateLibrary?.[type.id] }, { [type.id]: savedDocumentTemplateLibrary?.[type.id] })
  ]));
  const hasUnsavedTemplateChanges = Object.values(templateDirtyByType).some(Boolean);
  const currentTemplateHasUnsavedChanges = templateDirtyByType[activeDocumentTemplateType] === true;
  const saveDocumentTemplateDrafts = (noticeMessage = 'Zapisano szablon dokumentu.') => {
    try {
      const normalized = normalizeTemplateLibraryState(documentTemplateLibrary);
      const saved = saveDocumentTemplateLibrary(normalized);
      setDocumentTemplateLibrary(saved);
      setSavedDocumentTemplateLibrary(saved);
      setDocumentSettingsNotice(noticeMessage);
      return saved;
    } catch (error) {
      console.error('Document template save failed', error);
      setDocumentSettingsNotice('Nie udało się zapisać szablonu dokumentu. Spróbuj ponownie.');
      return null;
    }
  };
  const discardDocumentTemplateDrafts = (noticeMessage = 'Odrzucono niezapisane zmiany.') => {
    const restored = normalizeTemplateLibraryState(savedDocumentTemplateLibrary);
    setDocumentTemplateLibrary(restored);
    setDocumentSettingsNotice(noticeMessage);
    return restored;
  };
  const requestDocumentTemplateExitGuard = (action, { leavingSection = false } = {}) => {
    const leavingAgreementView = leavingSection || (activeSection === 'documents' && activeDocumentPanel === 'agreement');
    if (!leavingAgreementView || !hasUnsavedTemplateChanges) {
      action();
      return;
    }
    setPendingTemplateExitAction(() => action);
  };
  const confirmTemplateExitWithSave = () => {
    saveDocumentTemplateDrafts('Zapisano szablon dokumentu.');
    const pendingAction = pendingTemplateExitAction;
    setPendingTemplateExitAction(null);
    pendingAction?.();
  };
  const confirmTemplateExitWithDiscard = () => {
    discardDocumentTemplateDrafts();
    const pendingAction = pendingTemplateExitAction;
    setPendingTemplateExitAction(null);
    pendingAction?.();
  };
  const cancelTemplateExit = () => {
    setPendingTemplateExitAction(null);
  };
  const requestReturnToTemplateList = () => {
    if (!currentTemplateHasUnsavedChanges) {
      setDocumentTemplateViewMode('list');
      return;
    }
    setPendingTemplateExitAction(() => () => setDocumentTemplateViewMode('list'));
  };
  const openTemplateEditor = (typeId) => {
    setActiveDocumentTemplateType(typeId);
    setActiveAgreementTab('content');
    setDocumentTemplateViewMode('edit');
  };
  const requestTemplateTypeSwitch = (nextTypeId) => {
    if (nextTypeId === activeDocumentTemplateType) return;
    if (currentTemplateHasUnsavedChanges) {
      setPendingTemplateExitAction(() => () => {
        setActiveDocumentTemplateType(nextTypeId);
        setActiveAgreementTab('content');
      });
      return;
    }
    setActiveDocumentTemplateType(nextTypeId);
    setActiveAgreementTab('content');
  };
  const updateCurrentDocumentTemplate = (updater) => {
    setDocumentTemplateLibrary((current) => {
      const base = normalizeSharedDocumentTemplate(current[activeDocumentTemplateType], currentTemplateType.defaultTemplate);
      const nextTemplate = normalizeSharedDocumentTemplate(typeof updater === 'function' ? updater(base) : updater, currentTemplateType.defaultTemplate);
      return { ...current, [activeDocumentTemplateType]: nextTemplate };
    });
  };
  useEffect(() => {
    if (!hasUnsavedTemplateChanges) return undefined;
    const autosaveTimer = window.setTimeout(() => {
      try {
        const normalized = normalizeTemplateLibraryState(documentTemplateLibrary);
        const saved = saveDocumentTemplateLibrary(normalized);
        setDocumentTemplateLibrary(saved);
        setSavedDocumentTemplateLibrary(saved);
      } catch (error) {
        console.error('Document template autosave failed', error);
        setDocumentSettingsNotice('Nie udało się zapisać szablonu dokumentu. Spróbuj ponownie.');
      }
    }, 1400);
    return () => window.clearTimeout(autosaveTimer);
  }, [documentTemplateLibrary, hasUnsavedTemplateChanges]);
  const resetCurrentDocumentTemplate = () => {
    setDocumentTemplateLibrary((current) => {
      return { ...current, [activeDocumentTemplateType]: normalizeSharedDocumentTemplate(currentTemplateType.defaultTemplate, currentTemplateType.defaultTemplate) };
    });
    setDocumentSettingsNotice('Przywrócono domyślny szablon bieżącego dokumentu. Kliknij „Zapisz szablon”, aby zatwierdzić.');
  };
  const resetAllDocumentTemplates = () => {
    setConfirmDialog({
      title: 'Przywróć wszystkie szablony',
      message: 'Przywrócić wszystkie domyślne szablony dokumentów?',
      confirmLabel: 'Przywróć',
      cancelLabel: 'Anuluj',
      variant: 'warning',
      onConfirm: () => {
        setConfirmDialog(null);
        const defaults = getDefaultDocumentTemplateLibrary();
        setDocumentTemplateLibrary(defaults);
        setDocumentSettingsNotice('Przywrócono wszystkie domyślne szablony dokumentów. Kliknij „Zapisz szablon”, aby zatwierdzić.');
      }
    });
  };
  const exportDocumentTemplatesJson = () => {
    downloadTextFile(`fixer-document-templates-${getLocalIsoDate()}.json`, JSON.stringify(documentTemplateLibrary, null, 2), 'application/json;charset=utf-8');
    setDocumentSettingsNotice('Wyeksportowano szablony dokumentów.');
  };
  const importDocumentTemplatesJson = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setConfirmDialog({
      title: 'Import szablonów',
      message: 'Zaimportować szablony dokumentów z pliku JSON? Obecne lokalne szablony zostaną nadpisane.',
      confirmLabel: 'Importuj',
      cancelLabel: 'Anuluj',
      variant: 'warning',
      onConfirm: () => {
        setConfirmDialog(null);
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const payload = JSON.parse(String(reader.result ?? '{}'));
            const normalized = normalizeTemplateLibraryState(payload);
            setDocumentTemplateLibrary(normalized);
            setDocumentSettingsNotice('Zaimportowano szablony dokumentów. Kliknij „Zapisz szablon”, aby zatwierdzić.');
          } catch (error) {
            console.error('Document template import failed', error);
            setDocumentSettingsNotice('Nie udało się zaimportować szablonów dokumentów.');
          }
        };
        reader.readAsText(file);
      }
    });
  };
  const rentalAgreementPreviewRental = {
    rental_number: formatRentalNumber(rentalNumbering, 1, new Date('2026-06-03T12:00:00')),
    client_id: 'preview-client',
    clients: {
      type: 'Firma',
      name: 'Przykładowy klient Sp. z o.o.',
      nip: '1234567890',
      street: 'Testowa',
      building_number: '12',
      postal_code: '00-001',
      city: 'Warszawa',
      phone: '+48 000 000 000',
      email: 'kontakt@example.com'
    },
    start_date: '2026-06-03',
    planned_return_date: '2026-06-10',
    rental_type: 'Płatne',
    total_price: '1230.00',
    rental_items: [
      { id: 'preview-1', name_snapshot: 'Kamera Sony PXW-Z190', brand_snapshot: 'Sony', model_snapshot: 'PXW-Z190', serial_snapshot: 'SN-001', barcode_snapshot: '590000000001', inventory_number_snapshot: 'EQ/001', condition_out: 'Dobry' },
      { id: 'preview-2', name_snapshot: 'Statyw Manfrotto', brand_snapshot: 'Manfrotto', model_snapshot: '504HD', serial_snapshot: 'SN-002', barcode_snapshot: '590000000002', inventory_number_snapshot: 'EQ/002', condition_out: 'Bardzo dobry' }
    ]
  };
  const templatePreviewContext = {
    documentNumber: 'DOC/2026/06/01',
    issueDate: formatAgreementDate(getLocalIsoDate()),
    rentalIssueDate: formatAgreementDate('2026-06-03'),
    plannedReturnDate: formatAgreementDate('2026-06-10'),
    actualReturnDate: formatAgreementDate('2026-06-10'),
    ...mapClientToDocumentContext(rentalAgreementPreviewRental.clients),
    companyName: companyProfile.legalName || companyProfile.name || 'FIXER WEB',
    companyAddress: formatCompanyAddress(companyProfile),
    companyTaxData: formatCompanyTaxData(companyProfile),
    companyContact: formatCompanyContact(companyProfile),
    operatorName: 'Operator FIXER WEB',
    rentalNumber: rentalAgreementPreviewRental.rental_number,
    rentalTotal: '1230,00 PLN',
    serviceNumber: 'SER/2026/06/04',
    deviceName: 'Kamera Sony PXW-Z190',
    deviceSerialNumber: 'SN-001',
    faultDescription: 'Brak obrazu po uruchomieniu',
    diagnosis: 'Uszkodzenie układu zasilania',
    repairDescription: 'Wymieniono moduł i wykonano testy',
    serviceStatus: 'Zakończone',
    serviceCost: '450,00 PLN',
    notes: 'Brak dodatkowych uwag',
    documentFooter: companyProfile.documentFooter || '',
    documentCityClause: companyProfile.documentCity ? ` w ${companyProfile.documentCity}` : '',
    rentalItems: getRentalBaseItems(rentalAgreementPreviewRental),
    equipmentRows: buildRentalEquipmentTableRows(getRentalBaseItems(rentalAgreementPreviewRental))
  };
  const currentDocumentTemplatePreviewHtml = currentTemplateType.id === 'rentalAgreement'
    ? buildRentalAgreementDocumentHtml(rentalAgreementPreviewRental, {
      preview: true,
      company: companyProfile,
      sharedTemplate: currentDocumentTemplate
    })
    : buildGenericDocumentTemplateHtml(currentTemplateType, currentDocumentTemplate, templatePreviewContext, { preview: true, company: companyProfile });
  const settingsSearchTargets = [
    { section: 'integrations', integrationPanel: 'calendar', label: 'Kalendarz', keywords: 'kalendarz zrodla kolory filtr roboczy wydarzenia' },
    { section: 'system', systemPanel: 'backup', label: 'Backup', keywords: 'backup kopie bezpieczenstwa pelna kopia json' },
    { section: 'system', systemPanel: 'restore', label: 'Restore', keywords: 'restore przywroc import backup przywracanie' },
    { section: 'system', systemPanel: 'csv', label: 'Eksport CSV', keywords: 'csv eksport klienci sprzet wypozyczenia serwis zadania' },
    { section: 'system', systemPanel: 'diagnostics', label: 'Diagnostyka', keywords: 'diagnostyka zakres kopii status konfiguracja' },
    { section: 'dictionaries', sub: 'service', label: 'Statusy serwisu', keywords: 'status statusy serwis zlecenia priorytet priorytety' },
    { section: 'dictionaries', sub: 'equipment', label: 'Statusy i kategorie sprzętu', keywords: 'status statusy sprzet kategorie lokalizacje stany' },
    { section: 'dictionaries', sub: 'rentals', label: 'Wypożyczenia', keywords: 'wypozyczenia zwroty termin waluta numeracja typy stany' },
    { section: 'dictionaries', sub: 'projects', label: 'Zadania i projekty', keywords: 'zadania projekty organizer kategorie status priorytet' },
    { section: 'dictionaries', sub: 'clients', label: 'Klienci', keywords: 'klienci statusy typy rodzaje' }
  ];
  const normalizedSettingsSearch = settingsSearch.trim().toLocaleLowerCase('pl');
  const searchMatchesTarget = (target) => {
    if (!normalizedSettingsSearch) return true;
    return `${target.label} ${target.keywords}`.toLocaleLowerCase('pl').includes(normalizedSettingsSearch);
  };
  const visibleSections = isDocumentsMode
    ? sections
    : normalizedSettingsSearch
      ? sections.filter((section) => settingsSearchTargets.some((target) => target.section === section.id && searchMatchesTarget(target)))
      : sections;
  const settingsSearchResults = isDocumentsMode
    ? []
    : normalizedSettingsSearch ? settingsSearchTargets.filter(searchMatchesTarget).slice(0, 6) : [];
  const openDocumentPanel = (panelId) => {
    if (isDocumentsMode) {
      const leavingTemplates = documentsMainSection === 'templates' && panelId !== 'templates';
      if (leavingTemplates && hasUnsavedTemplateChanges) {
        requestDocumentTemplateExitGuard(() => {
          setDocumentsMainSection(panelId);
          setDocumentTemplateViewMode('list');
        }, { leavingSection: true });
        return;
      }
      setDocumentsMainSection(panelId);
      if (panelId !== 'templates') setDocumentTemplateViewMode('list');
      return;
    }
    requestDocumentTemplateExitGuard(() => setActiveDocumentPanel(panelId), { leavingSection: panelId !== 'agreement' });
  };
  const documentsSectionToPanel = {
    templates: 'agreement',
    numbering: 'numbering',
    company: 'company',
    designer: 'designer',
    archive: 'archive'
  };
  const effectiveDocumentPanel = isDocumentsMode ? (documentsSectionToPanel[documentsMainSection] ?? 'agreement') : activeDocumentPanel;

  useEffect(() => {
    if (!isDocumentsMode) return;
    if (effectiveDocumentPanel === 'designer') setDocumentsDesignerFullscreen(true);
  }, [isDocumentsMode, effectiveDocumentPanel]);

  const openSettingsSearchTarget = (target) => {
    requestDocumentTemplateExitGuard(() => {
      setActiveSection(target.section);
      if (target.sub) setActiveSubs((current) => ({ ...current, [target.section]: target.sub }));
      if (target.documentPanel) setActiveDocumentPanel(target.documentPanel);
      if (target.agreementTab) setActiveAgreementTab(target.agreementTab);
      if (target.integrationPanel) setActiveIntegrationPanel(target.integrationPanel);
      if (target.systemPanel) setActiveSystemPanel(target.systemPanel);
    }, { leavingSection: target.section !== 'documents' || target.documentPanel !== 'agreement' });
  };


  const activeSubsInSection = getActiveSub(activeSection);
  const currentSubSections = subSectionsMap[activeSection] || [];
  const currentSection = sections.find((section) => section.id === activeSection) ?? sections[0];
  const companyFieldErrors = {
    email: companyProfile.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(companyProfile.email) ? 'Sprawdź format adresu e-mail.' : '',
    website: companyProfile.website && !/^(https?:\/\/)?[\w.-]+\.[a-z]{2,}/i.test(companyProfile.website) ? 'Sprawdź format adresu WWW.' : ''
  };

  return <div className="settings-v2-layout">
    <div className="settings-v2-header">
      <div>
        <p className="eyebrow">{isDocumentsMode ? 'Moduł biznesowy' : 'Panel administracyjny'}</p>
        <h2>{isDocumentsMode ? 'Dokumenty' : 'Ustawienia'}</h2>
        <p className="muted">{isDocumentsMode ? 'Szablony, numeracja, dane firmy, projektant A4 i archiwum PDF.' : 'Centralne miejsce konfiguracji FIXER WEB, słowników, integracji i systemu.'}</p>
      </div>
      {!isDocumentsMode && <SettingsSearch value={settingsSearch} onChange={setSettingsSearch} results={settingsSearchResults} onOpenResult={openSettingsSearchTarget} />}
    </div>
    <div className="settings-sidebar-layout settings-v2-body">
      {!isDocumentsMode && <SettingsNavigation sections={visibleSections} activeSection={activeSection} onSelect={handleSectionChange} />}
      <SettingsSectionShell subSections={currentSubSections} activeSub={activeSubsInSection} onSubChange={(subId) => setActiveSubs((prev) => ({ ...prev, [activeSection]: subId }))}>

      {activeSection === 'company' && <CompanySettingsPanel><div className="settings-form-screen company-v2-screen">
        <div className="settings-screen-toolbar">
          <div>
            <h3>Profil firmy</h3>
            <p className="muted">Dane używane w aplikacji, na wydrukach i dokumentach PDF.</p>
          </div>
          <div className="settings-action-row">
            <AppButton variant="secondary" size="sm" onClick={resetCompanySettings}>Wyczyść</AppButton>
            <AppButton variant="primary" size="sm" onClick={saveCompanySettings}><Save size={15} />Zapisz</AppButton>
          </div>
        </div>
        {companySaveNotice && <div className="notice firm-save-notice settings-inline-notice">{companySaveNotice}</div>}

        <div className="settings-form-layout">
          <div className="settings-form-main">
            <section className="settings-form-section">
              <div className="settings-section-title"><h4>Dane firmy</h4><p className="muted">Nazwa i identyfikatory widoczne w kartotece oraz dokumentach.</p></div>
              <div className="settings-field-grid two-columns">
                <label className="firm-field field-wide">Nazwa firmy<AppInput value={companyProfile.name} onChange={(event) => updateCompanyProfile('name', event.target.value)} placeholder="np. BMX Media" /></label>
                <label className="firm-field field-wide">Nazwa na dokumentach<AppInput value={companyProfile.legalName} onChange={(event) => updateCompanyProfile('legalName', event.target.value)} placeholder="np. BMX Media Sp. z o.o." /></label>
                <label className="firm-field">NIP<AppInput value={companyProfile.nip} onChange={(event) => updateCompanyProfile('nip', event.target.value)} placeholder="0000000000" /></label>
                <label className="firm-field">REGON<AppInput value={companyProfile.regon} onChange={(event) => updateCompanyProfile('regon', event.target.value)} /></label>
                <label className="firm-field">KRS<AppInput value={companyProfile.krs || ''} onChange={(event) => updateCompanyProfile('krs', event.target.value)} /></label>
              </div>
            </section>

            <section className="settings-form-section">
              <div className="settings-section-title"><h4>Adres</h4><p className="muted">Adres firmy oraz miejscowość używana w treści dokumentów.</p></div>
              <div className="settings-field-grid address-grid-v2">
                <label className="firm-field field-street">Ulica<AppInput value={companyProfile.street} onChange={(event) => updateCompanyProfile('street', event.target.value)} /></label>
                <label className="firm-field">Nr budynku<AppInput value={companyProfile.buildingNumber} onChange={(event) => updateCompanyProfile('buildingNumber', event.target.value)} /></label>
                <label className="firm-field">Nr lokalu<AppInput value={companyProfile.apartmentNumber} onChange={(event) => updateCompanyProfile('apartmentNumber', event.target.value)} /></label>
                <label className="firm-field">Kod pocztowy<AppInput value={companyProfile.postalCode} onChange={(event) => updateCompanyProfile('postalCode', event.target.value)} placeholder="00-000" /></label>
                <label className="firm-field">Miasto<AppInput value={companyProfile.city} onChange={(event) => updateCompanyProfile('city', event.target.value)} /></label>
                <label className="firm-field">Kraj<AppInput value={companyProfile.country} onChange={(event) => updateCompanyProfile('country', event.target.value)} /></label>
                <label className="firm-field field-wide">Miejscowość dokumentów<AppInput value={companyProfile.documentCity} onChange={(event) => updateCompanyProfile('documentCity', event.target.value)} placeholder="np. Zabrzu" /><small>Forma używana w zdaniu „Umowa została zawarta w ...”.</small></label>
              </div>
            </section>

            <section className="settings-form-section">
              <div className="settings-section-title"><h4>Kontakt</h4><p className="muted">Dane kontaktowe drukowane na dokumentach, jeśli są uzupełnione.</p></div>
              <div className="settings-field-grid three-columns">
                <label className="firm-field">Telefon<AppInput value={companyProfile.phone} onChange={(event) => updateCompanyProfile('phone', event.target.value)} /></label>
                <label className="firm-field">E-mail<AppInput value={companyProfile.email} onChange={(event) => updateCompanyProfile('email', event.target.value)} />{companyFieldErrors.email && <small className="settings-field-error">{companyFieldErrors.email}</small>}</label>
                <label className="firm-field">Strona WWW<AppInput value={companyProfile.website} onChange={(event) => updateCompanyProfile('website', event.target.value)} placeholder="https://..." />{companyFieldErrors.website && <small className="settings-field-error">{companyFieldErrors.website}</small>}</label>
              </div>
            </section>

            <section className="settings-form-section">
              <div className="settings-section-title"><h4>Logo</h4><p className="muted">Logo jest zapisywane lokalnie w profilu firmy i używane na dokumentach.</p></div>
              <div className="company-logo-row-v2">
                <div className="firm-logo-preview compact">
                  {companyProfile.logoDataUrl ? <img src={companyProfile.logoDataUrl} alt="Logo firmy" /> : <span>Logo</span>}
                </div>
                <div className="firm-logo-actions">
                  <label className="app-button app-button-secondary app-button-sm file-button"><FolderOpen size={14} />Dodaj / zmień<input type="file" accept="image/*" onChange={handleCompanyLogoUpload} /></label>
                  <AppButton variant="secondary" size="sm" onClick={removeCompanyLogo} disabled={!companyProfile.logoDataUrl}>Usuń</AppButton>
                  <label className="settings-check compact-check"><input type="checkbox" checked={companyProfile.showLogoOnDocuments !== false} onChange={(event) => updateCompanyProfile('showLogoOnDocuments', event.target.checked)} />Pokazuj na dokumentach</label>
                </div>
              </div>
            </section>

            <section className="settings-form-section">
              <div className="settings-section-title"><h4>Dane dokumentów</h4><p className="muted">Dodatkowe informacje wykorzystywane przy generowaniu dokumentów.</p></div>
              <div className="settings-field-grid two-columns">
                <label className="firm-field field-wide">Numer konta<AppInput value={companyProfile.bankAccount} onChange={(event) => updateCompanyProfile('bankAccount', event.target.value)} /></label>
                <label className="firm-field">Waluta<AppInput value={rentalNumbering.currency || 'zł'} disabled /></label>
                <label className="firm-field field-wide">Nagłówek dokumentów<AppTextarea resizeKey="fixer:textarea:settings:document_header" value={companyProfile.documentHeader} onChange={(event) => updateCompanyProfile('documentHeader', event.target.value)} rows={2} /></label>
                <label className="firm-field field-wide">Stopka dokumentów<AppTextarea resizeKey="fixer:textarea:settings:document_footer" value={companyProfile.documentFooter} onChange={(event) => updateCompanyProfile('documentFooter', event.target.value)} rows={2} placeholder="np. Dziękujemy za współpracę." /></label>
              </div>
            </section>
          </div>

          <aside className="settings-preview-panel company-preview-panel">
            <div className="settings-section-title"><h4>Podgląd na dokumentach</h4><p className="muted">Tak dane firmy będą prezentowane w dokumentach.</p></div>
            <div className="firm-document-preview">
              {companyProfile.logoDataUrl && companyProfile.showLogoOnDocuments !== false && <img src={companyProfile.logoDataUrl} alt="Logo firmy" />}
              <strong>{companyProfile.legalName || companyProfile.name || 'Nazwa na dokumentach'}</strong>
              {formatDocumentAddressLines(companyProfile).map((line) => <span key={line}>{line}</span>)}
              {!formatDocumentAddressLines(companyProfile).length && <>
                <span>Ulica i numer</span>
                <span>Kod pocztowy i miasto</span>
              </>}
              <dl>
                <dt>NIP</dt><dd>{companyProfile.nip || '—'}</dd>
                <dt>REGON</dt><dd>{companyProfile.regon || '—'}</dd>
                <dt>KRS</dt><dd>{companyProfile.krs || '—'}</dd>
                <dt>Telefon</dt><dd>{companyProfile.phone || '—'}</dd>
                <dt>Email</dt><dd>{companyProfile.email || '—'}</dd>
                <dt>WWW</dt><dd>{companyProfile.website || '—'}</dd>
              </dl>
            </div>
          </aside>
        </div>
      </div></CompanySettingsPanel>}

      {activeSection === 'interface' && <InterfaceSettingsPanel><div className="settings-config-screen interface-v2-screen">
        <section className="settings-config-card">
          <div className="settings-config-card-header">
            <div><p className="eyebrow">Wygląd</p><h3>Motyw aplikacji</h3><p className="muted">Motyw jest zapamiętywany lokalnie w przeglądarce.</p></div>
          </div>
          <div className="theme-choice-row interface-theme-switch">
            {themeOptions.map((option) => {
              const Icon = option.icon;
              return <button key={option.id} type="button" className={`theme-choice-button ${colorTheme === option.id ? 'active' : ''}`} onClick={() => onChangeColorTheme(option.id)}><Icon size={16} /><span>{option.label}</span></button>;
            })}
          </div>
        </section>

        <section className="settings-config-card">
          <div className="settings-config-card-header">
            <div><p className="eyebrow">Kolory interfejsu</p><h3>Presety i personalizacja</h3><p className="muted">Zmiany są widoczne natychmiast i zapisywane lokalnie.</p></div>
          </div>

          <div className="ui-theme-toolbar">
            <label className="firm-field">
              Preset kolorów
              <AppSelect
                value={uiThemeLooksCustom ? 'custom-live' : (activeUiTheme?.presetId ?? DEFAULT_ACTIVE_THEME_ID)}
                onChange={(event) => {
                  const next = event.target.value;
                  if (next === 'custom-live') {
                    onChangeActiveUiTheme({
                      presetId: 'custom-live',
                      tokens: normalizeUiThemeTokens(activeUiTheme?.tokens ?? {})
                    });
                    return;
                  }
                  applyUiThemePreset(next);
                }}
              >
                <optgroup label="Jasne">
                  {uiThemeLightPresets.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
                </optgroup>
                <optgroup label="Ciemne">
                  {uiThemeDarkPresets.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
                </optgroup>
                <optgroup label="Własne">
                  <option value="custom-live">Własny (bieżący)</option>
                  {uiThemeCustomPresets.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
                </optgroup>
              </AppSelect>
            </label>
            <div className="ui-theme-toolbar-preview">
              <div className="ui-theme-preset-palette">{activeThemePreviewPalette.map((color, index) => <span key={`active-palette-${index}`} style={{ background: color }} />)}</div>
              <small>{activeThemePreviewPreset.description || 'Preset kolorystyczny'}</small>
            </div>
          </div>

          <div className="ui-theme-actions-row">
            <AppButton variant="primary" size="sm" onClick={saveCustomUiThemePreset}><Save size={14} />Zapisz jako preset</AppButton>
            <AppButton variant="danger" size="sm" onClick={() => selectedUiThemePreset && deleteCustomUiThemePreset(selectedUiThemePreset.id)} disabled={!selectedUiThemePreset || selectedUiThemePreset.builtIn}><Trash2 size={13} />Usuń własny preset</AppButton>
            <AppButton variant="secondary" size="sm" onClick={resetUiThemeToDefaults}><RotateCcw size={14} />Przywróć domyślne</AppButton>
          </div>

          {uiThemeContrastWarnings.length > 0 && <AppNotice variant="warning" title="Słaby kontrast">
            {uiThemeContrastWarnings.map((warning, index) => <div key={`${warning}-${index}`}>{warning}</div>)}
          </AppNotice>}
          {uiThemeNotice && <AppNotice variant="info">{uiThemeNotice}</AppNotice>}

          <div className="ui-theme-token-list">
            {UI_THEME_TOKEN_DEFINITIONS.map((token) => {
              const tokenValue = activeUiTheme?.tokens?.[token.key] ?? '#000000';
              return <div key={token.key} className="ui-theme-token-row">
                <div className="ui-theme-token-meta">
                  <strong>{token.label}</strong>
                  <small>{token.description}</small>
                </div>
                <input
                  type="color"
                  className="ui-theme-color-input"
                  value={tokenValue}
                  onChange={(event) => updateUiThemeToken(token.key, event.target.value)}
                  aria-label={`Wybierz kolor: ${token.label}`}
                />
                <AppInput
                  value={tokenValue}
                  onChange={(event) => updateUiThemeToken(token.key, event.target.value)}
                  placeholder="#000000"
                />
              </div>;
            })}
          </div>

          <div className="ui-theme-save-row">
            <AppInput value={uiThemeNameInput} onChange={(event) => setUiThemeNameInput(event.target.value)} placeholder="Nazwa nowego presetu (dla przycisku „Zapisz jako preset”)" />
          </div>
        </section>

        <section className="settings-config-card">
          <div className="settings-config-card-header">
            <div><p className="eyebrow">Dashboard</p><h3>Widoczność elementów</h3><p className="muted">Włącz elementy, które mają być widoczne na ekranie głównym.</p></div>
            <AppButton variant="secondary" size="sm" onClick={resetDashboardPreferences}><RotateCcw size={14} />Resetuj</AppButton>
          </div>
          <div className="settings-toggle-grid">
            {DASHBOARD_ITEMS.map((item) => <label className="settings-option-row" key={item.id}>
              <input type="checkbox" checked={dashboardSettings.visible[item.id] !== false} onChange={() => toggleDashboardItem(item.id)} />
              <span><strong>{item.label}</strong><small>Widoczność sekcji na Dashboardzie.</small></span>
            </label>)}
          </div>
        </section>

        <section className="settings-config-card">
          <div className="settings-config-card-header">
            <div><p className="eyebrow">Tabele</p><h3>Układ danych</h3><p className="muted">Preferencje pracy z tabelami w modułach FIXER WEB.</p></div>
          </div>
          <div className="settings-toggle-grid two-columns">
            <label className="settings-option-row"><input type="checkbox" checked={preferences.rememberColumnLayout} onChange={(event) => updatePreference('rememberColumnLayout', event.target.checked)} /><span><strong>Zapamiętuj układ kolumn</strong><small>Szerokości, kolejność i widoczność kolumn zostają zapisane lokalnie.</small></span></label>
            <label className="settings-option-row"><input type="checkbox" checked={preferences.rememberFilters} onChange={(event) => updatePreference('rememberFilters', event.target.checked)} /><span><strong>Zapamiętuj filtry tabel</strong><small>Filtry zostają przywrócone po powrocie do modułu.</small></span></label>
            <label className="firm-field settings-select-row">Domyślna liczba wierszy<AppSelect value={preferences.defaultRowsPerPage} onChange={(event) => updatePreference('defaultRowsPerPage', event.target.value)}><option>10</option><option>25</option><option>50</option><option>100</option></AppSelect></label>
          </div>
        </section>

        <section className="settings-config-card">
          <div className="settings-config-card-header">
            <div><p className="eyebrow">Okna i panele</p><h3>Zachowanie okien</h3><p className="muted">Ustawienia ergonomii pracy z modalami i panelami roboczymi.</p></div>
          </div>
          <div className="settings-toggle-grid two-columns">
            <label className="settings-option-row"><input type="checkbox" checked={preferences.rememberWindowSize} onChange={(event) => updatePreference('rememberWindowSize', event.target.checked)} /><span><strong>Zapamiętuj rozmiary okien</strong><small>Modalne okna otwierają się w ostatnio użytym rozmiarze.</small></span></label>
            <label className="settings-option-row"><input type="checkbox" checked={preferences.rememberWindowPosition} onChange={(event) => updatePreference('rememberWindowPosition', event.target.checked)} /><span><strong>Zapamiętuj pozycje okien</strong><small>Pozycje okien są zapisywane lokalnie dla wygodniejszej pracy.</small></span></label>
          </div>
        </section>

        <section className="settings-config-card">
          <div className="settings-config-card-header">
            <div><p className="eyebrow">Preferencje pracy</p><h3>Bezpieczeństwo operacji</h3><p className="muted">Domyślne zachowania programu przy czynnościach wymagających uwagi.</p></div>
          </div>
          <div className="settings-toggle-grid">
            <label className="settings-option-row"><input type="checkbox" checked={preferences.confirmDelete} onChange={(event) => updatePreference('confirmDelete', event.target.checked)} /><span><strong>Pokazuj potwierdzenie usunięcia</strong><small>Program poprosi o potwierdzenie przed usunięciem danych.</small></span></label>
          </div>
        </section>
      </div></InterfaceSettingsPanel>}

      {activeSection === 'dictionaries' && activeSubsInSection === 'clients' && <DictionariesSettingsPanel><div className="settings-pane-grid settings-pane-grid-wide compact-settings-grid">
        {renderClientTypesDictionaryEditor()}
        {renderReadonlyDictionaryEditor('Typy klientów', 'Wartości systemowe używane w kartotece klienta.', ['Firma', 'Osoba prywatna'])}
        <div className="settings-card compact-admin-card">
          <h3>Widok klientów</h3>
          <p className="muted">Domyślne filtry, kolumny i pola dodatkowe będą konfigurowane w tej sekcji.</p>
        </div>
      </div></DictionariesSettingsPanel>}

      {activeSection === 'dictionaries' && activeSubsInSection === 'equipment' && <DictionariesSettingsPanel><div className="settings-pane-grid settings-pane-grid-wide compact-settings-grid">
        {renderEquipmentDictionaryEditor('category', 'Kategorie sprzętu', 'Lista kategorii widoczna w karcie sprzętu.', equipmentCategories, 'np. Reżyserka, Statyw, Recorder')}
        {renderEquipmentDictionaryEditor('status', 'Statusy sprzętu', 'Lista statusów widoczna w karcie sprzętu i tabelach.', equipmentStatuses, 'np. Do sprawdzenia, Zarezerwowany')}
        {renderEquipmentDictionaryEditor('location', 'Lokalizacje sprzętu', 'Lista lokalizacji widoczna w karcie sprzętu i wyborze sprzętu.', equipmentLocations, 'np. Magazyn A')}
        {renderConfigDictionaryEditor('equipmentConditions', 'Stany techniczne sprzętu', 'Lista stanów technicznych widoczna w karcie sprzętu.')}
      </div></DictionariesSettingsPanel>}

      {activeSection === 'dictionaries' && activeSubsInSection === 'service' && <DictionariesSettingsPanel><div className="settings-pane-grid settings-pane-grid-wide compact-settings-grid">
        {renderServiceDictionaryEditor(SERVICE_DICTIONARY_TYPES.status, 'Statusy zleceń', 'Lista statusów widoczna w module Serwis, filtrach i kartotece.', 'np. Czeka na klienta')}
        {renderServiceDictionaryEditor(SERVICE_DICTIONARY_TYPES.priority, 'Priorytety', 'Lista priorytetów widoczna w kartotece zlecenia.', 'np. Ekspresowy')}
        {renderServiceDictionaryEditor(SERVICE_DICTIONARY_TYPES.customerDeviceCategory, 'Kategorie sprzętu klienta', 'Kategorie używane przy sprzęcie przyjmowanym do serwisu.', 'np. Monitor, Rekorder')}
        {renderServiceDictionaryEditor(SERVICE_DICTIONARY_TYPES.intakeCondition, 'Stany przyjęcia', 'Lista stanów sprzętu klienta przy przyjęciu do serwisu.', 'np. Porysowany')}
        {renderServiceDictionaryEditor(SERVICE_DICTIONARY_TYPES.externalService, 'Serwisy zewnętrzne', 'Lista serwisów, do których może zostać przekazany sprzęt klienta.', 'np. Sony Polska')}
        {renderServiceDictionaryEditor(SERVICE_DICTIONARY_TYPES.progressTemplate, 'Szablony postępów', 'Szybkie wpisy dodawane w historii zgłoszenia.', 'np. Klient poinformowany')}
      </div></DictionariesSettingsPanel>}

      {activeSection === 'documents' && <DocumentsSettingsPanel><div className="documents-settings-pane documents-workspace documents-v2-workspace">
        <aside className="documents-nav-panel documents-v2-nav">
          {[
            ['templates', 'Szablony dokumentów', 'Umowy, protokoły, raporty i dokumenty wewnętrzne'],
            ['numbering', 'Numeracja dokumentów', 'Formaty numerów dla każdego typu dokumentu'],
            ['company', 'Logo i dane firmy', 'Jedno źródło danych dla wszystkich dokumentów'],
            ['designer', 'Projektant dokumentów', 'Edytor pełnoekranowy A4: układ i elementy'],
            ['archive', 'Archiwum PDF', 'Lista wygenerowanych dokumentów PDF']
          ].map(([id, label, description]) => <button key={id} type="button" className={`documents-nav-item ${(isDocumentsMode ? documentsMainSection : activeDocumentPanel) === id ? 'active' : ''}`} onClick={() => openDocumentPanel(id)}>
            <strong>{label}</strong><small>{description}</small>
          </button>)}
        </aside>
        <div className="documents-detail-panel documents-v2-detail">
          {documentSettingsNotice && <div className="notice firm-save-notice settings-inline-notice">{documentSettingsNotice}</div>}

          {effectiveDocumentPanel === 'company' && <section className="settings-config-card documents-config-card">
            <div className="settings-config-card-header">
              <div><p className="eyebrow">Dokumenty</p><h3>Logo i dane firmy</h3><p className="muted">Zmiana tutaj aktualizuje wszystkie dokumenty i podglądy PDF.</p></div>
              <AppButton variant="primary" size="sm" onClick={() => { saveCompanySettings(); saveDocumentSettingsState(); }}><Save size={14} />Zapisz</AppButton>
            </div>
            <div className="documents-profile-grid">
              <div className="settings-form-section">
                <div className="settings-section-title"><h4>Dane firmy</h4><p className="muted">Centralne dane używane w każdym dokumencie.</p></div>
                <div className="settings-field-grid two-columns">
                  <label className="firm-field field-wide">Nazwa firmy<AppInput value={companyProfile.name} onChange={(event) => updateCompanyProfile('name', event.target.value)} /></label>
                  <label className="firm-field field-wide">Nazwa na dokumentach<AppInput value={companyProfile.legalName} onChange={(event) => updateCompanyProfile('legalName', event.target.value)} /></label>
                  <label className="firm-field">NIP<AppInput value={companyProfile.nip} onChange={(event) => updateCompanyProfile('nip', event.target.value)} /></label>
                  <label className="firm-field">Telefon<AppInput value={companyProfile.phone} onChange={(event) => updateCompanyProfile('phone', event.target.value)} /></label>
                  <label className="firm-field">E-mail<AppInput value={companyProfile.email} onChange={(event) => updateCompanyProfile('email', event.target.value)} /></label>
                  <label className="firm-field">WWW<AppInput value={companyProfile.website} onChange={(event) => updateCompanyProfile('website', event.target.value)} /></label>
                  <label className="firm-field">Ulica<AppInput value={companyProfile.street} onChange={(event) => updateCompanyProfile('street', event.target.value)} /></label>
                  <label className="firm-field">Nr budynku<AppInput value={companyProfile.buildingNumber} onChange={(event) => updateCompanyProfile('buildingNumber', event.target.value)} /></label>
                  <label className="firm-field">Kod pocztowy<AppInput value={companyProfile.postalCode} onChange={(event) => updateCompanyProfile('postalCode', event.target.value)} /></label>
                  <label className="firm-field">Miasto<AppInput value={companyProfile.city} onChange={(event) => updateCompanyProfile('city', event.target.value)} /></label>
                  <label className="firm-field field-wide">Nagłówek dokumentów<AppTextarea value={companyProfile.documentHeader} onChange={(event) => updateCompanyProfile('documentHeader', event.target.value)} rows={2} /></label>
                  <label className="firm-field field-wide">Stopka dokumentów<AppTextarea value={companyProfile.documentFooter} onChange={(event) => updateCompanyProfile('documentFooter', event.target.value)} rows={2} /></label>
                </div>
              </div>
              <div className="settings-form-section">
                <div className="settings-section-title"><h4>Logo firmy</h4><p className="muted">Logo działa jak obiekt graficzny w projektancie.</p></div>
                <div className="company-logo-row-v2">
                  <div className="firm-logo-preview compact">
                    {companyProfile.logoDataUrl ? <img src={companyProfile.logoDataUrl} alt="Logo firmy" /> : <span>Logo</span>}
                  </div>
                  <div className="firm-logo-actions">
                    <label className="app-button app-button-secondary app-button-sm file-button"><FolderOpen size={14} />Dodaj / zmień<input type="file" accept="image/*" onChange={handleCompanyLogoUpload} /></label>
                    <AppButton variant="secondary" size="sm" onClick={removeCompanyLogo} disabled={!companyProfile.logoDataUrl}>Usuń</AppButton>
                    <label className="settings-check compact-check"><input type="checkbox" checked={companyProfile.showLogoOnDocuments !== false} onChange={(event) => updateCompanyProfile('showLogoOnDocuments', event.target.checked)} />Pokazuj na dokumentach</label>
                  </div>
                </div>
              </div>
            </div>
          </section>}

          {effectiveDocumentPanel === 'numbering' && <section className="settings-config-card documents-config-card">
            <div className="settings-config-card-header">
              <div><p className="eyebrow">Dokumenty</p><h3>Numeracja</h3><p className="muted">Aktualny mechanizm generowania numerów pozostaje bez zmian. Puste prefiksy i formaty nie zostaną zapisane.</p></div>
              <div className="settings-action-row">
                <AppButton variant="secondary" size="sm" onClick={resetDocumentNumberingState}><RotateCcw size={14} />Domyślne</AppButton>
                <AppButton variant="primary" size="sm" onClick={saveDocumentSettingsState}><Save size={14} />Zapisz</AppButton>
              </div>
            </div>
            <div className="document-numbering-list documents-numbering-v2">
              {documentNumberingRows.map((row) => {
                const prefixEmpty = !String(row.value.prefix ?? '').trim();
                const formatEmpty = !String(row.value.format ?? '').trim();
                return <div className={`document-numbering-row ${prefixEmpty || formatEmpty ? 'invalid' : ''}`} key={row.key}>
                  <strong>{row.label}</strong>
                  <label className="firm-field">Prefiks<AppInput value={row.value.prefix} onChange={(event) => row.onChange(row.key, 'prefix', event.target.value)} />{prefixEmpty && <small className="settings-field-error">Prefiks jest wymagany.</small>}</label>
                  <label className="firm-field">Format<AppSelect value={row.value.format} onChange={(event) => row.onChange(row.key, 'format', event.target.value)}>{RENTAL_NUMBER_FORMATS.map((format) => <option key={format.value} value={format.value}>{format.label}</option>)}</AppSelect>{formatEmpty && <small className="settings-field-error">Format jest wymagany.</small>}</label>
                  <label className="firm-field">Cyfry<AppInput type="number" min="1" value={row.value.padding ?? 3} onChange={(event) => row.onChange(row.key, 'padding', event.target.value)} /></label>
                  <span className="document-number-preview"><small>Przykład</small>{row.preview}</span>
                </div>;
              })}
            </div>
          </section>}

          {effectiveDocumentPanel === 'agreement' && <section className={`settings-config-card documents-config-card documents-templates-card ${documentTemplateViewMode === 'edit' ? 'documents-templates-card--edit' : 'documents-templates-card--list'}`}>
            {documentTemplateViewMode === 'list' ? <>
              <div className="settings-config-card-header">
                <div>
                  <p className="eyebrow">Szablony dokumentów</p>
                  <h3>Lista szablonów</h3>
                  <p className="muted">Wybierz szablon, aby go edytować, podejrzeć lub przywrócić domyślną wersję.</p>
                </div>
                <div className="settings-action-row">
                  <AppButton variant="secondary" size="sm" onClick={resetAllDocumentTemplates}><RotateCcw size={13} />Przywróć wszystkie domyślne</AppButton>
                  <AppButton variant="secondary" size="sm" onClick={exportDocumentTemplatesJson}><Download size={13} />Eksport JSON</AppButton>
                  <AppButton variant="secondary" size="sm" onClick={() => documentTemplateImportInputRef.current?.click()}><FolderOpen size={13} />Import JSON</AppButton>
                  <input ref={documentTemplateImportInputRef} type="file" accept="application/json,.json" onChange={importDocumentTemplatesJson} className="backup-file-input" />
                </div>
              </div>
              <div className="data-table-shell documents-template-catalog">
                <table className="data-table">
                  <thead><tr><th>LP</th><th>Nazwa</th><th>Typ</th><th>Ostatnia modyfikacja</th><th>Akcje</th></tr></thead>
                  <tbody>
                    {DOCUMENT_TEMPLATE_TYPES.map((type, index) => {
                      const isDirty = templateDirtyByType[type.id];
                      return <tr key={type.id}>
                        <td>{index + 1}</td>
                        <td>{type.label}</td>
                        <td>{type.id}</td>
                        <td>{isDirty ? 'Niezapisane zmiany' : '—'}</td>
                        <td>
                          <div className="settings-action-row">
                            <AppButton variant="secondary" size="sm" onClick={() => openTemplateEditor(type.id)}>Edytuj</AppButton>
                            <AppButton variant="secondary" size="sm" onClick={() => { setActiveDocumentTemplateType(type.id); setAgreementPreviewOpen(true); }}>Podgląd</AppButton>
                            <AppButton variant="secondary" size="sm" onClick={() => {
                              const source = normalizeSharedDocumentTemplate(documentTemplateLibrary[type.id], type.defaultTemplate);
                              setDocumentTemplateLibrary((current) => ({
                                ...current,
                                [type.id]: normalizeSharedDocumentTemplate({
                                  ...source,
                                  title: `${source.title} (kopia)`
                                }, type.defaultTemplate)
                              }));
                              setDocumentSettingsNotice(`Utworzono kopię szablonu „${type.label}”.`);
                            }}>Duplikuj</AppButton>
                            <AppButton variant="secondary" size="sm" onClick={() => {
                              setDocumentTemplateLibrary((current) => ({ ...current, [type.id]: normalizeSharedDocumentTemplate(type.defaultTemplate, type.defaultTemplate) }));
                              setDocumentSettingsNotice(`Przywrócono domyślny szablon „${type.label}”. Kliknij „Zapisz szablon” w edycji, aby zatwierdzić.`);
                            }}>Przywróć domyślny</AppButton>
                          </div>
                        </td>
                      </tr>;
                    })}
                  </tbody>
                </table>
              </div>
            </> : <>
              <div className="settings-config-card-header">
                <div>
                  <p className="eyebrow">Edycja szablonu</p>
                  <h3>{currentTemplateType.label}</h3>
                  <p className="muted">{currentTemplateType.description}</p>
                  {currentTemplateHasUnsavedChanges && <p className="document-template-unsaved-indicator">● Niezapisane zmiany</p>}
                </div>
                <div className="settings-action-row">
                  <AppButton variant="secondary" size="sm" onClick={requestReturnToTemplateList}><ChevronLeft size={14} />Wróć do listy</AppButton>
                  <AppButton variant="secondary" size="sm" onClick={resetCurrentDocumentTemplate}><RotateCcw size={13} />Przywróć domyślny</AppButton>
                  <AppButton variant="primary" size="sm" onClick={() => saveDocumentTemplateDrafts('Zapisano szablon dokumentu.')} disabled={!currentTemplateHasUnsavedChanges}><Save size={13} />Zapisz szablon</AppButton>
                </div>
              </div>

              <div className="document-template-editor-layout">
                <div className="document-template-editor-toolbar">
                  <label className="firm-field document-template-type-picker">
                    Typ dokumentu
                    <AppSelect value={activeDocumentTemplateType} onChange={(event) => requestTemplateTypeSwitch(event.target.value)}>
                      {DOCUMENT_TEMPLATE_TYPES.map((type) => <option key={type.id} value={type.id}>{type.label}</option>)}
                    </AppSelect>
                  </label>
                </div>

                <div className="agreement-subtabs">
                  {[
                    ['content', 'Treść'],
                    ['sections', 'Sekcje'],
                    ['columns', 'Kolumny tabel'],
                    ['variables', 'Zmienne'],
                    ['preview', 'Podgląd']
                  ].map(([id, label]) => <button key={id} type="button" className={`agreement-subtab ${activeAgreementTab === id ? 'active' : ''}`} onClick={() => setActiveAgreementTab(id)}>{label}</button>)}
                </div>

                <div className="document-template-editor-scroll">
                  {activeAgreementTab === 'content' && <div className="document-section-content compact-document-form">
                    <div className="settings-form-section">
                      <label className="firm-field">Tytuł dokumentu<AppInput value={currentDocumentTemplate.title} onChange={(event) => updateCurrentDocumentTemplate((template) => ({ ...template, title: event.target.value }))} /></label>
                      <label className="firm-field">Nagłówek<AppTextarea value={currentDocumentTemplate.headerText} onChange={(event) => updateCurrentDocumentTemplate((template) => ({ ...template, headerText: event.target.value }))} rows={3} /></label>
                      <label className="firm-field">Tekst wstępny<AppTextarea value={currentDocumentTemplate.introText} onChange={(event) => updateCurrentDocumentTemplate((template) => ({ ...template, introText: event.target.value }))} rows={3} /></label>
                      <label className="firm-field">Sekcja „Wydający”<AppTextarea value={currentDocumentTemplate.issuerText} onChange={(event) => updateCurrentDocumentTemplate((template) => ({ ...template, issuerText: event.target.value }))} rows={4} /></label>
                      <label className="firm-field">Sekcja „Biorący”<AppTextarea value={currentDocumentTemplate.borrowerText} onChange={(event) => updateCurrentDocumentTemplate((template) => ({ ...template, borrowerText: event.target.value }))} rows={4} /></label>
                      <label className="firm-field">Treść warunków<AppTextarea value={currentDocumentTemplate.termsText} onChange={(event) => updateCurrentDocumentTemplate((template) => ({ ...template, termsText: event.target.value }))} rows={6} /></label>
                      <label className="firm-field">Stopka<AppTextarea value={currentDocumentTemplate.footerText} onChange={(event) => updateCurrentDocumentTemplate((template) => ({ ...template, footerText: event.target.value }))} rows={3} /></label>
                      <div className="settings-field-grid two-columns">
                        <label className="firm-field">Podpis lewy<AppInput value={currentDocumentTemplate.signatureIssuer} onChange={(event) => updateCurrentDocumentTemplate((template) => ({ ...template, signatureIssuer: event.target.value }))} /></label>
                        <label className="firm-field">Podpis prawy<AppInput value={currentDocumentTemplate.signatureBorrower} onChange={(event) => updateCurrentDocumentTemplate((template) => ({ ...template, signatureBorrower: event.target.value }))} /></label>
                      </div>
                    </div>
                  </div>}

                  {activeAgreementTab === 'sections' && <div className="document-section-content">
                    <div className="document-column-list compact-column-list">
                      {(currentDocumentTemplate.sectionOrder ?? DEFAULT_SHARED_TEMPLATE_SECTION_ORDER).map((sectionId, index) => {
                        const labels = {
                          header: 'Nagłówek',
                          intro: 'Wstęp',
                          issuer: 'Wydający',
                          borrower: 'Biorący',
                          period: 'Okres',
                          equipment: 'Tabela pozycji',
                          terms: 'Warunki',
                          signatures: 'Podpisy',
                          footer: 'Stopka'
                        };
                        const active = currentDocumentTemplate.sectionVisibility?.[sectionId] !== false;
                        return <div key={sectionId} className="document-column-row compact">
                          <label className="settings-check"><input type="checkbox" checked={active} onChange={() => updateCurrentDocumentTemplate((template) => ({ ...template, sectionVisibility: { ...template.sectionVisibility, [sectionId]: !active } }))} /><span>{labels[sectionId] ?? sectionId}</span></label>
                          <div className="dictionary-row-actions dictionary-icon-actions">
                            <button type="button" className="dictionary-icon-button" onClick={() => updateCurrentDocumentTemplate((template) => {
                              const order = [...template.sectionOrder];
                              const source = order.indexOf(sectionId);
                              const target = source - 1;
                              if (source < 0 || target < 0) return template;
                              const [moved] = order.splice(source, 1);
                              order.splice(target, 0, moved);
                              return { ...template, sectionOrder: order };
                            })} disabled={index === 0} aria-label="Przenieś wyżej"><ArrowUp size={14} /></button>
                            <button type="button" className="dictionary-icon-button" onClick={() => updateCurrentDocumentTemplate((template) => {
                              const order = [...template.sectionOrder];
                              const source = order.indexOf(sectionId);
                              const target = source + 1;
                              if (source < 0 || target >= order.length) return template;
                              const [moved] = order.splice(source, 1);
                              order.splice(target, 0, moved);
                              return { ...template, sectionOrder: order };
                            })} disabled={index === (currentDocumentTemplate.sectionOrder ?? DEFAULT_SHARED_TEMPLATE_SECTION_ORDER).length - 1} aria-label="Przenieś niżej"><ArrowDown size={14} /></button>
                          </div>
                        </div>;
                      })}
                    </div>
                  </div>}

                  {activeAgreementTab === 'columns' && <div className="document-section-content">
                    <div className="documents-subheader">
                      <strong>Kolumny tabeli</strong>
                    </div>
                    <div className="document-column-list compact-column-list">
                      {(currentDocumentTemplate.columns ?? []).map((column, index) => <div key={column.key} className="document-column-row compact">
                        <label className="settings-check"><input type="checkbox" checked={column.enabled !== false} onChange={() => updateCurrentDocumentTemplate((template) => ({ ...template, columns: template.columns.map((item) => item.key === column.key ? { ...item, enabled: item.enabled === false } : item) }))} /><span>{column.label}</span></label>
                        <div className="dictionary-row-actions dictionary-icon-actions">
                          <button type="button" className="dictionary-icon-button" onClick={() => updateCurrentDocumentTemplate((template) => {
                            const list = [...template.columns];
                            const source = list.findIndex((item) => item.key === column.key);
                            const target = source - 1;
                            if (source < 0 || target < 0) return template;
                            const [moved] = list.splice(source, 1);
                            list.splice(target, 0, moved);
                            return { ...template, columns: list };
                          })} disabled={index === 0} aria-label="Przenieś wyżej"><ArrowUp size={14} /></button>
                          <button type="button" className="dictionary-icon-button" onClick={() => updateCurrentDocumentTemplate((template) => {
                            const list = [...template.columns];
                            const source = list.findIndex((item) => item.key === column.key);
                            const target = source + 1;
                            if (source < 0 || target >= list.length) return template;
                            const [moved] = list.splice(source, 1);
                            list.splice(target, 0, moved);
                            return { ...template, columns: list };
                          })} disabled={index === currentDocumentTemplate.columns.length - 1} aria-label="Przenieś niżej"><ArrowDown size={14} /></button>
                        </div>
                      </div>)}
                    </div>
                  </div>}

                  {activeAgreementTab === 'variables' && <div className="document-section-content">
                    <div className="documents-subheader">
                      <strong>Dostępne zmienne</strong>
                      {copiedTemplateVariable && <span className="muted">Skopiowano: {copiedTemplateVariable}</span>}
                    </div>
                    <div className="document-column-list compact-column-list">
                      {currentTemplateType.variables.map((variable) => <button key={variable.key} type="button" className="backup-action-button template-variable-button" onClick={() => copyAgreementVariable(variable.key)}>
                        <span><strong>{variable.key}</strong><small>{variable.description}</small></span>
                      </button>)}
                    </div>
                  </div>}

                  {activeAgreementTab === 'preview' && <div className="document-section-content document-preview-tab">
                    <div className="documents-card-header-row">
                      <div><strong>Podgląd i eksport</strong><p className="muted">Podgląd A4 w osobnym oknie z zoomem i pełną skalą.</p></div>
                      <div className="settings-action-row">
                        <AppButton variant="secondary" size="sm" onClick={() => setAgreementPreviewOpen(true)}><FileText size={14} />Podgląd</AppButton>
                        <AppButton variant="secondary" size="sm" onClick={() => { printHtmlInIframe(currentDocumentTemplatePreviewHtml); addPdfArchiveRow({ type: currentTemplateType.label, number: templatePreviewContext.documentNumber, relation: 'Szablony dokumentów' }); }}><FileText size={14} />Generuj PDF</AppButton>
                        <AppButton variant="secondary" size="sm" onClick={() => { printHtmlInIframe(currentDocumentTemplatePreviewHtml); addPdfArchiveRow({ type: currentTemplateType.label, number: templatePreviewContext.documentNumber, relation: 'Szablony dokumentów' }); }}><Printer size={14} />Drukuj</AppButton>
                        <AppButton variant="primary" size="sm" onClick={() => { printHtmlInIframe(currentDocumentTemplatePreviewHtml); addPdfArchiveRow({ type: currentTemplateType.label, number: templatePreviewContext.documentNumber, relation: 'Szablony dokumentów' }); }}><Download size={14} />Pobierz</AppButton>
                      </div>
                    </div>
                  </div>}
                </div>
              </div>
            </>}

            {agreementPreviewOpen && <DocumentPreviewModal
              title={`Podgląd: ${currentTemplateType.label}`}
              html={currentDocumentTemplatePreviewHtml}
              onClose={() => setAgreementPreviewOpen(false)}
              onGeneratePdf={() => { printHtmlInIframe(currentDocumentTemplatePreviewHtml); addPdfArchiveRow({ type: currentTemplateType.label, number: templatePreviewContext.documentNumber, relation: 'Podgląd szablonu' }); }}
              onPrint={() => { printHtmlInIframe(currentDocumentTemplatePreviewHtml); addPdfArchiveRow({ type: currentTemplateType.label, number: templatePreviewContext.documentNumber, relation: 'Podgląd szablonu' }); }}
              onDownload={() => { printHtmlInIframe(currentDocumentTemplatePreviewHtml); addPdfArchiveRow({ type: currentTemplateType.label, number: templatePreviewContext.documentNumber, relation: 'Podgląd szablonu' }); }}
            />}
          </section>}

          {effectiveDocumentPanel === 'designer' && <section className="settings-config-card documents-config-card documents-designer-launch-card">
            <div className="settings-config-card-header">
              <div><p className="eyebrow">Projektant dokumentów</p><h3>Projektant A4</h3><p className="muted">Pełnoekranowy edytor z kartką A4 na środku, biblioteką elementów i panelem właściwości. Dokument jest zawsze głównym obszarem pracy.</p></div>
              <AppButton variant="primary" size="sm" onClick={() => setDocumentsDesignerFullscreen(true)}><FileText size={14} />Otwórz projektant</AppButton>
            </div>
          </section>}

          {effectiveDocumentPanel === 'archive' && <section className="settings-config-card documents-config-card">
            <div className="settings-config-card-header">
              <div><p className="eyebrow">Dokumenty</p><h3>Archiwum PDF</h3><p className="muted">Historia wygenerowanych dokumentów PDF z modułu Dokumenty.</p></div>
            </div>
            <div className="data-table-shell">
              <table className="data-table">
                <thead><tr><th>LP</th><th>Typ dokumentu</th><th>Numer</th><th>Data utworzenia</th><th>Powiązanie</th><th>Utworzył</th><th>Akcje</th></tr></thead>
                <tbody>
                  {pdfArchiveRows.length === 0 && <tr><td colSpan="7">Archiwum jest puste. Dodawanie wpisów następuje przy generowaniu PDF w module Dokumenty.</td></tr>}
                  {pdfArchiveRows.map((row, index) => <tr key={row.id}>
                    <td>{index + 1}</td>
                    <td>{row.type}</td>
                    <td>{row.number}</td>
                    <td>{new Date(row.createdAt).toLocaleString('pl-PL')}</td>
                    <td>{row.relation}</td>
                    <td>{row.createdBy}</td>
                    <td>
                      <div className="settings-action-row">
                        <AppButton variant="secondary" size="sm" onClick={() => setDocumentSettingsNotice('Podgląd PDF dla wpisów archiwalnych będzie dostępny po podłączeniu trwałego pliku.')}>Podgląd PDF</AppButton>
                        <AppButton variant="secondary" size="sm" onClick={() => setDocumentSettingsNotice('Pobieranie PDF dla wpisów archiwalnych będzie dostępne po podłączeniu trwałego pliku.')}>Pobierz PDF</AppButton>
                        <AppButton variant="danger" size="sm" onClick={() => deletePdfArchiveRow(row.id)}>Usuń</AppButton>
                      </div>
                    </td>
                  </tr>)}
                </tbody>
              </table>
            </div>
          </section>}
        </div>
        {documentsDesignerFullscreen && <div className="documents-designer-fullscreen">
          <DocumentDesignerPanel
            fullscreen
            onClose={() => setDocumentsDesignerFullscreen(false)}
            companyProfile={companyProfile}
            previewContext={templatePreviewContext}
            onNotice={setDocumentSettingsNotice}
            onGeneratePdf={addPdfArchiveRow}
          />
        </div>}
      </div></DocumentsSettingsPanel>}

      {activeSection === 'system' && <SystemSettingsPanel><div className="documents-settings-pane documents-workspace documents-v2-workspace settings-subsystem-workspace">
        <aside className="documents-nav-panel documents-v2-nav settings-subsystem-nav">
          {[
            ['backup', 'Backup', 'Pełna kopia danych'],
            ['restore', 'Restore', 'Przywracanie z pliku'],
            ['csv', 'Eksport CSV', 'Szybkie eksporty tabel'],
            ['diagnostics', 'Diagnostyka', 'Czytelny stan systemu']
          ].map(([id, label, description]) => <button key={id} type="button" className={`documents-nav-item ${activeSystemPanel === id ? 'active' : ''}`} onClick={() => setActiveSystemPanel(id)}>
            <strong>{label}</strong><small>{description}</small>
          </button>)}
        </aside>
        <div className="documents-detail-panel documents-v2-detail settings-subsystem-detail">
          {backupNotice && <div className="notice firm-save-notice settings-inline-notice">{backupNotice}</div>}
          <input ref={restoreInputRef} type="file" accept="application/json,.json" onChange={handleRestoreFile} className="backup-file-input" />

          {activeSystemPanel === 'backup' && <section className="settings-config-card system-config-card">
            <div className="settings-config-card-header">
              <div><p className="eyebrow">System</p><h3>Backup</h3><p className="muted">Pełna kopia danych, relacji i ustawień programu do jednego pliku JSON.</p></div>
              <AppButton variant="primary" size="sm" onClick={() => createBackupFile()} disabled={backupBusy}><Download size={15} />Utwórz backup</AppButton>
            </div>
            <div className="system-action-grid">
              <button type="button" className="backup-action-button primary" onClick={() => createBackupFile()} disabled={backupBusy}>
                <Download size={18} />
                <span><strong>Utwórz pełną kopię</strong><small>Plik obejmuje dane aplikacji, relacje oraz ustawienia lokalne.</small></span>
              </button>
              <div className="system-info-panel">
                <strong>Zakres kopii</strong>
                <p className="muted">Backup obejmuje wszystkie aktualnie obsługiwane obszary danych w FIXER WEB.</p>
                <div className="backup-scope-list compact-scope-list">
                  {BACKUP_INCLUDED_TABLES.map((table) => <span key={table}>{formatBackupTableLabel(table)}</span>)}
                </div>
              </div>
            </div>
          </section>}

          {activeSystemPanel === 'restore' && <section className="settings-config-card system-config-card">
            <div className="settings-config-card-header">
              <div><p className="eyebrow">System</p><h3>Restore</h3><p className="muted">Przywracanie danych z pliku backupu. Przed nadpisaniem danych pojawi się potwierdzenie.</p></div>
              <AppButton variant="secondary" size="sm" onClick={() => restoreInputRef.current?.click()} disabled={backupBusy}><FolderOpen size={15} />Wybierz plik</AppButton>
            </div>
            <div className="system-action-grid one-column">
              <button type="button" className="backup-action-button" onClick={() => restoreInputRef.current?.click()} disabled={backupBusy}>
                <FolderOpen size={18} />
                <span><strong>Przywróć z backupu</strong><small>Po wybraniu pliku system pokaże podsumowanie i poprosi o potwierdzenie importu.</small></span>
              </button>
              <div className="system-warning-panel">
                <strong>Bezpieczny import</strong>
                <p>Restore może zastąpić obecne dane. Istniejący modal potwierdzenia pozostaje bez zmian i blokuje przypadkowe nadpisanie.</p>
              </div>
            </div>
          </section>}

          {activeSystemPanel === 'csv' && <section className="settings-config-card system-config-card">
            <div className="settings-config-card-header">
              <div><p className="eyebrow">System</p><h3>Eksport CSV</h3><p className="muted">Szybki eksport danych operacyjnych do arkuszy. Format eksportu pozostaje bez zmian.</p></div>
            </div>
            <div className="backup-csv-grid system-csv-grid">
              <AppButton variant="secondary" size="sm" onClick={() => exportBackupCsv('clients')} disabled={backupBusy}>Klienci CSV</AppButton>
              <AppButton variant="secondary" size="sm" onClick={() => exportBackupCsv('equipment')} disabled={backupBusy}>Sprzęt CSV</AppButton>
              <AppButton variant="secondary" size="sm" onClick={() => exportBackupCsv('rentals')} disabled={backupBusy}>Wypożyczenia CSV</AppButton>
              <AppButton variant="secondary" size="sm" onClick={() => exportBackupCsv('service')} disabled={backupBusy}>Serwis CSV</AppButton>
              <AppButton variant="secondary" size="sm" onClick={() => exportBackupCsv('organizer')} disabled={backupBusy}>Zadania CSV</AppButton>
            </div>
          </section>}

          {activeSystemPanel === 'diagnostics' && <section className="settings-config-card system-config-card">
            <div className="settings-config-card-header">
              <div><p className="eyebrow">System</p><h3>Diagnostyka</h3><p className="muted">Krótki, użytkowy przegląd konfiguracji administracyjnej bez technicznych tabel.</p></div>
            </div>
            <div className="system-diagnostics-grid">
              <div className="system-diagnostic-row"><strong>Backup</strong><span>{BACKUP_INCLUDED_TABLES.length} obszarów danych w pełnej kopii</span></div>
              <div className="system-diagnostic-row"><strong>Eksport CSV</strong><span>Klienci, Sprzęt, Wypożyczenia, Serwis i Zadania</span></div>
              <div className="system-diagnostic-row"><strong>Kalendarz</strong><span>{CALENDAR_SOURCES.length} źródeł skonfigurowanych w Integracjach</span></div>
              <div className="system-diagnostic-row"><strong>Ustawienia lokalne</strong><span>Preferencje interfejsu i dokumentów są przechowywane lokalnie zgodnie z dotychczasowym mechanizmem.</span></div>
            </div>
          </section>}
        </div>
      </div></SystemSettingsPanel>}

      {activeSection === 'dictionaries' && activeSubsInSection === 'rentals' && <DictionariesSettingsPanel><div className="settings-pane-grid settings-pane-grid-wide compact-settings-grid">
        {renderConfigDictionaryEditor('rentalTypes', 'Typy wypożyczeń', 'Lista typów widoczna w kartotece wypożyczenia.')}
        {renderConfigDictionaryEditor('returnConditions', 'Stany zwrotu', 'Lista stanów widoczna w oknie rejestracji zwrotu.')}
        {renderReadonlyDictionaryEditor('Statusy wypożyczeń', 'Statusy systemowe widoczne w tabelach i na Dashboardzie.', ['Aktywne', 'Częściowo zwrócone', 'Zwrócone', 'Po terminie'], { supportsColor: true })}
      </div></DictionariesSettingsPanel>}

      {activeSection === 'dictionaries' && activeSubsInSection === 'projects' && <DictionariesSettingsPanel><div className="settings-pane-grid settings-pane-grid-wide compact-settings-grid">
        {renderOrganizerCategoryDictionaryEditor()}
        {renderReadonlyDictionaryEditor('Statusy zadań', 'Statusy systemowe prostych zadań w module Zadania i projekty.', ORGANIZER_TASK_STATUSES, { supportsColor: true })}
        {renderReadonlyDictionaryEditor('Priorytety zadań i projektów', 'Priorytety systemowe używane przy zadaniach prostych, projektach i zadaniach projektowych.', [...new Set([...ORGANIZER_TASK_PRIORITIES, ...PROJECT_PRIORITIES, ...PROJECT_TASK_PRIORITIES])])}
        {renderReadonlyDictionaryEditor('Statusy projektów', 'Statusy systemowe projektów w module Zadania i projekty.', PROJECT_STATUSES, { supportsColor: true })}
        {renderReadonlyDictionaryEditor('Statusy zadań projektów', 'Statusy systemowe zadań wewnątrz projektów.', PROJECT_TASK_STATUSES, { supportsColor: true })}
        <div className="settings-card compact-admin-card">
          <h3>Numeracja projektów</h3>
          <p className="muted">Numerację projektów można skonfigurować w sekcji <strong>Dokumenty → Numeracja</strong>.</p>
        </div>
      </div></DictionariesSettingsPanel>}

      {activeSection === 'integrations' && <IntegrationsSettingsPanel><div className="documents-settings-pane documents-workspace documents-v2-workspace settings-subsystem-workspace">
        <aside className="documents-nav-panel documents-v2-nav settings-subsystem-nav">
          {[
            ['calendar', 'Kalendarz', 'Źródła, kolory i widoczność']
          ].map(([id, label, description]) => <button key={id} type="button" className={`documents-nav-item ${activeIntegrationPanel === id ? 'active' : ''}`} onClick={() => setActiveIntegrationPanel(id)}>
            <strong>{label}</strong><small>{description}</small>
          </button>)}
        </aside>
        <div className="documents-detail-panel documents-v2-detail settings-subsystem-detail">
          {activeIntegrationPanel === 'calendar' && <section className="settings-config-card integration-config-card">
            <div className="settings-config-card-header">
              <div><p className="eyebrow">Integracje</p><h3>Kalendarz</h3><p className="muted">Domyślna widoczność i kolor każdego źródła kalendarza. Ustawienia są zapisywane dotychczasowym mechanizmem.</p></div>
              <AppButton variant="secondary" size="sm" onClick={resetCalendarSourceSettings}><RotateCcw size={14} />Domyślne</AppButton>
            </div>
            <div className="calendar-source-settings-grid integrations-calendar-grid">
              {CALENDAR_SOURCES.map((source) => {
                const settings = calendarSourceSettings[source.id] ?? {};
                const color = settings.color || DEFAULT_CALENDAR_SOURCE_COLORS[source.id];
                return <div className="calendar-source-settings-card-item integration-source-card" key={source.id}>
                  <div className="calendar-source-preview" style={{ borderColor: color }}>
                    <span style={{ background: color }} />
                    <strong>{source.label}</strong>
                  </div>
                  <label className="settings-check calendar-source-default-toggle">
                    <input type="checkbox" checked={settings.enabledByDefault !== false} onChange={(event) => updateCalendarSourceSetting(source.id, 'enabledByDefault', event.target.checked)} />
                    Widoczne domyślnie
                  </label>
                  <label className="calendar-source-color-field">
                    Kolor źródła
                    <AppInput type="color" value={color} onChange={(event) => updateCalendarSourceSetting(source.id, 'color', event.target.value)} />
                  </label>
                </div>;
              })}
            </div>
            <div className="calendar-work-filter-card integration-filter-summary">
              <div>
                <p className="eyebrow">Podgląd startowy</p>
                <h4>Źródła widoczne po resecie widoku kalendarza</h4>
                <p className="muted">Bieżący filtr roboczy kalendarza może być tymczasowo inny, ale poniższa lista definiuje stan domyślny.</p>
              </div>
              <div className="calendar-work-filter-preview">
                {CALENDAR_SOURCES.map((source) => {
                  const settings = calendarSourceSettings[source.id] ?? {};
                  return <span key={source.id} className={settings.enabledByDefault === false ? 'disabled' : ''}>
                    <i style={{ background: settings.color || DEFAULT_CALENDAR_SOURCE_COLORS[source.id] }} />
                    {source.label}
                  </span>;
                })}
              </div>
            </div>
          </section>}
        </div>
      </div></IntegrationsSettingsPanel>}

      {restoreCandidate && <ModalFrame
        className="backup-restore-modal"
        eyebrow="Kopie bezpieczeństwa"
        title="Przywrócić backup?"
        description={`Plik: ${restoreCandidate.fileName}. Import zastąpi obecne dane w tabelach objętych backupem.`}
        onClose={() => setRestoreCandidate(null)}
        footer={<>
          <ButtonSecondary onClick={() => setRestoreCandidate(null)} disabled={backupBusy}>Anuluj</ButtonSecondary>
          <ButtonSecondary onClick={() => restoreBackupFromCandidate(false)} disabled={backupBusy}>Nie</ButtonSecondary>
          <ButtonPrimary onClick={() => restoreBackupFromCandidate(true)} disabled={backupBusy}>Tak</ButtonPrimary>
        </>}
      >
        <div className="backup-restore-question">
          <strong>Czy wykonać kopię obecnych danych przed importem?</strong>
          <p>Opcja „Tak” zapisze aktualny stan do pliku JSON, a dopiero potem rozpocznie przywracanie wybranego backupu.</p>
        </div>
      </ModalFrame>}

      </SettingsSectionShell>
    </div>
    {pendingTemplateExitAction && <ModalFrame
      className="confirm-dialog"
      title="Masz niezapisane zmiany."
      onClose={cancelTemplateExit}
      footer={<>
        <ButtonSecondary onClick={cancelTemplateExit}>Anuluj</ButtonSecondary>
        <ButtonSecondary onClick={confirmTemplateExitWithDiscard}>Odrzuć</ButtonSecondary>
        <ButtonPrimary onClick={confirmTemplateExitWithSave}>Zapisz</ButtonPrimary>
      </>}
    >
      <p className="confirm-dialog-message">Przed opuszczeniem widoku zapisz zmiany albo je odrzuć.</p>
    </ModalFrame>}
    {confirmDialog && <ConfirmDialog title={confirmDialog.title} message={confirmDialog.message} confirmLabel={confirmDialog.confirmLabel} cancelLabel={confirmDialog.cancelLabel} variant={confirmDialog.variant} onConfirm={confirmDialog.onConfirm} onCancel={() => setConfirmDialog(null)} />}
  </div>;
}

createRoot(document.getElementById('root')).render(<AppErrorBoundary><App /></AppErrorBoundary>);
