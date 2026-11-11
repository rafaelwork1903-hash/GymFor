import { NavigationBar, type NavigationBarStyle } from 'expo-navigation-bar'
import { useEffect } from 'react'
import { AppState, type AppStateStatus, Platform } from 'react-native'

export interface OpcionesModoInmersivo {
  /**
   * Si la barra de navegación del sistema debe ocultarse. Por defecto `true`.
   */
  activo?: boolean
  /**
   * Estilo de la barra (`'light'`, `'dark'`, `'auto'`, `'inverted'`).
   * Por defecto `'auto'`.
   */
  estilo?: NavigationBarStyle
}

/**
 * Aplica de forma imperativa la configuración de la barra de navegación de Android.
 * En otras plataformas (iOS, Web) no realiza ninguna operación de forma segura.
 */
export function aplicarModoInmersivoAndroid({
  activo = true,
  estilo = 'auto',
}: OpcionesModoInmersivo = {}): void {
  if (Platform.OS !== 'android') {
    return
  }

  try {
    NavigationBar.setHidden(activo)
    NavigationBar.setStyle(estilo)
  } catch (error) {
    // Si la plataforma no soporta alguna de las llamadas nativas, evitamos romper el render
    console.warn('[ModoInmersivoAndroid] No se pudo actualizar NavigationBar:', error)
  }
}

/**
 * Hook para mantener activa la barra de navegación inmersiva en Android.
 *
 * En Android, cuando la barra se oculta en modo inmersivo (`sticky-immersive`),
 * el usuario puede revelarla deslizando desde el borde inferior de la pantalla sin desplazar
 * el contenido. Al cabo de unos segundos de inactividad, la barra se vuelve a ocultar automáticamente.
 *
 * Además, cuando la app pasa a segundo plano o se bloquea la pantalla y el usuario regresa
 * (`AppState` vuelve a `'active'`), este hook re-aplica `NavigationBar.setHidden(activo)`
 * para garantizar que la interfaz aproveche siempre la pantalla completa.
 */
export function useModoInmersivoAndroid(opciones: OpcionesModoInmersivo = {}): void {
  const activo = opciones.activo ?? true
  const estilo = opciones.estilo ?? 'auto'

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return
    }

    // Aplicar inmediatamente al montar o cambiar props
    aplicarModoInmersivoAndroid({ activo, estilo })

    const subscripcion = AppState.addEventListener('change', (proximoEstado: AppStateStatus) => {
      if (proximoEstado === 'active') {
        aplicarModoInmersivoAndroid({ activo, estilo })
      }
    })

    return () => {
      subscripcion.remove()
    }
  }, [activo, estilo])
}
