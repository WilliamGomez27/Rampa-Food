import { useEffect, useState } from 'react'
import { supabase } from '../../supabase'
import { precioTexto, subirFoto } from '../../lib/utils'

export default function MiMenu({ uid }) {
  const [productos, setProductos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [precio, setPrecio] = useState('')
  const [archivo, setArchivo] = useState(null)
  const [claveArchivo, setClaveArchivo] = useState(0)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function cargar() {
    const { data } = await supabase
      .from('productos').select('*')
      .eq('vendedor_id', uid).eq('activo', true).order('creado_en')
    setProductos(data || [])
    setCargando(false)
  }
  useEffect(() => { cargar() }, [uid])

  async function agregar() {
    const valor = Number(precio)
    if (!nombre.trim()) return setError('Escribe el nombre del producto')
    if (!valor || valor <= 0) return setError('Escribe un precio mayor a 0')
    if (!archivo) return setError('Agrega una foto del producto')
    setError('')
    setGuardando(true)
    try {
      const foto_url = await subirFoto(supabase, uid, archivo)
      const { error: e } = await supabase.from('productos').insert({
        vendedor_id: uid, nombre: nombre.trim(),
        descripcion: descripcion.trim() || null,
        precio: Math.round(valor), foto_url,
      })
      if (e) throw e
      setNombre(''); setDescripcion(''); setPrecio(''); setArchivo(null)
      setClaveArchivo((n) => n + 1)
      await cargar()
    } catch (e) {
      console.error(e)
      setError('No pudimos guardar el producto. Intenta de nuevo.')
    }
    setGuardando(false)
  }

  async function alternarAgotado(p) {
    await supabase.from('productos').update({ agotado: !p.agotado }).eq('id', p.id)
    cargar()
  }

  async function quitar(p) {
    if (!window.confirm('¿Quitar este producto del menú?')) return
    await supabase.from('productos').update({ activo: false }).eq('id', p.id)
    cargar()
  }

  async function ponerFoto(p, file) {
    if (!file) return
    try {
      const foto_url = await subirFoto(supabase, uid, file)
      await supabase.from('productos').update({ foto_url }).eq('id', p.id)
      cargar()
    } catch (e) {
      console.error(e)
      setError('No pudimos subir la foto. Intenta de nuevo.')
    }
  }

  if (cargando) return <p className="msg">Cargando…</p>

  return (
    <div>
      <p className="sub">Tu menú. Los productos agotados se muestran apagados a los compradores.</p>

      {productos.length === 0 && <p className="sub">Aún no tienes productos.</p>}
      {productos.map((p) => (
        <div className="item" key={p.id}>
          {p.foto_url ? <img className="miniatura" src={p.foto_url} alt={p.nombre} /> : <div className="miniatura">Sin foto</div>}
          <div className="info">
            <p className={p.agotado ? 'apagado' : ''} style={{ fontWeight: 600 }}>{p.nombre}</p>
            <p className="apagado" style={{ fontSize: 14 }}>{precioTexto(p.precio)}{p.agotado ? ' · Agotado' : ''}</p>
            <div className="acciones">
              <button onClick={() => alternarAgotado(p)}>{p.agotado ? 'Marcar disponible' : 'Marcar agotado'}</button>
              {!p.foto_url && (
                <label className="boton">
                  Subir foto
                  <input type="file" accept="image/*" onChange={(e) => ponerFoto(p, e.target.files[0])} />
                </label>
              )}
              <button onClick={() => quitar(p)}>Quitar</button>
            </div>
          </div>
        </div>
      ))}

      <div className="tarjeta">
        <strong>Agregar producto</strong>
        <label htmlFor="np">Nombre</label>
        <input id="np" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Sopa del día" />
        <label htmlFor="dp">Descripción (opcional)</label>
        <input id="dp" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Con arroz aparte" />
        <label htmlFor="pp">Precio</label>
        <input id="pp" type="number" min="0" step="500" value={precio} onChange={(e) => setPrecio(e.target.value)} placeholder="8000" />
        <label className="boton" style={{ marginTop: 14, padding: '10px 14px' }}>
          {archivo ? 'Foto lista: ' + archivo.name.slice(0, 18) : 'Subir foto'}
          <input key={claveArchivo} type="file" accept="image/*" onChange={(e) => setArchivo(e.target.files[0] || null)} />
        </label>
        <p className="error">{error}</p>
        <button className="primario" style={{ marginTop: 6 }} onClick={agregar}>{guardando ? 'Guardando…' : 'Agregar producto'}</button>
      </div>
    </div>
  )
}
