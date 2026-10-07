/**
 * Store de sesiones de entrenamiento (MVP).
 *
 * Maneja la sesión en curso (registro de series) y el historial.
 * Delega la persistencia en `src/db/repositories/sesion.repository.ts`.
 */

import { create } from 'zustand'

import type {
  SesionEntrenamiento,
  SesionDetalle,
  NuevaSesion,
  RegistroEjercicio,
  SerieReal,
} from '../domain/types'
import { ejecutarAccion, type EstadoCarga } from './utilidades'
import {
  crearSesion,
  agregarSerie,
  obtenerSesionDetalle,
  listarSesionesPorUsuario,
} from '../db/repositories/sesion.repository'
import { obtenerRutinaDetalle, type RutinaDetalle } from '../db/repositories/rutina.repository'
import { generarId, ahoraISO } from '../utils/id'

interface RegistroEnCurso {
  registro_id: string
  ejercicio_id: string
  ejercicio_nombre: string
  rpe_ejercicio: number | null
  series: SerieReal[]
}

interface SesionEnCurso {
  sesion: SesionEntrenamiento
  registros: RegistroEnCurso[]
}

export interface SesionEstado extends EstadoCarga {
  sesionActual: SesionEnCurso | null
  sesiones: SesionEntrenamiento[]
  iniciarSesion: (params: {
    rutinaId: string
    diaRutinaId: string
    usuarioId: string
  }) => Promise<void>
  agregarSerie: (registroId: string, serie: Omit<SerieReal, 'id' | 'registro_id'>) => Promise<void>
  actualizarSerie: (registroId: string, numeroSerie: number, cambios: Partial<SerieReal>) => void
  eliminarSerie: (registroId: string, numeroSerie: number) => void
  finalizarSesion: (params?: {
    duracion_minutos?: number
    notas?: string
    rpe_sesion?: number
  }) => Promise<void>
  cancelarSesion: () => void
  cargarHistorial: (usuarioId: string, rango?: { desde?: string; hasta?: string }) => Promise<void>
  limpiarError: () => void
}

function crearRegistrosDesdeRutina(
  rutinaDetalle: RutinaDetalle,
): RegistroEnCurso[] {
  return rutinaDetalle.dias.flatMap((dia) =>
    dia.ejercicios.map((ej) => ({
      registro_id: generarId(),
      ejercicio_id: ej.ejercicio_id,
      ejercicio_nombre: ej.ejercicio_nombre,
      rpe_ejercicio: null,
      series: [],
    }))
  )
}

export const useSesionStore = create<SesionEstado>((set, get) => ({
  sesionActual: null,
  sesiones: [],
  cargando: false,
  error: null,

  iniciarSesion: async ({ rutinaId, diaRutinaId, usuarioId }) => {
    await ejecutarAccion(set, async (db) => {
      const rutinaDetalle: RutinaDetalle | null = await obtenerRutinaDetalle(db, rutinaId)
      if (!rutinaDetalle) {
        throw new Error(`Rutina no encontrada: ${rutinaId}`)
      }
      const dia = rutinaDetalle?.dias.find((d) => d.id === diaRutinaId)
      if (!dia) {
        throw new Error(`Día de rutina no encontrado: ${diaRutinaId}`)
      }

      const ahora = ahoraISO()
      const sesionId = generarId()
      const registros = dia.ejercicios.map((ej) => ({
        registro_id: generarId(),
        ejercicio_id: ej.ejercicio_id,
        ejercicio_nombre: ej.ejercicio_nombre,
        rpe_ejercicio: null,
        series: [] as SerieReal[],
      }))

      const nuevaSesion: NuevaSesion = {
        sesion: {
          id: sesionId,
          usuario_id: usuarioId,
          dia_rutina_id: diaRutinaId,
          fecha: ahora.split('T')[0],
          duracion_minutos: null,
          notas: null,
          rpe_sesion: null,
        },
        registros: registros.map((r) => ({
          ejercicio_id: r.ejercicio_id,
          rpe_ejercicio: null,
          series: [],
        })),
      }

      await crearSesion(db, nuevaSesion)

      return {
        sesion: {
          ...nuevaSesion.sesion,
          creado_en: ahora,
          actualizado_en: ahora,
          sincronizado: 0 as const,
        },
        registros,
      }
    }, (resultado) => ({ sesionActual: resultado }))
  },

  agregarSerie: async (registroId, serie) => {
    const { sesionActual } = get()
    if (!sesionActual) {
      set({ error: 'No hay sesión activa' })
      return
    }

    await ejecutarAccion(set, async (db) => {
      const serieCompleta: SerieReal = {
        ...serie,
        id: generarId(),
        registro_id: registroId,
      }
      await agregarSerie(db, registroId, serieCompleta)
      return serieCompleta
    }, (serieGuardada) => {
      const registros = sesionActual.registros.map((r) =>
        r.registro_id === registroId
          ? { ...r, series: [...r.series, serieGuardada].sort((a, b) => a.numero_serie - b.numero_serie) }
          : r
      )
      return { sesionActual: { ...sesionActual, registros } }
    })
  },

  actualizarSerie: (registroId, numeroSerie, cambios) => {
    const { sesionActual } = get()
    if (!sesionActual) return

    const registros = sesionActual.registros.map((r) =>
      r.registro_id === registroId
        ? {
            ...r,
            series: r.series.map((s) =>
              s.numero_serie === numeroSerie ? { ...s, ...cambios } : s
            ),
          }
        : r
    )
    set({ sesionActual: { ...sesionActual, registros } })
  },

  eliminarSerie: (registroId, numeroSerie) => {
    const { sesionActual } = get()
    if (!sesionActual) return

    const registros = sesionActual.registros.map((r) =>
      r.registro_id === registroId
        ? { ...r, series: r.series.filter((s) => s.numero_serie !== numeroSerie) }
        : r
    )
    set({ sesionActual: { ...sesionActual, registros } })
  },

  finalizarSesion: async (params) => {
    const { sesionActual } = get()
    if (!sesionActual) {
      set({ error: 'No hay sesión activa para finalizar' })
      return
    }

    await ejecutarAccion(set, async (db) => {
      // Actualizar la sesión en BD con los datos finales
      await db.runAsync(
        `UPDATE sesiones
         SET duracion_minutos = ?, notas = ?, rpe_sesion = ?, actualizado_en = ?, sincronizado = 0
         WHERE id = ?`,
        [
          params?.duracion_minutos ?? null,
          params?.notas ?? null,
          params?.rpe_sesion ?? null,
          ahoraISO(),
          sesionActual.sesion.id,
        ],
      )
      return sesionActual.sesion.id
    }, () => {
      const sesionFinalizada: SesionEntrenamiento = {
        ...sesionActual.sesion,
        duracion_minutos: params?.duracion_minutos ?? null,
        notas: params?.notas ?? null,
        rpe_sesion: params?.rpe_sesion ?? null,
        actualizado_en: ahoraISO(),
        sincronizado: 0,
      }
      return {
        sesionActual: null,
        sesiones: [sesionFinalizada, ...get().sesiones],
      }
    })
  },

  cancelarSesion: () => set({ sesionActual: null, error: null }),

  cargarHistorial: async (usuarioId, rango) => {
    await ejecutarAccion(set, async (db) => {
      const sesiones = await listarSesionesPorUsuario(db, usuarioId, rango)
      return sesiones
    }, (sesiones) => ({ sesiones }))
  },

  limpiarError: () => set({ error: null }),
}))