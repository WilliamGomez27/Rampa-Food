import { useEffect, useState } from 'react'
import { supabase } from '../../supabase'
import { precioTexto } from '../../lib/utils'

export default function MenuVendedor({ vendedor, carrito, onCambiar, onVolver, onVerCarrito }) {
  const [productos, setProductos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [fotoModal, setFotoModal] = useState(null)

  useEffect(() => {
    let activo = true
    supabase
      .from('productos')
      .select('*')
      .eq('vendedor_id', vendedor.id)
      .eq('activo', true)
      .order('creado_en')
      .then(({ data }) => {
        if (activo) {
          setProductos(data || [])
          setCargando(false)
        }
      })
    return () => {
      activo = false
    }
  }, [vendedor.id])

  useEffect(() => {
    if (!fotoModal) return
    const onKey = (e) => {
      if (e.key === 'Escape') setFotoModal(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fotoModal])

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
          <div
            className={`prod ${!p.agotado && c === 0 ? 'prod-tocado' : ''}`}
            key={p.id}
            onClick={() => {
              if (!p.agotado && c === 0) onCambiar(vendedor, p, 1)
            }}
          >
            {p.foto_url ? (
              <div
                className="foto-prod clickeable"
                title="Toca para ampliar imagen"
                onClick={(e) => {
                  e.stopPropagation()
                  setFotoModal(p)
                }}
              >
                <img src={p.foto_url} alt={p.nombre} />
                <span className="lupa-icono" aria-hidden="true">🔍</span>
              </div>
            ) : (
              <div className="foto-prod">Sin foto</div>
            )}
            <div className="info">
              <p className={p.agotado ? 'agotado' : ''} style={{ fontWeight: 600, fontSize: 15 }}>{p.nombre}</p>
              {p.descripcion && <p className="sub" style={{ margin: '2px 0 0', fontSize: 12 }}>{p.descripcion}</p>}
              <p className={p.agotado ? 'agotado' : ''} style={{ fontWeight: 600, marginTop: 4 }}>{precioTexto(p.precio)}</p>
            </div>
            {p.agotado ? (
              <span className="sub" style={{ margin: 0, fontSize: 12 }}>Agotado</span>
            ) : c === 0 ? (
              <button
                className="agregar"
                onClick={(e) => {
                  e.stopPropagation()
                  onCambiar(vendedor, p, 1)
                }}
              >
                Agregar
              </button>
            ) : (
              <div className="stepper" onClick={(e) => e.stopPropagation()}>
                <button aria-label="Quitar uno" onClick={() => onCambiar(vendedor, p, -1)}>−</button>
                <span>{c}</span>
                <button aria-label="Sumar uno" onClick={() => onCambiar(vendedor, p, 1)}>+</button>
              </div>
            )}
          </div>
        )
      })}

      {fotoModal && (
        <div
          className="modal-foto-overlay"
          onClick={() => setFotoModal(null)}
          role="dialog"
          aria-modal="true"
        >
          <div className="modal-foto-caja" onClick={(e) => e.stopPropagation()}>
            <button
              className="modal-foto-cerrar"
              onClick={() => setFotoModal(null)}
              aria-label="Cerrar vista previa"
            >
              ✕
            </button>
            <img
              className="modal-foto-img"
              src={fotoModal.foto_url}
              alt={fotoModal.nombre}
            />
            <div className="modal-foto-info">
              <h3 style={{ margin: '0 0 6px', fontSize: 18 }}>{fotoModal.nombre}</h3>
              {fotoModal.descripcion && (
                <p className="sub" style={{ margin: '0 0 10px', fontSize: 13 }}>
                  {fotoModal.descripcion}
                </p>
              )}
              <p style={{ fontWeight: 700, fontSize: 18, margin: '0 0 14px' }}>
                {precioTexto(fotoModal.precio)}
              </p>

              {fotoModal.agotado ? (
                <p className="sub" style={{ margin: 0, fontWeight: 600 }}>Producto agotado</p>
              ) : (items[fotoModal.id]?.cantidad || 0) === 0 ? (
                <button
                  className="primario"
                  style={{ width: '100%', padding: '12px', fontSize: 15 }}
                  onClick={() => {
                    onCambiar(vendedor, fotoModal, 1)
                  }}
                >
                  + Agregar al pedido ({precioTexto(fotoModal.precio)})
                </button>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>En tu pedido:</span>
                  <div className="stepper">
                    <button
                      aria-label="Quitar uno"
                      onClick={() => onCambiar(vendedor, fotoModal, -1)}
                    >
                      −
                    </button>
                    <span style={{ fontSize: 16 }}>{items[fotoModal.id].cantidad}</span>
                    <button
                      aria-label="Sumar uno"
                      onClick={() => onCambiar(vendedor, fotoModal, 1)}
                    >
                      +
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
