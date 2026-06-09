---
name: project-overview
description: Architektura FIXER WEB - moduły, wzorce kodu, serwisy, komponenty
metadata:
  type: project
---

# FIXER WEB — Architektura

Pojedynczy plik główny: `src/main.jsx` (~7800 linii po module Projekty).

## Moduły (menu boczne)
Dashboard, Klienci, Sprzęt, Wypożyczenia, Serwis, **Projekty**, Kalendarz, Organizer, Ustawienia.

## Wzorzec serwisów
Każdy moduł ma `src/services/xxxService.js` z funkcjami `fetchXxx`, `createXxx`, `updateXxx`, `deleteXxx`.
Obsługa offline przez localStorage (fallback gdy Supabase niedostępny).

## Wzorzec komponentów
- `DataTable` — globalna tabela z sortowaniem, filtrowaniem, menu kolumn, eksport CSV/PDF
- `ResizableModalFrame` — modal z możliwością resize i drag
- `ServiceStatusCell` — dropdown zmiany statusu inline w tabeli
- `StatusPill` — badge statusu (ton: danger/success/warning/info/neutral)
- `ClientPickerModal` — modal wyboru klienta (dostępny globalnie)

## Supabase migracje
`supabase/001_` … `014_` — kolejne migracje. Ostatnia to `014_projects_backup_rpc.sql`.

## Backup
`src/services/backupService.js` — tabele w BACKUP_TABLES, kolejność usuwania w DELETE_ORDER, wstawiania w INSERT_ORDER.
RPC `restore_fixer_backup` w Supabase musi być zaktualizowane razem z backupService.
