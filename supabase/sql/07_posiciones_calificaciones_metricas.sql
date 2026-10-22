

-- 1) PUNTOS DE ENTREGA: "P30 (punto de encuentro)", "Entrada principal" y "Escribir mi posición"
alter table puntos_entrega add column if not exists es_posicion boolean not null default false;
alter table pedidos add column if not exists posicion text;

-- Se desactivan (no se borran) los demás puntos fijos, para no perder pedidos antiguos
update puntos_entrega set activo = false
where es_posicion = false
  and nombre not in ('P30 (punto de encuentro)', 'Entrada principal');

-- Se asegura que existan los dos puntos fijos
insert into puntos_entrega (entorno_id, nombre)
select e.id, n
from entornos e, unnest(array['P30 (punto de encuentro)', 'Entrada principal']) as n
where not exists (select 1 from puntos_entrega p where p.entorno_id = e.id and p.nombre = n);

update puntos_entrega set activo = true
where nombre in ('P30 (punto de encuentro)', 'Entrada principal');

-- Punto especial: el comprador escribe su posición
update puntos_entrega set nombre = 'Escribir mi posición', activo = true where es_posicion = true;

insert into puntos_entrega (entorno_id, nombre, es_posicion)
select e.id, 'Escribir mi posición', true
from entornos e
where not exists (select 1 from puntos_entrega p where p.entorno_id = e.id and p.es_posicion);

-- Posiciones válidas: del 1 al 100, de E1 a E29 y de F1 a F20 (se compara en mayúsculas)
insert into configuracion (entorno_id, clave, valor)
select id, 'patron_posicion', '^(100|[1-9][0-9]?|E([1-9]|1[0-9]|2[0-9])|F([1-9]|1[0-9]|20))$' from entornos
on conflict (entorno_id, clave) do update set valor = excluded.valor;

-- 2) crear_pedido: ahora recibe la posición y la valida
drop function if exists crear_pedido(uuid, uuid, text, text, jsonb);

create or replace function crear_pedido(
  p_vendedor uuid, p_punto uuid, p_pago text, p_nota text, p_items jsonb,
  p_posicion text default null
) returns jsonb
language plpgsql set search_path = public as $$
declare
  v_entorno uuid := mi_entorno();
  v_total integer := 0;
  v_pedido_id uuid;
  v_numero bigint;
  v_es_pos boolean;
  v_pos text;
  v_patron text;
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

  select es_posicion into v_es_pos
    from puntos_entrega where id = p_punto and entorno_id = v_entorno and activo;
  if not found then raise exception 'punto_invalido'; end if;

  if v_es_pos then
    v_pos := upper(trim(coalesce(p_posicion, '')));
    select coalesce(
      (select valor from configuracion where entorno_id = v_entorno and clave = 'patron_posicion'),
      '^(100|[1-9][0-9]?|E([1-9]|1[0-9]|2[0-9])|F([1-9]|1[0-9]|20))$') into v_patron;
    if v_pos !~ v_patron then raise exception 'posicion_invalida'; end if;
  end if;

  for it in select * from jsonb_array_elements(p_items) loop
    cant := (it->>'cantidad')::int;
    select * into prod from productos
     where id = (it->>'producto_id')::uuid and vendedor_id = p_vendedor and activo and not agotado;
    if not found or cant is null or cant <= 0 then raise exception 'producto_invalido'; end if;
    v_total := v_total + prod.precio * cant;
  end loop;

  insert into pedidos (entorno_id, comprador_id, vendedor_id, punto_entrega_id, posicion, forma_pago, nota, total)
  values (v_entorno, auth.uid(), p_vendedor, p_punto, v_pos, p_pago, nullif(trim(p_nota), ''), v_total)
  returning id, numero into v_pedido_id, v_numero;

  for it in select * from jsonb_array_elements(p_items) loop
    cant := (it->>'cantidad')::int;
    select * into prod from productos where id = (it->>'producto_id')::uuid;
    insert into pedido_items (pedido_id, producto_id, cantidad, precio_unitario, nombre)
    values (v_pedido_id, prod.id, cant, prod.precio, prod.nombre);
  end loop;

  return jsonb_build_object('id', v_pedido_id, 'numero', v_numero, 'total', v_total);
end $$;

revoke execute on function crear_pedido(uuid, uuid, text, text, jsonb, text) from public, anon;
grant execute on function crear_pedido(uuid, uuid, text, text, jsonb, text) to authenticated;

-- La posición también queda protegida contra cambios (se amplía el control del pedido)
create or replace function validar_cambio_pedido() returns trigger
language plpgsql as $$
begin
  if new.entorno_id is distinct from old.entorno_id
     or new.comprador_id is distinct from old.comprador_id
     or new.vendedor_id is distinct from old.vendedor_id
     or new.punto_entrega_id is distinct from old.punto_entrega_id
     or new.posicion is distinct from old.posicion
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

-- 3) CALIFICACIONES: el vendedor también califica al comprador
create table if not exists calificaciones_comprador (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null unique references pedidos(id) on delete cascade,
  estrellas smallint not null check (estrellas between 1 and 5),
  etiquetas text[] not null default '{}',
  comentario text,
  creado_en timestamptz not null default now()
);

alter table calificaciones_comprador enable row level security;

drop policy if exists calif_comp_ver on calificaciones_comprador;
create policy calif_comp_ver on calificaciones_comprador for select to authenticated
  using (exists (select 1 from pedidos p
                 where p.id = calificaciones_comprador.pedido_id and p.vendedor_id = auth.uid()));

drop policy if exists calif_comp_crear on calificaciones_comprador;
create policy calif_comp_crear on calificaciones_comprador for insert to authenticated
  with check (exists (select 1 from pedidos p
                      where p.id = calificaciones_comprador.pedido_id
                        and p.vendedor_id = auth.uid()
                        and p.estado = 'entregado'));

