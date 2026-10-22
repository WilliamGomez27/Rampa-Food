import { precioTexto } from './utils'

// Cambia el código si tu entorno no está en Colombia
export const CODIGO_PAIS = '57'

export function mensajeWhatsApp({ numero, vendedorNombre, items, total, puntoNombre, pago, nota }) {
  const lineas = [
    `Hola ${vendedorNombre}, quiero hacer un pedido (n.º ${numero}):`,
    ...items.map((i) => `• ${i.cantidad} ${i.nombre}`),
    '',
    `Total: ${precioTexto(total)}`,
    `Entrega: ${puntoNombre}`,
    `Pago: ${pago}`,
  ]
  if (nota) lineas.push(`Nota: ${nota}`)
  return lineas.join('\n')
}

export function enlaceWhatsApp(telefono, texto) {
  return `https://wa.me/${CODIGO_PAIS}${telefono}?text=${encodeURIComponent(texto)}`
}

export const TEXTO_ESTADO = {
  enviado: 'Nuevo',
  aceptado: 'Aceptado',
  listo: 'Listo',
  entregado: 'Entregado',
  rechazado: 'Rechazado',
  sin_respuesta: 'Sin respuesta',
}

export function minutosDesde(iso) {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000))
}

// Sonido corto y vibración cuando llega un pedido nuevo (con la app abierta)
export function alertaSonora() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (Ctx) {
      const ctx = new Ctx()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = 880
      gain.gain.value = 0.15
      osc.start()
      osc.stop(ctx.currentTime + 0.25)
    }
  } catch { /* algunos navegadores bloquean el audio sin un toque previo */ }
  if (navigator.vibrate) navigator.vibrate([200, 100, 200])
}
