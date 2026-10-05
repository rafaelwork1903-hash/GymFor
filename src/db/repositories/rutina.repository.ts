/**
 * Repositorio de rutinas (y sus días y ejercicios). Único punto de acceso a
 * las tablas `rutinas`, `dias_rutina` y `ejercicios_en_rutina`.
 */

import type { SQLiteDatabase } from 'expo-sqlite'

import type { DiaRutina, EjercicioEnRutina, Rutina } from '../../domain/types'
import { ahoraISO, generarId } from '../../utils/id'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface RutinaFila {
  id: string
  usuario_id: string | null
  nombre: string
  descripcion: string
  activa: number
  creado_en: string
  actualizado_en: string
  sincronizado: number
}

export type EjercicioEnRutinaDetalle = EjercicioEnRutina & {
  ejercicio_nombre: string
  grupo_muscular_primario: string
}

export type DiaRutinaDetalle = DiaRutina & {
  ejercicios: EjercicioEnRutinaDetalle[]
}

export type RutinaDetalle = Rutina & {
  dias: DiaRutinaDetalle[]
}

export interface NuevoDiaRutina {
  nombre_dia: string
  notas?: string | null
  ejercicios: Omit<EjercicioEnRutina, 'id' | 'dia_id'>[]
}

export interface NuevaRutina {
  usuario_id: string | null
  nombre: string
  descripcion: string
  dias: NuevoDiaRutina[]
}

function aDominio(fila: RutinaFila): Rutina {
  return { ...fila, activa: fila.activa === 1 ? 1 : 0, sincronizado: fila.sincronizado === 1 ? 1 : 0 }
}

// ─── Consultas ────────────────────────────────────────────────────────────────

/** Rutinas del usuario y plantillas de sistema (usuario_id NULL). */
export async function listarRutinas(db: SQLiteDatabase, usuarioId?: string): Promise<Rutina[]> {
  const filas = usuarioId
    ? await db.getAllAsync<RutinaFila>(
        'SELECT * FROM rutinas WHERE usuario_id = ? OR usuario_id IS NULL ORDER BY nombre',
        [usuarioId],
      )
    : await db.getAllAsync<RutinaFila>('SELECT * FROM rutinas ORDER BY nombre')
  return filas.map(aDominio)
}

export async function obtenerRutinaPorId(
  db: SQLiteDatabase,
  id: string,
): Promise<Rutina | null> {
  const fila = await db.getFirstAsync<RutinaFila>('SELECT * FROM rutinas WHERE id = ?', [id])
  return fila ? aDominio(fila) : null
}

/** Rutina completa: días ordenados con sus ejercicios (join al catálogo). */
export async function obtenerRutinaDetalle(
  db: SQLiteDatabase,
  id: string,
): Promise<RutinaDetalle | null> {
  const rutina = await obtenerRutinaPorId(db, id)
  if (!rutina) {
    return null
  }

  const dias = await db.getAllAsync<DiaRutina>(
    'SELECT * FROM dias_rutina WHERE rutina_id = ? ORDER BY orden',
    [id],
  )

  const diasDetalle: DiaRutinaDetalle[] = []
  for (const dia of dias) {
    const ejercicios = await db.getAllAsync<EjercicioEnRutinaDetalle>(
      `SELECT eer.*, e.nombre AS ejercicio_nombre, e.grupo_muscular_primario
       FROM ejercicios_en_rutina eer
       JOIN ejercicios e ON e.id = eer.ejercicio_id
       WHERE eer.dia_id = ?
       ORDER BY eer.orden`,
      [dia.id],
    )
    diasDetalle.push({ ...dia, ejercicios })
  }

  return { ...rutina, dias: diasDetalle }
}

// ─── Mutaciones ───────────────────────────────────────────────────────────────

/** Crea una rutina completa (días + ejercicios) en una sola transacción. */
export async function crearRutina(db: SQLiteDatabase, rutina: NuevaRutina): Promise<Rutina> {
  const ahora = ahoraISO()
  const rutinaId = generarId()

  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync(
      `INSERT INTO rutinas (
        id, usuario_id, nombre, descripcion, activa, creado_en, actualizado_en, sincronizado
      ) VALUES (?, ?, ?, ?, 0, ?, ?, 0)`,
      [rutinaId, rutina.usuario_id, rutina.nombre, rutina.descripcion, ahora, ahora],
    )

    for (const [ordenDia, dia] of rutina.dias.entries()) {
      const diaId = generarId()
      await txn.runAsync(
        `INSERT INTO dias_rutina (id, rutina_id, nombre_dia, orden, notas)
         VALUES (?, ?, ?, ?, ?)`,
        [diaId, rutinaId, dia.nombre_dia, ordenDia + 1, dia.notas ?? null],
      )

      for (const [ordenEjercicio, ejercicio] of dia.ejercicios.entries()) {
        await txn.runAsync(
          `INSERT INTO ejercicios_en_rutina (
            id, dia_id, ejercicio_id, orden, series_objetivo,
            reps_objetivo_min, reps_objetivo_max, peso_objetivo, descanso_segundos
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            generarId(),
            diaId,
            ejercicio.ejercicio_id,
            ordenEjercicio + 1,
            ejercicio.series_objetivo,
            ejercicio.reps_objetivo_min,
            ejercicio.reps_objetivo_max,
            ejercicio.peso_objetivo,
            ejercicio.descanso_segundos,
          ],
        )
      }
    }
  })

  const creada = await obtenerRutinaPorId(db, rutinaId)
  if (!creada) {
    throw new Error('No se pudo recuperar la rutina recién creada')
  }
  return creada
}

export async function actualizarRutina(
  db: SQLiteDatabase,
  id: string,
  cambios: Partial<Pick<Rutina, 'nombre' | 'descripcion'>>,
): Promise<void> {
  const actual = await obtenerRutinaPorId(db, id)
  if (!actual) {
    throw new Error(`Rutina no encontrada: ${id}`)
  }
  await db.runAsync(
    `UPDATE rutinas SET nombre = ?, descripcion = ?, actualizado_en = ?, sincronizado = 0
     WHERE id = ?`,
    [cambios.nombre ?? actual.nombre, cambios.descripcion ?? actual.descripcion, ahoraISO(), id],
  )
}

/**
 * Marca una rutina como activa para el usuario y desactiva el resto.
 */
export async function activarRutina(
  db: SQLiteDatabase,
  rutinaId: string,
  usuarioId: string,
): Promise<void> {
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync(
      'UPDATE rutinas SET activa = 0, actualizado_en = ? WHERE usuario_id = ?',
      [ahoraISO(), usuarioId],
    )
    await txn.runAsync(
      'UPDATE rutinas SET activa = 1, actualizado_en = ?, sincronizado = 0 WHERE id = ?',
      [ahoraISO(), rutinaId],
    )
  })
}

export async function eliminarRutina(db: SQLiteDatabase, id: string): Promise<void> {
  // El borrado en cascada elimina días y ejercicios asociados.
  await db.runAsync('DELETE FROM rutinas WHERE id = ?', [id])
}
