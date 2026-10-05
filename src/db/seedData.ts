/**
 * Datos semilla puros (sin dependencias de expo-sqlite): catálogo maestro de
 * ejercicios y las 2 rutinas iniciales de agent.md (Gimnasio 5 días y Casa 5
 * días).
 *
 * Los IDs son deterministas para que el seed sea idempotente (INSERCIÓN OR
 * IGNORE por clave primaria). Las rutinas se siembran como plantillas con
 * `usuario_id = null`; al adoptar una rutina, la capa de aplicación la clona
 * asignando el usuario.
 *
 * Módulo puro: puede validarse en tests sin base de datos (ver
 * __tests__/seedData.test.ts).
 */

import type { Ejercicio, Equipamiento, GrupoMuscular } from '../domain/types'

/** Fecha fija para registros semilla (determinismo y verificabilidad). */
export const SEMILLA_FECHA = '2024-01-01T00:00:00.000Z'

interface EjercicioSeedDef {
  slug: string
  nombre: string
  grupo: GrupoMuscular
  secundarios?: GrupoMuscular[]
  equipamiento: Equipamiento
  compuesto?: boolean
  /** 1.0 volumen directo, 0.5 volumen indirecto (por defecto 1.0). */
  factor?: number
  instrucciones?: string
}

function ejercicio(def: EjercicioSeedDef): Ejercicio {
  return {
    id: `ej:${def.slug}`,
    nombre: def.nombre,
    grupo_muscular_primario: def.grupo,
    grupos_musculares_secundarios: def.secundarios ?? [],
    equipamiento: def.equipamiento,
    es_compuesto: def.compuesto ? 1 : 0,
    factor_fraccional: def.factor ?? 1.0,
    instrucciones: def.instrucciones ?? null,
    video_url: null,
  }
}

// ─── Catálogo maestro de ejercicios ───────────────────────────────────────────

