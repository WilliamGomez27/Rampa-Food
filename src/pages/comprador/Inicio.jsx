import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../supabase'
import AvisosPush from '../../components/AvisosPush'
import { estadoPush } from '../../lib/push'
import { DIAS, diaHoy, hora12 } from '../../lib/utils'

const FILTROS = [
  { id: 'todos', texto: 'Todos' },
  { id: 'comida', texto: 'Comida' },
  { id: 'bebidas', texto: 'Bebidas' },
]
const CATEGORIA = { comida: 'Comida', bebidas: 'Bebidas', ambos: 'Comida y bebidas' }

function iniciales(nombre) {
  return nombre.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}

// Próximo turno programado de un vendedor, mirando los próximos 7 días
function proximoTurno(turnos) {
  const ahora = new Date()
  const minAhora = ahora.getHours() * 60 + ahora.getMinutes()
  const hoy = diaHoy()
  for (let off = 0; off <= 7; off++) {
    const dia = ((hoy - 1 + off) % 7) + 1
    const delDia = turnos
      .filter((t) => t.dia_semana === dia)
      .sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio))
    for (const t of delDia) {
      const [h, m] = t.hora_inicio.split(':').map(Number)
      if (off === 0 && h * 60 + m <= minAhora) continue
      return { off, turno: t }
    }
  }
  return null
}

function textoVuelve(p) {
  if (!p) return 'Sin turnos programados'
  const h = hora12(p.turno.hora_inicio)
  if (p.off === 0) return `Vuelve a las ${h}`
  if (p.off === 1) return `Vuelve mañana ${h}`
  return `Vuelve el ${DIAS[p.turno.dia_semana - 1]} ${h}`
}

export default function Inicio({ uid, onVerMenu }) {
  const [lista, setLista] = useState([])
  const [avisos, setAvisos] = useState(new Set())
  const [filtro, setFiltro] = useState('todos')
  const [cargando, setCargando] = useState(true)
  const [pedirPush, setPedirPush] = useState(false)

  const cargar = useCallback(async () => {
    const [v, s, t, r, a] = await Promise.all([
      supabase.from('vendedores').select('id, nombre, categoria, foto_url'),
      supabase.from('sesiones_en_linea').select('vendedor_id, estado, turno_id').is('fin_real', null),
      supabase.from('turnos').select('id, vendedor_id, dia_semana, hora_inicio, hora_fin'),
      supabase.from('vendedores_resumen').select('*'),
      supabase.from('avisos').select('vendedor_id').eq('comprador_id', uid),
    ])
    const sesiones = new Map((s.data || []).map((x) => [x.vendedor_id, x]))
    const turnos = t.data || []
    const resumen = new Map((r.data || []).map((x) => [x.vendedor_id, x]))

    const armada = (v.data || []).map((x) => {
      const ses = sesiones.get(x.id)
      const propios = turnos.filter((tt) => tt.vendedor_id === x.id)
      let estado = 'fuera'
      let texto = ''
      if (ses?.estado === 'en_linea') {
        estado = 'en_linea'
        const turno = propios.find((tt) => tt.id === ses.turno_id)
        texto = turno ? `En línea hasta ${hora12(turno.hora_fin)}` : 'En línea ahora'
      } else if (ses?.estado === 'pausa') {
        estado = 'pausa'
        texto = 'En pausa, vuelve en unos minutos'
      } else {
        texto = textoVuelve(proximoTurno(propios))
      }
      return { ...x, estado, texto, resumen: resumen.get(x.id) }
    })

    const orden = { en_linea: 0, pausa: 1, fuera: 2 }
    armada.sort(
      (a, b) =>
        orden[a.estado] - orden[b.estado] ||
        Number(b.resumen?.calificacion_promedio || 0) - Number(a.resumen?.calificacion_promedio || 0)
    )
    setLista(armada)
    setAvisos(new Set((a.data || []).map((x) => x.vendedor_id)))
    setCargando(false)
  }, [uid])

  useEffect(() => {
    let activo = true
    Promise.resolve().then(() => {
      if (activo) cargar()
    })
    // Actualización en vivo cuando un vendedor se conecta, pausa o termina
    const canal = supabase
      .channel('inicio-sesiones')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sesiones_en_linea' }, () => cargar())
      .subscribe()
    const timer = setInterval(cargar, 60000)
    return () => {
      activo = false
      supabase.removeChannel(canal)
      clearInterval(timer)
    }
  }, [cargar])

  async function alternarAviso(vid) {
    if (avisos.has(vid)) {
      await supabase.from('avisos').delete().eq('comprador_id', uid).eq('vendedor_id', vid)
    } else {
      await supabase.from('avisos').insert({ comprador_id: uid, vendedor_id: vid })
      setPedirPush((await estadoPush()) !== 'activo')
    }
    cargar()
  }

  if (cargando) return <p className="msg">Cargando…</p>

  const visibles = lista.filter(
    (v) => filtro === 'todos' || v.categoria === filtro || v.categoria === 'ambos'
  )
  const enLinea = visibles.filter((v) => v.estado === 'en_linea')
  const otros = visibles.filter((v) => v.estado !== 'en_linea')

  function Tarjeta({ v }) {
    const r = v.resumen
    const conNota = r && Number(r.num_resenas) >= 3
    const nota = conNota ? `★ ${Number(r.calificacion_promedio).toFixed(1).replace('.', ',')}` : 'Nuevo'
    const resp = r?.respuesta_min != null ? ` · responde en ${Math.max(1, Math.round(Number(r.respuesta_min)))} min` : ''
    return (
      <div className="vend">
        <div className={'avatar' + (v.estado === 'en_linea' ? ' on' : '')}>
          {v.foto_url ? <img src={v.foto_url} alt={v.nombre} /> : iniciales(v.nombre)}
        </div>
        <div className="vend-info">
          <p className="vend-nombre">{v.nombre}</p>
          <p className="linea">{CATEGORIA[v.categoria]}</p>
          <p className={'estado-linea ' + v.estado}><span className="pt" />{v.texto}</p>
          {v.estado === 'en_linea' && <p className="linea">{nota}{resp}</p>}
        </div>
        {v.estado === 'en_linea' && <button onClick={() => onVerMenu(v)}>Ver menú</button>}
        {v.estado === 'fuera' && (
          <button onClick={() => alternarAviso(v.id)}>{avisos.has(v.id) ? 'Te avisaremos' : 'Avisarme'}</button>
        )}
      </div>
    )
  }

  return (
    <div>
      <AvisosPush rol="comprador" forzar={pedirPush} />
      <h2 style={{ fontSize: 18, margin: '12px 0 2px' }}>Quién está en línea</h2>
      <p className="sub">
        {enLinea.length === 1 ? '1 vendedor disponible ahora' : `${enLinea.length} vendedores disponibles ahora`}
      </p>

      <div className="chips" style={{ marginBottom: 14 }}>
        {FILTROS.map((f) => (
          <button key={f.id} className={'chip' + (filtro === f.id ? ' on' : '')} onClick={() => setFiltro(f.id)}>
            {f.texto}
          </button>
        ))}
      </div>

      {enLinea.map((v) => <Tarjeta key={v.id} v={v} />)}
      {enLinea.length === 0 && <p className="sub">Por ahora no hay vendedores en línea.</p>}

      {otros.length > 0 && <p className="seccion">Fuera de turno</p>}
      {otros.map((v) => <Tarjeta key={v.id} v={v} />)}
    </div>
  )
}
