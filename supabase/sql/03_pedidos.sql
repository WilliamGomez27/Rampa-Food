-- =====================================================================
-- Etapa 5: pedido de punta a punta (Supabase > SQL Editor > Run)
-- Antes de ejecutarlo: Database > Extensions > activa "pg_cron"
-- =====================================================================

-- 1) El historial del pedido guarda el nombre del producto tal como se vendió
alter table pedido_items add column if not exists nombre text;

-- 2) Crear pedido: el servidor calcula precios y total, y valida todo
create or replace function crear_pedido(
  p_vendedor uuid, p_punto uuid, p_pago text, p_nota text, p_items jsonb
) returns jsonb
language plpgsql set search_path = public as $$
declare
  v_entorno uuid := mi_entorno();
  v_total integer := 0;
  v_pedido_id uuid;
  v_numero bigint;
  it jsonb;
  prod productos%rowtype;
  cant integer;
begin
  if auth.uid() is null then raise exception 'no_autenticado'; end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then raise exception 'pedido_vacio'; end if;

  if not exists (
    select 1 from sesiones_en_linea s
    join vendedores v on v.id = s.vendedor_id
    where s.vendedor_id = p_vendedor and s.fin_real is null and s.estado = 'en_linea'
      and v.aprobacion = 'aprobado' and v.entorno_id = v_entorno
  ) then raise exception 'vendedor_no_disponible'; end if;

  if not exists (
    select 1 from puntos_entrega where id = p_punto and entorno_id = v_entorno and activo
  ) then raise exception 'punto_invalido'; end if;

  for it in select * from jsonb_array_elements(p_items) loop
    cant := (it->>'cantidad')::int;
    select * into prod from productos
     where id = (it->>'producto_id')::uuid and vendedor_id = p_vendedor and activo and not agotado;
    if not found or cant is null or cant <= 0 then raise exception 'producto_invalido'; end if;
    v_total := v_total + prod.precio * cant;
  end loop;

  insert into pedidos (entorno_id, comprador_id, vendedor_id, punto_entrega_id, forma_pago, nota, total)
  values (v_entorno, auth.uid(), p_vendedor, p_punto, p_pago, nullif(trim(p_nota), ''), v_total)
  returning id, numero into v_pedido_id, v_numero;

  for it in select * from jsonb_array_elements(p_items) loop
    cant := (it->>'cantidad')::int;
    select * into prod from productos where id = (it->>'producto_id')::uuid;
    insert into pedido_items (pedido_id, producto_id, cantidad, precio_unitario, nombre)
    values (v_pedido_id, prod.id, cant, prod.precio, prod.nombre);
  end loop;

  return jsonb_build_object('id', v_pedido_id, 'numero', v_numero, 'total', v_total);
end $$;

revoke execute on function crear_pedido(uuid, uuid, text, text, jsonb) from public, anon;
grant execute on function crear_pedido(uuid, uuid, text, text, jsonb) to authenticated;

-- 3) Solo se permiten estas transiciones de estado (las tareas automáticas no tienen auth.uid())
create or replace function validar_cambio_pedido() returns trigger
language plpgsql as $$
begin
  if new.entorno_id is distinct from old.entorno_id
     or new.comprador_id is distinct from old.comprador_id
     or new.vendedor_id is distinct from old.vendedor_id
     or new.punto_entrega_id is distinct from old.punto_entrega_id
     or new.forma_pago is distinct from old.forma_pago
     or new.nota is distinct from old.nota
     or new.total is distinct from old.total
     or new.creado_en is distinct from old.creado_en then
    raise exception 'Solo se puede cambiar el estado del pedido';
  end if;

  if auth.uid() is not null and new.estado is distinct from old.estado then
    if not (
      (old.estado = 'enviado' and new.estado in ('aceptado', 'rechazado'))
      or (old.estado = 'aceptado' and new.estado = 'listo')
      or (old.estado = 'listo' and new.estado = 'entregado')
    ) then
      raise exception 'Cambio de estado no permitido';
    end if;
  end if;
  return new;
end $$;

-- 4) Cierre automático de turnos vencidos
-- Zona horaria de los turnos: cámbiala si tu entorno no está en Colombia
create or replace function cerrar_sesiones_vencidas() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  with cerradas as (
    update sesiones_en_linea s
       set fin_real = now(), estado = 'terminado'
      from (
        select s2.id
          from sesiones_en_linea s2
          left join turnos t on t.id = s2.turno_id
         where s2.fin_real is null
           and (
             s2.inicio_real < now() - interval '12 hours'
             or (t.id is not null and (
                  (s2.inicio_real at time zone 'America/Bogota')::date < (now() at time zone 'America/Bogota')::date
                  or (now() at time zone 'America/Bogota')::time >= t.hora_fin
             ))
           )
      ) v
     where s.id = v.id
    returning 1
  )
  select count(*) into n from cerradas;
  return n;
end $$;

revoke execute on function cerrar_sesiones_vencidas() from public, anon, authenticated;

-- 5) Tareas programadas: cada minuto
create extension if not exists pg_cron;

select cron.schedule('pedidos-sin-respuesta', '* * * * *', 'select public.marcar_pedidos_sin_respuesta()');
select cron.schedule('cerrar-turnos-vencidos', '* * * * *', 'select public.cerrar_sesiones_vencidas()');
