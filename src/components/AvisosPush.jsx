import { useEffect, useState } from 'react'
import { activarPush, estadoPush, registrarSW, sincronizarPush } from '../lib/push'
import '../push.css'

const TRES_DIAS = 3 * 24 * 60 * 60 * 1000

export default function AvisosPush({ rol, forzar = false }) {
  const [estado, setEstado] = useState(null)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')
  const [oculto, setOculto] = useState(() => {
    if (rol !== 'comprador') return false
    return Date.now() - Number(localStorage.getItem('push_oculto_ts') || 0) < TRES_DIAS
  })

  useEffect(() => {
    registrarSW()
      .then(() => estadoPush())
      .then(async (e) => {
        if (e === 'activo') {
          try { await sincronizarPush() } catch (err) { console.error(err) }
        }
        setEstado(e)
      })
  }, [])

  async function activar() {
    setError('')
    setOcupado(true)
    try {
      setEstado(await activarPush())
    } catch (e) {
      console.error(e)
      setError('No pudimos activar los avisos. Intenta de nuevo.')
    }
    setOcupado(false)
  }

  function ahoraNo() {
    localStorage.setItem('push_oculto_ts', String(Date.now()))
    setOculto(true)
  }

  if (estado === null || estado === 'activo') return null
  if (oculto && !forzar) return null
  if (estado === 'no_soportado' && rol === 'comprador') return null

  const esVendedor = rol === 'vendedor'

  if (estado === 'no_soportado') {
    return (
      <div className="aviso-push alerta">
        <p>Este navegador no permite avisos. Mantén la app abierta para enterarte de los pedidos nuevos.</p>
      </div>
    )
  }

  if (estado === 'instalar') {
    return (
      <div className="aviso-push alerta">
        <p>
          Para recibir avisos en iPhone, instala la app: toca el botón Compartir y luego
          “Agregar a pantalla de inicio”. Después ábrela desde ese ícono.
        </p>
        {!esVendedor && !forzar && <button onClick={ahoraNo}>Ahora no</button>}
      </div>
    )
  }

  if (estado === 'denegado') {
    return (
      <div className="aviso-push alerta">
        <p>Los avisos están bloqueados. Actívalos en los ajustes del navegador o de la app para este sitio.</p>
      </div>
    )
  }

  return (
    <div className="aviso-push">
      <p>
        {esVendedor
          ? 'Activa los avisos para enterarte de los pedidos nuevos aunque la app esté cerrada.'
          : 'Activa los avisos para saber cuándo tu pedido cambia de estado o un vendedor se conecta.'}
      </p>
      <div className="fila">
        <button className="principal" onClick={activar}>{ocupado ? 'Activando…' : 'Activar avisos'}</button>
        {!esVendedor && !forzar && <button onClick={ahoraNo}>Ahora no</button>}
      </div>
      {error && <p className="error" style={{ marginTop: 8 }}>{error}</p>}
    </div>
  )
}
