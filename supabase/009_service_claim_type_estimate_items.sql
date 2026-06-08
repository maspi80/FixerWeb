-- Typ zgłoszenia serwisowego oraz elastyczne pozycje kosztorysu.
-- Stare pola kosztów pozostają dla zgodności z istniejącymi danymi.

alter table public.service_orders add column if not exists claim_type text default 'Pogwarancyjna';
alter table public.service_orders add column if not exists estimate_items jsonb not null default '[]'::jsonb;

create index if not exists idx_service_orders_claim_type on public.service_orders(claim_type);

notify pgrst, 'reload schema';
