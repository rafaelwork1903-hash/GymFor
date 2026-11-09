/**
 * Migraciones de base de datos agnósticas de motor.
 *
 * Cada migración tiene `up` y `down`, por lo que son reversibles.
 * - En SQLite (`dialecto === 'sqlite'`), la versión se persiste en
 *   `PRAGMA user_version` para conservar compatibilidad total con bases de
 *   datos ya desplegadas en dispositivos.
 * - En otros motores SQL (`postgres`, `mysql`, `generico`), la versión se
 *   persiste en una tabla ANSI SQL `_esquema_migraciones` mediante
 *   `crearGestorMetadatosTabla`.
 */

import { ahoraISO } from '../utils/id'
import type { ConexionBD, GestorMetadatosMigracion } from './port'
import {
  ESQUEMA_VERSION_1,
  ESQUEMA_VERSION_1_DOWN,
  ESQUEMA_VERSION_2,
  ESQUEMA_VERSION_2_DOWN,
  ESQUEMA_VERSION_3,
  ESQUEMA_VERSION_3_DOWN,
} from './schema'

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
  {
    version: 2,
    nombre: 'imagen_ejercicio_en_rutina',
    up: ESQUEMA_VERSION_2,
    down: ESQUEMA_VERSION_2_DOWN,
  },
  {
    version: 3,
    nombre: 'estado_sesion',
    up: ESQUEMA_VERSION_3,
    down: ESQUEMA_VERSION_3_DOWN,
  },
]

/** Tablas que la última versión del esquema debe contener. */
export const TABLAS_ESQUEMA = [
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
 * Estrategia para SQLite: usa `PRAGMA user_version` y `sqlite_master`.
 * Conserva compatibilidad 100% con instalaciones previas de GymFor.
 */
export const gestorMetadatosSQLite: GestorMetadatosMigracion = {
  async obtenerVersion(db: ConexionBD): Promise<number> {
    const fila = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version')
    return fila?.user_version ?? 0
  },

  async establecerVersion(db: ConexionBD, version: number): Promise<void> {
    if (!Number.isInteger(version) || version < 0) {
      throw new Error(`Versión de esquema inválida: ${version}`)
    }
    await db.execAsync(`PRAGMA user_version = ${version}`)
  },

  async repararInconsistencia(
    db: ConexionBD,
    tablasEsperadas: readonly string[],
  ): Promise<void> {
    const version = await this.obtenerVersion(db)
    if (version === 0) {
      return
    }

    const filas = await db.getAllAsync<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type = 'table'`,
    )
    const tablasExistentes = new Set(filas.map((fila) => fila.name))
    const faltanTablas = tablasEsperadas.some((tabla) => !tablasExistentes.has(tabla))

    if (faltanTablas) {
      await db.execAsync('PRAGMA user_version = 0')
      return
    }

    if (version >= 2) {
      const columnas = await db.getAllAsync<{ name: string }>(
        'PRAGMA table_info(ejercicios_en_rutina)',
      )
      if (!columnas.some((col) => col.name === 'imagen_url')) {
        await db.execAsync('PRAGMA user_version = 1')
        return
      }
    }

    if (version >= 3) {
      const columnasSesiones = await db.getAllAsync<{ name: string }>(
        'PRAGMA table_info(sesiones)',
      )
      if (!columnasSesiones.some((col) => col.name === 'finalizada')) {
        await db.execAsync('PRAGMA user_version = 2')
      }
    }
  },
}

/**
 * Estrategia ANSI SQL basada en tabla de metadatos (`_esquema_migraciones`),
 * lista para motores sin `PRAGMA user_version` (PostgreSQL, MySQL, LibSQL, etc.).
 */
export function crearGestorMetadatosTabla(
  nombreTabla = '_esquema_migraciones',
): GestorMetadatosMigracion {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(nombreTabla)) {
    throw new Error(`Nombre de tabla de migraciones inválido: ${nombreTabla}`)
  }

  const asegurarTabla = async (db: ConexionBD): Promise<void> => {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS ${nombreTabla} (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        version INTEGER NOT NULL CHECK (version >= 0),
        actualizado_en TEXT NOT NULL
      );
    `)
  }

  return {
    async obtenerVersion(db: ConexionBD): Promise<number> {
      await asegurarTabla(db)
      const fila = await db.getFirstAsync<{ version: number }>(
        `SELECT version FROM ${nombreTabla} WHERE id = ?`,
        [1],
      )
      return fila?.version != null ? Number(fila.version) : 0
    },

    async establecerVersion(db: ConexionBD, version: number): Promise<void> {
      if (!Number.isInteger(version) || version < 0) {
        throw new Error(`Versión de esquema inválida: ${version}`)
      }
      await asegurarTabla(db)
      const actual = await db.getFirstAsync<{ id: number }>(
        `SELECT id FROM ${nombreTabla} WHERE id = ?`,
        [1],
      )
      const ahora = ahoraISO()
      if (actual) {
        await db.runAsync(
          `UPDATE ${nombreTabla} SET version = ?, actualizado_en = ? WHERE id = ?`,
          [version, ahora, 1],
        )
      } else {
        await db.runAsync(
          `INSERT INTO ${nombreTabla} (id, version, actualizado_en) VALUES (?, ?, ?)`,
          [1, version, ahora],
        )
      }
    },
  }
}

