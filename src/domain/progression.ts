/**
 * Lógica de sobrecarga progresiva y detección de estancamiento (dominio puro).
 *
 * Reglas según agent.md:
 * - Si el usuario completó todas las series al tope del rango de reps y el
 *   RPE promedio es ≤ 8 → sugerir +2.5 kg (tren superior) o +5 kg (tren inferior).
 * - Si no alcanzó el mínimo de reps en 2 sesiones consecutivas → sugerir -5-10 %.
 * - Si el 1RM estimado no mejora en 3 sesiones consecutivas → "estancado".
 */

import { calcular1RMEpley } from './metrics'
import type { GrupoMuscular, SerieReal, Tendencia } from './types'

export const INCREMENTO_TREN_SUPERIOR_KG = 2.5
export const INCREMENTO_TREN_INFERIOR_KG = 5
export const RPE_UMBRAL_PROGRESION = 8
export const FACTOR_REDUCCION_MIN = 0.9 // -10 %
export const FACTOR_REDUCCION_MAX = 0.95 // -5 %
export const SESIONES_PARA_ESTANCAMIENTO = 3

const GRUPOS_TREN_INFERIOR: readonly GrupoMuscular[] = [
  'cuadriceps',
  'isquios',
  'gluteos',
  'gemelos',
]

export function esTrenInferior(grupo: GrupoMuscular): boolean {
  return GRUPOS_TREN_INFERIOR.includes(grupo)
}

export type AccionProgresion = 'subir_peso' | 'mantener' | 'bajar_peso' | 'variar_ejercicio'

export interface SesionEjercicioResumen {
  /** Series realizadas del ejercicio en la sesión (en orden). */
  series: readonly Pick<SerieReal, 'peso_levantado' | 'reps_realizadas' | 'completada' | 'rpe_serie' | 'rir'>[]
  /** RPE medio declarado para el ejercicio en la sesión (si se conoce). */
  rpe_ejercicio: number | null
}

export interface SugerenciaProgresion {
  accion: AccionProgresion
  /** Peso sugerido para la próxima sesión (kg). */
  peso_sugerido: number
  /** Explicación legible para el usuario. */
  motivo: string
}

function rpeMedioDeSesion(resumen: SesionEjercicioResumen): number | null {
  if (resumen.rpe_ejercicio != null) {
    return resumen.rpe_ejercicio
  }
  const rpes = resumen.series
    .map((serie) => serie.rpe_serie)
    .filter((rpe): rpe is number => rpe != null)
  if (rpes.length === 0) {
    return null
  }
  return rpes.reduce((total, rpe) => total + rpe, 0) / rpes.length
}

/**
 * Sugiere el ajuste de carga para la próxima sesión según el rendimiento
 * reciente del ejercicio (sesiones ordenadas de más antigua a más reciente).
 */
export function sugerirProgresion(params: {
  /** Historial reciente (≥ 1 sesión), ordenado cronológicamente. */
  historial: readonly SesionEjercicioResumen[]
  reps_objetivo_min: number
  reps_objetivo_max: number
  grupo_muscular: GrupoMuscular
  /** Peso usado actualmente (kg). */
  peso_actual: number
}): SugerenciaProgresion {
  const { historial, reps_objetivo_min, reps_objetivo_max, grupo_muscular, peso_actual } = params
  const ultima = historial[historial.length - 1]

  if (!ultima || ultima.series.filter((s) => s.completada === 1).length === 0) {
    return {
      accion: 'mantener',
      peso_sugerido: peso_actual,
      motivo: 'Sin series completadas registradas: repetir la misma carga.',
    }
  }

  const incremento = esTrenInferior(grupo_muscular)
    ? INCREMENTO_TREN_INFERIOR_KG
    : INCREMENTO_TREN_SUPERIOR_KG

  const sesionesFallandoMinimo = contarSesionesFallandoMinimo(historial, reps_objetivo_min)

  if (sesionesFallandoMinimo >= 2) {
    return {
      accion: 'bajar_peso',
      peso_sugerido: redondearCarga(peso_actual * FACTOR_REDUCCION_MAX),
      motivo: 'No alcanzaste el mínimo de reps en 2 sesiones seguidas: reduce el peso un 5-10 %.',
    }
  }

  const seriesCompletadas = ultima.series.filter((serie) => serie.completada === 1)
  const todasAlTope = seriesCompletadas.every((serie) => serie.reps_realizadas >= reps_objetivo_max)
  const rpeMedio = rpeMedioDeSesion(ultima)

  if (todasAlTope && (rpeMedio == null || rpeMedio <= RPE_UMBRAL_PROGRESION)) {
    return {
      accion: 'subir_peso',
      peso_sugerido: redondearCarga(peso_actual + incremento),
      motivo: `Completaste todas las series al tope de reps${rpeMedio == null ? '' : ` con RPE ≤ ${RPE_UMBRAL_PROGRESION}`}: sube ${incremento} kg.`,
    }
  }

  return {
    accion: 'mantener',
    peso_sugerido: peso_actual,
    motivo: 'Sigue con la misma carga hasta completar todas las series al tope del rango.',
  }
}

