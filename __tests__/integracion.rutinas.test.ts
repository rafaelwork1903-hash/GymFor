import type { SQLiteDatabase } from 'expo-sqlite'

import { repararRutinasActivasMultiples } from '../src/db/migrations'
import { useRutinasStore } from '../src/store/rutinas.store'

/**
 * Tests de integración real de la activación/desactivación de rutinas:
 * store → repositorio → SQLite REAL (`node:sqlite`, esquema real, FKs ON).
 *
 * Cubren la invariante "a lo sumo una rutina activa", incluido el caso del
 * bug reportado: una plantilla activa y luego una rutina propia activa (el
 * repositorio viejo solo desactivaba las del usuario → quedaban DOS).
 *
 * También la creación completa de rutinas (días + ejercicios del catálogo,
 * issue #23): lo que la app guarda se lee igual desde la BD real.
 *
 * Solo se mockea la conexión (`src/db/client`).
 */

jest.mock('../src/db/client', () => ({
  obtenerBD: jest.fn(),
}))

import { obtenerBD } from '../src/db/client'
import { AdaptadorSQLite, comoBD } from './helpers/sqlite-adapter'

const AHORA = '2026-10-12T10:00:00.000Z'

/** Usuario + una plantilla (usuario NULL) + una rutina propia. */
async function sembrarRutinas(adaptador: AdaptadorSQLite): Promise<void> {
  await adaptador.runAsync(
    `INSERT INTO usuarios (id, nombre, configuracion_entrenamiento, creado_en, actualizado_en)
     VALUES ('u1', 'Atleta', '{}', ?, ?)`,
    [AHORA, AHORA],
  )
  await adaptador.runAsync(
    `INSERT INTO rutinas (id, usuario_id, nombre, descripcion, activa, creado_en, actualizado_en)
     VALUES ('rutina:plantilla', NULL, 'Plantilla', 'plantilla del sistema', 0, ?, ?)`,
    [AHORA, AHORA],
  )
  await adaptador.runAsync(
    `INSERT INTO rutinas (id, usuario_id, nombre, descripcion, activa, creado_en, actualizado_en)
     VALUES ('r1', 'u1', 'Rutina propia', 'del usuario', 0, ?, ?)`,
    [AHORA, AHORA],
  )
}

/** Nº de rutinas con activa=1 en la BD real. */
function activasEnBD(adaptador: AdaptadorSQLite): number {
  return adaptador.leer<{ id: string }>('SELECT id FROM rutinas WHERE activa = 1').length
}

