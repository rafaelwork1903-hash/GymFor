/**
 * Componente de visualización y detalle de ejercicio.
 *
 * Muestra la media asociada (ilustración SVG 2D, foto local o URL remota),
 * estados de carga/error, badges de grupo muscular y equipamiento, e instrucciones
 * de técnica.
 *
 * Reutilizable desde el catálogo (/ejercicios), el editor de rutinas y la sesión activa.
 */

import { Ionicons } from '@expo/vector-icons'
import React, { useState } from 'react'
import {
  Image,
  type ImageSourcePropType,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
} from 'react-native'
import type { SvgProps } from 'react-native-svg'
import {
  Button,
  Card,
  Paragraph,
  ScrollView,
  Spinner,
  Text,
  useTheme,
  XStack,
  YStack,
} from 'tamagui'

import type { MediaEjercicio } from '../../domain/media'
import { mediaPlaceholder } from '../../domain/media'
import type { Ejercicio, Equipamiento, GrupoMuscular } from '../../domain/types'
import { useMediaStore } from '../../store/media.store'

const ETIQUETAS_GRUPO: Record<GrupoMuscular, string> = {
  pecho: 'Pecho',
  espalda: 'Espalda',
  hombros: 'Hombros',
  biceps: 'Bíceps',
  triceps: 'Tríceps',
  cuadriceps: 'Cuádriceps',
  isquios: 'Isquios',
  gluteos: 'Glúteos',
  gemelos: 'Gemelos',
  core: 'Core',
  cuerpo_completo: 'Cuerpo completo',
  movilidad: 'Movilidad',
}

const ETIQUETAS_EQUIPAMIENTO: Record<Equipamiento, string> = {
  barra: 'Barra',
  mancuernas: 'Mancuernas',
  maquina: 'Máquina',
  peso_corporal: 'Peso corporal',
}

export interface MiniaturaEjercicioProps {
  ejercicioId: string
  nombre: string
  tamano?: number
  /** URI local o URL remota personalizada (prioridad sobre la media del catálogo). */
  imagenUrl?: string | null
}

/**
 * Miniatura compacta para listados de ejercicios.
 * Si recibe `imagenUrl`, muestra la imagen personalizada del usuario con fallback a placeholder.
 */
export function MiniaturaEjercicio({
  ejercicioId,
  nombre,
  tamano = 52,
  imagenUrl,
}: MiniaturaEjercicioProps) {
  const obtenerMedia = useMediaStore((s) => s.obtenerMedia)
  const uriPersonalizada = imagenUrl?.trim() ? imagenUrl.trim() : null
  const media = obtenerMedia(ejercicioId, nombre)
  const [uriFallida, setUriFallida] = useState<string | null>(null)

  const etiquetaAccesible = uriPersonalizada
    ? `Imagen personalizada de ${nombre}`
    : media.accessibilityLabel

  return (
    <YStack
      width={tamano}
      height={tamano}
      borderRadius="$3"
      overflow="hidden"
      backgroundColor="$gray3"
      borderWidth={1}
      borderColor="$borderColor"
      alignItems="center"
      justifyContent="center"
      role="img"
      aria-label={etiquetaAccesible}
    >
      {uriPersonalizada ? (
        uriFallida === uriPersonalizada ? (
          (() => {
            const Placeholder = mediaPlaceholder(nombre).recurso as React.FC<SvgProps>
            return <Placeholder width={tamano * 0.8} height={tamano * 0.8} />
          })()
        ) : (
          <Image
            source={{ uri: uriPersonalizada }}
            style={{ width: tamano, height: tamano }}
            resizeMode="cover"
            onError={() => setUriFallida(uriPersonalizada)}
            accessibilityLabel={etiquetaAccesible}
          />
        )
      ) : media.tipo === 'svg' && media.recurso ? (
        (() => {
          const SvgComp = media.recurso as React.FC<SvgProps>
          return <SvgComp width={tamano} height={tamano} />
        })()
      ) : media.tipo === 'foto' && media.recurso ? (
        <Image
          source={media.recurso as ImageSourcePropType}
          style={{ width: tamano, height: tamano }}
          resizeMode="cover"
          accessibilityLabel={media.accessibilityLabel}
        />
      ) : media.tipo === 'url' && media.uri && uriFallida !== media.uri ? (
        <Image
          source={{ uri: media.uri }}
          style={{ width: tamano, height: tamano }}
          resizeMode="cover"
          onError={() => setUriFallida(media.uri ?? '')}
          accessibilityLabel={media.accessibilityLabel}
        />
      ) : (
        (() => {
          const Placeholder = mediaPlaceholder(nombre).recurso as React.FC<SvgProps>
          return <Placeholder width={tamano * 0.8} height={tamano * 0.8} />
        })()
      )}
    </YStack>
  )
}

export interface VisualEjercicioProps {
  ejercicio: Ejercicio
  media?: MediaEjercicio
  /** URI personalizada (local o remota) asociada al ejercicio en la rutina. */
  imagenUrl?: string | null
  altoMedia?: number
}

