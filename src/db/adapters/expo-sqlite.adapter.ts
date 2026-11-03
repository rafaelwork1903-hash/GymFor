/**
 * Adaptador oficial para `expo-sqlite` (nativo Android/iOS + WASM en web).
 *
 * ÚNICO archivo de todo el proyecto que importa `expo-sqlite` (y lo carga de
 * forma diferida al abrir conexión, de modo que registrar otro adaptador o
 * ejecutar suites en Node no evalúa el módulo nativo `ExpoSQLite`).
 */

import type { SQLiteDatabase } from 'expo-sqlite'

import type { AdaptadorMotorBD, ConexionBD, ValorParametroBD } from '../port'

export const NOMBRE_BD_SQLITE = 'gymfor.db'

/** Convierte una instancia de `SQLiteDatabase` al puerto agnóstico `ConexionBD`. */
export function envolverSQLiteDatabase(db: SQLiteDatabase): ConexionBD {
  return {
    dialecto: 'sqlite',
    runAsync: (sql: string, params: ValorParametroBD[] = []) => db.runAsync(sql, params),
    getFirstAsync: <T>(sql: string, params: ValorParametroBD[] = []) =>
      db.getFirstAsync<T>(sql, params),
    getAllAsync: <T>(sql: string, params: ValorParametroBD[] = []) =>
      db.getAllAsync<T>(sql, params),
    execAsync: (sql: string) => db.execAsync(sql),
    withTransactionAsync: (tarea: () => Promise<void>) => db.withTransactionAsync(tarea),
    closeAsync: () => db.closeAsync(),
  }
}

/** Crea el adaptador por defecto sobre `expo-sqlite`. */
export function crearAdaptadorExpoSQLite(nombreBD = NOMBRE_BD_SQLITE): AdaptadorMotorBD {
  return {
    nombre: `expo-sqlite:${nombreBD}`,
    dialecto: 'sqlite',
    async abrir(): Promise<ConexionBD> {
      const SQLite = await import('expo-sqlite')
      const db = await SQLite.openDatabaseAsync(nombreBD)
      return envolverSQLiteDatabase(db)
    },
    async configurarConexion(db: ConexionBD): Promise<void> {
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        PRAGMA foreign_keys = ON;
      `)
    },
  }
}
