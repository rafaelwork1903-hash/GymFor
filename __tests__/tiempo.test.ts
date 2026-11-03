import { act, renderHook } from '@testing-library/react-native'
import { AppState, type AppStateStatus, Platform, Vibration } from 'react-native'

import {
  useCronometroSesion,
  useTemporizadorDescanso,
} from '../src/hooks/useTemporizadorDescanso'
import {
  calcularDuracionMinutos,
  calcularRestanteMs,
  calcularSegundosTranscurridos,
  formatearMMSS,
} from '../src/utils/tiempo'

describe('utilidades puras de tiempo (src/utils/tiempo.ts)', () => {
  describe('formatearMMSS', () => {
    it('formatea 0, 59, 60, 3599, 3600 y normaliza negativos o no finitos a 00:00', () => {
      expect(formatearMMSS(0)).toBe('00:00')
      expect(formatearMMSS(59)).toBe('00:59')
      expect(formatearMMSS(60)).toBe('01:00')
      expect(formatearMMSS(3599)).toBe('59:59')
      expect(formatearMMSS(3600)).toBe('60:00')
      expect(formatearMMSS(-1)).toBe('00:00')
      expect(formatearMMSS(-120)).toBe('00:00')
      expect(formatearMMSS(Number.NaN)).toBe('00:00')
    })
  })

  describe('calcularRestanteMs', () => {
    it('devuelve la diferencia positiva, 0 al vencer y nunca valores negativos con reloj inyectado', () => {
      expect(calcularRestanteMs(10_000, 4_000)).toBe(6_000)
      expect(calcularRestanteMs(10_000, 10_000)).toBe(0)
      expect(calcularRestanteMs(10_000, 15_500)).toBe(0)
      expect(calcularRestanteMs(Number.NaN, 10_000)).toBe(0)
    })
  })

  describe('calcularDuracionMinutos', () => {
    const CREADO = '2026-11-03T12:00:00.000Z'
    const CREADO_MS = Date.parse(CREADO)

    it('calcula al menos 1 minuto para el mismo instante o 30 s, redondea 90 s a 2 min y maneja fechas inválidas/futuras', () => {
      expect(calcularDuracionMinutos(CREADO, CREADO_MS)).toBe(1)
      expect(calcularDuracionMinutos(CREADO, CREADO_MS + 30_000)).toBe(1)
      expect(calcularDuracionMinutos(CREADO, CREADO_MS + 90_000)).toBe(2)
      expect(calcularDuracionMinutos(CREADO, CREADO_MS + 45 * 60_000)).toBe(45)
      expect(calcularDuracionMinutos('fecha-invalida', CREADO_MS)).toBe(1)
      expect(calcularDuracionMinutos(CREADO, CREADO_MS - 120_000)).toBe(1)
    })
  })

  describe('calcularSegundosTranscurridos', () => {
    it('devuelve segundos enteros desde creado_en o 0 ante fechas inválidas/futuras', () => {
      const inicio = '2026-11-03T12:00:00.000Z'
      const inicioMs = Date.parse(inicio)
      expect(calcularSegundosTranscurridos(inicio, inicioMs + 65_900)).toBe(65)
      expect(calcularSegundosTranscurridos(inicio, inicioMs - 5_000)).toBe(0)
      expect(calcularSegundosTranscurridos('no-iso', inicioMs)).toBe(0)
    })
  })
})

