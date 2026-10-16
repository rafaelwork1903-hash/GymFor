import { act } from '@testing-library/react-native'
import { renderHook, waitFor } from '@testing-library/react-native'
import type { Ejercicio } from '../src/domain/types'
import { useEjerciciosStore } from '../src/store/ejercicios.store'

jest.mock('../src/db/repositories/ejercicio.repository', () => ({
  listarEjercicios: jest.fn(),
}))

jest.mock('../src/db/client', () => ({
  obtenerBD: jest.fn(),
}))

import { listarEjercicios } from '../src/db/repositories/ejercicio.repository'
import { obtenerBD } from '../src/db/client'

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

const mockEjercicio2: Ejercicio = {
  ...mockEjercicio,
  id: 'ej:sentadilla',
  nombre: 'Sentadilla',
  grupo_muscular_primario: 'cuadriceps',
  grupos_musculares_secundarios: [],
  equipamiento: 'barra',
}

describe('useEjerciciosStore', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useEjerciciosStore.setState({
      ejercicios: [],
      ejerciciosPorId: new Map(),
      cargando: false,
      error: null,
    })
  })

  it('éxito: carga el catálogo y construye el mapa por id', async () => {
    ;(obtenerBD as jest.Mock).mockResolvedValue({})
    ;(listarEjercicios as jest.Mock).mockResolvedValue([mockEjercicio, mockEjercicio2])

    const { result } = await renderHook(() => useEjerciciosStore())

    await act(async () => {
      await result.current.cargarEjercicios()
    })

    await waitFor(() => expect(result.current.cargando).toBe(false))
    expect(result.current.ejercicios).toHaveLength(2)
    expect(result.current.ejerciciosPorId.get('ej:press_banca')?.nombre).toBe('Press banca')
    expect(result.current.ejerciciosPorId.get('ej:sentadilla')?.grupo_muscular_primario).toBe(
      'cuadriceps',
    )
    expect(result.current.error).toBeNull()
  })

  it('cache: si el catálogo ya está cargado no vuelve a la BD', async () => {
    useEjerciciosStore.setState({
      ejercicios: [mockEjercicio],
      ejerciciosPorId: new Map([['ej:press_banca', mockEjercicio]]),
    })

    const { result } = await renderHook(() => useEjerciciosStore())

    await act(async () => {
      await result.current.cargarEjercicios()
    })

    expect(obtenerBD).not.toHaveBeenCalled()
    expect(listarEjercicios).not.toHaveBeenCalled()
    expect(result.current.error).toBeNull()
  })

  it('error: repo rechaza -> error seteado y permite reintentar', async () => {
    ;(obtenerBD as jest.Mock).mockResolvedValue({})
    ;(listarEjercicios as jest.Mock).mockRejectedValueOnce(new Error('catálogo down'))

    const { result } = await renderHook(() => useEjerciciosStore())

    await act(async () => {
      await result.current.cargarEjercicios()
    })

    await waitFor(() => expect(result.current.cargando).toBe(false))
    expect(result.current.ejercicios).toEqual([])
    expect(result.current.error).toBe('catálogo down')

    // Reintento con éxito: el catálogo vacío permite volver a la BD.
    ;(listarEjercicios as jest.Mock).mockResolvedValueOnce([mockEjercicio])
    await act(async () => {
      await result.current.cargarEjercicios()
    })

    await waitFor(() => expect(result.current.error).toBeNull())
    expect(result.current.ejercicios).toHaveLength(1)
  })

  it('limpiarError: limpia el error sin tocar el catálogo', async () => {
    useEjerciciosStore.setState({ error: 'error previo', ejercicios: [mockEjercicio] })

    const { result } = await renderHook(() => useEjerciciosStore())

    await act(async () => {
      result.current.limpiarError()
    })

    expect(result.current.error).toBeNull()
    expect(result.current.ejercicios).toHaveLength(1)
  })
})
