import { Text } from 'react-native'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'

import { ErrorBoundary } from '../src/components/ui/ErrorBoundary'
import {
  asegurarBaseDatosLista,
  configurarProveedorPersistencia,
  restaurarProveedorPorDefecto,
} from '../src/db/client'
import type { RepositoriosApp } from '../src/db/contracts'
import {
  aEnteroBooleano,
  construirInsertarIgnorandoDuplicado,
  envolverConexionConDialecto,
  traducirPlaceholdersPosicionales,
} from '../src/db/dialect'
import {
  crearGestorMetadatosTabla,
  migrarALaUltimaVersion,
  migrarAVersion,
  obtenerVersionActual,
} from '../src/db/migrations'
import type { AdaptadorMotorBD, ConexionBD } from '../src/db/port'
import { ProveedorBaseDatos, useConexionBD } from '../src/db/provider'
import { listarRutinas } from '../src/db/repositories/rutina.repository'
import { sembrarDatosIniciales } from '../src/db/seed'
import type {
  Ejercicio,
  MetricaProgreso,
  Rutina,
  SerieReal,
  SesionResumen,
  Usuario,
} from '../src/domain/types'
import { useConfiguracionStore } from '../src/store/configuracion.store'
import { useRutinasStore } from '../src/store/rutinas.store'
import { useSesionStore } from '../src/store/sesion.store'
import { AdaptadorSQLite } from './helpers/sqlite-adapter'

function obtenerTextos(renderer: ReactTestRenderer): string {
  const partes: string[] = []
  const caminar = (nodo: unknown): void => {
    if (typeof nodo === 'string') {
      partes.push(nodo)
      return
    }
    if (Array.isArray(nodo)) {
      nodo.forEach(caminar)
      return
    }
    if (nodo && typeof nodo === 'object' && 'children' in nodo) {
      caminar((nodo as { children?: unknown }).children)
    }
  }
  caminar(renderer.toJSON())
  return partes.join(' ')
}

function HijoConConexion() {
  const db = useConexionBD()
  return <Text>{`Motor activo: ${db.dialecto ?? 'desconocido'}`}</Text>
}

