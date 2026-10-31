/**
 * Pantalla dedicada de catálogo maestro de ejercicios (/ejercicios).
 *
 * Filtros en memoria por grupo muscular y equipamiento, buscador en tiempo real,
 * miniaturas visuales (SVG / fotos / URLs) y modal de técnica detallada.
 */

import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { Pressable } from 'react-native'
import {
  Button,
  Card,
  Input,
  ScrollView,
  Spinner,
  Text,
  useTheme,
  XStack,
  YStack,
} from 'tamagui'

import {
  MiniaturaEjercicio,
  ModalVisualEjercicio,
} from '../src/components/ejercicios/VisualEjercicio'
import type { Ejercicio, Equipamiento, GrupoMuscular } from '../src/domain/types'
import { EQUIPAMIENTOS, GRUPOS_MUSCULARES } from '../src/domain/types'
import { useEjerciciosStore } from '../src/store/ejercicios.store'
import { useMediaStore } from '../src/store/media.store'

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

interface ChipFiltroProps {
  etiqueta: string
  activo: boolean
  onPress: () => void
}

function ChipFiltro({ etiqueta, activo, onPress }: ChipFiltroProps) {
  return (
    <Button
      size="$2"
      borderRadius="$4"
      backgroundColor={activo ? '$blue9' : '$gray3'}
      color={activo ? 'white' : '$color'}
      borderWidth={1}
      borderColor={activo ? '$blue9' : '$borderColor'}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: activo }}
    >
      {etiqueta}
    </Button>
  )
}

