/**
 * Inserción de datos semilla: catálogo maestro de ejercicios y las rutinas
 * iniciales. Idempotente: usa IDs deterministas con `INSERT OR IGNORE`.
 */

import type { SQLiteDatabase } from 'expo-sqlite'

import { CATALOGO_EJERCICIOS, RUTINAS_SEED, SEMILLA_FECHA } from './seedData'

/**
 * Siembra el catálogo y las rutinas plantilla. Puede ejecutarse en cada
 * arranque: las filas existentes se ignoran gracias a los IDs deterministas.
 */
export async function sembrarDatosIniciales(db: SQLiteDatabase): Promise<void> {
  await db.withExclusiveTransactionAsync(async (txn) => {
    for (const ejercicio of CATALOGO_EJERCICIOS) {
      await txn.runAsync(
        `INSERT OR IGNORE INTO ejercicios (
          id, nombre, grupo_muscular_primario, grupos_musculares_secundarios,
          equipamiento, es_compuesto, factor_fraccional, instrucciones, video_url
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          ejercicio.id,
          ejercicio.nombre,
          ejercicio.grupo_muscular_primario,
          JSON.stringify(ejercicio.grupos_musculares_secundarios),
          ejercicio.equipamiento,
          ejercicio.es_compuesto,
          ejercicio.factor_fraccional,
          ejercicio.instrucciones,
          ejercicio.video_url,
        ],
      )
    }

    for (const rutina of RUTINAS_SEED) {
      await txn.runAsync(
        `INSERT OR IGNORE INTO rutinas (
          id, usuario_id, nombre, descripcion, activa, creado_en, actualizado_en, sincronizado
        ) VALUES (?, NULL, ?, ?, 0, ?, ?, 0)`,
        [rutina.id, rutina.nombre, rutina.descripcion, SEMILLA_FECHA, SEMILLA_FECHA],
      )

      for (const [ordenDia, dia] of rutina.dias.entries()) {
        const diaId = `${rutina.id}:dia:${ordenDia + 1}`
        await txn.runAsync(
          `INSERT OR IGNORE INTO dias_rutina (id, rutina_id, nombre_dia, orden, notas)
           VALUES (?, ?, ?, ?, ?)`,
          [diaId, rutina.id, dia.nombre_dia, ordenDia + 1, dia.notas ?? null],
        )

        for (const [ordenEjercicio, ejercicio] of dia.ejercicios.entries()) {
          await txn.runAsync(
            `INSERT OR IGNORE INTO ejercicios_en_rutina (
              id, dia_id, ejercicio_id, orden, series_objetivo,
              reps_objetivo_min, reps_objetivo_max, peso_objetivo, descanso_segundos
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              `${diaId}:eje:${ordenEjercicio + 1}`,
              diaId,
              `ej:${ejercicio.ejercicio}`,
              ordenEjercicio + 1,
              ejercicio.series_objetivo,
              ejercicio.reps_objetivo_min,
              ejercicio.reps_objetivo_max,
              ejercicio.peso_objetivo ?? null,
              ejercicio.descanso_segundos ?? null,
            ],
          )
        }
      }
    }
  })
}
