import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useEffect } from 'react'
import { Pressable } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Button, Card, Spinner, Text, useTheme, XStack, YStack } from 'tamagui'

import { FormularioPerfil } from '../src/components/usuarios/FormularioPerfil'
import { useConfiguracionStore, type DatosPerfil } from '../src/store/configuracion.store'

function volverAlDashboard() {
  if (router.canGoBack()) {
    router.back()
  } else {
    router.replace('/(tabs)')
  }
}

/**
 * Pantalla de edición del perfil del usuario activo (`/perfil`).
 * Precarga los valores actuales de `usuarioActivo` y persiste los cambios
 * mediante `actualizarPerfil` antes de regresar a la pantalla anterior.
 */
export default function PerfilScreen() {
  const insets = useSafeAreaInsets()
  const tema = useTheme()

  const usuarioActivo = useConfiguracionStore((s) => s.usuarioActivo)
  const cargando = useConfiguracionStore((s) => s.cargando)
  const error = useConfiguracionStore((s) => s.error)
  const actualizarPerfil = useConfiguracionStore((s) => s.actualizarPerfil)
  const asegurarUsuario = useConfiguracionStore((s) => s.asegurarUsuario)
  const limpiarError = useConfiguracionStore((s) => s.limpiarError)

  useEffect(() => {
    limpiarError()
  }, [limpiarError])

  if (!usuarioActivo && cargando) {
    return (
      <YStack
        flex={1}
        backgroundColor="$background"
        justifyContent="center"
        alignItems="center"
        gap="$4"
      >
        <Spinner size="large" color="$color" />
        <Text color="$gray10">Cargando tu perfil…</Text>
      </YStack>
    )
  }

  if (!usuarioActivo) {
    return (
      <YStack
        flex={1}
        backgroundColor="$background"
        justifyContent="center"
        alignItems="center"
        padding="$4"
        gap="$3"
      >
        <Card size="$4" borderWidth={1} borderColor="$borderColor" padding="$4" gap="$3">
          <Text fontSize="$5" fontWeight="bold" color="$color">
            No se pudo cargar tu perfil
          </Text>
          {error ? (
            <Text fontSize="$2" color="$red11">
              {error}
            </Text>
          ) : null}
          <XStack gap="$2" justifyContent="flex-end">
            <Button
              size="$3"
              borderWidth={1}
              borderColor="$borderColor"
              onPress={volverAlDashboard}
              accessibilityLabel="Volver al Dashboard"
              aria-label="Volver al Dashboard"
            >
              Volver
            </Button>
            <Button
              size="$3"
              backgroundColor="$gray12"
              color="$gray1"
              onPress={() => void asegurarUsuario()}
              accessibilityLabel="Reintentar carga de perfil"
              aria-label="Reintentar carga de perfil"
            >
              Reintentar
            </Button>
          </XStack>
        </Card>
      </YStack>
    )
  }

  const guardar = async (datos: DatosPerfil) => {
    const actualizado = await actualizarPerfil(datos)
    if (actualizado) {
      volverAlDashboard()
    }
  }

  const encabezado = (
    <XStack
      paddingHorizontal="$4"
      paddingBottom="$2"
      style={{ paddingTop: Math.max(insets.top, 16) }}
      alignItems="center"
      gap="$3"
    >
      <Pressable
        onPress={volverAlDashboard}
        accessibilityRole="button"
        accessibilityLabel="Volver"
        aria-label="Volver"
        hitSlop={8}
      >
        <Ionicons name="arrow-back" size={24} color={tema.color?.val} />
      </Pressable>
      <Text fontSize="$6" fontWeight="bold" color="$color">
        Editar perfil
      </Text>
    </XStack>
  )

  return (
    <FormularioPerfil
      key={usuarioActivo.id}
      encabezado={encabezado}
      textoBotonGuardar="Guardar cambios"
      valoresIniciales={{
        nombre: usuarioActivo.nombre,
        fecha_nacimiento: usuarioActivo.fecha_nacimiento,
        sexo: usuarioActivo.sexo,
        peso_inicial: usuarioActivo.peso_inicial,
        objetivo: usuarioActivo.objetivo,
        nivel: usuarioActivo.nivel,
      }}
      guardando={cargando}
      error={error}
      onGuardar={guardar}
    />
  )
}
