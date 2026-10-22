import { useEffect, useState } from 'react'
import { supabase } from '../../supabase'
import { FRANJAS, diaHoy, hora12, ahoraEnFranja } from '../../lib/utils'

export default function EstoyEnLinea({ uid }) {
  const [turnos, setTurnos] = useState([])
  const [sesion, setSesion] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    ; (async () => {
      const hoy = diaHoy()
      const ayer = hoy === 1 ? 7 : hoy - 1
      const [{ data: t }, { data: s }] = await Promise.all([
        supabase.from('turnos').select('*').eq('vendedor_id', uid).in('dia_semana', [ayer, hoy]).order('hora_inicio'),
        supabase.from('sesiones_en_linea').select('*').eq('vendedor_id', uid).is('fin_real', null).maybeSingle(),
      ])
      setTurnos(t || [])
      setSesion(s || null)
      setCargando(false)
    })()
  }, [uid])

  async function conectar() {
    setMsg('')
    const turno = ahoraEnFranja(turnos)
    const { data, error } = await supabase
      .from('sesiones_en_linea')
      .insert({ vendedor_id: uid, turno_id: turno?.id ?? null })
      .select().single()
    if (error) { console.error(error); return setMsg('No pudimos conectarte. Intenta de nuevo.') }
    setSesion(data)
  }

  async function cambiar(cambios, mensaje = '') {
    const { data, error } = await supabase
      .from('sesiones_en_linea').update(cambios).eq('id', sesion.id).select().single()
    if (error) { console.error(error); return setMsg('No pudimos actualizar tu estado.') }
    if (cambios.fin_real) { setSesion(null); setMsg(mensaje) } else { setSesion(data); setMsg('') }
  }

  if (cargando) return <p className="msg">Cargando…</p>

  const estado = sesion ? sesion.estado : 'fuera'
  const turnoActivo = ahoraEnFranja(turnos)
  const fueraDeTurno = !turnoActivo
  const hoy = diaHoy()
  const turnosVisibles = turnos.filter((t) => t.dia_semana === hoy || t.id === turnoActivo?.id)

  return (
    <div>
      <div className="tarjeta" style={{ marginTop: 0 }}>
        <p className="sub" style={{ margin: 0 }}>Tu turno de hoy</p>
        {turnosVisibles.length === 0 ? (
          <strong>Hoy no tienes turnos programados</strong>
        ) : (
          turnosVisibles.map((t) => (
            <p key={t.id} style={{ margin: '4px 0 0', fontWeight: 600 }}>
              {FRANJAS.find((f) => f.clave === t.franja)?.nombre} · {hora12(t.hora_inicio)} a {hora12(t.hora_fin)}
            </p>
          ))
        )}
      </div>

      <div style={{ marginTop: 14 }}>
        {estado === 'fuera' && <button className="grande" onClick={conectar}>Estoy en línea</button>}
        {estado === 'en_linea' && <div className="estado"><span className="punto ok" />En línea</div>}
        {estado === 'pausa' && <div className="estado pausa"><span className="punto pausa" />En pausa</div>}

        {estado === 'en_linea' && (
          <div className="dos">
            <button onClick={() => cambiar({ estado: 'pausa' })}>Pausar</button>
            <button onClick={() => cambiar({ estado: 'terminado', fin_real: new Date().toISOString() }, 'Turno terminado')}>Terminar turno</button>
          </div>
        )}
        {estado === 'pausa' && (
          <div className="dos">
            <button onClick={() => cambiar({ estado: 'en_linea' })}>Volver en línea</button>
            <button onClick={() => cambiar({ estado: 'terminado', fin_real: new Date().toISOString() }, 'Turno terminado')}>Terminar turno</button>
          </div>
        )}
      </div>

      {estado === 'fuera' && fueraDeTurno && turnos.length > 0 && (
        <p className="sub" style={{ marginTop: 10 }}>Ahora no tienes un turno activo, pero puedes conectarte igual.</p>
      )}
      <p className={msg.startsWith('Turno') ? 'aviso' : 'error'}>{msg}</p>

      <p className="sub" style={{ margin: '16px 0 6px' }}>Así te ven los compradores</p>
      <div className="vista">
        <span className={'punto' + (estado === 'en_linea' ? ' ok' : estado === 'pausa' ? ' pausa' : '')} />
        <span>
          {estado === 'en_linea' && 'En línea'}
          {estado === 'pausa' && 'En pausa, vuelve en unos minutos'}
          {estado === 'fuera' && 'Fuera de turno'}
        </span>
      </div>
    </div>
  )
}
