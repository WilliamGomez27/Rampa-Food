
-- 1) Dispositivos que aceptaron recibir avisos
create table if not exists push_suscripciones (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  creado_en timestamptz not null default now()
);
create index if not exists push_susc_usuario on push_suscripciones (usuario_id);

alter table push_suscripciones enable row level security;

drop policy if exists push_ver on push_suscripciones;
create policy push_ver on push_suscripciones for select to authenticated
  using (usuario_id = auth.uid());

drop policy if exists push_borrar on push_suscripciones;
create policy push_borrar on push_suscripciones for delete to authenticated
  using (usuario_id = auth.uid());

-- 2) Registrar un dispositivo (si el celular ya estaba a nombre de otra cuenta, pasa a esta)
create or replace function registrar_push(p_endpoint text, p_p256dh text, p_auth text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'no_autenticado'; end if;
  insert into push_suscripciones (usuario_id, endpoint, p256dh, auth)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update
    set usuario_id = excluded.usuario_id, p256dh = excluded.p256dh, auth = excluded.auth;
end $$;

revoke execute on function registrar_push(text, text, text) from public, anon;
grant execute on function registrar_push(text, text, text) to authenticated;

-- 3) Disparadores: cada evento llama a la función enviar-push
drop trigger if exists push_pedido_nuevo on pedidos;
create trigger push_pedido_nuevo after insert on pedidos
  for each row execute function supabase_functions.http_request(
    'https://TU-PROYECTO.supabase.co/functions/v1/enviar-push', 'POST',
    '{"Content-Type":"application/json","x-webhook-secret":"TU-SECRETO"}', '{}', '5000');

drop trigger if exists push_pedido_estado on pedidos;
create trigger push_pedido_estado after update of estado on pedidos
  for each row execute function supabase_functions.http_request(
    'https://TU-PROYECTO.supabase.co/functions/v1/enviar-push', 'POST',
    '{"Content-Type":"application/json","x-webhook-secret":"TU-SECRETO"}', '{}', '5000');

drop trigger if exists push_sesion_nueva on sesiones_en_linea;
create trigger push_sesion_nueva after insert on sesiones_en_linea
  for each row execute function supabase_functions.http_request(
    'https://TU-PROYECTO.supabase.co/functions/v1/enviar-push', 'POST',
    '{"Content-Type":"application/json","x-webhook-secret":"TU-SECRETO"}', '{}', '5000');

drop trigger if exists push_sesion_estado on sesiones_en_linea;
create trigger push_sesion_estado after update of estado on sesiones_en_linea
  for each row execute function supabase_functions.http_request(
    'https://TU-PROYECTO.supabase.co/functions/v1/enviar-push', 'POST',
    '{"Content-Type":"application/json","x-webhook-secret":"TU-SECRETO"}', '{}', '5000');