alter table calificaciones_comprador drop constraint if exists calif_comp_comentario_largo;
alter table calificaciones_comprador add constraint calif_comp_comentario_largo
  check (comentario is null or char_length(comentario) <= 300);

alter table calificaciones drop constraint if exists calificaciones_comentario_largo;
alter table calificaciones add constraint calificaciones_comentario_largo
  check (comentario is null or char_length(comentario) <= 300);

-- 4) ADMINISTRADOR Y MÉTRICAS
create table if not exists administradores (
  usuario_id uuid primary key references auth.users(id) on delete cascade
);
alter table administradores enable row level security;  -- sin políticas: solo se usa mediante funciones

create or replace function es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from administradores where usuario_id = auth.uid())
$$;
revoke execute on function es_admin() from public, anon;
grant execute on function es_admin() to authenticated;

-- p_dias: 1 = hoy, 7, 30... ; 0 = todo el historial. Zona horaria de Colombia.
create or replace function admin_metricas(p_dias integer default 7) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  tz constant text := 'America/Bogota';
  v_hoy date := (now() at time zone tz)::date;
  v_desde date;
  r jsonb;
begin
  if not es_admin() then raise exception 'no_autorizado'; end if;

  if p_dias is not null and p_dias > 0 then
    v_desde := v_hoy - (p_dias - 1);
  else
    select coalesce(min((creado_en at time zone tz)::date), v_hoy) into v_desde from pedidos;
  end if;

  with ped as (
    select * from pedidos where (creado_en at time zone tz)::date >= v_desde
  ),
  resp as (
    select avg(extract(epoch from (a.cambiado_en - e.cambiado_en)) / 60) as minutos
    from ped p
    join pedido_estados e on e.pedido_id = p.id and e.estado = 'enviado'
    join pedido_estados a on a.pedido_id = p.id and a.estado = 'aceptado'
  ),
  dias as (
    select generate_series(v_desde, v_hoy, interval '1 day')::date as d
  ),
  horas as (
    select generate_series(0, 23) as h
  ),
  conteo as (
    select d.d, h.h, count(p.id) as n
    from dias d cross join horas h
    left join ped p
      on (p.creado_en at time zone tz)::date = d.d
     and extract(hour from p.creado_en at time zone tz)::int = h.h
    group by d.d, h.h
  ),
  por_hora as (
    select h,
           min(n) as minimo,
           percentile_cont(0.25) within group (order by n) as q1,
           percentile_cont(0.75) within group (order by n) as q3,
           max(n) as maximo,
           sum(n) as total
    from conteo
    group by h
  )
  select jsonb_build_object(
    'desde', v_desde,
    'hasta', v_hoy,
    'kpis', jsonb_build_object(
      'pedidos',         (select count(*) from ped),
      'entregados',      (select count(*) from ped where estado = 'entregado'),
      'rechazados',      (select count(*) from ped where estado = 'rechazado'),
      'sin_respuesta',   (select count(*) from ped where estado = 'sin_respuesta'),
      'en_curso',        (select count(*) from ped where estado in ('enviado', 'aceptado', 'listo')),
      'compradores',     (select count(distinct comprador_id) from ped),
      'vendedores',      (select count(distinct vendedor_id) from ped),
      'ticket_promedio', (select coalesce(round(avg(total)), 0) from ped where estado = 'entregado'),
      'respuesta_min',   (select round(minutos::numeric, 1) from resp)
    ),
    'por_estado', (
      select coalesce(jsonb_agg(jsonb_build_object('nombre', estado, 'n', n) order by n desc), '[]'::jsonb)
      from (select estado, count(*) as n from ped group by estado) x
    ),
    'por_pago', (
      select coalesce(jsonb_agg(jsonb_build_object('nombre', forma_pago, 'n', n) order by n desc), '[]'::jsonb)
      from (select forma_pago, count(*) as n from ped group by forma_pago) x
    ),
    'ranking_vendedores', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'nombre', nombre, 'pedidos', pedidos, 'promedio', promedio, 'resenas', resenas)
             order by pedidos desc), '[]'::jsonb)
      from (
        select v.nombre,
               count(distinct p.id) as pedidos,
               round(avg(c.estrellas)::numeric, 1) as promedio,
               count(c.id) as resenas
        from ped p
        join vendedores v on v.id = p.vendedor_id
        left join calificaciones c on c.pedido_id = p.id
        group by v.id, v.nombre
      ) x
    ),
    'cal_vendedores', (
      select coalesce(jsonb_agg(jsonb_build_object('estrellas', estrellas, 'n', n) order by estrellas), '[]'::jsonb)
      from (select c.estrellas, count(*) as n
            from calificaciones c join ped p on p.id = c.pedido_id
            group by c.estrellas) x
    ),
    'cal_compradores', (
      select coalesce(jsonb_agg(jsonb_build_object('estrellas', estrellas, 'n', n) order by estrellas), '[]'::jsonb)
      from (select c.estrellas, count(*) as n
            from calificaciones_comprador c join ped p on p.id = c.pedido_id
            group by c.estrellas) x
    ),
    'por_hora', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'hora', h, 'min', minimo, 'q1', q1, 'q3', q3, 'max', maximo, 'total', total)
             order by h), '[]'::jsonb)
      from por_hora
    )
  ) into r;

  return r;
end $$;

revoke execute on function admin_metricas(integer) from public, anon;
grant execute on function admin_metricas(integer) to authenticated;

-- Para activarte como administrador: crea tu cuenta en  tu-app/#admin,
-- copia tu id en Authentication > Users y ejecuta (con tu id real):
--   insert into administradores (usuario_id) values ('PEGA-AQUI-TU-UUID');
