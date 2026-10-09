/**
 * Declaración ambiental mínima de `node:sqlite` (builtin de Node ≥ 22.5),
 * solo para los tests de integración que ejecutan SQL real con el esquema
 * de la app. El proyecto no depende de `@types/node`.
 */
declare module 'node:sqlite' {
  export interface StatementSync {
    run(...parametros: unknown[]): { changes: number; lastInsertRowid: number | bigint }
    all(...parametros: unknown[]): Record<string, unknown>[]
    get(...parametros: unknown[]): Record<string, unknown> | undefined
  }

  export class DatabaseSync {
    constructor(ruta: string)
    prepare(sql: string): StatementSync
    exec(sql: string): void
    close(): void
  }
}
