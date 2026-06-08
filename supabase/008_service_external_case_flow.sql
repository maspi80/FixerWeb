-- Moduł Serwis jako rejestr reklamacji i zgłoszeń klientów.
-- Dodaje obsługę serwisów zewnętrznych oraz szablony wpisów postępu.

alter table public.service_orders add column if not exists external_service text;
alter table public.service_orders add column if not exists external_rma_number text;
alter table public.service_orders add column if not exists external_sent_date date;
alter table public.service_orders add column if not exists external_return_date date;
alter table public.service_orders add column if not exists external_cost numeric(12,2);
alter table public.service_orders add column if not exists external_notes text;

alter table public.service_dictionaries
    drop constraint if exists service_dictionaries_dictionary_type_check;

alter table public.service_dictionaries
    add constraint service_dictionaries_dictionary_type_check
    check (dictionary_type in ('status', 'priority', 'customer_device_category', 'intake_condition', 'external_service', 'progress_template'));

insert into public.service_dictionaries (dictionary_type, name, sort_order)
values
    ('external_service', 'Sony Polska', 1),
    ('external_service', 'Panasonic Polska', 2),
    ('external_service', 'Foto-Technika', 3),
    ('external_service', 'CSE', 4),
    ('external_service', 'Własny serwis', 5),
    ('progress_template', 'Wysłano do serwisu zewnętrznego', 1),
    ('progress_template', 'Otrzymano kosztorys', 2),
    ('progress_template', 'Oczekiwanie na decyzję klienta', 3),
    ('progress_template', 'Naprawa zakończona', 4),
    ('progress_template', 'Sprzęt gotowy do odbioru', 5),
    ('progress_template', 'Klient poinformowany telefonicznie', 6)
on conflict (dictionary_type, name) do nothing;

create index if not exists idx_service_orders_external_service on public.service_orders(external_service);
create index if not exists idx_service_orders_external_sent_date on public.service_orders(external_sent_date);
create index if not exists idx_service_orders_external_return_date on public.service_orders(external_return_date);

notify pgrst, 'reload schema';
