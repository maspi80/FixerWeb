-- Ręczna kolejność notatek na liście.

alter table public.notes add column if not exists sort_order integer;

with ordered_notes as (
  select id, row_number() over (
    order by pinned desc, updated_at desc nulls last, created_at desc nulls last, id
  ) * 100 as position
  from public.notes
)
update public.notes as notes
set sort_order = ordered_notes.position
from ordered_notes
where notes.id = ordered_notes.id
  and notes.sort_order is null;

alter table public.notes alter column sort_order set default 100;
alter table public.notes alter column sort_order set not null;

create index if not exists idx_notes_sort_order on public.notes(sort_order);

notify pgrst, 'reload schema';
