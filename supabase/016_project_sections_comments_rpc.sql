-- FIXER WEB — Aktualizacja restore_fixer_backup o nowe tabele sekcji i komentarzy.

create or replace function public.restore_fixer_backup(p_tables jsonb)
returns void
language plpgsql
security invoker
as $$
declare
  required_tables text[] := array[
    'clients', 'client_types', 'equipment', 'equipment_dictionaries',
    'rentals', 'rental_items', 'service_orders', 'service_order_progress',
    'service_order_attachments', 'service_dictionaries',
    'organizer_categories', 'organizer_tasks', 'calendar_events',
    'projects', 'project_tasks', 'project_task_sections', 'project_task_comments'
  ];
  delete_order text[] := array[
    'service_order_attachments', 'service_order_progress', 'rental_items',
    'calendar_events', 'organizer_tasks',
    'project_task_comments', 'project_tasks', 'project_task_sections', 'projects',
    'service_orders', 'rentals', 'organizer_categories', 'service_dictionaries',
    'equipment_dictionaries', 'client_types', 'equipment', 'clients'
  ];
  insert_order text[] := array[
    'clients', 'equipment', 'client_types', 'equipment_dictionaries',
    'service_dictionaries', 'organizer_categories',
    'projects', 'project_task_sections',
    'rentals', 'rental_items', 'service_orders', 'service_order_progress',
    'service_order_attachments', 'organizer_tasks', 'calendar_events',
    'project_tasks', 'project_task_comments'
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
