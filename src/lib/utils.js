export const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']


export const FRANJAS = [
  { clave: 'manana', nombre: 'Mañana', inicio: '04:00', fin: '12:00', horas: 8 },
  { clave: 'tarde', nombre: 'Tarde', inicio: '12:00', fin: '20:00', horas: 8 },
  { clave: 'noche', nombre: 'Noche', inicio: '20:00', fin: '04:00', horas: 8 },
]

// 1 = lunes ... 7 = domingo
export function diaHoy(d = new Date()) {
  return ((d.getDay() + 6) % 7) + 1
}

export function hora12(t) {
  const [h, m] = t.split(':').map(Number)
  const realH = h % 24
  const sufijo = (realH >= 12 && realH < 24) || (h >= 12 && h < 24) ? 'pm' : 'am'
  const h12 = realH % 12 === 0 ? 12 : realH % 12
  return `${h12}:${String(m).padStart(2, '0')} ${sufijo}`
}

export function precioTexto(p) {
  return '$' + Math.round(p).toLocaleString('es-CO')
}

// Devuelve el turno activo considerando turnos diurnos y nocturnos (cruce de medianoche)
export function ahoraEnFranja(turnos, dia = diaHoy(), d = new Date()) {
  const min = d.getHours() * 60 + d.getMinutes()
  const diaAyer = dia === 1 ? 7 : dia - 1

  return (
    turnos.find((t) => {
      const hInicio = t.hora_inicio || t.inicio
      const hFin = t.hora_fin || t.fin
      if (!hInicio || !hFin) return false
      const [h1, m1] = hInicio.split(':').map(Number)
      const [h2, m2] = hFin.split(':').map(Number)
      const inicioMin = h1 * 60 + m1
      const finMin = h2 * 60 + m2
      const cruzaMedianoche = finMin > 1440 || finMin <= inicioMin
      const finDiaSiguiente = finMin > 1440 ? finMin - 1440 : finMin

      if (t.dia_semana === undefined) {
        if (cruzaMedianoche) return min >= inicioMin || min < finDiaSiguiente
        return min >= inicioMin && min < finMin
      }

      if (t.dia_semana === dia) {
        if (cruzaMedianoche) return min >= inicioMin
        return min >= inicioMin && min < finMin
      }
      if (t.dia_semana === diaAyer && cruzaMedianoche) {
        return min < finDiaSiguiente
      }
      return false
    }) ?? null
  )
}

// Reduce la foto a máximo 800 px y la convierte a JPEG para ahorrar datos
export async function comprimirImagen(file, max = 800) {
  const bmp = await createImageBitmap(file)
  const escala = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bmp.width * escala)
  canvas.height = Math.round(bmp.height * escala)
  canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height)
  return new Promise((resolver) => canvas.toBlob((b) => resolver(b), 'image/jpeg', 0.8))
}

export async function subirFoto(supabase, uid, file) {
  const blob = await comprimirImagen(file)
  const ruta = `${uid}/${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage.from('fotos').upload(ruta, blob, { contentType: 'image/jpeg' })
  if (error) throw error
  return supabase.storage.from('fotos').getPublicUrl(ruta).data.publicUrl
}
