import { act, renderHook, waitFor } from '@testing-library/react-native'
import {
  esPerfilCompletado,
  seleccionarPerfilCompletado,
  useConfiguracionStore,
} from '../src/store/configuracion.store'

jest.mock('../src/db/repositories/usuario.repository', () => ({
  obtenerUsuarioPorId: jest.fn(),
  listarUsuarios: jest.fn(),
  crearUsuario: jest.fn(),
  actualizarUsuario: jest.fn(),
}))

jest.mock('../src/db/client', () => ({
  obtenerBD: jest.fn(),
}))

import {
  obtenerUsuarioPorId,
  listarUsuarios,
  crearUsuario,
  actualizarUsuario,
} from '../src/db/repositories/usuario.repository'
import { obtenerBD } from '../src/db/client'

describe('useConfiguracionStore', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useConfiguracionStore.setState({
      tema: 'claro',
      usuarioActivo: null,
      perfilCompletado: false,
      cargando: false,
      error: null,
    })
    localStorage.clear()
  })

  describe('cambiarTema', () => {
    it('cambia el tema sincrónicamente sin pasar por cargando', async () => {
      const { result } = await renderHook(() => useConfiguracionStore())

      await act(async () => {
        result.current.cambiarTema('oscuro')
      })

      expect(result.current.tema).toBe('oscuro')
      expect(result.current.cargando).toBe(false)
    })

    it('persiste el tema en localStorage', async () => {
      const { result } = await renderHook(() => useConfiguracionStore())

      await act(async () => {
        result.current.cambiarTema('oscuro')
      })

      const stored = localStorage.getItem('gymfor-configuracion')
      expect(stored).toContain('"tema":"oscuro"')
    })

    it('acepta el modo sistema y lo persiste', async () => {
      const { result } = await renderHook(() => useConfiguracionStore())

      await act(async () => {
        result.current.cambiarTema('sistema')
      })

      expect(result.current.tema).toBe('sistema')
      const stored = localStorage.getItem('gymfor-configuracion')
      expect(stored).toContain('"tema":"sistema"')
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

    it('sin crypto.randomUUID (Hermes nativo): no crashea y genera un ID de fallback', async () => {
      ;(obtenerBD as jest.Mock).mockResolvedValue({})
      ;(crearUsuario as jest.Mock).mockResolvedValue(undefined)

      // Simula Hermes: `crypto` existe con getRandomValues pero SIN randomUUID
      // (o directamente sin crypto). El store debe usar `generarId()`.
      const cryptoOriginal = globalThis.crypto
      const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto')
      try {
        Object.defineProperty(globalThis, 'crypto', {
          configurable: true,
          value: cryptoOriginal
            ? { getRandomValues: cryptoOriginal.getRandomValues.bind(cryptoOriginal) }
            : undefined,
        })

        const { result } = await renderHook(() => useConfiguracionStore())

        await act(async () => {
          await result.current.crearUsuarioInicial({ nombre: 'Sin Hermes' })
        })

        await waitFor(() => expect(result.current.cargando).toBe(false))
        expect(result.current.error).toBeNull()
        expect(result.current.usuarioActivo?.nombre).toBe('Sin Hermes')
        // UUID v4 válido (el fallback de src/utils/id.ts).
        expect(result.current.usuarioActivo?.id).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
        )
      } finally {
        if (descriptor) {
          Object.defineProperty(globalThis, 'crypto', descriptor)
        } else {
          Object.defineProperty(globalThis, 'crypto', {
            configurable: true,
            value: cryptoOriginal,
          })
        }
      }
    })
  })

  describe('limpiarUsuario', () => {
    it('limpia usuarioActivo y error', async () => {
      const { result } = await renderHook(() => useConfiguracionStore())
      await act(async () => {
        result.current.cambiarTema('oscuro')
        useConfiguracionStore.setState({ usuarioActivo: { id: 'u1', nombre: 'Test' } as any })
      })

      await act(async () => {
        result.current.limpiarUsuario()
      })

      expect(result.current.usuarioActivo).toBeNull()
      expect(result.current.error).toBeNull()
    })
  })

  describe('asegurarUsuario', () => {
    it('con usuarioActivo ya presente no toca la BD', async () => {
      const { result } = await renderHook(() => useConfiguracionStore())
      useConfiguracionStore.setState({ usuarioActivo: { id: 'u1', nombre: 'Test' } as any })

      await act(async () => {
        await result.current.asegurarUsuario()
      })

      expect(listarUsuarios).not.toHaveBeenCalled()
      expect(crearUsuario).not.toHaveBeenCalled()
    })

    it('sin usuario activo y con usuarios en BD: adopta al primero sin crear otro', async () => {
      ;(obtenerBD as jest.Mock).mockResolvedValue({})
      ;(listarUsuarios as jest.Mock).mockResolvedValue([
        { id: 'u-viejo', nombre: 'Atleta' },
        { id: 'u-otro', nombre: 'Segundo' },
      ])

      const { result } = await renderHook(() => useConfiguracionStore())

      await act(async () => {
        await result.current.asegurarUsuario()
      })

      await waitFor(() => expect(result.current.cargando).toBe(false))
      expect(result.current.usuarioActivo?.id).toBe('u-viejo')
      expect(crearUsuario).not.toHaveBeenCalled()
      expect(result.current.error).toBeNull()
    })

    it('con la BD vacía: crea el usuario inicial y lo deja activo', async () => {
      ;(obtenerBD as jest.Mock).mockResolvedValue({})
      ;(listarUsuarios as jest.Mock).mockResolvedValue([])
      ;(crearUsuario as jest.Mock).mockImplementation((_db, usuario) =>
        Promise.resolve(usuario),
      )

      const { result } = await renderHook(() => useConfiguracionStore())

      await act(async () => {
        await result.current.asegurarUsuario()
      })

      await waitFor(() => expect(result.current.cargando).toBe(false))
      expect(crearUsuario).toHaveBeenCalledTimes(1)
      expect(result.current.usuarioActivo?.nombre).toBe('Atleta')
      expect(result.current.perfilCompletado).toBe(false)
      expect(result.current.error).toBeNull()
    })
  })

  describe('esPerfilCompletado y flag de onboarding', () => {
    const baseAtleta = {
      id: 'u-atleta',
      nombre: 'Atleta',
      fecha_nacimiento: null,
      sexo: null,
      peso_inicial: null,
      objetivo: null,
      nivel: null,
      configuracion_entrenamiento: {},
      creado_en: '2026-11-03T10:00:00.000Z',
      actualizado_en: '2026-11-03T10:00:00.000Z',
      sincronizado: 0 as const,
    }

    it('devuelve false para null y para el usuario Atleta autocreado sin onboarding', () => {
      expect(esPerfilCompletado(null)).toBe(false)
      expect(esPerfilCompletado(baseAtleta)).toBe(false)
      expect(seleccionarPerfilCompletado({ usuarioActivo: baseAtleta })).toBe(false)
    })

    it('devuelve true cuando onboarding_completado === true o cuando tiene objetivo/nivel', () => {
      expect(
        esPerfilCompletado({
          ...baseAtleta,
          nombre: 'Carlos',
          configuracion_entrenamiento: { onboarding_completado: true },
        }),
      ).toBe(true)

      expect(
        esPerfilCompletado({
          ...baseAtleta,
          nombre: 'Laura',
          objetivo: 'hipertrofia',
        }),
      ).toBe(true)

      expect(
        esPerfilCompletado({
          ...baseAtleta,
          nombre: 'Laura',
          nivel: 'intermedio',
        }),
      ).toBe(true)
    })

    it('crearUsuarioInicial con datos completos y onboarding_completado marca perfilCompletado y no lo duplica en localStorage', async () => {
      ;(obtenerBD as jest.Mock).mockResolvedValue({})
      ;(crearUsuario as jest.Mock).mockImplementation((_db, usuario) => Promise.resolve(usuario))

      const { result } = await renderHook(() => useConfiguracionStore())

      await act(async () => {
        await result.current.crearUsuarioInicial({
          nombre: '  Ana García  ',
          fecha_nacimiento: '1996-05-14',
          sexo: 'femenino',
          peso_inicial: 64.5,
          objetivo: 'fuerza',
          nivel: 'intermedio',
          onboarding_completado: true,
        })
      })

      await waitFor(() => expect(result.current.cargando).toBe(false))
      expect(crearUsuario).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          nombre: 'Ana García',
          fecha_nacimiento: '1996-05-14',
          sexo: 'femenino',
          peso_inicial: 64.5,
          objetivo: 'fuerza',
          nivel: 'intermedio',
          configuracion_entrenamiento: { onboarding_completado: true },
        }),
      )
      expect(result.current.perfilCompletado).toBe(true)

      // Solo `tema` se persiste en localStorage; ni `usuarioActivo` ni `perfilCompletado` se duplican.
      await act(async () => {
        result.current.cambiarTema('oscuro')
      })
      const persistido = JSON.parse(localStorage.getItem('gymfor-configuracion') ?? '{}') as {
        state?: Record<string, unknown>
      }
      expect(persistido.state).toEqual({ tema: 'oscuro' })
    })
  })

  describe('actualizarPerfil', () => {
    const usuarioInicial = {
      id: 'u1',
      nombre: 'Atleta',
      fecha_nacimiento: null,
      sexo: null,
      peso_inicial: null,
      objetivo: null,
      nivel: null,
      configuracion_entrenamiento: { unidades: 'kg' },
      creado_en: '2026-11-03T10:00:00.000Z',
      actualizado_en: '2026-11-03T10:00:00.000Z',
      sincronizado: 0 as const,
    }

    it('éxito: persiste vía actualizarUsuario, relee con obtenerUsuarioPorId y actualiza usuarioActivo', async () => {
      const usuarioReleido = {
        ...usuarioInicial,
        nombre: 'Martín',
        fecha_nacimiento: '1994-08-20',
        sexo: 'masculino' as const,
        peso_inicial: 78.5,
        objetivo: 'hipertrofia' as const,
        nivel: 'avanzado' as const,
        configuracion_entrenamiento: { unidades: 'kg', onboarding_completado: true },
        actualizado_en: '2026-11-03T11:00:00.000Z',
      }

      useConfiguracionStore.setState({
        usuarioActivo: usuarioInicial,
        perfilCompletado: false,
      })
      ;(obtenerBD as jest.Mock).mockResolvedValue({})
      ;(actualizarUsuario as jest.Mock).mockResolvedValue(undefined)
      ;(obtenerUsuarioPorId as jest.Mock).mockResolvedValue(usuarioReleido)

      const { result } = await renderHook(() => useConfiguracionStore())

      let devuelto: unknown
      await act(async () => {
        devuelto = await result.current.actualizarPerfil({
          nombre: '  Martín  ',
          fecha_nacimiento: '1994-08-20',
          sexo: 'masculino',
          peso_inicial: 78.5,
          objetivo: 'hipertrofia',
          nivel: 'avanzado',
        })
      })

      await waitFor(() => expect(result.current.cargando).toBe(false))
      expect(actualizarUsuario).toHaveBeenCalledWith(
        expect.anything(),
        'u1',
        {
          nombre: 'Martín',
          fecha_nacimiento: '1994-08-20',
          sexo: 'masculino',
          peso_inicial: 78.5,
          objetivo: 'hipertrofia',
          nivel: 'avanzado',
          configuracion_entrenamiento: { unidades: 'kg', onboarding_completado: true },
        },
      )
      expect(obtenerUsuarioPorId).toHaveBeenCalledWith(expect.anything(), 'u1')
      expect(devuelto).toEqual(usuarioReleido)
      expect(result.current.usuarioActivo).toEqual(usuarioReleido)
      expect(result.current.perfilCompletado).toBe(true)
      expect(result.current.error).toBeNull()
    })

    it('error del repositorio: deja usuarioActivo intacto y setea error', async () => {
      useConfiguracionStore.setState({
        usuarioActivo: usuarioInicial,
        perfilCompletado: false,
      })
      ;(obtenerBD as jest.Mock).mockResolvedValue({})
      ;(actualizarUsuario as jest.Mock).mockRejectedValue(new Error('Disco lleno'))

      const { result } = await renderHook(() => useConfiguracionStore())

      let devuelto: unknown
      await act(async () => {
        devuelto = await result.current.actualizarPerfil({ nombre: 'Martín' })
      })

      await waitFor(() => expect(result.current.cargando).toBe(false))
      expect(devuelto).toBeUndefined()
      expect(result.current.usuarioActivo).toEqual(usuarioInicial)
      expect(result.current.perfilCompletado).toBe(false)
      expect(result.current.error).toBe('Disco lleno')
    })

    it('sin usuarioActivo: no toca la BD y setea error descriptivo', async () => {
      const { result } = await renderHook(() => useConfiguracionStore())

      let devuelto: unknown
      await act(async () => {
        devuelto = await result.current.actualizarPerfil({ nombre: 'Martín' })
      })

      expect(devuelto).toBeUndefined()
      expect(obtenerBD).not.toHaveBeenCalled()
      expect(actualizarUsuario).not.toHaveBeenCalled()
      expect(result.current.error).toContain('usuario activo')
    })
  })
})