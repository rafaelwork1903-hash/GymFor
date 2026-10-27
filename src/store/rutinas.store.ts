/**
 * Store de rutinas de entrenamiento.
 *
 * Maneja el listado de rutinas, la rutina seleccionada y operaciones CRUD.
 * Delega la persistencia en `src/db/repositories/rutina.repository.ts`.
 */

import { create } from 'zustand'

import type { Rutina, RutinaDetalle, NuevaRutina, RutinaEditada } from '../domain/types'
import { ejecutarAccion, type EstadoCarga } from './utilidades'
import {
  listarRutinas,
  obtenerRutinaDetalle,
  crearRutina,
  actualizarRutina,
  guardarRutina,
  activarRutina,
  desactivarRutina,
  eliminarRutina,
} from '../db/repositories/rutina.repository'

export interface RutinasEstado extends EstadoCarga {
  rutinas: Rutina[]
  rutinaSeleccionada: RutinaDetalle | null
  cargarRutinas: (usuarioId?: string | null) => Promise<void>
  seleccionarRutina: (id: string | null) => Promise<void>
  crearRutinaNueva: (rutina: NuevaRutina) => Promise<Rutina | undefined>
  actualizarRutinaExistente: (id: string, cambios: Partial<Pick<Rutina, 'nombre' | 'descripcion'>>) => Promise<void>
  guardarRutinaExistente: (id: string, datos: RutinaEditada) => Promise<RutinaDetalle | undefined>
  activarRutinaSeleccionada: (usuarioId: string) => Promise<void>
  /** Desactiva una rutina (la activa=1). Tras llamarla no hay rutina activa. */
  desactivarRutinaPorId: (id: string) => Promise<void>
  eliminarRutinaPorId: (id: string) => Promise<void>
  limpiarSeleccion: () => void
}

export const useRutinasStore = create<RutinasEstado>((set, get) => ({
  rutinas: [],
  rutinaSeleccionada: null,
  cargando: false,
  error: null,

  cargarRutinas: async (usuarioId) => {
    await ejecutarAccion(set, async (db) => {
      const rutinas = await listarRutinas(db, usuarioId ?? undefined)
      return rutinas
    }, (rutinas) => ({ rutinas }))
  },

  seleccionarRutina: async (id) => {
    if (!id) {
      set({ rutinaSeleccionada: null })
      return
    }
    await ejecutarAccion(set, async (db) => {
      const detalle = await obtenerRutinaDetalle(db, id)
      if (!detalle) {
        throw new Error(`Rutina no encontrada: ${id}`)
      }
      return detalle
    }, (rutinaSeleccionada) => ({ rutinaSeleccionada }))
  },

  crearRutinaNueva: async (rutina) => {
    return ejecutarAccion(set, async (db) => {
      const creada = await crearRutina(db, rutina)
      return creada
    }, (creada) => ({ rutinas: [...get().rutinas, creada] }))
  },

  actualizarRutinaExistente: async (id, cambios) => {
    await ejecutarAccion(set, async (db) => {
      await actualizarRutina(db, id, cambios)
      return id
    }, () => {
      const rutinas = get().rutinas.map((r) =>
        r.id === id ? { ...r, ...cambios } : r
      )
      return { rutinas }
    })
  },

  guardarRutinaExistente: async (id, datos) => {
    return ejecutarAccion(
      set,
      async (db) => {
        const guardada = await guardarRutina(db, id, datos)
        return guardada
      },
      (guardada) => {
        const rutinaBase: Rutina = {
          id: guardada.id,
          usuario_id: guardada.usuario_id,
          nombre: guardada.nombre,
          descripcion: guardada.descripcion,
          activa: guardada.activa,
          creado_en: guardada.creado_en,
          actualizado_en: guardada.actualizado_en,
          sincronizado: guardada.sincronizado,
        }
        const existe = get().rutinas.some((r) => r.id === id)
        const rutinas = existe
          ? get().rutinas.map((r) => (r.id === id ? rutinaBase : r))
          : [...get().rutinas, rutinaBase]
        return { rutinas, rutinaSeleccionada: guardada }
      },
    )
  },

  activarRutinaSeleccionada: async (usuarioId) => {
    const { rutinaSeleccionada } = get()
    if (!rutinaSeleccionada) {
      set({ error: 'No hay rutina seleccionada para activar' })
      return
    }
    await ejecutarAccion(set, async (db) => {
      await activarRutina(db, rutinaSeleccionada.id, usuarioId)
      return rutinaSeleccionada.id
    }, () => {
      const rutinas = get().rutinas.map((r) =>
        r.id === rutinaSeleccionada.id ? { ...r, activa: 1 as const } : { ...r, activa: 0 as const }
      )
      return { rutinas }
    })
  },

  eliminarRutinaPorId: async (id) => {
    await ejecutarAccion(set, async (db) => {
      await eliminarRutina(db, id)
      return id
    }, () => {
      const rutinas = get().rutinas.filter((r) => r.id !== id)
      const rutinaSeleccionada = get().rutinaSeleccionada?.id === id ? null : get().rutinaSeleccionada
      return { rutinas, rutinaSeleccionada }
    })
  },

  desactivarRutinaPorId: async (id) => {
    await ejecutarAccion(set, async (db) => {
      await desactivarRutina(db, id)
      return id
    }, () => {
      const rutinas = get().rutinas.map((r) =>
        r.id === id ? { ...r, activa: 0 as const } : r,
      )
      const rutinaSeleccionada =
        get().rutinaSeleccionada?.id === id
          ? { ...get().rutinaSeleccionada!, activa: 0 as const }
          : get().rutinaSeleccionada
      return { rutinas, rutinaSeleccionada }
    })
  },

  limpiarSeleccion: () => set({ rutinaSeleccionada: null, error: null }),
}))