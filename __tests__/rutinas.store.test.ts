import { act } from '@testing-library/react-native'
import { renderHook, waitFor } from '@testing-library/react-native'
import { useRutinasStore } from '../src/store/rutinas.store'

jest.mock('../src/db/repositories/rutina.repository', () => ({
  listarRutinas: jest.fn(),
  obtenerRutinaDetalle: jest.fn(),
  crearRutina: jest.fn(),
  actualizarRutina: jest.fn(),
  activarRutina: jest.fn(),
  eliminarRutina: jest.fn(),
}))

jest.mock('../src/db/client', () => ({
  obtenerBD: jest.fn(),
}))

import {
  listarRutinas,
  obtenerRutinaDetalle,
  crearRutina,
  actualizarRutina,
  activarRutina,
  eliminarRutina,
} from '../src/db/repositories/rutina.repository'
import { obtenerBD } from '../src/db/client'

describe('useRutinasStore', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useRutinasStore.setState({
      rutinas: [],
      rutinaSeleccionada: null,
      cargando: false,
      error: null,
    })
  })

  const mockRutina = {
    id: 'r1',
    usuario_id: 'u1',
    nombre: 'Rutina Test',
    descripcion: 'Desc',
    activa: 0 as const,
    creado_en: '2024-01-01T00:00:00.000Z',
    actualizado_en: '2024-01-01T00:00:00.000Z',
    sincronizado: 0 as const,
  }

  const mockRutinaDetalle = {
    ...mockRutina,
    dias: [],
  }

  describe('cargarRutinas', () => {
    it('éxito: carga rutinas', async () => {
      ;(obtenerBD as jest.Mock).mockResolvedValue({})
      ;(listarRutinas as jest.Mock).mockResolvedValue([mockRutina])

      const { result } = await renderHook(() => useRutinasStore())

      await act(async () => {
        await result.current.cargarRutinas('u1')
      })

      await waitFor(() => expect(result.current.cargando).toBe(false))
      expect(result.current.rutinas).toEqual([mockRutina])
      expect(result.current.error).toBeNull()
    })

    it('error: repo rechaza -> error seteado, cargando false', async () => {
      ;(obtenerBD as jest.Mock).mockResolvedValue({})
      ;(listarRutinas as jest.Mock).mockRejectedValue(new Error('DB error'))

      const { result } = await renderHook(() => useRutinasStore())

      await act(async () => {
        await result.current.cargarRutinas('u1')
      })

      await waitFor(() => expect(result.current.cargando).toBe(false))
      expect(result.current.rutinas).toEqual([])
      expect(result.current.error).toBe('DB error')
    })
  })

  describe('seleccionarRutina', () => {
    it('éxito: selecciona rutina y carga detalle', async () => {
      ;(obtenerBD as jest.Mock).mockResolvedValue({})
      ;(obtenerRutinaDetalle as jest.Mock).mockResolvedValue({ ...mockRutina, dias: [] })

      const { result } = await renderHook(() => useRutinasStore())

      await act(async () => {
        await result.current.seleccionarRutina('r1')
      })

      await waitFor(() => expect(result.current.cargando).toBe(false))
      expect(result.current.rutinaSeleccionada).toEqual({ ...mockRutina, dias: [] })
      expect(result.current.error).toBeNull()
    })

    it('null: limpia selección sin ir a BD', async () => {
      const { result } = await renderHook(() => useRutinasStore())
      useRutinasStore.setState({ rutinaSeleccionada: mockRutina as any })

      await act(async () => {
        await result.current.seleccionarRutina(null)
      })

      expect(result.current.rutinaSeleccionada).toBeNull()
      expect(obtenerBD).not.toHaveBeenCalled()
    })

    it('error: repo rechaza -> error seteado, cargando false', async () => {
      ;(obtenerBD as jest.Mock).mockResolvedValue({})
      ;(obtenerRutinaDetalle as jest.Mock).mockRejectedValue(new Error('Not found'))

      const { result } = await renderHook(() => useRutinasStore())

      await act(async () => {
        await result.current.seleccionarRutina('r1')
      })

      await waitFor(() => expect(result.current.cargando).toBe(false))
      expect(result.current.rutinaSeleccionada).toBeNull()
      expect(result.current.error).toBe('Not found')
    })
  })

  describe('crearRutinaNueva', () => {
    it('éxito: crea y agrega a lista', async () => {
      const nuevaRutina = { ...mockRutina, id: 'r2', nombre: 'Nueva' }
      ;(obtenerBD as jest.Mock).mockResolvedValue({})
      ;(crearRutina as jest.Mock).mockResolvedValue(nuevaRutina)

      const { result } = await renderHook(() => useRutinasStore())

      let creada: any
      await act(async () => {
        creada = await result.current.crearRutinaNueva({
          usuario_id: null,
          nombre: 'Nueva',
          descripcion: 'Desc',
          dias: [],
        })
      })

      await waitFor(() => expect(result.current.cargando).toBe(false))
      expect(creada).toEqual(nuevaRutina)
      expect(result.current.rutinas).toContainEqual(nuevaRutina)
    })

    it('error: repo rechaza -> error seteado, no agrega a lista', async () => {
      ;(obtenerBD as jest.Mock).mockResolvedValue({})
      ;(crearRutina as jest.Mock).mockRejectedValue(new Error('Validation error'))

      const { result } = await renderHook(() => useRutinasStore())

      let creada: any
      await act(async () => {
        creada = await result.current.crearRutinaNueva({
          usuario_id: null,
          nombre: 'Nueva',
          descripcion: 'Desc',
          dias: [],
        })
      })

      await waitFor(() => expect(result.current.cargando).toBe(false))
      expect(creada).toBeUndefined()
      expect(result.current.rutinas).toEqual([])
      expect(result.current.error).toBe('Validation error')
    })
  })

  describe('actualizarRutinaExistente', () => {
    it('éxito: actualiza rutina en lista', async () => {
      ;(obtenerBD as jest.Mock).mockResolvedValue({})
      ;(actualizarRutina as jest.Mock).mockResolvedValue(undefined)

      const { result } = await renderHook(() => useRutinasStore())
      useRutinasStore.setState({ rutinas: [mockRutina] })

      await act(async () => {
        await result.current.actualizarRutinaExistente('r1', { nombre: 'Actualizada' })
      })

      await waitFor(() => expect(result.current.cargando).toBe(false))
      expect(result.current.rutinas[0].nombre).toBe('Actualizada')
    })
  })

  describe('activarRutinaSeleccionada', () => {
    it('éxito: activa rutina y actualiza lista', async () => {
      ;(obtenerBD as jest.Mock).mockResolvedValue({})
      ;(activarRutina as jest.Mock).mockResolvedValue(undefined)

      const { result } = await renderHook(() => useRutinasStore())
      useRutinasStore.setState({
        rutinas: [mockRutina, { ...mockRutina, id: 'r2', activa: 1 as const }],
        rutinaSeleccionada: mockRutina as any,
      })

      await act(async () => {
        await result.current.activarRutinaSeleccionada('u1')
      })

      await waitFor(() => expect(result.current.cargando).toBe(false))
      expect(result.current.rutinas.find((r) => r.id === 'r1')?.activa).toBe(1)
      expect(result.current.rutinas.find((r) => r.id === 'r2')?.activa).toBe(0)
    })

    it('sin selección: setea error', async () => {
      const { result } = await renderHook(() => useRutinasStore())

      await act(async () => {
        await result.current.activarRutinaSeleccionada('u1')
      })

      expect(result.current.error).toBe('No hay rutina seleccionada para activar')
    })
  })

  describe('eliminarRutinaPorId', () => {
    it('éxito: elimina de lista y limpia selección si era la seleccionada', async () => {
      ;(obtenerBD as jest.Mock).mockResolvedValue({})
      ;(eliminarRutina as jest.Mock).mockResolvedValue(undefined)

      const { result } = await renderHook(() => useRutinasStore())
      useRutinasStore.setState({
        rutinas: [mockRutina],
        rutinaSeleccionada: mockRutina as any,
      })

      await act(async () => {
        await result.current.eliminarRutinaPorId('r1')
      })

      await waitFor(() => expect(result.current.cargando).toBe(false))
      expect(result.current.rutinas).toEqual([])
      expect(result.current.rutinaSeleccionada).toBeNull()
    })
  })

  describe('limpiarSeleccion', () => {
    it('limpia selección y error', async () => {
      const { result } = await renderHook(() => useRutinasStore())
      useRutinasStore.setState({
        rutinaSeleccionada: mockRutina as any,
        error: 'algun error',
      })

      act(() => {
        result.current.limpiarSeleccion()
      })

      expect(result.current.rutinaSeleccionada).toBeNull()
      expect(result.current.error).toBeNull()
    })
  })
})