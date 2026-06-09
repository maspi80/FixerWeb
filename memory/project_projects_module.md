---
name: project-projects-module
description: Moduł Projekty w FIXER WEB - wdrożony 2026-06-09, pliki i migracje
metadata:
  type: project
---

# Moduł Projekty — wdrożenie

**Data:** 2026-06-09

## Nowe pliki
- `supabase/013_projects_schema.sql` — tabele `projects`, `project_tasks` z RLS
- `supabase/014_projects_backup_rpc.sql` — aktualizacja `restore_fixer_backup` o nowe tabele
- `src/services/projectsService.js` — CRUD dla projektów i zadań projektów

## Zmodyfikowane pliki
- `src/main.jsx` — komponenty `ProjectsModule`, `ProjectEditor`, `ProjectTaskEditor`, integracje
- `src/services/globalSearchService.js` — wyszukiwanie projektów
- `src/services/backupService.js` — backup/restore projektów

## Stałe w main.jsx
- `PROJECTS_TABLE_KEY = 'projects-table'`
- `PROJECTS_HISTORY_TABLE_KEY = 'projects-history-table'`

## Numeracja projektów
Zintegrowana z istniejącym systemem `DEFAULT_DOCUMENT_NUMBERING.projects = { prefix: 'PRJ', format: 'PREFIX/NR/DD/MM/YYYY', padding: 3 }`.
Konfiguracja w Ustawieniach → Dokumenty → Numeracja.

## Statusy projektów
Planowany (indigo), W trakcie, Wstrzymany (orange), Zakończony (green), Anulowany (red).
Terminalne: Zakończony, Anulowany → pytanie o archiwizację.

## Integracje
- Kalendarz: projekty i zadania pojawiają się w kalendarzu (źródło "Projekty")
- Powiadomienia: projekt/zadanie po terminie, na dziś, jutro, przypomnienie
- Dashboard: karta "Projekty po terminie", "Wymaga uwagi" pokazuje zaległe projekty
- Globalne wyszukiwanie: projekty i zadania projektów
- Backup/Restore: tabele projects i project_tasks
- Ustawienia: zakładka "Projekty" z kolorami statusów; numeracja w zakładce "Dokumenty"

## Ważne — wymagana migracja SQL
Przed uruchomieniem w produkcji trzeba ręcznie uruchomić w Supabase:
1. `013_projects_schema.sql`
2. `014_projects_backup_rpc.sql`

**Why:** Nowe tabele i zaktualizowana funkcja RPC nie zaaplikują się automatycznie.
**How to apply:** Przy kolejnych zmianach w DB pamiętać o aktualizacji obu plików + backupService.js + RPC.
