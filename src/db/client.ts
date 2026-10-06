/**
 * Punto de acceso a la base de datos SQLite de GymFor.
 *
 * - Abre la base de datos (singleton) con `openDatabaseAsync`.
 * - `inicializarBD` está pensada para el `onInit` de `SQLiteProvider`:
 *   activa WAL + claves foráneas, aplica migraciones pendientes y siembra
 *   el catálogo y las rutinas iniciales de forma idempotente.
 */

import * as SQLite from 'expo-sqlite'

import { migrarALaUltimaVersion, repararVersionInconsistente } from './migrations'
import { sembrarDatosIniciales } from './seed'

export const NOMBRE_BD = 'gymfor.db'

let instancia: Promise<SQLite.SQLiteDatabase> | null = null

/** Devuelve la conexión singleton a la base de datos de la app. */
export function obtenerBD(): Promise<SQLite.SQLiteDatabase> {
  if (!instancia) {
    instancia = SQLite.openDatabaseAsync(NOMBRE_BD)
  }
  return instancia
}

/**
 * Inicializa la base de datos: pragmas, migraciones y seed.
 * Segura para llamar en cada arranque (idempotente).
 * `repararVersionInconsistente` self-heals arranques interrumpidos que
 * dejaron `user_version > 0` sin las tablas del esquema.
 */
export async function inicializarBD(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
  `)
  await repararVersionInconsistente(db)
  await migrarALaUltimaVersion(db)
  await sembrarDatosIniciales(db)
}