describe('portabilidad y abstracción de base de datos', () => {
  afterEach(async () => {
    await restaurarProveedorPorDefecto()
  })

  describe('dialecto SQL (placeholders, inserción idempotente y booleanos)', () => {
    it('traduce placeholders ? a $1..$N en postgres respetando literales, identificadores y comentarios', () => {
      const sql = `
        -- comentario con ? ignorado
        /* bloque ? ignorado */
        SELECT * FROM sesiones
        WHERE notas = '¿listo? it''s ok?' AND "col?rara" = ? AND usuario_id = ? AND rpe_sesion >= ?
      `
      const traducido = traducirPlaceholdersPosicionales(sql, 'postgres')

      expect(traducido).toContain("'¿listo? it''s ok?'")
      expect(traducido).toContain('"col?rara" = $1')
      expect(traducido).toContain('usuario_id = $2')
      expect(traducido).toContain('rpe_sesion >= $3')
      expect(traducido).not.toContain('$4')

      // En sqlite y mysql conserva los signos ? intactos
      expect(traducirPlaceholdersPosicionales(sql, 'sqlite')).toBe(sql)
      expect(traducirPlaceholdersPosicionales(sql, 'mysql')).toBe(sql)
    })

    it('genera sentencias INSERT idempotentes según el dialecto SQL', () => {
      expect(construirInsertarIgnorandoDuplicado('rutinas', ['id', 'nombre'], 'sqlite')).toBe(
        'INSERT INTO rutinas (id, nombre) VALUES (?, ?) ON CONFLICT DO NOTHING',
      )
      expect(
        construirInsertarIgnorandoDuplicado('rutinas', ['id', 'nombre'], 'postgres', 'id'),
      ).toBe('INSERT INTO rutinas (id, nombre) VALUES (?, ?) ON CONFLICT (id) DO NOTHING')
      expect(construirInsertarIgnorandoDuplicado('rutinas', ['id', 'nombre'], 'mysql')).toBe(
        'INSERT IGNORE INTO rutinas (id, nombre) VALUES (?, ?)',
      )
    })

    it('normaliza booleanos tanto desde INTEGER (0/1) como desde BOOLEAN nativo (true/false)', () => {
      expect(aEnteroBooleano(1)).toBe(1)
      expect(aEnteroBooleano(true)).toBe(1)
      expect(aEnteroBooleano('1')).toBe(1)
      expect(aEnteroBooleano(0)).toBe(0)
      expect(aEnteroBooleano(false)).toBe(0)
      expect(aEnteroBooleano(null)).toBe(0)
    })

    it('envolverConexionConDialecto permite ejecutar repositorios sobre un driver estilo PostgreSQL ($1..$N + boolean)', async () => {
      const consultasRecibidas: string[] = []
      const driverPostgresSimulado: ConexionBD = {
        dialecto: 'postgres',
        runAsync: async () => undefined,
        getFirstAsync: async () => null,
        getAllAsync: async <T,>(sql: string) => {
          if (sql.includes('?')) {
            throw new Error(`Driver PostgreSQL no acepta '?': ${sql}`)
          }
          consultasRecibidas.push(sql)
          return [
            {
              id: 'r-pg',
              usuario_id: 'u1',
              nombre: 'Fuerza PG',
              descripcion: 'Desde Postgres',
              activa: true,
              creado_en: '2026-11-03T00:00:00.000Z',
              actualizado_en: '2026-11-03T00:00:00.000Z',
              sincronizado: false,
            },
          ] as unknown as T[]
        },
        execAsync: async () => undefined,
        withTransactionAsync: async (tarea) => tarea(),
      }

      const db = envolverConexionConDialecto(driverPostgresSimulado, 'postgres')
      const rutinas = await listarRutinas(db, 'u1')

      expect(consultasRecibidas[0]).toContain('usuario_id = $1')
      expect(rutinas).toHaveLength(1)
      expect(rutinas[0].activa).toBe(1)
      expect(rutinas[0].sincronizado).toBe(0)
    })
  })

  describe('migraciones y semilla sin depender de PRAGMAs de SQLite', () => {
    it('aplica migraciones up/down y semilla usando tabla ANSI _esquema_migraciones cuando el dialecto no es sqlite', async () => {
      const adaptador = new AdaptadorSQLite({ versionInicial: 0, dialecto: 'generico' })
      const espiaExec = jest.spyOn(adaptador, 'execAsync')
      const gestor = crearGestorMetadatosTabla()

      expect(await obtenerVersionActual(adaptador, gestor)).toBe(0)

      const versionSubida = await migrarALaUltimaVersion(adaptador, gestor)
      expect(versionSubida).toBe(2)
      expect(await obtenerVersionActual(adaptador, gestor)).toBe(2)

      // Ninguna sentencia emitida por el gestor de tabla usa PRAGMA user_version
      const sqlEjecutados = espiaExec.mock.calls.map(([s]) => s).join('\n')
      expect(sqlEjecutados).not.toMatch(/PRAGMA\s+user_version/i)

      // La semilla idempotente funciona con ON CONFLICT DO NOTHING dos veces seguidas
      await sembrarDatosIniciales(adaptador)
      await sembrarDatosIniciales(adaptador)
      const conteoEjercicios = adaptador.leer<{ total: number }>(
        'SELECT COUNT(*) AS total FROM ejercicios',
      )[0].total
      expect(conteoEjercicios).toBeGreaterThan(0)

      // Reversión completa a v0
      const versionBajada = await migrarAVersion(adaptador, 0, gestor)
      expect(versionBajada).toBe(0)
      expect(await obtenerVersionActual(adaptador, gestor)).toBe(0)
    })
  })

  describe('ProveedorBaseDatos + ErrorBoundary (UI desacoplada de SQLiteProvider)', () => {
    let espiaConsola: jest.SpyInstance

    beforeEach(() => {
      espiaConsola = jest.spyOn(console, 'error').mockImplementation(() => {})
    })

    afterEach(() => {
      espiaConsola.mockRestore()
    })

    it('muestra indicador durante el init, captura fallos en ErrorBoundary y se recupera al pulsar Reintentar', async () => {
      let debeFallar = true
      const adaptadorPrueba: AdaptadorMotorBD = {
        nombre: 'adaptador-prueba',
        dialecto: 'postgres',
        abrir: async () => {
          if (debeFallar) {
            throw new Error('motor temporalmente no disponible')
          }
          return {
            dialecto: 'postgres',
            runAsync: async () => undefined,
            getFirstAsync: async () => null,
            getAllAsync: async () => [],
            execAsync: async () => undefined,
            withTransactionAsync: async (t) => t(),
          }
        },
        inicializarPersonalizado: async () => undefined,
      }

      await configurarProveedorPersistencia({ adaptador: adaptadorPrueba })

      let renderer!: ReactTestRenderer
      await act(async () => {
        renderer = create(
          <ErrorBoundary titulo="No se pudo iniciar la base de datos">
            <ProveedorBaseDatos>
              <HijoConConexion />
            </ProveedorBaseDatos>
          </ErrorBoundary>,
        )
      })

      expect(obtenerTextos(renderer)).toContain('No se pudo iniciar la base de datos')
      expect(obtenerTextos(renderer)).toContain('motor temporalmente no disponible')

      // El fallo se resuelve: pulsar Reintentar vuelve a abrir e inicializar el adaptador
      debeFallar = false
      const botonReintentar = renderer.root.find(
        (nodo) => nodo.props?.accessibilityRole === 'button',
      )
      await act(async () => {
        botonReintentar.props.onPress()
      })

      expect(obtenerTextos(renderer)).toContain('Motor activo: postgres')
    })
  })

  describe('migración completa en caliente a un backend no-SQL (documental en memoria)', () => {
    it('los stores reales de Zustand operan de punta a punta sin ejecutar ni una sola línea de SQL', async () => {
      // Estado documental en memoria (simula Firestore / Realm / API remota)
      const usuarios = new Map<string, Usuario>()
      const rutinas = new Map<string, Rutina>()
      const seriesPorRegistro = new Map<string, SerieReal[]>()
      const sesiones = new Map<
        string,
        {
          resumen: SesionResumen
          registros: { id: string; ejercicio_id: string; ejercicio_nombre: string }[]
        }
      >()

      const sinSQL = async (): Promise<never> => {
        throw new Error('No debe ejecutarse SQL cuando hay repositorios no-SQL registrados')
      }

      const conexionNoSQL: ConexionBD = {
        dialecto: 'generico',
        runAsync: sinSQL,
        getFirstAsync: sinSQL,
        getAllAsync: sinSQL,
        execAsync: sinSQL,
        withTransactionAsync: sinSQL,
      }

      const reposNoSQL: RepositoriosApp = {
        ejercicios: {
          listarEjercicios: async (): Promise<Ejercicio[]> => [],
          obtenerEjercicioPorId: async () => null,
          crearEjercicio: async () => undefined,
        },
        usuarios: {
          crearUsuario: async (nuevo) => {
            const creado: Usuario = {
              ...nuevo,
              creado_en: '2026-11-03T10:00:00.000Z',
              actualizado_en: '2026-11-03T10:00:00.000Z',
              sincronizado: 0,
            }
            usuarios.set(creado.id, creado)
            return creado
          },
          obtenerUsuarioPorId: async (id) => usuarios.get(id) ?? null,
          listarUsuarios: async () => [...usuarios.values()],
          actualizarUsuario: async () => undefined,
          eliminarUsuario: async (id) => {
            usuarios.delete(id)
          },
        },
        rutinas: {
          listarRutinas: async () => [...rutinas.values()],
          obtenerRutinaPorId: async (id) => rutinas.get(id) ?? null,
          obtenerRutinaDetalle: async (id) => {
            const base = rutinas.get(id)
            if (!base) return null
            return {
              ...base,
              dias: [
                {
                  id: 'dia-doc-1',
                  rutina_id: base.id,
                  nombre_dia: 'Empuje NoSQL',
                  orden: 1,
                  notas: null,
                  ejercicios: [
                    {
                      id: 'eer-doc-1',
                      dia_id: 'dia-doc-1',
                      ejercicio_id: 'ej:press_banca',
                      ejercicio_nombre: 'Press de banca',
                      grupo_muscular_primario: 'pecho',
                      orden: 1,
                      series_objetivo: 3,
                      reps_objetivo_min: 8,
                      reps_objetivo_max: 10,
                      peso_objetivo: 60,
                      descanso_segundos: 120,
                    },
                  ],
                },
              ],
            }
          },
          crearRutina: async (nueva) => {
            const creada: Rutina = {
              id: 'rutina-doc-1',
              usuario_id: nueva.usuario_id,
              nombre: nueva.nombre,
              descripcion: nueva.descripcion,
              activa: 1,
              creado_en: '2026-11-03T10:00:00.000Z',
              actualizado_en: '2026-11-03T10:00:00.000Z',
              sincronizado: 0,
            }
            rutinas.set(creada.id, creada)
            return creada
          },
          actualizarRutina: async () => undefined,
          guardarRutina: async () => {
            throw new Error('no usado en este test')
          },
          activarRutina: async () => undefined,
          desactivarRutina: async () => undefined,
          eliminarRutina: async (id) => {
            rutinas.delete(id)
          },
        },
        sesiones: {
          listarSesionesPorUsuario: async () => [...sesiones.values()].map((s) => s.resumen),
          obtenerSesionDetalle: async (id) => {
            const guardada = sesiones.get(id)
            if (!guardada) return null
            return {
              ...guardada.resumen,
              registros: guardada.registros.map((r) => ({
                id: r.id,
                sesion_id: id,
                ejercicio_id: r.ejercicio_id,
                ejercicio_nombre: r.ejercicio_nombre,
                rpe_ejercicio: null,
                series: seriesPorRegistro.get(r.id) ?? [],
              })),
            }
          },
          crearSesion: async (nueva) => {
            const resumen: SesionResumen = {
              ...nueva.sesion,
              creado_en: '2026-11-03T10:00:00.000Z',
              actualizado_en: '2026-11-03T10:00:00.000Z',
              sincronizado: 0,
              rutina_nombre: 'Rutina Documental',
              nombre_dia: 'Empuje NoSQL',
            }
            for (const reg of nueva.registros) {
              seriesPorRegistro.set(reg.id, [])
            }
            sesiones.set(nueva.sesion.id, {
              resumen,
              registros: nueva.registros.map((r) => ({
                id: r.id,
                ejercicio_id: r.ejercicio_id,
                ejercicio_nombre: 'Press de banca',
              })),
            })
            return resumen
          },
          finalizarSesion: async (sesionId, datos) => {
            const actual = sesiones.get(sesionId)
            if (actual) {
              actual.resumen = {
                ...actual.resumen,
                duracion_minutos: datos?.duracion_minutos ?? null,
                notas: datos?.notas ?? null,
                rpe_sesion: datos?.rpe_sesion ?? null,
                actualizado_en: '2026-11-03T11:00:00.000Z',
              }
            }
            return { actualizado_en: '2026-11-03T11:00:00.000Z' }
          },
          agregarSerie: async (registroId, serie) => {
            const lista = seriesPorRegistro.get(registroId) ?? []
            const creada: SerieReal = {
              ...serie,
              id: `serie-doc-${lista.length + 1}`,
              registro_id: registroId,
            }
            seriesPorRegistro.set(registroId, [...lista, creada])
            return creada
          },
          actualizarSerie: async (serieId, cambios) => {
            for (const [regId, lista] of seriesPorRegistro.entries()) {
              const idx = lista.findIndex((s) => s.id === serieId)
              if (idx !== -1) {
                const actualizada: SerieReal = { ...lista[idx], ...cambios }
                const copia = [...lista]
                copia[idx] = actualizada
                seriesPorRegistro.set(regId, copia)
                return actualizada
              }
            }
            throw new Error(`Serie no encontrada: ${serieId}`)
          },
          eliminarSerie: async (serieId) => {
            for (const [regId, lista] of seriesPorRegistro.entries()) {
              if (lista.some((s) => s.id === serieId)) {
                const renumeradas = lista
                  .filter((s) => s.id !== serieId)
                  .map((s, i) => ({ ...s, numero_serie: i + 1 }))
                seriesPorRegistro.set(regId, renumeradas)
                return
              }
            }
            throw new Error(`Serie no encontrada: ${serieId}`)
          },
          reordenarSeries: async () => undefined,
          eliminarSesion: async (id) => {
            sesiones.delete(id)
          },
        },
        metricas: {
          guardarMetrica: async (m): Promise<MetricaProgreso> => ({
            ...m,
            creado_en: '2026-11-03T10:00:00.000Z',
            actualizado_en: '2026-11-03T10:00:00.000Z',
            sincronizado: 0,
          }),
          listarMetricasPorEjercicio: async () => [],
        },
      }

      await configurarProveedorPersistencia({
        adaptador: {
          nombre: 'memoria-documental',
          dialecto: 'generico',
          abrir: async () => conexionNoSQL,
          inicializarPersonalizado: async () => undefined,
        },
        crearRepositorios: () => reposNoSQL,
      })

      await asegurarBaseDatosLista()

      // Resetea estado previo de los stores
      useConfiguracionStore.setState({ usuarioActivo: null, cargando: false, error: null })
      useRutinasStore.setState({
        rutinas: [],
        rutinaSeleccionada: null,
        cargando: false,
        error: null,
      })
      useSesionStore.setState({
        sesionActual: null,
        sesiones: [],
        sesionesDetalle: [],
        detallesCompletos: [],
        detallesPorId: {},
        cargando: false,
        error: null,
      })

      // 1. Usuario
      await useConfiguracionStore.getState().asegurarUsuario()
      const usuario = useConfiguracionStore.getState().usuarioActivo!
      expect(usuario).toBeTruthy()

      // 2. Rutina
      const rutina = await useRutinasStore.getState().crearRutinaNueva({
        usuario_id: usuario.id,
        nombre: 'Rutina Documental',
        descripcion: 'Sin SQL',
        dias: [],
      })
      expect(rutina?.id).toBe('rutina-doc-1')
      await useRutinasStore.getState().seleccionarRutina('rutina-doc-1')

      // 3. Sesión + agregar, editar, eliminar y finalizar serie sin tocar SQL
      await useSesionStore.getState().iniciarSesion({
        rutinaId: 'rutina-doc-1',
        diaRutinaId: 'dia-doc-1',
        usuarioId: usuario.id,
      })
      const regId = useSesionStore.getState().sesionActual!.registros[0].registro_id
      await useSesionStore.getState().agregarSerie(regId, {
        numero_serie: 1,
        peso_levantado: 60,
        reps_realizadas: 10,
        rpe_serie: 8,
        rir: null,
        completada: 1,
        notas: null,
      })
      await useSesionStore.getState().agregarSerie(regId, {
        numero_serie: 2,
        peso_levantado: 65,
        reps_realizadas: 8,
        rpe_serie: 9,
        rir: null,
        completada: 1,
        notas: null,
      })

      const [primera, segunda] = useSesionStore.getState().sesionActual!.registros[0].series
      await useSesionStore
        .getState()
        .actualizarSerie(regId, segunda.id, { peso_levantado: 67.5, notas: 'PR' })
      await useSesionStore.getState().eliminarSerie(regId, primera.id)

      const seriesRestantes = useSesionStore.getState().sesionActual!.registros[0].series
      expect(seriesRestantes).toHaveLength(1)
      expect(seriesRestantes[0]).toMatchObject({
        numero_serie: 1,
        peso_levantado: 67.5,
        notas: 'PR',
      })

      await useSesionStore.getState().finalizarSesion({ duracion_minutos: 45, rpe_sesion: 8 })
      expect(useSesionStore.getState().error).toBeNull()
      expect(useSesionStore.getState().sesionActual).toBeNull()
      expect(useSesionStore.getState().sesiones[0].duracion_minutos).toBe(45)
    })
  })
})
