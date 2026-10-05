/**
 * Repositorio del catálogo maestro de ejercicios. Único punto de acceso a la
 * tabla `ejercicios`.
 */

import type { SQLiteDatabase } from 'expo-sqlite'

import type { Ejercicio, Equipamiento, GrupoMuscular } from '../../domain/types'

interface EjercicioFila {
  id: string
  nombre: string
  grupo_muscular_primario: GrupoMuscular
  grupos_musculares_secundarios: string
  equipamiento: Equipamiento
  es_compuesto: number
  factor_fraccional: number
  instrucciones: string | null
  video_url: string | null
}

function aDominio(fila: EjercicioFila): Ejercicio {
  return {
    ...fila,
    grupos_musculares_secundarios: JSON.parse(
      fila.grupos_musculares_secundarios || '[]',
    ) as GrupoMuscular[],
    es_compuesto: fila.es_compuesto === 1 ? 1 : 0,
  }
}

export interface FiltroEjercicios {
  grupo_muscular?: GrupoMuscular
  equipamiento?: Equipamiento
  /** Texto libre para el buscador (coincidencia parcial en el nombre). */
  busqueda?: string
}

export async function listarEjercicios(
  db: SQLiteDatabase,
  filtro: FiltroEjercicios = {},
): Promise<Ejercicio[]> {
  const condiciones: string[] = []
  const parametros: (string | GrupoMuscular | Equipamiento)[] = []

  if (filtro.grupo_muscular) {
    condiciones.push('grupo_muscular_primario = ?')
    parametros.push(filtro.grupo_muscular)
  }
  if (filtro.equipamiento) {
    condiciones.push('equipamiento = ?')
    parametros.push(filtro.equipamiento)
  }
  if (filtro.busqueda) {
    condiciones.push('nombre LIKE ?')
    parametros.push(`%${filtro.busqueda}%`)
  }

  const where = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : ''
  const filas = await db.getAllAsync<EjercicioFila>(
    `SELECT * FROM ejercicios ${where} ORDER BY nombre`,
    parametros,
  )
  return filas.map(aDominio)
}

export async function obtenerEjercicioPorId(
  db: SQLiteDatabase,
  id: string,
): Promise<Ejercicio | null> {
  const fila = await db.getFirstAsync<EjercicioFila>('SELECT * FROM ejercicios WHERE id = ?', [id])
  return fila ? aDominio(fila) : null
}

/** Crea un ejercicio personalizado en el catálogo. */
export async function crearEjercicio(db: SQLiteDatabase, ejercicio: Ejercicio): Promise<void> {
  await db.runAsync(
    `INSERT INTO ejercicios (
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
