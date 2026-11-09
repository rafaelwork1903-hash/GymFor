import { act } from '@testing-library/react-native'
import { renderHook, waitFor } from '@testing-library/react-native'
import { useSesionStore, LIMITE_SESIONES_DETALLE } from '../src/store/sesion.store'

jest.mock('../src/db/repositories/sesion.repository', () => ({
  crearSesion: jest.fn(),
  finalizarSesion: jest.fn(),
  agregarSerie: jest.fn(),
  actualizarSerie: jest.fn(),
  eliminarSerie: jest.fn(),
  eliminarSesion: jest.fn(),
  obtenerSesionAbierta: jest.fn(),
  obtenerSesionDetalle: jest.fn(),
  listarSesionesPorUsuario: jest.fn(),
}))

jest.mock('../src/db/repositories/rutina.repository', () => ({
  obtenerRutinaDetalle: jest.fn(),
}))

jest.mock('../src/db/client', () => ({
  obtenerBD: jest.fn(),
}))

import {
  crearSesion,
  finalizarSesion,
  agregarSerie,
  actualizarSerie,
  eliminarSerie,
  eliminarSesion,
  obtenerSesionAbierta,
  obtenerSesionDetalle,
  listarSesionesPorUsuario,
} from '../src/db/repositories/sesion.repository'
import { obtenerRutinaDetalle } from '../src/db/repositories/rutina.repository'
import { obtenerBD } from '../src/db/client'

