/**
 * Migraciones de base de datos (expo-sqlite).
 *
 * Cada migración tiene `up` y `down`, por lo que son reversibles. La versión
 * aplicada se persiste en `PRAGMA user_version` (transaccional en SQLite).
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
 * Cada migración se ejecuta en una transacción exclusiva.
 */
export async function migrarALaUltimaVersion(db: SQLiteDatabase): Promise<number> {
  return migrarAVersion(db, MIGRACIONES[MIGRACIONES.length - 1]?.version ?? 0)
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
        await db.withExclusiveTransactionAsync(async (txn) => {
          await txn.execAsync(migracion.up)
          await txn.execAsync(`PRAGMA user_version = ${migracion.version}`)
        })
      }
    }
    return versionObjetivo
  }

  const haciaAbajo = [...MIGRACIONES]
    .sort((a, b) => b.version - a.version)
    .filter((migracion) => migracion.version > versionObjetivo && migracion.version <= versionActual)
  for (const migracion of haciaAbajo) {
    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.execAsync(migracion.down)
      await txn.execAsync(`PRAGMA user_version = ${migracion.version - 1}`)
    })
  }
  return versionObjetivo
}
