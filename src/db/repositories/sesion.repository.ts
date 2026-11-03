/**
 * Repositorio de sesiones de entrenamiento. Único punto de acceso a las
 * tablas `sesiones`, `registros_ejercicio` y `series`.
 */

import type { RegistroEjercicio, SerieReal, SesionEntrenamiento, SesionResumen } from '../../domain/types'
import { ahoraISO, generarId } from '../../utils/id'
import { aEnteroBooleano } from '../dialect'
import type { ConexionBD } from '../port'

interface SesionFila extends Omit<SesionEntrenamiento, 'sincronizado'> {
  sincronizado: number | boolean
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

/** Campos editables de una serie registrada (`numero_serie` no es editable por el usuario). */
export type CambiosSerie = Partial<
  Pick<
    SerieReal,
    'peso_levantado' | 'reps_realizadas' | 'rpe_serie' | 'rir' | 'completada' | 'notas'
  >
>

/** Datos opcionales al cerrar una sesión activa. */
export interface DatosFinalizarSesion {
  duracion_minutos?: number | null
  notas?: string | null
  rpe_sesion?: number | null
}

/** Nueva sesión completa con sus ejercicios y series ejecutadas. */
export interface NuevaSesion {
  sesion: Omit<SesionEntrenamiento, 'creado_en' | 'actualizado_en' | 'sincronizado'>
  registros: {
    /** ID generado por el caller (store): BD y sesión en curso lo comparten. */
    id: string
    ejercicio_id: string
    rpe_ejercicio: number | null
    series: Omit<SerieReal, 'id' | 'registro_id'>[]
  }[]
}

function aDominio(fila: SesionFila): SesionResumen {
  return { ...fila, sincronizado: aEnteroBooleano(fila.sincronizado) }
}

function aSerieDominio(fila: Omit<SerieReal, 'completada'> & { completada: number | boolean }): SerieReal {
  return { ...fila, completada: aEnteroBooleano(fila.completada) }
}

// ─── Consultas ────────────────────────────────────────────────────────────────

/**
 * Sesiones del usuario con el nombre de la rutina y del día resueltos
 * (LEFT JOIN: la FK de `sesiones.dia_rutina_id` es ON DELETE RESTRICT,
 * pero se tolera NULL por robustez ante datos externos).
 */
export async function listarSesionesPorUsuario(
  db: ConexionBD,
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
  db: ConexionBD,
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
    const series = await db.getAllAsync<
      Omit<SerieReal, 'completada'> & { completada: number | boolean }
    >('SELECT * FROM series WHERE registro_id = ? ORDER BY numero_serie', [registro.id])
    registrosDetalle.push({ ...registro, series: series.map(aSerieDominio) })
  }

  return { ...aDominio(fila), registros: registrosDetalle }
}

// ─── Mutaciones ───────────────────────────────────────────────────────────────

/**
 * Persiste una sesión completa (registros + series) en una sola transacción.
 * Los IDs de los registros los trae el caller (`NuevaSesion.registros[].id`):
 * se insertan tal cual para que la sesión en curso del store referencie los
 * mismos IDs que existen en BD (los inserts de series dependen de esta FK).
 *
 * Se usa `withTransactionAsync` (y no `withExclusiveTransactionAsync`)
 * porque esta última no está soportada en web (lanza en runtime) — misma
 * convención que migraciones y seed.
 */
