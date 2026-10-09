import { Ionicons } from '@expo/vector-icons'
import { useEffect, useState } from 'react'
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable } from 'react-native'
import {
  Button,
  Card,
  Input,
  Label,
  ScrollView,
  Spinner,
  Text,
  TextArea,
  useTheme,
  XStack,
  YStack,
} from 'tamagui'

import type { Rutina } from '../../src/domain/types'
import { useConfiguracionStore } from '../../src/store/configuracion.store'
import { useRutinasStore } from '../../src/store/rutinas.store'

interface TarjetaRutinaProps {
  rutina: Rutina
  /** Deshabilita las acciones mientras hay una operación en curso. */
  ocupado: boolean
  colorIcono: string | undefined
  colorIconoError: string | undefined
  onActivar: (rutina: Rutina) => void
  onEliminar: (rutina: Rutina) => void
}

/** Tarjeta de rutina: resalta la activa y expone activar/eliminar. */
function TarjetaRutina({
  rutina,
  ocupado,
  colorIcono,
  colorIconoError,
  onActivar,
  onEliminar,
}: TarjetaRutinaProps) {
  const activa = rutina.activa === 1

  return (
    <Card
      size="$4"
      padding="$4"
      gap="$3"
      borderWidth={2}
      borderColor={activa ? '$blue8' : '$borderColor'}
      backgroundColor={activa ? '$blue2' : undefined}
    >
      <XStack justifyContent="space-between" alignItems="flex-start" gap="$2">
        <YStack flex={1} gap="$1">
          <Text fontSize="$5" fontWeight="bold" color="$color" numberOfLines={1}>
            {rutina.nombre}
          </Text>
          {rutina.descripcion ? (
            <Text fontSize="$2" color="$gray10" numberOfLines={2}>
              {rutina.descripcion}
            </Text>
          ) : null}
        </YStack>
        {activa ? (
          <XStack
            backgroundColor="$blue9"
            borderRadius="$10"
            paddingHorizontal="$2"
            paddingVertical="$1"
          >
            <Text fontSize="$1" fontWeight="bold" color="#ffffff">
              Activa
            </Text>
          </XStack>
        ) : null}
      </XStack>

      <XStack gap="$2" marginTop="$1">
        {activa ? null : (
          <Button
            size="$3"
            flex={1}
            backgroundColor="$gray12"
            color="$gray1"
            fontWeight="bold"
            pressStyle={{ opacity: 0.85 }}
            disabled={ocupado}
            icon={<Ionicons name="play-circle" size={16} color={colorIcono} />}
            onPress={() => onActivar(rutina)}
          >
            Activar
          </Button>
        )}
        <Button
          size="$3"
          flex={activa ? 1 : undefined}
          backgroundColor="transparent"
          borderWidth={1}
          borderColor="$red8"
          color="$red11"
          disabled={ocupado}
          icon={<Ionicons name="trash-outline" size={16} color={colorIconoError} />}
          onPress={() => onEliminar(rutina)}
        >
          Eliminar
        </Button>
      </XStack>
    </Card>
  )
}

interface ModalCrearRutinaProps {
  visible: boolean
  ocupado: boolean
  error: string | null
  onCerrar: () => void
  /** Devuelve true si la rutina se creó correctamente. */
  onGuardar: (datos: { nombre: string; descripcion: string }) => Promise<boolean>
}

/**
 * Formulario de creación de rutina (nombre + descripción).
 *
 * Se usa `Modal` de React Native con contenido Tamagui en lugar del `Sheet`
 * de Tamagui porque la config actual (`@tamagui/config/v5`) no define
 * animation driver y `Sheet` lo exige en runtime.
 */
