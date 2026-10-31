import { act, renderHook, waitFor } from '@testing-library/react-native'
import { mediaPlaceholder } from '../src/domain/media'
import { useMediaStore } from '../src/store/media.store'

jest.mock('../src/db/client', () => ({
  obtenerBD: jest.fn(),
}))

import { obtenerBD } from '../src/db/client'

describe('useMediaStore', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useMediaStore.setState({
      mediaPorEjercicioId: new Map(),
      cargando: false,
      error: null,
    })
  })

  it('éxito: carga la media y construye el mapa por ejercicioId', async () => {
    ;(obtenerBD as jest.Mock).mockResolvedValue({})

    const { result } = await renderHook(() => useMediaStore())

    await act(async () => {
      await result.current.cargarMediaEjercicios()
    })

    await waitFor(() => expect(result.current.cargando).toBe(false))
    expect(result.current.mediaPorEjercicioId.size).toBeGreaterThan(0)
    expect(result.current.error).toBeNull()

    const mediaPress = result.current.obtenerMedia('ej:press_banca_mancuernas')
    expect(mediaPress).toBeDefined()
    expect(mediaPress.tipo).toBe('svg')
    expect(mediaPress.accessibilityLabel).toContain('Press de banca')
  })

  it('idempotencia: si ya está cargado no vuelve a ejecutar la acción', async () => {
    ;(obtenerBD as jest.Mock).mockResolvedValue({})
    const { result } = await renderHook(() => useMediaStore())

    await act(async () => {
      await result.current.cargarMediaEjercicios()
    })
    expect(obtenerBD).toHaveBeenCalledTimes(1)

    // Segunda llamada: debe retornar de inmediato sin llamar a obtenerBD
    await act(async () => {
      await result.current.cargarMediaEjercicios()
    })
    expect(obtenerBD).toHaveBeenCalledTimes(1)
  })

  it('fallback a placeholder: devuelve placeholder cuando el ejercicio no tiene media', async () => {
    const { result } = await renderHook(() => useMediaStore())

    const placeholder = result.current.obtenerMedia('ej:ejercicio_inexistente', 'Inexistente')
    expect(placeholder.id).toBe('media:placeholder')
    expect(placeholder.alt).toContain('Inexistente')
    expect(placeholder.recurso).toBeDefined()
  })

  it('error con reintento: si la acción falla queda el error y permite reintentar', async () => {
    ;(obtenerBD as jest.Mock).mockRejectedValueOnce(new Error('Fallo de I/O'))

    const { result } = await renderHook(() => useMediaStore())

    await act(async () => {
      await result.current.cargarMediaEjercicios()
    })

    await waitFor(() => expect(result.current.cargando).toBe(false))
    expect(result.current.mediaPorEjercicioId.size).toBe(0)
    expect(result.current.error).toBe('Fallo de I/O')

    // Reintento exitoso
    ;(obtenerBD as jest.Mock).mockResolvedValueOnce({})
    await act(async () => {
      await result.current.cargarMediaEjercicios()
    })

    await waitFor(() => expect(result.current.cargando).toBe(false))
    expect(result.current.mediaPorEjercicioId.size).toBeGreaterThan(0)
    expect(result.current.error).toBeNull()
  })

  it('limpiarError: resetea el error a null', async () => {
    useMediaStore.setState({ error: 'Error forzado' })
    const { result } = await renderHook(() => useMediaStore())
    expect(result.current.error).toBe('Error forzado')

    await act(async () => {
      result.current.limpiarError()
    })
    expect(result.current.error).toBeNull()
  })
})
