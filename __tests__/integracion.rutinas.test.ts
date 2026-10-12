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
