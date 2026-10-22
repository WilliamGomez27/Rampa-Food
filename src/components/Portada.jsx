import { useCallback, useEffect, useState } from 'react'
import portada from '../assets/portada.webp'
import '../portada.css'

// Cada cuántas horas se vuelve a mostrar la portada (0 = cada vez que se abre la app)
const HORAS_ENTRE_PORTADAS = 6
// Cuánto dura en pantalla antes de cerrarse sola
const DURACION_MS = 4000

function debeMostrarse() {
  if (window.location.hash === '#admin') return false
  try {
    const ultima = Number(localStorage.getItem('portada_ts') || 0)
    return Date.now() - ultima >= HORAS_ENTRE_PORTADAS * 3600 * 1000
  } catch {
    return true
  }
}

export default function Portada() {
  const [estado, setEstado] = useState(() => (debeMostrarse() ? 'visible' : 'oculta'))

  const cerrar = useCallback(() => {
    setEstado((e) => (e === 'visible' ? 'saliendo' : e))
  }, [])

  // Se cierra sola pasados unos segundos
  useEffect(() => {
    if (estado !== 'visible') return
    const t = setTimeout(cerrar, DURACION_MS)
    return () => clearTimeout(t)
  }, [estado, cerrar])

  // Desvanece, recuerda la hora y se retira
  useEffect(() => {
    if (estado !== 'saliendo') return
    try {
      localStorage.setItem('portada_ts', String(Date.now()))
    } catch {
      /* si el almacenamiento está bloqueado, simplemente se mostrará de nuevo */
    }
    const t = setTimeout(() => setEstado('oculta'), 400)
    return () => clearTimeout(t)
  }, [estado])

  if (estado === 'oculta') return null

  return (
    <div
      className={'portada' + (estado === 'saliendo' ? ' saliendo' : '')}
      onClick={cerrar}
      role="dialog"
      aria-label="Bienvenida a Rampa Food"
    >
      <img src={portada} alt="Rampa Food: un avión sonriente con una bandeja de hamburguesa, papas y gaseosa" />
      <div className="portada-acciones">
        <button
          onClick={(e) => {
            e.stopPropagation()
            cerrar()
          }}
        >
          Empezar
        </button>
      </div>
    </div>
  )
}
