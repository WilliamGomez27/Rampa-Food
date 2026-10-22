-- 1) TABLAS ------------------------------------------------------------

create table entornos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

create table configuracion (
  id uuid primary key default gen_random_uuid(),
  entorno_id uuid not null references entornos(id) on delete cascade,
  clave text not null,
  valor text not null,
  unique (entorno_id, clave)
);

create table puntos_entrega (
  id uuid primary key default gen_random_uuid(),
  entorno_id uuid not null references entornos(id) on delete cascade,
  nombre text not null,
  activo boolean not null default true
);

create table vendedores (
  id uuid primary key references auth.users(id) on delete cascade,
  entorno_id uuid not null references entornos(id),
  nombre text not null,
  whatsapp text not null check (whatsapp ~ '^[0-9]{10}$'),
  categoria text not null check (categoria in ('comida', 'bebidas', 'ambos')),
  foto_url text,
  aprobacion text not null default 'pendiente'
    check (aprobacion in ('pendiente', 'aprobado', 'rechazado')),
  creado_en timestamptz not null default now()
);

create table compradores (
  id uuid primary key references auth.users(id) on delete cascade,
  entorno_id uuid not null references entornos(id),
  nombre text not null,
  telefono text,
  creado_en timestamptz not null default now()
);

create table productos (
  id uuid primary key default gen_random_uuid(),
  vendedor_id uuid not null references vendedores(id) on delete cascade,
  nombre text not null,
  descripcion text,
  precio integer not null check (precio > 0),
  foto_url text,
  agotado boolean not null default false,
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

create table turnos (
  id uuid primary key default gen_random_uuid(),
  vendedor_id uuid not null references vendedores(id) on delete cascade,
  dia_semana smallint not null check (dia_semana between 1 and 7), -- 1 = lunes
  franja text not null check (franja in ('manana', 'tarde', 'noche')),
  hora_inicio time not null,
  hora_fin time not null,
  semana_rotacion smallint not null default 1,
  unique (vendedor_id, dia_semana, franja, semana_rotacion)
);

create table sesiones_en_linea (
  id uuid primary key default gen_random_uuid(),
  vendedor_id uuid not null references vendedores(id) on delete cascade,
  turno_id uuid references turnos(id) on delete set null,
  inicio_real timestamptz not null default now(),
  fin_real timestamptz,
  estado text not null default 'en_linea' check (estado in ('en_linea', 'pausa', 'terminado'))
);

create table pedidos (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated always as identity,
  entorno_id uuid not null references entornos(id),
  comprador_id uuid not null references compradores(id),
  vendedor_id uuid not null references vendedores(id),
  punto_entrega_id uuid not null references puntos_entrega(id),
  forma_pago text not null check (forma_pago in ('efectivo', 'transferencia')),
  nota text,
  total integer not null check (total >= 0),
  estado text not null default 'enviado'
    check (estado in ('enviado', 'aceptado', 'listo', 'entregado', 'rechazado', 'sin_respuesta')),
  motivo_rechazo text,
  creado_en timestamptz not null default now()
);

create table pedido_items (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references pedidos(id) on delete cascade,
  producto_id uuid not null references productos(id),
  cantidad integer not null check (cantidad > 0),
  precio_unitario integer not null check (precio_unitario >= 0)
);

create table pedido_estados (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references pedidos(id) on delete cascade,
  estado text not null,
  motivo text,
  cambiado_en timestamptz not null default now()
);

create table calificaciones (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null unique references pedidos(id) on delete cascade,
  estrellas smallint not null check (estrellas between 1 and 5),
  etiquetas text[] not null default '{}',
  comentario text,
  creado_en timestamptz not null default now()
);

create table avisos (
  id uuid primary key default gen_random_uuid(),
  comprador_id uuid not null references compradores(id) on delete cascade,
  vendedor_id uuid not null references vendedores(id) on delete cascade,
  creado_en timestamptz not null default now(),
  unique (comprador_id, vendedor_id)
);

-- 2) INDICES -----------------------------------------------------------

create index on vendedores (entorno_id);
create index on productos (vendedor_id);
create index on turnos (vendedor_id);
create index on pedidos (vendedor_id, estado, creado_en desc);
create index on pedidos (comprador_id, creado_en desc);
create index on pedido_items (pedido_id);
create index on pedido_estados (pedido_id);
create unique index una_sesion_abierta_por_vendedor
  on sesiones_en_linea (vendedor_id) where fin_real is null;

-- 3) FUNCIONES Y TRIGGERS ------------------------------------------------

