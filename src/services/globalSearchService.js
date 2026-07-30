import { fetchCalendarManualEvents } from './calendarService';
import { fetchClients } from './clientsService';
import { fetchEquipment } from './equipmentService';
import { fetchOrganizerTasks } from './organizerService';
import { fetchProjects, fetchAllProjectTasks } from './projectsService';
import { fetchRentals } from './rentalsService';
import { fetchServiceOrders } from './serviceOrdersService';

const MAX_RESULTS_PER_MODULE = 6;

const MODULE_LABELS = {
  clients: 'Klienci',
  equipment: 'Sprzęt',
  rentals: 'Wypożyczenia',
  service: 'Serwis',
  organizer: 'Zadania i projekty',
  projects: 'Zadania i projekty',
  calendar: 'Kalendarz'
};

function normalizeSearchText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pl')
    .replace(/\s+/g, ' ')
    .trim();
}

function textBag(parts) {
  return normalizeSearchText(parts.filter(Boolean).join(' '));
}

function matchesQuery(bag, query) {
  const normalizedQuery = normalizeSearchText(query);
  if (normalizedQuery.length < 2) return false;
  const tokens = normalizedQuery.split(' ').filter(Boolean);
  return tokens.every((token) => bag.includes(token));
}

function scoreResult(result, query) {
  const normalizedQuery = normalizeSearchText(query);
  const title = normalizeSearchText(result.title);
  const description = normalizeSearchText(result.description);
  const status = normalizeSearchText(result.status);
  let score = result.active === false ? 0 : 100;
  if (title === normalizedQuery) score += 80;
  else if (title.startsWith(normalizedQuery)) score += 50;
  else if (title.includes(normalizedQuery)) score += 30;
  if (description.includes(normalizedQuery)) score += 12;
  if (status.includes(normalizedQuery)) score += 8;
  return score;
}

function limitAndSort(results, query) {
  return results
    .map((result) => ({ ...result, _score: scoreResult(result, query) }))
    .sort((left, right) => right._score - left._score || String(left.title).localeCompare(String(right.title), 'pl', { numeric: true }))
    .slice(0, MAX_RESULTS_PER_MODULE)
    .map(({ _score, ...result }) => result);
}

function rentalStatusLabel(status) {
  if (status === 'returned') return 'Zwrócone';
  if (status === 'partially_returned') return 'Częściowo zwrócone';
  return 'Aktywne';
}

function calendarDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toLocaleDateString('pl-PL');
}

async function safeLoad(label, loader) {
  try {
    const result = await loader();
    if (result.error) {
      console.warn(`Global search: ${label} load failed`, result.error);
      return [];
    }
    return result.data ?? [];
  } catch (error) {
    console.warn(`Global search: ${label} load failed`, error);
    return [];
  }
}

function buildClientResults(rows, query) {
  const results = rows.map((client) => {
    const bag = textBag([client.name, client.phone, client.email, client.nip, client.city, client.type, client.client_kind]);
    if (!matchesQuery(bag, query)) return null;
    return {
      id: `clients:${client.id ?? client.localId ?? client.name}`,
      module: 'clients',
      group: MODULE_LABELS.clients,
      recordType: client.type === 'Osoba prywatna' ? 'Klient' : 'Firma',
      title: client.name || 'Klient',
      description: [client.phone, client.email, client.city, client.nip ? `NIP ${client.nip}` : ''].filter(Boolean).join(' · '),
      status: client.client_kind || client.type || '',
      active: true,
      intent: { type: 'clients', clientId: client.id ?? client.localId }
    };
  }).filter(Boolean);
  return limitAndSort(results, query);
}

function buildEquipmentResults(rows, query) {
  const results = rows.map((item) => {
    const bag = textBag([item.name, item.brand, item.model, item.serial, item.inventory_number, item.barcode, item.category, item.status, item.location]);
    if (!matchesQuery(bag, query)) return null;
    return {
      id: `equipment:${item.id ?? item.localId ?? item.serial ?? item.name}`,
      module: 'equipment',
      group: MODULE_LABELS.equipment,
      recordType: item.category === 'Zestaw' ? 'Zestaw' : 'Sprzęt',
      title: item.name || item.serial || 'Sprzęt',
      description: [item.brand, item.model, item.serial ? `SN ${item.serial}` : '', item.inventory_number ? `Nr inw. ${item.inventory_number}` : '', item.location].filter(Boolean).join(' · '),
      status: item.status || '',
      active: !['wycofany'].includes(normalizeSearchText(item.status)),
      intent: { type: 'equipment', equipmentId: item.id ?? item.localId }
    };
  }).filter(Boolean);
  return limitAndSort(results, query);
}

