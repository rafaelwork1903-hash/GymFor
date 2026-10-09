/**
 * Store de configuración global de la app.
 *
 * Maneja el tema (sistema/claro/oscuro, persistido) y el usuario activo.
 * El usuario se carga/crea via repositorio.
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

import type { Usuario, Objetivo, Nivel, Sexo } from '../domain/types'
import { ejecutarAccion, type EstadoCarga } from './utilidades'
import {
  obtenerUsuarioPorId,
  listarUsuarios,
  crearUsuario,
} from '../db/repositories/usuario.repository'

/** Preferencia de tema: seguir al sistema o forzar claro/oscuro. */
export type Tema = 'sistema' | 'claro' | 'oscuro'

/** Nombre del usuario que se autocrea mientras no exista onboarding. */
export const NOMBRE_USUARIO_INICIAL = 'Atleta'

export interface ConfiguracionEstado extends EstadoCarga {
  tema: Tema
  usuarioActivo: Usuario | null
  cambiarTema: (tema: Tema) => void
  cargarUsuario: (id: string) => Promise<void>
  crearUsuarioInicial: (datos: {
    nombre: string
    fecha_nacimiento?: string
    sexo?: Sexo
    peso_inicial?: number
    objetivo?: Objetivo
    nivel?: Nivel
  }) => Promise<void>
  /**
   * Garantiza un `usuarioActivo`: reutiliza el primer usuario de la BD
   * (idempotente entre arranques; el estado no persiste al usuario en
   * nativo) o crea el usuario inicial si la BD está vacía. Sin esto,
   * `sesiones.usuario_id NOT NULL` haría fallar `iniciarSesion`.
   */
  asegurarUsuario: () => Promise<void>
  limpiarUsuario: () => void
}

/** Versión del esquema persistido; la migración 1→2 introduce `sistema`. */
const VERSION_PERSISTENCIA = 2

const TEMA_POR_DEFECTO: Tema = 'sistema'

export const useConfiguracionStore = create<ConfiguracionEstado>()(
  persist(
    (set, get) => ({
      tema: TEMA_POR_DEFECTO,
      usuarioActivo: null,
      cargando: false,
      error: null,

      cambiarTema: (tema: Tema) =>
        set({ tema }),

      cargarUsuario: async (id: string) => {
        await ejecutarAccion(set, async (db) => {
          const usuario = await obtenerUsuarioPorId(db, id)
          if (!usuario) {
            throw new Error(`Usuario no encontrado: ${id}`)
          }
          return usuario
        }, (usuario) => ({ usuarioActivo: usuario }))
      },

      crearUsuarioInicial: async (datos) => {
        await ejecutarAccion(set, async (db) => {
          const nuevoUsuario: Usuario = {
            id: crypto.randomUUID(),
            nombre: datos.nombre,
            fecha_nacimiento: datos.fecha_nacimiento ?? null,
            sexo: datos.sexo ?? null,
            peso_inicial: datos.peso_inicial ?? null,
            objetivo: datos.objetivo ?? null,
            nivel: datos.nivel ?? null,
            configuracion_entrenamiento: {},
            creado_en: new Date().toISOString(),
            actualizado_en: new Date().toISOString(),
            sincronizado: 0,
          }
          await crearUsuario(db, nuevoUsuario)
          return nuevoUsuario
        }, (usuario) => ({ usuarioActivo: usuario }))
      },

      asegurarUsuario: async () => {
        // Idempotente: si ya hay usuario activo no toca la BD.
        if (get().usuarioActivo) {
          return
        }
        await ejecutarAccion(set, async (db) => {
          const existentes = await listarUsuarios(db)
          return existentes[0] ?? null
        }, (usuario) => (usuario ? { usuarioActivo: usuario } : {}))
        if (!get().usuarioActivo) {
          await get().crearUsuarioInicial({ nombre: NOMBRE_USUARIO_INICIAL })
        }
      },

      limpiarUsuario: () =>
        set({ usuarioActivo: null, error: null }),
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