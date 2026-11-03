/**
 * Barrel de exports de la capa de estado (Zustand).
 */

export {
  useConfiguracionStore,
  esPerfilCompletado,
  seleccionarPerfilCompletado,
  NOMBRE_USUARIO_INICIAL,
  CLAVE_ONBOARDING_COMPLETADO,
  type DatosPerfil,
  type DatosUsuarioInicial,
  type Tema,
} from './configuracion.store'
export { useEjerciciosStore } from './ejercicios.store'
export { useMediaStore } from './media.store'
export { useRutinasStore } from './rutinas.store'
export { useSesionStore, type CambiosSerie } from './sesion.store'

export type { EstadoCarga } from './utilidades'
export { ejecutarAccion, ejecutarSincrono, mensajeDeError } from './utilidades'

export * from './selectores'
