-- =====================================================================
-- Etapa 5b: compradores sin registro (acceso anónimo)
-- Antes: Authentication > Sign In / Providers > activa "Allow anonymous sign-ins"
-- Supabase > SQL Editor > New query > pega todo > Run
-- =====================================================================

-- 1) El nombre del comprador es opcional hasta su primer pedido
alter table compradores alter column nombre drop not null;
alter table compradores drop constraint if exists compradores_nombre_largo;
alter table compradores add constraint compradores_nombre_largo
  check (nombre is null or char_length(trim(nombre)) between 1 and 40);

-- 2) Las cuentas anónimas NO pueden registrarse como vendedores
drop policy if exists vendedores_crear on vendedores;
create policy vendedores_crear on vendedores for insert to authenticated
  with check (
    id = auth.uid()
    and aprobacion = 'pendiente'
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );

-- 3) crear_pedido: exige nombre y limita a 2 pedidos activos por comprador
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

  if not exists (select 1 from compradores where id = auth.uid() and nombre is not null) then
    raise exception 'nombre_requerido';
  end if;

  if (select count(*) from pedidos
       where comprador_id = auth.uid() and estado in ('enviado', 'aceptado', 'listo')) >= 2 then
    raise exception 'demasiados_pedidos';
  end if;

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
