import { describe, it, expect } from 'vitest'
import { diaHoy, hora12, precioTexto, ahoraEnFranja, FRANJAS } from '../src/lib/utils'

describe('Utilidades de Turnos y Franjas Horarias (src/lib/utils.js)', () => {
  describe('diaHoy(date)', () => {
    it('debe mapear correctamente los días de la semana (1=Lunes ... 7=Domingo)', () => {
      // 2026-10-19 es Lunes
      expect(diaHoy(new Date(2026, 9, 19))).toBe(1)
      // 2026-10-20 es Martes
      expect(diaHoy(new Date(2026, 9, 20))).toBe(2)
      // 2026-10-21 es Miércoles
      expect(diaHoy(new Date(2026, 9, 21))).toBe(3)
      // 2026-10-22 es Jueves
      expect(diaHoy(new Date(2026, 9, 22))).toBe(4)
      // 2026-10-23 es Viernes
      expect(diaHoy(new Date(2026, 9, 23))).toBe(5)
      // 2026-10-24 es Sábado
      expect(diaHoy(new Date(2026, 9, 24))).toBe(6)
      // 2026-10-25 es Domingo
      expect(diaHoy(new Date(2026, 9, 25))).toBe(7)
    })
  })

  describe('hora12(t)', () => {
    it('debe convertir horas estándar a formato de 12 horas con am/pm', () => {
      expect(hora12('00:00')).toBe('12:00 am')
      expect(hora12('04:00')).toBe('4:00 am')
      expect(hora12('08:30')).toBe('8:30 am')
      expect(hora12('12:00')).toBe('12:00 pm')
      expect(hora12('13:15')).toBe('1:15 pm')
      expect(hora12('20:00')).toBe('8:00 pm')
      expect(hora12('23:59')).toBe('11:59 pm')
    })

    it('debe manejar horas de turno nocturno extendidas (> 24h)', () => {
      expect(hora12('24:00')).toBe('12:00 am')
      expect(hora12('26:00')).toBe('2:00 am')
      expect(hora12('28:00')).toBe('4:00 am')
    })
  })

  describe('precioTexto(p)', () => {
    it('debe dar formato de moneda es-CO con signo pesos y separadores de miles', () => {
      expect(precioTexto(0)).toBe('$0')
      expect(precioTexto(5000)).toBe('$5.000')
      expect(precioTexto(25000)).toBe('$25.000')
      expect(precioTexto(1200000)).toBe('$1.200.000')
      expect(precioTexto(1500.4)).toBe('$1.500')
      expect(precioTexto(1500.6)).toBe('$1.501')
    })
  })

  describe('ahoraEnFranja(turnos, dia, fecha)', () => {
    it('detecta correctamente un turno diurno dentro del horario', () => {
      const turnos = [{ id: 1, dia_semana: 1, hora_inicio: '08:00', hora_fin: '16:00' }]
      // Lunes a las 10:00 am
      const fecha = new Date(2026, 9, 19, 10, 0)
      expect(ahoraEnFranja(turnos, 1, fecha)).toEqual(turnos[0])
    })

    it('rechaza un turno diurno antes de la hora de inicio o después de la hora de fin', () => {
      const turnos = [{ id: 1, dia_semana: 1, hora_inicio: '08:00', hora_fin: '16:00' }]
      // Lunes a las 7:59 am
      expect(ahoraEnFranja(turnos, 1, new Date(2026, 9, 19, 7, 59))).toBeNull()
      // Lunes a las 16:00 (límite superior exclusivo)
      expect(ahoraEnFranja(turnos, 1, new Date(2026, 9, 19, 16, 0))).toBeNull()
    })

    it('detecta turno nocturno que cruza medianoche en el mismo día (antes de las 24:00)', () => {
      const turnoNoche = { id: 2, dia_semana: 1, hora_inicio: '20:00', hora_fin: '04:00' }
      // Lunes a las 21:30
      const fecha = new Date(2026, 9, 19, 21, 30)
      expect(ahoraEnFranja([turnoNoche], 1, fecha)).toEqual(turnoNoche)
    })

    it('detecta turno nocturno que cruza medianoche al día siguiente (después de medianoche)', () => {
      // Turno registrado para el Lunes (día 1) de 20:00 a 04:00
      const turnoNoche = { id: 2, dia_semana: 1, hora_inicio: '20:00', hora_fin: '04:00' }
      // Martes (día 2) a las 02:15 am
      const fechaMartes = new Date(2026, 9, 20, 2, 15)
      expect(ahoraEnFranja([turnoNoche], 2, fechaMartes)).toEqual(turnoNoche)
    })

    it('termina el turno nocturno exactamente a la hora límite (04:00 am)', () => {
      const turnoNoche = { id: 2, dia_semana: 1, hora_inicio: '20:00', hora_fin: '04:00' }
      // Martes (día 2) a las 04:00 am
      expect(ahoraEnFranja([turnoNoche], 2, new Date(2026, 9, 20, 4, 0))).toBeNull()
      // Martes (día 2) a las 04:01 am
      expect(ahoraEnFranja([turnoNoche], 2, new Date(2026, 9, 20, 4, 1))).toBeNull()
    })

    it('maneja el cruce de semana de Domingo a Lunes en turno nocturno', () => {
      // Domingo = día 7
      const turnoDomingoNoche = { id: 7, dia_semana: 7, hora_inicio: '20:00', hora_fin: '04:00' }
      // Lunes (día 1) a las 01:30 am
      const fechaLunesMadrugada = new Date(2026, 9, 26, 1, 30)
      expect(ahoraEnFranja([turnoDomingoNoche], 1, fechaLunesMadrugada)).toEqual(turnoDomingoNoche)
    })

    it('soporta franjas generales de FRANJAS sin día de la semana explícito', () => {
      const noche = FRANJAS.find((f) => f.clave === 'noche')
      expect(noche).toBeDefined()
      // A las 22:00
      expect(ahoraEnFranja([noche], 1, new Date(2026, 9, 19, 22, 0))).toEqual(noche)
      // A las 03:00 am
      expect(ahoraEnFranja([noche], 2, new Date(2026, 9, 20, 3, 0))).toEqual(noche)
      // A las 05:00 am (fuera)
      expect(ahoraEnFranja([noche], 2, new Date(2026, 9, 20, 5, 0))).toBeNull()
    })
  })
})
