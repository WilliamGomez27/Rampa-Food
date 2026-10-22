export const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']


export const FRANJAS = [
  { clave: 'manana', nombre: 'Mañana', inicio: '04:00', fin: '12:00', horas: 8 },
  { clave: 'tarde', nombre: 'Tarde', inicio: '12:00', fin: '20:00', horas: 8 },
  { clave: 'noche', nombre: 'Noche', inicio: '20:00', fin: '28:00', horas: 8 },
]

// 1 = lunes ... 7 = domingo
export function diaHoy() {
  return ((new Date().getDay() + 6) % 7) + 1
}

export function hora12(t) {
  const [h, m] = t.split(':').map(Number)
  const sufijo = h >= 12 ? 'pm' : 'am'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${sufijo}`
}

export function precioTexto(p) {
  return '$' + Math.round(p).toLocaleString('es-CO')
}

// Devuelve el turno de hoy que contiene la hora actual (o null)
export function ahoraEnFranja(turnosHoy) {
  const d = new Date()
  const min = d.getHours() * 60 + d.getMinutes()
  return (
    turnosHoy.find((t) => {
      const [h1, m1] = t.hora_inicio.split(':').map(Number)
      const [h2, m2] = t.hora_fin.split(':').map(Number)
      return min >= h1 * 60 + m1 && min < h2 * 60 + m2
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
