/**
 * Utilidades puras de portabilidad entre dialectos SQL.
 *
 * Resuelve las tres divergencias habituales al migrar consultas SQLite a
 * otros motores relacionales (PostgreSQL, MySQL/MariaDB, LibSQL):
 * 1. Placeholders posicionales (`?` frente a `$1, $2, ...` en PostgreSQL).
 * 2. Inserción idempotente (`ON CONFLICT DO NOTHING` frente a `INSERT IGNORE`).
 * 3. Coerción de booleanos (`INTEGER 0/1` frente a `BOOLEAN true/false`).
 */

import type { ConexionBD, DialectoSQL, ValorParametroBD } from './port'

/**
 * Traduce los placeholders posicionales `?` de una consulta al formato del
 * dialecto destino, ignorando los `?` dentro de literales `'...'`,
 * identificadores `"..."` y comentarios SQL (`-- ...`, `/* ... *\/`).
 */
export function traducirPlaceholdersPosicionales(
  sql: string,
  dialecto: DialectoSQL,
): string {
  if (dialecto !== 'postgres') {
    return sql
  }

  let resultado = ''
  let indiceParametro = 0
  let i = 0
  const longitud = sql.length

  while (i < longitud) {
    const ch = sql[i]
    const sig = sql[i + 1]

    // Literal de cadena SQL '...' (con escape '')
    if (ch === "'") {
      resultado += ch
      i += 1
      while (i < longitud) {
        const actual = sql[i]
        resultado += actual
        i += 1
        if (actual === "'") {
          if (sql[i] === "'") {
            resultado += "'"
            i += 1
          } else {
            break
          }
        }
      }
      continue
    }

    // Identificador entrecomillado "..." (con escape "")
    if (ch === '"') {
      resultado += ch
      i += 1
      while (i < longitud) {
        const actual = sql[i]
        resultado += actual
        i += 1
        if (actual === '"') {
          if (sql[i] === '"') {
            resultado += '"'
            i += 1
          } else {
            break
          }
        }
      }
      continue
    }

    // Comentario de línea -- ...
    if (ch === '-' && sig === '-') {
      while (i < longitud && sql[i] !== '\n') {
        resultado += sql[i]
        i += 1
      }
      continue
    }

    // Comentario de bloque /* ... */
    if (ch === '/' && sig === '*') {
      resultado += '/*'
      i += 2
      while (i < longitud && !(sql[i] === '*' && sql[i + 1] === '/')) {
        resultado += sql[i]
        i += 1
      }
      if (i < longitud) {
        resultado += '*/'
        i += 2
      }
      continue
    }

    if (ch === '?') {
      indiceParametro += 1
      resultado += `$${indiceParametro}`
      i += 1
      continue
    }

    resultado += ch
    i += 1
  }

  return resultado
}

/**
 * Construye una sentencia `INSERT` idempotente (ignora filas con conflicto de
 * clave primaria o restricción `UNIQUE`) según el dialecto SQL:
 * - SQLite (>= 3.35), PostgreSQL y genérico: `INSERT INTO ... ON CONFLICT [(<col>)] DO NOTHING`
 * - MySQL / MariaDB: `INSERT IGNORE INTO ...`
 */
export function construirInsertarIgnorandoDuplicado(
  tabla: string,
  columnas: readonly string[],
  dialecto: DialectoSQL = 'sqlite',
  columnaConflicto?: string,
): string {
  const listaColumnas = columnas.join(', ')
  const placeholders = columnas.map(() => '?').join(', ')

  if (dialecto === 'mysql') {
    return `INSERT IGNORE INTO ${tabla} (${listaColumnas}) VALUES (${placeholders})`
  }

  const objetivo = columnaConflicto ? ` (${columnaConflicto})` : ''
  return `INSERT INTO ${tabla} (${listaColumnas}) VALUES (${placeholders}) ON CONFLICT${objetivo} DO NOTHING`
}

/**
 * Normaliza un campo booleano leído desde cualquier motor de BD al tipo `0 | 1`
 * del dominio (`INTEGER 0/1` en SQLite/MySQL o `BOOLEAN true/false` en Postgres).
 */
export function aEnteroBooleano(valor: unknown): 0 | 1 {
  return valor === 1 || valor === true || valor === '1' ? 1 : 0
}

/**
 * Envuelve una `ConexionBD` para traducir automáticamente los placeholders `?`
 * de los repositorios al formato del dialecto destino (p. ej. `$1, $2` en Postgres).
 */
export function envolverConexionConDialecto(
  base: ConexionBD,
  dialecto: DialectoSQL,
): ConexionBD {
  if (dialecto !== 'postgres') {
    if (base.dialecto === dialecto) {
      return base
    }
    return {
      dialecto,
      runAsync: (sql, params) => base.runAsync(sql, params),
      getFirstAsync: (sql, params) => base.getFirstAsync(sql, params),
      getAllAsync: (sql, params) => base.getAllAsync(sql, params),
      execAsync: (sql) => base.execAsync(sql),
      withTransactionAsync: (tarea) => base.withTransactionAsync(tarea),
      closeAsync: base.closeAsync ? () => base.closeAsync!() : undefined,
    }
  }

  return {
    dialecto,
    runAsync: (sql: string, params?: ValorParametroBD[]) =>
      base.runAsync(traducirPlaceholdersPosicionales(sql, dialecto), params),
    getFirstAsync: <T>(sql: string, params?: ValorParametroBD[]) =>
      base.getFirstAsync<T>(traducirPlaceholdersPosicionales(sql, dialecto), params),
    getAllAsync: <T>(sql: string, params?: ValorParametroBD[]) =>
      base.getAllAsync<T>(traducirPlaceholdersPosicionales(sql, dialecto), params),
    execAsync: (sql: string) => base.execAsync(sql),
    withTransactionAsync: (tarea: () => Promise<void>) => base.withTransactionAsync(tarea),
    closeAsync: base.closeAsync ? () => base.closeAsync!() : undefined,
  }
}
