-- FIXER WEB — produkcyjne zabezpieczenia danych.
-- 1) Atomowe tworzenie wypożyczenia z pozycjami i zmianą statusu sprzętu.
-- 2) Transakcyjne odtwarzanie pełnego backupu.

create or replace function public.create_rental_with_items(
  p_rental jsonb,
  p_items  jsonb
)
returns uuid
language plpgsql
security invoker
as $$
declare
  created_rental_id uuid;
  next_equipment_ids uuid[];
begin
  insert into public.rentals (
    rental_number, client_id, status, start_date, planned_return_date,
    actual_return_date, notes, total_deposit, total_price
  )
  values (
    p_rental->>'rental_number',
    (p_rental->>'client_id')::uuid,
    coalesce(nullif(p_rental->>'status',''), 'active'),
    coalesce(nullif(p_rental->>'start_date','')::date, current_date),
    nullif(p_rental->>'planned_return_date','')::date,
    nullif(p_rental->>'actual_return_date','')::date,
    coalesce(p_rental->>'notes', ''),
    nullif(p_rental->>'total_deposit','')::numeric,
    nullif(p_rental->>'total_price','')::numeric
  )
  returning id into created_rental_id;

  insert into public.rental_items (
    rental_id, equipment_id, parent_set_equipment_id, item_type,
    name_snapshot, serial_snapshot, inventory_number_snapshot, barcode_snapshot,
    status, planned_return_date, returned_at,
    price_day, price_week, deposit,
    condition_out, condition_in, damage_notes, settlement_notes
  )
  select
    created_rental_id,
    nullif(i.equipment_id,'')::uuid,
    nullif(i.parent_set_equipment_id,'')::uuid,
    coalesce(nullif(i.item_type,''), 'single'),
    coalesce(nullif(i.name_snapshot,''), 'Sprzęt'),
    i.serial_snapshot,
    i.inventory_number_snapshot,
    i.barcode_snapshot,
    coalesce(nullif(i.status,''), 'issued'),
    nullif(i.planned_return_date,'')::date,
    nullif(i.returned_at,'')::timestamptz,
    i.price_day,
    i.price_week,
    i.deposit,
    i.condition_out, i.condition_in, i.damage_notes, i.settlement_notes
  from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) as i(
    equipment_id text, parent_set_equipment_id text, item_type text,
    name_snapshot text, serial_snapshot text, inventory_number_snapshot text, barcode_snapshot text,
    status text, planned_return_date text, returned_at text,
    price_day numeric, price_week numeric, deposit numeric,
    condition_out text, condition_in text, damage_notes text, settlement_notes text
  );

  select coalesce(array_agg(distinct equipment_id) filter (where equipment_id is not null), array[]::uuid[])
    into next_equipment_ids
  from public.rental_items
  where rental_id = created_rental_id;

  if cardinality(next_equipment_ids) > 0 then
    update public.equipment
      set status = 'Wypożyczony',
          updated_at = now()
    where id = any(next_equipment_ids);
  end if;

  return created_rental_id;
end;
$$;

grant execute on function public.create_rental_with_items(jsonb, jsonb) to authenticated;

create or replace function public.restore_fixer_backup(p_tables jsonb)
returns void
language plpgsql
security invoker
as $$
declare
  required_tables text[] := array[
    'clients',
    'client_types',
    'equipment',
    'equipment_dictionaries',
    'rentals',
    'rental_items',
    'service_orders',
    'service_order_progress',
    'service_order_attachments',
    'service_dictionaries',
    'organizer_categories',
    'organizer_tasks',
    'calendar_events'
  ];
  delete_order text[] := array[
    'service_order_attachments',
    'service_order_progress',
    'rental_items',
    'calendar_events',
    'organizer_tasks',
    'service_orders',
    'rentals',
    'organizer_categories',
    'service_dictionaries',
    'equipment_dictionaries',
    'client_types',
    'equipment',
    'clients'
  ];
  insert_order text[] := array[
    'clients',
    'equipment',
    'client_types',
    'equipment_dictionaries',
    'service_dictionaries',
    'organizer_categories',
    'rentals',
    'rental_items',
    'service_orders',
    'service_order_progress',
    'service_order_attachments',
    'organizer_tasks',
    'calendar_events'
  ];
  table_name text;
  rows jsonb;
begin
  if p_tables is null or jsonb_typeof(p_tables) <> 'object' then
    raise exception 'Backup tables payload is invalid.' using errcode = '22023';
  end if;

  foreach table_name in array required_tables loop
    if not (p_tables ? table_name) then
      raise exception 'Backup does not contain required table: %', table_name using errcode = '22023';
    end if;
    if jsonb_typeof(p_tables->table_name) <> 'array' then
      raise exception 'Backup table % is not an array.', table_name using errcode = '22023';
    end if;
  end loop;

  foreach table_name in array delete_order loop
    execute format('delete from public.%I', table_name);
  end loop;

  foreach table_name in array insert_order loop
    rows := p_tables->table_name;
    if jsonb_array_length(rows) > 0 then
      execute format(
        'insert into public.%1$I select * from jsonb_populate_recordset(null::public.%1$I, $1)',
        table_name
      )
      using rows;
    end if;
  end loop;
end;
$$;

grant execute on function public.restore_fixer_backup(jsonb) to authenticated;

notify pgrst, 'reload schema';
