# FIXER WEB DESIGN SYSTEM v2

## Status

Design System V2 jest nadrzedna warstwa UI dla FIXER WEB. Nie zmienia logiki biznesowej, Supabase, migracji ani struktury danych. Jego celem jest jeden standard dla ekranow, kartotek, tabel, formularzy, pickerow i przyciskow.

## Architektura V2

Warstwa bazowa:

- `src/design-system/tokens.css` - kolory, typografia, spacing, radius, cienie i wysokosci kontrolek.
- `src/design-system/tokens.js` - eksport tokenow do kodu JS.
- `src/design-system/components.css` - style komponentow bazowych.
- `src/design-system/components.jsx` - komponenty bazowe.
- `src/design-system/index.js` - publiczny eksport DS.

Komponenty bazowe V2:

- `AppModal`
- `AppButton`
- `AppInput`
- `AppSelect`
- `AppTextarea`
- `AppTabs`
- `AppTable`
- `AppBadge`
- `AppSection`
- `AppToolbar`

Komponenty V1 pozostaja jako kompatybilne aliasy/wrappery i powinny byc stopniowo zastepowane komponentami `App*`.

## Standard globalny V2

- Jedna wysokosc kontrolek dla input/select/button: 36 px.
- Jeden system spacingu: 8, 12, 16, 24, 32.
- Jeden styl tabel: naglowek, hover, zaznaczenie, checkboxy, wiersze i wyrownania.
- Jeden styl kartotek: naglowek, tresc, stopka, zamykanie, resize, drag i zapamietywanie pozycji/rozmiaru.
- Jeden styl akcji: akcje tabeli przy tabeli, akcje dokumentu w stopce.
- Brak lokalnych odpowiednikow komponentow DS bez uzasadnienia.

## Audyt obecnego UI

Wspolne komponenty juz obecne:

- `DataTable` jako globalny mechanizm list modulow.
- `ClientPickerModal` i `EquipmentPickerModal` jako kierunek dla pickerow.
- `ButtonPrimary`, `ButtonSecondary`, `ButtonDanger`, `ButtonGhost`, `FormField`, `SectionPanel`, `StatusPill`, `EmptyState`.
- Zapamietywanie pozycji i rozmiaru w kartotekach klienta, sprzetu i wypozyczenia.

Elementy wymagajace unifikacji:

- Lokalne klasy przyciskow `primary-button`, `secondary-button`, `danger-*`.
- Lokalne style kartotek klienta, sprzetu, zestawu i wypozyczenia.
- Lokalne style tabel w kartotekach oraz pickerach.
- Lokalne formularze ustawien i slownikow.
- Ekrany pomocnicze typu Dashboard, Serwis, Zwroty i Ustawienia.

Kolejnosc migracji:

1. Sprzet.
2. Klienci.
3. Wypozyczenia.
4. Zwroty.
5. Dashboard.
6. Serwis.
7. Ustawienia.

---

# FIXER WEB DESIGN SYSTEM v1 FINAL

## Cel

FIXER WEB jest aplikacja operacyjna do zarzadzania sprzetem, klientami, wypozyczeniami, zwrotami, serwisem i dokumentami. Interfejs ma byc kompaktowy, szybki, spojny i przewidywalny.

Glowne wzorce referencyjne:

- kartoteka sprzetu,
- kartoteka klienta,
- globalna tabela `DataTable`.

## Zasady obowiazkowe

1. Kazdy nowy ekran, modal, tabela, formularz, picker i przycisk musi byc zgodny z Design Systemem.
2. Domyslna decyzja projektowa: uzyj istniejacego komponentu.
3. Nie tworzyc lokalnych wariantow kontrolek bez uzasadnienia.
4. Kartoteki maja byc maksymalnie kompaktowe.
5. Przewija sie tabela albo panel tresci, nie cale okno.
6. Operacje na rekordach: dwuklik, Enter, menu kontekstowe.
7. Brak automatycznych przyciskow akcji w kazdym wierszu tabeli.
8. Zakaz flow `modal -> modal -> modal`.
9. Klient wybierany tylko przez `ClientPicker`.
10. Sprzet wybierany tylko przez `EquipmentPicker`.
11. Nowe moduly korzystaja wylacznie z komponentow DS.
12. Stan UI ma byc zapamietywany globalnie.

