import { supabase } from '../supabase'

const VAPID = import.meta.env.VITE_VAPID_PUBLIC_KEY

function aBytes(base64) {
  const relleno = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + relleno).replace(/-/g, '+').replace(/_/g, '/')
  const crudo = atob(b64)
  return Uint8Array.from([...crudo].map((c) => c.charCodeAt(0)))
}

export const esIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

export const esInstalada = () =>
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true

export const soportaPush = () =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

export async function registrarSW() {
  if (!('serviceWorker' in navigator)) return null
  try {
    return await navigator.serviceWorker.register('/sw.js')
  } catch (e) {
    console.error(e)
    return null
  }
}

// 'no_soportado' | 'instalar' | 'denegado' | 'activo' | 'inactivo'
export async function estadoPush() {
  if (esIOS() && !esInstalada()) return 'instalar' // en iPhone solo funciona con la app instalada
  if (!soportaPush() || !VAPID) return 'no_soportado'
  if (Notification.permission === 'denied') return 'denegado'
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  return sub && Notification.permission === 'granted' ? 'activo' : 'inactivo'
}

// Debe llamarse desde un toque del usuario (lo exige iPhone)
export async function activarPush() {
  const permiso = await Notification.requestPermission()
  if (permiso !== 'granted') return 'denegado'

  await registrarSW()
  const reg = await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: aBytes(VAPID) })
  }
  const j = sub.toJSON()
  const { error } = await supabase.rpc('registrar_push', {
    p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth,
  })
  if (error) throw error
  return 'activo'
}

// Si el dispositivo ya estaba suscrito (por ejemplo, desde una sesión de comprador),
// lo vuelve a registrar a nombre de la cuenta actual. Así un vendedor que entra en el
// mismo celular o navegador también recibe sus avisos.
export async function sincronizarPush() {
  if (!('serviceWorker' in navigator)) return
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  if (!sub) return
  const j = sub.toJSON()
  const { error } = await supabase.rpc('registrar_push', {
    p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth,
  })
  if (error) throw error
}
