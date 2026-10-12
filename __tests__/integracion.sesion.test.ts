import { DatabaseSync } from 'node:sqlite'

import type { SQLiteDatabase } from 'expo-sqlite'

import { ESQUEMA_VERSION_1 } from '../src/db/schema'
import { useSesionStore } from '../src/store/sesion.store'

/**
 * Tests de integración: store → repositorio → SQLite REAL.
 *
 * Se mockea SOLO la conexión (`src/db/client`); los repositorios y el store
 * ejecutan SQL de verdad sobre `node:sqlite` en memoria con el esquema real
 * (`ESQUEMA_VERSION_1`) y `PRAGMA foreign_keys = ON`. Así se validan los
 * FK, NOT NULL y CASCADE que los tests unitarios (con repos mockeados) no
 * detectan.
 */

jest.mock('../src/db/client', () => ({
  obtenerBD: jest.fn(),
}))

import { obtenerBD } from '../src/db/client'

/** Adaptador mínimo de `node:sqlite` a la interfaz que usan los repositorios. */
class AdaptadorSQLite {
  private readonly db: DatabaseSync

  constructor() {
    this.db = new DatabaseSync(':memory:')
    this.db.exec('PRAGMA foreign_keys = ON')
    this.db.exec(ESQUEMA_VERSION_1)
  }

  async runAsync(sql: string, params: unknown[] = []): Promise<unknown> {
    return this.db.prepare(sql).run(...(params as never[]))
  }

  async getAllAsync<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    return this.db.prepare(sql).all(...(params as never[])) as T[]
  }

  async getFirstAsync<T>(sql: string, params: unknown[] = []): Promise<T | null> {
    const fila = this.db.prepare(sql).get(...(params as never[]))
    return (fila as T) ?? null
  }

  private async transaccion(
    cb: (txn: { runAsync: AdaptadorSQLite['runAsync'] }) => Promise<void>,
  ): Promise<void> {
    this.db.exec('BEGIN')
    try {
      await cb({ runAsync: (sql: string, params: unknown[]) => this.runAsync(sql, params) })
      this.db.exec('COMMIT')
    } catch (error) {
      this.db.exec('ROLLBACK')
      throw error
    }
  }

  async withExclusiveTransactionAsync(
    cb: (txn: { runAsync: AdaptadorSQLite['runAsync'] }) => Promise<void>,
  ): Promise<void> {
    return this.transaccion(cb)
  }

  async withTransactionAsync(
    cb: (txn: { runAsync: AdaptadorSQLite['runAsync'] }) => Promise<void>,
  ): Promise<void> {
    return this.transaccion(cb)
  }

  /** Consulta directa para aserciones sobre el estado real de la BD. */
  leer<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
    return this.db.prepare(sql).all(...(params as never[])) as T[]
  }
}

/** Datos mínimos coherentes con el esquema: usuario, rutina, día y ejercicio. */
async function sembrarFixture(adaptador: AdaptadorSQLite): Promise<void> {
  const ahora = '2026-10-09T10:00:00.000Z'
  await adaptador.runAsync(
    `INSERT INTO usuarios (id, nombre, configuracion_entrenamiento, creado_en, actualizado_en)
     VALUES ('u1', 'Atleta', '{}', ?, ?)`,
    [ahora, ahora],
  )
  await adaptador.runAsync(
    `INSERT INTO ejercicios (id, nombre, grupo_muscular_primario, grupos_musculares_secundarios,
       equipamiento, es_compuesto, factor_fraccional)
     VALUES ('ej:press', 'Press de banca con mancuernas', 'pecho', '[]', 'mancuernas', 1, 1.0)`,
  )
  await adaptador.runAsync(
    `INSERT INTO rutinas (id, usuario_id, nombre, descripcion, activa, creado_en, actualizado_en)
     VALUES ('r1', 'u1', 'Rutina Test', 'descripción', 1, ?, ?)`,
    [ahora, ahora],
  )
  await adaptador.runAsync(
    `INSERT INTO dias_rutina (id, rutina_id, nombre_dia, orden)
     VALUES ('d1', 'r1', 'Día 1', 1)`,
  )
  await adaptador.runAsync(
    `INSERT INTO ejercicios_en_rutina (id, dia_id, ejercicio_id, orden, series_objetivo,
       reps_objetivo_min, reps_objetivo_max)
     VALUES ('eer1', 'd1', 'ej:press', 1, 3, 8, 12)`,
  )
}

function nuevaSerie(numero: number) {
  return {
    numero_serie: numero,
    peso_levantado: 60,
    reps_realizadas: 10,
    rpe_serie: 8,
    rir: null,
    completada: 1 as const,
    notas: null,
  }
}

