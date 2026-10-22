import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../supabase'
import { precioTexto } from '../../lib/utils'
import FormCalificacion from '../../components/FormCalificacion'

const PASOS = [
  { k: 'enviado', t: 'Enviado' },
  { k: 'aceptado', t: 'Aceptado' },
  { k: 'listo', t: 'Listo para entregar' },
  { k: 'entregado', t: 'Entregado' },
]
const ETIQUETAS_VENDEDOR = ['Rápido', 'Buena comida', 'Buen precio', 'Amable']

export default function Seguimiento({ pedido, onInicio }) {
  const [p, setP] = useState(null)
  const [limite, setLimite] = useState(10)
  const [yaCalifico, setYaCalifico] = useState(null) // null = verificando

  const cargar = useCallback(async () => {
    const { data } = await supabase
      .from('pedidos')
      .select('*, vendedores(nombre), puntos_entrega(nombre), pedido_items(cantidad, nombre)')
      .eq('id', pedido.id).single()
    setP(data)
  }, [pedido.id])

  useEffect(() => {
    cargar()
    supabase.from('configuracion').select('valor').eq('clave', 'minutos_respuesta').maybeSingle()
      .then(({ data }) => { if (data) setLimite(Number(data.valor) || 10) })
    const canal = supabase
      .channel('seg-' + pedido.id)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'pedidos', filter: `id=eq.${pedido.id}` },
        () => cargar())
      .subscribe()
    const timer = setInterval(cargar, 30000) // respaldo por si se pierde la conexión
    return () => { supabase.removeChannel(canal); clearInterval(timer) }
  }, [pedido.id, cargar])

  const entregado = p?.estado === 'entregado'
  useEffect(() => {
    if (!entregado) return
    supabase.from('calificaciones').select('id').eq('pedido_id', pedido.id).maybeSingle()
      .then(({ data }) => setYaCalifico(!!data))
  }, [entregado, pedido.id])

  async function enviarCalificacion(estrellas, etiquetas, comentario) {
    const { error } = await supabase.from('calificaciones').insert({
      pedido_id: pedido.id, estrellas, etiquetas, comentario: comentario || null,
    })
    if (error) throw error
  }

  if (!p) return <p className="msg">Cargando…</p>

  const nombre = p.vendedores?.nombre
  const lugar = p.posicion ? `la posición ${p.posicion}` : p.puntos_entrega?.nombre
  const idx = PASOS.findIndex((x) => x.k === p.estado)
  const pistas = {
    enviado: `Esperando respuesta de ${nombre} (hasta ${limite} min)`,
    aceptado: `${nombre} está preparando tu pedido`,
    listo: `Tu pedido va hacia ${lugar}`,
    entregado: 'Buen provecho',
  }
  const finalizado = idx === 3 || p.estado === 'rechazado' || p.estado === 'sin_respuesta'

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 12 }}>
        <h2 style={{ fontSize: 18, margin: 0 }}>Pedido n.º {p.numero}</h2>
        <span className="sub" style={{ margin: 0 }}>{precioTexto(p.total)}</span>
      </div>
      <p className="sub">{nombre} · Entrega en {lugar}</p>

      {(p.estado === 'rechazado' || p.estado === 'sin_respuesta') ? (
        <div className="tarjeta" style={{ marginTop: 0, borderColor: 'var(--er)' }}>
          <strong>
            {p.estado === 'rechazado' ? `${nombre} no pudo aceptar tu pedido` : `${nombre} no respondió a tiempo`}
          </strong>
          {p.estado === 'rechazado' && p.motivo_rechazo && (
            <p className="sub" style={{ margin: '6px 0 0' }}>Motivo: {p.motivo_rechazo}</p>
          )}
          <p className="sub" style={{ margin: '6px 0 0' }}>Puedes pedirle a otro vendedor que esté en línea.</p>
        </div>
      ) : (
        <div className="tarjeta" style={{ marginTop: 0 }}>
          {PASOS.map((x, i) => (
            <div key={x.k} className={'pas ' + (i < idx || idx === 3 ? 'hecho' : i === idx ? 'actual' : '')}>
              <div className="pas-riel">
                <span className="pas-punto" />
                {i < PASOS.length - 1 && <span className="pas-linea" />}
              </div>
              <div style={{ paddingBottom: i < PASOS.length - 1 ? 10 : 0 }}>
                <p className="pas-texto">{x.t}</p>
                {i === idx && <p className="pas-pista">{pistas[x.k]}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="tarjeta">
        {(p.pedido_items || []).map((i, n) => (
          <p key={n} style={{ margin: '2px 0', fontSize: 14 }}>{i.cantidad} {i.nombre}</p>
        ))}
      </div>

      {p.estado === 'enviado' && pedido.url && (
        <a className="boton-enlace" href={pedido.url} target="_blank" rel="noreferrer">
          Escribirle por WhatsApp
        </a>
      )}

      {entregado && yaCalifico === false && (
        <FormCalificacion
          titulo={`¿Cómo te fue con ${nombre}?`}
          etiquetas={ETIQUETAS_VENDEDOR}
          onEnviar={enviarCalificacion}
          onListo={() => setYaCalifico(true)}
        />
      )}
      {entregado && yaCalifico === true && (
        <p className="aviso">Gracias por tu calificación.</p>
      )}

      <button className="primario" onClick={() => onInicio(p.estado)}>
        {finalizado ? 'Volver al inicio' : 'Ver otros vendedores'}
      </button>
    </div>
  )
}
