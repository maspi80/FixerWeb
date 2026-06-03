# Fixer WEB — Przegląd projektu

> Wersja: 0.5.6 · Ostatnia aktualizacja przeglądu: 2026-06-03

Fixer WEB to webowa aplikacja do zarządzania wypożyczalnią sprzętu AV/filmowego. Obsługuje: magazyn sprzętu, klientów, wypożyczenia, serwis i podgląd kalendarza. Backend — Supabase (PostgreSQL + Auth). Frontend — React 18 + Vite, bez żadnego zewnętrznego frameworku UI.

---

## 1. Struktura `src/`

```
src/
├── main.jsx                     # ~4 900 linii — cała aplikacja w jednym pliku
├── styles.css                   # globalne style aplikacji
├── data/
│   └── mockData.js              # statyczne dane demo (klienci, sprzęt, wypożyczenia)
├── design-system/
│   ├── components.jsx           # reużywalne komponenty UI (AppButton, AppInput, AppTable…)
│   ├── components.css           # style komponentów design systemu
│   ├── tokens.css               # CSS custom properties (kolory, typografia, spacing)
│   ├── tokens.js                # tokeny jako stałe JS
│   └── index.js                 # re-eksport wszystkich komponentów design systemu
├── lib/
│   └── supabaseClient.js        # singleton klienta Supabase + flaga `isSupabaseConfigured`
└── services/
    ├── clientsService.js        # CRUD dla tabeli `clients`
    ├── clientTypesService.js    # CRUD dla tabeli `client_types` (+ fallback localStorage)
    ├── equipmentService.js      # CRUD dla tabeli `equipment`
    ├── equipmentDictionariesService.js  # CRUD dla `equipment_dictionaries` (+ fallback)
    ├── rentalsService.js        # CRUD dla `rentals` + `rental_items` + logika zwrotów
    ├── serviceOrdersService.js  # CRUD dla `service_orders` + `service_order_progress` (+ fallback)
    └── tablePreferencesService.js  # preferencje kolumn tabel (Supabase + localStorage)
```

### Kluczowe punkty

- `main.jsx` jest **monolityczny** — zawiera dosłownie wszystko: komponenty `App`, `LoginScreen`, `Sidebar`, `Topbar`, `Dashboard`, `ClientsModule`, `EquipmentModule`, `RentalsModule`, `ServiceModule`, `SettingsModule` oraz dziesiątki edytorów, modali i funkcji pomocniczych. Brak podziału na pliki.
- `CalendarModule` i `OrganizerModule` to **zaślepki** — puste ciała funkcji bez żadnej implementacji.
- `design-system/` jest poprawnie wyodrębniony i używany konsekwentnie przez resztę aplikacji.
- `data/mockData.js` dostarcza danych demonstracyjnych gdy Supabase nie jest skonfigurowany.

---

## 2. Zarządzanie stanem

### Wzorzec

- **Brak globalnego store** (Redux, Zustand, Context API) — każdy moduł zarządza swoim stanem lokalnie przez `useState` + `useEffect`.
- Każdy moduł ładuje dane z Supabase przy montowaniu (`useEffect(() => { load(); }, [])`).
- Dane nie są współdzielone między modułami — jeśli `ClientsModule` i `RentalsModule` potrzebują listy klientów, każdy pobiera ją osobno.

### Persystencja

| Klucz localStorage | Co przechowuje |
|---|---|
| `fixer-demo-auth` | flaga trybu demo (obejście logowania) |
| `fixer-sidebar` | stan zwinięcia bocznego panelu |
| `fixer-density` | gęstość UI (compact / comfortable) |
| `fixer-color-theme` | motyw kolorystyczny (dark / light) |
| `fixer-dashboard-layout-v1` | układ kart na dashboardzie |
| `fixer-client-types` | typy klientów (fallback bez Supabase) |
| `fixer-equipment-dictionaries` | słowniki sprzętu (fallback) |
| `fixer-config-dictionaries` | słowniki konfiguracyjne (stany, warunki) |
| `fixer-company-profile` | dane firmy do wydruków/eksportów |
| `fixer-rental-numbering` | ustawienia numeracji wypożyczeń |
| `fixer-table-preferences-{key}` | preferencje kolumn tabel (lokalny cache Supabase) |
| `fixer-service-orders-fallback` | zlecenia serwisowe offline (fallback) |
| `fixer-service-progress-fallback` | postępy zleceń offline (fallback) |
| `{storageKey}:size` / `:position` | pozycja i rozmiar pływających modali |

### Tryb demo

