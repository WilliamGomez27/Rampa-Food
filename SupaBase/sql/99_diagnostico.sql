-- =====================================================================
-- Diagnóstico de notificaciones. Ejecuta cada consulta POR SEPARADO
-- (selecciona una y pulsa Run) y mira el resultado.
-- =====================================================================

-- 1) ¿Existen los 4 disparadores? Deben salir 4 filas.
select tgname as disparador, tgrelid::regclass as tabla
from pg_trigger
where tgname like 'push_%' and not tgisinternal;

-- 2) ¿Qué dispositivos están registrados? Debe haber al menos una fila de vendedor y una de comprador.
select s.usuario_id,
       case when v.id is not null then 'vendedor'
            when c.id is not null then 'comprador' else 'desconocido' end as rol,
       left(s.endpoint, 45) as dispositivo,
       s.creado_en
from push_suscripciones s
left join vendedores v on v.id = s.usuario_id
left join compradores c on c.id = s.usuario_id
order by s.creado_en desc;

-- 3) ¿Qué respondió la función en las últimas llamadas?
--    200 = bien (mira "respuesta"), 401 = secreto o JWT, 404 = dirección mal, 500 = error interno
select id, status_code, left(content::text, 300) as respuesta, error_msg, created
from net._http_response
order by created desc
limit 10;

-- 4) PRUEBA MANUAL: envía un aviso de prueba a un usuario.
--    Reemplaza TU-SECRETO y el UUID (copia un usuario_id de la consulta 2).
--    Luego repite la consulta 3 para ver el resultado.
select net.http_post(
  url := 'https://bphofyuxqltyuklqjwtu.supabase.co/functions/v1/enviar-push',
  headers := '{"Content-Type":"application/json","x-webhook-secret":"TU-SECRETO"}'::jsonb,
  body := '{"type":"PRUEBA","usuario_id":"PEGA-AQUI-EL-UUID"}'::jsonb
);
