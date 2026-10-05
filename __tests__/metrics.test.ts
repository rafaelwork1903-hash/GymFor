import {
  calcular1RMEpley,
  calcularMejor1RM,
  calcularSeriesEfectivas,
  calcularVolumenSerie,
  calcularVolumenTotal,
  rpeARir,
  rirARpe,
  type AporteSeries,
} from '../src/domain/metrics'
import type { GrupoMuscular } from '../src/domain/types'

describe('calcular1RMEpley (fórmula de Epley)', () => {
  it('con 1 repetición el 1RM es el propio peso', () => {
    expect(calcular1RMEpley(100, 1)).toBe(100)
  })

  it('60 kg × 10 reps ≈ 79.98 kg', () => {
    expect(calcular1RMEpley(60, 10)).toBeCloseTo(79.98, 2)
  })

  it('100 kg × 5 reps ≈ 116.65 kg', () => {
    expect(calcular1RMEpley(100, 5)).toBeCloseTo(116.65, 2)
  })

  it('rechaza pesos o reps negativas', () => {
    expect(() => calcular1RMEpley(-1, 5)).toThrow()
    expect(() => calcular1RMEpley(50, -1)).toThrow()
  })
})

describe('conversión RPE ↔ RIR', () => {
  it('RPE 8 equivale a RIR 2', () => {
    expect(rpeARir(8)).toBe(2)
  })

  it('RIR 2 equivale a RPE 8', () => {
    expect(rirARpe(2)).toBe(8)
  })
})

describe('calcularVolumenSerie / calcularVolumenTotal', () => {
  it('el volumen de una serie es peso × reps', () => {
    expect(calcularVolumenSerie({ peso_levantado: 60, reps_realizadas: 10 })).toBe(600)
  })

  it('solo suma las series completadas', () => {
    const series = [
      { peso_levantado: 60, reps_realizadas: 10, completada: 1 as const },
      { peso_levantado: 60, reps_realizadas: 10, completada: 1 as const },
      { peso_levantado: 80, reps_realizadas: 5, completada: 0 as const },
    ]
    expect(calcularVolumenTotal(series)).toBe(1200)
  })

  it('sin series completadas el volumen es 0', () => {
    expect(calcularVolumenTotal([])).toBe(0)
  })
})

describe('calcularMejor1RM', () => {
  it('devuelve el mejor 1RM estimado de las series completadas', () => {
    const series = [
      { peso_levantado: 60, reps_realizadas: 10, completada: 1 as const },
      { peso_levantado: 80, reps_realizadas: 5, completada: 1 as const },
      { peso_levantado: 200, reps_realizadas: 3, completada: 0 as const },
    ]
    expect(calcularMejor1RM(series)).toBeCloseTo(calcular1RMEpley(80, 5), 5)
  })

  it('sin series completadas devuelve 0', () => {
    expect(calcularMejor1RM([])).toBe(0)
  })
})

describe('calcularSeriesEfectivas', () => {
  const pressBanca: AporteSeries = {
    ejercicio: {
      grupo_muscular_primario: 'pecho',
      grupos_musculares_secundarios: ['hombros', 'triceps'],
      factor_fraccional: 1.0,
    },
    series_directas: 4,
  }

  it('las series directas cuentan con el factor fraccional del ejercicio', () => {
    expect(calcularSeriesEfectivas('pecho' as GrupoMuscular, [pressBanca])).toBe(4)
  })

  it('las series indirectas (grupo secundario) cuentan 0.5', () => {
    expect(calcularSeriesEfectivas('hombros' as GrupoMuscular, [pressBanca])).toBe(2)
    expect(calcularSeriesEfectivas('triceps' as GrupoMuscular, [pressBanca])).toBe(2)
  })

  it('los ejercicios ajenos al grupo no aportan', () => {
    expect(calcularSeriesEfectivas('espalda' as GrupoMuscular, [pressBanca])).toBe(0)
  })

  it('respeta el factor fraccional 0.5 de ejercicios indirectos', () => {
    const indirecto: AporteSeries = {
      ejercicio: {
        grupo_muscular_primario: 'core',
        grupos_musculares_secundarios: [],
        factor_fraccional: 0.5,
      },
      series_directas: 6,
    }
    expect(calcularSeriesEfectivas('core' as GrupoMuscular, [indirecto])).toBe(3)
  })

  it('suma aportes directos e indirectos del mismo grupo', () => {
    const dominadas: AporteSeries = {
      ejercicio: {
        grupo_muscular_primario: 'espalda',
        grupos_musculares_secundarios: ['biceps'],
        factor_fraccional: 1.0,
      },
      series_directas: 4,
    }
    // Pecho: 4 directas del press de banca (las dominadas no tocan pecho).
    expect(calcularSeriesEfectivas('pecho' as GrupoMuscular, [pressBanca, dominadas])).toBe(4)
    // Bíceps: solo 4 indirectas × 0.5 de las dominadas.
    expect(calcularSeriesEfectivas('biceps' as GrupoMuscular, [pressBanca, dominadas])).toBe(2)
  })
})