export const CATALOGO_EJERCICIOS: readonly Ejercicio[] = [
  // Pecho / empuje
  ejercicio({
    slug: 'press_banca_mancuernas',
    nombre: 'Press de banca con mancuernas',
    grupo: 'pecho',
    secundarios: ['hombros', 'triceps'],
    equipamiento: 'mancuernas',
    compuesto: true,
    instrucciones: 'Baja controlado hasta que las mancuernas queden a la altura del pecho y empuja sin bloquear codos.',
  }),
  ejercicio({
    slug: 'press_hombros_mancuernas',
    nombre: 'Press de hombros con mancuernas',
    grupo: 'hombros',
    secundarios: ['triceps'],
    equipamiento: 'mancuernas',
    compuesto: true,
  }),
  ejercicio({
    slug: 'elevaciones_laterales',
    nombre: 'Elevaciones laterales',
    grupo: 'hombros',
    equipamiento: 'mancuernas',
    instrucciones: 'Eleva hasta la altura de los hombros con codos ligeramente flexionados.',
  }),
  ejercicio({
    slug: 'fondos_en_banca',
    nombre: 'Fondos en banca (tríceps)',
    grupo: 'triceps',
    secundarios: ['pecho', 'hombros'],
    equipamiento: 'peso_corporal',
    compuesto: true,
  }),
  ejercicio({
    slug: 'flexiones',
    nombre: 'Flexiones de pecho',
    grupo: 'pecho',
    secundarios: ['triceps', 'hombros'],
    equipamiento: 'peso_corporal',
    compuesto: true,
  }),
  ejercicio({
    slug: 'fondos_triceps_silla',
    nombre: 'Fondos de tríceps en silla',
    grupo: 'triceps',
    secundarios: ['pecho'],
    equipamiento: 'peso_corporal',
    compuesto: true,
  }),

  // Espalda / tirón
  ejercicio({
    slug: 'remo_mancuerna_una_mano',
    nombre: 'Remo con mancuerna a una mano',
    grupo: 'espalda',
    secundarios: ['biceps'],
    equipamiento: 'mancuernas',
    compuesto: true,
  }),
  ejercicio({
    slug: 'jalon_al_pecho',
    nombre: 'Jalón al pecho en polea',
    grupo: 'espalda',
    secundarios: ['biceps'],
    equipamiento: 'maquina',
    compuesto: true,
  }),
  ejercicio({
    slug: 'remo_sentado_polea',
    nombre: 'Remo sentado en polea',
    grupo: 'espalda',
    secundarios: ['biceps'],
    equipamiento: 'maquina',
    compuesto: true,
  }),
  ejercicio({
    slug: 'remo_vertical',
    nombre: 'Remo vertical',
    grupo: 'hombros',
    secundarios: ['espalda'],
    equipamiento: 'barra',
    compuesto: true,
  }),
  ejercicio({
    slug: 'curl_biceps_mancuernas',
    nombre: 'Curl de bíceps con mancuernas',
    grupo: 'biceps',
    equipamiento: 'mancuernas',
  }),
  ejercicio({
    slug: 'face_pulls',
    nombre: 'Face pulls',
    grupo: 'hombros',
    secundarios: ['espalda'],
    equipamiento: 'maquina',
    instrucciones: 'Tira de la cuerda hacia la cara con codos altos, apretando la parte alta de la espalda.',
  }),

  // Tren inferior
  ejercicio({
    slug: 'peso_muerto_rumano',
    nombre: 'Peso muerto rumano',
    grupo: 'isquios',
    secundarios: ['gluteos', 'espalda'],
    equipamiento: 'barra',
    compuesto: true,
  }),
  ejercicio({
    slug: 'hip_thrust',
    nombre: 'Hip Thrust',
    grupo: 'gluteos',
    secundarios: ['isquios'],
    equipamiento: 'barra',
    compuesto: true,
  }),
  ejercicio({
    slug: 'sentadilla_bulgara',
    nombre: 'Sentadilla búlgara',
    grupo: 'cuadriceps',
    secundarios: ['gluteos'],
    equipamiento: 'mancuernas',
    compuesto: true,
  }),
  ejercicio({
    slug: 'curl_isquiotibiales_maquina',
    nombre: 'Curl de isquiotibiales en máquina',
    grupo: 'isquios',
    equipamiento: 'maquina',
  }),
  ejercicio({
    slug: 'puente_pelvis_suelo',
    nombre: 'Puente de pelvis en suelo',
    grupo: 'gluteos',
    secundarios: ['isquios'],
    equipamiento: 'peso_corporal',
  }),
  ejercicio({
    slug: 'sentadilla_barra',
    nombre: 'Sentadilla con barra',
    grupo: 'cuadriceps',
    secundarios: ['gluteos'],
    equipamiento: 'barra',
    compuesto: true,
  }),
  ejercicio({
    slug: 'sentadilla_peso_corporal',
    nombre: 'Sentadillas (peso corporal)',
    grupo: 'cuadriceps',
    secundarios: ['gluteos'],
    equipamiento: 'peso_corporal',
    compuesto: true,
  }),
  ejercicio({
    slug: 'prensa_piernas',
    nombre: 'Prensa de piernas',
    grupo: 'cuadriceps',
    secundarios: ['gluteos'],
    equipamiento: 'maquina',
    compuesto: true,
  }),
  ejercicio({
    slug: 'zancadas_mancuernas',
    nombre: 'Zancadas',
    grupo: 'cuadriceps',
    secundarios: ['gluteos'],
    equipamiento: 'mancuernas',
    compuesto: true,
  }),
  ejercicio({
    slug: 'zancadas_peso_corporal',
    nombre: 'Zancadas alternando piernas (peso corporal)',
    grupo: 'cuadriceps',
    secundarios: ['gluteos'],
    equipamiento: 'peso_corporal',
    compuesto: true,
  }),
  ejercicio({
    slug: 'extension_piernas_maquina',
    nombre: 'Extensiones de pierna en máquina',
    grupo: 'cuadriceps',
    equipamiento: 'maquina',
  }),
  ejercicio({
    slug: 'elevacion_gemelos_maquina',
    nombre: 'Elevaciones de gemelos en máquina',
    grupo: 'gemelos',
    equipamiento: 'maquina',
  }),
  ejercicio({
    slug: 'peso_muerto_convencional',
    nombre: 'Peso muerto convencional',
    grupo: 'espalda',
    secundarios: ['isquios', 'gluteos'],
    equipamiento: 'barra',
    compuesto: true,
  }),
  ejercicio({
    slug: 'saltos_al_cajon',
    nombre: 'Sentadilla con salto / saltos al cajón',
    grupo: 'cuadriceps',
    secundarios: ['gluteos'],
    equipamiento: 'peso_corporal',
    compuesto: true,
  }),

  // Core
  ejercicio({
    slug: 'plancha_frontal',
    nombre: 'Plancha frontal',
    grupo: 'core',
    equipamiento: 'peso_corporal',
    instrucciones: 'Mantén el cuerpo en línea recta; las reps objetivo indican segundos.',
  }),
  ejercicio({
    slug: 'plancha_elevacion_piernas',
    nombre: 'Plancha con elevación de piernas',
    grupo: 'core',
    secundarios: ['hombros'],
    equipamiento: 'peso_corporal',
  }),
  ejercicio({
    slug: 'mountain_climbers',
    nombre: 'Escaladores (Mountain Climbers)',
    grupo: 'core',
    secundarios: ['hombros'],
    equipamiento: 'peso_corporal',
    compuesto: true,
  }),
  ejercicio({
    slug: 'russian_twists',
    nombre: 'Russian Twists (giros rusos)',
    grupo: 'core',
    equipamiento: 'peso_corporal',
  }),
  ejercicio({
    slug: 'elevacion_piernas_suelo',
    nombre: 'Elevaciones de piernas en el suelo',
    grupo: 'core',
    equipamiento: 'peso_corporal',
  }),

  // Cuerpo completo / metabólico
  ejercicio({
    slug: 'burpees',
    nombre: 'Burpees',
    grupo: 'cuerpo_completo',
    secundarios: ['pecho', 'cuadriceps'],
    equipamiento: 'peso_corporal',
    compuesto: true,
  }),
  ejercicio({
    slug: 'saltos_tijera',
    nombre: 'Saltos de tijera',
    grupo: 'cuerpo_completo',
    equipamiento: 'peso_corporal',
    compuesto: true,
    instrucciones: 'Las reps objetivo indican segundos.',
  }),
  ejercicio({
    slug: 'rodillas_al_pecho',
    nombre: 'Rodillas al pecho',
    grupo: 'cuerpo_completo',
    secundarios: ['core'],
    equipamiento: 'peso_corporal',
    compuesto: true,
    instrucciones: 'Las reps objetivo indican segundos.',
  }),
  ejercicio({
    slug: 'boxeo_sombra',
    nombre: 'Boxeo en sombra',
    grupo: 'cuerpo_completo',
    secundarios: ['hombros'],
    equipamiento: 'peso_corporal',
    compuesto: true,
    instrucciones: 'Las reps objetivo indican segundos.',
  }),

  // Movilidad / recuperación
  ejercicio({
    slug: 'estiramientos_cuerpo_completo',
    nombre: 'Estiramientos de todo el cuerpo',
    grupo: 'movilidad',
    equipamiento: 'peso_corporal',
    instrucciones: 'Las reps objetivo indican minutos.',
  }),
  ejercicio({
    slug: 'yoga_movilidad',
    nombre: 'Rutina suave de yoga o movilidad',
    grupo: 'movilidad',
    equipamiento: 'peso_corporal',
    instrucciones: 'Las reps objetivo indican minutos.',
  }),
]

