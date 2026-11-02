/**
 * Store de media visual de ejercicios.
 *
 * Mantiene en memoria el mapeo de media por ejercicio y resuelve placeholders
 * de fallback para ejercicios sin asset asignado.
 */

import { create } from 'zustand'

import type { MediaEjercicio } from '../domain/media'
import {
  mediaPlaceholder,
  obtenerMediaEjercicio,
  REGISTRO_MEDIA_EJERCICIOS,
} from '../domain/media'
import { ejecutarAccion, type EstadoCarga } from './utilidades'

export interface MediaEstado extends EstadoCarga {
  mediaPorEjercicioId: Map<string, MediaEjercicio>
  cargarMediaEjercicios: () => Promise<void>
  obtenerMedia: (ejercicioId: string, ejercicioNombre?: string) => MediaEjercicio
  limpiarError: () => void
}

export const useMediaStore = create<MediaEstado>((set, get) => ({
  mediaPorEjercicioId: new Map(),
  cargando: false,
  error: null,

  cargarMediaEjercicios: async () => {
    // Idempotente: si ya está cargado no vuelve a procesar. Si falló,
    // `mediaPorEjercicioId` queda vacío y permite reintentar.
    if (get().mediaPorEjercicioId.size > 0) {
      return
    }

    await ejecutarAccion(
      set,
      async () => {
        const mapa = new Map<string, MediaEjercicio>()
        for (const [id, media] of Object.entries(REGISTRO_MEDIA_EJERCICIOS)) {
          mapa.set(id, media)
        }
        return mapa
      },
      (mediaPorEjercicioId) => ({
        mediaPorEjercicioId,
      }),
    )
  },

  obtenerMedia: (ejercicioId: string, ejercicioNombre?: string): MediaEjercicio => {
    const mapa = get().mediaPorEjercicioId
    const encontrada = mapa.get(ejercicioId) ?? obtenerMediaEjercicio(ejercicioId)
    if (encontrada) {
      return encontrada
    }
    return mediaPlaceholder(ejercicioNombre)
  },

  limpiarError: () => set({ error: null }),
}))
