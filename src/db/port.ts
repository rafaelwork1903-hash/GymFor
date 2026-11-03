/**
 * Puerto agnóstico de motor de base de datos de GymFor.
 *
 * Aísla a los repositorios, migraciones, semilla y stores de `expo-sqlite`
 * para permitir cambiar de motor SQL (PostgreSQL, MySQL, LibSQL/Turso,
 * OP-SQLite, `node:sqlite`) o de paradigma de persistencia sin reescribir
 * capas superiores.
 */

/** Dialectos SQL contemplados por las utilidades de portabilidad. */
export type DialectoSQL = 'sqlite' | 'postgres' | 'mysql' | 'generico'

/** Valores primitivos aceptados como parámetros posicionales de consulta. */
export type ValorParametroBD = string | number | boolean | null | Uint8Array

/**
 * Contrato mínimo de una conexión SQL asíncrona.
 *
 * Compatible estructuralmente con `expo-sqlite`, el adaptador `node:sqlite`
 * de los tests de integración y cualquier driver SQL envuelto por un
 * `AdaptadorMotorBD`.
 */
export interface ConexionBD {
  /** Dialecto del motor subyacente (por defecto `'sqlite'` si se omite). */
  readonly dialecto?: DialectoSQL

  /** Ejecuta una sentencia de mutación (`INSERT`, `UPDATE`, `DELETE`). */
  runAsync(sql: string, params?: ValorParametroBD[]): Promise<unknown>

  /** Devuelve la primera fila resultante o `null` si no hay coincidencias. */
  getFirstAsync<T>(sql: string, params?: ValorParametroBD[]): Promise<T | null>

  /** Devuelve todas las filas resultantes de una consulta `SELECT`. */
  getAllAsync<T>(sql: string, params?: ValorParametroBD[]): Promise<T[]>

  /** Ejecuta uno o varios bloques DDL/SQL sin parámetros. */
  execAsync(sql: string): Promise<void>

  /**
   * Ejecuta `tarea` dentro de una transacción atómica (`COMMIT` al resolver,
   * `ROLLBACK` si lanza). Portátil en nativo, web y motores SQL remotos.
   */
  withTransactionAsync(tarea: () => Promise<void>): Promise<void>

  /** Cierra la conexión si el motor mantiene recursos abiertos. */
  closeAsync?(): Promise<void>
}

/**
 * Estrategia de persistencia de la versión del esquema y autorreparación.
 *
 * - En SQLite usa `PRAGMA user_version` + `sqlite_master` (retrocompatible con
 *   bases de datos ya instaladas en dispositivos).
 * - En otros motores SQL usa una tabla de control (`_esquema_migraciones`) +
 *   `information_schema`.
 */
export interface GestorMetadatosMigracion {
  obtenerVersion(db: ConexionBD): Promise<number>
  establecerVersion(db: ConexionBD, version: number): Promise<void>
  repararInconsistencia?(db: ConexionBD, tablasEsperadas: readonly string[]): Promise<void>
}

/**
 * Adaptador de un motor concreto de base de datos.
 *
 * Para migrar a otro motor SQL basta con implementar esta interfaz y
 * registrarla con `configurarAdaptadorBD` en `src/db/client.ts`.
 * Para motores no-SQL (Firestore, Realm, WatermelonDB, API REST), puede
 * combinarse con `inicializarPersonalizado` y `configurarProveedorPersistencia`.
 */
export interface AdaptadorMotorBD {
  readonly nombre: string
  readonly dialecto: DialectoSQL
  /** Abre y devuelve una conexión lista para operar. */
  abrir(): Promise<ConexionBD>
  /** Pragmas o ajustes de sesión específicos del motor al abrir conexión. */
  configurarConexion?(db: ConexionBD): Promise<void>
  /** Gestor opcional de metadatos de migración propio del motor. */
  readonly gestorMigraciones?: GestorMetadatosMigracion
  /**
   * Gancho opcional que sustituye el pipeline SQL por defecto (migraciones +
   * seed) cuando el backend no es relacional o gestiona su esquema en servidor.
   */
  inicializarPersonalizado?(db: ConexionBD): Promise<void>
}