## Zapamietywanie stanu UI

Kazde okno, kartoteka i tabela maja zapamietywac:

- rozmiar okna,
- pozycje okna,
- szerokosci kolumn,
- kolejnosc kolumn,
- ukryte/pokazane kolumny,
- ostatnio uzyte filtry,
- ostatnio uzyte sortowanie.

Brak zapamietywania stanu jest odstepstwem od DS i wymaga uzasadnienia.

## Kompaktowosc kartotek

Priorytet:

- gestosc informacji,
- ergonomia,
- brak pustych przestrzeni,
- szybka praca bez niepotrzebnego scrollowania.

Zasady:

- Jezeli pole moze byc mniejsze bez utraty funkcjonalnosci, powinno byc mniejsze.
- Nie projektowac duzych pustych sekcji.
- Nie projektowac formularzy wymagajacych przewijania, jesli mozna osiagnac ten sam efekt lepsza siatka.
- Dlugie tresci przenosic do osobnych zakladek albo elastycznych paneli.
- Dolne tabele pozycji maja zajmowac wolna przestrzen robocza.

## Operacje na rekordach

Nadrzedna zasada FIXER WEB:

- dwuklik otwiera albo wybiera rekord,
- Enter zatwierdza zaznaczony rekord,
- menu kontekstowe zawiera operacje rekordu.

Nie dodajemy przyciskow akcji do kazdego wiersza tabeli. Przycisk w wierszu jest dopuszczalny tylko wtedy, gdy istnieje mocne uzasadnienie biznesowe.

## Zakaz modal w modalu

Nie tworzyc sytuacji `modal -> modal -> modal`.

Jezeli trzeba otworzyc kolejna kartoteke albo workflow, preferowac:

- panel boczny,
- drawer,
- osobny workflow,
- przelaczenie widoku,
- zamkniecie aktualnego modala i przejscie do nowej kartoteki.

Przed zaproponowaniem modala w modalu nalezy wskazac, dlaczego nie da sie uzyc innego rozwiazania.

## Tokeny

Tokeny sa zdefiniowane w:

- `src/design-system/tokens.css`
- `src/design-system/tokens.js`

Kategorie tokenow:

- kolory,
- typografia,
- spacing,
- radius,
- shadows,
- wysokosci kontrolek.

## Typografia

- Font: `Inter`, fallback systemowy.
- Topbar H1: 26 px, 800.
- H2 modulu: 25 px, 800.
- H2 modala/kartoteki: 20-22 px, line-height ok. 1.1.
- Tytul panelu: 18-19 px, 800.
- Tytul sekcji: 10-11 px, uppercase, letter-spacing 0.14-0.16 em, 900.
- Label formularza: 13 px, 800.
- Input/select: 14 px, wysokosc 30-34 px w kartotekach.
- Tabela: 13-14 px.
- Naglowek tabeli: 12 px.
- Status pill: 12 px, 800.

## Kolory

- Tlo aplikacji dark: `#080d15`.
- Tlo panelu: `rgba(15,23,42,.76)`.
- Tlo modala/kartoteki: `#0f172a`.
- Tlo sekcji: `rgba(8,13,21,.18-.22)`.
- Border: `rgba(148,163,184,.10-.18)`.
- Primary: gradient `#2563eb -> #4f46e5`.
- Hover: `rgba(96,165,250,.08-.14)`.
- Zaznaczenie: `rgba(59,130,246,.16)` plus lewy pasek.
- Success: zielony.
- Warning: amber.
- Danger/error: czerwony.
- Light theme musi miec osobne definicje.

## Komponenty bazowe

Komponenty sa eksportowane z `src/design-system/index.js`.

- `ButtonPrimary`
- `ButtonSecondary`
- `ButtonDanger`
- `ButtonGhost`
- `IconButton`
- `SectionPanel`
- `ModalFrame`
- `FormField`
- `StatusPill`
- `EmptyState`

Planowane komponenty DS, ktore powinny byc wydzielane podczas migracji:

- `DataTable`
- `ColumnContextMenu`
- `RowContextMenu`
- `BulkActionsBar`
- `ClientPicker`
- `EquipmentPicker`
- `RecordCard`
- `CardTabs`
- `Drawer`
- `Notice`
- `ErrorMessage`

