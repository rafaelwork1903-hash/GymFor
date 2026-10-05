import {
  calcularTendencia,
  contarSesionesFallandoMinimo,
  detectarEstancamiento,
  esTrenInferior,
  redondearCarga,
  sugerirProgresion,
  type SesionEjercicioResumen,
} from '../src/domain/progression'

function serie(peso: number, reps: number, rpe: number | null = null) {
  return {
    peso_levantado: peso,
    reps_realizadas: reps,
    completada: 1 as const,
    rpe_serie: rpe,
    rir: null,
  }
}

function sesion(series: ReturnType<typeof serie>[], rpeEjercicio: number | null = null): SesionEjercicioResumen {
  return { series, rpe_ejercicio: rpeEjercicio }
}

describe('sugerirProgresion', () => {
  it('sube 2.5 kg en tren superior si todas las series van al tope con RPE ≤ 8', () => {
    const sugerencia = sugerirProgresion({
      historial: [sesion([serie(60, 12, 7), serie(60, 12, 8), serie(60, 12, 8)])],
      reps_objetivo_min: 10,
      reps_objetivo_max: 12,
      grupo_muscular: 'pecho',
      peso_actual: 60,
    })
    expect(sugerencia.accion).toBe('subir_peso')
    expect(sugerencia.peso_sugerido).toBe(62.5)
  })

  it('sube 5 kg en tren inferior si todas las series van al tope con RPE ≤ 8', () => {
    const sugerencia = sugerirProgresion({
      historial: [sesion([serie(100, 12, 8), serie(100, 12, 8)])],
      reps_objetivo_min: 10,
      reps_objetivo_max: 12,
      grupo_muscular: 'cuadriceps',
      peso_actual: 100,
    })
    expect(sugerencia.accion).toBe('subir_peso')
    expect(sugerencia.peso_sugerido).toBe(105)
  })

  it('no sube si el RPE medio supera 8 aunque complete al tope', () => {
    const sugerencia = sugerirProgresion({
      historial: [sesion([serie(60, 12), serie(60, 12)], 9.5)],
      reps_objetivo_min: 10,
      reps_objetivo_max: 12,
      grupo_muscular: 'pecho',
      peso_actual: 60,
    })
    expect(sugerencia.accion).toBe('mantener')
    expect(sugerencia.peso_sugerido).toBe(60)
  })

  it('no sube si alguna serie no llega al tope del rango', () => {
    const sugerencia = sugerirProgresion({
      historial: [sesion([serie(60, 12), serie(60, 10)], 8)],
      reps_objetivo_min: 10,
      reps_objetivo_max: 12,
      grupo_muscular: 'pecho',
      peso_actual: 60,
    })
    expect(sugerencia.accion).toBe('mantener')
  })

  it('sugiere bajar 5-10 % si falla el mínimo en 2 sesiones consecutivas', () => {
    const historial = [
      sesion([serie(60, 8), serie(60, 7)]),
      sesion([serie(60, 8), serie(60, 6)]),
    ]
    const sugerencia = sugerirProgresion({
      historial,
      reps_objetivo_min: 10,
      reps_objetivo_max: 12,
      grupo_muscular: 'pecho',
      peso_actual: 60,
    })
    expect(sugerencia.accion).toBe('bajar_peso')
    expect(sugerencia.peso_sugerido).toBe(57) // -5 %
  })

  it('mantiene si no hay series completadas registradas', () => {
    const sugerencia = sugerirProgresion({
      historial: [],
      reps_objetivo_min: 10,
      reps_objetivo_max: 12,
      grupo_muscular: 'espalda',
      peso_actual: 40,
    })
    expect(sugerencia.accion).toBe('mantener')
    expect(sugerencia.peso_sugerido).toBe(40)
  })
})

describe('contarSesionesFallandoMinimo', () => {
  it('cuenta solo las sesiones consecutivas más recientes que fallan el mínimo', () => {
    const historial = [
      sesion([serie(60, 10)]), // alcanzó el mínimo
      sesion([serie(60, 9)]),
      sesion([serie(60, 8)]),
    ]
    expect(contarSesionesFallandoMinimo(historial, 10)).toBe(2)
  })

  it('una serie que alcanza el mínimo rompe la racha', () => {
    const historial = [sesion([serie(60, 8)]), sesion([serie(60, 10), serie(60, 8)])]
    expect(contarSesionesFallandoMinimo(historial, 10)).toBe(0)
  })
})

describe('detectarEstancamiento', () => {
  it('detecta 3 sesiones seguidas sin mejorar el 1RM estimado', () => {
    const historial = [
      sesion([serie(60, 10)]),
      sesion([serie(60, 10)]),
      sesion([serie(60, 10)]),
    ]
    expect(detectarEstancamiento(historial)).toBe(true)
    expect(calcularTendencia(historial)).toBe('estancado')
  })

  it('no hay estancamiento si alguna sesión mejora el 1RM', () => {
    const historial = [
      sesion([serie(60, 10)]),
      sesion([serie(60, 11)]), // mejora
      sesion([serie(60, 11)]),
    ]
    expect(detectarEstancamiento(historial)).toBe(false)
  })

  it('con menos de 3 sesiones no puede detectar estancamiento', () => {
    expect(detectarEstancamiento([sesion([serie(60, 10)]), sesion([serie(60, 10)])])).toBe(false)
  })
})

describe('calcularTendencia', () => {
  it('subiendo si la última sesión supera el 1RM de la anterior', () => {
    expect(calcularTendencia([sesion([serie(60, 10)]), sesion([serie(62.5, 10)])])).toBe('subiendo')
  })

  it('bajando si la última sesión empeora el 1RM de la anterior', () => {
    expect(calcularTendencia([sesion([serie(65, 10)]), sesion([serie(60, 10)])])).toBe('bajando')
  })
})

describe('utilidades', () => {
  it('esTrenInferior clasifica grupos de pierna', () => {
    expect(esTrenInferior('cuadriceps')).toBe(true)
    expect(esTrenInferior('pecho')).toBe(false)
  })

  it('redondearCarga ajusta al medio kilo más cercano', () => {
    expect(redondearCarga(61.24)).toBe(61)
    expect(redondearCarga(61.25)).toBe(61.5)
    expect(redondearCarga(61.74)).toBe(61.5)
    expect(redondearCarga(61.75)).toBe(62)
  })
})