// ─── Rutinas iniciales ────────────────────────────────────────────────────────

export interface EjercicioEnRutinaSeed {
  /** Slug del ejercicio del catálogo (sin el prefijo `ej:`). */
  ejercicio: string
  series_objetivo: number
  reps_objetivo_min: number
  reps_objetivo_max: number
  peso_objetivo?: number
  descanso_segundos?: number
}

export interface DiaRutinaSeed {
  nombre_dia: string
  notas?: string
  ejercicios: EjercicioEnRutinaSeed[]
}

export interface RutinaSeed {
  id: string
  nombre: string
  descripcion: string
  dias: DiaRutinaSeed[]
}

/** Descansos por defecto: compuestos 90 s, aislamiento 60 s, metabólico 45 s. */
const DESCANSO_COMPUESTO = 90
const DESCANSO_AISLADO = 60
const DESCANSO_METABOLICO = 45

function entrada(
  ejercicioSlug: string,
  series: number,
  repsMin: number,
  repsMax: number,
  descanso: number = DESCANSO_COMPUESTO,
): EjercicioEnRutinaSeed {
  return {
    ejercicio: ejercicioSlug,
    series_objetivo: series,
    reps_objetivo_min: repsMin,
    reps_objetivo_max: repsMax,
    descanso_segundos: descanso,
  }
}