/**
 * Número de sesiones consecutivas (desde la más reciente hacia atrás) en las
 * que el usuario no alcanzó el mínimo de repeticiones en ninguna serie.
 */
export function contarSesionesFallandoMinimo(
  historial: readonly SesionEjercicioResumen[],
  reps_objetivo_min: number,
): number {
  let consecutivas = 0
  for (let i = historial.length - 1; i >= 0; i -= 1) {
    const completadas = historial[i].series.filter((serie) => serie.completada === 1)
    if (completadas.length === 0) {
      break
    }
    const algunaAlcanzoMinimo = completadas.some((serie) => serie.reps_realizadas >= reps_objetivo_min)
    if (algunaAlcanzoMinimo) {
      break
    }
    consecutivas += 1
  }
  return consecutivas
}

/** Redondea una carga al medio kilo más cercano (discos estándar de gimnasio). */
export function redondearCarga(peso: number): number {
  return Math.max(0, Math.round(peso * 2) / 2)
}

/**
 * Detecta estancamiento: true si el mejor 1RM estimado no aumenta en
 * `sesionesLimite` sesiones consecutivas del mismo ejercicio.
 */
export function detectarEstancamiento(
  historial: readonly SesionEjercicioResumen[],
  sesionesLimite: number = SESIONES_PARA_ESTANCAMIENTO,
): boolean {
  if (historial.length < sesionesLimite) {
    return false
  }
  const ultimas = historial.slice(-sesionesLimite)
  const mejores = ultimas.map((sesion) =>
    sesion.series
      .filter((serie) => serie.completada === 1)
      .reduce((mejor, serie) => Math.max(mejor, calcular1RMEpley(serie.peso_levantado, serie.reps_realizadas)), 0),
  )
  for (let i = 1; i < mejores.length; i += 1) {
    if (mejores[i] > mejores[i - 1]) {
      return false
    }
  }
  return true
}

/**
 * Tendencia de un ejercicio: "estancado" si aplica la detección, si no,
 * compara el mejor 1RM de la última sesión con la anterior.
 */
export function calcularTendencia(historial: readonly SesionEjercicioResumen[]): Tendencia {
  if (detectarEstancamiento(historial)) {
    return 'estancado'
  }
  if (historial.length < 2) {
    return 'estancado'
  }
  const mejor1RM = (sesion: SesionEjercicioResumen) =>
    sesion.series
      .filter((serie) => serie.completada === 1)
      .reduce((mejor, serie) => Math.max(mejor, calcular1RMEpley(serie.peso_levantado, serie.reps_realizadas)), 0)
  const actual = mejor1RM(historial[historial.length - 1])
  const anterior = mejor1RM(historial[historial.length - 2])
  if (actual > anterior) {
    return 'subiendo'
  }
  if (actual < anterior) {
    return 'bajando'
  }
  return 'estancado'
}
