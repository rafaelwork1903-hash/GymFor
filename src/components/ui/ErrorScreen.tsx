import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native'

interface ErrorScreenProps {
  /** Título legible del fallo (p. ej. "No se pudo iniciar la base de datos"). */
  titulo: string
  /** Error capturado; se muestra su mensaje como diagnóstico. */
  error: unknown
  /** Si se pasa, muestra un botón "Reintentar" que remonta el árbol afectado. */
  onReintentar?: () => void
}

/**
 * Pantalla de error de último recurso. Usa únicamente componentes de React
 * Native (sin Tamagui, fuentes externas ni iconos) para poder renderizarse
 * incluso cuando lo que ha fallado es el sistema de diseño o las fuentes:
 * su cometido es que la app nunca quede en una pantalla negra sin feedback.
 */
export function ErrorScreen({ titulo, error, onReintentar }: ErrorScreenProps) {
  const oscuro = useColorScheme() === 'dark'
  const mensaje = error instanceof Error ? error.message : String(error)

  return (
    <View style={[estilos.contenedor, { backgroundColor: oscuro ? '#0a0a0a' : '#ffffff' }]}>
      <Text style={estilos.simbolo}>⚠</Text>
      <Text style={[estilos.titulo, { color: oscuro ? '#f5f5f5' : '#111111' }]}>{titulo}</Text>
      <Text style={[estilos.mensaje, { color: oscuro ? '#a3a3a3' : '#525252' }]}>{mensaje}</Text>
      {onReintentar ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Reintentar"
          onPress={onReintentar}
          style={({ pressed }) => [estilos.boton, pressed && estilos.botonPulsado]}
        >
          <Text style={estilos.botonTexto}>Reintentar</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

const estilos = StyleSheet.create({
  contenedor: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  simbolo: {
    fontSize: 40,
  },
  titulo: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  mensaje: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  boton: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#2563eb',
  },
  botonPulsado: {
    opacity: 0.75,
  },
  botonTexto: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
})
