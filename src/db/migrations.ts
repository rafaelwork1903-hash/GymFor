/**
 * Migraciones de base de datos (expo-sqlite).
 *
 * Cada migración tiene `up` y `down`, por lo que son reversibles. La versión
 * aplicada se persiste en `PRAGMA user_version` (transaccional en SQLite).
 *
 * Se usa `withTransactionAsync` (y no `withExclusiveTransactionAsync`) porque
 * esta última no está soportada en web. Es seguro: las migraciones solo se
 * ejecutan durante `inicializarBD`, antes de cualquier otro acceso a la BD.
 */

import type { SQLiteDatabase } from 'expo-sqlite'

import { ESQUEMA_VERSION_1, ESQUEMA_VERSION_1_DOWN } from './schema'

export interface Migracion {
  version: number
  nombre: string
  up: string
  down: string
}

/** Migraciones ordenadas por versión ascendente. */
export const MIGRACIONES: readonly Migracion[] = [
  {
    version: 1,
    nombre: 'esquema_inicial',
    up: ESQUEMA_VERSION_1,
    down: ESQUEMA_VERSION_1_DOWN,
  },
]

/** Versión actual del esquema aplicada en la base de datos (0 = vacía). */
export async function obtenerVersionActual(db: SQLiteDatabase): Promise<number> {
  const fila = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version')
  return fila?.user_version ?? 0
}

/**
 * Aplica todas las migraciones pendientes hasta la última versión.
 * Cada migración se ejecuta en una transacción.
 */
export async function migrarALaUltimaVersion(db: SQLiteDatabase): Promise<number> {
  return migrarAVersion(db, MIGRACIONES[MIGRACIONES.length - 1]?.version ?? 0)
}

/** Tablas que la última versión del esquema debe contener. */
const TABLAS_ESQUEMA = [
  'usuarios',
  'rutinas',
  'dias_rutina',
  'ejercicios',
  'ejercicios_en_rutina',
  'sesiones',
  'registros_ejercicio',
  'series',
  'metricas_progreso',
] as const

/**
 * Repara una base de datos inconsistente: `user_version > 0` pero faltan
 * tablas del esquema (p. ej. un primer arranque interrumpido en desarrollo;
 * expo-sqlite documenta este caso de migración inicial en carrera). Resetea
 * `user_version` a 0 para que las migraciones se vuelvan a aplicar; gracias
 * a `CREATE TABLE IF NOT EXISTS` las tablas y datos existentes se conservan.
 */
export async function repararVersionInconsistente(db: SQLiteDatabase): Promise<void> {
  const version = await obtenerVersionActual(db)
  if (version === 0) {
    return
  }

  const filas = await db.getAllAsync<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type = 'table'`,
  )
  const tablasExistentes = new Set(filas.map((fila) => fila.name))
  const faltanTablas = TABLAS_ESQUEMA.some((tabla) => !tablasExistentes.has(tabla))

  if (faltanTablas) {
    await db.execAsync('PRAGMA user_version = 0')
  }
}

/**
 * Migra la base de datos a `versionObjetivo` aplicando migraciones `up` (si
 * hay que subir) o `down` (si hay que bajar). Devuelve la versión resultante.
 */
export async function migrarAVersion(
  db: SQLiteDatabase,
  versionObjetivo: number,
): Promise<number> {
  const versionActual = await obtenerVersionActual(db)

  if (versionObjetivo === versionActual) {
    return versionActual
  }
  if (versionObjetivo < 0 || versionObjetivo > MIGRACIONES.length) {
    throw new Error(`Versión de migración inválida: ${versionObjetivo}`)
  }

  if (versionObjetivo > versionActual) {
    for (const migracion of MIGRACIONES) {
      if (migracion.version > versionActual && migracion.version <= versionObjetivo) {
        await db.withTransactionAsync(async () => {
          await db.execAsync(migracion.up)
          await db.execAsync(`PRAGMA user_version = ${migracion.version}`)
        })
      }
    }
    return versionObjetivo
  }

  const haciaAbajo = [...MIGRACIONES]
    .sort((a, b) => b.version - a.version)
    .filter((migracion) => migracion.version > versionObjetivo && migracion.version <= versionActual)
  for (const migracion of haciaAbajo) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(migracion.down)
      await db.execAsync(`PRAGMA user_version = ${migracion.version - 1}`)
    })
  }
  return versionObjetivo
}