describe('integración rutinas: invariante de una sola rutina activa', () => {
  let adaptador: AdaptadorSQLite

  beforeEach(async () => {
    adaptador = new AdaptadorSQLite()
    await sembrarRutinas(adaptador)
    ;(obtenerBD as jest.Mock).mockResolvedValue(comoBD(adaptador) as SQLiteDatabase)
    useRutinasStore.setState({
      rutinas: [],
      rutinaSeleccionada: null,
      cargando: false,
      error: null,
    })
  })

  it('activar una plantilla y luego otra rutina deja EXACTAMENTE una activa en BD y en el store', async () => {
    const store = useRutinasStore.getState()
    await store.cargarRutinas('u1')
    expect(useRutinasStore.getState().rutinas).toHaveLength(2)

    // Activa la plantilla (usuario NULL)
    const activarUna = async (id: string) => {
      await useRutinasStore.getState().seleccionarRutina(id)
      await useRutinasStore.getState().activarRutinaSeleccionada('u1')
      expect(useRutinasStore.getState().error).toBeNull()
    }

    await activarUna('rutina:plantilla')
    expect(activasEnBD(adaptador)).toBe(1)

    // Activa la rutina propia: la plantilla debe dejar de estar activa en BD.
    await activarUna('r1')
    expect(activasEnBD(adaptador)).toBe(1)

    const activaBD = adaptador.leer<{ id: string }>('SELECT id FROM rutinas WHERE activa = 1')
    expect(activaBD[0].id).toBe('r1')

    // El store también refleja una única activa.
    const activasStore = useRutinasStore.getState().rutinas.filter((r) => r.activa === 1)
    expect(activasStore).toHaveLength(1)
    expect(activasStore[0].id).toBe('r1')
  })

  it('desactivarRutinaPorId deja cero rutinas activas en BD y en el store', async () => {
    const store = useRutinasStore.getState()
    await store.cargarRutinas('u1')
    await useRutinasStore.getState().seleccionarRutina('r1')
    await useRutinasStore.getState().activarRutinaSeleccionada('u1')
    expect(activasEnBD(adaptador)).toBe(1)

    await useRutinasStore.getState().desactivarRutinaPorId('r1')

    const estado = useRutinasStore.getState()
    expect(estado.error).toBeNull()
    expect(estado.rutinas.every((r) => r.activa === 0)).toBe(true)
    // La rutina sigue siendo la seleccionada, solo que ya no activa.
    expect(estado.rutinaSeleccionada?.id).toBe('r1')
    expect(activasEnBD(adaptador)).toBe(0)
  })

  it('repararRutinasActivasMultiples (arranque) deja una sola activa en una BD ya dañada', async () => {
    // Simula una BD rot por el bug antiguo: DOS rutinas activas.
    await adaptador.runAsync(
      `UPDATE rutinas SET activa = 1, actualizado_en = ? WHERE id = 'rutina:plantilla'`,
      ['2026-10-11T10:00:00.000Z'], // plantilla MÁS antigua actualizada
    )
    await adaptador.runAsync(`UPDATE rutinas SET activa = 1 WHERE id = 'r1'`, [])
    expect(activasEnBD(adaptador)).toBe(2)

    await repararRutinasActivasMultiples(comoBD(adaptador))

    expect(activasEnBD(adaptador)).toBe(1)
    // Se conserva la más recientemente actualizada (r1, con AHORA).
    const activa = adaptador.leer<{ id: string }>('SELECT id FROM rutinas WHERE activa = 1')
    expect(activa[0].id).toBe('r1')
  })
})

