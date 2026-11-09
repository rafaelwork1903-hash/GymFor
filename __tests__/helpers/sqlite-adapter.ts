import { DatabaseSync } from 'node:sqlite'

import type { ConexionBD, DialectoSQL, ValorParametroBD } from '../../src/db/port'
import { ESQUEMA_VERSION_1, ESQUEMA_VERSION_2, ESQUEMA_VERSION_3 } from '../../src/db/schema'

/**
 * Adaptador compartido de `node:sqlite` (en memoria) al puerto `ConexionBD`
 * que consumen los repositorios, migraciones y semilla.
 *
 * Se aplica el esquema REAL (`ESQUEMA_VERSION_1` + `ESQUEMA_VERSION_2` + `ESQUEMA_VERSION_3`) con
 * `PRAGMA foreign_keys = ON`, así los tests de integración validan FKs,
 * NOT NULL, UNIQUE y CASCADE de verdad.
 */
export class AdaptadorSQLite implements ConexionBD {
  readonly dialecto: DialectoSQL
  private readonly db: DatabaseSync

  constructor(opciones: { versionInicial?: 0 | 1 | 2 | 3; dialecto?: DialectoSQL } = {}) {
    const versionInicial = opciones.versionInicial ?? 3
    this.dialecto = opciones.dialecto ?? 'sqlite'
    this.db = new DatabaseSync(':memory:')
    this.db.exec('PRAGMA foreign_keys = ON')
    if (versionInicial >= 1) {
      this.db.exec(ESQUEMA_VERSION_1)
      if (this.dialecto === 'sqlite') {
        this.db.exec('PRAGMA user_version = 1')
      }
    }
    if (versionInicial >= 2) {
      this.db.exec(ESQUEMA_VERSION_2)
      if (this.dialecto === 'sqlite') {
        this.db.exec('PRAGMA user_version = 2')
      }
    }
    if (versionInicial >= 3) {
      this.db.exec(ESQUEMA_VERSION_3)
      if (this.dialecto === 'sqlite') {
        this.db.exec('PRAGMA user_version = 3')
      }
    }
  }

  async runAsync(sql: string, params: ValorParametroBD[] = []): Promise<unknown> {
    return this.db.prepare(sql).run(...(params as never[]))
  }

  async getAllAsync<T>(sql: string, params: ValorParametroBD[] = []): Promise<T[]> {
    return this.db.prepare(sql).all(...(params as never[])) as T[]
  }

  async getFirstAsync<T>(sql: string, params: ValorParametroBD[] = []): Promise<T | null> {
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
      await cb({
        runAsync: (sql: string, params: ValorParametroBD[] = []) => this.runAsync(sql, params),
      })
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

/** Atajo tipado al puerto `ConexionBD` en los tests. */
export function comoBD(adaptador: AdaptadorSQLite): ConexionBD {
  return adaptador
}
