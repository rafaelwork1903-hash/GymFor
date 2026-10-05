/**
 * Cálculos de métricas de entrenamiento (dominio puro, sin dependencias).
 *
 * Fórmulas según agent.md:
 * - 1RM estimado (Epley): peso × (1 + 0.0333 × reps)
 * - Volumen: Σ(peso × reps) por serie completada
 * - Series efectivas: directas × 1.0 + indirectas × 0.5
 */

import {
  FACTOR_FRACCIONAL_INDIRECTO,
  type Ejercicio,
  type GrupoMuscular,
  type SerieReal,
} from './types'

/** Coeficiente de la fórmula de Epley. */
export const COEFICIENTE_EPLEY = 0.0333

/**
 * Estima el 1RM con la fórmula de Epley.
 * Con 1 repetición el 1RM es el propio peso levantado.
 */
export function calcular1RMEpley(peso: number, reps: number): number {
  if (peso < 0 || reps < 0) {
    throw new Error('El peso y las repeticiones deben ser >= 0')
  }
  if (reps <= 1) {
    return peso
  }
  return peso * (1 + COEFICIENTE_EPLEY * reps)
}

/** Convierte RPE (1-10) a RIR (repeticiones en reserva). */
export function rpeARir(rpe: number): number {
  return Math.max(0, 10 - rpe)
}

/** Convierte RIR a RPE (1-10). */
export function rirARpe(rir: number): number {
  return Math.max(1, 10 - rir)
}

/** Volumen de una serie completada: peso × reps. */
export function calcularVolumenSerie(serie: Pick<SerieReal, 'peso_levantado' | 'reps_realizadas'>): number {
  return serie.peso_levantado * serie.reps_realizadas
}

/**
 * Volumen total de una lista de series.
 * Solo cuentan las series marcadas como completadas.
 */
export function calcularVolumenTotal(
  series: readonly Pick<SerieReal, 'peso_levantado' | 'reps_realizadas' | 'completada'>[],
): number {
  return series
    .filter((serie) => serie.completada === 1)
    .reduce((total, serie) => total + calcularVolumenSerie(serie), 0)
}

/** Mejor 1RM estimado de una lista de series completadas (0 si no hay series válidas). */
export function calcularMejor1RM(
  series: readonly Pick<SerieReal, 'peso_levantado' | 'reps_realizadas' | 'completada'>[],
): number {
  return series
    .filter((serie) => serie.completada === 1)
    .reduce((mejor, serie) => Math.max(mejor, calcular1RMEpley(serie.peso_levantado, serie.reps_realizadas)), 0)
}

/** Aporte de series de un ejercicio realizado dentro de la semana. */
export interface AporteSeries {
  ejercicio: Pick<Ejercicio, 'grupo_muscular_primario' | 'grupos_musculares_secundarios' | 'factor_fraccional'>
  /** Número de series directas completadas del ejercicio. */
  series_directas: number
}

/**
 * Series efectivas semanales de un grupo muscular.
 *
 * - Ejercicios cuyo grupo primario es el objetivo: series × factor_fraccional.
 * - Ejercicios donde es grupo secundario: series × 0.5 (volumen indirecto).
 */
export function calcularSeriesEfectivas(
  grupo: GrupoMuscular,
  aportes: readonly AporteSeries[],
): number {
  return aportes.reduce((total, { ejercicio, series_directas }) => {
    if (ejercicio.grupo_muscular_primario === grupo) {
      return total + series_directas * (ejercicio.factor_fraccional ?? 1)
    }
    if (ejercicio.grupos_musculares_secundarios.includes(grupo)) {
      return total + series_directas * FACTOR_FRACCIONAL_INDIRECTO
    }
    return total
  }, 0)
}