/**
 * Vista completa de detalle visual de un ejercicio.
 */
export function VisualEjercicio({
  ejercicio,
  media: mediaProp,
  imagenUrl,
  altoMedia = 200,
}: VisualEjercicioProps) {
  const tema = useTheme()
  const obtenerMedia = useMediaStore((s) => s.obtenerMedia)
  const uriPersonalizada = imagenUrl?.trim() ? imagenUrl.trim() : null
  const media: MediaEjercicio =
    mediaProp ??
    (uriPersonalizada
      ? {
          id: `personalizada:${ejercicio.id}`,
          ejercicioId: ejercicio.id,
          tipo: 'url',
          uri: uriPersonalizada,
          alt: `Imagen personalizada de ${ejercicio.nombre}`,
          accessibilityLabel: `Imagen personalizada de ${ejercicio.nombre}`,
        }
      : obtenerMedia(ejercicio.id, ejercicio.nombre))

  const [uriCargando, setUriCargando] = useState<string | null>(null)
  const [uriError, setUriError] = useState<string | null>(null)
  const cargandoRemoto = Boolean(media.uri && uriCargando === media.uri)
  const errorRemoto = Boolean(media.uri && uriError === media.uri)

  const esCompuesto = ejercicio.es_compuesto === 1
  const tieneInstrucciones = Boolean(ejercicio.instrucciones?.trim())

  return (
    <YStack gap="$4" width="100%">
      {/* Contenedor de la media */}
      <Card
        borderRadius="$4"
        overflow="hidden"
        borderWidth={1}
        borderColor="$borderColor"
        backgroundColor="$gray2"
        position="relative"
        minHeight={altoMedia}
        alignItems="center"
        justifyContent="center"
      >
        {cargandoRemoto && (
          <YStack
            position="absolute"
            top={0}
            left={0}
            right={0}
            bottom={0}
            alignItems="center"
            justifyContent="center"
            backgroundColor="$gray3"
            zIndex={2}
          >
            <Spinner size="large" color="$blue9" />
            <Text fontSize="$2" color="$gray10" marginTop="$2">
              Cargando imagen…
            </Text>
          </YStack>
        )}

        {errorRemoto ? (
          <YStack alignItems="center" justifyContent="center" padding="$4" gap="$2">
            {(() => {
              const Placeholder = mediaPlaceholder(ejercicio.nombre).recurso as React.FC<SvgProps>
              return <Placeholder width={altoMedia * 0.7} height={altoMedia * 0.7} />
            })()}
            <Text fontSize="$2" color="$gray10" textAlign="center">
              No se pudo cargar la imagen.
            </Text>
          </YStack>
        ) : media.tipo === 'svg' && media.recurso ? (
          (() => {
            const SvgComp = media.recurso as React.FC<SvgProps>
            return (
              <YStack
                width="100%"
                height={altoMedia}
                alignItems="center"
                justifyContent="center"
                role="img"
                aria-label={media.accessibilityLabel}
              >
                <SvgComp width="100%" height={altoMedia} />
              </YStack>
            )
          })()
        ) : media.tipo === 'foto' && media.recurso ? (
          <Image
            source={media.recurso as ImageSourcePropType}
            style={{ width: '100%', height: altoMedia }}
            resizeMode="contain"
            accessibilityLabel={media.accessibilityLabel}
          />
        ) : media.tipo === 'url' && media.uri ? (
          <Image
            source={{ uri: media.uri }}
            style={{ width: '100%', height: altoMedia }}
            resizeMode="cover"
            onLoadStart={() => setUriCargando(media.uri ?? null)}
            onLoadEnd={() => setUriCargando(null)}
            onError={() => {
              setUriCargando(null)
              setUriError(media.uri ?? null)
            }}
            accessibilityLabel={media.accessibilityLabel}
          />
        ) : (
          (() => {
            const Placeholder = mediaPlaceholder(ejercicio.nombre).recurso as React.FC<SvgProps>
            return (
              <YStack
                width="100%"
                height={altoMedia}
                alignItems="center"
                justifyContent="center"
                role="img"
                aria-label={media.accessibilityLabel}
              >
                <Placeholder width={altoMedia * 0.7} height={altoMedia * 0.7} />
              </YStack>
            )
          })()
        )}
      </Card>

      {/* Nombre y tipo */}
      <YStack gap="$2">
        <Text fontSize="$6" fontWeight="bold" color="$color">
          {ejercicio.nombre}
        </Text>

        <XStack gap="$2" flexWrap="wrap" alignItems="center">
          {/* Grupo muscular primario */}
          <XStack
            backgroundColor="$blue3"
            paddingHorizontal="$2.5"
            paddingVertical="$1"
            borderRadius="$2"
            alignItems="center"
            gap="$1"
          >
            <Ionicons name="barbell-outline" size={14} color={tema.blue9?.val} />
            <Text fontSize="$2" fontWeight="600" color="$blue11">
              {ETIQUETAS_GRUPO[ejercicio.grupo_muscular_primario]}
            </Text>
          </XStack>

          {/* Equipamiento */}
          <XStack
            backgroundColor="$gray3"
            paddingHorizontal="$2.5"
            paddingVertical="$1"
            borderRadius="$2"
            alignItems="center"
            gap="$1"
          >
            <Ionicons name="fitness-outline" size={14} color={tema.gray11?.val} />
            <Text fontSize="$2" fontWeight="500" color="$gray11">
              {ETIQUETAS_EQUIPAMIENTO[ejercicio.equipamiento]}
            </Text>
          </XStack>

          {/* Compuesto / Aislamiento */}
          <XStack
            backgroundColor={esCompuesto ? '$purple3' : '$gray3'}
            paddingHorizontal="$2.5"
            paddingVertical="$1"
            borderRadius="$2"
            alignItems="center"
          >
            <Text
              fontSize="$2"
              fontWeight="500"
              color={esCompuesto ? '$purple11' : '$gray11'}
            >
              {esCompuesto ? 'Compuesto' : 'Aislamiento'}
            </Text>
          </XStack>
        </XStack>

        {/* Grupos secundarios si existen */}
        {ejercicio.grupos_musculares_secundarios.length > 0 && (
          <XStack gap="$1.5" alignItems="center" flexWrap="wrap" marginTop="$1">
            <Text fontSize="$2" color="$gray10">
              Secundarios:
            </Text>
            {ejercicio.grupos_musculares_secundarios.map((g) => (
              <Text key={g} fontSize="$2" color="$gray11">
                {ETIQUETAS_GRUPO[g]}
              </Text>
            ))}
          </XStack>
        )}
      </YStack>

      {/* Instrucciones de técnica */}
      <YStack
        backgroundColor="$gray2"
        padding="$3"
        borderRadius="$3"
        borderWidth={1}
        borderColor="$borderColor"
        gap="$2"
      >
        <XStack alignItems="center" gap="$2">
          <Ionicons name="information-circle-outline" size={18} color={tema.blue9?.val} />
          <Text fontSize="$3" fontWeight="600" color="$color">
            Instrucciones y técnica
          </Text>
        </XStack>

        {tieneInstrucciones ? (
          <Paragraph fontSize="$3" color="$gray11" lineHeight={20}>
            {ejercicio.instrucciones}
          </Paragraph>
        ) : (
          <Paragraph fontSize="$2" color="$gray10" fontStyle="italic">
            Ejecuta el ejercicio con rango de movimiento completo, controlando la fase
            excéntrica y manteniendo la estabilidad del core.
          </Paragraph>
        )}
      </YStack>
    </YStack>
  )
}

