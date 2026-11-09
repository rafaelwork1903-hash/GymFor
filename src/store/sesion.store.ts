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
import { useConfiguracionStore } from './configuracion.store'
import { ejecutarAccion, type EstadoCarga } from './utilidades'
import type { CambiosSerie } from '../db/repositories/sesion.repository'
import type { RutinaDetalle } from '../db/repositories/rutina.repository'
import { generarId, ahoraISO } from '../utils/id'

export type { CambiosSerie }

interface RegistroEnCurso {
  registro_id: string
  ejercicio_id: string
  ejercicio_nombre: string
  imagen_url?: string | null
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

/** Nº de sesiones cuyo detalle se precarga para la pantalla de Progreso. */
export const LIMITE_DETALLES_COMPLETOS = 30

export interface SesionEstado extends EstadoCarga {
  sesionActual: SesionEnCurso | null
  /** Sesión sin finalizar (`finalizada = 0`) detectada en BD al montar Dashboard o Sesión. */
  sesionAbierta: SesionResumen | null
  /** Listado del historial con nombres de rutina/día resueltos. */
  sesiones: SesionResumen[]
  /** Detalle (registros + series) de las últimas sesiones, para métricas. */
  sesionesDetalle: SesionDetalle[]
  /**
   * Detalle (registros + series) de hasta `LIMITE_DETALLES_COMPLETOS`
   * sesiones recientes, para métricas de progreso de largo plazo.
   */
  detallesCompletos: SesionDetalle[]
  /** Detalles de sesiones antiguas cargadas bajo demanda (clave: sesion.id). */
  detallesPorId: Record<string, SesionDetalle>
  iniciarSesion: (params: {
    rutinaId: string
    diaRutinaId: string
    usuarioId: string
  }) => Promise<void>
  /**
   * Detecta la sesión abierta más reciente (`finalizada = 0`) del usuario
   * en BD y la guarda en `sesionAbierta`.
   */
  cargarSesionAbierta: (usuarioId?: string) => Promise<void>
  /**
   * Reconstruye `sesionActual` a partir del detalle persistido de `id` y los
   * nombres de `sesionAbierta`, limpiando `sesionAbierta`. Devuelve `true`
   * si la sesión se restauró o `false` si no existe.
   */
  reanudarSesion: (id: string) => Promise<boolean>
  agregarSerie: (
    registroId: string,
    serie: Omit<SerieReal, 'id' | 'registro_id'>,
  ) => Promise<SerieReal | undefined>
  actualizarSerie: (
    registroId: string,
    serieId: string,
    cambios: CambiosSerie,
  ) => Promise<void>
  eliminarSerie: (registroId: string, serieId: string) => Promise<void>
  finalizarSesion: (params?: {
    duracion_minutos?: number
    notas?: string
    rpe_sesion?: number
  }) => Promise<void>
  /**
   * Descarta la sesión en curso: la elimina de la BD (con sus registros y
   * series vía CASCADE) y limpia `sesionActual`.
   */
  descartarSesion: () => Promise<void>
  /**
   * Elimina de la BD (con CASCADE) la sesión indicada, la sesión en curso o
   * la sesión abierta pendiente y limpia el estado sin dejar filas huérfanas.
   */
  cancelarSesion: (id?: string) => Promise<void>
  cargarHistorial: (usuarioId: string, rango?: { desde?: string; hasta?: string }) => Promise<void>
  /**
   * Carga el detalle de hasta `limite` sesiones recientes (por defecto
   * `LIMITE_DETALLES_COMPLETOS`) para la pantalla de Progreso. Reutiliza el
   * cache (`sesionesDetalle` y `detallesPorId`) para no releer sesiones ya
   * conocidas y cachea el resto en `detallesPorId`.
   */
  cargarDetallesCompletos: (usuarioId: string, limite?: number) => Promise<void>
  /**
   * Carga bajo demanda el detalle (registros + series) de una sesión antigua
   * y lo cachea en `detallesPorId`. No recarga si ya está disponible.
   */
  cargarDetalleSesion: (id: string) => Promise<void>
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

function aplicarCambiosSerieLocal(actual: SerieReal, cambios: CambiosSerie): SerieReal {
  return {
    id: actual.id,
    registro_id: actual.registro_id,
    numero_serie: actual.numero_serie,
    peso_levantado:
      cambios.peso_levantado !== undefined ? cambios.peso_levantado : actual.peso_levantado,
    reps_realizadas:
      cambios.reps_realizadas !== undefined ? cambios.reps_realizadas : actual.reps_realizadas,
    rpe_serie: cambios.rpe_serie !== undefined ? cambios.rpe_serie : actual.rpe_serie,
    rir: cambios.rir !== undefined ? cambios.rir : actual.rir,
    completada: cambios.completada !== undefined ? cambios.completada : actual.completada,
    notas: cambios.notas !== undefined ? cambios.notas : actual.notas,
  }
}

export const useSesionStore = create<SesionEstado>((set, get) => ({
  sesionActual: null,
  sesionAbierta: null,
  sesiones: [],
  sesionesDetalle: [],
  detallesCompletos: [],
  detallesPorId: {},
  cargando: false,
  error: null,

  iniciarSesion: async ({ rutinaId, diaRutinaId, usuarioId }) => {
    await ejecutarAccion(set, async (_db, repos) => {
      const rutinaDetalle: RutinaDetalle | null = await repos.rutinas.obtenerRutinaDetalle(rutinaId)
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
        imagen_url: ej.imagen_url ?? null,
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
          finalizada: 0,
        },
        // Los IDs de registro los genera este store y el repositorio los
        // inserta tal cual: `sesionActual.registros[].registro_id` coincide
        // con las filas reales de BD (FK de `series.registro_id`).
        registros: registros.map((r) => ({
          id: r.registro_id,
          ejercicio_id: r.ejercicio_id,
          rpe_ejercicio: null,
          series: [],
        })),
      }

      await repos.sesiones.crearSesion(nuevaSesion)

      return {
        sesion: {
          ...nuevaSesion.sesion,
          finalizada: 0 as const,
          creado_en: ahora,
          actualizado_en: ahora,
          sincronizado: 0 as const,
        },
        registros,
        rutina_nombre: rutinaDetalle.nombre,
        nombre_dia: dia.nombre_dia,
      }
    }, (resultado) => ({ sesionActual: resultado, sesionAbierta: null }))
  },

  cargarSesionAbierta: async (usuarioId) => {
    const idUsuario = usuarioId ?? useConfiguracionStore.getState().usuarioActivo?.id
    await ejecutarAccion(
      set,
      async (_db, repos) => repos.sesiones.obtenerSesionAbierta(idUsuario),
      (abierta) => ({ sesionAbierta: abierta ?? null }),
    )
  },

  reanudarSesion: async (id) => {
    const abierta = get().sesionAbierta
    const resultado = await ejecutarAccion(
      set,
      async (_db, repos) => {
        const detalle = await repos.sesiones.obtenerSesionDetalle(id)
        if (!detalle) {
          return null
        }
        const detalleConNombres = detalle as SesionDetalle & {
          rutina_nombre?: string | null
          nombre_dia?: string | null
        }
        const rutina_nombre =
          (abierta?.id === id ? abierta.rutina_nombre : null) ??
          abierta?.rutina_nombre ??
          detalleConNombres.rutina_nombre ??
          'Rutina'
        const nombre_dia =
          (abierta?.id === id ? abierta.nombre_dia : null) ??
          abierta?.nombre_dia ??
          detalleConNombres.nombre_dia ??
          'Día'
        const { registros: registrosDetalle, ...camposSesion } = detalle
        const sesionEnCurso: SesionEnCurso = {
          sesion: {
            id: camposSesion.id,
            usuario_id: camposSesion.usuario_id,
            dia_rutina_id: camposSesion.dia_rutina_id,
            fecha: camposSesion.fecha,
            duracion_minutos: camposSesion.duracion_minutos,
            notas: camposSesion.notas,
            rpe_sesion: camposSesion.rpe_sesion,
            finalizada: camposSesion.finalizada ?? 0,
            creado_en: camposSesion.creado_en,
            actualizado_en: camposSesion.actualizado_en,
            sincronizado: camposSesion.sincronizado,
          },
          registros: registrosDetalle.map((reg) => ({
            registro_id: reg.id,
            ejercicio_id: reg.ejercicio_id,
            ejercicio_nombre: reg.ejercicio_nombre,
            rpe_ejercicio: reg.rpe_ejercicio,
            series: [...reg.series].sort((a, b) => a.numero_serie - b.numero_serie),
          })),
          rutina_nombre,
          nombre_dia,
        }
        return sesionEnCurso
      },
      (sesionEnCurso) =>
        sesionEnCurso
          ? { sesionActual: sesionEnCurso, sesionAbierta: null }
          : { sesionAbierta: null },
    )
    return Boolean(resultado)
  },

  agregarSerie: async (registroId, serie) => {
    const { sesionActual } = get()
    if (!sesionActual) {
      set({ error: 'No hay sesión activa' })
      return undefined
    }

    return ejecutarAccion(set, async (_db, repos) => {
      const creada = await repos.sesiones.agregarSerie(registroId, serie)
      return (
        creada ?? {
          ...serie,
          id: generarId(),
          registro_id: registroId,
        }
      )
    }, (serieGuardada) => {
      const actual = get().sesionActual ?? sesionActual
      const registros = actual.registros.map((r) =>
        r.registro_id === registroId
          ? { ...r, series: [...r.series, serieGuardada].sort((a, b) => a.numero_serie - b.numero_serie) }
          : r
      )
      return { sesionActual: { ...actual, registros } }
    })
  },

  actualizarSerie: async (registroId, serieId, cambios) => {
    const { sesionActual } = get()
    if (!sesionActual) {
      set({ error: 'No hay sesión activa' })
      return
    }

    await ejecutarAccion(
      set,
      async (_db, repos) => repos.sesiones.actualizarSerie(serieId, cambios),
      (seriePersistida) => {
        const actual = get().sesionActual
        if (!actual) {
          return {}
        }
        const registros = actual.registros.map((r) =>
          r.registro_id === registroId
            ? {
                ...r,
                series: r.series
                  .map((s) =>
                    s.id === serieId
                      ? seriePersistida ?? aplicarCambiosSerieLocal(s, cambios)
                      : s,
                  )
                  .sort((a, b) => a.numero_serie - b.numero_serie),
              }
            : r,
        )
        return { sesionActual: { ...actual, registros } }
      },
    )
  },

  eliminarSerie: async (registroId, serieId) => {
    const { sesionActual } = get()
    if (!sesionActual) {
      set({ error: 'No hay sesión activa' })
      return
    }

    await ejecutarAccion(
      set,
      async (_db, repos) => {
        await repos.sesiones.eliminarSerie(serieId)
        return serieId
      },
      () => {
        const actual = get().sesionActual
        if (!actual) {
          return {}
        }
        const registros = actual.registros.map((r) => {
          if (r.registro_id !== registroId) {
            return r
          }
          const restantes = r.series
            .filter((s) => s.id !== serieId)
            .sort((a, b) => a.numero_serie - b.numero_serie)
            .map((s, indice) => ({
              ...s,
              numero_serie: indice + 1,
            }))
          return { ...r, series: restantes }
        })
        return { sesionActual: { ...actual, registros } }
      },
    )
  },

  finalizarSesion: async (params) => {
    const { sesionActual } = get()
    if (!sesionActual) {
      set({ error: 'No hay sesión activa para finalizar' })
      return
    }

    await ejecutarAccion(set, async (_db, repos) => {
      const resultado = await repos.sesiones.finalizarSesion(sesionActual.sesion.id, {
        duracion_minutos: params?.duracion_minutos ?? null,
        notas: params?.notas ?? null,
        rpe_sesion: params?.rpe_sesion ?? null,
      })
      return resultado?.actualizado_en ?? ahoraISO()
    }, (actualizadoEn) => {
      const sesionFinalizada: SesionResumen = {
        ...sesionActual.sesion,
        duracion_minutos: params?.duracion_minutos ?? null,
        notas: params?.notas ?? null,
        rpe_sesion: params?.rpe_sesion ?? null,
        finalizada: 1,
        actualizado_en: actualizadoEn,
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
        sesionAbierta:
          get().sesionAbierta?.id === sesionActual.sesion.id ? null : get().sesionAbierta,
        sesiones: [
          sesionFinalizada,
          ...get().sesiones.filter((s) => s.id !== sesionActual.sesion.id),
        ],
        sesionesDetalle: [
          detalleFinalizada,
          ...get().sesionesDetalle.filter((d) => d.id !== sesionActual.sesion.id),
        ].slice(0, LIMITE_SESIONES_DETALLE),
      }
    })
  },

  cancelarSesion: async (id) => {
    const objetivoId = id ?? get().sesionActual?.sesion.id ?? get().sesionAbierta?.id
    if (!objetivoId) {
      set({ sesionActual: null, sesionAbierta: null, error: null })
      return
    }
    await ejecutarAccion(
      set,
      async (_db, repos) => {
        await repos.sesiones.eliminarSesion(objetivoId)
        return objetivoId
      },
      (idEliminado) => ({
        sesionActual:
          get().sesionActual?.sesion.id === idEliminado ? null : get().sesionActual,
        sesionAbierta:
          get().sesionAbierta?.id === idEliminado ? null : get().sesionAbierta,
        sesiones: get().sesiones.filter((s) => s.id !== idEliminado),
        sesionesDetalle: get().sesionesDetalle.filter((d) => d.id !== idEliminado),
      }),
    )
  },

  descartarSesion: async () => {
    const { sesionActual } = get()
    if (!sesionActual) {
      set({ error: 'No hay sesión activa para descartar' })
      return
    }
    await ejecutarAccion(set, async (_db, repos) => {
      await repos.sesiones.eliminarSesion(sesionActual.sesion.id)
      return sesionActual.sesion.id
    }, (idEliminado) => ({
      sesionActual: null,
      sesionAbierta:
        get().sesionAbierta?.id === idEliminado ? null : get().sesionAbierta,
      sesiones: get().sesiones.filter((s) => s.id !== idEliminado),
      sesionesDetalle: get().sesionesDetalle.filter((d) => d.id !== idEliminado),
    }))
  },

  cargarHistorial: async (usuarioId, rango) => {
    await ejecutarAccion(set, async (_db, repos) => {
      const sesiones = await repos.sesiones.listarSesionesPorUsuario(usuarioId, rango)
      const sesionesDetalle: SesionDetalle[] = []
      for (const sesion of sesiones.slice(0, LIMITE_SESIONES_DETALLE)) {
        const detalle = await repos.sesiones.obtenerSesionDetalle(sesion.id)
        if (detalle) {
          sesionesDetalle.push(detalle)
        }
      }
      return { sesiones, sesionesDetalle }
    }, (resultado) => resultado)
  },

  cargarDetallesCompletos: async (usuarioId, limite = LIMITE_DETALLES_COMPLETOS) => {
    await ejecutarAccion(set, async (_db, repos) => {
      const sesiones = await repos.sesiones.listarSesionesPorUsuario(usuarioId)
      const recientes = sesiones.slice(0, limite)
      const { sesionesDetalle, detallesPorId } = get()
      const detalles: SesionDetalle[] = []
      for (const sesion of recientes) {
        // Cache primero: las sesiones ya conocidas no vuelven a la BD.
        const enCache =
          sesionesDetalle.find((d) => d.id === sesion.id) ?? detallesPorId[sesion.id]
        if (enCache) {
          detalles.push(enCache)
          continue
        }
        const detalle = await repos.sesiones.obtenerSesionDetalle(sesion.id)
        if (detalle) {
          detalles.push(detalle)
        }
      }
      return { sesiones, detalles }
    }, ({ sesiones, detalles }) => ({
      sesiones,
      detallesCompletos: detalles,
      detallesPorId: {
        ...get().detallesPorId,
        ...Object.fromEntries(detalles.map((d) => [d.id, d])),
      },
    }))
  },

  cargarDetalleSesion: async (id) => {
    // Cache: si el detalle ya está en `detallesPorId` o en `sesionesDetalle`
    // (últimas N sesiones), no se vuelve a la BD.
    const yaCargado =
      get().detallesPorId[id] ?? get().sesionesDetalle.find((d) => d.id === id)
    if (yaCargado) {
      return
    }
    await ejecutarAccion(set, async (_db, repos) => {
      const detalle = await repos.sesiones.obtenerSesionDetalle(id)
      if (!detalle) {
        throw new Error(`Sesión no encontrada: ${id}`)
      }
      return detalle
    }, (detalle) => ({
      detallesPorId: { ...get().detallesPorId, [detalle.id]: detalle },
    }))
  },

  limpiarError: () => set({ error: null }),
}))