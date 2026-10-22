import { describe, it, expect } from 'vitest'
import {
  mensajeWhatsApp,
  enlaceWhatsApp,
  TEXTO_ESTADO,
  minutosDesde,
  CODIGO_PAIS,
} from '../src/lib/pedidos'

describe('Módulo de Pedidos (src/lib/pedidos.js)', () => {
  describe('CODIGO_PAIS', () => {
    it('debe estar configurado para Colombia (+57)', () => {
      expect(CODIGO_PAIS).toBe('57')
    })
  })

  describe('mensajeWhatsApp', () => {
    it('genera el texto correcto con items, total y sin nota', () => {
      const msg = mensajeWhatsApp({
        numero: 42,
        vendedorNombre: 'Empanadas Doña Mary',
        items: [
          { cantidad: 2, nombre: 'Empanada de Carne' },
          { cantidad: 1, nombre: 'Gaseosa Postobón' },
        ],
        total: 12000,
        puntoNombre: 'Posición 45',
        pago: 'Nequi',
      })

      expect(msg).toContain('Hola Empanadas Doña Mary, quiero hacer un pedido (n.º 42):')
      expect(msg).toContain('• 2 Empanada de Carne')
      expect(msg).toContain('• 1 Gaseosa Postobón')
      expect(msg).toContain('Total: $12.000')
      expect(msg).toContain('Entrega: Posición 45')
      expect(msg).toContain('Pago: Nequi')
      expect(msg).not.toContain('Nota:')
    })

    it('incluye la nota cuando está presente', () => {
      const msg = mensajeWhatsApp({
        numero: 10,
        vendedorNombre: 'Hamburguesas Don Carlos',
        items: [{ cantidad: 1, nombre: 'Hamburguesa Especial' }],
        total: 18000,
        puntoNombre: 'Posición 107',
        pago: 'Efectivo',
        nota: 'Sin cebolla por favor',
      })

      expect(msg).toContain('Nota: Sin cebolla por favor')
    })
  })

  describe('enlaceWhatsApp', () => {
    it('construye la URL correcta con wa.me, código de país y texto codificado', () => {
      const enlace = enlaceWhatsApp('3001234567', 'Hola mundo')
      expect(enlace).toBe('https://wa.me/573001234567?text=Hola%20mundo')
    })
  })

  describe('TEXTO_ESTADO', () => {
    it('contiene las etiquetas legibles para todos los estados de pedido', () => {
      expect(TEXTO_ESTADO.enviado).toBe('Nuevo')
      expect(TEXTO_ESTADO.aceptado).toBe('Aceptado')
      expect(TEXTO_ESTADO.listo).toBe('Listo')
      expect(TEXTO_ESTADO.entregado).toBe('Entregado')
      expect(TEXTO_ESTADO.rechazado).toBe('Rechazado')
      expect(TEXTO_ESTADO.sin_respuesta).toBe('Sin respuesta')
    })
  })

  describe('minutosDesde', () => {
    it('calcula los minutos transcurridos correctamente', () => {
      const hace10Min = new Date(Date.now() - 10 * 60 * 1000).toISOString()
      expect(minutosDesde(hace10Min)).toBe(10)
    })

    it('devuelve 0 si la fecha es futura o recién creada', () => {
      const ahora = new Date().toISOString()
      expect(minutosDesde(ahora)).toBe(0)

      const futuro = new Date(Date.now() + 5000).toISOString()
      expect(minutosDesde(futuro)).toBe(0)
    })
  })
})
