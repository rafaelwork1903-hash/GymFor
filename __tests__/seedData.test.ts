import {
  CATALOGO_EJERCICIOS,
  RUTINA_CASA_5D,
  RUTINA_GIMNASIO_5D,
  RUTINAS_SEED,
} from '../src/db/seedData'
import { EQUIPAMIENTOS, GRUPOS_MUSCULARES } from '../src/domain/types'

describe('catálogo maestro de ejercicios (seed)', () => {
  it('no tiene nombres ni IDs duplicados', () => {
    const ids = CATALOGO_EJERCICIOS.map((e) => e.id)
    const nombres = CATALOGO_EJERCICIOS.map((e) => e.nombre)
    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(nombres).size).toBe(nombres.length)
  })

  it('usa grupos musculares y equipamientos válidos', () => {
    for (const ejercicio of CATALOGO_EJERCICIOS) {
      expect(GRUPOS_MUSCULARES).toContain(ejercicio.grupo_muscular_primario)
      expect(EQUIPAMIENTOS).toContain(ejercicio.equipamiento)
      for (const secundario of ejercicio.grupos_musculares_secundarios) {
        expect(GRUPOS_MUSCULARES).toContain(secundario)
        expect(secundario).not.toBe(ejercicio.grupo_muscular_primario)
      }
    }
  })

  it('respeta el factor fraccional del modelo (1.0 directo, 0.5 indirecto)', () => {
    for (const ejercicio of CATALOGO_EJERCICIOS) {
      expect(ejercicio.factor_fraccional).toBeGreaterThan(0)
      expect(ejercicio.factor_fraccional).toBeLessThanOrEqual(1)
    }
  })

  it('el grupo primario no aparece repetido como secundario', () => {
    for (const ejercicio of CATALOGO_EJERCICIOS) {
      expect(ejercicio.grupos_musculares_secundarios).not.toContain(
        ejercicio.grupo_muscular_primario,
      )
    }
  })
})

describe('rutinas iniciales (seed)', () => {
  const slugsCatalogo = new Set(CATALOGO_EJERCICIOS.map((e) => e.id.replace(/^ej:/, '')))

  it('incluye las dos rutinas de agent.md (gimnasio y casa, 5 días cada una)', () => {
    expect(RUTINAS_SEED.map((r) => r.id)).toEqual([RUTINA_GIMNASIO_5D.id, RUTINA_CASA_5D.id])
    for (const rutina of RUTINAS_SEED) {
      expect(rutina.dias).toHaveLength(5)
    }
  })

  it('cada ejercicio de rutina existe en el catálogo maestro', () => {
    for (const rutina of RUTINAS_SEED) {
      for (const dia of rutina.dias) {
        for (const ejercicio of dia.ejercicios) {
          expect(slugsCatalogo).toContain(ejercicio.ejercicio)
        }
      }
    }
  })

  it('los rangos de reps y las series objetivo son coherentes', () => {
    for (const rutina of RUTINAS_SEED) {
      for (const dia of rutina.dias) {
        expect(dia.ejercicios.length).toBeGreaterThan(0)
        for (const ejercicio of dia.ejercicios) {
          expect(ejercicio.series_objetivo).toBeGreaterThan(0)
          expect(ejercicio.reps_objetivo_min).toBeGreaterThan(0)
          expect(ejercicio.reps_objetivo_max).toBeGreaterThanOrEqual(ejercicio.reps_objetivo_min)
        }
      }
    }
  })

  it('reproduce los ejercicios de cada día según agent.md (gimnasio)', () => {
    const slugsPorDia = RUTINA_GIMNASIO_5D.dias.map((dia) =>
      dia.ejercicios.map((e) => e.ejercicio),
    )
    expect(slugsPorDia).toEqual([
      [
        'press_banca_mancuernas',
        'press_hombros_mancuernas',
        'elevaciones_laterales',
        'fondos_en_banca',
        'plancha_frontal',
      ],
      [
        'peso_muerto_rumano',
        'hip_thrust',
        'sentadilla_bulgara',
        'curl_isquiotibiales_maquina',
        'puente_pelvis_suelo',
      ],
      [
        'remo_mancuerna_una_mano',
        'jalon_al_pecho',
        'remo_sentado_polea',
        'curl_biceps_mancuernas',
        'face_pulls',
      ],
      [
        'sentadilla_barra',
        'prensa_piernas',
        'zancadas_mancuernas',
        'extension_piernas_maquina',
        'elevacion_gemelos_maquina',
      ],
      [
        'peso_muerto_convencional',
        'saltos_al_cajon',
        'remo_vertical',
        'press_hombros_mancuernas',
        'plancha_elevacion_piernas',
      ],
    ])
    expect(RUTINA_GIMNASIO_5D.dias.map((d) => d.ejercicios.length)).toEqual([5, 5, 5, 5, 5])
  })

  it('reproduce los ejercicios de cada día según agent.md (casa)', () => {
    expect(RUTINA_CASA_5D.dias.map((d) => d.ejercicios.length)).toEqual([4, 4, 4, 4, 2])
  })
})
