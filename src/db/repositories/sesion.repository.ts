/**
 * Repositorio de sesiones de entrenamiento. Único punto de acceso a las
 * tablas `sesiones`, `registros_ejercicio` y `series`.
 */

import type { SQLiteDatabase } from 'expo-sqlite'

import type { RegistroEjercicio, SerieReal, SesionEntrenamiento, SesionResumen } from '../../domain/types'
import { ahoraISO, generarId } from '../../utils/id'

interface SesionFila extends SesionEntrenamiento {
  rutina_nombre: string | null
  nombre_dia: string | null
}

export type SerieRealDetalle = SerieReal

export type RegistroEjercicioDetalle = RegistroEjercicio & {
  ejercicio_nombre: string
  series: SerieRealDetalle[]
}

export type SesionDetalle = SesionEntrenamiento & {
  registros: RegistroEjercicioDetalle[]
}

/** Nueva sesión completa con sus ejercicios y series ejecutadas. */
export interface NuevaSesion {
  sesion: Omit<SesionEntrenamiento, 'creado_en' | 'actualizado_en' | 'sincronizado'>
  registros: {
    ejercicio_id: string
    rpe_ejercicio: number | null
    series: Omit<SerieReal, 'id' | 'registro_id'>[]
  }[]
}

function aDominio(fila: SesionFila): SesionResumen {
  return { ...fila, sincronizado: fila.sincronizado === 1 ? 1 : 0 }
}

// ─── Consultas ────────────────────────────────────────────────────────────────

/**
 * Sesiones del usuario con el nombre de la rutina y del día resueltos
 * (LEFT JOIN: la FK de `sesiones.dia_rutina_id` es ON DELETE RESTRICT,
 * pero se tolera NULL por robustez ante datos externos).
 */
export async function listarSesionesPorUsuario(
  db: SQLiteDatabase,
  usuarioId: string,
  rango: { desde?: string; hasta?: string } = {},
): Promise<SesionResumen[]> {
  const condiciones = ['s.usuario_id = ?']
  const parametros: string[] = [usuarioId]
  if (rango.desde) {
    condiciones.push('s.fecha >= ?')
    parametros.push(rango.desde)
  }
  if (rango.hasta) {
    condiciones.push('s.fecha < ?')
    parametros.push(rango.hasta)
  }
  const filas = await db.getAllAsync<SesionFila>(
    `SELECT s.*, r.nombre AS rutina_nombre, dr.nombre_dia
     FROM sesiones s
     LEFT JOIN dias_rutina dr ON dr.id = s.dia_rutina_id
     LEFT JOIN rutinas r ON r.id = dr.rutina_id
     WHERE ${condiciones.join(' AND ')} ORDER BY s.fecha DESC`,
    parametros,
  )
  return filas.map(aDominio)
}

export async function obtenerSesionDetalle(
  db: SQLiteDatabase,
  id: string,
): Promise<SesionDetalle | null> {
  const fila = await db.getFirstAsync<SesionFila>('SELECT * FROM sesiones WHERE id = ?', [id])
  if (!fila) {
    return null
  }

  const registros = await db.getAllAsync<RegistroEjercicio & { ejercicio_nombre: string }>(
    `SELECT re.*, e.nombre AS ejercicio_nombre
     FROM registros_ejercicio re
     JOIN ejercicios e ON e.id = re.ejercicio_id
     WHERE re.sesion_id = ?
     ORDER BY e.nombre`,
    [id],
  )

  const registrosDetalle: RegistroEjercicioDetalle[] = []
  for (const registro of registros) {
    const series = await db.getAllAsync<SerieReal>(
      'SELECT * FROM series WHERE registro_id = ? ORDER BY numero_serie',
      [registro.id],
    )
    registrosDetalle.push({ ...registro, series })
  }

  return { ...aDominio(fila), registros: registrosDetalle }
}

// ─── Mutaciones ───────────────────────────────────────────────────────────────

/**
 * Persiste una sesión completa (registros + series) en una sola transacción.
 * Flujo crítico "registrar serie": cada serie se inserta con este mismo
 * repositorio dentro de la sesión activa.
 */
export async function crearSesion(db: SQLiteDatabase, nueva: NuevaSesion): Promise<SesionEntrenamiento> {
  const ahora = ahoraISO()

  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync(
      `INSERT INTO sesiones (
        id, usuario_id, dia_rutina_id, fecha, duracion_minutos, notas,
        rpe_sesion, creado_en, actualizado_en, sincronizado
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        nueva.sesion.id,
        nueva.sesion.usuario_id,
        nueva.sesion.dia_rutina_id,
        nueva.sesion.fecha,
        nueva.sesion.duracion_minutos,
        nueva.sesion.notas,
        nueva.sesion.rpe_sesion,
        ahora,
        ahora,
      ],
    )

    for (const registro of nueva.registros) {
      const registroId = generarId()
      await txn.runAsync(
        `INSERT INTO registros_ejercicio (id, sesion_id, ejercicio_id, rpe_ejercicio)
         VALUES (?, ?, ?, ?)`,
        [registroId, nueva.sesion.id, registro.ejercicio_id, registro.rpe_ejercicio],
      )

      for (const serie of registro.series) {
        await txn.runAsync(
          `INSERT INTO series (
            id, registro_id, numero_serie, peso_levantado, reps_realizadas,
            rpe_serie, rir, completada, notas
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            generarId(),
            registroId,
            serie.numero_serie,
            serie.peso_levantado,
            serie.reps_realizadas,
            serie.rpe_serie,
            serie.rir,
            serie.completada,
            serie.notas,
          ],
        )
      }
    }
  })

  return { ...nueva.sesion, creado_en: ahora, actualizado_en: ahora, sincronizado: 0 }
}

/** Añade una serie a un registro existente (sesión activa en curso). */
export async function agregarSerie(
  db: SQLiteDatabase,
  registroId: string,
  serie: Omit<SerieReal, 'id' | 'registro_id'>,
): Promise<SerieReal> {
  const id = generarId()
  await db.runAsync(
    `INSERT INTO series (
      id, registro_id, numero_serie, peso_levantado, reps_realizadas,
      rpe_serie, rir, completada, notas
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      registroId,
      serie.numero_serie,
      serie.peso_levantado,
      serie.reps_realizadas,
      serie.rpe_serie,
      serie.rir,
      serie.completada,
      serie.notas,
    ],
  )
  return { ...serie, id, registro_id: registroId }
}

/**
 * Elimina una sesión completa de la base de datos.
 * Las FK `ON DELETE CASCADE` borran automáticamente sus registros y series
 * (a diferencia de dejar la fila huérfana).
 */
export async function eliminarSesion(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM sesiones WHERE id = ?', [id])
}
