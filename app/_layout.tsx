import { NavigationBar } from 'expo-navigation-bar'
import { useFonts } from 'expo-font'
import { SplashScreen, Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
import { Platform, useColorScheme } from 'react-native'
import { TamaguiProvider } from 'tamagui'

import { ErrorBoundary } from '../src/components/ui/ErrorBoundary'
import { ProveedorBaseDatos } from '../src/db/provider'
import { useModoInmersivoAndroid } from '../src/hooks/useModoInmersivoAndroid'
import { useConfiguracionStore } from '../src/store/configuracion.store'
import { tamaguiConfig } from '../tamagui.config'

/**
 * Bootstrap de usuario: `sesiones.usuario_id` es NOT NULL con FK a
 * `usuarios`, así que sin usuario activo no se puede entrenar. La acción
 * es idempotente (reutiliza el primer usuario de la BD o crea el inicial).
 *
 * DEBE montarse DENTRO de `SQLiteProvider`: su efecto abre la BD vía
 * `obtenerBD()` y, si corre en paralelo con el init del provider, el worker
 * WASM de expo-sqlite en web hace race al inicializarse dos veces a la vez
 * (crash "Cannot read properties of undefined (reading 'xFileControl')").
 * Como hijos del provider solo se montan tras `onInit`, aquí la apertura
 * ya está serializada.
 */
function BootstrapUsuario() {
  const usuarioActivo = useConfiguracionStore((s) => s.usuarioActivo)
  const asegurarUsuario = useConfiguracionStore((s) => s.asegurarUsuario)

  useEffect(() => {
    if (!usuarioActivo) {
      void asegurarUsuario()
    }
  }, [usuarioActivo, asegurarUsuario])

  return null
}

export default function RootLayout() {
  const colorScheme = useColorScheme()
  // Tema de la app: preferencia del usuario (persistida) con fallback al
  // esquema del sistema. `TamaguiProvider` lo aplica dinámicamente.
  const temaPreferido = useConfiguracionStore((s) => s.tema)
  const temaResuelto =
    temaPreferido === 'oscuro'
      ? 'dark'
      : temaPreferido === 'claro'
        ? 'light'
        : (colorScheme ?? 'light')

  // Mantiene la barra de navegación del sistema oculta en Android (modo inmersivo)
  // permitiendo que el contenido aproveche toda la pantalla y evitando toques accidentales.
  useModoInmersivoAndroid({
    activo: true,
    estilo: temaResuelto === 'dark' ? 'light' : 'dark',
  })

  const [fontsLoaded, fontError] = useFonts({
    Inter: require('@tamagui/font-inter/otf/Inter-Medium.otf'),
    InterBold: require('@tamagui/font-inter/otf/Inter-Bold.otf'),
  })

  // Desbloqueo y ocultación segura de la pantalla de inicio nativa.
  // Al no bloquear con `return null` ni forzar `preventAutoHideAsync`, la app monta
  // inmediatamente su jerarquía de vistas y tanto Android (CONTENT_APPEARED) como
  // Expo Router y este efecto descartan el splash screen sin riesgo de congelamiento.
  useEffect(() => {
    if (fontError) {
      console.error(
        '[RootLayout] Error cargando fuentes; se continuará con fuentes del sistema:',
        fontError,
      )
    }
    if (Platform.OS !== 'web') {
      SplashScreen.hideAsync().catch(() => {
        // No-op si ya se ocultó
      })
    }
  }, [fontsLoaded, fontError])

  return (
    <TamaguiProvider config={tamaguiConfig} defaultTheme={temaResuelto}>
      <StatusBar style={temaResuelto === 'dark' ? 'light' : 'dark'} />
      {Platform.OS === 'android' ? (
        <NavigationBar
          hidden={true}
          style={temaResuelto === 'dark' ? 'light' : 'dark'}
        />
      ) : null}
      {/* ProveedorBaseDatos lanza durante el render si la inicialización del
          motor activo rechaza; el boundary lo convierte en pantalla de error
          con reintento. */}
      <ErrorBoundary titulo="No se pudo iniciar la base de datos">
        <ProveedorBaseDatos>
          {/* Bootstrap de usuario tras el init de la BD (ver docstring). */}
          <BootstrapUsuario />
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            {/* Onboarding de primer uso: bienvenida y configuración de perfil. */}
            <Stack.Screen
              name="onboarding"
              options={{ headerShown: false, gestureEnabled: false }}
            />
            {/* Edición posterior del perfil del usuario desde el Dashboard. */}
            <Stack.Screen name="perfil" options={{ headerShown: false }} />
            {/* Creación completa de rutinas: pantalla dedicada con cabecera
                propia (días y ejercicios desde el catálogo). */}
            <Stack.Screen name="nueva-rutina" options={{ headerShown: false }} />
            {/* Edición completa de rutinas existentes */}
            <Stack.Screen name="editar-rutina" options={{ headerShown: false }} />
            {/* Catálogo maestro de ejercicios con media y técnica */}
            <Stack.Screen name="ejercicios" options={{ headerShown: false }} />
          </Stack>
        </ProveedorBaseDatos>
      </ErrorBoundary>
    </TamaguiProvider>
  )
}