-- Entorno del usuario que hace la consulta
create function mi_entorno() returns uuid
language sql stable security definer set search_path = public as $$
  select entorno_id from (
    select entorno_id from vendedores where id = auth.uid()
    union all
    select entorno_id from compradores where id = auth.uid()
  ) t limit 1
$$;

-- Un vendedor no puede aprobarse a si mismo ni cambiar de entorno.
-- (Desde el panel de Supabase auth.uid() es nulo, por eso tu si puedes aprobar.)
create function proteger_vendedor() returns trigger
language plpgsql as $$
begin
  if auth.uid() is not null and (
    new.aprobacion is distinct from old.aprobacion
    or new.entorno_id is distinct from old.entorno_id
  ) then
    raise exception 'No puedes cambiar la aprobacion ni el entorno';
  end if;
  return new;
end $$;

create trigger t_proteger_vendedor
  before update on vendedores
  for each row execute function proteger_vendedor();

-- Del pedido solo se puede cambiar el estado y el motivo de rechazo
create function validar_cambio_pedido() returns trigger
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
  return new;
end $$;

create trigger t_validar_pedido
  before update on pedidos
  for each row execute function validar_cambio_pedido();

-- Historial automatico de estados
create function registrar_estado_pedido() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into pedido_estados (pedido_id, estado) values (new.id, new.estado);
  elsif new.estado is distinct from old.estado then
    insert into pedido_estados (pedido_id, estado, motivo)
    values (new.id, new.estado, new.motivo_rechazo);
  end if;
  return null;
end $$;

create trigger t_estado_pedido
  after insert or update on pedidos
  for each row execute function registrar_estado_pedido();

-- Pasa a "sin_respuesta" los pedidos que superan el tiempo limite.
-- En la Etapa 5 la programaremos para que corra cada minuto.
create function marcar_pedidos_sin_respuesta() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  with vencidos as (
    update pedidos p set estado = 'sin_respuesta'
    where p.estado = 'enviado'
      and p.creado_en < now() - make_interval(mins => coalesce(
        (select c.valor::int from configuracion c
          where c.entorno_id = p.entorno_id and c.clave = 'minutos_respuesta'), 10))
    returning 1
  )
  select count(*) into n from vencidos;
  return n;
end $$;

revoke execute on function marcar_pedidos_sin_respuesta() from public, anon, authenticated;

-- 4) VISTAS ------------------------------------------------------------

-- Vendedores en linea ahora (pantalla de inicio del comprador)
create view vendedores_en_linea with (security_invoker = true) as
select v.id, v.nombre, v.categoria, v.foto_url, s.inicio_real
from vendedores v
join sesiones_en_linea s on s.vendedor_id = v.id
where s.fin_real is null and s.estado = 'en_linea' and v.aprobacion = 'aprobado';

-- Calificacion promedio y tiempo de respuesta (solo datos agregados)
create view vendedores_resumen as
select
  v.id as vendedor_id,
  round(avg(c.estrellas)::numeric, 1) as calificacion_promedio,
  count(c.id) as num_resenas,
  (select round(avg(extract(epoch from (a.cambiado_en - e.cambiado_en)) / 60)::numeric, 1)
     from pedidos p2
     join pedido_estados e on e.pedido_id = p2.id and e.estado = 'enviado'
     join pedido_estados a on a.pedido_id = p2.id and a.estado = 'aceptado'
    where p2.vendedor_id = v.id) as respuesta_min
from vendedores v
left join pedidos p on p.vendedor_id = v.id
left join calificaciones c on c.pedido_id = p.id
where v.entorno_id = mi_entorno()
group by v.id;

-- 5) SEGURIDAD (RLS) ------------------------------------------------------

alter table entornos enable row level security;
alter table configuracion enable row level security;
alter table puntos_entrega enable row level security;
alter table vendedores enable row level security;
alter table compradores enable row level security;
alter table productos enable row level security;
alter table turnos enable row level security;
alter table sesiones_en_linea enable row level security;
alter table pedidos enable row level security;
alter table pedido_items enable row level security;
alter table pedido_estados enable row level security;
alter table calificaciones enable row level security;
alter table avisos enable row level security;

-- Entornos: visibles para elegir el tuyo al registrarte
create policy entornos_ver on entornos for select to authenticated
  using (activo);

create policy configuracion_ver on configuracion for select to authenticated
  using (entorno_id = mi_entorno());

create policy puntos_ver on puntos_entrega for select to authenticated
  using (entorno_id = mi_entorno() and activo);

-- Vendedores
create policy vendedores_ver on vendedores for select to authenticated
  using (id = auth.uid() or (aprobacion = 'aprobado' and entorno_id = mi_entorno()));
create policy vendedores_crear on vendedores for insert to authenticated
  with check (id = auth.uid() and aprobacion = 'pendiente');
