import {
  obtenerHistorialEjercicio,
  calcularProgresoEjercicio,
  calcularSeriesEfectivasSemanales,
  calcularVolumenPorEjercicio,
  calcularVolumenTotalSesiones,
  calcularMejor1RMSesiones,
} from '../src/store/selectores'
import type { SesionDetalle, Ejercicio, SerieReal, RegistroEjercicioDetalle } from '../src/domain/types'

describe('selectores', () => {
  const mockSerie = (peso: number, reps: number, completada = 1): SerieReal => ({
    id: 's1',
    registro_id: 'r1',
    numero_serie: 1,
    peso_levantado: peso,
    reps_realizadas: reps,
    rpe_serie: 8,
    rir: null,
    completada: completada as 0 | 1,
    notas: null,
  })

  const mockRegistro = (ejercicioId: string, series: SerieReal[]): RegistroEjercicioDetalle => ({
    id: 'reg1',
    sesion_id: 's1',
    ejercicio_id: ejercicioId,
    rpe_ejercicio: 8,
    ejercicio_nombre: 'Test',
    series,
  })

  const mockSesion = (fecha: string, registros: ReturnType<typeof mockRegistro>[]): SesionDetalle => ({
    id: 's1',
    usuario_id: 'u1',
    dia_rutina_id: 'd1',
    fecha,
    duracion_minutos: 60,
    notas: null,
    rpe_sesion: 8,
    creado_en: '2024-01-01T00:00:00.000Z',
    actualizado_en: '2024-01-01T00:00:00.000Z',
    sincronizado: 0 as const,
    registros,
  })

  const mockEjercicio: Ejercicio = {
    id: 'ej:press_banca',
    nombre: 'Press banca',
    grupo_muscular_primario: 'pecho',
    grupos_musculares_secundarios: ['hombros', 'triceps'],
    equipamiento: 'mancuernas',
    es_compuesto: 1 as const,
    factor_fraccional: 1.0,
    instrucciones: null,
    video_url: null,
  }

  describe('obtenerHistorialEjercicio', () => {
    it('devuelve historial ordenado cronológicamente solo con series completadas', () => {
      const sesiones = [
        mockSesion('2024-01-03', [mockRegistro('ej1', [mockSerie(60, 10)])]),
        mockSesion('2024-01-01', [mockRegistro('ej1', [mockSerie(50, 8)])]),
        mockSesion('2024-01-02', [mockRegistro('ej1', [mockSerie(55, 9, 0)])]),
      ]
      const historial = obtenerHistorialEjercicio(sesiones, 'ej1')
      expect(historial).toHaveLength(2)
      expect(historial[0].series[0].peso_levantado).toBe(50)
      expect(historial[1].series[0].peso_levantado).toBe(60)
    })

    it('devuelve array vacío si no hay series completadas', () => {
      const sesiones = [mockSesion('2024-01-01', [mockRegistro('ej1', [mockSerie(50, 8, 0)])])]
      expect(obtenerHistorialEjercicio(sesiones, 'ej1')).toHaveLength(0)
    })
  })

  describe('calcularProgresoEjercicio', () => {
    it('calcula progreso completo con historial', () => {
      const sesiones = [
        mockSesion('2024-01-01', [mockRegistro('ej:press_banca', [mockSerie(60, 10)])]),
        // Última sesión al tope de reps (12) con RPE 8: dispara "subir_peso".
        mockSesion('2024-01-08', [mockRegistro('ej:press_banca', [mockSerie(62.5, 12)])]),
      ]
      const progreso = calcularProgresoEjercicio(sesiones, mockEjercicio, 8, 12, 62.5)

      expect(progreso.ejercicioId).toBe('ej:press_banca')
      expect(progreso.historial).toHaveLength(2)
      expect(progreso.mejor1RM).toBeGreaterThan(0)
      expect(progreso.tendencia).toBe('subiendo')
      expect(progreso.sugerencia).not.toBeNull()
      expect(progreso.sugerencia?.accion).toBe('subir_peso')
    })

    it('sin historial devuelve valores base', () => {
      const progreso = calcularProgresoEjercicio([], mockEjercicio, 8, 12, 60)
      expect(progreso.historial).toHaveLength(0)
      expect(progreso.mejor1RM).toBe(0)
      expect(progreso.volumenUltimaSesion).toBe(0)
      expect(progreso.tendencia).toBe('estancado')
      expect(progreso.estancado).toBe(false)
      expect(progreso.sugerencia).toBeNull()
    })
  })

  describe('calcularSeriesEfectivasSemanales', () => {
    it('suma series directas e indirectas por grupo', () => {
      const sesiones = [
        mockSesion('2024-01-01', [
          mockRegistro('ej1', [mockSerie(60, 10), mockSerie(60, 10)]),
        ]),
      ]
      const ejercicios = new Map([['ej1', mockEjercicio]])
      const series = calcularSeriesEfectivasSemanales(sesiones, ejercicios)

      expect(series.pecho).toBe(2)
      expect(series.hombros).toBe(1)
      expect(series.triceps).toBe(1)
    })

    it('ignora series no completadas', () => {
      const sesiones = [
        mockSesion('2024-01-01', [
          mockRegistro('ej1', [mockSerie(60, 10, 0), mockSerie(60, 10, 1)]),
        ]),
      ]
      const ejercicios = new Map([['ej1', mockEjercicio]])
      const series = calcularSeriesEfectivasSemanales(sesiones, ejercicios)
      expect(series.pecho).toBe(1)
    })
  })

  describe('calcularVolumenPorEjercicio', () => {
    it('suma volumen por ejercicio', () => {
      const sesiones = [
        mockSesion('2024-01-01', [
          mockRegistro('ej1', [mockSerie(60, 10)]),
          mockRegistro('ej2', [mockSerie(100, 5)]),
        ]),
        mockSesion('2024-01-08', [
          mockRegistro('ej1', [mockSerie(62.5, 10)]),
        ]),
      ]
      const volumen = calcularVolumenPorEjercicio(sesiones)
      expect(volumen.get('ej1')).toBe(1225)
      expect(volumen.get('ej2')).toBe(500)
    })
  })

  describe('calcularVolumenTotalSesiones', () => {
    it('suma el volumen de todas las sesiones ignorando series no completadas', () => {
      const sesiones = [
        mockSesion('2024-01-01', [
          mockRegistro('ej1', [mockSerie(60, 10), mockSerie(60, 10, 0)]),
          mockRegistro('ej2', [mockSerie(100, 5)]),
        ]),
        mockSesion('2024-01-08', [mockRegistro('ej1', [mockSerie(62.5, 10)])]),
      ]
      // 60×10 + 100×5 + 62.5×10 = 600 + 500 + 625
      expect(calcularVolumenTotalSesiones(sesiones)).toBe(1725)
    })

    it('devuelve 0 sin sesiones', () => {
      expect(calcularVolumenTotalSesiones([])).toBe(0)
    })
  })

  describe('calcularMejor1RMSesiones', () => {
    it('devuelve el mejor 1RM (Epley) entre todas las series completadas', () => {
      const sesiones = [
        mockSesion('2024-01-01', [mockRegistro('ej1', [mockSerie(60, 10)])]),
        mockSesion('2024-01-08', [mockRegistro('ej2', [mockSerie(100, 3)])]),
      ]
      // 60×(1+0.0333×10) = 79.98 ; 100×(1+0.0333×3) = 109.99
      expect(calcularMejor1RMSesiones(sesiones)).toBeCloseTo(109.99, 2)
    })

    it('ignora series no completadas y devuelve 0 si no hay ninguna', () => {
      const sesiones = [mockSesion('2024-01-01', [mockRegistro('ej1', [mockSerie(60, 10, 0)])])]
      expect(calcularMejor1RMSesiones(sesiones)).toBe(0)
      expect(calcularMejor1RMSesiones([])).toBe(0)
    })
  })
})