import { Ionicons } from '@expo/vector-icons'
import { Redirect, router } from 'expo-router'
import { useEffect, useState } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Spinner, Text, useTheme, XStack, YStack } from 'tamagui'

import { FormularioPerfil } from '../src/components/usuarios/FormularioPerfil'
import {
  esPerfilCompletado,
  NOMBRE_USUARIO_INICIAL,
  useConfiguracionStore,
  type DatosPerfil,
} from '../src/store/configuracion.store'

/**
 * Pantalla de bienvenida y configuración inicial del perfil (onboarding de
 * primer uso). Impide entrar a las pestañas principales hasta que el usuario
 * registra al menos su nombre y queda marcado `onboarding_completado: true`.
 */
export default function OnboardingScreen() {
  const insets = useSafeAreaInsets()
  const tema = useTheme()

  const usuarioActivo = useConfiguracionStore((s) => s.usuarioActivo)
  const cargando = useConfiguracionStore((s) => s.cargando)
  const error = useConfiguracionStore((s) => s.error)
  const actualizarPerfil = useConfiguracionStore((s) => s.actualizarPerfil)
  const crearUsuarioInicial = useConfiguracionStore((s) => s.crearUsuarioInicial)
  const limpiarError = useConfiguracionStore((s) => s.limpiarError)

  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    limpiarError()
  }, [limpiarError])

  if (!enviando && usuarioActivo && esPerfilCompletado(usuarioActivo)) {
    return <Redirect href="/(tabs)" />
  }

  if (!enviando && !usuarioActivo && cargando) {
    return (
      <YStack
        flex={1}
        backgroundColor="$background"
        justifyContent="center"
        alignItems="center"
        gap="$4"
      >
        <Spinner size="large" color="$color" />
        <Text color="$gray10">Preparando tu espacio de entrenamiento…</Text>
      </YStack>
    )
  }

  const guardar = async (datos: DatosPerfil) => {
    setEnviando(true)
    try {
      const guardado = usuarioActivo
        ? await actualizarPerfil(datos)
        : await crearUsuarioInicial({ ...datos, onboarding_completado: true })

      if (guardado) {
        router.replace('/(tabs)')
      }
    } finally {
      setEnviando(false)
    }
  }

  const nombreInicial =
    usuarioActivo && usuarioActivo.nombre !== NOMBRE_USUARIO_INICIAL ? usuarioActivo.nombre : ''

  const encabezado = (
    <YStack
      paddingHorizontal="$4"
      paddingBottom="$2"
      style={{ paddingTop: Math.max(insets.top, 16) }}
      gap="$2"
    >
      <XStack alignItems="center" gap="$2.5">
        <YStack
          width={40}
          height={40}
          borderRadius="$4"
          backgroundColor="$blue2"
          borderWidth={1}
          borderColor="$blue8"
          alignItems="center"
          justifyContent="center"
        >
          <Ionicons name="barbell" size={20} color={tema.blue11?.val} />
        </YStack>
        <YStack flex={1}>
          <Text fontSize="$7" fontWeight="bold" color="$color">
            Bienvenido a GymFor
          </Text>
        </YStack>
      </XStack>
      <Text fontSize="$3" color="$gray10">
        Configura tu perfil para personalizar tus sesiones y métricas de progreso. Podrás editarlo
        cuando quieras desde el Dashboard.
      </Text>
    </YStack>
  )

  return (
    <FormularioPerfil
      key={usuarioActivo?.id ?? 'onboarding-inicial'}
      encabezado={encabezado}
      textoBotonGuardar="Comenzar a entrenar"
      valoresIniciales={{
        nombre: nombreInicial,
        fecha_nacimiento: usuarioActivo?.fecha_nacimiento ?? null,
        sexo: usuarioActivo?.sexo ?? null,
        peso_inicial: usuarioActivo?.peso_inicial ?? null,
        objetivo: usuarioActivo?.objetivo ?? null,
        nivel: usuarioActivo?.nivel ?? null,
      }}
      guardando={cargando || enviando}
      error={error}
      onGuardar={guardar}
    />
  )
}
