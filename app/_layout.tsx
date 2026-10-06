import { useFonts } from 'expo-font'
import { Stack } from 'expo-router'
import { SQLiteProvider } from 'expo-sqlite'
import { useEffect, useState } from 'react'
import { useColorScheme } from 'react-native'
import { TamaguiProvider } from 'tamagui'

import { ErrorBoundary } from '../src/components/ui/ErrorBoundary'
import { inicializarBD, NOMBRE_BD } from '../src/db/client'
import { tamaguiConfig } from '../tamagui.config'

/** Espera máxima de las fuentes antes de renderizar con las del sistema. */
const TIMEOUT_FUENTES_MS = 3000

export default function RootLayout() {
  const colorScheme = useColorScheme()

  const [fontsLoaded, fontError] = useFonts({
    Inter: require('@tamagui/font-inter/otf/Inter-Medium.otf'),
    InterBold: require('@tamagui/font-inter/otf/Inter-Bold.otf'),
  })
  const [timeoutFuentes, setTimeoutFuentes] = useState(false)

  // Las fuentes nunca deben bloquear la app: si fallan o tardan más de
  // TIMEOUT_FUENTES_MS, renderizamos con las fuentes del sistema.
  useEffect(() => {
    if (fontError) {
      console.error(
        '[RootLayout] Error cargando las fuentes; se usarán las del sistema:',
        fontError,
      )
      return
    }
    if (fontsLoaded) {
      return
    }
    const temporizador = setTimeout(() => {
      console.warn(
        `[RootLayout] Las fuentes no cargaron en ${TIMEOUT_FUENTES_MS} ms; se continúa con las del sistema.`,
      )
      setTimeoutFuentes(true)
    }, TIMEOUT_FUENTES_MS)
    return () => clearTimeout(temporizador)
  }, [fontsLoaded, fontError])

  const fuentesResueltas = fontsLoaded || fontError != null || timeoutFuentes
  if (!fuentesResueltas) {
    return null
  }

  return (
    <TamaguiProvider config={tamaguiConfig} defaultTheme={colorScheme ?? 'light'}>
      {/* SQLiteProvider lanza durante el render si `onInit` rechaza; el
          boundary lo convierte en una pantalla de error con reintento. */}
      <ErrorBoundary titulo="No se pudo iniciar la base de datos">
        <SQLiteProvider databaseName={NOMBRE_BD} onInit={inicializarBD}>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          </Stack>
        </SQLiteProvider>
      </ErrorBoundary>
    </TamaguiProvider>
  )
}
