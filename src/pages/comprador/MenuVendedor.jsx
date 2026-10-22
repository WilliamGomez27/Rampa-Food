import { useEffect, useState } from 'react'
import { supabase } from '../../supabase'
import { precioTexto } from '../../lib/utils'

export default function MenuVendedor({ vendedor, carrito, onCambiar, onVolver, onVerCarrito }) {
  const [productos, setProductos] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase
        .from('productos').select('*')
        .eq('vendedor_id', vendedor.id).eq('activo', true).order('creado_en')
      setProductos(data || [])
      setCargando(false)
    })()
  }, [vendedor.id])

  const mismo = carrito.vendedor?.id === vendedor.id
  const items = mismo ? carrito.items : {}
  const cantidad = Object.values(items).reduce((a, i) => a + i.cantidad, 0)
  const total = Object.values(items).reduce((a, i) => a + i.cantidad * i.producto.precio, 0)

  return (
    <div>
      <button className="enlace" onClick={onVolver}>← Volver</button>
      <div className="vend" style={{ marginTop: 8 }}>
        <div className="avatar on">
          {vendedor.foto_url ? <img src={vendedor.foto_url} alt={vendedor.nombre} /> : vendedor.nombre.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
        </div>
        <div className="vend-info">
          <p className="vend-nombre" style={{ fontSize: 18 }}>{vendedor.nombre}</p>
          <p className={'estado-linea ' + vendedor.estado}><span className="pt" />{vendedor.texto}</p>
        </div>
      </div>

      {cargando && <p className="msg">Cargando…</p>}
      {!cargando && productos.length === 0 && <p className="sub">Este vendedor aún no tiene productos.</p>}

      {productos.map((p) => {
        const c = items[p.id]?.cantidad || 0
        return (
          <div className="prod" key={p.id}>
            {p.foto_url ? <img className="foto-prod" src={p.foto_url} alt={p.nombre} /> : <div className="foto-prod">Sin foto</div>}
            <div className="info">
              <p className={p.agotado ? 'agotado' : ''} style={{ fontWeight: 600, fontSize: 15 }}>{p.nombre}</p>
              {p.descripcion && <p className="sub" style={{ margin: '2px 0 0', fontSize: 12 }}>{p.descripcion}</p>}
              <p className={p.agotado ? 'agotado' : ''} style={{ fontWeight: 600, marginTop: 4 }}>{precioTexto(p.precio)}</p>
            </div>
            {p.agotado ? (
              <span className="sub" style={{ margin: 0, fontSize: 12 }}>Agotado</span>
            ) : c === 0 ? (
              <button className="agregar" onClick={() => onCambiar(vendedor, p, 1)}>Agregar</button>
            ) : (
              <div className="stepper">
                <button aria-label="Quitar uno" onClick={() => onCambiar(vendedor, p, -1)}>−</button>
                <span>{c}</span>
                <button aria-label="Sumar uno" onClick={() => onCambiar(vendedor, p, 1)}>+</button>
              </div>
            )}
          </div>
        )
      })}

      {cantidad > 0 && (
        <div className="barra-total">
          <div>
            <small>{cantidad === 1 ? '1 producto' : `${cantidad} productos`}</small>
            <strong>{precioTexto(total)}</strong>
          </div>
          <button className="primario" style={{ width: 'auto', marginTop: 0 }} onClick={onVerCarrito}>Ver carrito</button>
        </div>
      )}
    </div>
  )
}
