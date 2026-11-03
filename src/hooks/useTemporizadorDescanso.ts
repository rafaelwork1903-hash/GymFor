import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState, Platform, Vibration } from 'react-native'

import {
  calcularDuracionMinutos,
  calcularRestanteMs,
  calcularSegundosTranscurridos,
  formatearMMSS,
} from '../utils/tiempo'

const INTERVALO_RELOJ_MS = 1000
const PATRON_VIBRACION_DESCANSO = [0, 300, 150, 300]

/** Estado interno del temporizador de descanso entre series. */
export interface EstadoTemporizadorDescanso {
  ejercicioNombre: string
  segundosTotales: number
  finEnMs: number
  pausado: boolean
  restanteMsAlPausar: number | null
}

interface EstadoInternoTemporizador extends EstadoTemporizadorDescanso {
  idEjecucion: number
}

export interface OpcionesTemporizadorDescanso {
  /** Reloj inyectable (por defecto `Date.now`) para pruebas deterministas. */
  reloj?: () => number
  /** Cuando es `false`, desactiva intervalos y oculta el temporizador activo. */
  habilitado?: boolean
}

export interface ResultadoTemporizadorDescanso {
  /** `true` mientras exista un descanso en curso, en pausa o recién terminado. */
  activo: boolean
  /** Snapshot público del estado del temporizador (`null` si no hay activo). */
  estado: EstadoTemporizadorDescanso | null
  ejercicioNombre: string | null
  segundosTotales: number
  /** Milisegundos restantes derivados de `finEnMs` y el reloj actual (nunca `< 0`). */
  restanteMs: number
  /** Segundos restantes redondeados hacia arriba para mostrar en `MM:SS`. */
  segundosRestantes: number
  /** Cadena lista para presentar (`MM:SS`). */
  textoRestante: string
  pausado: boolean
  /** `true` cuando la cuenta atrás alcanzó `0` y no está en pausa. */
  terminado: boolean
  /** Inicia (o reemplaza) el único temporizador de descanso activo. */
  iniciarDescanso: (ejercicioNombre: string, segundos: number) => void
  pausar: () => void
  reanudar: () => void
  /** Suma segundos al descanso actual (por defecto `+15` s). */
  agregarTiempo: (segundos?: number) => void
  /** Cancela y descarta el temporizador activo. */
  saltar: () => void
}

/**
 * Hook de temporizador de descanso para la sesión activa.
 *
 * - Mantiene como máximo un único temporizador activo.
 * - Deriva `restanteMs` comparando `finEnMs` contra `Date.now()` en vez de
 *   decrementar contadores, por lo que no pierde precisión si la app pasa a
 *   segundo plano (`AppState` recalcula al volver a `'active'`).
 * - Al llegar a `0`, entra en estado `terminado` y dispara una única vibración
 *   en dispositivos nativos (`Platform.OS !== 'web'`).
 */