Gdy zmienna `VITE_SUPABASE_URL` nie jest ustawiona, `isSupabaseConfigured = false`. Wtedy:
- `clientsService`, `equipmentService`, `rentalsService` — zwracają puste tablice z komunikatem błędu.
- `clientTypesService`, `equipmentDictionariesService`, `serviceOrdersService` — mają **pełny fallback na localStorage** i działają offline.
- Na ekranie logowania dostępny jest przycisk „Tryb demo" ustawiający `fixer-demo-auth=true`.

---

## 3. Komunikacja z Supabase

### Klient

```
src/lib/supabaseClient.js
```

Singleton tworzony z `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`. Eksportuje `supabase` (lub `null`) oraz `isSupabaseConfigured`. Każdy serwis importuje oba i zawiera guard na początku każdej funkcji.

### Warstwa serwisów

Serwisy w `src/services/` to jedyna warstwa abstrakcji nad Supabase. Wzorzec:

1. **Guard** — jeśli `!isSupabaseConfigured`, zwróć fallback/błąd.
2. **Wywołanie Supabase JS SDK** — `.from(table).select/insert/update/delete`.
3. **Normalizacja** — każdy serwis zawiera funkcję `normalize*Payload()` czyszczącą dane przed zapisem (puste stringi → null, walidacja enum, sumy kosztów).
4. **Zwrot** — zawsze `{ data, error }` (+ opcjonalnie `local: true` gdy fallback).

### Zapytania

- Wszystkie kolumny w `select()` są jawnie wymienione jako string (nie `*`).
- Relacje pobierane przez PostgREST: `rentals` zawiera zagnieżdżone `clients(...)` i `rental_items(...)` w jednym zapytaniu.
- Brak realtime subscriptions — dane odświeżane tylko po akcji użytkownika lub przy montowaniu modułu.
- `updated_at` ustawiany ręcznie w JS (`new Date().toISOString()`), nie przez trigger DB.

### Auth

Supabase email+password auth (`supabase.auth.signInWithPassword`). Sesja zarządzana przez Supabase SDK. Preferencje tabel per-user wymagają zalogowanego usera (`auth.getSession()`).

---

## 4. Model danych

### Tabele i kolumny

#### `clients`
| Kolumna | Typ | Opis |
|---|---|---|
| `id` | uuid PK | |
| `name` | text NOT NULL | nazwa / imię i nazwisko |
| `type` | text | `'Firma'` / `'Osoba prywatna'` |
| `client_kind` | text | typ klienta (z `client_types`) |
| `customer_kind` | text | ⚠️ duplikat `client_kind` (stara kolumna) |
| `contact_person` | text | osoba kontaktowa |
| `phone`, `email` | text | |
| `street`, `building_number`, `apartment_number`, `postal_code`, `city`, `country` | text | adres |
| `nip`, `regon` | text | dane podatkowe |
| `notes` | text | notatki |
| `note` | text | ⚠️ duplikat `notes` (stara kolumna) |
| `created_at`, `updated_at` | timestamptz | |

#### `client_types`
| Kolumna | Typ |
|---|---|
| `id` | uuid PK |
| `name` | text UNIQUE NOT NULL |
| `sort_order` | integer |
| `created_at`, `updated_at` | timestamptz |

Domyślne wartości: `Stały`, `Pracownik`, `VIP`, `Problematyczny`, `Nowy`, `Zablokowany`.

#### `equipment`
| Kolumna | Typ | Opis |
|---|---|---|
| `id` | uuid PK | |
| `name` | text NOT NULL | |
| `category`, `brand`, `model` | text | |
| `serial`, `inventory_number`, `barcode` | text | identyfikatory |
| `status` | text | ze słownika (`equipment_dictionaries`) |
| `location` | text | ze słownika |
| `purchase_date` | date | |
| `condition` | text | stan fizyczny |
| `purchase_value`, `deposit`, `price_day`, `price_week` | **text** | ⚠️ ceny jako text, nie numeric |
| `description`, `notes`, `service_notes`, `history_notes` | text | |
| `gallery` | jsonb | lista URLi zdjęć |
| `attachments` | jsonb | lista plików |
| `set_items` | jsonb | lista składników zestawu (dla `category='Zestaw'`) |
| `created_at`, `updated_at` | timestamptz | |

#### `equipment_dictionaries`
| Kolumna | Typ |
|---|---|
| `id` | uuid PK |
| `dictionary_type` | text (`'category'` / `'status'` / `'location'`) |
| `name` | text |
| `sort_order` | integer |

#### `rentals`
| Kolumna | Typ | Opis |
|---|---|---|
| `id` | uuid PK | |
| `rental_number` | text UNIQUE NOT NULL | np. `WYP/20260603...` |
| `client_id` | uuid FK→clients | NOT NULL, ON DELETE RESTRICT |
| `status` | text | `active` / `partially_returned` / `returned` |
| `start_date` | date | |
| `planned_return_date`, `actual_return_date` | date | |
| `total_deposit`, `total_price` | numeric(12,2) | |
| `notes` | text | |

