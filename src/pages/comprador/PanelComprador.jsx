import { useEffect, useState } from 'react'
import { supabase } from '../../supabase'
import '../../comprador.css'
import '../../pedidos.css'
import Inicio from './Inicio'
import MenuVendedor from './MenuVendedor'
import Carrito from './Carrito'
import Confirmar from './Confirmar'
import Seguimiento from './Seguimiento'
import InfoBoton from '../../components/InfoBoton'

const ACTIVOS = ['enviado', 'aceptado', 'listo']

export default function PanelComprador({ perfil, onSalir, onRecargarPerfil }) {
  const [vista, setVista] = useState('inicio') // inicio | menu | carrito | confirmar | seguimiento
  const [vendedorSel, setVendedorSel] = useState(null)
  const [carrito, setCarrito] = useState({ vendedor: null, items: {} })
  const [entrega, setEntrega] = useState(null)
  const [pedidoActivo, setPedidoActivo] = useState(null) // { id, numero, url }

  const cantidadTotal = Object.values(carrito.items).reduce((a, i) => a + i.cantidad, 0)

  // Si recargas la página, recupera el pedido en curso
  useEffect(() => {
    supabase.from('pedidos').select('id, numero')
      .eq('comprador_id', perfil.id).in('estado', ACTIVOS)
      .order('creado_en', { ascending: false }).limit(1)
      .then(({ data }) => { if (data?.[0]) setPedidoActivo({ ...data[0], url: null }) })
  }, [perfil.id])

  // Un pedido es de un solo vendedor
  function cambiar(vendedor, producto, delta) {
    let base = carrito
    if (base.vendedor && base.vendedor.id !== vendedor.id && cantidadTotal > 0) {
      const ok = window.confirm(
        `Tu pedido tiene productos de ${base.vendedor.nombre}. ¿Vaciarlo y empezar un pedido con ${vendedor.nombre}?`
      )
      if (!ok) return
      base = { vendedor, items: {} }
    }
    const actual = base.items[producto.id]?.cantidad || 0
    const nueva = Math.max(0, actual + delta)
    const items = { ...base.items }
    if (nueva === 0) delete items[producto.id]
    else items[producto.id] = { producto, cantidad: nueva }
    setCarrito({ vendedor: Object.keys(items).length ? vendedor : null, items })
  }

  function pedidoCreado(p) {
    setPedidoActivo(p)
    setCarrito({ vendedor: null, items: {} })
    setVendedorSel(null)
    setEntrega(null)
    setVista('seguimiento')
  }

  function salirDeSeguimiento(estado) {
    if (!ACTIVOS.includes(estado)) setPedidoActivo(null)
    setVista('inicio')
  }

  function irComoVendedor(e) {
    if (pedidoActivo && !window.confirm(
      'Si entras como vendedor se cierra tu sesión de comprador en este celular y perderás el seguimiento de tu pedido. ¿Continuar?'
    )) e.preventDefault()
  }

  return (
    <div className="pantalla">
      <div className="cabecera">
        <h1>{perfil.nombre ? `Hola, ${perfil.nombre}` : 'Hola'}</h1>
        <div className="cab-der">
          {(vista === 'inicio' || vista === 'menu') && cantidadTotal > 0 && (
            <button className="btn-carrito" onClick={() => setVista('carrito')}>Carrito ({cantidadTotal})</button>
          )}
          <InfoBoton />
        </div>
      </div>

      {vista === 'inicio' && (
        <>
          {pedidoActivo && (
            <div className="banner">
              <span>Tienes un pedido en curso</span>
              <button onClick={() => setVista('seguimiento')}>Ver pedido</button>
            </div>
          )}
          <Inicio uid={perfil.id} onVerMenu={(v) => { setVendedorSel(v); setVista('menu') }} />
        </>
      )}

      {vista === 'menu' && vendedorSel && (
        <MenuVendedor
          vendedor={vendedorSel}
          carrito={carrito}
          onCambiar={cambiar}
          onVolver={() => setVista('inicio')}
          onVerCarrito={() => setVista('carrito')}
        />
      )}

      {vista === 'carrito' && (
        <Carrito
          carrito={carrito}
          onCambiar={cambiar}
          onVolver={() => setVista(vendedorSel ? 'menu' : 'inicio')}
          onInicio={() => setVista('inicio')}
          onContinuar={(datos) => { setEntrega(datos); setVista('confirmar') }}
        />
      )}

      {vista === 'confirmar' && entrega && carrito.vendedor && (
        <Confirmar
          carrito={carrito}
          entrega={entrega}
          perfil={perfil}
          onNombre={onRecargarPerfil}
          onVolver={() => setVista('carrito')}
          onCreado={pedidoCreado}
        />
      )}

      {vista === 'seguimiento' && pedidoActivo && (
        <Seguimiento pedido={pedidoActivo} onInicio={salirDeSeguimiento} />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
        <a href="#vendedor" onClick={irComoVendedor} style={{ color: 'var(--ac)', fontSize: 14, textDecoration: 'none' }}>
          Soy vendedor
        </a>
        {onSalir && <button className="enlace" style={{ marginTop: 0 }} onClick={onSalir}>Cerrar sesión</button>}
      </div>
    </div>
  )
}
