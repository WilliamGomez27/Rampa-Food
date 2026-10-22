import { useState } from 'react'
import { supabase } from '../../supabase'
import { precioTexto } from '../../lib/utils'
import { mensajeWhatsApp, enlaceWhatsApp } from '../../lib/pedidos'

function traducir(msg = '') {
  if (msg.includes('vendedor_no_disponible')) return 'El vendedor ya no está en línea. Elige otro vendedor.'
  if (msg.includes('producto_invalido')) return 'Algún producto ya no está disponible. Revisa tu carrito.'
  if (msg.includes('punto_invalido')) return 'El punto de entrega ya no está disponible. Elige otro.'
  if (msg.includes('demasiados_pedidos')) return 'Ya tienes 2 pedidos en curso. Espera a que termine uno para pedir otro.'
  if (msg.includes('nombre_requerido')) return 'Escribe tu nombre para que el vendedor sepa para quién es.'
  if (msg.includes('posicion_invalida')) return 'Escribe tu posición: un número del 1 al 107, o E1 a E29, F1 a F20.'
  return 'No pudimos enviar tu pedido. Intenta de nuevo.'
}

export default function Confirmar({ carrito, entrega, perfil, onNombre, onVolver, onCreado }) {
  const [nombre, setNombre] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  const vendedor = carrito.vendedor
  const items = Object.values(carrito.items).map((i) => ({
    producto_id: i.producto.id, nombre: i.producto.nombre, cantidad: i.cantidad, precio: i.producto.precio,
  }))
  const total = items.reduce((a, i) => a + i.cantidad * i.precio, 0)
  const pideNombre = !perfil.nombre

  const vistaPrevia = mensajeWhatsApp({
    numero: 'por asignar', vendedorNombre: vendedor.nombre, items, total,
    puntoNombre: entrega.puntoNombre, pago: entrega.pago, nota: entrega.nota,
  })

  async function enviar(conWhatsApp) {
    setError('')
    const nombreFinal = pideNombre ? nombre.trim().slice(0, 40) : perfil.nombre
    if (!nombreFinal) return setError('Escribe tu nombre para que el vendedor sepa para quién es')

    setEnviando(true)
    // Se abre la ventana en el toque del usuario para que el navegador no la bloquee
    const ventana = conWhatsApp ? window.open('', '_blank') : null

    if (pideNombre) {
      const { error: en } = await supabase.from('compradores').update({ nombre: nombreFinal }).eq('id', perfil.id)
      if (en) {
        console.error(en)
        ventana?.close()
        setEnviando(false)
        return setError('No pudimos guardar tu nombre. Intenta de nuevo.')
      }
      onNombre?.()
    }

    const { data, error: e } = await supabase.rpc('crear_pedido', {
      p_vendedor: vendedor.id,
      p_punto: entrega.puntoId,
      p_pago: entrega.pagoValor,
      p_nota: entrega.nota || null,
      p_posicion: entrega.posicion || null,
      p_items: items.map((i) => ({ producto_id: i.producto_id, cantidad: i.cantidad })),
    })
    if (e) {
      console.error(e)
      ventana?.close()
      setEnviando(false)
      return setError(traducir(e.message))
    }

    const { data: v } = await supabase.from('vendedores').select('whatsapp').eq('id', vendedor.id).single()
    const texto = mensajeWhatsApp({
      numero: data.numero, vendedorNombre: vendedor.nombre, items, total: data.total,
      puntoNombre: entrega.puntoNombre, pago: entrega.pago, nota: entrega.nota,
    })
    const url = v?.whatsapp ? enlaceWhatsApp(v.whatsapp, texto) : null
    if (ventana && url) ventana.location.href = url
    else ventana?.close()

    setEnviando(false)
    onCreado({ id: data.id, numero: data.numero, url })
  }

  return (
    <div>
      <button className="enlace" onClick={onVolver}>← Volver al carrito</button>
      <h2 style={{ fontSize: 18, margin: '8px 0 2px' }}>Confirmar pedido</h2>
      <p className="sub">Tu pedido le llega a {vendedor.nombre} dentro de la app, con aviso a su celular. Si quieres, también puedes escribirle por WhatsApp con este mensaje:</p>

      <div className="globo">{vistaPrevia}</div>

      {pideNombre && (
        <>
          <label htmlFor="nom">¿Cómo te llamas?</label>
          <input id="nom" value={nombre} maxLength={40} onChange={(e) => { setNombre(e.target.value); setError('') }} placeholder="Laura G." />
          <p className="sub" style={{ margin: '6px 0 0', fontSize: 12 }}>
            Solo la primera vez, para que el vendedor sepa para quién es el pedido.
          </p>
        </>
      )}

      <p className="sub" style={{ marginTop: 12, fontSize: 12 }}>
        Tu pedido queda registrado en la app antes de abrir WhatsApp. Si {vendedor.nombre} no responde a tiempo, te avisamos.
      </p>
      <p style={{ fontWeight: 600, margin: '8px 0 0' }}>Total: {precioTexto(total)}</p>

      <button className="primario" disabled={enviando} onClick={() => enviar(false)}>{enviando ? 'Enviando…' : 'Enviar pedido'}</button>
      <button style={{ width: '100%', marginTop: 10 }} disabled={enviando} onClick={() => enviar(true)}>Enviar y escribir por WhatsApp</button>
      <p className="error">{error}</p>
    </div>
  )
}