#### `rental_items`
| Kolumna | Typ | Opis |
|---|---|---|
| `id` | uuid PK | |
| `rental_id` | uuid FK→rentals | ON DELETE CASCADE |
| `equipment_id` | uuid FK→equipment | ON DELETE RESTRICT, nullable |
| `parent_set_equipment_id` | uuid FK→equipment | dla składników zestawu, ON DELETE SET NULL |
| `item_type` | text | `single` / `set` / `set_component` |
| `name_snapshot`, `serial_snapshot`, `inventory_number_snapshot`, `barcode_snapshot` | text | migawka danych sprzętu w chwili wypożyczenia |
| `status` | text | `issued` / `returned` / `damaged` / `lost` / `service_required` |
| `planned_return_date`, `returned_at` | date/timestamptz | |
| `price_day`, `price_week`, `deposit` | numeric(12,2) | |
| `condition_out`, `condition_in`, `damage_notes`, `settlement_notes` | text | |

#### `service_orders`
| Kolumna | Typ | Opis |
|---|---|---|
| `id` | uuid PK | |
| `service_number` | text UNIQUE NOT NULL | |
| `status` | text | `Przyjęte` / `W diagnozie` / `Oczekuje na części` / `W naprawie` / `Gotowe do odbioru` / `Wydane` / `Anulowane` |
| `priority` | text | `Niski` / `Normalny` / `Wysoki` / `Pilny` |
| `client_id` | uuid FK→clients | ON DELETE SET NULL, nullable |
| `equipment_id` | uuid FK→equipment | ON DELETE SET NULL, nullable |
| `accepted_date`, `planned_date`, `completed_date` | date | |
| `customer_device_*` | text (6 kolumn) | dane urządzenia klienta (zewnętrzny sprzęt) |
| `intake_*` | text (3 kolumny) | opis stanu przy przyjęciu |
| `fault_description`, `diagnosis`, `work_performed`, `parts_materials` | text | |
| `labor_cost`, `parts_cost`, `other_cost`, `total_cost` | numeric(12,2) | |
| `estimate_status` | text | `Roboczy` / `Zaakceptowany` / `Odrzucony` |
| `internal_notes`, `notes` | text | |
| `attachments` | jsonb | lista plików (faktycznie używana zamiast tabeli `service_order_attachments`) |

#### `service_order_progress`
| Kolumna | Typ |
|---|---|
| `id` | uuid PK |
| `service_order_id` | uuid FK→service_orders, ON DELETE CASCADE |
| `entry_text` | text NOT NULL |
| `operator_name` | text |

#### `service_order_attachments` ⚠️
Tabela istnieje w schemacie SQL, ale **nigdy nie jest używana** przez JS — załączniki serwisowe zapisywane są w `service_orders.attachments` (jsonb).

#### `user_table_preferences`
| Kolumna | Typ |
|---|---|
| `id` | uuid PK |
| `user_id` | uuid FK→auth.users, ON DELETE CASCADE |
| `table_key` | text |
| `visible_columns`, `column_order` | jsonb |
| `column_widths` | jsonb |
| UNIQUE | `(user_id, table_key)` |

### Relacje (schemat)

```
auth.users ←─── user_table_preferences

clients ──────── rentals ──────── rental_items ─── equipment
         └────── service_orders ──────────────────── equipment
client_types (lookup dla clients.client_kind)
equipment_dictionaries (lookup dla equipment.category/status/location)
service_orders ──── service_order_progress
```

### RLS

Wszystkie tabele mają RLS włączone. Polityki: `SELECT/INSERT/UPDATE/DELETE` dozwolone dla roli `authenticated` bez żadnych dodatkowych warunków (poza `user_table_preferences`, gdzie każdy widzi tylko swoje wiersze).

---

## 5. Routing i nawigacja

- **Brak react-router** ani żadnej biblioteki routingowej.
- Routing to `useState<string>('dashboard')` w komponencie `App` — zmienna `activeModule`.
- Sidebar renderuje przyciski nawigacyjne; kliknięcie wywołuje `setActiveModule(id)`.
- Aktywny moduł renderowany przez serię warunków `{activeModule === 'x' && <XModule />}`.
- **Moduły**: `dashboard`, `clients`, `equipment`, `rentals`, `service`, `calendar`, `organizer`, `settings`.
- **Intenty cross-modułowe**: Dashboard może przekazać do modułu dodatkowy obiekt `intent` (np. `{ type: 'rentals', filter: 'overdue' }`) przez `setModuleIntent()` — konsumowany przez moduł docelowy i natychmiast zerowany.
- URL przeglądarki nigdy się nie zmienia — przeładowanie strony zawsze wraca do dashboardu.