describe('integración sesion.store ↔ sesion.repository ↔ SQLite', () => {
  let adaptador: AdaptadorSQLite

  beforeEach(async () => {
    adaptador = new AdaptadorSQLite()
    await sembrarFixture(adaptador)
    ;(obtenerBD as jest.Mock).mockResolvedValue(adaptador as unknown as SQLiteDatabase)
    useSesionStore.setState({
      sesionActual: null,
      sesiones: [],
      sesionesDetalle: [],
      cargando: false,
      error: null,
    })
  })

  it('iniciarSesion: los registro_id del store son los que existen en BD; agregarSerie persiste contra ellos', async () => {
    await useSesionStore.getState().iniciarSesion({ rutinaId: 'r1', diaRutinaId: 'd1', usuarioId: 'u1' })

    const estado = useSesionStore.getState()
    expect(estado.error).toBeNull()
    expect(estado.sesionActual).not.toBeNull()
    expect(estado.sesionActual?.registros).toHaveLength(1)

    const registroId = estado.sesionActual?.registros[0].registro_id
    expect(registroId).toBeTruthy()

    // El registro en BD usa EXACTAMENTE el id que expone la sesión en curso
    // (regresión del bug donde el repositorio generaba ids propios).
    const registrosBD = adaptador.leer<{ id: string; sesion_id: string }>(
      'SELECT id, sesion_id FROM registros_ejercicio',
    )
    expect(registrosBD).toHaveLength(1)
    expect(registrosBD[0].id).toBe(registroId)

    // agregarSerie inserta contra ese id: la FK es válida y no falla.
    await useSesionStore.getState().agregarSerie(registroId!, nuevaSerie(1))
    const estadoTrasSerie = useSesionStore.getState()
    expect(estadoTrasSerie.error).toBeNull()
    expect(estadoTrasSerie.sesionActual?.registros[0].series).toHaveLength(1)

    const seriesBD = adaptador.leer<{ registro_id: string; peso_levantado: number }>(
      'SELECT registro_id, peso_levantado FROM series',
    )
    expect(seriesBD).toHaveLength(1)
    expect(seriesBD[0].registro_id).toBe(registroId)
  })

  it('iniciarSesion con usuario_id vacío falla por la FK y no deja sesión en BD (NOT NULL/FK)', async () => {
    await useSesionStore
      .getState()
      .iniciarSesion({ rutinaId: 'r1', diaRutinaId: 'd1', usuarioId: '' })

    const estado = useSesionStore.getState()
    expect(estado.sesionActual).toBeNull()
    // El mensaje real de SQLite llega al estado (regresión del guard de UI).
    expect(estado.error).toMatch(/FOREIGN KEY/i)
    // La transacción se revierte: no queda ni la sesión ni sus registros.
    expect(adaptador.leer('SELECT * FROM sesiones')).toHaveLength(0)
    expect(adaptador.leer('SELECT * FROM registros_ejercicio')).toHaveLength(0)
  })

  it('finalizarSesion persiste notas/RPE en BD y antepone el resumen con nombres de rutina y día', async () => {
    const { iniciarSesion, agregarSerie, finalizarSesion } = useSesionStore.getState()
    await iniciarSesion({ rutinaId: 'r1', diaRutinaId: 'd1', usuarioId: 'u1' })
    const registroId = useSesionStore.getState().sesionActual?.registros[0].registro_id!
    await agregarSerie(registroId, nuevaSerie(1))

    await finalizarSesion({ duracion_minutos: undefined, notas: 'muy buena', rpe_sesion: 8 })

    const estado = useSesionStore.getState()
    expect(estado.sesionActual).toBeNull()
    expect(estado.sesiones).toHaveLength(1)
    expect(estado.sesiones[0].rutina_nombre).toBe('Rutina Test')
    expect(estado.sesiones[0].nombre_dia).toBe('Día 1')
    expect(estado.sesiones[0].notas).toBe('muy buena')

    const sesionBD = adaptador.leer<{ notas: string; rpe_sesion: number }>(
      'SELECT notas, rpe_sesion FROM sesiones',
    )
    expect(sesionBD).toHaveLength(1)
    expect(sesionBD[0].notas).toBe('muy buena')
    expect(sesionBD[0].rpe_sesion).toBe(8)
  })

  it('descartarSesion elimina la sesión de BD y el CASCADE borra registros y series', async () => {
    const { iniciarSesion, agregarSerie, descartarSesion } = useSesionStore.getState()
    await iniciarSesion({ rutinaId: 'r1', diaRutinaId: 'd1', usuarioId: 'u1' })
    const sesionId = useSesionStore.getState().sesionActual?.sesion.id!
    const registroId = useSesionStore.getState().sesionActual?.registros[0].registro_id!
    await agregarSerie(registroId, nuevaSerie(1))

    await descartarSesion()

    const estado = useSesionStore.getState()
    expect(estado.error).toBeNull()
    expect(estado.sesionActual).toBeNull()
    expect(adaptador.leer('SELECT * FROM sesiones WHERE id = ?', [sesionId])).toHaveLength(0)
    expect(adaptador.leer('SELECT * FROM registros_ejercicio')).toHaveLength(0)
    expect(adaptador.leer('SELECT * FROM series')).toHaveLength(0)
  })
})
