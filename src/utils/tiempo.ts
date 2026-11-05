/**
 * Utilidades puras de tiempo para el cronómetro de sesión, el temporizador de
 * descanso entre series y el cálculo de duración real de entrenamiento.
 *
 * Sin dependencias de React Native ni efectos secundarios; aceptan un reloj
 * (`ahoraMs`) inyectable para pruebas deterministas.
 */

const MS_POR_SEGUNDO = 1000
const MS_POR_MINUTO = 60_000
const SEGUNDOS_POR_MINUTO = 60

/**
 * Formatea una cantidad de segundos como `MM:SS` (p. ej. `0 → "00:00"`,
 * `60 → "01:00"`, `3600 → "60:00"`). Valores negativos o no finitos se
 * normalizan a `"00:00"`.
 */
export function formatearMMSS(segundos: number): string {
  if (!Number.isFinite(segundos) || segundos <= 0) {
    return '00:00'
  }
  const totalSegundos = Math.floor(segundos)
  const minutos = Math.floor(totalSegundos / SEGUNDOS_POR_MINUTO)
  const restoSegundos = totalSegundos % SEGUNDOS_POR_MINUTO
  return `${String(minutos).padStart(2, '0')}:${String(restoSegundos).padStart(2, '0')}`
}

/**
 * Calcula los milisegundos restantes hasta `finEnMs` respecto a `ahoraMs`.
 * Nunca devuelve un número negativo.
 */
export function calcularRestanteMs(finEnMs: number, ahoraMs: number = Date.now()): number {
  if (!Number.isFinite(finEnMs) || !Number.isFinite(ahoraMs)) {
    return 0
  }
  return Math.max(0, finEnMs - ahoraMs)
}

/**
 * Calcula los segundos enteros transcurridos desde `creadoEnISO` hasta
 * `ahoraMs`. Devuelve `0` si la fecha es inválida o futura.
 */
export function calcularSegundosTranscurridos(
  creadoEnISO: string,
  ahoraMs: number = Date.now(),
): number {
  const creadoMs = Date.parse(creadoEnISO)
  if (!Number.isFinite(creadoMs) || !Number.isFinite(ahoraMs) || ahoraMs <= creadoMs) {
    return 0
  }
  return Math.floor((ahoraMs - creadoMs) / MS_POR_SEGUNDO)
}

/**
 * Calcula la duración de una sesión en minutos redondeados al entero más
 * cercano con mínimo `1` (`max(1, round((ahora - creado) / 60000))`).
 * Si `creadoEnISO` es inválida o posterior a `ahoraMs`, devuelve `1`.
 */
export function calcularDuracionMinutos(
  creadoEnISO: string,
  ahoraMs: number = Date.now(),
): number {
  const creadoMs = Date.parse(creadoEnISO)
  if (!Number.isFinite(creadoMs) || !Number.isFinite(ahoraMs)) {
    return 1
  }
  const transcurridoMs = ahoraMs - creadoMs
  if (transcurridoMs <= 0) {
    return 1
  }
  return Math.max(1, Math.round(transcurridoMs / MS_POR_MINUTO))
}
