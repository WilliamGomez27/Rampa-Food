// Edge Function "enviar-push" v2: recibe eventos de la base de datos y envía notificaciones.
// Secretos necesarios: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, WEBHOOK_SECRET
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const SECRETO = Deno.env.get('WEBHOOK_SECRET') ?? ''

const faltan = ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT', 'WEBHOOK_SECRET']
  .filter((k) => !Deno.env.get(k))
let errorVapid = ''
if (faltan.length > 0) {
  errorVapid = 'Faltan secretos: ' + faltan.join(', ')
  console.error(errorVapid)
} else {
  try {
    webpush.setVapidDetails(
      Deno.env.get('VAPID_SUBJECT')!,
      Deno.env.get('VAPID_PUBLIC_KEY')!,
      Deno.env.get('VAPID_PRIVATE_KEY')!,
    )
  } catch (e) {
    errorVapid = 'Claves VAPID inválidas: ' + (e as Error).message
    console.error(errorVapid)
  }
}

const db = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

type Aviso = { usuarios: string[]; title: string; body: string; url?: string; tag?: string }
type Resultado = { suscripciones: number; enviadas: number; errores: string[] }

const precio = (n: number) => '$' + Math.round(n).toLocaleString('es-CO')

async function armar(p: any): Promise<{ avisos: Aviso[]; limpiarAvisosDe?: string }> {
  const r = p.record
  const o = p.old_record

  // 0) Prueba manual desde SQL
  if (p.type === 'PRUEBA') {
    return {
      avisos: [{
        usuarios: [p.usuario_id],
        title: 'Prueba de avisos',
        body: 'Si ves esto, las notificaciones funcionan.',
        tag: 'prueba',
      }],
    }
  }

  // 1) Pedido nuevo -> avisa al vendedor
  if (p.table === 'pedidos' && p.type === 'INSERT') {
    return {
      avisos: [{
        usuarios: [r.vendedor_id],
        title: 'Pedido nuevo',
        body: `n.º ${r.numero} · ${precio(r.total)}. Responde antes de que venza.`,
        tag: 'pedido-' + r.id,
      }],
    }
  }

  // 2) Cambia el estado de un pedido -> avisa al comprador (y al vendedor si venció)
  if (p.table === 'pedidos' && p.type === 'UPDATE' && o?.estado !== r.estado) {
    const { data: v } = await db.from('vendedores').select('nombre').eq('id', r.vendedor_id).maybeSingle()
    const nombre = v?.nombre ?? 'El vendedor'
    const tag = 'pedido-' + r.id

    if (r.estado === 'aceptado') {
      return { avisos: [{ usuarios: [r.comprador_id], title: 'Pedido aceptado', body: `${nombre} aceptó tu pedido n.º ${r.numero}.`, tag }] }
    }
    if (r.estado === 'listo') {
      const { data: pu } = await db.from('puntos_entrega').select('nombre').eq('id', r.punto_entrega_id).maybeSingle()
      return { avisos: [{ usuarios: [r.comprador_id], title: 'Tu pedido está listo', body: `El pedido n.º ${r.numero} va hacia ${r.posicion ? 'la posición ' + r.posicion : (pu?.nombre ?? 'tu punto de entrega')}.`, tag }] }
    }
    if (r.estado === 'entregado') {
      return { avisos: [{ usuarios: [r.comprador_id], title: 'Pedido entregado', body: `Tu pedido n.º ${r.numero} fue entregado. Buen provecho.`, tag }] }
    }
    if (r.estado === 'rechazado') {
      const motivo = r.motivo_rechazo ? ` Motivo: ${r.motivo_rechazo}.` : ''
      return { avisos: [{ usuarios: [r.comprador_id], title: 'Pedido no aceptado', body: `${nombre} no pudo aceptar tu pedido n.º ${r.numero}.${motivo}`, tag }] }
    }
    if (r.estado === 'sin_respuesta') {
      return {
        avisos: [
          { usuarios: [r.comprador_id], title: 'Sin respuesta', body: `${nombre} no respondió a tiempo. Puedes pedir a otro vendedor.`, tag },
          { usuarios: [r.vendedor_id], title: 'Pedido vencido', body: `El pedido n.º ${r.numero} venció sin respuesta.`, tag },
        ],
      }
    }
    return { avisos: [] }
  }

  // 3) Un vendedor se conecta -> avisa a quienes pidieron "Avisarme"
  if (p.table === 'sesiones_en_linea') {
    const seConecta = r.estado === 'en_linea' && !r.fin_real && (p.type === 'INSERT' || o?.estado !== 'en_linea')
    if (seConecta) {
      const { data: v } = await db.from('vendedores').select('nombre').eq('id', r.vendedor_id).maybeSingle()
      const { data: av } = await db.from('avisos').select('comprador_id').eq('vendedor_id', r.vendedor_id)
      const usuarios = (av ?? []).map((a: any) => a.comprador_id)
      return {
        avisos: [{
          usuarios,
          title: `${v?.nombre ?? 'Un vendedor'} está en línea`,
          body: 'Ya puedes hacer tu pedido.',
          tag: 'linea-' + r.vendedor_id,
        }],
        limpiarAvisosDe: r.vendedor_id,
      }
    }
  }

  return { avisos: [] }
}

async function enviar(a: Aviso): Promise<Resultado> {
  const res: Resultado = { suscripciones: 0, enviadas: 0, errores: [] }
  if (a.usuarios.length === 0) return res

  const { data: subs, error } = await db
    .from('push_suscripciones')
    .select('endpoint, p256dh, auth')
    .in('usuario_id', a.usuarios)
  if (error) {
    res.errores.push('base de datos: ' + error.message)
    return res
  }
  res.suscripciones = subs?.length ?? 0

  const carga = JSON.stringify({ title: a.title, body: a.body, url: a.url ?? '/', tag: a.tag })

  await Promise.all((subs ?? []).map(async (s: any) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, carga)
      res.enviadas++
    } catch (e) {
      const codigo = (e as any)?.statusCode
      res.errores.push(String(codigo ?? (e as Error).message))
      if (codigo === 404 || codigo === 410) {
        // el dispositivo ya no existe: se elimina
        await db.from('push_suscripciones').delete().eq('endpoint', s.endpoint)
      }
    }
  }))
  return res
}

Deno.serve(async (req) => {
  if (!SECRETO || req.headers.get('x-webhook-secret') !== SECRETO) {
    console.error('Secreto incorrecto o ausente')
    return new Response('No autorizado', { status: 401 })
  }
  if (errorVapid) return new Response(errorVapid, { status: 500 })

  try {
    const p = await req.json()
    const { avisos, limpiarAvisosDe } = await armar(p)

    const total: Resultado = { suscripciones: 0, enviadas: 0, errores: [] }
    for (const a of avisos) {
      const r = await enviar(a)
      total.suscripciones += r.suscripciones
      total.enviadas += r.enviadas
      total.errores.push(...r.errores)
    }
    if (limpiarAvisosDe) await db.from('avisos').delete().eq('vendedor_id', limpiarAvisosDe)

    const resumen = { evento: `${p.table ?? 'prueba'}:${p.type}`, avisos: avisos.length, ...total }
    console.log(JSON.stringify(resumen))
    return new Response(JSON.stringify(resumen), { headers: { 'Content-Type': 'application/json' } })
  } catch (e) {
    console.error(e)
    return new Response('error: ' + (e as Error).message, { status: 500 })
  }
})