create policy vendedores_editar on vendedores for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Compradores
create policy compradores_ver on compradores for select to authenticated
  using (
    id = auth.uid()
    or exists (select 1 from pedidos p
               where p.comprador_id = compradores.id and p.vendedor_id = auth.uid())
  );
create policy compradores_crear on compradores for insert to authenticated
  with check (id = auth.uid());
create policy compradores_editar on compradores for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Productos (no se borran, se desactivan)
create policy productos_ver on productos for select to authenticated
  using (
    vendedor_id = auth.uid()
    or (activo and exists (select 1 from vendedores v where v.id = productos.vendedor_id))
  );
create policy productos_crear on productos for insert to authenticated
  with check (vendedor_id = auth.uid());
create policy productos_editar on productos for update to authenticated
  using (vendedor_id = auth.uid()) with check (vendedor_id = auth.uid());

-- Turnos
create policy turnos_ver on turnos for select to authenticated
  using (
    vendedor_id = auth.uid()
    or exists (select 1 from vendedores v where v.id = turnos.vendedor_id)
  );
create policy turnos_crear on turnos for insert to authenticated
  with check (vendedor_id = auth.uid());
create policy turnos_editar on turnos for update to authenticated
  using (vendedor_id = auth.uid()) with check (vendedor_id = auth.uid());
create policy turnos_borrar on turnos for delete to authenticated
  using (vendedor_id = auth.uid());

-- Sesiones en linea (solo vendedores aprobados)
create policy sesiones_ver on sesiones_en_linea for select to authenticated
  using (
    vendedor_id = auth.uid()
    or exists (select 1 from vendedores v where v.id = sesiones_en_linea.vendedor_id)
  );
create policy sesiones_crear on sesiones_en_linea for insert to authenticated
  with check (
    vendedor_id = auth.uid()
    and exists (select 1 from vendedores v where v.id = auth.uid() and v.aprobacion = 'aprobado')
  );
create policy sesiones_editar on sesiones_en_linea for update to authenticated
  using (vendedor_id = auth.uid()) with check (vendedor_id = auth.uid());

-- Pedidos
create policy pedidos_ver on pedidos for select to authenticated
  using (comprador_id = auth.uid() or vendedor_id = auth.uid());
create policy pedidos_crear on pedidos for insert to authenticated
  with check (
    comprador_id = auth.uid()
    and estado = 'enviado'
    and entorno_id = mi_entorno()
    and exists (select 1 from vendedores v
                where v.id = vendedor_id and v.aprobacion = 'aprobado' and v.entorno_id = pedidos.entorno_id)
  );
create policy pedidos_editar on pedidos for update to authenticated
  using (vendedor_id = auth.uid()) with check (vendedor_id = auth.uid());

-- Items del pedido
create policy items_ver on pedido_items for select to authenticated
  using (exists (select 1 from pedidos p where p.id = pedido_items.pedido_id));
create policy items_crear on pedido_items for insert to authenticated
  with check (exists (select 1 from pedidos p
                      where p.id = pedido_items.pedido_id and p.comprador_id = auth.uid()));

-- Historial de estados (solo lectura; lo escribe el trigger)
create policy estados_ver on pedido_estados for select to authenticated
  using (exists (select 1 from pedidos p where p.id = pedido_estados.pedido_id));

-- Calificaciones (solo el comprador, y solo de pedidos entregados)
create policy calif_ver on calificaciones for select to authenticated
  using (exists (select 1 from pedidos p where p.id = calificaciones.pedido_id));
create policy calif_crear on calificaciones for insert to authenticated
  with check (exists (select 1 from pedidos p
                      where p.id = calificaciones.pedido_id
                        and p.comprador_id = auth.uid()
                        and p.estado = 'entregado'));

-- Avisos ("Avisarme")
create policy avisos_todo on avisos for all to authenticated
  using (comprador_id = auth.uid()) with check (comprador_id = auth.uid());

-- 6) TIEMPO REAL -------------------------------------------------------

alter publication supabase_realtime add table sesiones_en_linea, pedidos, pedido_estados;

-- 7) DATOS DE EJEMPLO ----------------------------------------------------
-- Cambia los nombres de los puntos de entrega por los reales de tu entorno.

with e as (
  insert into entornos (nombre) values ('Entorno piloto') returning id
), c as (
  insert into configuracion (entorno_id, clave, valor)
  select id, 'minutos_respuesta', '10' from e returning 1
)
insert into puntos_entrega (entorno_id, nombre)
select e.id, n
from e, unnest(array['Entrada principal', 'Bloque A', 'Bloque B', 'Zona de descanso']) as n;
