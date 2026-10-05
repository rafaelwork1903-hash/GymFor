/**
 * Tipos de dominio puros de GymFor.
 *
 * Sin dependencias de React Native ni de expo-sqlite: este módulo puede
 * importarse desde cualquier capa (UI, DB, tests) sin efectos secundarios.
 *
 * Los campos usan snake_case en español para mapear 1:1 con el esquema SQL
 * (src/db/schema.ts) y con el modelo de datos definido en agent.md.
 */

// ─── Enumeraciones ────────────────────────────────────────────────────────────

export const OBJETIVOS = ['hipertrofia', 'fuerza', 'resistencia', 'perdida_grasa'] as const
export type Objetivo = (typeof OBJETIVOS)[number]

export const NIVELES = ['principiante', 'intermedio', 'avanzado'] as const
export type Nivel = (typeof NIVELES)[number]

export const SEXOS = ['masculino', 'femenino', 'otro'] as const
export type Sexo = (typeof SEXOS)[number]

export const GRUPOS_MUSCULARES = [
  'pecho',
  'espalda',
  'hombros',
  'biceps',
  'triceps',
  'cuadriceps',
  'isquios',
  'gluteos',
  'gemelos',
  'core',
  'cuerpo_completo',
  'movilidad',
] as const
export type GrupoMuscular = (typeof GRUPOS_MUSCULARES)[number]

export const EQUIPAMIENTOS = ['barra', 'mancuernas', 'maquina', 'peso_corporal'] as const
export type Equipamiento = (typeof EQUIPAMIENTOS)[number]

/** Series directas cuentan 1.0; series indirectas (grupo secundario) cuentan 0.5. */
export const FACTOR_FRACCIONAL_DIRECTO = 1.0
export const FACTOR_FRACCIONAL_INDIRECTO = 0.5

export const TENDENCIAS = ['subiendo', 'estancado', 'bajando'] as const
export type Tendencia = (typeof TENDENCIAS)[number]

// ─── Entidades ────────────────────────────────────────────────────────────────

/** Campos comunes a las filas persistidas (sincronización futura y auditoría). */
export interface CamposPersistidos {
  /** ISO 8601. */
  creado_en: string
  /** ISO 8601. */
  actualizado_en: string
  /** 0 = pendiente de sincronizar, 1 = sincronizado. Preparado para sync en la nube. */
  sincronizado: 0 | 1
}

export interface Usuario extends CamposPersistidos {
  id: string
  nombre: string
  /** ISO 8601 (solo fecha). */
  fecha_nacimiento: string | null
  sexo: Sexo | null
  peso_inicial: number | null
  objetivo: Objetivo | null
  nivel: Nivel | null
  /** JSON serializado con preferencias de entrenamiento. */
  configuracion_entrenamiento: Record<string, unknown>
}

export interface Rutina extends CamposPersistidos {
  id: string
  /** NULL en las rutinas plantilla (semilla); se asigna al clonarlas para un usuario. */
  usuario_id: string | null
  nombre: string
  descripcion: string
  activa: 0 | 1
}

export interface DiaRutina {
  id: string
  rutina_id: string
  /** Ej.: "Tren Superior - Empuje". */
  nombre_dia: string
  orden: number
  notas: string | null
}

export interface EjercicioEnRutina {
  id: string
  dia_id: string
  ejercicio_id: string
  orden: number
  series_objetivo: number
  reps_objetivo_min: number
  reps_objetivo_max: number
  /** Peso de partida sugerido; se ajusta dinámicamente. NULL = sin sugerencia. */
  peso_objetivo: number | null
  descanso_segundos: number | null
}

export interface Ejercicio {
  id: string
  nombre: string
  grupo_muscular_primario: GrupoMuscular
  grupos_musculares_secundarios: GrupoMuscular[]
  equipamiento: Equipamiento
  es_compuesto: 0 | 1
  /** 1.0 = volumen directo, 0.5 = volumen indirecto para el grupo primario. */
  factor_fraccional: number
  instrucciones: string | null
  video_url: string | null
}

export interface SesionEntrenamiento extends CamposPersistidos {
  id: string
  usuario_id: string
  dia_rutina_id: string
  /** ISO 8601 (día del entrenamiento). */
  fecha: string
  duracion_minutos: number | null
  notas: string | null
  /** Esfuerzo percibido global de la sesión (1-10). */
  rpe_sesion: number | null
}

export interface RegistroEjercicio {
  id: string
  sesion_id: string
  ejercicio_id: string
  rpe_ejercicio: number | null
}

export interface SerieReal {
  id: string
  registro_id: string
  numero_serie: number
  peso_levantado: number
  reps_realizadas: number
  /** 1-10. */
  rpe_serie: number | null
  /** Repeticiones en reserva (0-10). Alternativa a rpe_serie. */
  rir: number | null
  completada: 0 | 1
  notas: string | null
}

export interface MetricaProgreso extends CamposPersistidos {
  id: string
  usuario_id: string
  ejercicio_id: string
  /** ISO 8601 (fecha a la que corresponde la métrica). */
  fecha: string
  /** Σ(peso × reps) de las series completadas. */
  volumen_total: number
  /** Estimación Epley: peso × (1 + 0.0333 × reps). */
  rm1_estimado: number
  series_efectivas_semana: number
  tendencia: Tendencia
}
