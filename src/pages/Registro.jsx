import { useState } from 'react'
import { supabase } from '../supabase'

const CATEGORIAS = [
  { valor: 'comida', texto: 'Comida' },
  { valor: 'bebidas', texto: 'Bebidas' },
  { valor: 'ambos', texto: 'Ambos' },
]

async function obtenerEntorno() {
  const { data } = await supabase.from('entornos').select('id').limit(1)
  return data?.[0]?.id
}

// Registro solo para vendedores (los compradores entran sin registro)
export default function Registro({ uid, onListo }) {
  const [paso, setPaso] = useState(1)
  const [nombre, setNombre] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [categoria, setCategoria] = useState('')
  const [producto, setProducto] = useState('')
  const [precio, setPrecio] = useState('')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  function siguientePerfil() {
    if (!nombre.trim()) return setError('Escribe tu nombre')
    if (!/^\d{10}$/.test(whatsapp.replace(/\s/g, ''))) return setError('Ingresa tu WhatsApp con 10 dígitos')
    if (!categoria) return setError('Elige qué vendes')
    setError('')
    setPaso(2)
  }

  async function guardarVendedor() {
    const valor = Number(precio)
    if (!producto.trim()) return setError('Escribe el nombre de tu producto')
    if (!valor || valor <= 0) return setError('Escribe un precio mayor a 0')
    setError('')
    setGuardando(true)
    const entorno_id = await obtenerEntorno()
    if (!entorno_id) { setGuardando(false); return setError('No encontramos el entorno. Intenta de nuevo.') }

    const { error: e1 } = await supabase.from('vendedores').insert({
      id: uid, entorno_id, nombre: nombre.trim(),
      whatsapp: whatsapp.replace(/\s/g, ''), categoria,
    })
    if (e1) { setGuardando(false); console.error(e1); return setError('No pudimos guardar tu registro. Intenta de nuevo.') }

    const { error: e2 } = await supabase.from('productos').insert({
      vendedor_id: uid, nombre: producto.trim(), precio: Math.round(valor),
    })
    setGuardando(false)
    if (e2) console.error(e2) // el registro ya existe; el producto se puede agregar después
    onListo()
  }

  return (
    <div className="pantalla">
      <h1>Registro de vendedor</h1>
      <p className="sub">Paso {paso} de 2 · {paso === 1 ? 'Tu perfil' : 'Tu primer producto'}</p>
      <div className="barra"><span className="on" /><span className={paso === 2 ? 'on' : ''} /></div>

      {paso === 1 ? (
        <>
          <label htmlFor="nombre">Nombre que verán los compradores</label>
          <input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Marta R." />
          <label htmlFor="wa">WhatsApp</label>
          <input id="wa" type="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="3001234567" />
          <label>Qué vendes</label>
          <div className="chips">
            {CATEGORIAS.map((c) => (
              <button key={c.valor} type="button" className={'chip' + (categoria === c.valor ? ' on' : '')} onClick={() => { setCategoria(c.valor); setError('') }}>
                {c.texto}
              </button>
            ))}
          </div>
          <p className="error">{error}</p>
          <button className="primario" onClick={siguientePerfil}>Siguiente</button>
          <button className="enlace" onClick={() => supabase.auth.signOut()}>Cerrar sesión</button>
        </>
      ) : (
        <>
          <label htmlFor="prod">Nombre del producto</label>
          <input id="prod" value={producto} onChange={(e) => setProducto(e.target.value)} placeholder="Bandeja del día" />
          <label htmlFor="precio">Precio</label>
          <input id="precio" type="number" min="0" step="500" value={precio} onChange={(e) => setPrecio(e.target.value)} placeholder="15000" />
          <p className="sub" style={{ marginTop: 12 }}>Después podrás agregar más productos y sus fotos.</p>
          <p className="error">{error}</p>
          <button className="primario" onClick={guardarVendedor}>{guardando ? 'Guardando…' : 'Terminar registro'}</button>
          <button className="enlace" onClick={() => { setPaso(1); setError('') }}>Atrás</button>
        </>
      )}
    </div>
  )
}