describe('useTemporizadorDescanso y useCronometroSesion', () => {
  let relojActual = 1_000_000
  let oyentesAppState: ((estado: AppStateStatus) => void)[] = []
  const osOriginal = Platform.OS
  let espiaAppState: jest.SpyInstance
  let espiaVibrar: jest.SpyInstance
  let espiaCancelarVibracion: jest.SpyInstance

  beforeEach(() => {
    jest.useFakeTimers()
    relojActual = 1_000_000
    oyentesAppState = []

    espiaAppState = jest.spyOn(AppState, 'addEventListener').mockImplementation((_tipo, manejador) => {
      const fn = manejador as (estado: AppStateStatus) => void
      oyentesAppState.push(fn)
      return {
        remove: () => {
          oyentesAppState = oyentesAppState.filter((item) => item !== fn)
        },
      }
    })
    espiaVibrar = jest.spyOn(Vibration, 'vibrate').mockImplementation(() => {})
    espiaCancelarVibracion = jest.spyOn(Vibration, 'cancel').mockImplementation(() => {})
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' })
  })

  afterEach(() => {
    jest.useRealTimers()
    espiaAppState.mockRestore()
    espiaVibrar.mockRestore()
    espiaCancelarVibracion.mockRestore()
    Object.defineProperty(Platform, 'OS', { configurable: true, value: osOriginal })
  })

  it('mantiene un único descanso activo, soporta pausar/reanudar/+15s/saltar y recalcula con AppState active', async () => {
    const { result } = await renderHook(() =>
      useTemporizadorDescanso({ reloj: () => relojActual }),
    )

    expect(result.current.activo).toBe(false)

    // Inicia descanso de 90 s para Press banca; luego otro ejercicio lo reemplaza (uno solo activo).
    await act(async () => {
      result.current.iniciarDescanso('Press banca', 90)
      result.current.iniciarDescanso('Sentadilla', 60)
    })

    expect(result.current.activo).toBe(true)
    expect(result.current.ejercicioNombre).toBe('Sentadilla')
    expect(result.current.textoRestante).toBe('01:00')

    // Simula paso a segundo plano de 25 s y regreso a active (sin depender de ticks).
    relojActual += 25_000
    await act(async () => {
      oyentesAppState.forEach((fn) => fn('active'))
    })
    expect(result.current.segundosRestantes).toBe(35)
    expect(result.current.textoRestante).toBe('00:35')

    // Pausar congela el restante aunque el reloj avance.
    await act(async () => {
      result.current.pausar()
    })
    expect(result.current.pausado).toBe(true)
    relojActual += 40_000
    await act(async () => {
      jest.advanceTimersByTime(5_000)
    })
    expect(result.current.segundosRestantes).toBe(35)

    // +15 s estando en pausa suma 15 s; reanudar retoma desde 50 s.
    await act(async () => {
      result.current.agregarTiempo(15)
      result.current.reanudar()
    })
    expect(result.current.pausado).toBe(false)
    expect(result.current.segundosRestantes).toBe(50)
    expect(result.current.textoRestante).toBe('00:50')

    // Al llegar a 0 entra en estado terminado y vibra exactamente una sola vez en nativo.
    relojActual += 50_000
    await act(async () => {
      jest.advanceTimersByTime(1_000)
    })
    expect(result.current.terminado).toBe(true)
    expect(result.current.textoRestante).toBe('00:00')
    expect(Vibration.vibrate).toHaveBeenCalledTimes(1)
    expect(Vibration.vibrate).toHaveBeenCalledWith([0, 300, 150, 300])

    // Ticks posteriores no vuelven a disparar vibración.
    relojActual += 5_000
    await act(async () => {
      jest.advanceTimersByTime(3_000)
    })
    expect(Vibration.vibrate).toHaveBeenCalledTimes(1)

    // Saltar limpia el temporizador.
    await act(async () => {
      result.current.saltar()
    })
    expect(result.current.activo).toBe(false)
  })

  it('no invoca Vibration.vibrate en web al terminar el descanso', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' })

    const { result } = await renderHook(() =>
      useTemporizadorDescanso({ reloj: () => relojActual }),
    )

    await act(async () => {
      result.current.iniciarDescanso('Dominadas', 10)
    })

    relojActual += 10_000
    await act(async () => {
      jest.advanceTimersByTime(1_000)
    })

    expect(result.current.terminado).toBe(true)
    expect(Vibration.vibrate).not.toHaveBeenCalled()
  })

  it('useCronometroSesion actualiza MM:SS y duracionMinutos desde creado_en', async () => {
    const creadoISO = new Date(relojActual).toISOString()
    const { result, unmount } = await renderHook(() =>
      useCronometroSesion(creadoISO, () => relojActual),
    )

    expect(result.current.textoMMSS).toBe('00:00')
    expect(result.current.duracionMinutos).toBe(1)

    relojActual += 95_000
    await act(async () => {
      jest.advanceTimersByTime(1_000)
    })

    expect(result.current.textoMMSS).toBe('01:35')
    expect(result.current.duracionMinutos).toBe(2)

    await unmount()
    expect(oyentesAppState).toHaveLength(0)
  })
})
