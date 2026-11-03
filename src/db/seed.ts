/**
 * Inserción de datos semilla: catálogo maestro de ejercicios y las rutinas
 * iniciales. Idempotente y portátil entre dialectos SQL (`ON CONFLICT DO NOTHING`
 * en SQLite/PostgreSQL e `INSERT IGNORE` en MySQL).
 */

import { construirInsertarIgnorandoDuplicado } from './dialect'
import type { ConexionBD } from './port'
import { CATALOGO_EJERCICIOS, RUTINAS_SEED, SEMILLA_FECHA } from './seedData'

/**
 * Siembra el catálogo y las rutinas plantilla. Puede ejecutarse en cada
 * arranque: las filas existentes se ignoran gracias a los IDs deterministas.
 */
export async function sembrarDatosIniciales(db: ConexionBD): Promise<void> {
  const dialecto = db.dialecto ?? 'sqlite'

  const sqlInsertarEjercicio = construirInsertarIgnorandoDuplicado(
    'ejercicios',
    [
      'id',
      'nombre',
      'grupo_muscular_primario',
      'grupos_musculares_secundarios',
      'equipamiento',
      'es_compuesto',
      'factor_fraccional',
      'instrucciones',
      'video_url',
    ],
    dialecto,
  )

  const sqlInsertarRutina = construirInsertarIgnorandoDuplicado(
    'rutinas',
    [
      'id',
      'usuario_id',
      'nombre',
      'descripcion',
      'activa',
      'creado_en',
      'actualizado_en',
      'sincronizado',
    ],
    dialecto,
  )

  const sqlInsertarDia = construirInsertarIgnorandoDuplicado(
    'dias_rutina',
    ['id', 'rutina_id', 'nombre_dia', 'orden', 'notas'],
    dialecto,
  )

  const sqlInsertarEjercicioEnRutina = construirInsertarIgnorandoDuplicado(
    'ejercicios_en_rutina',
    [
      'id',
      'dia_id',
      'ejercicio_id',
      'orden',
      'series_objetivo',
      'reps_objetivo_min',
      'reps_objetivo_max',
      'peso_objetivo',
      'descanso_segundos',
    ],
    dialecto,
  )

  await db.withTransactionAsync(async () => {
    for (const ejercicio of CATALOGO_EJERCICIOS) {
      await db.runAsync(sqlInsertarEjercicio, [
        ejercicio.id,
        ejercicio.nombre,
        ejercicio.grupo_muscular_primario,
        JSON.stringify(ejercicio.grupos_musculares_secundarios),
        ejercicio.equipamiento,
        ejercicio.es_compuesto,
        ejercicio.factor_fraccional,
        ejercicio.instrucciones,
        ejercicio.video_url,
      ])
    }

    for (const rutina of RUTINAS_SEED) {
      await db.runAsync(sqlInsertarRutina, [
        rutina.id,
        null,
        rutina.nombre,
        rutina.descripcion,
        0,
        SEMILLA_FECHA,
        SEMILLA_FECHA,
        0,
      ])

      for (const [ordenDia, dia] of rutina.dias.entries()) {
        const diaId = `${rutina.id}:dia:${ordenDia + 1}`
        await db.runAsync(sqlInsertarDia, [
          diaId,
          rutina.id,
          dia.nombre_dia,
          ordenDia + 1,
          dia.notas ?? null,
        ])

        for (const [ordenEjercicio, ejercicio] of dia.ejercicios.entries()) {
          await db.runAsync(sqlInsertarEjercicioEnRutina, [
            `${diaId}:eje:${ordenEjercicio + 1}`,
            diaId,
            `ej:${ejercicio.ejercicio}`,
            ordenEjercicio + 1,
            ejercicio.series_objetivo,
            ejercicio.reps_objetivo_min,
            ejercicio.reps_objetivo_max,
            ejercicio.peso_objetivo ?? null,
            ejercicio.descanso_segundos ?? null,
          ])
        }
      }
    }
  })
}