export interface ModalVisualEjercicioProps {
  visible: boolean
  ejercicio: Ejercicio | null
  /** URI personalizada asociada al ejercicio en la rutina (opcional). */
  imagenUrl?: string | null
  onCerrar: () => void
}

/**
 * Modal accesible de React Native para mostrar el detalle visual sin depender de Sheet de Tamagui.
 */
export function ModalVisualEjercicio({
  visible,
  ejercicio,
  imagenUrl,
  onCerrar,
}: ModalVisualEjercicioProps) {
  const tema = useTheme()

  if (!ejercicio) {
    return null
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onCerrar}
      statusBarTranslucent
    >
      <YStack
        flex={1}
        backgroundColor="rgba(0, 0, 0, 0.6)"
        justifyContent="flex-end"
      >
        <Pressable
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          onPress={onCerrar}
          accessibilityLabel="Cerrar modal de ejercicio"
          aria-label="Cerrar modal de ejercicio"
        />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <YStack
            backgroundColor="$background"
            borderTopLeftRadius="$5"
            borderTopRightRadius="$5"
            borderWidth={1}
            borderColor="$borderColor"
            padding="$4"
            gap="$4"
            maxHeight="88%"
          >
            {/* Cabecera del modal */}
            <XStack justifyContent="space-between" alignItems="center">
              <Text fontSize="$5" fontWeight="bold" color="$color">
                Detalle del Ejercicio
              </Text>
              <Pressable
                onPress={onCerrar}
                accessibilityRole="button"
                accessibilityLabel="Cerrar"
                aria-label="Cerrar"
                hitSlop={8}
              >
                <Ionicons name="close" size={24} color={tema.color?.val} />
              </Pressable>
            </XStack>

            <ScrollView showsVerticalScrollIndicator={false}>
              <VisualEjercicio ejercicio={ejercicio} imagenUrl={imagenUrl} />
            </ScrollView>

            <Button
              theme="active"
              backgroundColor="$blue9"
              color="white"
              onPress={onCerrar}
              marginTop="$2"
            >
              Cerrar
            </Button>
          </YStack>
        </KeyboardAvoidingView>
      </YStack>
    </Modal>
  )
}
