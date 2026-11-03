import { obtenerBD } from '../src/db/client'
import type { ConexionBD } from '../src/db/port'
import { obtenerUsuarioPorId } from '../src/db/repositories/usuario.repository'
import {
  esPerfilCompletado,
  NOMBRE_USUARIO_INICIAL,
  useConfiguracionStore,
} from '../src/store/configuracion.store'
import { AdaptadorSQLite, comoBD } from './helpers/sqlite-adapter'

/**
 * Tests de integración real de onboarding y edición de perfil de usuario
 * (issue #33): store → `usuario.repository` → SQLite REAL (`node:sqlite`
 * en memoria, esquema real, FKs ON).
 *
 * Solo se mockea la conexión (`src/db/client`).
 */

jest.mock('../src/db/client', () => ({
  obtenerBD: jest.fn(),
}))

describe('integración usuarios: onboarding y edición de perfil (issue #33)', () => {
  let adaptador: AdaptadorSQLite
  let db: ConexionBD

  beforeEach(() => {
    adaptador = new AdaptadorSQLite()
    db = comoBD(adaptador)
    ;(obtenerBD as jest.Mock).mockResolvedValue(db)
    useConfiguracionStore.setState({
      tema: 'sistema',
      usuarioActivo: null,
      perfilCompletado: false,
      cargando: false,
      error: null,
    })
    localStorage.clear()
  })

  it('bootstrap mínimo → actualizarPerfil completo → relectura real y ediciones parciales sin borrar campos previos', async () => {
    // 1. Primer arranque: asegurarUsuario crea el usuario mínimo "Atleta" sin onboarding completado.
    await useConfiguracionStore.getState().asegurarUsuario()

    const inicial = useConfiguracionStore.getState().usuarioActivo
    expect(inicial).not.toBeNull()
    expect(inicial!.nombre).toBe(NOMBRE_USUARIO_INICIAL)
    expect(useConfiguracionStore.getState().perfilCompletado).toBe(false)
    expect(esPerfilCompletado(inicial)).toBe(false)

    // 2. Onboarding completo: guarda los 6 campos y marca onboarding_completado: true.
    const completado = await useConfiguracionStore.getState().actualizarPerfil({
      nombre: 'Lucía Fernández',
      fecha_nacimiento: '1997-03-15',
      sexo: 'femenino',
      peso_inicial: 63.5,
      objetivo: 'hipertrofia',
      nivel: 'intermedio',
    })

    expect(useConfiguracionStore.getState().error).toBeNull()
    expect(completado).toBeDefined()
    expect(useConfiguracionStore.getState().perfilCompletado).toBe(true)

    // Relectura directa desde SQLite vía repositorio.
    const enBD = await obtenerUsuarioPorId(db, inicial!.id)
    expect(enBD).not.toBeNull()
    expect(enBD).toMatchObject({
      id: inicial!.id,
      nombre: 'Lucía Fernández',
      fecha_nacimiento: '1997-03-15',
      sexo: 'femenino',
      peso_inicial: 63.5,
      objetivo: 'hipertrofia',
      nivel: 'intermedio',
      configuracion_entrenamiento: { onboarding_completado: true },
      sincronizado: 0,
    })

    // 3. Segunda edición parcial (incluyendo propiedades undefined): actualiza solo peso_inicial y nivel,
    // conservando intactos nombre, fecha_nacimiento, sexo, objetivo y el flag de onboarding.
    const editadoParcial = await useConfiguracionStore.getState().actualizarPerfil({
      peso_inicial: 65,
      nivel: 'avanzado',
      nombre: undefined,
      objetivo: undefined,
      sexo: undefined,
      fecha_nacimiento: undefined,
    })

    expect(useConfiguracionStore.getState().error).toBeNull()
    expect(editadoParcial).toBeDefined()

    const trasEdicionParcial = await obtenerUsuarioPorId(db, inicial!.id)
    expect(trasEdicionParcial).toMatchObject({
      id: inicial!.id,
      nombre: 'Lucía Fernández',
      fecha_nacimiento: '1997-03-15',
      sexo: 'femenino',
      peso_inicial: 65,
      objetivo: 'hipertrofia',
      nivel: 'avanzado',
      configuracion_entrenamiento: { onboarding_completado: true },
    })

    // 4. Limpieza explícita de un campo opcional con `null` (ej. vaciar peso_inicial en /perfil).
    await useConfiguracionStore.getState().actualizarPerfil({
      peso_inicial: null,
    })

    const trasLimpiarOpcional = await obtenerUsuarioPorId(db, inicial!.id)
    expect(trasLimpiarOpcional?.peso_inicial).toBeNull()
    expect(trasLimpiarOpcional?.nombre).toBe('Lucía Fernández')
    expect(trasLimpiarOpcional?.objetivo).toBe('hipertrofia')
    expect(trasLimpiarOpcional?.configuracion_entrenamiento).toEqual({
      onboarding_completado: true,
    })

    // 5. Simula cierre y reapertura de la app: limpiar estado en memoria y ejecutar asegurarUsuario.
    useConfiguracionStore.getState().limpiarUsuario()
    expect(useConfiguracionStore.getState().usuarioActivo).toBeNull()
    expect(useConfiguracionStore.getState().perfilCompletado).toBe(false)

    await useConfiguracionStore.getState().asegurarUsuario()

    const recuperado = useConfiguracionStore.getState()
    expect(recuperado.usuarioActivo?.id).toBe(inicial!.id)
    expect(recuperado.usuarioActivo?.nombre).toBe('Lucía Fernández')
    expect(recuperado.perfilCompletado).toBe(true)

    // Sigue habiendo un único registro en la tabla `usuarios`.
    const filasUsuarios = adaptador.leer<{ id: string }>('SELECT id FROM usuarios')
    expect(filasUsuarios).toHaveLength(1)
  })
})
