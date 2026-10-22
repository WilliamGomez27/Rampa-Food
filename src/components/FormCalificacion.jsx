import { useState } from 'react'
import '../calificacion.css'

export default function FormCalificacion({ titulo, etiquetas, onEnviar, onListo }) {
  const [estrellas, setEstrellas] = useState(0)
  const [sel, setSel] = useState([])
  const [comentario, setComentario] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  function alternar(t) {
    setSel(sel.includes(t) ? sel.filter((x) => x !== t) : [...sel, t])
  }

  async function enviar() {
    if (estrellas === 0) return setError('Elige de 1 a 5 estrellas')
    setError('')
    setEnviando(true)
    try {
      await onEnviar(estrellas, sel, comentario.trim())
      onListo()
    } catch (e) {
      console.error(e)
      setError('No pudimos guardar la calificación. Intenta de nuevo.')
      setEnviando(false)
    }
  }

  return (
    <div className="calif">
      <h3>{titulo}</h3>
      <div className="estrellas">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`${n} de 5 estrellas`}
            className={n <= estrellas ? 'on' : ''}
            onClick={() => { setEstrellas(n); setError('') }}
          >
            ★
          </button>
        ))}
      </div>
      <div className="etiquetas">
        {etiquetas.map((t) => (
          <button key={t} type="button" className={'chip' + (sel.includes(t) ? ' on' : '')} onClick={() => alternar(t)}>
            {t}
          </button>
        ))}
      </div>
      <input
        value={comentario}
        maxLength={300}
        onChange={(e) => setComentario(e.target.value)}
        placeholder="Comentario (opcional)"
      />
      <p className="error">{error}</p>
      <button className="primario" style={{ marginTop: 6 }} disabled={enviando} onClick={enviar}>
        {enviando ? 'Enviando…' : 'Enviar calificación'}
      </button>
    </div>
  )
}