export async function crearSesion(db: ConexionBD, nueva: NuevaSesion): Promise<SesionEntrenamiento> {
  const ahora = ahoraISO()

  await db.withTransactionAsync(async () => {
    await db.runAsync(
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
      await db.runAsync(
        `INSERT INTO registros_ejercicio (id, sesion_id, ejercicio_id, rpe_ejercicio)
         VALUES (?, ?, ?, ?)`,
        [registro.id, nueva.sesion.id, registro.ejercicio_id, registro.rpe_ejercicio],
      )

      for (const serie of registro.series) {
        await db.runAsync(
          `INSERT INTO series (
            id, registro_id, numero_serie, peso_levantado, reps_realizadas,
            rpe_serie, rir, completada, notas
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            generarId(),
            registro.id,
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

/**
 * Persiste el cierre de una sesión en curso (duración, notas y RPE global).
 * Centraliza la mutación en el repositorio para mantener los stores sin SQL.
 */
export async function finalizarSesion(
  db: ConexionBD,
  sesionId: string,
  datos: DatosFinalizarSesion = {},
): Promise<{ actualizado_en: string }> {
  const actualizadoEn = ahoraISO()
  await db.runAsync(
    `UPDATE sesiones
     SET duracion_minutos = ?, notas = ?, rpe_sesion = ?, actualizado_en = ?, sincronizado = 0
     WHERE id = ?`,
    [
      datos.duracion_minutos ?? null,
      datos.notas ?? null,
      datos.rpe_sesion ?? null,
      actualizadoEn,
      sesionId,
    ],
  )
  return { actualizado_en: actualizadoEn }
}

/** Añade una serie a un registro existente (sesión activa en curso). */
export async function agregarSerie(
  db: ConexionBD,
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
export async function eliminarSesion(db: ConexionBD, id: string): Promise<void> {
  await db.runAsync('DELETE FROM sesiones WHERE id = ?', [id])
}

/**
 * Actualiza los valores editables de una serie ya registrada.
 * Valida que la fila exista e ignora `numero_serie` (gestionado internamente).
 */
export async function actualizarSerie(
  db: ConexionBD,
  serieId: string,
  cambios: CambiosSerie,
): Promise<SerieReal> {
  const actual = await db.getFirstAsync<
    Omit<SerieReal, 'completada'> & { completada: number | boolean }
  >('SELECT * FROM series WHERE id = ?', [serieId])
  if (!actual) {
    throw new Error(`Serie no encontrada: ${serieId}`)
  }

  const completadaRaw =
    cambios.completada !== undefined ? cambios.completada : actual.completada
  const actualizada: SerieReal = {
    id: actual.id,
    registro_id: actual.registro_id,
    numero_serie: actual.numero_serie,
    peso_levantado:
      cambios.peso_levantado !== undefined ? cambios.peso_levantado : actual.peso_levantado,
    reps_realizadas:
      cambios.reps_realizadas !== undefined ? cambios.reps_realizadas : actual.reps_realizadas,
    rpe_serie: cambios.rpe_serie !== undefined ? cambios.rpe_serie : actual.rpe_serie,
    rir: cambios.rir !== undefined ? cambios.rir : actual.rir,
    completada: aEnteroBooleano(completadaRaw),
    notas: cambios.notas !== undefined ? cambios.notas : actual.notas,
  }

  await db.runAsync(
    `UPDATE series
     SET peso_levantado = ?, reps_realizadas = ?, rpe_serie = ?, rir = ?, completada = ?, notas = ?
     WHERE id = ?`,
    [
      actualizada.peso_levantado,
      actualizada.reps_realizadas,
      actualizada.rpe_serie,
      actualizada.rir,
      actualizada.completada,
      actualizada.notas,
      serieId,
    ],
  )

  return actualizada
}

/**
 * Elimina una serie registrada y renumera de forma contigua (1..N) las series
 * posteriores del mismo registro mediante **dos fases** dentro de una
 * transacción `withTransactionAsync`.
 *
 * Por qué dos fases:
 * - Un único `SET numero_serie = numero_serie - 1` depende de que el motor
 *   procese las filas en orden ascendente de `numero_serie`. Si las series
 *   fueron reordenadas (su orden físico/`rowid` difiere de `numero_serie`) o
 *   en motores SQL con escaneo físico distinto (PostgreSQL, MySQL), se produce
 *   una colisión transitoria en `UNIQUE(registro_id, numero_serie)`.
 * - Fase 1 desplaza `(k .. M]` a `(M + k .. 2*M]` (disjunto de `[1 .. M]` y
 *   `> 0`, respetando `CHECK (numero_serie > 0)`).
 * - Fase 2 desplaza `(M + k .. 2*M]` a `[k .. M - 1]` (disjunto tanto de
 *   `[1 .. k - 1]` como del rango temporal `> M`).
 */
export async function eliminarSerie(db: ConexionBD, serieId: string): Promise<void> {
  await db.withTransactionAsync(async () => {
    const actual = await db.getFirstAsync<Pick<SerieReal, 'registro_id' | 'numero_serie'>>(
      'SELECT registro_id, numero_serie FROM series WHERE id = ?',
      [serieId],
    )
    if (!actual) {
      throw new Error(`Serie no encontrada: ${serieId}`)
    }

    await db.runAsync('DELETE FROM series WHERE id = ?', [serieId])

    const filaMax = await db.getFirstAsync<{ max_numero: number | null }>(
      'SELECT MAX(numero_serie) AS max_numero FROM series WHERE registro_id = ? AND numero_serie > ?',
      [actual.registro_id, actual.numero_serie],
    )
    const maxNumero = filaMax?.max_numero != null ? Number(filaMax.max_numero) : null

    if (maxNumero !== null && maxNumero > actual.numero_serie) {
      const desplazamiento = maxNumero
      await db.runAsync(
        `UPDATE series
         SET numero_serie = numero_serie + ?
         WHERE registro_id = ? AND numero_serie > ?`,
        [desplazamiento, actual.registro_id, actual.numero_serie],
      )
      await db.runAsync(
        `UPDATE series
         SET numero_serie = numero_serie - ?
         WHERE registro_id = ? AND numero_serie > ?`,
        [desplazamiento + 1, actual.registro_id, desplazamiento],
      )
    }
  })
}

/**
 * Reordena las series de un registro asignando `numero_serie` contiguo `1..N`
 * según el orden de `serieIdsEnOrden`, usando desplazamiento en dos fases para
 * evitar colisiones transitorias en `UNIQUE(registro_id, numero_serie)` en
 * cualquier motor SQL.
 */
export async function reordenarSeries(
  db: ConexionBD,
  registroId: string,
  serieIdsEnOrden: readonly string[],
): Promise<void> {
  const unicos = new Set(serieIdsEnOrden)
  if (unicos.size !== serieIdsEnOrden.length) {
    throw new Error('La lista de series a reordenar contiene IDs duplicados')
  }

  await db.withTransactionAsync(async () => {
    const existentes = await db.getAllAsync<{ id: string; numero_serie: number }>(
      'SELECT id, numero_serie FROM series WHERE registro_id = ?',
      [registroId],
    )

    if (
      existentes.length !== serieIdsEnOrden.length ||
      existentes.some((fila) => !unicos.has(fila.id))
    ) {
      throw new Error(
        `Los IDs proporcionados no coinciden con las series del registro: ${registroId}`,
      )
    }

    if (existentes.length === 0) {
      return
    }

    const maxActual = existentes.reduce(
      (max, fila) => (fila.numero_serie > max ? fila.numero_serie : max),
      0,
    )
    const desplazamiento = Math.max(maxActual, serieIdsEnOrden.length)

    // Fase 1: mover todas las series del registro a (desplazamiento .. desplazamiento + maxActual]
    await db.runAsync(
      'UPDATE series SET numero_serie = numero_serie + ? WHERE registro_id = ?',
      [desplazamiento, registroId],
    )

    // Fase 2: asignar posiciones definitivas 1..N (disjuntas de > desplazamiento)
    for (const [indice, id] of serieIdsEnOrden.entries()) {
      await db.runAsync(
        'UPDATE series SET numero_serie = ? WHERE id = ? AND registro_id = ?',
        [indice + 1, id, registroId],
      )
    }
  })
}