describe('integración rutinas: creación completa con días y ejercicios (issue #23)', () => {
  let adaptador: AdaptadorSQLite

  /** Catálogo mínimo: los ejercicios_en_rutina tienen FK al catálogo. */
  async function sembrarCatalogo(adaptadorLocal: AdaptadorSQLite): Promise<void> {
    for (const id of ['ej:press_banca', 'ej:press_hombros', 'ej:jalon_pecho']) {
      await adaptadorLocal.runAsync(
        `INSERT INTO ejercicios (
          id, nombre, grupo_muscular_primario, grupos_musculares_secundarios,
          equipamiento, es_compuesto, factor_fraccional, instrucciones, video_url
        ) VALUES (?, ?, 'pecho', '[]', 'mancuernas', 1, 1.0, NULL, NULL)`,
        [id, id],
      )
    }
  }

  beforeEach(async () => {
    adaptador = new AdaptadorSQLite()
    await adaptador.runAsync(
      `INSERT INTO usuarios (id, nombre, configuracion_entrenamiento, creado_en, actualizado_en)
       VALUES ('u1', 'Atleta', '{}', ?, ?)`,
      [AHORA, AHORA],
    )
    await sembrarCatalogo(adaptador)
    ;(obtenerBD as jest.Mock).mockResolvedValue(comoBD(adaptador) as SQLiteDatabase)
    useRutinasStore.setState({
      rutinas: [],
      rutinaSeleccionada: null,
      cargando: false,
      error: null,
    })
  })

  it('crearRutinaNueva persiste los días y sus ejercicios en SQLite con sus objetivos', async () => {
    const creada = await useRutinasStore.getState().crearRutinaNueva({
      usuario_id: 'u1',
      nombre: 'Push Pull Legs',
      descripcion: 'Mía, 2 días',
      dias: [
        {
          nombre_dia: 'Empuje',
          notas: 'Pecho + hombros',
          ejercicios: [
            {
              ejercicio_id: 'ej:press_banca',
              orden: 1,
              series_objetivo: 3,
              reps_objetivo_min: 8,
              reps_objetivo_max: 12,
              peso_objetivo: null,
              descanso_segundos: 90,
            },
            {
              ejercicio_id: 'ej:press_hombros',
              orden: 2,
              series_objetivo: 4,
              reps_objetivo_min: 10,
              reps_objetivo_max: 12,
              peso_objetivo: 12.5,
              descanso_segundos: null,
            },
          ],
        },
        {
          nombre_dia: 'Tracción',
          notas: null,
          ejercicios: [
            {
              ejercicio_id: 'ej:jalon_pecho',
              orden: 1,
              series_objetivo: 3,
              reps_objetivo_min: 8,
              reps_objetivo_max: 12,
              peso_objetivo: 40,
              descanso_segundos: 90,
            },
          ],
        },
      ],
    })

    const estado = useRutinasStore.getState()
    expect(estado.error).toBeNull()
    expect(creada).toBeDefined()
    // La rutina creada aparece en el listado del store (pestaña Rutinas).
    expect(estado.rutinas.some((r) => r.id === creada!.id)).toBe(true)

    // Días reales en BD: orden, nombre y notas correctos.
    const diasBD = adaptador.leer<{ id: string; nombre_dia: string; orden: number; notas: string | null }>(
      'SELECT id, nombre_dia, orden, notas FROM dias_rutina WHERE rutina_id = ? ORDER BY orden',
      [creada!.id],
    )
    expect(diasBD).toHaveLength(2)
    expect(diasBD[0].nombre_dia).toBe('Empuje')
    expect(diasBD[0].orden).toBe(1)
    expect(diasBD[0].notas).toBe('Pecho + hombros')
    expect(diasBD[1].nombre_dia).toBe('Tracción')
    expect(diasBD[1].orden).toBe(2)
    expect(diasBD[1].notas).toBeNull()

    // Ejercicios reales en BD: FKs, orden y objetivos exactos.
    const ejerciciosBD = adaptador.leer<{
      dia_id: string
      ejercicio_id: string
      orden: number
      series_objetivo: number
      reps_objetivo_min: number
      reps_objetivo_max: number
      peso_objetivo: number | null
      descanso_segundos: number | null
    }>(
      `SELECT eer.dia_id, eer.ejercicio_id, eer.orden, eer.series_objetivo,
              eer.reps_objetivo_min, eer.reps_objetivo_max, eer.peso_objetivo, eer.descanso_segundos
       FROM ejercicios_en_rutina eer
       JOIN dias_rutina d ON d.id = eer.dia_id
       WHERE d.rutina_id = ?
       ORDER BY d.orden, eer.orden`,
      [creada!.id],
    )
    expect(ejerciciosBD).toHaveLength(3)
    expect(ejerciciosBD[0]).toMatchObject({
      ejercicio_id: 'ej:press_banca',
      orden: 1,
      series_objetivo: 3,
      reps_objetivo_min: 8,
      reps_objetivo_max: 12,
      peso_objetivo: null,
      descanso_segundos: 90,
    })
    expect(ejerciciosBD[1]).toMatchObject({
      ejercicio_id: 'ej:press_hombros',
      orden: 2,
      series_objetivo: 4,
      reps_objetivo_min: 10,
      reps_objetivo_max: 12,
      peso_objetivo: 12.5,
      descanso_segundos: null,
    })
    expect(ejerciciosBD[2]).toMatchObject({
      ejercicio_id: 'ej:jalon_pecho',
      orden: 1,
      series_objetivo: 3,
      peso_objetivo: 40,
      descanso_segundos: 90,
    })
  })

  it('la rutina creada se relee completa con seleccionarRutina (días + ejercicios, lo que consume Sesión)', async () => {
    const creada = await useRutinasStore.getState().crearRutinaNueva({
      usuario_id: 'u1',
      nombre: 'Full body',
      descripcion: '',
      dias: [
        {
          nombre_dia: 'Cuerpo completo A',
          notas: null,
          ejercicios: [
            {
              ejercicio_id: 'ej:press_banca',
              orden: 1,
              series_objetivo: 3,
              reps_objetivo_min: 8,
              reps_objetivo_max: 10,
              peso_objetivo: 30,
              descanso_segundos: 120,
            },
          ],
        },
      ],
    })
    expect(creada).toBeDefined()

    await useRutinasStore.getState().seleccionarRutina(creada!.id)

    const detalle = useRutinasStore.getState().rutinaSeleccionada
    expect(detalle).not.toBeNull()
    expect(detalle!.nombre).toBe('Full body')
    expect(detalle!.usuario_id).toBe('u1')
    expect(detalle!.dias).toHaveLength(1)
    expect(detalle!.dias[0].nombre_dia).toBe('Cuerpo completo A')
    expect(detalle!.dias[0].ejercicios).toHaveLength(1)
    // El JOIN resuelve el nombre del ejercicio del catálogo.
    expect(detalle!.dias[0].ejercicios[0]).toMatchObject({
      ejercicio_id: 'ej:press_banca',
      ejercicio_nombre: 'ej:press_banca',
      series_objetivo: 3,
      reps_objetivo_min: 8,
      reps_objetivo_max: 10,
      peso_objetivo: 30,
      descanso_segundos: 120,
    })
  })

  it('crearRutinaNueva rechaza por FK si el ejercicio no está en el catálogo (sin filas huérfanas)', async () => {
    const creada = await useRutinasStore.getState().crearRutinaNueva({
      usuario_id: 'u1',
      nombre: 'Rutina rota',
      descripcion: '',
      dias: [
        {
          nombre_dia: 'Día fantasma',
          notas: null,
          ejercicios: [
            {
              ejercicio_id: 'ej:inexistente',
              orden: 1,
              series_objetivo: 3,
              reps_objetivo_min: 8,
              reps_objetivo_max: 12,
              peso_objetivo: null,
              descanso_segundos: 90,
            },
          ],
        },
      ],
    })

    expect(creada).toBeUndefined()
    expect(useRutinasStore.getState().error).toContain('FOREIGN KEY')
    // La transacción hace rollback: ni rutina, ni días, ni ejercicios.
    expect(adaptador.leer('SELECT id FROM rutinas WHERE nombre = ?', ['Rutina rota'])).toHaveLength(0)
    expect(adaptador.leer('SELECT id FROM dias_rutina')).toHaveLength(0)
    expect(adaptador.leer('SELECT id FROM ejercicios_en_rutina')).toHaveLength(0)
  })
})

