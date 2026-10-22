import { useEffect, useState } from 'react'
import { supabase } from '../../supabase'
import { precioTexto } from '../../lib/utils'

const PAGOS = [
  { valor: 'efectivo', texto: 'Efectivo' },
  { valor: 'transferencia', texto: 'Transferencia' },
]

export default function Carrito({ carrito, onCambiar, onVolver, onInicio, onContinuar }) {
  const [puntos, setPuntos] = useState([])
  const [patron, setPatron] = useState('^(10[0-7]|[1-9][0-9]?|E([1-9]|1[0-9]|2[0-9])|F([1-9]|1[0-9]|20))$')
  const [puntoId, setPuntoId] = useState('')
  const [posicion, setPosicion] = useState('')
  const [pago, setPago] = useState('')
  const [nota, setNota] = useState('')
  const [enLinea, setEnLinea] = useState(true)
  const [error, setError] = useState('')

  const vendedor = carrito.vendedor
  const lineas = Object.values(carrito.items)
  const total = lineas.reduce((a, i) => a + i.cantidad * i.producto.precio, 0)
  const punto = puntos.find((p) => p.id === puntoId)

  useEffect(() => {
    supabase.from('puntos_entrega').select('id, nombre, es_posicion')
      .eq('activo', true).order('es_posicion').order('nombre')
      .then(({ data }) => setPuntos(data || []))
    supabase.from('configuracion').select('valor').eq('clave', 'patron_posicion').maybeSingle()
      .then(({ data }) => { if (data?.valor) setPatron(data.valor) })
  }, [])

  // Si el vendedor sale de turno mientras armas el pedido, se avisa aquí
  useEffect(() => {
    const vendedorId = vendedor?.id
    if (!vendedorId) return
    async function revisar() {
      const { data } = await supabase
        .from('sesiones_en_linea').select('estado')
        .eq('vendedor_id', vendedorId).is('fin_real', null).maybeSingle()
      setEnLinea(data?.estado === 'en_linea')
    }
    revisar()
    const canal = supabase
      .channel('carrito-' + vendedorId)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sesiones_en_linea', filter: `vendedor_id=eq.${vendedorId}` },
        () => revisar())
      .subscribe()
    return () => supabase.removeChannel(canal)
  }, [vendedor?.id])

  if (lineas.length === 0) {
    return (
      <div>
        <p className="sub" style={{ marginTop: 16 }}>Tu carrito está vacío.</p>
        <button className="primario" onClick={onInicio}>Ver vendedores</button>
      </div>
    )
  }

  function posicionValida(pos) {
    try { return new RegExp(patron).test(pos) } catch { return pos.length > 0 }
  }

  function continuar() {
    if (!enLinea) return setError(`${vendedor.nombre} salió de turno. No puedes continuar con este pedido.`)
    if (!puntoId && !pago) return setError('Elige el punto de entrega y la forma de pago')
    if (!puntoId) return setError('Elige el punto de entrega')

    let pos = ''
    if (punto?.es_posicion) {
      pos = posicion.trim().toUpperCase()
      if (!posicionValida(pos)) return setError('Escribe tu posición: un número del 1 al 107, o E1 a E29, F1 a F20')
    }
    if (!pago) return setError('Elige la forma de pago')

    setError('')
    onContinuar({
      puntoId,
      puntoNombre: punto?.es_posicion ? `Posición ${pos}` : punto?.nombre,
      posicion: pos || null,
      pago: PAGOS.find((p) => p.valor === pago)?.texto,
      pagoValor: pago,
      nota: nota.trim(),
    })
  }

  return (
    <div>
      <button className="enlace" onClick={onVolver}>← Seguir pidiendo</button>
      <h2 style={{ fontSize: 18, margin: '8px 0 2px' }}>Tu pedido</h2>
      <p className="sub">{vendedor.nombre}</p>

      {!enLinea && (
        <p className="aviso-fuera">{vendedor.nombre} salió de turno. Puedes elegir otro vendedor.</p>
      )}

      <div className="tarjeta" style={{ marginTop: 0, padding: '4px 12px' }}>
        {lineas.map(({ producto, cantidad }) => (
          <div key={producto.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--bd)' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>{producto.nombre}</p>
              <p className="sub" style={{ margin: 0, fontSize: 12 }}>{precioTexto(producto.precio)} c/u</p>
            </div>
            <div className="stepper">
              <button aria-label="Quitar uno" onClick={() => onCambiar(vendedor, producto, -1)}>−</button>
              <span>{cantidad}</span>
              <button aria-label="Sumar uno" onClick={() => onCambiar(vendedor, producto, 1)}>+</button>
            </div>
            <span style={{ minWidth: 70, textAlign: 'right', fontSize: 14 }}>{precioTexto(producto.precio * cantidad)}</span>
          </div>
        ))}
      </div>

      <label>Punto de entrega</label>
      <div className="rejilla2">
        {puntos.map((p) => (
          <button key={p.id} className={'chip' + (puntoId === p.id ? ' on' : '')} onClick={() => { setPuntoId(p.id); setError('') }}>
            {p.nombre}
          </button>
        ))}
      </div>

      {punto?.es_posicion && (
        <>
          <label htmlFor="pos">Tu posición</label>
          <input
            id="pos"
            value={posicion}
            maxLength={3}
            autoCapitalize="characters"
            onChange={(e) => { setPosicion(e.target.value); setError('') }}
            placeholder="Ej: 45, E12 o F7"
          />
          <p className="sub" style={{ margin: '6px 0 0', fontSize: 12 }}>Un número del 1 al 107, o E1 a E29, F1 a F20.</p>
        </>
      )}

      <label>Forma de pago</label>
      <div className="rejilla2">
        {PAGOS.map((p) => (
          <button key={p.valor} className={'chip' + (pago === p.valor ? ' on' : '')} onClick={() => { setPago(p.valor); setError('') }}>
            {p.texto}
          </button>
        ))}
      </div>
      <p className="sub" style={{ margin: '6px 0 0', fontSize: 12 }}>Le pagas directamente a {vendedor.nombre} al recibir tu pedido.</p>

      <label htmlFor="nota">Nota para el vendedor (opcional)</label>
      <input id="nota" value={nota} maxLength={140} onChange={(e) => setNota(e.target.value)} placeholder="Sin cebolla, poco picante" />

      <div className="tarjeta">
        <div className="linea-total"><span className="sub" style={{ margin: 0 }}>Productos</span><span>{precioTexto(total)}</span></div>
        <div className="linea-total"><span className="sub" style={{ margin: 0 }}>Servicio de la plataforma</span><span>$0</span></div>
        <div className="linea-total" style={{ fontWeight: 600, fontSize: 16, marginTop: 8 }}><span>Total</span><span>{precioTexto(total)}</span></div>
      </div>

      <button className="primario" onClick={continuar}>Continuar a confirmar</button>
      <p className="error">{error}</p>
    </div>
  )
}
