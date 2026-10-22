import { useEffect, useState } from 'react'
import { supabase } from '../../supabase'
import '../../vendedor.css'
import '../../pedidos.css'
import { alertaSonora } from '../../lib/pedidos'
import InfoBoton from '../../components/InfoBoton'
import AvisosPush from '../../components/AvisosPush'
import EstoyEnLinea from './EstoyEnLinea'
import MisTurnos from './MisTurnos'
import MiMenu from './MiMenu'
import PedidosEntrantes from './PedidosEntrantes'

export default function PanelVendedor({ perfil, onSalir }) {
  const [tab, setTab] = useState('linea')
  const [nuevos, setNuevos] = useState(0)

  // Cuenta los pedidos nuevos y avisa (sonido y vibración) cuando llega uno
  useEffect(() => {
    async function contar() {
      const { count } = await supabase
        .from('pedidos').select('id', { count: 'exact', head: true })
        .eq('vendedor_id', perfil.id).eq('estado', 'enviado')
      setNuevos(count || 0)
    }
    contar()
    const canal = supabase
      .channel('panel-pedidos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, (payload) => {
        if (payload.eventType === 'INSERT') alertaSonora()
        contar()
      })
      .subscribe()
    const timer = setInterval(contar, 30000)
    return () => { supabase.removeChannel(canal); clearInterval(timer) }
  }, [perfil.id])

  const TABS = [
    { id: 'pedidos', texto: nuevos > 0 ? `Pedidos (${nuevos})` : 'Pedidos' },
    { id: 'linea', texto: 'En línea' },
    { id: 'turnos', texto: 'Turnos' },
    { id: 'menu', texto: 'Menú' },
  ]

  return (
    <div className="pantalla">
      <div className="cab-info">
        <h1>Hola, {perfil.nombre}</h1>
        <InfoBoton />
      </div>
      <AvisosPush rol="vendedor" />
      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={'tab' + (tab === t.id ? ' on' : '')} onClick={() => setTab(t.id)}>
            {t.texto}
          </button>
        ))}
      </div>

      {tab === 'pedidos' && <PedidosEntrantes uid={perfil.id} />}
      {tab === 'linea' && <EstoyEnLinea uid={perfil.id} />}
      {tab === 'turnos' && <MisTurnos uid={perfil.id} />}
      {tab === 'menu' && <MiMenu uid={perfil.id} />}

      <button className="enlace" onClick={onSalir}>Cerrar sesión</button>
    </div>
  )
}
