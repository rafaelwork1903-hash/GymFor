/**
 * Contratos de acceso a datos de GymFor (agnósticos de SQL y de motor de BD).
 *
 * Si algún día se migra a una base de datos no relacional o remota
 * (WatermelonDB, Realm, Firestore, MongoDB, Supabase SDK, API REST/GraphQL),
 * basta con implementar `RepositoriosApp` y registrarla con
 * `configurarRepositoriosPersonalizados` o `configurarProveedorPersistencia`:
 * ningún store de Zustand ni pantalla necesita modificarse.
 */

import type {
  Ejercicio,
  MetricaProgreso,
  Rutina,
  RutinaEditada,
  SerieReal,
  SesionEntrenamiento,
  SesionResumen,
  Usuario,
} from '../domain/types'
import type { FiltroEjercicios } from './repositories/ejercicio.repository'
import type { NuevaMetrica } from './repositories/metrica.repository'
import type { NuevaRutina, RutinaDetalle } from './repositories/rutina.repository'
import type {
  CambiosSerie,
  DatosFinalizarSesion,
  NuevaSesion,
  SesionDetalle,
} from './repositories/sesion.repository'
import type { NuevoUsuario } from './repositories/usuario.repository'

export interface RepositorioEjercicios {
  listarEjercicios(filtro?: FiltroEjercicios): Promise<Ejercicio[]>
  obtenerEjercicioPorId(id: string): Promise<Ejercicio | null>
  crearEjercicio(ejercicio: Ejercicio): Promise<void>
}

export interface RepositorioUsuarios {
  crearUsuario(usuario: NuevoUsuario): Promise<Usuario>
  obtenerUsuarioPorId(id: string): Promise<Usuario | null>
  listarUsuarios(): Promise<Usuario[]>
  actualizarUsuario(id: string, cambios: Partial<Omit<NuevoUsuario, 'id'>>): Promise<void>
  eliminarUsuario(id: string): Promise<void>
}

export interface RepositorioRutinas {
  listarRutinas(usuarioId?: string): Promise<Rutina[]>
  obtenerRutinaPorId(id: string): Promise<Rutina | null>
  obtenerRutinaDetalle(id: string): Promise<RutinaDetalle | null>
  crearRutina(rutina: NuevaRutina): Promise<Rutina>
  actualizarRutina(
    id: string,
    cambios: Partial<Pick<Rutina, 'nombre' | 'descripcion'>>,
  ): Promise<void>
  guardarRutina(id: string, datos: RutinaEditada): Promise<RutinaDetalle>
  activarRutina(rutinaId: string, usuarioId: string): Promise<void>
  desactivarRutina(id: string): Promise<void>
  eliminarRutina(id: string): Promise<void>
}

export interface RepositorioSesiones {
  listarSesionesPorUsuario(
    usuarioId: string,
    rango?: { desde?: string; hasta?: string },
  ): Promise<SesionResumen[]>
  obtenerSesionDetalle(id: string): Promise<SesionDetalle | null>
  crearSesion(nueva: NuevaSesion): Promise<SesionEntrenamiento>
  finalizarSesion(
    sesionId: string,
    datos?: DatosFinalizarSesion,
  ): Promise<{ actualizado_en: string }>
  agregarSerie(
    registroId: string,
    serie: Omit<SerieReal, 'id' | 'registro_id'>,
  ): Promise<SerieReal>
  actualizarSerie(serieId: string, cambios: CambiosSerie): Promise<SerieReal>
  eliminarSerie(serieId: string): Promise<void>
  reordenarSeries(registroId: string, serieIdsEnOrden: readonly string[]): Promise<void>
  eliminarSesion(id: string): Promise<void>
}

export interface RepositorioMetricas {
  guardarMetrica(metrica: NuevaMetrica): Promise<MetricaProgreso>
  listarMetricasPorEjercicio(
    usuarioId: string,
    ejercicioId: string,
    limite?: number,
  ): Promise<MetricaProgreso[]>
}

/** Fachada unificada de todos los repositorios de dominio de la app. */
export interface RepositoriosApp {
  readonly ejercicios: RepositorioEjercicios
  readonly usuarios: RepositorioUsuarios
  readonly rutinas: RepositorioRutinas
  readonly sesiones: RepositorioSesiones
  readonly metricas: RepositorioMetricas
}
