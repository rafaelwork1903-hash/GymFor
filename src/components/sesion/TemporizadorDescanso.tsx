import { Ionicons } from '@expo/vector-icons'
import { Button, Card, Text, useTheme, XStack, YStack } from 'tamagui'

export interface TemporizadorDescansoProps {
  /** Nombre del ejercicio al que corresponde el descanso activo. */
  ejercicioNombre: string
  /** Duración total configurada del descanso actual (en segundos). */
  segundosTotales: number
  /** Segundos restantes redondeados hacia arriba. */
  segundosRestantes: number
  /** Tiempo restante ya formateado como `MM:SS`. */
  textoRestante: string
  /** Indica si la cuenta atrás se encuentra pausada. */
  pausado: boolean
  /** Indica si la cuenta atrás llegó a `00:00`. */
  terminado: boolean
  onPausar: () => void
  onReanudar: () => void
  onAgregarTiempo: (segundos?: number) => void
  onSaltar: () => void
}

/**
 * Barra fija de temporizador de descanso entre series para la pantalla de
 * sesión activa. Muestra el ejercicio, la cuenta atrás en vivo y controles
 * rápidos de Pausar/Reanudar, +15 s y Saltar.
 */
export function TemporizadorDescanso({
  ejercicioNombre,
  segundosTotales,
  segundosRestantes,
  textoRestante,
  pausado,
  terminado,
  onPausar,
  onReanudar,
  onAgregarTiempo,
  onSaltar,
}: TemporizadorDescansoProps) {
  const tema = useTheme()

  const porcentajeRestante =
    segundosTotales > 0
      ? Math.max(0, Math.min(100, Math.round((segundosRestantes / segundosTotales) * 100)))
      : 0

  const etiquetaEstado = terminado
    ? '¡Descanso completado!'
    : pausado
      ? 'Descanso en pausa'
      : 'Descanso en curso'

  return (
    <Card
      size="$4"
      borderWidth={1}
      borderColor={terminado ? '$blue8' : '$borderColor'}
      backgroundColor={terminado ? '$blue2' : '$gray2'}
      padding="$3"
      gap="$2.5"
    >
      <XStack justifyContent="space-between" alignItems="center" gap="$3">
        <YStack flex={1} gap="$0.5">
          <XStack alignItems="center" gap="$1.5">
            <Ionicons
              name={terminado ? 'checkmark-circle' : 'timer-outline'}
              size={15}
              color={terminado ? tema.blue11?.val : tema.gray10?.val}
            />
            <Text
              fontSize="$1"
              fontWeight="600"
              color={terminado ? '$blue11' : '$gray10'}
              numberOfLines={1}
            >
              {etiquetaEstado}
            </Text>
          </XStack>
          <Text fontSize="$3" fontWeight="600" color="$color" numberOfLines={1}>
            {ejercicioNombre}
          </Text>
        </YStack>

        <Text
          fontSize="$7"
          fontWeight="bold"
          color={terminado ? '$blue11' : '$color'}
          accessibilityLabel={`Tiempo restante de descanso: ${textoRestante}`}
        >
          {textoRestante}
        </Text>
      </XStack>

      <XStack height={4} borderRadius="$10" backgroundColor="$gray4" overflow="hidden">
        <YStack
          height={4}
          backgroundColor="$blue9"
          style={{ width: `${porcentajeRestante}%` }}
        />
      </XStack>

      <XStack gap="$2">
        <Button
          size="$2.5"
          flex={1}
          borderWidth={1}
          borderColor="$borderColor"
          backgroundColor="$background"
          color="$color"
          disabled={terminado}
          icon={
            <Ionicons
              name={pausado ? 'play' : 'pause'}
              size={14}
              color={tema.color?.val}
            />
          }
          onPress={pausado ? onReanudar : onPausar}
          accessibilityLabel={pausado ? 'Reanudar descanso' : 'Pausar descanso'}
          aria-label={pausado ? 'Reanudar descanso' : 'Pausar descanso'}
        >
          {pausado ? 'Reanudar' : 'Pausar'}
        </Button>

        <Button
          size="$2.5"
          flex={1}
          borderWidth={1}
          borderColor="$borderColor"
          backgroundColor="$background"
          color="$color"
          onPress={() => onAgregarTiempo(15)}
          accessibilityLabel="Añadir 15 segundos de descanso"
          aria-label="Añadir 15 segundos de descanso"
        >
          +15 s
        </Button>

        <Button
          size="$2.5"
          flex={1}
          borderWidth={1}
          borderColor={terminado ? '$blue8' : '$borderColor'}
          backgroundColor={terminado ? '$gray12' : '$background'}
          color={terminado ? '$gray1' : '$color'}
          icon={
            <Ionicons
              name="play-skip-forward-outline"
              size={14}
              color={terminado ? tema.gray1?.val : tema.color?.val}
            />
          }
          onPress={onSaltar}
          accessibilityLabel="Saltar descanso"
          aria-label="Saltar descanso"
        >
          Saltar
        </Button>
      </XStack>
    </Card>
  )
}
