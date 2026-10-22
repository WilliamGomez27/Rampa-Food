import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import Auth from './pages/Auth'
import Registro from './pages/Registro'
import PanelVendedor from './pages/vendedor/PanelVendedor'
import PanelComprador from './pages/comprador/PanelComprador'

// El panel de métricas se carga solo cuando el administrador lo abre
const PanelAdmin = lazy(() => import('./pages/admin/PanelAdmin'))

const rutaActual = () => window.location.hash.replace('#', '')

// Compradores: entran directo (cuenta anónima automática).
// Vendedores: tu-app/#vendedor   ·   Administrador: tu-app/#admin
export default function App() {
  const [ruta, setRuta] = useState(rutaActual())
  const [session, setSession] = useState(undefined) // undefined = cargando
  const [perfil, setPerfil] = useState(undefined)   // undefined = cargando, null = sin perfil
  const [esAdmin, setEsAdmin] = useState(null)      // null = verificando
  const [errorEntrada, setErrorEntrada] = useState('')
  const entrando = useRef(false)

  const modoAdmin = ruta === 'admin'
  const modoCuenta = ruta === 'vendedor' || modoAdmin
  const uid = session?.user?.id
  const esAnonimo = session?.user?.is_anonymous === true

  useEffect(() => {
    const h = () => setRuta(rutaActual())
    window.addEventListener('hashchange', h)
    return () => window.removeEventListener('hashchange', h)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_evento, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  async function entrarAnonimo() {
    if (entrando.current) return
    entrando.current = true
    setErrorEntrada('')
    const { error } = await supabase.auth.signInAnonymously()
    if (error) {
      console.error(error)
      setErrorEntrada('No pudimos abrir la app. Revisa tu conexión e intenta de nuevo.')
    }
    entrando.current = false
  }

  useEffect(() => {
    if (session === undefined) return
    if (session === null && !modoCuenta) entrarAnonimo()
    if (session && esAnonimo && modoCuenta) supabase.auth.signOut()
  }, [session, modoCuenta])

  // Administrador: se verifica en el servidor
  useEffect(() => {
    if (!modoAdmin || !session || esAnonimo) return
    setEsAdmin(null)
    supabase.rpc('es_admin').then(({ data }) => setEsAdmin(data === true))
  }, [modoAdmin, uid])

  async function cargarPerfil(id, anonimo) {
    const { data: v } = await supabase.from('vendedores').select('*').eq('id', id).maybeSingle()
    if (v) return setPerfil({ rol: 'vendedor', ...v })
    const { data: c } = await supabase.from('compradores').select('*').eq('id', id).maybeSingle()
    if (c) return setPerfil({ rol: 'comprador', ...c })

    if (anonimo) {
      // Primera vez: se crea el perfil de comprador sin pedir nada
      const { data: ents } = await supabase.from('entornos').select('id').limit(1)
      const entorno_id = ents?.[0]?.id
      if (!entorno_id) return setErrorEntrada('No encontramos el entorno. Intenta de nuevo.')
      const { error } = await supabase.from('compradores').insert({ id, entorno_id })
      if (error) {
        console.error(error)
        return setErrorEntrada('No pudimos abrir la app. Intenta de nuevo.')
      }
      return setPerfil({ rol: 'comprador', id, entorno_id, nombre: null })
    }
    setPerfil(null)
  }

  useEffect(() => {
    if (uid) {
      setPerfil(undefined)
      cargarPerfil(uid, esAnonimo)
    }
  }, [uid])

  const salir = () => supabase.auth.signOut()

  if (errorEntrada) {
    return (
      <div className="pantalla">
        <p className="msg">{errorEntrada}</p>
        <button
          className="primario"
          onClick={() => {
            setErrorEntrada('')
            if (!session) entrarAnonimo()
            else cargarPerfil(uid, esAnonimo)
          }}
        >
          Reintentar
        </button>
      </div>
    )
  }

  if (session === undefined) return <p className="msg">Cargando…</p>
  if (modoCuenta && esAnonimo) return <p className="msg">Cargando…</p>
  if (!session) return modoCuenta ? <Auth admin={modoAdmin} /> : <p className="msg">Cargando…</p>

  if (modoAdmin) {
    if (esAdmin === null) return <p className="msg">Cargando…</p>
    if (!esAdmin) {
      return (
        <div className="pantalla">
          <h1>Sin acceso</h1>
          <p className="sub">Esta cuenta no tiene permiso para ver las métricas.</p>
          <button className="enlace" onClick={salir}>Cerrar sesión</button>
        </div>
      )
    }
    return (
      <Suspense fallback={<p className="msg">Cargando…</p>}>
        <PanelAdmin onSalir={salir} />
      </Suspense>
    )
  }

  if (perfil === undefined) return <p className="msg">Cargando…</p>
  if (perfil === null) return <Registro uid={uid} onListo={() => cargarPerfil(uid, false)} />

  if (perfil.rol === 'comprador') {
    return (
      <PanelComprador
        perfil={perfil}
        onSalir={esAnonimo ? undefined : salir}
        onRecargarPerfil={() => cargarPerfil(uid, esAnonimo)}
      />
    )
  }
  if (perfil.aprobacion === 'aprobado') return <PanelVendedor perfil={perfil} onSalir={salir} />

  return (
    <div className="pantalla">
      <h1>Hola, {perfil.nombre}</h1>
      <div className="tarjeta">
        <strong>{perfil.aprobacion === 'pendiente' ? 'Tu registro está en revisión' : 'Tu registro no fue aprobado'}</strong>
        <p className="sub" style={{ marginTop: 8 }}>
          {perfil.aprobacion === 'pendiente'
            ? 'Te activaremos pronto. Cuando te aprueben, podrás configurar tus turnos y recibir pedidos.'
            : 'Comunícate con quien administra la plataforma para más información.'}
        </p>
      </div>
      <button className="enlace" onClick={salir}>Cerrar sesión</button>
    </div>
  )
}
