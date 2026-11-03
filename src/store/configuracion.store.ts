/**
 * Store de configuración global de la app.
 *
 * Maneja el tema (sistema/claro/oscuro, persistido) y el usuario activo
 * junto con su flujo de onboarding y edición de perfil.
 * El usuario se carga/crea/actualiza exclusivamente vía `repos.usuarios`.
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

import type { NuevoUsuario } from '../db/repositories/usuario.repository'
import type { Usuario, Objetivo, Nivel, Sexo } from '../domain/types'
import { ahoraISO, generarId } from '../utils/id'
import { ejecutarAccion, type EstadoCarga } from './utilidades'

/** Preferencia de tema: seguir al sistema o forzar claro/oscuro. */
export type Tema = 'sistema' | 'claro' | 'oscuro'

/** Nombre del usuario que se autocrea en el bootstrap antes del onboarding. */
export const NOMBRE_USUARIO_INICIAL = 'Atleta'

/** Clave dentro de `usuarios.configuracion_entrenamiento` que marca el onboarding. */
export const CLAVE_ONBOARDING_COMPLETADO = 'onboarding_completado' as const

/**
 * Campos editables del perfil de usuario (derivado de `NuevoUsuario` sin
 * duplicar la entidad de dominio).
 */
export type DatosPerfil = Omit<NuevoUsuario, 'id' | 'configuracion_entrenamiento'>

/** Datos aceptados al crear el usuario inicial o completar onboarding sin fila previa. */
export interface DatosUsuarioInicial {
  nombre: string
  fecha_nacimiento?: string | null
  sexo?: Sexo | null
  peso_inicial?: number | null
  objetivo?: Objetivo | null
  nivel?: Nivel | null
  /** Si es `true`, persiste `{ onboarding_completado: true }` en `configuracion_entrenamiento`. */
  onboarding_completado?: boolean
}

/**
 * Selector puro que determina si un usuario ya completó su perfil.
 *
 * Devuelve `true` cuando:
 * - `configuracion_entrenamiento.onboarding_completado === true`, o
 * - tiene `nombre` no vacío y definió `objetivo` o `nivel`.
 *
 * El usuario `"Atleta"` autocreado por `asegurarUsuario` no cumple ninguna de
 * las dos condiciones (`false`), activando la pantalla de bienvenida.
 */
export function esPerfilCompletado(usuario: Usuario | null): boolean {
  if (!usuario) {
    return false
  }
  if (usuario.configuracion_entrenamiento?.[CLAVE_ONBOARDING_COMPLETADO] === true) {
    return true
  }
  const tieneNombre = typeof usuario.nombre === 'string' && usuario.nombre.trim().length > 0
  return tieneNombre && Boolean(usuario.objetivo || usuario.nivel)
}

/** Selector derivado para consumir desde `useConfiguracionStore(seleccionarPerfilCompletado)`. */
export function seleccionarPerfilCompletado(
  estado: Pick<ConfiguracionEstado, 'usuarioActivo'>,
): boolean {
  return esPerfilCompletado(estado.usuarioActivo)
}

export interface ConfiguracionEstado extends EstadoCarga {
  tema: Tema
  usuarioActivo: Usuario | null
  /** Derivado de `usuarioActivo` (no se persiste duplicado en almacenamiento local). */
  perfilCompletado: boolean
  cambiarTema: (tema: Tema) => void
  cargarUsuario: (id: string) => Promise<void>
  crearUsuarioInicial: (datos: DatosUsuarioInicial) => Promise<Usuario | undefined>
  /**
   * Actualiza el perfil del `usuarioActivo` en BD, marca
   * `onboarding_completado: true` en `configuracion_entrenamiento` y relee el
   * usuario canónico desde `repos.usuarios.obtenerUsuarioPorId`.
   */
  actualizarPerfil: (datos: Partial<DatosPerfil>) => Promise<Usuario | undefined>
  /**
   * Garantiza un `usuarioActivo`: reutiliza el primer usuario de la BD
   * (idempotente entre arranques; el estado no persiste al usuario en
   * nativo) o crea el usuario inicial si la BD está vacía. Sin esto,
   * `sesiones.usuario_id NOT NULL` haría fallar `iniciarSesion`.
   */
  asegurarUsuario: () => Promise<void>
  limpiarUsuario: () => void
  limpiarError: () => void
}

/** Versión del esquema persistido; la migración 1→2 introduce `sistema`. */
const VERSION_PERSISTENCIA = 2

const TEMA_POR_DEFECTO: Tema = 'sistema'

