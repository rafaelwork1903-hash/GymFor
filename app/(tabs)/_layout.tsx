import { Ionicons } from '@expo/vector-icons'
import { Tabs } from 'expo-router'
import type { ComponentProps } from 'react'
import type { ColorValue } from 'react-native'
import { useTheme } from 'tamagui'

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
 * Colores tomados de los tokens del tema activo de Tamagui (claro/oscuro).
 */
export default function TabsLayout() {
  const tema = useTheme()

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
