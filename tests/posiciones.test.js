import { describe, it, expect } from 'vitest'

describe('Validación de Posiciones de Entrega (1..107, E1..E29, F1..F20)', () => {
  const patron = '^(10[0-7]|[1-9][0-9]?|E([1-9]|1[0-9]|2[0-9])|F([1-9]|1[0-9]|20))$'
  const regex = new RegExp(patron)

  describe('Posiciones Numéricas Válidas (1 a 107)', () => {
    it('debe aceptar límites 1 y 107', () => {
      expect(regex.test('1')).toBe(true)
      expect(regex.test('107')).toBe(true)
    })

    it('debe aceptar todos los números del 1 al 107', () => {
      for (let i = 1; i <= 107; i++) {
        expect(regex.test(String(i))).toBe(true)
      }
    })
  })

  describe('Posiciones con Prefijo E Válidas (E1 a E29)', () => {
    it('debe aceptar E1 a E29', () => {
      for (let i = 1; i <= 29; i++) {
        expect(regex.test(`E${i}`)).toBe(true)
      }
    })
  })

  describe('Posiciones con Prefijo F Válidas (F1 a F20)', () => {
    it('debe aceptar F1 a F20', () => {
      for (let i = 1; i <= 20; i++) {
        expect(regex.test(`F${i}`)).toBe(true)
      }
    })
  })

  describe('Posiciones Inválidas (deben ser rechazadas)', () => {
    it('debe rechazar números fuera de rango', () => {
      expect(regex.test('0')).toBe(false)
      expect(regex.test('01')).toBe(false)
      expect(regex.test('108')).toBe(false)
      expect(regex.test('109')).toBe(false)
      expect(regex.test('150')).toBe(false)
      expect(regex.test('200')).toBe(false)
      expect(regex.test('-1')).toBe(false)
    })

    it('debe rechazar prefijo E fuera de rango', () => {
      expect(regex.test('E0')).toBe(false)
      expect(regex.test('E30')).toBe(false)
      expect(regex.test('E31')).toBe(false)
      expect(regex.test('E100')).toBe(false)
    })

    it('debe rechazar prefijo F fuera de rango', () => {
      expect(regex.test('F0')).toBe(false)
      expect(regex.test('F21')).toBe(false)
      expect(regex.test('F25')).toBe(false)
      expect(regex.test('F100')).toBe(false)
    })

    it('debe rechazar otros prefijos o texto malformado', () => {
      expect(regex.test('A1')).toBe(false)
      expect(regex.test('B5')).toBe(false)
      expect(regex.test('C10')).toBe(false)
      expect(regex.test('D1')).toBe(false)
      expect(regex.test('107a')).toBe(false)
      expect(regex.test('posicion 1')).toBe(false)
      expect(regex.test('')).toBe(false)
      expect(regex.test(' ')).toBe(false)
      expect(regex.test('E1 ')).toBe(false)
      expect(regex.test(' E1')).toBe(false)
    })
  })
})
