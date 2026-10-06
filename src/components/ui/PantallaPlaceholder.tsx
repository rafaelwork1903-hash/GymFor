import { H2, Paragraph, YStack } from 'tamagui'

interface PantallaPlaceholderProps {
  titulo: string
  descripcion: string
}

/**
 * Pantalla de marcador de posición para las tabs del MVP.
 * El contenido real llega en las tareas feat/screen-*.
 */
export function PantallaPlaceholder({ titulo, descripcion }: PantallaPlaceholderProps) {
  return (
    <YStack
      flex={1}
      padding="$5"
      justifyContent="center"
      alignItems="center"
      gap="$4"
      background="$background"
    >
      <H2 textAlign="center">{titulo}</H2>
      <Paragraph textAlign="center" color="$gray10" fontSize="$4">
        {descripcion}
      </Paragraph>
    </YStack>
  )
}
