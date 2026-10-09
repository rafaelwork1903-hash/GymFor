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
import { obtenerUsuarioPorId, crearUsuario } from '../db/repositories/usuario.repository'

/** Preferencia de tema: seguir al sistema o forzar claro/oscuro. */
export type Tema = 'sistema' | 'claro' | 'oscuro'

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
  limpiarUsuario: () => void
}

/** Versión del esquema persistido; la migración 1→2 introduce `sistema`. */
const VERSION_PERSISTENCIA = 2

const TEMA_POR_DEFECTO: Tema = 'sistema'

export const useConfiguracionStore = create<ConfiguracionEstado>()(
  persist(
    (set) => ({
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