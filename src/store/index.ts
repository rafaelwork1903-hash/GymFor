/**
 * Barrel de exports de la capa de estado (Zustand).
 */

export { useConfiguracionStore } from './configuracion.store'
export { useRutinasStore } from './rutinas.store'
export { useSesionStore } from './sesion.store'

export type { EstadoCarga } from './utilidades'
export { ejecutarAccion, ejecutarSincrono, mensajeDeError } from './utilidades'

export * from './selectores'