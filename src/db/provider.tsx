/**
 * Proveedor React agnóstico de motor de base de datos.
 *
 * Sustituye a `<SQLiteProvider>` de `expo-sqlite` en `app/_layout.tsx` para que
 * la capa de UI no dependa de ningún paquete de BD concreto:
 * - Serializa la apertura e inicialización sobre el MISMO singleton de `client.ts`
 *   (evitando abrir conexiones paralelas en el worker WASM de web).
 * - Muestra un indicador de carga accesible mientras inicializa (sin `return null`).
 * - Relanza cualquier error durante el render para que `<ErrorBoundary>` lo
 *   capture y permita reintentar limpiamente.
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'

import { asegurarBaseDatosLista } from './client'
import type { ConexionBD } from './port'

const ContextoBaseDatos = createContext<ConexionBD | null>(null)

export interface ProveedorBaseDatosProps {
  children: ReactNode
  /** Función de arranque inyectable (por defecto `asegurarBaseDatosLista`). */
  inicializar?: () => Promise<ConexionBD>
}

type FaseProveedor =
  | { estado: 'cargando' }
  | { estado: 'lista'; db: ConexionBD }
  | { estado: 'error'; error: Error }

function normalizarError(error: unknown): Error {
  if (error instanceof Error) {
    return error
  }
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const mensaje = (error as { message?: unknown }).message
    if (typeof mensaje === 'string' && mensaje.length > 0) {
      return new Error(mensaje)
    }
  }
  return new Error(typeof error === 'string' ? error : 'No se pudo inicializar la base de datos')
}

export function ProveedorBaseDatos({
  children,
  inicializar = asegurarBaseDatosLista,
}: ProveedorBaseDatosProps) {
  const [fase, setFase] = useState<FaseProveedor>({ estado: 'cargando' })

  useEffect(() => {
    let cancelado = false

    inicializar()
      .then((db) => {
        if (!cancelado) {
          setFase({ estado: 'lista', db })
        }
      })
      .catch((err: unknown) => {
        if (!cancelado) {
          setFase({ estado: 'error', error: normalizarError(err) })
        }
      })

    return () => {
      cancelado = true
    }
  }, [inicializar])

  if (fase.estado === 'error') {
    throw fase.error
  }

  if (fase.estado === 'cargando') {
    return (
      <View
        style={estilos.contenedorCarga}
        accessibilityRole="progressbar"
        accessibilityLabel="Iniciando base de datos"
      >
        <ActivityIndicator size="large" />
      </View>
    )
  }

  return <ContextoBaseDatos.Provider value={fase.db}>{children}</ContextoBaseDatos.Provider>
}

/** Devuelve la conexión inicializada dentro del árbol de `<ProveedorBaseDatos>`. */
export function useConexionBD(): ConexionBD {
  const db = useContext(ContextoBaseDatos)
  if (!db) {
    throw new Error('useConexionBD debe usarse dentro de <ProveedorBaseDatos>')
  }
  return db
}

const estilos = StyleSheet.create({
  contenedorCarga: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
