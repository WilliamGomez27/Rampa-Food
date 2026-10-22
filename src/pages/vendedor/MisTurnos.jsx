import { useEffect, useState } from 'react'
import { supabase } from '../../supabase'
import { DIAS, FRANJAS } from '../../lib/utils'

const clave = (dia, franja) => `${dia}-${franja}`

export default function MisTurnos({ uid }) {
  const [original, setOriginal] = useState(new Set())
  const [sel, setSel] = useState(new Set())
  const [cargando, setCargando] = useState(true)
  const [msg, setMsg] = useState({ tipo: '', texto: '' })

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase
        .from('turnos').select('dia_semana, franja')
        .eq('vendedor_id', uid).eq('semana_rotacion', 1)
      const s = new Set((data || []).map((t) => clave(t.dia_semana, t.franja)))
      setOriginal(s)
      setSel(new Set(s))
      setCargando(false)
    })()
  }, [uid])

  function alternar(k) {
    const n = new Set(sel)
    if (n.has(k)) n.delete(k); else n.add(k)
    setSel(n)
    setMsg({ tipo: '', texto: '' })
  }

  const horas = [...sel].reduce((a, k) => a + (FRANJAS.find((f) => f.clave === k.split('-')[1])?.horas || 0), 0)

  async function guardar() {
    if (sel.size === 0) return setMsg({ tipo: 'error', texto: 'Elige al menos un turno' })
    setMsg({ tipo: '', texto: 'Guardando…' })

    const quitar = [...original].filter((k) => !sel.has(k))
    const agregar = [...sel].filter((k) => !original.has(k))

    for (const k of quitar) {
      const [d, c] = k.split('-')
      const { error } = await supabase.from('turnos').delete()
        .eq('vendedor_id', uid).eq('dia_semana', Number(d)).eq('franja', c).eq('semana_rotacion', 1)
      if (error) { console.error(error); return setMsg({ tipo: 'error', texto: 'No pudimos guardar. Intenta de nuevo.' }) }
    }

    if (agregar.length > 0) {
      const filas = agregar.map((k) => {
        const [d, c] = k.split('-')
        const f = FRANJAS.find((x) => x.clave === c)
        return { vendedor_id: uid, dia_semana: Number(d), franja: c, hora_inicio: f.inicio, hora_fin: f.fin, semana_rotacion: 1 }
      })
      const { error } = await supabase.from('turnos').insert(filas)
      if (error) { console.error(error); return setMsg({ tipo: 'error', texto: 'No pudimos guardar. Intenta de nuevo.' }) }
    }

    setOriginal(new Set(sel))
    setMsg({ tipo: 'ok', texto: 'Turnos guardados' })
  }

  if (cargando) return <p className="msg">Cargando…</p>

  return (
    <div>
      <p className="sub">Toca las franjas en las que vas a vender. Se repiten cada semana.</p>
      <div className="resumen">
        <div><small>Turnos por semana</small><strong>{sel.size}</strong></div>
        <div><small>Horas por semana</small><strong>{horas}</strong></div>
      </div>

      {DIAS.map((d, i) => (
        <div className="fila-turno" key={d}>
          <span className="dia">{d}</span>
          {FRANJAS.map((f) => {
            const k = clave(i + 1, f.clave)
            return (
              <button key={f.clave} className={'franja' + (sel.has(k) ? ' on' : '')} onClick={() => alternar(k)}>
                {f.nombre}
                <small>{f.inicio.slice(0, 2).replace(/^0/, '')}–{f.fin.slice(0, 2).replace(/^0/, '')}</small>
              </button>
            )
          })}
        </div>
      ))}

      <button className="primario" onClick={guardar}>Guardar turnos</button>
      <p className={msg.tipo === 'error' ? 'error' : 'aviso'}>{msg.texto}</p>
    </div>
  )
}