describe('integración rutinas: edición de rutina existente (issue #25)', () => {
  let adaptador: AdaptadorSQLite

  async function sembrarCatalogo(adaptadorLocal: AdaptadorSQLite): Promise<void> {
    for (const id of ['ej:press_banca', 'ej:press_hombros', 'ej:jalon_pecho', 'ej:sentadilla']) {
      await adaptadorLocal.runAsync(
        `INSERT INTO ejercicios (
          id, nombre, grupo_muscular_primario, grupos_musculares_secundarios,
          equipamiento, es_compuesto, factor_fraccional, instrucciones, video_url
        ) VALUES (?, ?, 'pecho', '[]', 'mancuernas', 1, 1.0, NULL, NULL)`,
        [id, id],
      )
    }
  }

  beforeEach(async () => {
    adaptador = new AdaptadorSQLite()
    await adaptador.runAsync(
      `INSERT INTO usuarios (id, nombre, configuracion_entrenamiento, creado_en, actualizado_en)
       VALUES ('u1', 'Atleta', '{}', ?, ?)`,
      [AHORA, AHORA],
    )
    await sembrarCatalogo(adaptador)
    ;(obtenerBD as jest.Mock).mockResolvedValue(comoBD(adaptador) as SQLiteDatabase)
    useRutinasStore.setState({
      rutinas: [],
      rutinaSeleccionada: null,
      cargando: false,
      error: null,
    })
  })

  it('persistencia de nombre, descripción, días y ejercicios modificados y agregados', async () => {
    // 1. Crear rutina inicial con 2 días
    const inicial = await useRutinasStore.getState().crearRutinaNueva({
      usuario_id: 'u1',
      nombre: 'Rutina Base',
      descripcion: 'Original',
      dias: [
        {
          nombre_dia: 'Empuje',
          notas: 'Nota 1',
          ejercicios: [
            {
              ejercicio_id: 'ej:press_banca',
              orden: 1,
              series_objetivo: 3,
              reps_objetivo_min: 8,
              reps_objetivo_max: 12,
              peso_objetivo: 50,
              descanso_segundos: 90,
            },
          ],
        },
        {
          nombre_dia: 'Tracción',
          notas: null,
          ejercicios: [
            {
              ejercicio_id: 'ej:jalon_pecho',
              orden: 1,
              series_objetivo: 3,
              reps_objetivo_min: 10,
              reps_objetivo_max: 12,
              peso_objetivo: 40,
              descanso_segundos: 60,
            },
          ],
        },
      ],
    })

    expect(inicial).toBeDefined()
    const rutinaId = inicial!.id

    await useRutinasStore.getState().seleccionarRutina(rutinaId)
    const detalleOriginal = useRutinasStore.getState().rutinaSeleccionada!
    const dia1 = detalleOriginal.dias[0]
    const dia2 = detalleOriginal.dias[1]
    const ej1 = dia1.ejercicios[0]

    // 2. Modificar la rutina existente:
    // - Renombrar rutina y descripción
    // - En Día 1: modificar objetivos de ej1 y añadir nuevo ejercicio (ej:press_hombros)
    // - Añadir Día 3: "Pierna" con ej:sentadilla
    const resultado = await useRutinasStore.getState().guardarRutinaExistente(rutinaId, {
      nombre: 'Torso / Pierna',
      descripcion: 'Frecuencia 2',
      dias: [
        {
          id: dia1.id,
          nombre_dia: 'Empuje Potente',
          orden: 1,
          notas: 'Nueva nota',
          ejercicios: [
            {
              id: ej1.id,
              ejercicio_id: 'ej:press_banca',
              orden: 1,
              series_objetivo: 4,
              reps_objetivo_min: 6,
              reps_objetivo_max: 8,
              peso_objetivo: 60,
              descanso_segundos: 120,
            },
            {
              // Nuevo ejercicio en el día existente
              ejercicio_id: 'ej:press_hombros',
              orden: 2,
              series_objetivo: 3,
              reps_objetivo_min: 8,
              reps_objetivo_max: 10,
              peso_objetivo: 20,
              descanso_segundos: 90,
            },
          ],
        },
        {
          id: dia2.id,
          nombre_dia: dia2.nombre_dia,
          orden: 2,
          notas: null,
          ejercicios: dia2.ejercicios.map((e) => ({
            id: e.id,
            ejercicio_id: e.ejercicio_id,
            orden: e.orden,
            series_objetivo: e.series_objetivo,
            reps_objetivo_min: e.reps_objetivo_min,
            reps_objetivo_max: e.reps_objetivo_max,
            peso_objetivo: e.peso_objetivo,
            descanso_segundos: e.descanso_segundos,
          })),
        },
        {
          // Nuevo día en la rutina
          nombre_dia: 'Pierna',
          orden: 3,
          notas: null,
          ejercicios: [
            {
              ejercicio_id: 'ej:sentadilla',
              orden: 1,
              series_objetivo: 4,
              reps_objetivo_min: 6,
              reps_objetivo_max: 8,
              peso_objetivo: 80,
              descanso_segundos: 180,
            },
          ],
        },
      ],
    })

    expect(resultado).toBeDefined()
    expect(useRutinasStore.getState().error).toBeNull()

    // 3. Verificar persistencia directa en SQLite
    const rutinasBD = adaptador.leer<{ nombre: string; descripcion: string }>(
      'SELECT nombre, descripcion FROM rutinas WHERE id = ?',
      [rutinaId],
    )
    expect(rutinasBD[0]).toEqual({ nombre: 'Torso / Pierna', descripcion: 'Frecuencia 2' })

    const diasBD = adaptador.leer<{ id: string; nombre_dia: string; orden: number }>(
      'SELECT id, nombre_dia, orden FROM dias_rutina WHERE rutina_id = ? ORDER BY orden',
      [rutinaId],
    )
    expect(diasBD).toHaveLength(3)
    expect(diasBD[0].nombre_dia).toBe('Empuje Potente')
    expect(diasBD[0].id).toBe(dia1.id)
    expect(diasBD[1].nombre_dia).toBe('Tracción')
    expect(diasBD[1].id).toBe(dia2.id)
    expect(diasBD[2].nombre_dia).toBe('Pierna')

    const ejsDia1 = adaptador.leer<{
      id: string
      ejercicio_id: string
      series_objetivo: number
      peso_objetivo: number
    }>(
      'SELECT id, ejercicio_id, series_objetivo, peso_objetivo FROM ejercicios_en_rutina WHERE dia_id = ? ORDER BY orden',
      [dia1.id],
    )
    expect(ejsDia1).toHaveLength(2)
    expect(ejsDia1[0]).toMatchObject({
      id: ej1.id,
      ejercicio_id: 'ej:press_banca',
      series_objetivo: 4,
      peso_objetivo: 60,
    })
    expect(ejsDia1[1].ejercicio_id).toBe('ej:press_hombros')
  })

  it('borrado de días y ejercicios no usados', async () => {
    // 1. Crear rutina con 2 días y 2 ejercicios en el día 1
    const inicial = await useRutinasStore.getState().crearRutinaNueva({
      usuario_id: 'u1',
      nombre: 'Rutina Completa',
      descripcion: '',
      dias: [
        {
          nombre_dia: 'Día 1',
          notas: null,
          ejercicios: [
            {
              ejercicio_id: 'ej:press_banca',
              orden: 1,
              series_objetivo: 3,
              reps_objetivo_min: 8,
              reps_objetivo_max: 12,
              peso_objetivo: 50,
              descanso_segundos: 90,
            },
            {
              ejercicio_id: 'ej:press_hombros',
              orden: 2,
              series_objetivo: 3,
              reps_objetivo_min: 8,
              reps_objetivo_max: 12,
              peso_objetivo: 20,
              descanso_segundos: 90,
            },
          ],
        },
        {
          nombre_dia: 'Día 2',
          notas: null,
          ejercicios: [
            {
              ejercicio_id: 'ej:sentadilla',
              orden: 1,
              series_objetivo: 3,
              reps_objetivo_min: 8,
              reps_objetivo_max: 12,
              peso_objetivo: 70,
              descanso_segundos: 120,
            },
          ],
        },
      ],
    })

    const rutinaId = inicial!.id
    await useRutinasStore.getState().seleccionarRutina(rutinaId)
    const detalleOriginal = useRutinasStore.getState().rutinaSeleccionada!
    const dia1 = detalleOriginal.dias[0]
    const dia2 = detalleOriginal.dias[1]
    const ej1 = dia1.ejercicios[0]

    expect(adaptador.leer('SELECT id FROM dias_rutina WHERE rutina_id = ?', [rutinaId])).toHaveLength(2)
    expect(adaptador.leer('SELECT id FROM ejercicios_en_rutina')).toHaveLength(3)

    // 2. Guardar omitiendo el Día 2 y omitiendo el segundo ejercicio del Día 1
    const guardada = await useRutinasStore.getState().guardarRutinaExistente(rutinaId, {
      nombre: 'Rutina Reducida',
      descripcion: '',
      dias: [
        {
          id: dia1.id,
          nombre_dia: dia1.nombre_dia,
          orden: 1,
          notas: null,
          ejercicios: [
            {
              id: ej1.id,
              ejercicio_id: ej1.ejercicio_id,
              orden: 1,
              series_objetivo: ej1.series_objetivo,
              reps_objetivo_min: ej1.reps_objetivo_min,
              reps_objetivo_max: ej1.reps_objetivo_max,
              peso_objetivo: ej1.peso_objetivo,
              descanso_segundos: ej1.descanso_segundos,
            },
          ],
        },
      ],
    })

    expect(guardada).toBeDefined()

    // 3. Verificar en BD: Día 2 borrado, y el ejercicio 2 del Día 1 borrado
    const diasRestantes = adaptador.leer<{ id: string }>('SELECT id FROM dias_rutina WHERE rutina_id = ?', [rutinaId])
    expect(diasRestantes).toHaveLength(1)
    expect(diasRestantes[0].id).toBe(dia1.id)

    // El día 2 ya no existe en la BD
    expect(adaptador.leer('SELECT id FROM dias_rutina WHERE id = ?', [dia2.id])).toHaveLength(0)

    // Solo queda 1 ejercicio en toda la BD
    const ejsRestantes = adaptador.leer<{ id: string }>('SELECT id FROM ejercicios_en_rutina')
    expect(ejsRestantes).toHaveLength(1)
    expect(ejsRestantes[0].id).toBe(ej1.id)
  })

  it('bloqueo de borrado de un día con sesiones registradas', async () => {
    // 1. Crear rutina con 2 días
    const inicial = await useRutinasStore.getState().crearRutinaNueva({
      usuario_id: 'u1',
      nombre: 'Rutina con Historial',
      descripcion: '',
      dias: [
        {
          nombre_dia: 'Día A',
          notas: null,
          ejercicios: [
            {
              ejercicio_id: 'ej:press_banca',
              orden: 1,
              series_objetivo: 3,
              reps_objetivo_min: 10,
              reps_objetivo_max: 10,
              peso_objetivo: 40,
              descanso_segundos: 60,
            },
          ],
        },
        {
          nombre_dia: 'Día B',
          notas: null,
          ejercicios: [
            {
              ejercicio_id: 'ej:sentadilla',
              orden: 1,
              series_objetivo: 3,
              reps_objetivo_min: 10,
              reps_objetivo_max: 10,
              peso_objetivo: 60,
              descanso_segundos: 90,
            },
          ],
        },
      ],
    })

    const rutinaId = inicial!.id
    await useRutinasStore.getState().seleccionarRutina(rutinaId)
    const detalleOriginal = useRutinasStore.getState().rutinaSeleccionada!
    const diaA = detalleOriginal.dias[0]
    const diaB = detalleOriginal.dias[1]

    // 2. Insertar una sesión de entrenamiento que referencia el Día B
    await adaptador.runAsync(
      `INSERT INTO sesiones (id, usuario_id, dia_rutina_id, fecha, duracion_minutos, notas, rpe_sesion, creado_en, actualizado_en, sincronizado)
       VALUES ('sesion-1', 'u1', ?, '2026-10-27', 45, 'Buena sesión', 8, ?, ?, 0)`,
      [diaB.id, AHORA, AHORA],
    )

    // 3. Intentar guardar la rutina borrando el Día B (solo enviamos Día A)
    const intento = await useRutinasStore.getState().guardarRutinaExistente(rutinaId, {
      nombre: 'Rutina Intentando Borrar Día Con Sesión',
      descripcion: '',
      dias: [
        {
          id: diaA.id,
          nombre_dia: diaA.nombre_dia,
          orden: 1,
          notas: null,
          ejercicios: [
            {
              id: diaA.ejercicios[0].id,
              ejercicio_id: diaA.ejercicios[0].ejercicio_id,
              orden: 1,
              series_objetivo: 3,
              reps_objetivo_min: 10,
              reps_objetivo_max: 10,
              peso_objetivo: 40,
              descanso_segundos: 60,
            },
          ],
        },
      ],
    })

    // Debe ser rechazado
    expect(intento).toBeUndefined()
    expect(useRutinasStore.getState().error).toBe(
      `No se puede eliminar el día "Día B" porque tiene sesiones registradas.`,
    )

    // 4. En la base de datos nada debe haberse alterado: el Día B sigue intacto
    const diasEnBD = adaptador.leer<{ id: string }>('SELECT id FROM dias_rutina WHERE rutina_id = ?', [rutinaId])
    expect(diasEnBD).toHaveLength(2)
    expect(adaptador.leer('SELECT id FROM dias_rutina WHERE id = ?', [diaB.id])).toHaveLength(1)
    expect(adaptador.leer('SELECT id FROM sesiones WHERE id = ?', ['sesion-1'])).toHaveLength(1)
  })
})
