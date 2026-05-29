import { CalendarDays, ClipboardList, Package, Wrench } from 'lucide-react';

export const dashboardCards = [
  { label: 'Sprzęt w magazynie', value: '128', caption: '12 zestawów', target: 'equipment', icon: Package },
  { label: 'Aktywne wypożyczenia', value: '9', caption: '1 po terminie', warning: true, target: 'rentals', icon: ClipboardList },
  { label: 'Zlecenia serwisowe', value: '14', caption: '3 wymagają reakcji', target: 'service', icon: Wrench },
  { label: 'Rezerwacje', value: '6', caption: 'najbliższa dziś', target: 'calendar', icon: CalendarDays }
];

export const alerts = [
  { title: 'Zwrot przeterminowany', description: 'Kamera Sony PXW-Z190 — Adam Kowalski', time: '2 dni po terminie', tone: 'danger', target: 'rentals' },
  { title: 'Serwis czeka na odbiór', description: 'Mikser Yamaha MG12XU — Studio Alfa', time: '7 dni', tone: 'info', target: 'service' },
  { title: 'Rezerwacja na dziś', description: 'Walizka realizacyjna #CASE-04', time: '10:00', tone: 'success', target: 'calendar' }
];

export const rentals = [
  { number: 'WYP/2026/001', client: 'Adam Kowalski', item: 'Sony PXW-Z190', status: 'Po terminie', date: '2026-05-26' },
  { number: 'WYP/2026/002', client: 'Studio Alfa', item: 'Walizka stream', status: 'Aktywne', date: '2026-05-30' },
  { number: 'REZ/2026/004', client: 'BMX Media', item: 'Blackmagic ATEM Mini', status: 'Rezerwacja', date: '2026-06-12' }
];

export const serviceOrders = [
  { number: 'SRV/2026/011', client: 'Jan Nowak', item: 'Canon XF605', status: 'Serwis zewnętrzny' },
  { number: 'SRV/2026/012', client: 'Event Pro', item: 'Sennheiser EW-D', status: 'Czeka na części' },
  { number: 'SRV/2026/013', client: 'Studio Alfa', item: 'Yamaha MG12XU', status: 'Gotowe do odbioru' }
];

export const clients = [
  { localId: 'demo-1', name: 'Adam Kowalski', type: 'Osoba prywatna', phone: '+48 600 100 200', email: 'adam@example.com', rating: 'Ryzykowny', notes: 'Klient testowy z historią opóźnień.' },
  { localId: 'demo-2', name: 'Studio Alfa', type: 'Firma', phone: '+48 600 300 400', email: 'kontakt@studioalfa.pl', rating: 'Dobry', notes: 'Stały klient firmowy.' },
  { localId: 'demo-3', name: 'BMX Media', type: 'Firma', phone: '+48 600 500 600', email: 'office@bmxmedia.pl', rating: 'Bardzo dobry', notes: 'Klient testowy.' }
];

export const equipment = [
  { localId: 'eq-demo-1', name: 'Kamera Sony PXW-Z190', category: 'Kamera', brand: 'Sony', model: 'PXW-Z190', serial: 'Y80413N232910D', inventory_number: 'KAM-001', barcode: 'Y80413N232910D', status: 'Wypożyczony', location: 'U klienta', purchase_date: '2024-03-12', notes: 'Główna kamera ENG.' },
  { localId: 'eq-demo-2', name: 'Walizka stream CASE-04', category: 'Zestaw', brand: 'Custom', model: 'CASE-04', serial: 'CASE-04', inventory_number: 'SET-004', barcode: 'CASE-04', status: 'Zestaw', location: 'Magazyn', purchase_date: '2025-01-18', notes: 'Zestaw streamingowy do realizacji mobilnych.' },
  { localId: 'eq-demo-3', name: 'Mikser Yamaha MG12XU', category: 'Audio', brand: 'Yamaha', model: 'MG12XU', serial: 'MG12XU-7781', inventory_number: 'AUD-012', barcode: 'MG12XU-7781', status: 'Serwis', location: 'Serwis wewnętrzny', purchase_date: '2023-09-04', notes: 'Do weryfikacji potencjometr kanału 3.' }
];
