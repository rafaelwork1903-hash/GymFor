/**
 * Store del catálogo maestro de ejercicios.
 *
 * Carga el catálogo completo una vez y expone un mapa por ID para que la UI
 * y los selectores (grupos musculares, factor_fraccional) accedan en O(1).
 * Delega la persistencia en `src/db/repositories/ejercicio.repository.ts`.
 */

import { create } from 'zustand'

import type { Ejercicio } from '../domain/types'
import { ejecutarAccion, type EstadoCarga } from './utilidades'
import { listarEjercicios } from '../db/repositories/ejercicio.repository'

export interface EjerciciosEstado extends EstadoCarga {
  ejercicios: Ejercicio[]
  /** Mapa por ID: acceso directo a grupos/factor_fraccional. */
  ejerciciosPorId: Map<string, Ejercicio>
  cargarEjercicios: () => Promise<void>
  limpiarError: () => void
}

function construirMapa(ejercicios: Ejercicio[]): Map<string, Ejercicio> {
  return new Map(ejercicios.map((ejercicio) => [ejercicio.id, ejercicio]))
}

export const useEjerciciosStore = create<EjerciciosEstado>((set, get) => ({
  ejercicios: [],
  ejerciciosPorId: new Map(),
  cargando: false,
  error: null,

  cargarEjercicios: async () => {
    // Catálogo maestro (estático en la práctica): si ya está cargado no
    // vuelve a la BD. Si falló, `ejercicios` queda vacío y se reintenta.
    if (get().ejercicios.length > 0) {
      return
    }
    await ejecutarAccion(set, async (db) => listarEjercicios(db), (ejercicios) => ({
      ejercicios,
      ejerciciosPorId: construirMapa(ejercicios),
    }))
  },

  limpiarError: () => set({ error: null }),
}))
