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
  SesionResumen,
  NuevaSesion,
  RegistroEjercicio,
  SerieReal,
} from '../domain/types'
import { ejecutarAccion, type EstadoCarga } from './utilidades'
import {
  crearSesion,
  agregarSerie,
  eliminarSesion,
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
  /** Nombres capturados al iniciar, para el resumen del historial. */
  rutina_nombre: string
  nombre_dia: string
}

/** Nº de sesiones recientes cuyo detalle se carga para métricas/indicadores. */
export const LIMITE_SESIONES_DETALLE = 5

export interface SesionEstado extends EstadoCarga {
  sesionActual: SesionEnCurso | null
  /** Listado del historial con nombres de rutina/día resueltos. */
  sesiones: SesionResumen[]
  /** Detalle (registros + series) de las últimas sesiones, para métricas. */
  sesionesDetalle: SesionDetalle[]
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
  /**
   * Descarta la sesión en curso: la elimina de la BD (con sus registros y
   * series vía CASCADE). A diferencia de `cancelarSesion`, no deja fila huérfana.
   */
  descartarSesion: () => Promise<void>
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
  sesionesDetalle: [],
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
        rutina_nombre: rutinaDetalle.nombre,
        nombre_dia: dia.nombre_dia,
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
      const sesionFinalizada: SesionResumen = {
        ...sesionActual.sesion,
        duracion_minutos: params?.duracion_minutos ?? null,
        notas: params?.notas ?? null,
        rpe_sesion: params?.rpe_sesion ?? null,
        actualizado_en: ahoraISO(),
        sincronizado: 0,
        rutina_nombre: sesionActual.rutina_nombre,
        nombre_dia: sesionActual.nombre_dia,
      }
      const detalleFinalizada: SesionDetalle = {
        ...sesionFinalizada,
        registros: sesionActual.registros.map((registro) => ({
          id: registro.registro_id,
          sesion_id: sesionActual.sesion.id,
          ejercicio_id: registro.ejercicio_id,
          rpe_ejercicio: registro.rpe_ejercicio,
          ejercicio_nombre: registro.ejercicio_nombre,
          series: registro.series,
        })),
      }
      return {
        sesionActual: null,
        sesiones: [sesionFinalizada, ...get().sesiones],
        sesionesDetalle: [detalleFinalizada, ...get().sesionesDetalle].slice(0, LIMITE_SESIONES_DETALLE),
      }
    })
  },

  cancelarSesion: () => set({ sesionActual: null, error: null }),

  descartarSesion: async () => {
    const { sesionActual } = get()
    if (!sesionActual) {
      set({ error: 'No hay sesión activa para descartar' })
      return
    }
    await ejecutarAccion(set, async (db) => {
      await eliminarSesion(db, sesionActual.sesion.id)
      return sesionActual.sesion.id
    }, () => ({ sesionActual: null }))
  },

  cargarHistorial: async (usuarioId, rango) => {
    await ejecutarAccion(set, async (db) => {
      const sesiones = await listarSesionesPorUsuario(db, usuarioId, rango)
      const sesionesDetalle: SesionDetalle[] = []
      for (const sesion of sesiones.slice(0, LIMITE_SESIONES_DETALLE)) {
        const detalle = await obtenerSesionDetalle(db, sesion.id)
        if (detalle) {
          sesionesDetalle.push(detalle)
        }
      }
      return { sesiones, sesionesDetalle }
    }, (resultado) => resultado)
  },

  limpiarError: () => set({ error: null }),
}))