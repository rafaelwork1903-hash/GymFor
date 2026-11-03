import { Ionicons } from '@expo/vector-icons'
import { Redirect, Tabs } from 'expo-router'
import type { ComponentProps } from 'react'
import type { ColorValue } from 'react-native'
import { Button, Card, Spinner, Text, useTheme, YStack } from 'tamagui'

import { esPerfilCompletado, useConfiguracionStore } from '../../src/store/configuracion.store'

type NombreIcono = ComponentProps<typeof Ionicons>['name']

interface IconoTabProps {
  color: ColorValue
  size: number
  focused: boolean
}

function crearIcono(activo: NombreIcono, inactivo: NombreIcono) {
  return function IconoTab({ color, size, focused }: IconoTabProps) {
    return <Ionicons name={focused ? activo : inactivo} size={size} color={String(color)} />
  }
}

/**
 * Navegación principal de GymFor: 5 tabs.
 *
 * Actúa también como puerta de primer uso: si el usuario activo aún no ha
 * completado su perfil (`!esPerfilCompletado(usuarioActivo)`), redirige de
 * forma declarativa a `/onboarding` sin permitir acceder a las pestañas.
 * Colores tomados de los tokens del tema activo de Tamagui (claro/oscuro).
 */
export default function TabsLayout() {
  const tema = useTheme()
  const usuarioActivo = useConfiguracionStore((s) => s.usuarioActivo)
  const cargandoUsuario = useConfiguracionStore((s) => s.cargando)
  const errorUsuario = useConfiguracionStore((s) => s.error)
  const asegurarUsuario = useConfiguracionStore((s) => s.asegurarUsuario)

  if (!usuarioActivo) {
    if (errorUsuario && !cargandoUsuario) {
      return (
        <YStack
          flex={1}
          backgroundColor="$background"
          justifyContent="center"
          alignItems="center"
          padding="$4"
        >
          <Card size="$4" borderWidth={1} borderColor="$red8" backgroundColor="$red5" padding="$4" gap="$3">
            <Text fontWeight="bold" color="$red11" fontSize="$4">
              No se pudo preparar tu perfil
            </Text>
            <Text fontSize="$2" color="$red10">
              {errorUsuario}
            </Text>
            <Button
              size="$3"
              borderColor="$red8"
              onPress={() => void asegurarUsuario()}
              accessibilityLabel="Reintentar preparación de perfil"
              aria-label="Reintentar preparación de perfil"
            >
              Reintentar
            </Button>
          </Card>
        </YStack>
      )
    }

    return (
      <YStack
        flex={1}
        backgroundColor="$background"
        justifyContent="center"
        alignItems="center"
        gap="$4"
      >
        <Spinner size="large" color="$color" />
        <Text color="$gray10">Preparando tu perfil…</Text>
      </YStack>
    )
  }

  if (!esPerfilCompletado(usuarioActivo)) {
    return <Redirect href="/onboarding" />
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: tema.color?.val,
        tabBarInactiveTintColor: tema.gray10?.val,
        tabBarStyle: {
          backgroundColor: tema.background?.val,
          borderTopColor: tema.borderColor?.val,
        },
        headerStyle: { backgroundColor: tema.background?.val },
        headerTitleStyle: { color: tema.color?.val },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: crearIcono('home', 'home-outline'),
        }}
      />
      <Tabs.Screen
        name="rutinas"
        options={{
          title: 'Rutinas',
          tabBarIcon: crearIcono('barbell', 'barbell-outline'),
        }}
      />
      <Tabs.Screen
        name="sesion"
        options={{
          title: 'Sesión',
          tabBarIcon: crearIcono('play-circle', 'play-circle-outline'),
        }}
      />
      <Tabs.Screen
        name="historial"
        options={{
          title: 'Historial',
          tabBarIcon: crearIcono('time', 'time-outline'),
        }}
      />
      <Tabs.Screen
        name="progreso"
        options={{
          title: 'Progreso',
          tabBarIcon: crearIcono('trending-up', 'trending-up-outline'),
        }}
      />
    </Tabs>
  )
}