export default function PantallaEjercicios() {
  const tema = useTheme()

  const ejercicios = useEjerciciosStore((s) => s.ejercicios)
  const cargandoEjercicios = useEjerciciosStore((s) => s.cargando)
  const errorEjercicios = useEjerciciosStore((s) => s.error)
  const cargarEjercicios = useEjerciciosStore((s) => s.cargarEjercicios)

  const cargandoMedia = useMediaStore((s) => s.cargando)
  const errorMedia = useMediaStore((s) => s.error)
  const cargarMediaEjercicios = useMediaStore((s) => s.cargarMediaEjercicios)

  const [busqueda, setBusqueda] = useState('')
  const [filtroGrupo, setFiltroGrupo] = useState<GrupoMuscular | null>(null)
  const [filtroEquipamiento, setFiltroEquipamiento] = useState<Equipamiento | null>(null)
  const [ejercicioSeleccionado, setEjercicioSeleccionado] = useState<Ejercicio | null>(null)

  useEffect(() => {
    void cargarEjercicios()
    void cargarMediaEjercicios()
  }, [cargarEjercicios, cargarMediaEjercicios])

  const recargarTodo = async () => {
    await Promise.all([cargarEjercicios(), cargarMediaEjercicios()])
  }

  // Filtrado en memoria
  const ejerciciosFiltrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase()
    return ejercicios.filter((ej) => {
      if (filtroGrupo && ej.grupo_muscular_primario !== filtroGrupo) {
        return false
      }
      if (filtroEquipamiento && ej.equipamiento !== filtroEquipamiento) {
        return false
      }
      if (termino && !ej.nombre.toLowerCase().includes(termino)) {
        return false
      }
      return true
    })
  }, [ejercicios, busqueda, filtroGrupo, filtroEquipamiento])

  const limpiarFiltros = () => {
    setBusqueda('')
    setFiltroGrupo(null)
    setFiltroEquipamiento(null)
  }

  const cargando = (cargandoEjercicios || cargandoMedia) && ejercicios.length === 0
  const error = errorEjercicios ?? errorMedia

  return (
    <YStack flex={1} backgroundColor="$background">
      {/* Cabecera propia fuera del ScrollView */}
      <YStack
        paddingTop="$6"
        paddingHorizontal="$4"
        paddingBottom="$3"
        borderBottomWidth={1}
        borderBottomColor="$borderColor"
        backgroundColor="$background"
        gap="$2"
      >
        <XStack alignItems="center" justifyContent="space-between">
          <XStack alignItems="center" gap="$3">
            <Pressable
              onPress={() => {
                if (router.canGoBack()) {
                  router.back()
                } else {
                  router.push('/(tabs)/rutinas')
                }
              }}
              accessibilityRole="button"
              accessibilityLabel="Volver"
              hitSlop={8}
            >
              <Ionicons name="arrow-back" size={24} color={tema.color?.val} />
            </Pressable>
            <YStack>
              <Text fontSize="$6" fontWeight="bold" color="$color">
                Catálogo de Ejercicios
              </Text>
              <Text fontSize="$2" color="$gray10">
                {ejercicios.length > 0
                  ? `${ejerciciosFiltrados.length} de ${ejercicios.length} ejercicios`
                  : 'Explora y aprende técnica'}
              </Text>
            </YStack>
          </XStack>
        </XStack>

        {/* Buscador */}
        <XStack
          alignItems="center"
          backgroundColor="$gray2"
          borderRadius="$3"
          borderWidth={1}
          borderColor="$borderColor"
          paddingHorizontal="$3"
          marginTop="$2"
        >
          <Ionicons name="search" size={18} color={tema.gray10?.val} />
          <Input
            flex={1}
            borderWidth={0}
            backgroundColor="transparent"
            color="$color"
            placeholder="Buscar por nombre de ejercicio…"
            placeholderTextColor={tema.gray10?.val}
            value={busqueda}
            onChangeText={setBusqueda}
            clearButtonMode="while-editing"
          />
          {busqueda.length > 0 && (
            <Pressable
              onPress={() => setBusqueda('')}
              accessibilityLabel="Limpiar búsqueda"
              hitSlop={6}
            >
              <Ionicons name="close-circle" size={18} color={tema.gray10?.val} />
            </Pressable>
          )}
        </XStack>
      </YStack>

      {/* Contenido principal scrolleable */}
      <ScrollView
        flex={1}
        backgroundColor="$background"
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      >
        <YStack gap="$4">
          {/* Filtros por Grupo Muscular */}
          <YStack gap="$2">
            <Text fontSize="$3" fontWeight="600" color="$color">
              Grupo Muscular
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <XStack gap="$2" paddingBottom="$1">
                <ChipFiltro
                  etiqueta="Todos"
                  activo={filtroGrupo === null}
                  onPress={() => setFiltroGrupo(null)}
                />
                {GRUPOS_MUSCULARES.map((grupo) => (
                  <ChipFiltro
                    key={grupo}
                    etiqueta={ETIQUETAS_GRUPO[grupo]}
                    activo={filtroGrupo === grupo}
                    onPress={() => setFiltroGrupo(grupo)}
                  />
                ))}
              </XStack>
            </ScrollView>
          </YStack>

          {/* Filtros por Equipamiento */}
          <YStack gap="$2">
            <Text fontSize="$3" fontWeight="600" color="$color">
              Equipamiento
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <XStack gap="$2" paddingBottom="$1">
                <ChipFiltro
                  etiqueta="Todos"
                  activo={filtroEquipamiento === null}
                  onPress={() => setFiltroEquipamiento(null)}
                />
                {EQUIPAMIENTOS.map((eq) => (
                  <ChipFiltro
                    key={eq}
                    etiqueta={ETIQUETAS_EQUIPAMIENTO[eq]}
                    activo={filtroEquipamiento === eq}
                    onPress={() => setFiltroEquipamiento(eq)}
                  />
                ))}
              </XStack>
            </ScrollView>
          </YStack>

          {/* Banner de error */}
          {error && (
            <Card
              padding="$4"
              backgroundColor="$red2"
              borderColor="$red8"
              borderWidth={1}
              borderRadius="$3"
            >
              <XStack alignItems="center" gap="$3">
                <Ionicons name="alert-circle" size={24} color={tema.red9?.val} />
                <YStack flex={1} gap="$1">
                  <Text fontSize="$3" fontWeight="bold" color="$red11">
                    Error al cargar los ejercicios
                  </Text>
                  <Text fontSize="$2" color="$red10">
                    {error}
                  </Text>
                </YStack>
                <Button size="$2" theme="active" onPress={recargarTodo}>
                  Reintentar
                </Button>
              </XStack>
            </Card>
          )}

          {/* Estado de carga inicial */}
          {cargando ? (
            <YStack padding="$8" alignItems="center" justifyContent="center" gap="$3">
              <Spinner size="large" color="$blue9" />
              <Text fontSize="$3" color="$gray10">
                Cargando catálogo maestro…
              </Text>
            </YStack>
          ) : ejerciciosFiltrados.length === 0 ? (
            /* Estado vacío */
            <Card
              padding="$6"
              alignItems="center"
              justifyContent="center"
              gap="$3"
              borderWidth={1}
              borderColor="$borderColor"
              backgroundColor="$gray2"
            >
              <Ionicons name="search-outline" size={36} color={tema.gray10?.val} />
              <Text fontSize="$4" fontWeight="600" color="$color" textAlign="center">
                No se encontraron ejercicios
              </Text>
              <Text fontSize="$2" color="$gray10" textAlign="center">
                Prueba a ajustar o limpiar los filtros para encontrar lo que buscas.
              </Text>
              <Button size="$3" theme="active" onPress={limpiarFiltros} marginTop="$2">
                Limpiar filtros
              </Button>
            </Card>
          ) : (
            /* Listado de ejercicios */
            <YStack gap="$2.5">
              {ejerciciosFiltrados.map((ejercicio) => (
                <Pressable
                  key={ejercicio.id}
                  onPress={() => setEjercicioSeleccionado(ejercicio)}
                  accessibilityRole="button"
                  accessibilityLabel={`${ejercicio.nombre}, grupo ${ETIQUETAS_GRUPO[ejercicio.grupo_muscular_primario]}, equipamiento ${ETIQUETAS_EQUIPAMIENTO[ejercicio.equipamiento]}. Pulsa para ver técnica y media`}
                >
                  <Card
                    padding="$3"
                    backgroundColor="$gray2"
                    borderWidth={1}
                    borderColor="$borderColor"
                    borderRadius="$3"
                    hoverStyle={{ borderColor: '$blue8' }}
                  >
                    <XStack alignItems="center" gap="$3">
                      {/* Miniatura visual */}
                      <MiniaturaEjercicio
                        ejercicioId={ejercicio.id}
                        nombre={ejercicio.nombre}
                        tamano={58}
                      />

                      {/* Información principal */}
                      <YStack flex={1} gap="$1">
                        <Text fontSize="$4" fontWeight="600" color="$color" numberOfLines={1}>
                          {ejercicio.nombre}
                        </Text>
                        <XStack gap="$2" alignItems="center" flexWrap="wrap">
                          <Text fontSize="$2" color="$blue10" fontWeight="500">
                            {ETIQUETAS_GRUPO[ejercicio.grupo_muscular_primario]}
                          </Text>
                          <Text fontSize="$2" color="$gray9">
                            •
                          </Text>
                          <Text fontSize="$2" color="$gray11">
                            {ETIQUETAS_EQUIPAMIENTO[ejercicio.equipamiento]}
                          </Text>
                          {ejercicio.es_compuesto === 1 && (
                            <>
                              <Text fontSize="$2" color="$gray9">
                                •
                              </Text>
                              <Text fontSize="$2" color="$purple10">
                                Compuesto
                              </Text>
                            </>
                          )}
                        </XStack>
                      </YStack>

                      {/* Icono indicador */}
                      <Ionicons name="chevron-forward" size={18} color={tema.gray9?.val} />
                    </XStack>
                  </Card>
                </Pressable>
              ))}
            </YStack>
          )}
        </YStack>
      </ScrollView>

      {/* Modal de detalle visual al pulsar cualquier ejercicio */}
      <ModalVisualEjercicio
        visible={ejercicioSeleccionado !== null}
        ejercicio={ejercicioSeleccionado}
        onCerrar={() => setEjercicioSeleccionado(null)}
      />
    </YStack>
  )
}
