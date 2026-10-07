/**
 * Selectores de progreso derivados.
 *
 * No guardan estado nuevo; computan métricas a partir de las sesiones
 * usando la lógica pura de `src/domain/metrics.ts` y `src/domain/progression.ts`.
 */

import type {
  SesionDetalle,
  Ejercicio,
  GrupoMuscular,
  Tendencia,
  SesionEjercicioResumen,
} from '../domain/types'
import {
  calcular1RMEpley,
  calcularVolumenTotal,
  calcularMejor1RM,
  calcularSeriesEfectivas,
  type AporteSeries,
} from '../domain/metrics'
import {
  detectarEstancamiento,
  calcularTendencia,
  sugerirProgresion,
  type SugerenciaProgresion,
} from '../domain/progression'

/**
 * Construye el historial de un ejercicio a partir de las sesiones completadas.
 * Ordenado cronológicamente (más antiguo primero).
 */
export function obtenerHistorialEjercicio(
  sesiones: SesionDetalle[],
  ejercicioId: string,
): SesionEjercicioResumen[] {
  const historial: SesionEjercicioResumen[] = []

  for (const sesion of sesiones) {
    const registro = sesion.registros.find((r) => r.ejercicio_id === ejercicioId)
    if (registro && registro.series.some((s) => s.completada === 1)) {
      historial.push({
        series: registro.series,
        rpe_ejercicio: registro.rpe_ejercicio,
      })
    }
  }

  return historial
}

/**
 * Resumen de progreso para un ejercicio específico.
 */
export interface ProgresoEjercicio {
  ejercicioId: string
  historial: SesionEjercicioResumen[]
  mejor1RM: number
  volumenUltimaSesion: number
  tendencia: Tendencia
  estancado: boolean
  sugerencia: SugerenciaProgresion | null
}

/**
 * Calcula el progreso completo de un ejercicio.
 */
export function calcularProgresoEjercicio(
  sesiones: SesionDetalle[],
  ejercicio: Ejercicio,
  repsObjetivoMin: number,
  repsObjetivoMax: number,
  pesoActual: number,
): ProgresoEjercicio {
  const historial = obtenerHistorialEjercicio(sesiones, ejercicio.id)

  const mejor1RM = historial.length > 0
    ? Math.max(...historial.map((h) => calcularMejor1RM(h.series)))
    : 0

  const ultimaSesion = historial[historial.length - 1]
  const volumenUltimaSesion = ultimaSesion
    ? calcularVolumenTotal(ultimaSesion.series)
    : 0

  const tendencia = historial.length >= 2 ? calcularTendencia(historial) : 'estancado'
  const estancado = detectarEstancamiento(historial)

  const sugerencia = historial.length > 0
    ? sugerirProgresion({
        historial,
        reps_objetivo_min: repsObjetivoMin,
        reps_objetivo_max: repsObjetivoMax,
        grupo_muscular: ejercicio.grupo_muscular_primario,
        peso_actual: pesoActual,
      })
    : null

  return {
    ejercicioId: ejercicio.id,
    historial,
    mejor1RM,
    volumenUltimaSesion,
    tendencia,
    estancado,
    sugerencia,
  }
}

/**
 * Series efectivas semanales por grupo muscular.
 *
 * @param sesiones - Sesiones completadas en la semana
 * @param ejerciciosPorId - Mapa de ejercicios por ID para acceder a grupos/factor_fraccional
 * @returns Mapa grupoMuscular -> series efectivas
 */
export function calcularSeriesEfectivasSemanales(
  sesiones: SesionDetalle[],
  ejerciciosPorId: Map<string, Ejercicio>,
): Record<GrupoMuscular, number> {
  const grupos: GrupoMuscular[] = [
    'pecho', 'espalda', 'hombros', 'biceps', 'triceps',
    'cuadriceps', 'isquios', 'gluteos', 'gemelos', 'core',
    'cuerpo_completo', 'movilidad',
  ]

  const aportesPorGrupo = Object.fromEntries(
    grupos.map((g) => [g, [] as AporteSeries[]]),
  ) as Record<GrupoMuscular, AporteSeries[]>

  for (const sesion of sesiones) {
    for (const registro of sesion.registros) {
      const ejercicio = ejerciciosPorId.get(registro.ejercicio_id)
      if (!ejercicio) continue

      const seriesCompletadas = registro.series.filter((s) => s.completada === 1).length
      if (seriesCompletadas === 0) continue

      // Aporte directo al grupo primario
      aportesPorGrupo[ejercicio.grupo_muscular_primario].push({
        ejercicio: {
          grupo_muscular_primario: ejercicio.grupo_muscular_primario,
          grupos_musculares_secundarios: ejercicio.grupos_musculares_secundarios,
          factor_fraccional: ejercicio.factor_fraccional,
        },
        series_directas: seriesCompletadas,
      })

      // Aporte indirecto a grupos secundarios
      for (const secundario of ejercicio.grupos_musculares_secundarios) {
        aportesPorGrupo[secundario].push({
          ejercicio: {
            grupo_muscular_primario: ejercicio.grupo_muscular_primario,
            grupos_musculares_secundarios: [],
            factor_fraccional: ejercicio.factor_fraccional,
          },
          series_directas: seriesCompletadas,
        })
      }
    }
  }

  const resultado: Record<GrupoMuscular, number> = {} as Record<GrupoMuscular, number>
  for (const grupo of grupos) {
    resultado[grupo] = calcularSeriesEfectivas(grupo, aportesPorGrupo[grupo])
  }
  return resultado
}

/**
 * Volumen total por ejercicio en un rango de sesiones.
 */
export function calcularVolumenPorEjercicio(
  sesiones: SesionDetalle[],
): Map<string, number> {
  const volumen = new Map<string, number>()

  for (const sesion of sesiones) {
    for (const registro of sesion.registros) {
      const vol = calcularVolumenTotal(registro.series)
      if (vol > 0) {
        volumen.set(registro.ejercicio_id, (volumen.get(registro.ejercicio_id) ?? 0) + vol)
      }
    }
  }

  return volumen
}