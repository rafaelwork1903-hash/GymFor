/**
 * Esquema SQL de GymFor (SQLite / expo-sqlite).
 *
 * Versión 1 del esquema. Las columnas mapean 1:1 con los tipos de dominio
 * (src/domain/types.ts). Convenciones:
 * - IDs UUID en TEXT (clave primaria).
 * - Booleanos como INTEGER 0/1.
 * - Fechas como TEXT ISO 8601.
 * - JSON (listas/configuración) como TEXT serializado.
 * - Borrado en cascada en las jerarquías propietarias
 *   (rutina → días → ejercicios; sesión → registros → series).
 */

export const ESQUEMA_VERSION_1 = `
CREATE TABLE IF NOT EXISTS usuarios (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  fecha_nacimiento TEXT,
  sexo TEXT CHECK (sexo IN ('masculino', 'femenino', 'otro') OR sexo IS NULL),
  peso_inicial REAL CHECK (peso_inicial IS NULL OR peso_inicial > 0),
  objetivo TEXT CHECK (objetivo IN ('hipertrofia', 'fuerza', 'resistencia', 'perdida_grasa') OR objetivo IS NULL),
  nivel TEXT CHECK (nivel IN ('principiante', 'intermedio', 'avanzado') OR nivel IS NULL),
  configuracion_entrenamiento TEXT NOT NULL DEFAULT '{}',
  creado_en TEXT NOT NULL,
  actualizado_en TEXT NOT NULL,
  sincronizado INTEGER NOT NULL DEFAULT 0 CHECK (sincronizado IN (0, 1))
);

CREATE TABLE IF NOT EXISTS rutinas (
  id TEXT PRIMARY KEY,
  usuario_id TEXT REFERENCES usuarios(id) ON DELETE SET NULL,
  nombre TEXT NOT NULL,
  descripcion TEXT NOT NULL DEFAULT '',
  activa INTEGER NOT NULL DEFAULT 0 CHECK (activa IN (0, 1)),
  creado_en TEXT NOT NULL,
  actualizado_en TEXT NOT NULL,
  sincronizado INTEGER NOT NULL DEFAULT 0 CHECK (sincronizado IN (0, 1))
);

CREATE TABLE IF NOT EXISTS dias_rutina (
  id TEXT PRIMARY KEY,
  rutina_id TEXT NOT NULL REFERENCES rutinas(id) ON DELETE CASCADE,
  nombre_dia TEXT NOT NULL,
  orden INTEGER NOT NULL CHECK (orden >= 0),
  notas TEXT,
  UNIQUE (rutina_id, orden)
);

CREATE TABLE IF NOT EXISTS ejercicios (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE,
  grupo_muscular_primario TEXT NOT NULL CHECK (grupo_muscular_primario IN (
    'pecho', 'espalda', 'hombros', 'biceps', 'triceps', 'cuadriceps',
    'isquios', 'gluteos', 'gemelos', 'core', 'cuerpo_completo', 'movilidad'
  )),
  grupos_musculares_secundarios TEXT NOT NULL DEFAULT '[]',
  equipamiento TEXT NOT NULL CHECK (equipamiento IN ('barra', 'mancuernas', 'maquina', 'peso_corporal')),
  es_compuesto INTEGER NOT NULL DEFAULT 0 CHECK (es_compuesto IN (0, 1)),
  factor_fraccional REAL NOT NULL DEFAULT 1.0 CHECK (factor_fraccional > 0 AND factor_fraccional <= 1),
  instrucciones TEXT,
  video_url TEXT
);

CREATE TABLE IF NOT EXISTS ejercicios_en_rutina (
  id TEXT PRIMARY KEY,
  dia_id TEXT NOT NULL REFERENCES dias_rutina(id) ON DELETE CASCADE,
  ejercicio_id TEXT NOT NULL REFERENCES ejercicios(id) ON DELETE RESTRICT,
  orden INTEGER NOT NULL CHECK (orden >= 0),
  series_objetivo INTEGER NOT NULL CHECK (series_objetivo > 0),
  reps_objetivo_min INTEGER NOT NULL CHECK (reps_objetivo_min > 0),
  reps_objetivo_max INTEGER NOT NULL CHECK (reps_objetivo_max >= reps_objetivo_min),
  peso_objetivo REAL CHECK (peso_objetivo IS NULL OR peso_objetivo >= 0),
  descanso_segundos INTEGER CHECK (descanso_segundos IS NULL OR descanso_segundos >= 0),
  UNIQUE (dia_id, orden)
);

CREATE TABLE IF NOT EXISTS sesiones (
  id TEXT PRIMARY KEY,
  usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  dia_rutina_id TEXT NOT NULL REFERENCES dias_rutina(id) ON DELETE RESTRICT,
  fecha TEXT NOT NULL,
  duracion_minutos INTEGER CHECK (duracion_minutos IS NULL OR duracion_minutos >= 0),
  notas TEXT,
  rpe_sesion REAL CHECK (rpe_sesion IS NULL OR (rpe_sesion >= 1 AND rpe_sesion <= 10)),
  creado_en TEXT NOT NULL,
  actualizado_en TEXT NOT NULL,
  sincronizado INTEGER NOT NULL DEFAULT 0 CHECK (sincronizado IN (0, 1))
);

CREATE TABLE IF NOT EXISTS registros_ejercicio (
  id TEXT PRIMARY KEY,
  sesion_id TEXT NOT NULL REFERENCES sesiones(id) ON DELETE CASCADE,
  ejercicio_id TEXT NOT NULL REFERENCES ejercicios(id) ON DELETE RESTRICT,
  rpe_ejercicio REAL CHECK (rpe_ejercicio IS NULL OR (rpe_ejercicio >= 1 AND rpe_ejercicio <= 10))
);

CREATE TABLE IF NOT EXISTS series (
  id TEXT PRIMARY KEY,
  registro_id TEXT NOT NULL REFERENCES registros_ejercicio(id) ON DELETE CASCADE,
  numero_serie INTEGER NOT NULL CHECK (numero_serie > 0),
  peso_levantado REAL NOT NULL CHECK (peso_levantado >= 0),
  reps_realizadas INTEGER NOT NULL CHECK (reps_realizadas >= 0),
  rpe_serie REAL CHECK (rpe_serie IS NULL OR (rpe_serie >= 1 AND rpe_serie <= 10)),
  rir REAL CHECK (rir IS NULL OR (rir >= 0 AND rir <= 10)),
  completada INTEGER NOT NULL DEFAULT 1 CHECK (completada IN (0, 1)),
  notas TEXT,
  UNIQUE (registro_id, numero_serie)
);

CREATE TABLE IF NOT EXISTS metricas_progreso (
  id TEXT PRIMARY KEY,
  usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  ejercicio_id TEXT NOT NULL REFERENCES ejercicios(id) ON DELETE CASCADE,
  fecha TEXT NOT NULL,
  volumen_total REAL NOT NULL DEFAULT 0 CHECK (volumen_total >= 0),
  rm1_estimado REAL NOT NULL DEFAULT 0 CHECK (rm1_estimado >= 0),
  series_efectivas_semana REAL NOT NULL DEFAULT 0 CHECK (series_efectivas_semana >= 0),
  tendencia TEXT NOT NULL CHECK (tendencia IN ('subiendo', 'estancado', 'bajando')),
  creado_en TEXT NOT NULL,
  actualizado_en TEXT NOT NULL,
  sincronizado INTEGER NOT NULL DEFAULT 0 CHECK (sincronizado IN (0, 1))
);

CREATE INDEX IF NOT EXISTS idx_rutinas_usuario ON rutinas(usuario_id);
CREATE INDEX IF NOT EXISTS idx_dias_rutina_rutina ON dias_rutina(rutina_id, orden);
CREATE INDEX IF NOT EXISTS idx_ejercicios_en_rutina_dia ON ejercicios_en_rutina(dia_id, orden);
CREATE INDEX IF NOT EXISTS idx_ejercicios_grupo ON ejercicios(grupo_muscular_primario);
CREATE INDEX IF NOT EXISTS idx_sesiones_usuario_fecha ON sesiones(usuario_id, fecha);
CREATE INDEX IF NOT EXISTS idx_sesiones_dia_rutina ON sesiones(dia_rutina_id);
CREATE INDEX IF NOT EXISTS idx_registros_sesion ON registros_ejercicio(sesion_id);
CREATE INDEX IF NOT EXISTS idx_series_registro ON series(registro_id, numero_serie);
CREATE INDEX IF NOT EXISTS idx_metricas_usuario_ejercicio ON metricas_progreso(usuario_id, ejercicio_id, fecha);
`

/** Orden inverso de dependencias para el down de la migración 1. */
export const ESQUEMA_VERSION_1_DOWN = `
DROP INDEX IF EXISTS idx_metricas_usuario_ejercicio;
DROP INDEX IF EXISTS idx_series_registro;
DROP INDEX IF EXISTS idx_registros_sesion;
DROP INDEX IF EXISTS idx_sesiones_dia_rutina;
DROP INDEX IF EXISTS idx_sesiones_usuario_fecha;
DROP INDEX IF EXISTS idx_ejercicios_grupo;
DROP INDEX IF EXISTS idx_ejercicios_en_rutina_dia;
DROP INDEX IF EXISTS idx_dias_rutina_rutina;
DROP INDEX IF EXISTS idx_rutinas_usuario;
DROP TABLE IF EXISTS metricas_progreso;
DROP TABLE IF EXISTS series;
DROP TABLE IF EXISTS registros_ejercicio;
DROP TABLE IF EXISTS sesiones;
DROP TABLE IF EXISTS ejercicios_en_rutina;
DROP TABLE IF EXISTS ejercicios;
DROP TABLE IF EXISTS dias_rutina;
DROP TABLE IF EXISTS rutinas;
DROP TABLE IF EXISTS usuarios;
`