const gestorMetadatosTablaPorDefecto = crearGestorMetadatosTabla()

function resolverGestor(
  db: ConexionBD,
  gestor?: GestorMetadatosMigracion,
): GestorMetadatosMigracion {
  if (gestor) {
    return gestor
  }
  return (db.dialecto ?? 'sqlite') === 'sqlite'
    ? gestorMetadatosSQLite
    : gestorMetadatosTablaPorDefecto
}

/** Versión actual del esquema aplicada en la base de datos (0 = vacía). */
export async function obtenerVersionActual(
  db: ConexionBD,
  gestor?: GestorMetadatosMigracion,
): Promise<number> {
  return resolverGestor(db, gestor).obtenerVersion(db)
}

/**
 * Aplica todas las migraciones pendientes hasta la última versión.
 * Cada migración se ejecuta en una transacción.
 */
export async function migrarALaUltimaVersion(
  db: ConexionBD,
  gestor?: GestorMetadatosMigracion,
): Promise<number> {
  return migrarAVersion(db, MIGRACIONES[MIGRACIONES.length - 1]?.version ?? 0, gestor)
}

/**
 * Repara una base de datos inconsistente cuando el gestor del motor lo
 * soporta (p. ej. arranque inicial interrumpido en SQLite con `user_version > 0`
 * y tablas ausentes).
 */
export async function repararVersionInconsistente(
  db: ConexionBD,
  gestor?: GestorMetadatosMigracion,
): Promise<void> {
  const resuelto = resolverGestor(db, gestor)
  if (resuelto.repararInconsistencia) {
    await resuelto.repararInconsistencia(db, TABLAS_ESQUEMA)
  }
}

/**
 * Reparación de datos portátil (ANSI SQL): garantiza la invariante "a lo sumo
 * una rutina activa". Conserva activa la más recientemente actualizada.
 * Evita subconsultas `NOT IN (... LIMIT 1)` sobre la misma tabla modificada
 * para ser compatible con PostgreSQL, MySQL y SQLite por igual.
 */
export async function repararRutinasActivasMultiples(db: ConexionBD): Promise<void> {
  const activas = await db.getAllAsync<{ id: string }>(
    'SELECT id FROM rutinas WHERE activa = 1 ORDER BY actualizado_en DESC, id ASC',
  )
  if (activas.length <= 1) {
    return
  }
  await db.runAsync(
    'UPDATE rutinas SET activa = 0, sincronizado = 0 WHERE activa = 1 AND id <> ?',
    [activas[0].id],
  )
}

/**
 * Migra la base de datos a `versionObjetivo` aplicando migraciones `up` (si
 * hay que subir) o `down` (si hay que bajar). Devuelve la versión resultante.
 */
export async function migrarAVersion(
  db: ConexionBD,
  versionObjetivo: number,
  gestor?: GestorMetadatosMigracion,
): Promise<number> {
  const resuelto = resolverGestor(db, gestor)
  const versionActual = await resuelto.obtenerVersion(db)

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
          await resuelto.establecerVersion(db, migracion.version)
        })
      }
    }
    return versionObjetivo
  }

  const haciaAbajo = [...MIGRACIONES]
    .sort((a, b) => b.version - a.version)
    .filter(
      (migracion) => migracion.version > versionObjetivo && migracion.version <= versionActual,
    )
  for (const migracion of haciaAbajo) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(migracion.down)
      await resuelto.establecerVersion(db, migracion.version - 1)
    })
  }
  return versionObjetivo
}