function ModalCrearRutina({ visible, ocupado, error, onCerrar, onGuardar }: ModalCrearRutinaProps) {
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const tema = useTheme()

  const cerrar = () => {
    setNombre('')
    setDescripcion('')
    onCerrar()
  }

  const guardar = async () => {
    const creada = await onGuardar({ nombre: nombre.trim(), descripcion: descripcion.trim() })
    if (creada) {
      cerrar()
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={cerrar}
      statusBarTranslucent
    >
      <YStack flex={1} justifyContent="flex-end">
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          onPress={cerrar}
          accessibilityLabel="Cerrar formulario"
        />
        {/* En iOS el teclado cubriría los campos inferiores del modal;
            'padding' lo desplaza. No-op en Android (adjustResize) y web. */}
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <YStack
            backgroundColor="$background"
            borderTopLeftRadius="$6"
            borderTopRightRadius="$6"
            padding="$4"
            paddingBottom="$6"
            gap="$3"
            borderWidth={1}
            borderColor="$borderColor"
          >
            <Text fontSize="$5" fontWeight="bold" color="$color">
              Nueva rutina
            </Text>

            <YStack gap="$1">
              <Label fontSize="$2" color="$gray10">
                Nombre
              </Label>
              <Input
                value={nombre}
                onChangeText={setNombre}
                placeholder="Ej. Push / Pull / Legs"
                placeholderTextColor={tema.placeholderColor?.val}
                borderRadius="$3"
                padding="$2"
              />
            </YStack>

            <YStack gap="$1">
              <Label fontSize="$2" color="$gray10">
                Descripción
              </Label>
              <TextArea
                value={descripcion}
                onChangeText={setDescripcion}
                placeholder="Objetivo, frecuencia, notas…"
                placeholderTextColor={tema.placeholderColor?.val}
                borderRadius="$3"
                padding="$2"
                numberOfLines={3}
              />
            </YStack>

            {error ? (
              <Text fontSize="$2" color="$red11">
                {error}
              </Text>
            ) : null}

            <XStack gap="$2" marginTop="$1">
              <Button size="$4" flex={1} borderWidth={1} borderColor="$borderColor" onPress={cerrar}>
                Cancelar
              </Button>
              <Button
                size="$4"
                flex={1}
                backgroundColor="$gray12"
                color="$gray1"
                fontWeight="bold"
                pressStyle={{ opacity: 0.85 }}
                disabled={ocupado || nombre.trim().length === 0}
                icon={ocupado ? undefined : <Ionicons name="add" size={18} color={tema.gray1?.val} />}
                onPress={() => void guardar()}
              >
                {ocupado ? 'Guardando…' : 'Guardar'}
              </Button>
            </XStack>
          </YStack>
        </KeyboardAvoidingView>
      </YStack>
    </Modal>
  )
}

/**
 * Pantalla de gestión de rutinas: listado, activación (rutina activa para
 * los entrenamientos), borrado y creación mediante formulario modal.
 */
export default function RutinasScreen() {
  const usuario = useConfiguracionStore((s) => s.usuarioActivo)

  const rutinas = useRutinasStore((s) => s.rutinas)
  const cargando = useRutinasStore((s) => s.cargando)
  const error = useRutinasStore((s) => s.error)
  const cargarRutinas = useRutinasStore((s) => s.cargarRutinas)
  const seleccionarRutina = useRutinasStore((s) => s.seleccionarRutina)
  const activarRutinaSeleccionada = useRutinasStore((s) => s.activarRutinaSeleccionada)
  const crearRutinaNueva = useRutinasStore((s) => s.crearRutinaNueva)
  const eliminarRutinaPorId = useRutinasStore((s) => s.eliminarRutinaPorId)

  const tema = useTheme()
  const [modalAbierto, setModalAbierto] = useState(false)

  const usuarioId = usuario?.id ?? null

  // Carga inicial: rutinas del usuario + plantillas del sistema.
  useEffect(() => {
    void cargarRutinas(usuarioId)
  }, [usuarioId, cargarRutinas])

  // `activarRutinaSeleccionada` opera sobre `rutinaSeleccionada`: primero se
  // carga el detalle de la rutina pulsada y después se activa.
  const activar = async (rutina: Rutina) => {
    await seleccionarRutina(rutina.id)
    // Si la selección falló, no se intenta activar: activarRutinaSeleccionada
    // enmascararía el error real con "No hay rutina seleccionada para activar".
    const { rutinaSeleccionada, error: errorSeleccion } = useRutinasStore.getState()
    if (errorSeleccion !== null || rutinaSeleccionada?.id !== rutina.id) {
      return
    }
    await activarRutinaSeleccionada(usuarioId ?? '')
  }

  const confirmarEliminar = (rutina: Rutina) => {
    const mensaje = `¿Eliminar "${rutina.nombre}"? Los días y ejercicios asociados también se eliminan.`
    // react-native-web implementa Alert.alert como stub vacío: en web se usa
    // window.confirm para que el botón también funcione en el preview.
    if (Platform.OS === 'web') {
      if (window.confirm(mensaje)) {
        void eliminarRutinaPorId(rutina.id)
      }
      return
    }
    Alert.alert('Eliminar rutina', mensaje, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => void eliminarRutinaPorId(rutina.id),
      },
    ])
  }

  const guardarRutina = async (datos: { nombre: string; descripcion: string }) => {
    const creada = await crearRutinaNueva({
      usuario_id: usuarioId,
      nombre: datos.nombre,
      descripcion: datos.descripcion,
      dias: [],
    })
    return creada !== undefined
  }

  const recargar = () => {
    void cargarRutinas(usuarioId)
  }

  if (cargando && rutinas.length === 0) {
    return (
      <YStack
        flex={1}
        background="$background"
        justifyContent="center"
        alignItems="center"
        gap="$4"
      >
        <Spinner size="large" color="$color" />
        <Text color="$gray10">Cargando tus rutinas…</Text>
      </YStack>
    )
  }

  return (
    <YStack flex={1} background="$background">
      {/* Zona fija: banner de error y botón de creación fuera del scroll. */}
      <YStack padding="$4" paddingBottom="$2" gap="$3">
        {error ? (
          <Card size="$4" backgroundColor="$red5" borderWidth={1} borderColor="$red8" padding="$3">
            <XStack gap="$2" alignItems="center" justifyContent="space-between">
              <YStack flex={1} gap="$1">
                <Text fontWeight="600" color="$red11">
                  No se pudo completar la operación
                </Text>
                <Text fontSize="$2" color="$red10" numberOfLines={2}>
                  {error}
                </Text>
              </YStack>
              <Button size="$2" borderColor="$red8" onPress={recargar}>
                Reintentar
              </Button>
            </XStack>
          </Card>
        ) : null}

        <Button
          size="$4"
          backgroundColor="$gray12"
          color="$gray1"
          fontWeight="bold"
          pressStyle={{ opacity: 0.85 }}
          icon={<Ionicons name="add" size={18} color={tema.gray1?.val} />}
          onPress={() => setModalAbierto(true)}
        >
          Crear nueva rutina
        </Button>
      </YStack>

      {/* Listado scrolleable: con varias rutinas las tarjetas siempre son
          alcanzables en móvil. */}
      <ScrollView flex={1}>
        {rutinas.length === 0 ? (
          <YStack padding="$4" paddingVertical="$8" gap="$2" alignItems="center">
            <Text fontSize="$4" fontWeight="bold" color="$color" textAlign="center">
              Todavía no hay rutinas
            </Text>
            <Text fontSize="$2" color="$gray10" textAlign="center">
              Crea tu primera rutina o activa una de las plantillas para empezar a entrenar.
            </Text>
          </YStack>
        ) : (
          <YStack padding="$4" paddingTop="$2" paddingBottom="$5" gap="$3">
            {rutinas.map((rutina) => (
              <TarjetaRutina
                key={rutina.id}
                rutina={rutina}
                ocupado={cargando}
                colorIcono={tema.gray1?.val}
                colorIconoError={tema.red11?.val}
                onActivar={activar}
                onEliminar={confirmarEliminar}
              />
            ))}
          </YStack>
        )}
      </ScrollView>

      <ModalCrearRutina
        visible={modalAbierto}
        ocupado={cargando}
        error={error}
        onCerrar={() => setModalAbierto(false)}
        onGuardar={guardarRutina}
      />
    </YStack>
  )
}
