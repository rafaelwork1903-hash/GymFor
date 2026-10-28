/**
 * Repositorio de rutinas (y sus días y ejercicios). Único punto de acceso a
 * las tablas `rutinas`, `dias_rutina` y `ejercicios_en_rutina`.
 */

import type { SQLiteDatabase } from 'expo-sqlite'

import type { DiaRutina, EjercicioEnRutina, Rutina, GrupoMuscular, RutinaEditada } from '../../domain/types'
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
  grupo_muscular_primario: GrupoMuscular
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

/** Crea una rutina completa (días + ejercicios) en una sola transacción.
 *
 * Se usa `withTransactionAsync` (y no `withExclusiveTransactionAsync`)
 * porque esta última no está soportada en web (lanza en runtime) — misma
 * convención que migraciones y seed.
 */
export async function crearRutina(db: SQLiteDatabase, rutina: NuevaRutina): Promise<Rutina> {
  const ahora = ahoraISO()
  const rutinaId = generarId()

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO rutinas (
        id, usuario_id, nombre, descripcion, activa, creado_en, actualizado_en, sincronizado
      ) VALUES (?, ?, ?, ?, 0, ?, ?, 0)`,
      [rutinaId, rutina.usuario_id, rutina.nombre, rutina.descripcion, ahora, ahora],
    )

    for (const [ordenDia, dia] of rutina.dias.entries()) {
      const diaId = generarId()
      await db.runAsync(
        `INSERT INTO dias_rutina (id, rutina_id, nombre_dia, orden, notas)
         VALUES (?, ?, ?, ?, ?)`,
        [diaId, rutinaId, dia.nombre_dia, ordenDia + 1, dia.notas ?? null],
      )

      for (const [ordenEjercicio, ejercicio] of dia.ejercicios.entries()) {
        await db.runAsync(
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
 * Marca una rutina como activa y desactiva TODAS las demás (plantillas
 * incluidas): la invariante de la app es que a lo sumo haya UNA rutina
 * activa, así que la desactivación es global y no por usuario.
 *
 * `withTransactionAsync` (no soportado en web el exclusivo) — ver crearRutina.
 */
export async function activarRutina(
  db: SQLiteDatabase,
  rutinaId: string,
  usuarioId: string,
): Promise<void> {
  void usuarioId // la desactivación es global: solo puede haber una activa
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE rutinas SET activa = 0, actualizado_en = ?', [ahoraISO()])
    await db.runAsync(
      'UPDATE rutinas SET activa = 1, actualizado_en = ?, sincronizado = 0 WHERE id = ?',
      [ahoraISO(), rutinaId],
    )
  })
}

/** Desactiva una rutina (activa = 0). Llamarla la deja sin rutina activa. */
export async function desactivarRutina(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync(
    'UPDATE rutinas SET activa = 0, actualizado_en = ?, sincronizado = 0 WHERE id = ?',
    [ahoraISO(), id],
  )
}

export async function eliminarRutina(db: SQLiteDatabase, id: string): Promise<void> {
  // El borrado en cascada elimina días y ejercicios asociados.
  await db.runAsync('DELETE FROM rutinas WHERE id = ?', [id])
}

/**
 * Guarda y actualiza una rutina existente de forma completa en una sola transacción.
 * Actualiza nombre, descripción, días y ejercicios en rutina.
 * Elimina días y ejercicios que ya no estén presentes en el formulario.
 * No permite eliminar un día que tenga sesiones registradas en la tabla `sesiones`.
 *
 * Devuelve la `RutinaDetalle` actualizada.
 */
export async function guardarRutina(
  db: SQLiteDatabase,
  id: string,
  datos: RutinaEditada,
): Promise<RutinaDetalle> {
  const actual = await obtenerRutinaPorId(db, id)
  if (!actual) {
    throw new Error(`Rutina no encontrada: ${id}`)
  }

  // Identificar días eliminados y bloquear si alguno tiene sesiones registradas
  const diasExistentes = await db.getAllAsync<{ id: string; nombre_dia: string }>(
    'SELECT id, nombre_dia FROM dias_rutina WHERE rutina_id = ?',
    [id],
  )
  const idsDiasEnFormulario = new Set(
    datos.dias.map((d) => d.id).filter((diaId): diaId is string => Boolean(diaId)),
  )
  const diasABorrar = diasExistentes.filter((d) => !idsDiasEnFormulario.has(d.id))

  for (const dia of diasABorrar) {
    const sesion = await db.getFirstAsync<{ id: string }>(
      'SELECT id FROM sesiones WHERE dia_rutina_id = ? LIMIT 1',
      [dia.id],
    )
    if (sesion) {
      throw new Error(
        `No se puede eliminar el día "${dia.nombre_dia}" porque tiene sesiones registradas.`,
      )
    }
  }

  const ahora = ahoraISO()

  await db.withTransactionAsync(async () => {
    // 1. Actualizar campos de la rutina
    await db.runAsync(
      `UPDATE rutinas SET nombre = ?, descripcion = ?, actualizado_en = ?, sincronizado = 0 WHERE id = ?`,
      [datos.nombre, datos.descripcion, ahora, id],
    )

    // 2. Borrar días que ya no están (CASCADE borra sus ejercicios_en_rutina)
    for (const dia of diasABorrar) {
      await db.runAsync('DELETE FROM dias_rutina WHERE id = ?', [dia.id])
    }

    // 3. Desplazar órdenes existentes de días para evitar colisiones con UNIQUE(rutina_id, orden)
    await db.runAsync('UPDATE dias_rutina SET orden = orden + 10000 WHERE rutina_id = ?', [id])

    // 4. Actualizar o insertar días
    for (const [ordenDia, dia] of datos.dias.entries()) {
      const nuevoOrdenDia = ordenDia + 1
      let diaId: string

      if (dia.id) {
        diaId = dia.id
        await db.runAsync(
          `UPDATE dias_rutina SET nombre_dia = ?, orden = ?, notas = ? WHERE id = ?`,
          [dia.nombre_dia, nuevoOrdenDia, dia.notas ?? null, diaId],
        )
      } else {
        diaId = generarId()
        await db.runAsync(
          `INSERT INTO dias_rutina (id, rutina_id, nombre_dia, orden, notas) VALUES (?, ?, ?, ?, ?)`,
          [diaId, id, dia.nombre_dia, nuevoOrdenDia, dia.notas ?? null],
        )
      }

      // 5. Gestionar ejercicios del día
      const ejerciciosExistentes = await db.getAllAsync<{ id: string }>(
        'SELECT id FROM ejercicios_en_rutina WHERE dia_id = ?',
        [diaId],
      )
      const idsEjerciciosEnFormulario = new Set(
        dia.ejercicios.map((e) => e.id).filter((eId): eId is string => Boolean(eId)),
      )

      for (const ej of ejerciciosExistentes) {
        if (!idsEjerciciosEnFormulario.has(ej.id)) {
          await db.runAsync('DELETE FROM ejercicios_en_rutina WHERE id = ?', [ej.id])
        }
      }

      // Desplazar órdenes para evitar colisión con UNIQUE(dia_id, orden)
      await db.runAsync(
        'UPDATE ejercicios_en_rutina SET orden = orden + 10000 WHERE dia_id = ?',
        [diaId],
      )

      for (const [ordenEj, ejercicio] of dia.ejercicios.entries()) {
        const nuevoOrdenEj = ordenEj + 1

        if (ejercicio.id) {
          await db.runAsync(
            `UPDATE ejercicios_en_rutina SET
               ejercicio_id = ?,
               orden = ?,
               series_objetivo = ?,
               reps_objetivo_min = ?,
               reps_objetivo_max = ?,
               peso_objetivo = ?,
               descanso_segundos = ?
             WHERE id = ?`,
            [
              ejercicio.ejercicio_id,
              nuevoOrdenEj,
              ejercicio.series_objetivo,
              ejercicio.reps_objetivo_min,
              ejercicio.reps_objetivo_max,
              ejercicio.peso_objetivo,
              ejercicio.descanso_segundos,
              ejercicio.id,
            ],
          )
        } else {
          await db.runAsync(
            `INSERT INTO ejercicios_en_rutina (
               id, dia_id, ejercicio_id, orden, series_objetivo,
               reps_objetivo_min, reps_objetivo_max, peso_objetivo, descanso_segundos
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              generarId(),
              diaId,
              ejercicio.ejercicio_id,
              nuevoOrdenEj,
              ejercicio.series_objetivo,
              ejercicio.reps_objetivo_min,
              ejercicio.reps_objetivo_max,
              ejercicio.peso_objetivo,
              ejercicio.descanso_segundos,
            ],
          )
        }
      }
    }
  })

  const actualizada = await obtenerRutinaDetalle(db, id)
  if (!actualizada) {
    throw new Error('No se pudo recuperar la rutina recién guardada')
  }
  return actualizada
}
