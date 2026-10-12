import { DatabaseSync } from 'node:sqlite'

import type { SQLiteDatabase } from 'expo-sqlite'

import { ESQUEMA_VERSION_1 } from '../../src/db/schema'

/**
 * Adaptador compartido de `node:sqlite` (en memoria) a la interfaz de
 * `expo-sqlite` que usan los repositorios.
 *
 * Se aplica el esquema REAL (`ESQUEMA_VERSION_1`) con `PRAGMA foreign_keys
 * = ON`, así los tests de integración validan FKs, NOT NULL y CASCADE de
 * verdad (los tests unitarios mockean repositorios y no lo detectan).
 */
export class AdaptadorSQLite {
  private readonly db: DatabaseSync

  constructor() {
    this.db = new DatabaseSync(':memory:')
    this.db.exec('PRAGMA foreign_keys = ON')
    this.db.exec(ESQUEMA_VERSION_1)
  }

  async runAsync(sql: string, params: unknown[] = []): Promise<unknown> {
    return this.db.prepare(sql).run(...(params as never[]))
  }

  async getAllAsync<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    return this.db.prepare(sql).all(...(params as never[])) as T[]
  }

  async getFirstAsync<T>(sql: string, params: unknown[] = []): Promise<T | null> {
    const fila = this.db.prepare(sql).get(...(params as never[]))
    return (fila as T) ?? null
  }

  /** Ejecuta SQL multilínea (PRAGMA, DDL, reparaciones). */
  async execAsync(sql: string): Promise<void> {
    this.db.exec(sql)
  }

  private async transaccion(
    cb: (txn: { runAsync: AdaptadorSQLite['runAsync'] }) => Promise<void>,
  ): Promise<void> {
    this.db.exec('BEGIN')
    try {
      await cb({ runAsync: (sql: string, params: unknown[]) => this.runAsync(sql, params) })
      this.db.exec('COMMIT')
    } catch (error) {
      this.db.exec('ROLLBACK')
      throw error
    }
  }

  async withExclusiveTransactionAsync(
    cb: (txn: { runAsync: AdaptadorSQLite['runAsync'] }) => Promise<void>,
  ): Promise<void> {
    return this.transaccion(cb)
  }

  async withTransactionAsync(
    cb: (txn: { runAsync: AdaptadorSQLite['runAsync'] }) => Promise<void>,
  ): Promise<void> {
    return this.transaccion(cb)
  }

  /** Consulta directa para aserciones sobre el estado real de la BD. */
  leer<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
    return this.db.prepare(sql).all(...(params as never[])) as T[]
  }
}

/** Atajo para el cast a la interfaz de expo-sqlite en los tests. */
export function comoBD(adaptador: AdaptadorSQLite): SQLiteDatabase {
  return adaptador as unknown as SQLiteDatabase
}
