
do $$
declare
  -- 1) Dirección de tu función (mira el nombre en Edge Functions)
  v_url text := 'https://bphofyuxqltyuklqjwtu.supabase.co/functions/v1/bright-action';

  -- 2) Tu WEBHOOK_SECRET (idéntico al de Edge Functions > Secrets)
  v_secreto text := 'TU-SECRETO';

  v_cab text := json_build_object(
    'Content-Type', 'application/json',
    'x-webhook-secret', v_secreto
  )::text;
  r record;
begin
  if v_secreto = 'TU-SECRETO' then
    raise exception 'Cambia TU-SECRETO por el valor real de WEBHOOK_SECRET';
  end if;

  for r in
    select * from (values
      ('push_pedido_nuevo',  'pedidos',           'insert'),
      ('push_pedido_estado', 'pedidos',           'update of estado'),
      ('push_sesion_nueva',  'sesiones_en_linea', 'insert'),
      ('push_sesion_estado', 'sesiones_en_linea', 'update of estado')
    ) as t(nombre, tabla, evento)
  loop
    execute format('drop trigger if exists %I on public.%I', r.nombre, r.tabla);
    execute format(
      'create trigger %I after %s on public.%I for each row execute function supabase_functions.http_request(%L, %L, %L, %L, %L)',
      r.nombre, r.evento, r.tabla, v_url, 'POST', v_cab, '{}', '5000'
    );
  end loop;
end $$;