## Przyciski

Primary:

- wysokosc 38-40 px,
- radius 12 px,
- ikona przy akcjach glownych,
- uzycie: dodaj, zapisz, zatwierdz.

Secondary:

- wysokosc 38-40 px,
- radius 12 px,
- border 1 px,
- uzycie: anuluj, odswiez, eksport.

Danger:

- wariant destrukcyjny,
- czerwony tekst/border/hover,
- uzycie: usun, operacje nieodwracalne.

Ghost:

- wysokosc 28-34 px,
- minimalny styl,
- uzycie: akcje pomocnicze w sekcjach.

Icon:

- 36-40 px,
- tylko ikona,
- wymagany opis/tooltip dla nieoczywistych akcji.

## Formularze

- Label zawsze nad polem.
- Pola w kartotekach: 30-34 px.
- Filtry modulow: 38-42 px.
- Textarea tylko tam, gdzie ma sens; duze notatki w osobnej zakladce.
- Bledy inline pod polem.
- Alert tylko dla blokujacych sytuacji.
- Walidacja krotka i po polsku.

## Modale i kartoteki

- Header: eyebrow, H2, close icon.
- Content: sekcje pelnej szerokosci.
- Footer: Secondary przed Primary; Primary jako ostatni.
- Maksymalny rozmiar: viewport minus margines bezpieczenstwa.
- Kartoteki robocze moga byc przesuwalne i skalowalne.
- Pozycja i rozmiar maja byc zapamietywane.
- ESC zamyka, jesli nie ma ryzyka utraty danych.
- Przewijanie tylko tresci albo tabeli.

## Tabele

- Jeden standard: `DataTable`.
- Sticky header.
- Sortowanie.
- Zmiana szerokosci kolumn.
- Zmiana kolejnosci kolumn.
- Ukrywanie/pokazywanie kolumn.
- Menu kontekstowe naglowka.
- Menu kontekstowe wiersza.
- Bulk actions tylko po zaznaczeniu.
- Brak domyslnych akcji w kazdym wierszu.
- Preferowane operacje: dwuklik, Enter, menu kontekstowe.

## Pickery

`ClientPicker`:

- wyszukiwarka,
- sortowanie,
- tabela,
- klik zaznacza,
- dwuklik wybiera,
- Enter wybiera,
- bez przycisku `Wybierz` w kazdym wierszu.

`EquipmentPicker`:

- wyszukiwarka,
- filtry,
- sortowanie,
- tabela,
- multiwybor,
- stopka z `Dodaj wybrane`,
- bez lokalnych wariantow w modulach.

## Standard dla nowych modulow

Dotyczy:

- Wypozyczenia,
- Zwroty,
- Serwis,
- Dashboard,
- Kalendarz,
- Organizer,
- Dokumenty.

Kazdy z tych modulow musi korzystac wylacznie z komponentow DS. Nie wolno tworzyc lokalnych wariantow kontrolek.

Jesli nowy ekran wymaga nowego typu przycisku, formularza, tabeli, modala albo pickera, nalezy opisac:

- dlaczego nie mozna uzyc istniejacego komponentu,
- jakie sa korzysci,
- czy komponent powinien wejsc do Design Systemu.

Domyslna decyzja: uzyj istniejacego komponentu.

## Ekrany wymagajace przebudowy

1. Wypozyczenia.
2. Zwroty, gdy powstana.
3. Serwis.
4. Dashboard.
5. Kalendarz.
6. Organizer.
7. Dokumenty.
8. Ustawienia.
9. Login, niski priorytet.

## Rekomendowana kolejnosc wdrazania

1. Utrzymac tokeny DS jako globalny fundament.
2. Przeniesc istniejace przyciski na komponenty DS.
3. Przeniesc pola i sekcje kartotek na `FormField` i `SectionPanel`.
4. Ustandaryzowac `DataTable` i zapamietywanie stanu tabel.
5. Wydzielic `ClientPicker` i `EquipmentPicker` do DS.
6. Ujednolicic kartoteke klienta i sprzetu na wspolnych klasach.
7. Przebudowac kartoteke wypozyczenia wedlug DS.
8. Dopiero potem rozwijac zwroty i serwis.
9. Na koncu przebudowac dashboard, kalendarz, organizer i dokumenty.
