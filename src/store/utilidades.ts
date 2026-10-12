/**
 * Utilidades para la capa de estado (Zustand).
 *
 * Centraliza el acceso a la base de datos y el manejo de errores
 * para que ningún store reciba una conexión suelta ni lance errores
 * no capturados.
 */

import type { SQLiteDatabase } from 'expo-sqlite'

import { obtenerBD } from '../db/client'

/**
 * Estado base compartido por todos los stores que hacen I/O.
 */
export interface EstadoCarga {
  cargando: boolean
  error: string | null
}

/**
 * Convierte cualquier error en un mensaje legible para el usuario.
 */
export function mensajeDeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  // Errores que cruzan fronteras de VM (jest, workers) no pasan el
  // `instanceof Error` pero conservan un `message` legible (p. ej. los de
  // SQLite: "FOREIGN KEY constraint failed").
  if (typeof error === 'object' && error !== null) {
    const mensaje = (error as { message?: unknown }).message
    if (typeof mensaje === 'string' && mensaje.length > 0) {
      return mensaje
    }
  }
  if (typeof error === 'string') {
    return error
  }
  return 'Error desconocido'
}

/**
 * Ejecuta una función asíncrona recibiendo la conexión a la BD.
 * Maneja `cargando`/`error` automáticamente y nunca propaga throw.
 *
 * @param set - función `setState` de Zustand
 * @param accion - función que recibe `db: SQLiteDatabase` y devuelve `Promise<T>`
 * @param alExito - transforma el resultado en un partial state a mezclar
 * @returns el resultado de `accion` o `undefined` si falló
 */
export async function ejecutarAccion<Estado extends EstadoCarga, T>(
  set: (partial: Partial<Estado> | ((state: Estado) => Partial<Estado>)) => void,
  accion: (db: SQLiteDatabase) => Promise<T>,
  alExito: (resultado: T) => Partial<Estado>,
): Promise<T | undefined> {
  set({ cargando: true, error: null } as Partial<Estado>)
  try {
    const db = await obtenerBD()
    const resultado = await accion(db)
    set({ ...alExito(resultado), cargando: false } as Partial<Estado>)
    return resultado
  } catch (error) {
    set({ cargando: false, error: mensajeDeError(error) } as Partial<Estado>)
    return undefined
  }
}

/**
 * Versión síncrona para acciones que no necesitan BD.
 */
export function ejecutarSincrono<Estado extends EstadoCarga, T>(
  set: (partial: Partial<Estado> | ((state: Estado) => Partial<Estado>)) => void,
  accion: () => T,
  alExito: (resultado: T) => Partial<Estado>,
): T {
  set({ cargando: true, error: null } as Partial<Estado>)
  try {
    const resultado = accion()
    set({ ...alExito(resultado), cargando: false } as Partial<Estado>)
    return resultado
  } catch (error) {
    set({ cargando: false, error: mensajeDeError(error) } as Partial<Estado>)
    throw error
  }
}