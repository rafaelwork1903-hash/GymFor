import { useFonts } from 'expo-font'
import { Stack } from 'expo-router'
import { SQLiteProvider } from 'expo-sqlite'
import { useColorScheme } from 'react-native'
import { TamaguiProvider } from 'tamagui'

import { inicializarBD, NOMBRE_BD } from '../src/db/client'
import { tamaguiConfig } from '../tamagui.config'

export default function RootLayout() {
  const colorScheme = useColorScheme()

  const [fontsLoaded] = useFonts({
    Inter: require('@tamagui/font-inter/otf/Inter-Medium.otf'),
    InterBold: require('@tamagui/font-inter/otf/Inter-Bold.otf'),
  })

  if (!fontsLoaded) {
    return null
  }

  return (
    <TamaguiProvider config={tamaguiConfig} defaultTheme={colorScheme ?? 'light'}>
      <SQLiteProvider databaseName={NOMBRE_BD} onInit={inicializarBD}>
        <Stack>
          <Stack.Screen name="index" options={{ title: 'GymFor' }} />
        </Stack>
      </SQLiteProvider>
    </TamaguiProvider>
  )
}
