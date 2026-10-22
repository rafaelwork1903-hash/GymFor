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