---

## 6. Konfiguracja builda i deployu

### Vite

- Brak pliku `vite.config.js` — używane są domyślne ustawienia Vite 5.
- Entry point: `index.html` → `src/main.jsx`.
- Build produkuje `dist/` (plik `dist/assets/index-*.js` i `dist/assets/index-*.css`).
- Zmienne środowiskowe: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (z pliku `.env`).

### Vercel

- Brak pliku `vercel.json` — Vercel automatycznie wykrywa Vite i używa domyślnej konfiguracji (`npm run build` → `dist/`).
- Repozytorium zawiera już zbudowane pliki `dist/` commitowane razem z kodem (⚠️ niezalecane).

---

## 7. Zauważone problemy i podatności

### Architektura

- **Monolit `main.jsx` (~4 900 linii)** — wszystkie komponenty, moduły, modale, utility i stałe w jednym pliku. Skrajnie trudny w utrzymaniu, nawigacji i code review.
- **Brak globalnego stanu** — każdy moduł ładuje dane niezależnie; np. lista klientów pobierana osobno w `ClientsModule`, `RentalsModule` i `ServiceModule`. Żadne invalidation ani cache — risz stale data.
- **Brak routera** — URL nie odzwierciedla stanu aplikacji. Niemożliwy deep link, back button nic nie robi.
- `CalendarModule` i `OrganizerModule` to **puste zaślepki** — widoczne w sidebar, ale niedziałające.

### Model danych

- **Duplikaty w tabeli `clients`**: kolumny `notes`/`note` i `client_kind`/`customer_kind` — dwie nazwy dla tych samych danych. Warstwa JS używa tylko `notes` i `client_kind`.
- **Ceny sprzętu jako `text`** (`purchase_value`, `deposit`, `price_day`, `price_week` w tabeli `equipment`) — w przeciwieństwie do `rentals` i `service_orders`, które używają `numeric(12,2)`. Brak walidacji typów na poziomie DB.
- **`service_order_attachments`** istnieje w schemacie ale jest martwa — attachmenty zapisywane jako jsonb w `service_orders.attachments`.
- **`updated_at` ustawiane ręcznie w JS** — brak triggerów DB; przy bezpośrednich operacjach na bazie pole nie zostanie zaktualizowane.
- **Migracje przez idempotentne `CREATE IF NOT EXISTS` + `ALTER TABLE ADD COLUMN IF NOT EXISTS`** — schema.sql jest jednocześnie plikiem inicjalizacyjnym i migracją. Brak wersjonowanego systemu migracji (np. Flyway, Supabase migrations).

### Logika biznesowa

- **`updateRentalRecord` jest nieatomowy**: usuwa wszystkie `rental_items` i wstawia je od nowa. Jeśli wstawienie nowych pozycji się nie powiedzie, wypożyczenie zostaje bez pozycji.
- **`getClientTypes()` / `saveClientTypes()`** zduplikowane w `main.jsx` obok `clientTypesService.js` — dwie niezależne implementacje tej samej logiki.
- **`normalizePayload`** istnieje zarówno w serwisach (`normalizeRentalPayload`, `normalizeServicePayload`), jak i wewnątrz `EquipmentModule` jako lokalna anonimowa funkcja — brak spójności.
- **Status sprzętu zmieniany programowo** przez serwisy (`rentalsService`, `serviceOrdersService`) zamiast przez trigger DB — podatne na desynchronizację przy równoległych operacjach.

### Bezpieczeństwo i tryb demo

- **`fixer-demo-auth=true` w localStorage** omija ekran logowania bez żadnego tokenu/weryfikacji — każdy może ręcznie ustawić tę wartość.
- **RLS „allow all authenticated"** — brak izolacji między użytkownikami (np. pracownikami tej samej firmy vs. różnymi firmami). Każdy zalogowany widzi i edytuje wszystkie dane.
- **Klucz anon Supabase w zmiennych środowiskowych po stronie frontendu** — standardowe dla Supabase, ale RLS musi być poprawnie skonfigurowane (co tutaj jest minimalne).

### Jakość kodu

- Brak TypeScript (jest w devDependencies, ale `tsconfig` nie istnieje i kod to plain JS/JSX).
- Brak testów (jednostkowych, integracyjnych, e2e).
- Brak `vite.config.js` — niemożliwe skonfigurowanie aliasów ścieżek, proxy, czy podziału chunków.
- `dist/` commitowany do repozytorium — artefakty builda nie powinny być w repozytorium.
