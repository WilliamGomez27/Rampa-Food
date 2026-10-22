import { useCallback, useEffect, useState } from 'react'
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
  const [previewUrl, setPreviewUrl] = useState(null)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  function elegirArchivo(file) {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setArchivo(file || null)
    setPreviewUrl(file ? URL.createObjectURL(file) : null)
  }

  function limpiarArchivo() {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setArchivo(null)
    setPreviewUrl(null)
    setClaveArchivo((c) => c + 1)
  }

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const cargar = useCallback(async () => {
    const { data } = await supabase
      .from('productos').select('*')
      .eq('vendedor_id', uid).eq('activo', true).order('creado_en')
    setProductos(data || [])
    setCargando(false)
  }, [uid])

  useEffect(() => {
    let activo = true
    supabase
      .from('productos')
      .select('*')
      .eq('vendedor_id', uid)
      .eq('activo', true)
      .order('creado_en')
      .then(({ data }) => {
        if (activo) {
          setProductos(data || [])
          setCargando(false)
        }
      })
    return () => {
      activo = false
    }
  }, [uid])

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
      setNombre(''); setDescripcion(''); setPrecio('')
      limpiarArchivo()
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
                <div style={{ display: 'inline-flex', gap: 6 }}>
                  <label className="boton" title="Tomar foto con cámara" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    📷 Foto
                    <input type="file" accept="image/*" capture="environment" onChange={(e) => ponerFoto(p, e.target.files[0])} />
                  </label>
                  <label className="boton" title="Elegir de galería" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    🖼️ Galería
                    <input type="file" accept="image/*" onChange={(e) => ponerFoto(p, e.target.files[0])} />
                  </label>
                </div>
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
        <label style={{ display: 'block', marginTop: 14, marginBottom: 6, fontSize: 13, fontWeight: 600 }}>Foto del producto</label>
        <div style={{ display: 'flex', gap: 10 }}>
          <label className="boton" style={{ flex: 1, textAlign: 'center', padding: '12px 10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer' }}>
            <span style={{ fontSize: 18 }}>📷</span>
            <span style={{ fontWeight: 600, fontSize: 13 }}>Tomar foto</span>
            <input
              key={`cam-${claveArchivo}`}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => elegirArchivo(e.target.files?.[0])}
            />
          </label>
          <label className="boton" style={{ flex: 1, textAlign: 'center', padding: '12px 10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer' }}>
            <span style={{ fontSize: 18 }}>🖼️</span>
            <span style={{ fontWeight: 600, fontSize: 13 }}>Galería</span>
            <input
              key={`gal-${claveArchivo}`}
              type="file"
              accept="image/*"
              onChange={(e) => elegirArchivo(e.target.files?.[0])}
            />
          </label>
        </div>

        {previewUrl && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12, padding: 10, border: '1px solid var(--bd)', borderRadius: 10, background: 'rgba(0,0,0,0.02)' }}>
            <img src={previewUrl} alt="Vista previa" style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 8, flex: 'none', border: '1px solid var(--bd)' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{archivo.name}</p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--ok)' }}>✓ Foto lista para subir ({(archivo.size / 1024).toFixed(0)} KB)</p>
            </div>
            <button
              type="button"
              onClick={limpiarArchivo}
              style={{ padding: '6px 10px', fontSize: 12, border: '1px solid var(--bd)', borderRadius: 6, background: 'transparent', color: 'var(--mut)', cursor: 'pointer' }}
            >
              Quitar
            </button>
          </div>
        )}

        <p className="error">{error}</p>
        <button className="primario" style={{ marginTop: 6 }} onClick={agregar}>{guardando ? 'Guardando…' : 'Agregar producto'}</button>
      </div>
    </div>
  )
}
