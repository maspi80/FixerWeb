create or replace function public.update_rental_with_items(
  p_rental_id uuid,
  p_rental    jsonb,
  p_items     jsonb
)
returns void
language plpgsql
security invoker
as $$
declare
  previous_equipment_ids uuid[];
  next_equipment_ids uuid[];
  removed_equipment_ids uuid[];
begin
  select coalesce(array_agg(distinct equipment_id) filter (where equipment_id is not null), array[]::uuid[])
    into previous_equipment_ids
  from public.rental_items
  where rental_id = p_rental_id;

  update public.rentals set
    rental_number       = p_rental->>'rental_number',
    client_id           = (p_rental->>'client_id')::uuid,
    status              = p_rental->>'status',
    start_date          = (p_rental->>'start_date')::date,
    planned_return_date = nullif(p_rental->>'planned_return_date','')::date,
    actual_return_date  = nullif(p_rental->>'actual_return_date','')::date,
    notes               = p_rental->>'notes',
    total_deposit       = nullif(p_rental->>'total_deposit','')::numeric,
    total_price         = nullif(p_rental->>'total_price','')::numeric,
    vat_rate            = coalesce(nullif(p_rental->>'vat_rate',''), '23'),
    updated_at          = now()
  where id = p_rental_id;

  if not found then
    raise exception 'Rental % was not found.', p_rental_id using errcode = 'P0002';
  end if;

  delete from public.rental_items where rental_id = p_rental_id;

  insert into public.rental_items (
    rental_id, equipment_id, parent_set_equipment_id, item_type,
    name_snapshot, serial_snapshot, inventory_number_snapshot, barcode_snapshot,
    status, planned_return_date, returned_at,
    price_day, price_week, deposit,
    condition_out, condition_in, damage_notes, settlement_notes
  )
  select
    p_rental_id,
    nullif(i.equipment_id,'')::uuid,
    nullif(i.parent_set_equipment_id,'')::uuid,
    i.item_type,
    i.name_snapshot, i.serial_snapshot, i.inventory_number_snapshot, i.barcode_snapshot,
    i.status,
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
  where rental_id = p_rental_id;

  if cardinality(next_equipment_ids) > 0 then
    update public.equipment
      set status = 'Wypożyczony',
          updated_at = now()
    where id = any(next_equipment_ids);
  end if;

  select coalesce(array_agg(id), array[]::uuid[])
    into removed_equipment_ids
  from unnest(previous_equipment_ids) as previous(id)
  where not (previous.id = any(next_equipment_ids))
    and not exists (
      select 1
      from public.rental_items ri
      where ri.equipment_id = previous.id
        and ri.status = 'issued'
    );

  if cardinality(removed_equipment_ids) > 0 then
    update public.equipment
      set status = 'Dostępny',
          updated_at = now()
    where id = any(removed_equipment_ids);
  end if;
end;
$$;

grant execute on function public.update_rental_with_items(uuid, jsonb, jsonb) to authenticated;
