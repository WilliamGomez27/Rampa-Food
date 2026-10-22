import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../supabase'
import { precioTexto } from '../../lib/utils'
import Grafica from '../../components/Grafica'
import { opcionTorta, opcionVelas, horaTxt } from '../../lib/graficas'
import '../../admin.css'

const PERIODOS = [
  { dias: 1, texto: 'Hoy' },
  { dias: 7, texto: '7 días' },
  { dias: 30, texto: '30 días' },
  { dias: 0, texto: 'Todo' },
]
const ESTADOS = {
  enviado: 'Enviado', aceptado: 'Aceptado', listo: 'Listo',
  entregado: 'Entregado', rechazado: 'Rechazado', sin_respuesta: 'Sin respuesta',
}
const PAGOS = { efectivo: 'Efectivo', transferencia: 'Transferencia' }

const coma = (n) => String(n).replace('.', ',')

function promedio(dist) {
  const total = dist.reduce((a, x) => a + x.n, 0)
  if (total === 0) return null
  return coma((dist.reduce((a, x) => a + x.estrellas * x.n, 0) / total).toFixed(1))
}

function Torta({ titulo, datos, texto, pie }) {
  const opcion = useMemo(() => opcionTorta(datos, texto), [datos, texto])
  return (
    <div className="graf">
      <h3>{titulo}</h3>
      {datos.length === 0 ? <p className="vacio">Sin datos en este periodo</p> : <Grafica opcion={opcion} />}
      {pie && <p className="nota">{pie}</p>}
    </div>
  )
}

export default function PanelAdmin({ onSalir }) {
  const [dias, setDias] = useState(7)
  const [d, setD] = useState(null)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(true)

  const cargar = useCallback(async (n) => {
    setCargando(true)
    setError('')
    const { data, error: e } = await supabase.rpc('admin_metricas', { p_dias: n })
    if (e) { console.error(e); setError('No pudimos cargar las métricas.'); setCargando(false); return }
    setD(data)
    setCargando(false)
  }, [])

  useEffect(() => {
    let activo = true
    Promise.resolve().then(() => {
      if (activo) cargar(dias)
    })
    return () => {
      activo = false
    }
  }, [dias, cargar])

  const css = getComputedStyle(document.documentElement)
  const texto = css.getPropertyValue('--fg').trim() || '#333'
  const lineas = css.getPropertyValue('--bd').trim() || '#ddd'

  const horas = useMemo(() => (d ? d.por_hora.filter((h) => h.total > 0) : []), [d])
  const velas = useMemo(() => opcionVelas(horas, texto, lineas), [horas, texto, lineas])

  if (!d) {
    return (
      <div className="pantalla ancha">
        <p className="msg">{error || 'Cargando…'}</p>
        <button className="enlace" onClick={onSalir}>Cerrar sesión</button>
      </div>
    )
  }

  const k = d.kpis
  const tasa = k.pedidos ? Math.round((k.entregados / k.pedidos) * 100) : 0
  const pico = horas.length ? horas.reduce((a, h) => (h.total > a.total ? h : a), horas[0]) : null

  const porEstado = d.por_estado.map((x) => ({ name: ESTADOS[x.nombre] || x.nombre, value: x.n }))
  const porPago = d.por_pago.map((x) => ({ name: PAGOS[x.nombre] || x.nombre, value: x.n }))
  const porVendedor = d.ranking_vendedores.map((x) => ({ name: x.nombre, value: x.pedidos }))
  const calV = d.cal_vendedores.map((x) => ({ name: `${x.estrellas} ★`, value: x.n }))
  const calC = d.cal_compradores.map((x) => ({ name: `${x.estrellas} ★`, value: x.n }))
  const promV = promedio(d.cal_vendedores)
  const promC = promedio(d.cal_compradores)

  return (
    <div className="pantalla ancha">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0 }}>Métricas</h1>
        <button className="enlace" style={{ marginTop: 0 }} onClick={onSalir}>Cerrar sesión</button>
      </div>
      <p className="sub">Del {d.desde} al {d.hasta} (hora de Colombia)</p>

      <div className="chips" style={{ marginBottom: 6 }}>
        {PERIODOS.map((p) => (
          <button key={p.dias} className={'chip' + (dias === p.dias ? ' on' : '')} onClick={() => setDias(p.dias)}>{p.texto}</button>
        ))}
        <button className="chip" onClick={() => cargar(dias)}>{cargando ? 'Actualizando…' : 'Actualizar'}</button>
      </div>
      <p className="error">{error}</p>

      <div className="kpis">
        <div className="kpi"><small>Pedidos</small><strong>{k.pedidos}</strong></div>
        <div className="kpi"><small>Entregados</small><strong>{k.entregados} ({tasa}%)</strong></div>
        <div className="kpi"><small>Sin respuesta</small><strong>{k.sin_respuesta}</strong></div>
        <div className="kpi"><small>Rechazados</small><strong>{k.rechazados}</strong></div>
        <div className="kpi"><small>Compradores</small><strong>{k.compradores}</strong></div>
        <div className="kpi"><small>Vendedores activos</small><strong>{k.vendedores}</strong></div>
        <div className="kpi"><small>Ticket promedio</small><strong>{precioTexto(k.ticket_promedio)}</strong></div>
        <div className="kpi"><small>Respuesta promedio</small><strong>{k.respuesta_min == null ? '—' : `${coma(k.respuesta_min)} min`}</strong></div>
      </div>

      <div className="graf" style={{ marginBottom: 12 }}>
        <h3>Pedidos por hora del día</h3>
        {horas.length === 0 ? (
          <p className="vacio">Sin pedidos en este periodo</p>
        ) : (
          <>
            <Grafica opcion={velas} />
            <p className="nota">
              Hora pico: {horaTxt(pico.hora)} ({pico.total} pedidos en total).
              Cada vela muestra, para esa hora, cuántos pedidos hubo por día: el cuerpo va del 25% al 75% de los días y las mechas marcan el mínimo y el máximo.
            </p>
          </>
        )}
      </div>

      <div className="graficas dos">
        <Torta titulo="Pedidos por estado" datos={porEstado} texto={texto} />
        <Torta titulo="Pedidos por vendedor" datos={porVendedor} texto={texto} />
        <Torta titulo="Forma de pago" datos={porPago} texto={texto} />
        <Torta
          titulo="Calificación de los vendedores"
          datos={calV}
          texto={texto}
          pie={promV ? `Promedio: ${promV} de 5` : null}
        />
        <Torta
          titulo="Calificación de los compradores"
          datos={calC}
          texto={texto}
          pie={promC ? `Promedio: ${promC} de 5` : null}
        />
      </div>

      <div className="graf" style={{ marginTop: 12 }}>
        <h3>Ranking de vendedores</h3>
        {d.ranking_vendedores.length === 0 ? (
          <p className="vacio">Sin datos en este periodo</p>
        ) : (
          <table className="tabla">
            <thead>
              <tr><th>Vendedor</th><th className="num">Pedidos</th><th className="num">Promedio</th><th className="num">Reseñas</th></tr>
            </thead>
            <tbody>
              {d.ranking_vendedores.map((v) => (
                <tr key={v.nombre}>
                  <td>{v.nombre}</td>
                  <td className="num">{v.pedidos}</td>
                  <td className="num">{v.promedio == null ? '—' : `${coma(v.promedio)} ★`}</td>
                  <td className="num">{v.resenas}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