export function useTemporizadorDescanso(
  opciones?: OpcionesTemporizadorDescanso,
): ResultadoTemporizadorDescanso {
  const reloj = opciones?.reloj ?? Date.now
  const habilitado = opciones?.habilitado ?? true

  const relojRef = useRef(reloj)
  const contadorEjecucionRef = useRef(0)
  const yaVibroParaIdRef = useRef<number | null>(null)

  const [estadoInterno, setEstadoInterno] = useState<EstadoInternoTemporizador | null>(null)
  const [ahoraMs, setAhoraMs] = useState<number>(() => reloj())

  useEffect(() => {
    relojRef.current = reloj
  }, [reloj])

  const activo = habilitado && estadoInterno !== null

  const restanteMs = !activo || !estadoInterno
    ? 0
    : estadoInterno.pausado && estadoInterno.restanteMsAlPausar !== null
      ? Math.max(0, estadoInterno.restanteMsAlPausar)
      : calcularRestanteMs(estadoInterno.finEnMs, ahoraMs)

  const pausado = activo && estadoInterno ? estadoInterno.pausado : false
  const terminado = activo && !pausado && restanteMs === 0
  const segundosRestantes = restanteMs <= 0 ? 0 : Math.ceil(restanteMs / 1000)
  const textoRestante = formatearMMSS(segundosRestantes)
  const idEjecucion = activo && estadoInterno ? estadoInterno.idEjecucion : null

  const enCuentaAtras = activo && !pausado && restanteMs > 0

  useEffect(() => {
    if (!enCuentaAtras) {
      return undefined
    }

    const idIntervalo = setInterval(() => {
      setAhoraMs(relojRef.current())
    }, INTERVALO_RELOJ_MS)

    const suscripcion = AppState.addEventListener('change', (estadoApp) => {
      if (estadoApp === 'active') {
        setAhoraMs(relojRef.current())
      }
    })

    return () => {
      clearInterval(idIntervalo)
      suscripcion.remove()
    }
  }, [enCuentaAtras])

  useEffect(() => {
    if (!activo || !terminado || idEjecucion === null) {
      return
    }
    if (yaVibroParaIdRef.current === idEjecucion) {
      return
    }
    yaVibroParaIdRef.current = idEjecucion
    if (Platform.OS !== 'web') {
      try {
        Vibration.vibrate(PATRON_VIBRACION_DESCANSO)
      } catch {
        // Entornos sin motor de vibración disponible ignoran el aviso háptico.
      }
    }
  }, [activo, terminado, idEjecucion])

  useEffect(() => {
    return () => {
      if (Platform.OS !== 'web') {
        try {
          Vibration.cancel()
        } catch {
          // Ignorado en entornos sin soporte nativo de vibración.
        }
      }
    }
  }, [])

  const iniciarDescanso = useCallback((ejercicioNombre: string, segundos: number) => {
    if (!Number.isFinite(segundos) || segundos <= 0) {
      return
    }
    const segundosNormalizados = Math.max(1, Math.round(segundos))
    const ahora = relojRef.current()
    contadorEjecucionRef.current += 1
    const nuevoId = contadorEjecucionRef.current

    setAhoraMs(ahora)
    setEstadoInterno({
      idEjecucion: nuevoId,
      ejercicioNombre,
      segundosTotales: segundosNormalizados,
      finEnMs: ahora + segundosNormalizados * 1000,
      pausado: false,
      restanteMsAlPausar: null,
    })
  }, [])

  const pausar = useCallback(() => {
    const ahora = relojRef.current()
    setAhoraMs(ahora)
    setEstadoInterno((actual) => {
      if (!actual || actual.pausado) {
        return actual
      }
      const restante = calcularRestanteMs(actual.finEnMs, ahora)
      if (restante <= 0) {
        return actual
      }
      return {
        ...actual,
        pausado: true,
        restanteMsAlPausar: restante,
      }
    })
  }, [])

  const reanudar = useCallback(() => {
    const ahora = relojRef.current()
    setAhoraMs(ahora)
    setEstadoInterno((actual) => {
      if (!actual || !actual.pausado) {
        return actual
      }
      const restante = Math.max(0, actual.restanteMsAlPausar ?? 0)
      return {
        ...actual,
        pausado: false,
        finEnMs: ahora + restante,
        restanteMsAlPausar: null,
      }
    })
  }, [])

  const agregarTiempo = useCallback((segundos = 15) => {
    if (!Number.isFinite(segundos) || segundos <= 0) {
      return
    }
    const extraSegundos = Math.round(segundos)
    const extraMs = extraSegundos * 1000
    const ahora = relojRef.current()
    contadorEjecucionRef.current += 1
    const idSiReanudaDesdeCero = contadorEjecucionRef.current

    setAhoraMs(ahora)
    setEstadoInterno((actual) => {
      if (!actual) {
        return null
      }
      if (actual.pausado) {
        return {
          ...actual,
          segundosTotales: actual.segundosTotales + extraSegundos,
          restanteMsAlPausar: Math.max(0, actual.restanteMsAlPausar ?? 0) + extraMs,
        }
      }
      const restanteActual = calcularRestanteMs(actual.finEnMs, ahora)
      if (restanteActual === 0) {
        return {
          ...actual,
          idEjecucion: idSiReanudaDesdeCero,
          segundosTotales: actual.segundosTotales + extraSegundos,
          finEnMs: ahora + extraMs,
        }
      }
      return {
        ...actual,
        segundosTotales: actual.segundosTotales + extraSegundos,
        finEnMs: actual.finEnMs + extraMs,
      }
    })
  }, [])

  const saltar = useCallback(() => {
    setEstadoInterno(null)
    if (Platform.OS !== 'web') {
      try {
        Vibration.cancel()
      } catch {
        // Ignorado en entornos sin soporte nativo de vibración.
      }
    }
  }, [])

  const estadoPublico: EstadoTemporizadorDescanso | null =
    activo && estadoInterno
      ? {
          ejercicioNombre: estadoInterno.ejercicioNombre,
          segundosTotales: estadoInterno.segundosTotales,
          finEnMs: estadoInterno.finEnMs,
          pausado: estadoInterno.pausado,
          restanteMsAlPausar: estadoInterno.restanteMsAlPausar,
        }
      : null

  return {
    activo,
    estado: estadoPublico,
    ejercicioNombre: estadoPublico?.ejercicioNombre ?? null,
    segundosTotales: estadoPublico?.segundosTotales ?? 0,
    restanteMs,
    segundosRestantes,
    textoRestante,
    pausado,
    terminado,
    iniciarDescanso,
    pausar,
    reanudar,
    agregarTiempo,
    saltar,
  }
}

export interface ResultadoCronometroSesion {
  segundosTranscurridos: number
  textoMMSS: string
  duracionMinutos: number
}

/**
 * Cronómetro en vivo de la sesión activa a partir de `sesion.creado_en` (ISO).
 * Se actualiza cada segundo y al volver la app a primer plano (`AppState`).
 */
export function useCronometroSesion(
  creadoEnISO: string | null,
  reloj: () => number = Date.now,
): ResultadoCronometroSesion {
  const relojRef = useRef(reloj)
  const [ahoraMs, setAhoraMs] = useState<number>(() => reloj())

  useEffect(() => {
    relojRef.current = reloj
  }, [reloj])

  useEffect(() => {
    if (!creadoEnISO) {
      return undefined
    }

    const idIntervalo = setInterval(() => {
      setAhoraMs(relojRef.current())
    }, INTERVALO_RELOJ_MS)

    const suscripcion = AppState.addEventListener('change', (estadoApp) => {
      if (estadoApp === 'active') {
        setAhoraMs(relojRef.current())
      }
    })

    return () => {
      clearInterval(idIntervalo)
      suscripcion.remove()
    }
  }, [creadoEnISO])

  if (!creadoEnISO) {
    return {
      segundosTranscurridos: 0,
      textoMMSS: '00:00',
      duracionMinutos: 1,
    }
  }

  const segundosTranscurridos = calcularSegundosTranscurridos(creadoEnISO, ahoraMs)
  return {
    segundosTranscurridos,
    textoMMSS: formatearMMSS(segundosTranscurridos),
    duracionMinutos: calcularDuracionMinutos(creadoEnISO, ahoraMs),
  }
}
