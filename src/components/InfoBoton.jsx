import { useEffect, useState } from 'react'
import { INFO } from '../info'
import '../info.css'

function PanelInfo({ onCerrar }) {
  // Cierra con la tecla Escape y evita que se mueva la pantalla de atrás
  useEffect(() => {
    const tecla = (e) => e.key === 'Escape' && onCerrar()
    window.addEventListener('keydown', tecla)
    const previo = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', tecla)
      document.body.style.overflow = previo
    }
  }, [onCerrar])

  const { desarrollador: dev } = INFO
  const asunto = encodeURIComponent(`Ayuda con ${INFO.appNombre} v${INFO.version}`)

  return (
    <div className="info-capa" role="dialog" aria-modal="true" aria-label="Información de la app">
      <div className="info-cont">
        <div className="info-cab">
          <h2>Información</h2>
          <button onClick={onCerrar}>Cerrar</button>
        </div>

        <div className="info-sec">
          <h3>La app</h3>
          <div className="info-ver">
            <strong style={{ fontSize: 16 }}>{INFO.appNombre}</strong>
            <span className="etiqueta dev">{INFO.etapa}</span>
          </div>
          <p>Versión {INFO.version} · {INFO.fecha}</p>
          <p style={{ color: 'var(--mut)' }}>{INFO.descripcion}</p>
        </div>

        <div className="info-sec">
          <h3>Desarrollador</h3>
          <p style={{ fontWeight: 600 }}>{dev.nombre}</p>
          {dev.rol && <p style={{ color: 'var(--mut)' }}>{dev.rol}</p>}
          {dev.github && (
            <p><a href={dev.github} target="_blank" rel="noreferrer" style={{ color: 'var(--ac)' }}>Ver perfil en GitHub</a></p>
          )}
        </div>

        {INFO.correoAyuda && (
          <div className="info-sec">
            <h3>Ayuda</h3>
            <p>¿Algo no funciona o tienes una duda? Escríbenos y cuéntanos qué pasó.</p>
            <a className="info-enlace" href={`mailto:${INFO.correoAyuda}?subject=${asunto}`}>
              Escribir a {INFO.correoAyuda}
            </a>
          </div>
        )}

        <div className="info-sec">
          <h3>Próximas mejoras</h3>
          {INFO.proximas.map((m) => (
            <div className="info-mejora" key={m.titulo}>
              <div className="info-mejora-cab">
                <strong>{m.titulo}</strong>
                <span className={'etiqueta' + (m.estado === 'En desarrollo' ? ' dev' : '')}>{m.estado}</span>
              </div>
              <small>{m.detalle}</small>
            </div>
          ))}
        </div>

        <div className="info-sec">
          <h3>Novedades</h3>
          {INFO.novedades.map((n) => (
            <div key={n.version} style={{ marginBottom: 10 }}>
              <p style={{ fontWeight: 600 }}>Versión {n.version}</p>
              <ul>{n.cambios.map((c) => <li key={c}>{c}</li>)}</ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function InfoBoton() {
  const [abierto, setAbierto] = useState(false)
  return (
    <>
      <button className="btn-info" aria-label="Información de la app" onClick={() => setAbierto(true)}>i</button>
      {abierto && <PanelInfo onCerrar={() => setAbierto(false)} />}
    </>
  )
}
