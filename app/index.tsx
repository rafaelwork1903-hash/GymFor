import { H1, Paragraph, YStack } from 'tamagui'

export default function IndexScreen() {
  return (
    <YStack flex={1} padding="$5" justifyContent="center" alignItems="center" gap="$4">
      <H1 fontSize="$9">GymFor</H1>
      <Paragraph textAlign="center" color="$color.gray10" fontSize="$5">
        Registro y progreso de entrenamiento de fuerza
      </Paragraph>
    </YStack>
  )
}
