import { act } from '@testing-library/react-native'
import { renderHook, waitFor } from '@testing-library/react-native'
import { useSesionStore, LIMITE_SESIONES_DETALLE } from '../src/store/sesion.store'

jest.mock('../src/db/repositories/sesion.repository', () => ({
  crearSesion: jest.fn(),
  agregarSerie: jest.fn(),
  obtenerSesionDetalle: jest.fn(),
  listarSesionesPorUsuario: jest.fn(),
}))

jest.mock('../src/db/repositories/rutina.repository', () => ({
  obtenerRutinaDetalle: jest.fn(),
}))

jest.mock('../src/db/client', () => ({
  obtenerBD: jest.fn(),
}))

import { crearSesion, agregarSerie, obtenerSesionDetalle, listarSesionesPorUsuario } from '../src/db/repositories/sesion.repository'
import { obtenerRutinaDetalle } from '../src/db/repositories/rutina.repository'
import { obtenerBD } from '../src/db/client'

describe('useSesionStore', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useSesionStore.setState({
      sesionActual: null,
      sesiones: [],
      sesionesDetalle: [],
      cargando: false,
      error: null,
    })
  })

  const mockRutinaDetalle = {
    id: 'r1',
    usuario_id: 'u1',
    nombre: 'Rutina',
    descripcion: '',
    activa: 0 as const,
    creado_en: '2024-01-01T00:00:00.000Z',
    actualizado_en: '2024-01-01T00:00:00.000Z',
    sincronizado: 0 as const,
    dias: [
      {
        id: 'd1',
        rutina_id: 'r1',
        nombre_dia: 'Dia 1',
        orden: 1,
        notas: null,
        ejercicios: [
          { id: 'eer1', dia_id: 'd1', ejercicio_id: 'ej1', orden: 1, series_objetivo: 3, reps_objetivo_min: 8, reps_objetivo_max: 12, peso_objetivo: null, descanso_segundos: 90, ejercicio_nombre: 'Press banca', grupo_muscular_primario: 'pecho' as const },
        ],
      },
    ],
  }

  const mockSesionBase = {
    id: 's1',
    usuario_id: 'u1',
    dia_rutina_id: 'd1',
    fecha: '2024-01-01',
    duracion_minutos: 60,
    notas: null,
    rpe_sesion: 8,
    creado_en: '2024-01-01T00:00:00.000Z',
    actualizado_en: '2024-01-01T00:00:00.000Z',
    sincronizado: 0 as const,
  }

  const mockSesionResumen = {
    ...mockSesionBase,
    rutina_nombre: 'Rutina',
    nombre_dia: 'Dia 1',
  }

  const mockSesionDetalle = {
    ...mockSesionResumen,
    registros: [
      {
        id: 'reg1',
        sesion_id: 's1',
        ejercicio_id: 'ej1',
        rpe_ejercicio: null,
        ejercicio_nombre: 'Press banca',
        series: [
          { id: 'se1', registro_id: 'reg1', numero_serie: 1, peso_levantado: 60, reps_realizadas: 10, rpe_serie: null, rir: null, completada: 1 as const, notas: null },
        ],
      },
    ],
  }

  describe('iniciarSesion', () => {
    it('éxito: crea sesión y setea sesionActual con registros', async () => {
      ;(obtenerBD as jest.Mock).mockResolvedValue({})
      ;(obtenerRutinaDetalle as jest.Mock).mockResolvedValue(mockRutinaDetalle)
      ;(crearSesion as jest.Mock).mockResolvedValue(undefined)

      const { result } = await renderHook(() => useSesionStore())

      await act(async () => {
        await result.current.iniciarSesion({ rutinaId: 'r1', diaRutinaId: 'd1', usuarioId: 'u1' })
      })

      await waitFor(() => expect(result.current.cargando).toBe(false))
      expect(result.current.sesionActual).not.toBeNull()
      expect(result.current.sesionActual?.registros).toHaveLength(1)
      expect(result.current.sesionActual?.rutina_nombre).toBe('Rutina')
      expect(result.current.sesionActual?.nombre_dia).toBe('Dia 1')
      expect(result.current.error).toBeNull()
    })

    it('error: rutina no encontrada -> error seteado, no throw', async () => {
      ;(obtenerBD as jest.Mock).mockResolvedValue({})
      ;(obtenerRutinaDetalle as jest.Mock).mockResolvedValue(null)

      const { result } = await renderHook(() => useSesionStore())

      await act(async () => {
        await result.current.iniciarSesion({ rutinaId: 'r1', diaRutinaId: 'd1', usuarioId: 'u1' })
      })

      await waitFor(() => expect(result.current.cargando).toBe(false))
      expect(result.current.sesionActual).toBeNull()
      expect(result.current.error).toBe('Rutina no encontrada: r1')
    })
  })

  describe('agregarSerie', () => {
    it('éxito: agrega serie a registro y llama repo', async () => {
      ;(obtenerBD as jest.Mock).mockResolvedValue({})
      ;(agregarSerie as jest.Mock).mockResolvedValue(undefined)

      const { result } = await renderHook(() => useSesionStore())
      useSesionStore.setState({
        sesionActual: {
          sesion: mockSesionBase,
          registros: [{ registro_id: 'reg1', ejercicio_id: 'ej1', ejercicio_nombre: 'Test', rpe_ejercicio: null, series: [] }],
          rutina_nombre: 'Rutina',
          nombre_dia: 'Dia 1',
        },
      })

      await act(async () => {
        await result.current.agregarSerie('reg1', {
          numero_serie: 1,
          peso_levantado: 60,
          reps_realizadas: 10,
          rpe_serie: null,
          rir: null,
          completada: 1,
          notas: null,
        })
      })

      await waitFor(() => expect(result.current.cargando).toBe(false))
      expect(result.current.sesionActual?.registros[0].series).toHaveLength(1)
      expect(agregarSerie).toHaveBeenCalled()
    })

    it('sin sesión activa: setea error', async () => {
      const { result } = await renderHook(() => useSesionStore())

      await act(async () => {
        await result.current.agregarSerie('reg1', {
          numero_serie: 1,
          peso_levantado: 60,
          reps_realizadas: 10,
          rpe_serie: null,
          rir: null,
          completada: 1,
          notas: null,
        })
      })

      expect(result.current.error).toBe('No hay sesión activa')
    })
  })

  describe('finalizarSesion', () => {
    it('éxito: actualiza BD y mueve a historial con nombres de rutina', async () => {
      ;(obtenerBD as jest.Mock).mockResolvedValue({ runAsync: jest.fn().mockResolvedValue(undefined) })

      const { result } = await renderHook(() => useSesionStore())
      useSesionStore.setState({
        sesionActual: {
          sesion: mockSesionBase,
          registros: [
            { registro_id: 'reg1', ejercicio_id: 'ej1', ejercicio_nombre: 'Press banca', rpe_ejercicio: null, series: [] },
          ],
          rutina_nombre: 'Rutina',
          nombre_dia: 'Dia 1',
        },
      })

      await act(async () => {
        await result.current.finalizarSesion({ duracion_minutos: 60, rpe_sesion: 8 })
      })

      await waitFor(() => expect(result.current.cargando).toBe(false))
      expect(result.current.sesionActual).toBeNull()
      expect(result.current.sesiones).toHaveLength(1)
      expect(result.current.sesiones[0].duracion_minutos).toBe(60)
      expect(result.current.sesiones[0].rutina_nombre).toBe('Rutina')
      expect(result.current.sesiones[0].nombre_dia).toBe('Dia 1')
      expect(result.current.sesionesDetalle).toHaveLength(1)
      expect(result.current.sesionesDetalle[0].registros[0].ejercicio_nombre).toBe('Press banca')
    })

    it('sin sesión activa: setea error', async () => {
      const { result } = await renderHook(() => useSesionStore())

      await act(async () => {
        await result.current.finalizarSesion()
      })

      expect(result.current.error).toBe('No hay sesión activa para finalizar')
    })
  })

  describe('cargarHistorial', () => {
    it('éxito: carga sesiones y el detalle de las últimas sesiones', async () => {
      const mockSesiones = [mockSesionResumen, { ...mockSesionResumen, id: 's2' }]
      ;(obtenerBD as jest.Mock).mockResolvedValue({})
      ;(listarSesionesPorUsuario as jest.Mock).mockResolvedValue(mockSesiones)
      ;(obtenerSesionDetalle as jest.Mock)
        .mockResolvedValueOnce(mockSesionDetalle)
        .mockResolvedValueOnce(null)

      const { result } = await renderHook(() => useSesionStore())

      await act(async () => {
        await result.current.cargarHistorial('u1')
      })

      await waitFor(() => expect(result.current.cargando).toBe(false))
      expect(result.current.sesiones).toEqual(mockSesiones)
      expect(obtenerSesionDetalle).toHaveBeenCalledTimes(2)
      expect(result.current.sesionesDetalle).toEqual([mockSesionDetalle])
    })

    it('no carga más detalles que el límite de sesiones recientes', async () => {
      const mockSesiones = Array.from({ length: LIMITE_SESIONES_DETALLE + 3 }, (_, i) => ({
        ...mockSesionResumen,
        id: `s${i}`,
      }))
      ;(obtenerBD as jest.Mock).mockResolvedValue({})
      ;(listarSesionesPorUsuario as jest.Mock).mockResolvedValue(mockSesiones)
      ;(obtenerSesionDetalle as jest.Mock).mockResolvedValue(mockSesionDetalle)

      const { result } = await renderHook(() => useSesionStore())

      await act(async () => {
        await result.current.cargarHistorial('u1')
      })

      await waitFor(() => expect(result.current.cargando).toBe(false))
      expect(obtenerSesionDetalle).toHaveBeenCalledTimes(LIMITE_SESIONES_DETALLE)
      expect(result.current.sesionesDetalle).toHaveLength(LIMITE_SESIONES_DETALLE)
    })

    it('error: repo rechaza -> error seteado, cargando false', async () => {
      ;(obtenerBD as jest.Mock).mockResolvedValue({})
      ;(listarSesionesPorUsuario as jest.Mock).mockRejectedValue(new Error('History error'))

      const { result } = await renderHook(() => useSesionStore())

      await act(async () => {
        await result.current.cargarHistorial('u1')
      })

      await waitFor(() => expect(result.current.cargando).toBe(false))
      expect(result.current.sesiones).toEqual([])
      expect(result.current.error).toBe('History error')
    })
  })

  describe('cancelarSesion', () => {
    it('limpia sesión actual y error', async () => {
      const { result } = await renderHook(() => useSesionStore())
      useSesionStore.setState({
        sesionActual: { sesion: mockSesionBase, registros: [], rutina_nombre: 'Rutina', nombre_dia: 'Dia 1' },
        error: 'algun error',
      })

      act(() => {
        result.current.cancelarSesion()
      })

      expect(result.current.sesionActual).toBeNull()
      expect(result.current.error).toBeNull()
    })
  })
})