function buildRentalResults(rows, query) {
  const results = rows.map((rental) => {
    const itemNames = (rental.rental_items ?? []).map((item) => [item.name_snapshot, item.serial_snapshot, item.inventory_number_snapshot, item.barcode_snapshot].filter(Boolean).join(' '));
    const status = rentalStatusLabel(rental.status);
    const bag = textBag([rental.rental_number, rental.clients?.name, status, rental.start_date, rental.planned_return_date, rental.actual_return_date, ...itemNames]);
    if (!matchesQuery(bag, query)) return null;
    return {
      id: `rentals:${rental.id ?? rental.rental_number}`,
      module: 'rentals',
      group: MODULE_LABELS.rentals,
      recordType: 'Wypożyczenie',
      title: rental.rental_number || 'Wypożyczenie',
      description: [
        rental.clients?.name,
        itemNames.slice(0, 2).join(', '),
        rental.actual_return_date ? `Faktyczny zwrot ${rental.actual_return_date}` : rental.planned_return_date ? `Zwrot ${rental.planned_return_date}` : ''
      ].filter(Boolean).join(' · '),
      status,
      active: rental.status !== 'returned',
      intent: { type: 'rentals', filter: 'open', rentalId: rental.id }
    };
  }).filter(Boolean);
  return limitAndSort(results, query);
}

function buildServiceResults(rows, query) {
  const results = rows.map((order) => {
    const clientName = order.clients?.name;
    const equipmentName = order.customer_device_name || order.equipment?.name;
    const bag = textBag([order.service_number, clientName, equipmentName, order.customer_device_brand, order.customer_device_model, order.customer_device_serial, order.status, order.fault_description]);
    if (!matchesQuery(bag, query)) return null;
    return {
      id: `service:${order.id ?? order.service_number}`,
      module: 'service',
      group: MODULE_LABELS.service,
      recordType: 'Zlecenie serwisowe',
      title: order.service_number || 'Serwis',
      description: [clientName, equipmentName, order.customer_device_serial ? `SN ${order.customer_device_serial}` : '', order.fault_description].filter(Boolean).join(' · '),
      status: order.status || '',
      active: !['wydane', 'anulowane'].includes(normalizeSearchText(order.status)),
      intent: { type: 'service', serviceOrderId: order.id }
    };
  }).filter(Boolean);
  return limitAndSort(results, query);
}

function buildOrganizerResults(rows, query) {
  const results = rows.map((task) => {
    const bag = textBag([task.title, task.description, task.status, task.priority, task.category, task.linked_label]);
    if (!matchesQuery(bag, query)) return null;
    return {
      id: `organizer:${task.id ?? task.localId}`,
      module: 'projects',
      group: MODULE_LABELS.organizer,
      recordType: 'Zadanie',
      title: task.title || 'Zadanie',
      description: [task.category, task.priority, task.due_date ? `Termin ${task.due_date}` : '', task.description].filter(Boolean).join(' · '),
      status: task.status || '',
      active: !task.archived,
      intent: { type: 'projects', taskId: task.id ?? task.localId }
    };
  }).filter(Boolean);
  return limitAndSort(results, query);
}

function buildProjectResults(projects, tasks, query) {
  const tasksByProject = {};
  tasks.forEach((t) => { (tasksByProject[t.project_id] = tasksByProject[t.project_id] ?? []).push(t); });

  const projectResults = projects.map((project) => {
    const projectId = project.id ?? project.localId;
    const clientName = project.clients?.name ?? '';
    const projectTasks = (tasksByProject[projectId] ?? []).map((t) => t.title).join(' ');
    const bag = textBag([project.project_number, project.name, clientName, project.status, project.description, projectTasks]);
    if (!matchesQuery(bag, query)) return null;
    return {
      id: `projects:${projectId}`,
      module: 'projects',
      group: MODULE_LABELS.projects,
      recordType: 'Projekt',
      title: project.name || project.project_number || 'Projekt',
      description: [project.project_number, clientName, project.status].filter(Boolean).join(' · '),
      status: project.status || '',
      active: !project.archived,
      intent: { type: 'projects', projectId }
    };
  }).filter(Boolean);

  const taskResults = tasks.map((task) => {
    const bag = textBag([task.title, task.description, task.status, task.priority]);
    if (!matchesQuery(bag, query)) return null;
    return {
      id: `project-task:${task.id ?? task.localId}`,
      module: 'projects',
      group: MODULE_LABELS.projects,
      recordType: 'Zadanie projektu',
      title: task.title || 'Zadanie',
      description: [task.priority, task.status, task.due_date ? `Termin ${task.due_date}` : ''].filter(Boolean).join(' · '),
      status: task.status || '',
      active: !task.archived,
      intent: { type: 'projects', projectId: task.project_id, taskId: task.id ?? task.localId }
    };
  }).filter(Boolean);

  return limitAndSort([...projectResults, ...taskResults], query);
}