export const useConfiguracionStore = create<ConfiguracionEstado>()(
  persist(
    (set, get) => ({
      tema: TEMA_POR_DEFECTO,
      usuarioActivo: null,
      perfilCompletado: false,
      cargando: false,
      error: null,

      cambiarTema: (tema: Tema) =>
        set({ tema }),

      cargarUsuario: async (id: string) => {
        await ejecutarAccion(
          set,
          async (_db, repos) => {
            const usuario = await repos.usuarios.obtenerUsuarioPorId(id)
            if (!usuario) {
              throw new Error(`Usuario no encontrado: ${id}`)
            }
            return usuario
          },
          (usuario) => ({
            usuarioActivo: usuario,
            perfilCompletado: esPerfilCompletado(usuario),
          }),
        )
      },

      crearUsuarioInicial: async (datos) => {
        return ejecutarAccion(
          set,
          async (_db, repos) => {
            const nombreLimpio = datos.nombre.trim()
            if (nombreLimpio.length === 0) {
              throw new Error('El nombre del usuario no puede estar vacío')
            }
            const ahora = ahoraISO()
            const nuevoUsuario: Usuario = {
              // `crypto.randomUUID` no existe en Hermes (nativo): usar
              // `generarId` (UUID v4 con fallback, ver src/utils/id.ts).
              id: generarId(),
              nombre: nombreLimpio,
              fecha_nacimiento: datos.fecha_nacimiento ?? null,
              sexo: datos.sexo ?? null,
              peso_inicial: datos.peso_inicial ?? null,
              objetivo: datos.objetivo ?? null,
              nivel: datos.nivel ?? null,
              configuracion_entrenamiento: datos.onboarding_completado
                ? { [CLAVE_ONBOARDING_COMPLETADO]: true }
                : {},
              creado_en: ahora,
              actualizado_en: ahora,
              sincronizado: 0,
            }
            await repos.usuarios.crearUsuario(nuevoUsuario)
            return nuevoUsuario
          },
          (usuario) => ({
            usuarioActivo: usuario,
            perfilCompletado: esPerfilCompletado(usuario),
          }),
        )
      },

      actualizarPerfil: async (datos) => {
        const actual = get().usuarioActivo
        if (!actual) {
          set({ error: 'No hay un usuario activo para actualizar el perfil', cargando: false })
          return undefined
        }

        return ejecutarAccion(
          set,
          async (_db, repos) => {
            const cambiosDefinidos = Object.fromEntries(
              Object.entries(datos).filter(([, valor]) => valor !== undefined),
            ) as Partial<DatosPerfil>

            if (typeof cambiosDefinidos.nombre === 'string') {
              const nombreLimpio = cambiosDefinidos.nombre.trim()
              if (nombreLimpio.length === 0) {
                throw new Error('El nombre del usuario no puede estar vacío')
              }
              cambiosDefinidos.nombre = nombreLimpio
            }

            const configuracionActualizada: Record<string, unknown> = {
              ...(actual.configuracion_entrenamiento ?? {}),
              [CLAVE_ONBOARDING_COMPLETADO]: true,
            }

            await repos.usuarios.actualizarUsuario(actual.id, {
              ...cambiosDefinidos,
              configuracion_entrenamiento: configuracionActualizada,
            })

            const releido = await repos.usuarios.obtenerUsuarioPorId(actual.id)
            if (!releido) {
              throw new Error(`Usuario no encontrado tras actualizar: ${actual.id}`)
            }
            return releido
          },
          (usuario) => ({
            usuarioActivo: usuario,
            perfilCompletado: esPerfilCompletado(usuario),
          }),
        )
      },

      asegurarUsuario: async () => {
        // Idempotente: si ya hay usuario activo no toca la BD.
        const existenteEnMemoria = get().usuarioActivo
        if (existenteEnMemoria) {
          if (get().perfilCompletado !== esPerfilCompletado(existenteEnMemoria)) {
            set({ perfilCompletado: esPerfilCompletado(existenteEnMemoria) })
          }
          return
        }
        await ejecutarAccion(
          set,
          async (_db, repos) => {
            const existentes = await repos.usuarios.listarUsuarios()
            return existentes[0] ?? null
          },
          (usuario) =>
            usuario
              ? {
                  usuarioActivo: usuario,
                  perfilCompletado: esPerfilCompletado(usuario),
                }
              : {},
        )
        if (!get().usuarioActivo) {
          await get().crearUsuarioInicial({ nombre: NOMBRE_USUARIO_INICIAL })
        }
      },

      limpiarUsuario: () =>
        set({ usuarioActivo: null, perfilCompletado: false, error: null }),

      limpiarError: () =>
        set({ error: null }),
    }),
    {
      name: 'gymfor-configuracion',
      version: VERSION_PERSISTENCIA,
      /** v1 persistía `claro` por defecto sin haber toggle: se resetea a `sistema`. */
      migrate: (persistido: unknown, version: number) => {
        if (version < 2 && persistido && typeof persistido === 'object') {
          return { ...(persistido as Record<string, unknown>), tema: 'sistema' as Tema }
        }
        return persistido as { tema?: Tema }
      },
      storage: createJSONStorage(() => ({
        getItem: (name) => {
          try {
            return localStorage.getItem(name)
          } catch {
            return null
          }
        },
        setItem: (name, value) => {
          try {
            localStorage.setItem(name, value)
          } catch {
          }
        },
        removeItem: (name) => {
          try {
            localStorage.removeItem(name)
          } catch {
          }
        },
      })),
      partialize: (state) => ({ tema: state.tema }),
    },
  ),
)
