/**
 * Registro de implementaciones de repositorios.
 *
 * Por defecto construye `RepositoriosApp` delegando perezosamente en los
 * repositorios SQL sobre `ConexionBD`. Permite inyectar una fábrica
 * alternativa (NoSQL, ORM, SDK remoto o memoria) sin tocar los stores ni
 * romper los mocks unitarios de Jest sobre `src/db/repositories/*.repository`.
 */

import type { RepositoriosApp } from './contracts'
import type { ConexionBD } from './port'
import * as ejercicioRepoSQL from './repositories/ejercicio.repository'
import * as metricaRepoSQL from './repositories/metrica.repository'
import * as rutinaRepoSQL from './repositories/rutina.repository'
import * as sesionRepoSQL from './repositories/sesion.repository'
import * as usuarioRepoSQL from './repositories/usuario.repository'

export type FabricaRepositorios = (db: ConexionBD) => RepositoriosApp

let fabricaPersonalizada: FabricaRepositorios | null = null

/** Construye la implementación relacional estándar sobre cualquier `ConexionBD`. */
export function crearRepositoriosSQL(db: ConexionBD): RepositoriosApp {
  return {
    ejercicios: {
      listarEjercicios: (filtro) => ejercicioRepoSQL.listarEjercicios(db, filtro),
      obtenerEjercicioPorId: (id) => ejercicioRepoSQL.obtenerEjercicioPorId(db, id),
      crearEjercicio: (ejercicio) => ejercicioRepoSQL.crearEjercicio(db, ejercicio),
    },
    usuarios: {
      crearUsuario: (usuario) => usuarioRepoSQL.crearUsuario(db, usuario),
      obtenerUsuarioPorId: (id) => usuarioRepoSQL.obtenerUsuarioPorId(db, id),
      listarUsuarios: () => usuarioRepoSQL.listarUsuarios(db),
      actualizarUsuario: (id, cambios) => usuarioRepoSQL.actualizarUsuario(db, id, cambios),
      eliminarUsuario: (id) => usuarioRepoSQL.eliminarUsuario(db, id),
    },
    rutinas: {
      listarRutinas: (usuarioId) => rutinaRepoSQL.listarRutinas(db, usuarioId),
      obtenerRutinaPorId: (id) => rutinaRepoSQL.obtenerRutinaPorId(db, id),
      obtenerRutinaDetalle: (id) => rutinaRepoSQL.obtenerRutinaDetalle(db, id),
      crearRutina: (rutina) => rutinaRepoSQL.crearRutina(db, rutina),
      actualizarRutina: (id, cambios) => rutinaRepoSQL.actualizarRutina(db, id, cambios),
      guardarRutina: (id, datos) => rutinaRepoSQL.guardarRutina(db, id, datos),
      activarRutina: (rutinaId, usuarioId) =>
        rutinaRepoSQL.activarRutina(db, rutinaId, usuarioId),
      desactivarRutina: (id) => rutinaRepoSQL.desactivarRutina(db, id),
      eliminarRutina: (id) => rutinaRepoSQL.eliminarRutina(db, id),
    },
    sesiones: {
      listarSesionesPorUsuario: (usuarioId, rango) =>
        sesionRepoSQL.listarSesionesPorUsuario(db, usuarioId, rango),
      obtenerSesionDetalle: (id) => sesionRepoSQL.obtenerSesionDetalle(db, id),
      crearSesion: (nueva) => sesionRepoSQL.crearSesion(db, nueva),
      finalizarSesion: (sesionId, datos) => sesionRepoSQL.finalizarSesion(db, sesionId, datos),
      agregarSerie: (registroId, serie) => sesionRepoSQL.agregarSerie(db, registroId, serie),
      actualizarSerie: (serieId, cambios) =>
        sesionRepoSQL.actualizarSerie(db, serieId, cambios),
      eliminarSerie: (serieId) => sesionRepoSQL.eliminarSerie(db, serieId),
      reordenarSeries: (registroId, serieIdsEnOrden) =>
        sesionRepoSQL.reordenarSeries(db, registroId, serieIdsEnOrden),
      eliminarSesion: (id) => sesionRepoSQL.eliminarSesion(db, id),
    },
    metricas: {
      guardarMetrica: (metrica) => metricaRepoSQL.guardarMetrica(db, metrica),
      listarMetricasPorEjercicio: (usuarioId, ejercicioId, limite) =>
        metricaRepoSQL.listarMetricasPorEjercicio(db, usuarioId, ejercicioId, limite),
    },
  }
}

/**
 * Sustituye (o restaura pasando `null`) la fábrica de repositorios que reciben
 * los stores de Zustand.
 */
export function configurarRepositoriosPersonalizados(
  fabrica: FabricaRepositorios | null,
): void {
  fabricaPersonalizada = fabrica
}

/** Resuelve los repositorios activos para la conexión `db`. */
export function obtenerRepositorios(db: ConexionBD): RepositoriosApp {
  return fabricaPersonalizada ? fabricaPersonalizada(db) : crearRepositoriosSQL(db)
}
