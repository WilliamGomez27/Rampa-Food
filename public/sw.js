// Service worker: recibe las notificaciones push y las muestra.
// No guarda archivos en caché a propósito, para que siempre cargue la última versión.

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))
self.addEventListener('fetch', () => {})

self.addEventListener('push', (event) => {
  let datos = {}
  try {
    datos = event.data ? event.data.json() : {}
  } catch (e) {
    datos = { title: 'Aviso', body: event.data ? event.data.text() : '' }
  }
  const titulo = datos.title || 'Rampa Food'
  event.waitUntil(
    self.registration.showNotification(titulo, {
      body: datos.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: datos.tag || undefined,
      renotify: !!datos.tag,
      data: { url: datos.url || '/' },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    (async () => {
      const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const v of ventanas) {
        if ('focus' in v) {
          await v.focus()
          return
        }
      }
      await self.clients.openWindow(url)
    })()
  )
})
