import { act } from '@testing-library/react-native'
import { renderHook, waitFor } from '@testing-library/react-native'
import { useConfiguracionStore } from '../src/store/configuracion.store'

jest.mock('../src/db/repositories/usuario.repository', () => ({
  obtenerUsuarioPorId: jest.fn(),
  crearUsuario: jest.fn(),
}))

jest.mock('../src/db/client', () => ({
  obtenerBD: jest.fn(),
}))

import { obtenerUsuarioPorId, crearUsuario } from '../src/db/repositories/usuario.repository'
import { obtenerBD } from '../src/db/client'

describe('useConfiguracionStore', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useConfiguracionStore.setState({
      tema: 'claro',
      usuarioActivo: null,
      cargando: false,
      error: null,
    })
    localStorage.clear()
  })

  describe('cambiarTema', () => {
    it('cambia el tema sincrónicamente sin pasar por cargando', () => {
      const { result } = renderHook(() => useConfiguracionStore())

      act(() => {
        result.current.cambiarTema('oscuro')
      })

      expect(result.current.tema).toBe('oscuro')
      expect(result.current.cargando).toBe(false)
    })

    it('persiste el tema en localStorage', () => {
      const { result } = renderHook(() => useConfiguracionStore())

      act(() => {
        result.current.cambiarTema('oscuro')
      })

      const stored = localStorage.getItem('gymfor-configuracion')
      expect(stored).toContain('"tema":"oscuro"')
    })
  })

  describe('cargarUsuario', () => {
    it('éxito: carga usuario y setea usuarioActivo', async () => {
      const mockUsuario = {
        id: 'u1',
        nombre: 'Test',
        fecha_nacimiento: null,
        sexo: null,
        peso_inicial: null,
        objetivo: null,
        nivel: null,
        configuracion_entrenamiento: {},
        creado_en: '2024-01-01T00:00:00.000Z',
        actualizado_en: '2024-01-01T00:00:00.000Z',
        sincronizado: 0 as const,
      }
      ;(obtenerBD as jest.Mock).mockResolvedValue({})
      ;(obtenerUsuarioPorId as jest.Mock).mockResolvedValue(mockUsuario)

      const { result } = await renderHook(() => useConfiguracionStore())

      await act(async () => {
        await result.current.cargarUsuario('u1')
      })

      await waitFor(() => expect(result.current.cargando).toBe(false))
      expect(result.current.usuarioActivo).toEqual(mockUsuario)
      expect(result.current.error).toBeNull()
    })

    it('error: repo rechaza -> setea error y cargando: false, no throw', async () => {
      ;(obtenerBD as jest.Mock).mockResolvedValue({})
      ;(obtenerUsuarioPorId as jest.Mock).mockRejectedValue(new Error('DB down'))

      const { result } = await renderHook(() => useConfiguracionStore())

      await act(async () => {
        await result.current.cargarUsuario('u1')
      })

      await waitFor(() => expect(result.current.cargando).toBe(false))
      expect(result.current.usuarioActivo).toBeNull()
      expect(result.current.error).toBe('DB down')
    })
  })

  describe('crearUsuarioInicial', () => {
    it('éxito: crea usuario y setea usuarioActivo', async () => {
      ;(obtenerBD as jest.Mock).mockResolvedValue({})
      ;(crearUsuario as jest.Mock).mockResolvedValue(undefined)

      const { result } = await renderHook(() => useConfiguracionStore())

      await act(async () => {
        await result.current.crearUsuarioInicial({ nombre: 'Nuevo' })
      })

      await waitFor(() => expect(result.current.cargando).toBe(false))
      expect(result.current.usuarioActivo).toMatchObject({
        nombre: 'Nuevo',
        sincronizado: 0,
      })
      expect(result.current.error).toBeNull()
    })

    it('error: repo rechaza -> setea error y cargando: false', async () => {
      ;(obtenerBD as jest.Mock).mockResolvedValue({})
      ;(crearUsuario as jest.Mock).mockRejectedValue(new Error('Unique constraint'))

      const { result } = await renderHook(() => useConfiguracionStore())

      await act(async () => {
        await result.current.crearUsuarioInicial({ nombre: 'Nuevo' })
      })

      await waitFor(() => expect(result.current.cargando).toBe(false))
      expect(result.current.usuarioActivo).toBeNull()
      expect(result.current.error).toBe('Unique constraint')
    })
  })

  describe('limpiarUsuario', () => {
    it('limpia usuarioActivo y error', () => {
      const { result } = renderHook(() => useConfiguracionStore())
      act(() => {
        result.current.cambiarTema('oscuro')
        useConfiguracionStore.setState({ usuarioActivo: { id: 'u1', nombre: 'Test' } as any })
      })

      act(() => {
        result.current.limpiarUsuario()
      })

      expect(result.current.usuarioActivo).toBeNull()
      expect(result.current.error).toBeNull()
    })
  })
})