function buildCalendarResults(rows, query) {
  const results = rows.map((event) => {
    const bag = textBag([event.title, event.description, event.location, 'wydarzenie ręczne', calendarDate(event.start_at)]);
    if (!matchesQuery(bag, query)) return null;
    return {
      id: `calendar:${event.id ?? event.localId}`,
      module: 'calendar',
      group: MODULE_LABELS.calendar,
      recordType: 'Wydarzenie',
      title: event.title || 'Wydarzenie',
      description: [event.location, calendarDate(event.start_at), event.description].filter(Boolean).join(' · '),
      status: 'Ręczne',
      active: true,
      intent: { type: 'calendar', eventId: event.id ?? event.localId }
    };
  }).filter(Boolean);
  return limitAndSort(results, query);
}

function canSearchModule(allowedModuleIds, moduleId) {
  if (!allowedModuleIds) return true;
  if (allowedModuleIds instanceof Set) return allowedModuleIds.has(moduleId);
  if (Array.isArray(allowedModuleIds)) return allowedModuleIds.includes(moduleId);
  return true;
}

export async function searchGlobalRecords(query, options = {}) {
  if (normalizeSearchText(query).length < 2) return [];
  const { allowedModuleIds = null } = options;

  const [clients, equipment, rentals, service, organizer, projects, projectTasks, calendar] = await Promise.all([
    canSearchModule(allowedModuleIds, 'clients') ? safeLoad('clients', fetchClients) : [],
    canSearchModule(allowedModuleIds, 'equipment') ? safeLoad('equipment', fetchEquipment) : [],
    canSearchModule(allowedModuleIds, 'rentals') ? safeLoad('rentals', fetchRentals) : [],
    canSearchModule(allowedModuleIds, 'service') ? safeLoad('service', fetchServiceOrders) : [],
    canSearchModule(allowedModuleIds, 'projects') ? safeLoad('organizer', fetchOrganizerTasks) : [],
    canSearchModule(allowedModuleIds, 'projects') ? safeLoad('projects', fetchProjects) : [],
    canSearchModule(allowedModuleIds, 'projects') ? safeLoad('project-tasks', fetchAllProjectTasks) : [],
    canSearchModule(allowedModuleIds, 'calendar') ? safeLoad('calendar', fetchCalendarManualEvents) : []
  ]);

  const workResults = limitAndSort([...buildOrganizerResults(organizer, query), ...buildProjectResults(projects, projectTasks, query)], query);

  return [
    canSearchModule(allowedModuleIds, 'clients') ? { module: 'clients', label: MODULE_LABELS.clients, results: buildClientResults(clients, query) } : null,
    canSearchModule(allowedModuleIds, 'equipment') ? { module: 'equipment', label: MODULE_LABELS.equipment, results: buildEquipmentResults(equipment, query) } : null,
    canSearchModule(allowedModuleIds, 'rentals') ? { module: 'rentals', label: MODULE_LABELS.rentals, results: buildRentalResults(rentals, query) } : null,
    canSearchModule(allowedModuleIds, 'service') ? { module: 'service', label: MODULE_LABELS.service, results: buildServiceResults(service, query) } : null,
    canSearchModule(allowedModuleIds, 'projects') ? { module: 'projects', label: MODULE_LABELS.projects, results: workResults } : null,
    canSearchModule(allowedModuleIds, 'calendar') ? { module: 'calendar', label: MODULE_LABELS.calendar, results: buildCalendarResults(calendar, query) } : null
  ].filter(Boolean);
}
