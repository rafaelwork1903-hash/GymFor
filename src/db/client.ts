/**
 * Punto de acceso centralizado y desacoplado a la persistencia de GymFor.
 *
 * - Por defecto utiliza `crearAdaptadorExpoSQLite` (`expo-sqlite`).
 * - Permite sustituir el motor SQL en caliente con `configurarAdaptadorBD`
 *   o sustituir toda la capa de persistencia (p. ej. NoSQL / API remota) con
 *   `configurarProveedorPersistencia`, sin modificar pantallas ni stores.
 */

import { crearAdaptadorExpoSQLite, NOMBRE_BD_SQLITE } from './adapters/expo-sqlite.adapter'
import {
  migrarALaUltimaVersion,
  repararRutinasActivasMultiples,
  repararVersionInconsistente,
} from './migrations'
import type { AdaptadorMotorBD, ConexionBD } from './port'
import { configurarRepositoriosPersonalizados, type FabricaRepositorios } from './registry'
import { sembrarDatosIniciales } from './seed'

export const NOMBRE_BD = NOMBRE_BD_SQLITE

let adaptadorActivo: AdaptadorMotorBD = crearAdaptadorExpoSQLite(NOMBRE_BD)
let promesaConexion: Promise<ConexionBD> | null = null
let promesaInicializada: Promise<ConexionBD> | null = null

function abrirConexionSingleton(): Promise<ConexionBD> {
  if (!promesaConexion) {
    promesaConexion = (async () => {
      const db = await adaptadorActivo.abrir()
      if (adaptadorActivo.configurarConexion) {
        await adaptadorActivo.configurarConexion(db)
      }
      return db
    })().catch((error: unknown) => {
      promesaConexion = null
      throw error
    })
  }
  return promesaConexion
}

/** Devuelve la conexión activa a la base de datos de la app. */
export function obtenerBD(): Promise<ConexionBD> {
  return promesaInicializada ?? abrirConexionSingleton()
}

/**
 * Inicializa una conexión de base de datos: configuración del motor,
 * migraciones, semilla idempotente y reparaciones de invariantes.
 * Si el adaptador define `inicializarPersonalizado` (p. ej. motor NoSQL o
 * backend remoto), delega en él en lugar del pipeline SQL local.
 */
export async function inicializarBD(db: ConexionBD): Promise<void> {
  if (adaptadorActivo.inicializarPersonalizado) {
    await adaptadorActivo.inicializarPersonalizado(db)
    return
  }

  if ((db.dialecto ?? 'sqlite') === 'sqlite') {
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
    `)
  }

  const gestor = adaptadorActivo.gestorMigraciones
  await repararVersionInconsistente(db, gestor)
  await migrarALaUltimaVersion(db, gestor)
  await sembrarDatosIniciales(db)
  await repararRutinasActivasMultiples(db)
}

/**
 * Abre e inicializa la base de datos una única vez de forma serializada.
 * Si falla, limpia la promesa cacheada para que un reintento posterior
 * (p. ej. desde `ErrorBoundary`) vuelva a ejecutar la apertura e init.
 */
export function asegurarBaseDatosLista(): Promise<ConexionBD> {
  if (!promesaInicializada) {
    promesaInicializada = (async () => {
      const db = await abrirConexionSingleton()
      await inicializarBD(db)
      return db
    })().catch((error: unknown) => {
      promesaInicializada = null
      promesaConexion = null
      throw error
    })
  }
  return promesaInicializada
}

/** Devuelve el adaptador de motor de base de datos actualmente registrado. */
export function obtenerAdaptadorBD(): AdaptadorMotorBD {
  return adaptadorActivo
}

/** Cierra la conexión abierta (si existe) y limpia las promesas singleton. */
export async function reiniciarConexionBD(): Promise<void> {
  const actual = promesaConexion
  promesaConexion = null
  promesaInicializada = null

  if (actual) {
    try {
      const db = await actual
      if (db.closeAsync) {
        await db.closeAsync()
      }
    } catch {
      // Si la apertura previa había fallado no hay recurso abierto que cerrar.
    }
  }
}

/**
 * Registra un nuevo motor de base de datos SQL (PostgreSQL, MySQL, LibSQL,
 * OP-SQLite, memoria…) cerrando ordenadamente cualquier conexión previa.
 */
export async function configurarAdaptadorBD(nuevoAdaptador: AdaptadorMotorBD): Promise<void> {
  await reiniciarConexionBD()
  adaptadorActivo = nuevoAdaptador
}

/**
 * Configura de una sola vez tanto el adaptador de conexión como una fábrica
 * opcional de repositorios (útil al migrar a motores NoSQL o APIs remotas).
 */
export async function configurarProveedorPersistencia(opciones: {
  adaptador: AdaptadorMotorBD
  crearRepositorios?: FabricaRepositorios | null
}): Promise<void> {
  await configurarAdaptadorBD(opciones.adaptador)
  configurarRepositoriosPersonalizados(opciones.crearRepositorios ?? null)
}

/** Restaura el proveedor por defecto (`expo-sqlite` + repositorios SQL). */
export async function restaurarProveedorPorDefecto(): Promise<void> {
  await configurarProveedorPersistencia({
    adaptador: crearAdaptadorExpoSQLite(NOMBRE_BD),
    crearRepositorios: null,
  })
}
