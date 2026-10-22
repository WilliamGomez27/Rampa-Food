import { useState } from 'react'
import { supabase } from '../supabase'

// Acceso solo para vendedores
export default function Auth({ admin = false }) {
  const [modo, setModo] = useState('entrar')
  const [email, setEmail] = useState('')
  const [clave, setClave] = useState('')
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [cargando, setCargando] = useState(false)

  async function enviar(e) {
    e.preventDefault()
    setError('')
    setAviso('')
    if (!email.includes('@')) return setError('Escribe un correo válido')
    if (clave.length < 6) return setError('La contraseña debe tener al menos 6 caracteres')

    setCargando(true)
    if (modo === 'entrar') {
      const { error } = await supabase.auth.signInWithPassword({ email, password: clave })
      if (error) setError('No pudimos iniciar sesión. Revisa tu correo y contraseña.')
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password: clave })
      if (error) setError('No pudimos crear la cuenta. Intenta con otro correo.')
      else if (!data.session) setAviso('Revisa tu correo para confirmar tu cuenta.')
    }
    setCargando(false)
  }

  return (
    <form className="pantalla" onSubmit={enviar}>
      <h1>{admin ? (modo === 'entrar' ? 'Acceso de administrador' : 'Crear cuenta de administrador') : (modo === 'entrar' ? 'Acceso de vendedores' : 'Crear cuenta de vendedor')}</h1>
      <p className="sub">{admin ? 'Panel de métricas de Rampa Food.' : 'Entra o crea tu cuenta para vender tus productos en la plataforma.'}</p>

      <label htmlFor="email">Correo</label>
      <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nombre@correo.com" />

      <label htmlFor="clave">Contraseña</label>
      <input id="clave" type="password" value={clave} onChange={(e) => setClave(e.target.value)} placeholder="Mínimo 6 caracteres" />

      <p className="error">{error}</p>
      {aviso && <p className="aviso">{aviso}</p>}

      <button className="primario" type="submit">
        {cargando ? 'Un momento…' : modo === 'entrar' ? 'Entrar' : 'Crear cuenta'}
      </button>
      <button
        className="enlace"
        type="button"
        onClick={() => { setModo(modo === 'entrar' ? 'crear' : 'entrar'); setError(''); setAviso('') }}
      >
        {modo === 'entrar' ? 'No tengo cuenta' : 'Ya tengo cuenta'}
      </button>
      <button className="enlace" type="button" style={{ display: 'block' }} onClick={() => { window.location.hash = '' }}>
        Volver a comprar
      </button>
    </form>
  )
}
