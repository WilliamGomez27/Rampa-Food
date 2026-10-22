import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../supabase'
import { precioTexto } from '../../lib/utils'
import { TEXTO_ESTADO, minutosDesde } from '../../lib/pedidos'
import FormCalificacion from '../../components/FormCalificacion'

const MOTIVOS = ['Sin stock', 'Termino mi turno', 'Otro']
const ORDEN = { enviado: 0, aceptado: 1, listo: 2 }
const PAGO = { efectivo: 'Efectivo', transferencia: 'Transferencia' }
const ETIQUETAS_COMPRADOR = ['Puntual', 'Amable', 'Estaba en su posición', 'Pagó sin problema']

const lugar = (p) => (p.posicion ? `Posición ${p.posicion}` : p.puntos_entrega?.nombre)
const calificado = (p) =>
  Array.isArray(p.calificaciones_comprador) ? p.calificaciones_comprador.length > 0 : !!p.calificaciones_comprador

export default function PedidosEntrantes({ uid }) {
  const [pedidos, setPedidos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [rechazoId, setRechazoId] = useState(null)
  const [motivo, setMotivo] = useState('')
  const [calificandoId, setCalificandoId] = useState(null)
  const [error, setError] = useState('')

  const cargar = useCallback(async () => {
    const { data } = await supabase
      .from('pedidos')
      .select('*, compradores(nombre), puntos_entrega(nombre), pedido_items(cantidad, nombre), calificaciones_comprador(estrellas)')
      .eq('vendedor_id', uid)
      .order('creado_en', { ascending: false })
      .limit(30)
    const lista = (data || []).sort((a, b) => (ORDEN[a.estado] ?? 3) - (ORDEN[b.estado] ?? 3))
    setPedidos(lista)
    setCargando(false)
  }, [uid])

  useEffect(() => {
    let activo = true
    Promise.resolve().then(() => {
      if (activo) cargar()
    })
    const canal = supabase
      .channel('lista-pedidos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, () => cargar())
      .subscribe()
    const timer = setInterval(cargar, 30000)
    return () => {
      activo = false
      supabase.removeChannel(canal)
      clearInterval(timer)
    }
  }, [cargar])

  async function cambiar(p, cambios) {
    const { error: e } = await supabase.from('pedidos').update(cambios).eq('id', p.id)
    if (e) { console.error(e); setError('Este pedido ya cambió de estado.') } else setError('')
    setRechazoId(null)
    setMotivo('')
    cargar()
  }

  function confirmarRechazo(p) {
    if (!motivo) return setError('Elige un motivo')
    cambiar(p, { estado: 'rechazado', motivo_rechazo: motivo })
  }

  async function calificarComprador(p, estrellas, etiquetas, comentario) {
    const { error: e } = await supabase.from('calificaciones_comprador').insert({
      pedido_id: p.id, estrellas, etiquetas, comentario: comentario || null,
    })
    if (e) throw e
  }

  if (cargando) return <p className="msg">Cargando…</p>

  return (
    <div>
      <p className="sub">Responde antes de que se acabe el tiempo.</p>
      <p className="error" style={{ marginTop: 0 }}>{error}</p>
      {pedidos.length === 0 && <p className="sub">Aún no has recibido pedidos.</p>}

      {pedidos.map((p) => {
        const min = minutosDesde(p.creado_en)
        const items = (p.pedido_items || []).map((i) => `${i.cantidad} ${i.nombre}`).join(', ')
        return (
          <div className="pedido" key={p.id}>
            <div className="pedido-cab">
              <div>
                <p className="titulo">Pedido n.º {p.numero} · {p.compradores?.nombre}</p>
                <p>{min === 0 ? 'ahora' : `hace ${min} min`} · {precioTexto(p.total)}</p>
              </div>
              <span className={'insignia ' + p.estado}>{TEXTO_ESTADO[p.estado]}</span>
            </div>
            <p style={{ color: 'var(--fg)' }}>{items}</p>
            <p>Entrega: {lugar(p)} · Pago: {PAGO[p.forma_pago]}</p>
            {p.nota && <p>Nota: {p.nota}</p>}
            {p.estado === 'rechazado' && p.motivo_rechazo && <p>Motivo: {p.motivo_rechazo}</p>}

            {p.estado === 'enviado' && rechazoId !== p.id && (
              <div className="acciones-pedido">
                <button className="primario" style={{ marginTop: 0 }} onClick={() => cambiar(p, { estado: 'aceptado' })}>Aceptar</button>
                <button onClick={() => { setRechazoId(p.id); setMotivo(''); setError('') }}>Rechazar</button>
              </div>
            )}

            {p.estado === 'enviado' && rechazoId === p.id && (
              <div>
                <p style={{ marginTop: 10 }}>Motivo del rechazo</p>
                <div className="motivos">
                  {MOTIVOS.map((m) => (
                    <button key={m} className={'chip' + (motivo === m ? ' on' : '')} onClick={() => { setMotivo(m); setError('') }}>{m}</button>
                  ))}
                </div>
                <div className="acciones-pedido">
                  <button onClick={() => confirmarRechazo(p)}>Confirmar rechazo</button>
                  <button onClick={() => { setRechazoId(null); setError('') }}>Volver</button>
                </div>
              </div>
            )}

            {p.estado === 'aceptado' && (
              <div className="acciones-pedido una">
                <button className="primario" style={{ marginTop: 0 }} onClick={() => cambiar(p, { estado: 'listo' })}>Marcar listo</button>
              </div>
            )}
            {p.estado === 'listo' && (
              <div className="acciones-pedido una">
                <button className="primario" style={{ marginTop: 0 }} onClick={() => cambiar(p, { estado: 'entregado' })}>Marcar entregado</button>
              </div>
            )}

            {p.estado === 'entregado' && !calificado(p) && calificandoId !== p.id && (
              <div className="acciones-pedido una">
                <button onClick={() => setCalificandoId(p.id)}>Calificar al comprador</button>
              </div>
            )}
            {p.estado === 'entregado' && !calificado(p) && calificandoId === p.id && (
              <FormCalificacion
                titulo={`¿Cómo fue tu experiencia con ${p.compradores?.nombre}?`}
                etiquetas={ETIQUETAS_COMPRADOR}
                onEnviar={(e, t, c) => calificarComprador(p, e, t, c)}
                onListo={() => { setCalificandoId(null); cargar() }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