describe('useSesionStore', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useSesionStore.setState({
      sesionActual: null,
      sesionAbierta: null,
      sesiones: [],
      sesionesDetalle: [],
      detallesCompletos: [],
      detallesPorId: {},
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
    finalizada: 0 as const,
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

    it('sin sesión activa: setea error y devuelve undefined', async () => {
      const { result } = await renderHook(() => useSesionStore())

      let devuelta: unknown = 'inicial'
      await act(async () => {
        devuelta = await result.current.agregarSerie('reg1', {
          numero_serie: 1,
          peso_levantado: 60,
          reps_realizadas: 10,
          rpe_serie: null,
          rir: null,
          completada: 1,
          notas: null,
        })
      })

      expect(devuelta).toBeUndefined()
      expect(result.current.error).toBe('No hay sesión activa')
    })

    it('devuelve la serie persistida cuando el repo tiene éxito', async () => {
      const seriePersistida = {
        id: 'serie-bd-1',
        registro_id: 'reg1',
        numero_serie: 1,
        peso_levantado: 80,
        reps_realizadas: 6,
        rpe_serie: 9,
        rir: null,
        completada: 1 as const,
        notas: null,
      }
      ;(obtenerBD as jest.Mock).mockResolvedValue({})
      ;(agregarSerie as jest.Mock).mockResolvedValue(seriePersistida)

      const { result } = await renderHook(() => useSesionStore())
      await act(async () => {
        useSesionStore.setState({
          sesionActual: {
            sesion: mockSesionBase,
            registros: [
              {
                registro_id: 'reg1',
                ejercicio_id: 'ej1',
                ejercicio_nombre: 'Press banca',
                rpe_ejercicio: null,
                series: [],
              },
            ],
            rutina_nombre: 'Rutina',
            nombre_dia: 'Dia 1',
          },
        })
      })

      let devuelta: unknown
      await act(async () => {
        devuelta = await result.current.agregarSerie('reg1', {
          numero_serie: 1,
          peso_levantado: 80,
          reps_realizadas: 6,
          rpe_serie: 9,
          rir: null,
          completada: 1,
          notas: null,
        })
      })

      await waitFor(() => expect(result.current.cargando).toBe(false))
      expect(devuelta).toEqual(seriePersistida)
      expect(result.current.sesionActual?.registros[0].series[0]).toEqual(seriePersistida)
    })

    it('devuelve undefined y conserva las series previas si el repo falla', async () => {
      ;(obtenerBD as jest.Mock).mockResolvedValue({})
      ;(agregarSerie as jest.Mock).mockRejectedValue(new Error('Fallo de escritura'))

      const { result } = await renderHook(() => useSesionStore())
      await act(async () => {
        useSesionStore.setState({
          sesionActual: {
            sesion: mockSesionBase,
            registros: [
              {
                registro_id: 'reg1',
                ejercicio_id: 'ej1',
                ejercicio_nombre: 'Press banca',
                rpe_ejercicio: null,
                series: [],
              },
            ],
            rutina_nombre: 'Rutina',
            nombre_dia: 'Dia 1',
          },
        })
      })

      let devuelta: unknown = 'inicial'
      await act(async () => {
        devuelta = await result.current.agregarSerie('reg1', {
          numero_serie: 1,
          peso_levantado: 80,
          reps_realizadas: 6,
          rpe_serie: 9,
          rir: null,
          completada: 1,
          notas: null,
        })
      })

      await waitFor(() => expect(result.current.cargando).toBe(false))
      expect(devuelta).toBeUndefined()
      expect(result.current.sesionActual?.registros[0].series).toHaveLength(0)
      expect(result.current.error).toBe('Fallo de escritura')
    })
  })

  describe('finalizarSesion', () => {
    it('éxito: actualiza BD vía repositorio y mueve a historial con nombres de rutina', async () => {
      ;(obtenerBD as jest.Mock).mockResolvedValue({})
      ;(finalizarSesion as jest.Mock).mockResolvedValue({
        actualizado_en: '2026-11-03T10:00:00.000Z',
      })

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
      expect(finalizarSesion).toHaveBeenCalledWith(expect.anything(), 's1', {
        duracion_minutos: 60,
        notas: null,
        rpe_sesion: 8,
      })
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

  describe('cargarDetallesCompletos', () => {
    it('éxito: carga sesiones y el detalle de las recientes, y cachea en detallesPorId', async () => {
      const mockSesiones = [mockSesionResumen, { ...mockSesionResumen, id: 's2' }]
      const mockDetalle2 = { ...mockSesionDetalle, id: 's2' }
      ;(obtenerBD as jest.Mock).mockResolvedValue({})
      ;(listarSesionesPorUsuario as jest.Mock).mockResolvedValue(mockSesiones)
      ;(obtenerSesionDetalle as jest.Mock)
        .mockResolvedValueOnce(mockSesionDetalle)
        .mockResolvedValueOnce(mockDetalle2)

      const { result } = await renderHook(() => useSesionStore())

      await act(async () => {
        await result.current.cargarDetallesCompletos('u1')
      })

      await waitFor(() => expect(result.current.cargando).toBe(false))
      expect(result.current.sesiones).toEqual(mockSesiones)
      expect(result.current.detallesCompletos).toEqual([mockSesionDetalle, mockDetalle2])
      expect(result.current.detallesPorId['s1']).toEqual(mockSesionDetalle)
      expect(result.current.detallesPorId['s2']).toEqual(mockDetalle2)
      expect(result.current.error).toBeNull()
    })

    it('respeta el límite de sesiones solicitado', async () => {
      const mockSesiones = Array.from({ length: 4 }, (_, i) => ({
        ...mockSesionResumen,
        id: `s${i}`,
      }))
      ;(obtenerBD as jest.Mock).mockResolvedValue({})
      ;(listarSesionesPorUsuario as jest.Mock).mockResolvedValue(mockSesiones)
      ;(obtenerSesionDetalle as jest.Mock).mockResolvedValue(mockSesionDetalle)

      const { result } = await renderHook(() => useSesionStore())

      await act(async () => {
        await result.current.cargarDetallesCompletos('u1', 2)
      })

      await waitFor(() => expect(result.current.cargando).toBe(false))
      expect(obtenerSesionDetalle).toHaveBeenCalledTimes(2)
      expect(result.current.detallesCompletos).toHaveLength(2)
    })

    it('cache: las sesiones ya en sesionesDetalle o detallesPorId no vuelven a la BD', async () => {
      ;(obtenerBD as jest.Mock).mockResolvedValue({})
      ;(listarSesionesPorUsuario as jest.Mock).mockResolvedValue([
        mockSesionResumen,
        { ...mockSesionResumen, id: 's2' },
      ])
      ;(obtenerSesionDetalle as jest.Mock).mockResolvedValue({ ...mockSesionDetalle, id: 's2' })
      useSesionStore.setState({ sesionesDetalle: [mockSesionDetalle] })

      const { result } = await renderHook(() => useSesionStore())

      await act(async () => {
        await result.current.cargarDetallesCompletos('u1')
      })

      await waitFor(() => expect(result.current.cargando).toBe(false))
      // Solo la sesión 's2' (sin cache) fue a la BD.
      expect(obtenerSesionDetalle).toHaveBeenCalledTimes(1)
      expect(obtenerSesionDetalle).toHaveBeenCalledWith({}, 's2')
      expect(result.current.detallesCompletos).toHaveLength(2)
    })

    it('error: repo rechaza -> error seteado, sin detalles', async () => {
      ;(obtenerBD as jest.Mock).mockResolvedValue({})
      ;(listarSesionesPorUsuario as jest.Mock).mockRejectedValue(new Error('detalle down'))

      const { result } = await renderHook(() => useSesionStore())

      await act(async () => {
        await result.current.cargarDetallesCompletos('u1')
      })

      await waitFor(() => expect(result.current.cargando).toBe(false))
      expect(result.current.detallesCompletos).toEqual([])
      expect(result.current.error).toBe('detalle down')
    })
  })

  describe('cargarSesionAbierta', () => {
    it('éxito: obtiene la sesión abierta del repositorio y la asigna a sesionAbierta', async () => {
      ;(obtenerBD as jest.Mock).mockResolvedValue({})
      ;(obtenerSesionAbierta as jest.Mock).mockResolvedValue(mockSesionResumen)

      const { result } = await renderHook(() => useSesionStore())

      await act(async () => {
        await result.current.cargarSesionAbierta('u1')
      })

      await waitFor(() => expect(result.current.cargando).toBe(false))
      expect(obtenerSesionAbierta).toHaveBeenCalledWith({}, 'u1')
      expect(result.current.sesionAbierta).toEqual(mockSesionResumen)
      expect(result.current.error).toBeNull()
    })

    it('sin sesión abierta: deja sesionAbierta en null', async () => {
      ;(obtenerBD as jest.Mock).mockResolvedValue({})
      ;(obtenerSesionAbierta as jest.Mock).mockResolvedValue(null)
      useSesionStore.setState({ sesionAbierta: mockSesionResumen })

      const { result } = await renderHook(() => useSesionStore())

      await act(async () => {
        await result.current.cargarSesionAbierta('u1')
      })

      await waitFor(() => expect(result.current.cargando).toBe(false))
      expect(result.current.sesionAbierta).toBeNull()
    })
  })

  describe('reanudarSesion', () => {
    it('éxito: reconstruye sesionActual con nombres de sesionAbierta y series reales, limpia sesionAbierta y devuelve true', async () => {
      ;(obtenerBD as jest.Mock).mockResolvedValue({})
      ;(obtenerSesionDetalle as jest.Mock).mockResolvedValue({
        ...mockSesionBase,
        registros: mockSesionDetalle.registros,
      })
      useSesionStore.setState({
        sesionAbierta: {
          ...mockSesionResumen,
          rutina_nombre: 'Rutina Recuperada',
          nombre_dia: 'Empuje Pesado',
        },
      })

      const { result } = await renderHook(() => useSesionStore())

      let exito = false
      await act(async () => {
        exito = await result.current.reanudarSesion('s1')
      })

      await waitFor(() => expect(result.current.cargando).toBe(false))
      expect(exito).toBe(true)
      expect(result.current.sesionAbierta).toBeNull()
      expect(result.current.sesionActual).not.toBeNull()
      expect(result.current.sesionActual?.rutina_nombre).toBe('Rutina Recuperada')
      expect(result.current.sesionActual?.nombre_dia).toBe('Empuje Pesado')
      expect(result.current.sesionActual?.registros).toEqual([
        {
          registro_id: 'reg1',
          ejercicio_id: 'ej1',
          ejercicio_nombre: 'Press banca',
          rpe_ejercicio: null,
          series: mockSesionDetalle.registros[0].series,
        },
      ])
    })

    it('no reutiliza los nombres de sesionAbierta si su id no coincide con la sesión reanudada', async () => {
      ;(obtenerBD as jest.Mock).mockResolvedValue({})
      ;(obtenerSesionDetalle as jest.Mock).mockResolvedValue({
        ...mockSesionBase,
        id: 's-otra',
        registros: mockSesionDetalle.registros,
      })
      useSesionStore.setState({
        sesionAbierta: {
          ...mockSesionResumen,
          id: 's1',
          rutina_nombre: 'Rutina de Otra Sesión',
          nombre_dia: 'Día de Otra Sesión',
        },
      })

      const { result } = await renderHook(() => useSesionStore())

      let exito = false
      await act(async () => {
        exito = await result.current.reanudarSesion('s-otra')
      })

      await waitFor(() => expect(result.current.cargando).toBe(false))
      expect(exito).toBe(true)
      expect(result.current.sesionActual?.sesion.id).toBe('s-otra')
      expect(result.current.sesionActual?.rutina_nombre).toBe('Rutina')
      expect(result.current.sesionActual?.nombre_dia).toBe('Día')
    })

    it('devuelve false y limpia sesionAbierta si la sesión no existe en BD', async () => {
      ;(obtenerBD as jest.Mock).mockResolvedValue({})
      ;(obtenerSesionDetalle as jest.Mock).mockResolvedValue(null)
      useSesionStore.setState({ sesionAbierta: mockSesionResumen })

      const { result } = await renderHook(() => useSesionStore())

      let exito = true
      await act(async () => {
        exito = await result.current.reanudarSesion('s-inexistente')
      })

      await waitFor(() => expect(result.current.cargando).toBe(false))
      expect(exito).toBe(false)
      expect(result.current.sesionActual).toBeNull()
      expect(result.current.sesionAbierta).toBeNull()
    })
  })

  describe('cancelarSesion', () => {
    it('elimina la sesión en BD antes de limpiar sesionActual y sesionAbierta (no deja fila huérfana)', async () => {
      ;(obtenerBD as jest.Mock).mockResolvedValue({})
      ;(eliminarSesion as jest.Mock).mockResolvedValue(undefined)
      useSesionStore.setState({
        sesionActual: { sesion: mockSesionBase, registros: [], rutina_nombre: 'Rutina', nombre_dia: 'Dia 1' },
        sesionAbierta: mockSesionResumen,
        error: 'algun error',
      })

      const { result } = await renderHook(() => useSesionStore())

      await act(async () => {
        await result.current.cancelarSesion()
      })

      await waitFor(() => expect(result.current.cargando).toBe(false))
      expect(eliminarSesion).toHaveBeenCalledWith({}, 's1')
      expect(result.current.sesionActual).toBeNull()
      expect(result.current.sesionAbierta).toBeNull()
      expect(result.current.error).toBeNull()
    })

    it('elimina sesionAbierta en BD cuando se descarta desde el banner sin sesionActual', async () => {
      ;(obtenerBD as jest.Mock).mockResolvedValue({})
      ;(eliminarSesion as jest.Mock).mockResolvedValue(undefined)
      useSesionStore.setState({
        sesionActual: null,
        sesionAbierta: mockSesionResumen,
      })

      const { result } = await renderHook(() => useSesionStore())

      await act(async () => {
        await result.current.cancelarSesion()
      })

      await waitFor(() => expect(result.current.cargando).toBe(false))
      expect(eliminarSesion).toHaveBeenCalledWith({}, 's1')
      expect(result.current.sesionAbierta).toBeNull()
      expect(result.current.error).toBeNull()
    })
  })

  describe('descartarSesion', () => {
    it('éxito: elimina la sesión en BD (con CASCADE) y limpia sesionActual', async () => {
      ;(obtenerBD as jest.Mock).mockResolvedValue({})
      ;(eliminarSesion as jest.Mock).mockResolvedValue(undefined)

      const { result } = await renderHook(() => useSesionStore())
      useSesionStore.setState({
        sesionActual: {
          sesion: mockSesionBase,
          registros: [],
          rutina_nombre: 'Rutina',
          nombre_dia: 'Dia 1',
        },
      })

      await act(async () => {
        await result.current.descartarSesion()
      })

      await waitFor(() => expect(result.current.cargando).toBe(false))
      expect(eliminarSesion).toHaveBeenCalledWith({}, 's1')
      expect(result.current.sesionActual).toBeNull()
      expect(result.current.error).toBeNull()
    })

    it('sin sesión activa: setea error sin tocar la BD', async () => {
      const { result } = await renderHook(() => useSesionStore())

      await act(async () => {
        await result.current.descartarSesion()
      })

      expect(result.current.error).toBe('No hay sesión activa para descartar')
      expect(eliminarSesion).not.toHaveBeenCalled()
    })

    it('error: el repo rechaza -> la sesión sigue en curso y el error queda visible', async () => {
      ;(obtenerBD as jest.Mock).mockResolvedValue({})
      ;(eliminarSesion as jest.Mock).mockRejectedValue(new Error('DB locked'))

      const { result } = await renderHook(() => useSesionStore())
      useSesionStore.setState({
        sesionActual: {
          sesion: mockSesionBase,
          registros: [],
          rutina_nombre: 'Rutina',
          nombre_dia: 'Dia 1',
        },
      })

      await act(async () => {
        await result.current.descartarSesion()
      })

      await waitFor(() => expect(result.current.cargando).toBe(false))
      expect(result.current.sesionActual).not.toBeNull()
      expect(result.current.error).toBe('DB locked')
    })
  })

  describe('cargarDetalleSesion', () => {
    it('éxito: guarda el detalle en detallesPorId tras ir a BD', async () => {
      ;(obtenerBD as jest.Mock).mockResolvedValue({})
      ;(obtenerSesionDetalle as jest.Mock).mockResolvedValue(mockSesionDetalle)

      const { result } = await renderHook(() => useSesionStore())

      await act(async () => {
        await result.current.cargarDetalleSesion('s1')
      })

      await waitFor(() => expect(result.current.cargando).toBe(false))
      expect(obtenerSesionDetalle).toHaveBeenCalledTimes(1)
      expect(result.current.detallesPorId['s1']).toEqual(mockSesionDetalle)
      expect(result.current.error).toBeNull()
    })

    it('cache: si el detalle ya está cargado no vuelve a la BD', async () => {
      const { result } = await renderHook(() => useSesionStore())
      useSesionStore.setState({
        sesionesDetalle: [mockSesionDetalle],
      })

      await act(async () => {
        await result.current.cargarDetalleSesion('s1')
      })

      expect(obtenerSesionDetalle).not.toHaveBeenCalled()
      expect(result.current.error).toBeNull()
    })

    it('error: repo rechaza -> error seteado, sin detalle cargado', async () => {
      ;(obtenerBD as jest.Mock).mockResolvedValue({})
      ;(obtenerSesionDetalle as jest.Mock).mockRejectedValue(new Error('detalle down'))

      const { result } = await renderHook(() => useSesionStore())

      await act(async () => {
        await result.current.cargarDetalleSesion('s1')
      })

      await waitFor(() => expect(result.current.cargando).toBe(false))
      expect(result.current.detallesPorId['s1']).toBeUndefined()
      expect(result.current.error).toBe('detalle down')
    })

    it('sesión inexistente en BD: mapea el error del repositorio', async () => {
      ;(obtenerBD as jest.Mock).mockResolvedValue({})
      ;(obtenerSesionDetalle as jest.Mock).mockResolvedValue(null)

      const { result } = await renderHook(() => useSesionStore())

      await act(async () => {
        await result.current.cargarDetalleSesion('s-desconocida')
      })

      await waitFor(() => expect(result.current.cargando).toBe(false))
      expect(result.current.error).toBe('Sesión no encontrada: s-desconocida')
      expect(result.current.detallesPorId['s-desconocida']).toBeUndefined()
    })
  })

  describe('actualizarSerie', () => {
    const serie1 = {
      id: 'se-1',
      registro_id: 'reg1',
      numero_serie: 1,
      peso_levantado: 60,
      reps_realizadas: 10,
      rpe_serie: 8,
      rir: null,
      completada: 1 as const,
      notas: null,
    }
    const serie2 = {
      id: 'se-2',
      registro_id: 'reg1',
      numero_serie: 2,
      peso_levantado: 62.5,
      reps_realizadas: 8,
      rpe_serie: 9,
      rir: null,
      completada: 1 as const,
      notas: null,
    }

    it('éxito: persiste en BD y refleja el cambio sin mutar otras series ni registros', async () => {
      const serie1Actualizada = {
        ...serie1,
        peso_levantado: 65,
        reps_realizadas: 9,
        rpe_serie: 8.5,
        notas: 'buena velocidad',
      }
      ;(obtenerBD as jest.Mock).mockResolvedValue({})
      ;(actualizarSerie as jest.Mock).mockResolvedValue(serie1Actualizada)

      const { result } = await renderHook(() => useSesionStore())
      await act(async () => {
        useSesionStore.setState({
          sesionActual: {
            sesion: mockSesionBase,
            registros: [
              {
                registro_id: 'reg1',
                ejercicio_id: 'ej1',
                ejercicio_nombre: 'Press banca',
                rpe_ejercicio: null,
                series: [serie1, serie2],
              },
              {
                registro_id: 'reg2',
                ejercicio_id: 'ej2',
                ejercicio_nombre: 'Remo',
                rpe_ejercicio: null,
                series: [
                  {
                    ...serie1,
                    id: 'se-otro',
                    registro_id: 'reg2',
                  },
                ],
              },
            ],
            rutina_nombre: 'Rutina',
            nombre_dia: 'Dia 1',
          },
        })
      })

      await act(async () => {
        await result.current.actualizarSerie('reg1', 'se-1', {
          peso_levantado: 65,
          reps_realizadas: 9,
          rpe_serie: 8.5,
          notas: 'buena velocidad',
        })
      })

      await waitFor(() => expect(result.current.cargando).toBe(false))
      expect(actualizarSerie).toHaveBeenCalledWith({}, 'se-1', {
        peso_levantado: 65,
        reps_realizadas: 9,
        rpe_serie: 8.5,
        notas: 'buena velocidad',
      })
      expect(result.current.error).toBeNull()
      expect(result.current.sesionActual?.registros[0].series[0]).toEqual(serie1Actualizada)
      // La segunda serie y el otro registro permanecen intactos
      expect(result.current.sesionActual?.registros[0].series[1]).toEqual(serie2)
      expect(result.current.sesionActual?.registros[1].series[0].peso_levantado).toBe(60)
    })

    it('error: si el repo falla conserva el estado intacto y expone el error', async () => {
      ;(obtenerBD as jest.Mock).mockResolvedValue({})
      ;(actualizarSerie as jest.Mock).mockRejectedValue(new Error('SQLite busy'))

      const { result } = await renderHook(() => useSesionStore())
      await act(async () => {
        useSesionStore.setState({
          sesionActual: {
            sesion: mockSesionBase,
            registros: [
              {
                registro_id: 'reg1',
                ejercicio_id: 'ej1',
                ejercicio_nombre: 'Press banca',
                rpe_ejercicio: null,
                series: [serie1, serie2],
              },
            ],
            rutina_nombre: 'Rutina',
            nombre_dia: 'Dia 1',
          },
        })
      })

      await act(async () => {
        await result.current.actualizarSerie('reg1', 'se-1', { peso_levantado: 100 })
      })

      await waitFor(() => expect(result.current.cargando).toBe(false))
      expect(result.current.error).toBe('SQLite busy')
      expect(result.current.sesionActual?.registros[0].series).toEqual([serie1, serie2])
    })

    it('sin sesión activa: setea error sin tocar la BD', async () => {
      const { result } = await renderHook(() => useSesionStore())

      await act(async () => {
        await result.current.actualizarSerie('reg1', 'se-1', { peso_levantado: 70 })
      })

      expect(result.current.error).toBe('No hay sesión activa')
      expect(actualizarSerie).not.toHaveBeenCalled()
    })
  })

  describe('eliminarSerie', () => {
    const seriesBase = [
      {
        id: 'se-1',
        registro_id: 'reg1',
        numero_serie: 1,
        peso_levantado: 60,
        reps_realizadas: 10,
        rpe_serie: 7,
        rir: null,
        completada: 1 as const,
        notas: null,
      },
      {
        id: 'se-2',
        registro_id: 'reg1',
        numero_serie: 2,
        peso_levantado: 65,
        reps_realizadas: 8,
        rpe_serie: 8,
        rir: null,
        completada: 1 as const,
        notas: null,
      },
      {
        id: 'se-3',
        registro_id: 'reg1',
        numero_serie: 3,
        peso_levantado: 70,
        reps_realizadas: 6,
        rpe_serie: 9,
        rir: null,
        completada: 1 as const,
        notas: 'última',
      },
    ]

    it('éxito: persiste borrado, filtra la serie y renumera las restantes 1..N', async () => {
      ;(obtenerBD as jest.Mock).mockResolvedValue({})
      ;(eliminarSerie as jest.Mock).mockResolvedValue(undefined)

      const { result } = await renderHook(() => useSesionStore())
      await act(async () => {
        useSesionStore.setState({
          sesionActual: {
            sesion: mockSesionBase,
            registros: [
              {
                registro_id: 'reg1',
                ejercicio_id: 'ej1',
                ejercicio_nombre: 'Press banca',
                rpe_ejercicio: null,
                series: seriesBase,
              },
            ],
            rutina_nombre: 'Rutina',
            nombre_dia: 'Dia 1',
          },
        })
      })

      await act(async () => {
        await result.current.eliminarSerie('reg1', 'se-2')
      })

      await waitFor(() => expect(result.current.cargando).toBe(false))
      expect(eliminarSerie).toHaveBeenCalledWith({}, 'se-2')
      expect(result.current.error).toBeNull()
      const restantes = result.current.sesionActual?.registros[0].series ?? []
      expect(restantes).toHaveLength(2)
      expect(restantes.map((s) => ({ id: s.id, numero_serie: s.numero_serie }))).toEqual([
        { id: 'se-1', numero_serie: 1 },
        { id: 'se-3', numero_serie: 2 },
      ])
    })

    it('error: si el repo falla conserva las series intactas y setea error', async () => {
      ;(obtenerBD as jest.Mock).mockResolvedValue({})
      ;(eliminarSerie as jest.Mock).mockRejectedValue(new Error('FK error'))

      const { result } = await renderHook(() => useSesionStore())
      await act(async () => {
        useSesionStore.setState({
          sesionActual: {
            sesion: mockSesionBase,
            registros: [
              {
                registro_id: 'reg1',
                ejercicio_id: 'ej1',
                ejercicio_nombre: 'Press banca',
                rpe_ejercicio: null,
                series: seriesBase,
              },
            ],
            rutina_nombre: 'Rutina',
            nombre_dia: 'Dia 1',
          },
        })
      })

      await act(async () => {
        await result.current.eliminarSerie('reg1', 'se-2')
      })

      await waitFor(() => expect(result.current.cargando).toBe(false))
      expect(result.current.error).toBe('FK error')
      expect(result.current.sesionActual?.registros[0].series).toEqual(seriesBase)
    })

    it('sin sesión activa: setea error sin tocar la BD', async () => {
      const { result } = await renderHook(() => useSesionStore())

      await act(async () => {
        await result.current.eliminarSerie('reg1', 'se-2')
      })

      expect(result.current.error).toBe('No hay sesión activa')
      expect(eliminarSerie).not.toHaveBeenCalled()
    })
  })
})