export const RUTINA_GIMNASIO_5D: RutinaSeed = {
  id: 'rutina:gimnasio_5d',
  nombre: 'Rutina Gimnasio (5 días)',
  descripcion:
    'Rutina de 5 días alternando tren superior (empuje/tirón), tren inferior ' +
    '(glúteos-isquios y cuádriceps-glúteos) y un día metabólico de cuerpo completo.',
  dias: [
    {
      nombre_dia: 'Tren Superior - Empuje',
      ejercicios: [
        entrada('press_banca_mancuernas', 3, 10, 12),
        entrada('press_hombros_mancuernas', 3, 10, 12),
        entrada('elevaciones_laterales', 3, 12, 15, DESCANSO_AISLADO),
        entrada('fondos_en_banca', 3, 12, 15, DESCANSO_AISLADO),
        entrada('plancha_frontal', 3, 30, 60, DESCANSO_AISLADO),
      ],
    },
    {
      nombre_dia: 'Tren Inferior - Glúteos/Isquios',
      ejercicios: [
        entrada('peso_muerto_rumano', 3, 10, 12),
        entrada('hip_thrust', 3, 10, 12),
        entrada('sentadilla_bulgara', 3, 10, 12),
        entrada('curl_isquiotibiales_maquina', 3, 12, 15, DESCANSO_AISLADO),
        entrada('puente_pelvis_suelo', 3, 15, 20, DESCANSO_AISLADO),
      ],
    },
    {
      nombre_dia: 'Tren Superior - Tirón',
      ejercicios: [
        entrada('remo_mancuerna_una_mano', 3, 10, 12),
        entrada('jalon_al_pecho', 3, 10, 12),
        entrada('remo_sentado_polea', 3, 10, 12),
        entrada('curl_biceps_mancuernas', 3, 12, 15, DESCANSO_AISLADO),
        entrada('face_pulls', 3, 15, 20, DESCANSO_AISLADO),
      ],
    },
    {
      nombre_dia: 'Tren Inferior - Cuádriceps/Glúteos',
      ejercicios: [
        entrada('sentadilla_barra', 3, 10, 12),
        entrada('prensa_piernas', 3, 12, 15),
        entrada('zancadas_mancuernas', 3, 10, 12),
        entrada('extension_piernas_maquina', 3, 12, 15, DESCANSO_AISLADO),
        entrada('elevacion_gemelos_maquina', 3, 15, 15, DESCANSO_AISLADO),
      ],
    },
    {
      nombre_dia: 'Cuerpo Completo - Metabólico',
      ejercicios: [
        entrada('peso_muerto_convencional', 3, 8, 10, DESCANSO_METABOLICO),
        entrada('saltos_al_cajon', 3, 8, 10, DESCANSO_METABOLICO),
        entrada('remo_vertical', 3, 10, 12, DESCANSO_METABOLICO),
        entrada('press_hombros_mancuernas', 3, 10, 12, DESCANSO_METABOLICO),
        entrada('plancha_elevacion_piernas', 3, 10, 12, DESCANSO_METABOLICO),
      ],
    },
  ],
}

export const RUTINA_CASA_5D: RutinaSeed = {
  id: 'rutina:casa_5d',
  nombre: 'Rutina Casa (5 días)',
  descripcion:
    'Rutina de 5 días con peso corporal: tren superior y core, cardio y ' +
    'resistencia, piernas y glúteos, core global y un día de recuperación activa.',
  dias: [
    {
      nombre_dia: 'Tren Superior y Core',
      ejercicios: [
        entrada('flexiones', 3, 8, 12),
        entrada('fondos_triceps_silla', 3, 10, 15),
        entrada('plancha_frontal', 3, 30, 60, DESCANSO_AISLADO),
        entrada('plancha_elevacion_piernas', 3, 10, 12, DESCANSO_AISLADO),
      ],
    },
    {
      nombre_dia: 'Cardio y Resistencia',
      ejercicios: [
        entrada('saltos_tijera', 3, 45, 45, DESCANSO_METABOLICO),
        entrada('rodillas_al_pecho', 3, 45, 45, DESCANSO_METABOLICO),
        entrada('mountain_climbers', 3, 45, 45, DESCANSO_METABOLICO),
        entrada('boxeo_sombra', 3, 45, 45, DESCANSO_METABOLICO),
      ],
    },
    {
      nombre_dia: 'Piernas y Glúteos',
      ejercicios: [
        entrada('sentadilla_peso_corporal', 3, 15, 20),
        entrada('zancadas_peso_corporal', 3, 12, 15),
        entrada('puente_pelvis_suelo', 3, 15, 20, DESCANSO_AISLADO),
        entrada('sentadilla_bulgara', 3, 10, 12),
      ],
    },
    {
      nombre_dia: 'Core y Cuerpo Completo',
      ejercicios: [
        entrada('burpees', 3, 8, 12, DESCANSO_METABOLICO),
        entrada('mountain_climbers', 3, 45, 45, DESCANSO_METABOLICO),
        entrada('russian_twists', 3, 15, 20, DESCANSO_AISLADO),
        entrada('elevacion_piernas_suelo', 3, 15, 20, DESCANSO_AISLADO),
      ],
    },
    {
      nombre_dia: 'Recuperación Activa',
      notas: 'Día de baja intensidad para asimilar la semana.',
      ejercicios: [
        entrada('estiramientos_cuerpo_completo', 1, 10, 15, DESCANSO_AISLADO),
        entrada('yoga_movilidad', 1, 10, 15, DESCANSO_AISLADO),
      ],
    },
  ],
}

export const RUTINAS_SEED: readonly RutinaSeed[] = [RUTINA_GIMNASIO_5D, RUTINA_CASA_5D]
