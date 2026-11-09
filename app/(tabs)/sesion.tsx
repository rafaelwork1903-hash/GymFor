import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
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

import { calcularVolumenTotal } from '../../src/domain/metrics'
import type { Ejercicio, EjercicioEnRutinaDetalle, SerieReal } from '../../src/domain/types'
import {
  MiniaturaEjercicio,
  ModalVisualEjercicio,
} from '../../src/components/ejercicios/VisualEjercicio'
import { TemporizadorDescanso } from '../../src/components/sesion/TemporizadorDescanso'
import {
  useCronometroSesion,
  useTemporizadorDescanso,
} from '../../src/hooks/useTemporizadorDescanso'
import { useConfiguracionStore } from '../../src/store/configuracion.store'
import { useEjerciciosStore } from '../../src/store/ejercicios.store'
import { useRutinasStore } from '../../src/store/rutinas.store'
import { useSesionStore, type CambiosSerie } from '../../src/store/sesion.store'
import { calcularDuracionMinutos } from '../../src/utils/tiempo'

/** Descanso manual por defecto cuando el ejercicio no define `descanso_segundos`. */
const DESCANSO_POR_DEFECTO_SEGUNDOS = 60

/** Registro en curso tal como lo expone `sesionActual` (subconjunto estructural). */
interface RegistroSesion {
  registro_id: string
  ejercicio_id: string
  ejercicio_nombre: string
  imagen_url?: string | null
  series: SerieReal[]
}

/**
 * Convierte texto a número (acepta coma decimal); `null` si está vacío o no
 * es un número válido. Los inputs usan `keyboardType="numeric"`, pero el
 * usuario puede pegar texto o usar el teclado físico en web.
 */
function aNumero(texto: string): number | null {
  const limpio = texto.trim().replace(',', '.')
  if (!/^\d+(\.\d+)?$/.test(limpio)) {
    return null
  }
  return Number(limpio)
}

/** Valida un RPE opcional: vacío = null; si viene, entero 1-10. */
function aRPE(texto: string): number | null | 'invalido' {
  const limpio = texto.trim()
  if (limpio === '') {
    return null
  }
  const numero = aNumero(limpio)
  if (numero === null || !Number.isInteger(numero) || numero < 1 || numero > 10) {
    return 'invalido'
  }
  return numero
}

/** 'YYYY-MM-DD' -> 'dd/mm/yyyy' (determinista, sin depender de Intl). */
function formatearFecha(iso: string): string {
  const [anio, mes, dia] = iso.split('-')
  if (!anio || !mes || !dia) return iso
  return `${dia}/${mes}/${anio}`
}

/** Separador de miles estilo es-ES (puntos). */
function formatearCantidad(valor: number): string {
  return Math.round(valor)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

interface TarjetaEjercicioProps {
  registro: RegistroSesion
  /** Objetivo del ejercicio en el día de la sesión (si está disponible). */
  objetivo?: EjercicioEnRutinaDetalle
  /** Deshabilita los controles mientras hay una operación en curso. */
  ocupado: boolean
  /** ID de la serie que se está editando o eliminando en este instante. */
  serieOcupadaId: string | null
  onAgregar: (
    registroId: string,
    serie: {
      numero_serie: number
      peso_levantado: number
      reps_realizadas: number
      rpe_serie: number | null
      rir: null
      completada: 1
      notas: null
    },
  ) => void | Promise<void>
  onEditarSerie: (registroId: string, ejercicioNombre: string, serie: SerieReal) => void
  onEliminarSerie: (registroId: string, serie: SerieReal) => void
  onDescansar?: (ejercicioNombre: string, segundos: number) => void
  onVerDetalle?: () => void
}

/** Ejercicio de la sesión: series registradas + input rápido de nueva serie. */
function TarjetaEjercicio({
  registro,
  objetivo,
  ocupado,
  serieOcupadaId,
  onAgregar,
  onEditarSerie,
  onEliminarSerie,
  onDescansar,
  onVerDetalle,
}: TarjetaEjercicioProps) {
  const [peso, setPeso] = useState('')
  const [reps, setReps] = useState('')
  const [rpe, setRpe] = useState('')
  const [aviso, setAviso] = useState<string | null>(null)
  const tema = useTheme()

  const segundosDescansoManual =
    objetivo?.descanso_segundos != null && objetivo.descanso_segundos > 0
      ? objetivo.descanso_segundos
      : DESCANSO_POR_DEFECTO_SEGUNDOS

  const partesObjetivo: string[] = []
  if (objetivo) {
    partesObjetivo.push(`${objetivo.series_objetivo} series`)
    partesObjetivo.push(`${objetivo.reps_objetivo_min}-${objetivo.reps_objetivo_max} reps`)
    if (objetivo.peso_objetivo != null) {
      partesObjetivo.push(`${objetivo.peso_objetivo} kg`)
    }
    if (objetivo.descanso_segundos != null) {
      partesObjetivo.push(`${objetivo.descanso_segundos} s descanso`)
    }
  }

  const agregar = () => {
    const pesoNum = aNumero(peso)
    const repsNum = aNumero(reps)
    if (pesoNum === null || pesoNum < 0) {
      setAviso('Ingresa un peso válido en kg (ej. 62,5).')
      return
    }
    if (repsNum === null || repsNum < 0 || !Number.isInteger(repsNum)) {
      setAviso('Ingresa las repeticiones (número entero).')
      return
    }
    const rpeNum = aRPE(rpe)
    if (rpeNum === 'invalido') {
      setAviso('El RPE debe estar entre 1 y 10, o vacío.')
      return
    }
    setAviso(null)
    void onAgregar(registro.registro_id, {
      numero_serie: registro.series.length + 1,
      peso_levantado: pesoNum,
      reps_realizadas: repsNum,
      rpe_serie: rpeNum,
      rir: null,
      completada: 1,
      notas: null,
    })
  }

  return (
    <Card size="$4" borderWidth={1} borderColor="$borderColor" padding="$4" gap="$3">
      <XStack justifyContent="space-between" alignItems="center" gap="$2">
        <XStack flex={1} alignItems="center" gap="$2.5">
          <MiniaturaEjercicio
            ejercicioId={registro.ejercicio_id}
            nombre={registro.ejercicio_nombre}
            imagenUrl={objetivo?.imagen_url ?? registro.imagen_url}
            tamano={44}
          />
          <YStack flex={1} gap="$1">
            <Text fontSize="$4" fontWeight="bold" color="$color" numberOfLines={1}>
              {registro.ejercicio_nombre}
            </Text>
            {partesObjetivo.length > 0 ? (
              <Text fontSize="$2" color="$gray10" numberOfLines={1}>
                Objetivo: {partesObjetivo.join(' · ')}
              </Text>
            ) : null}
          </YStack>
        </XStack>
        <XStack alignItems="center" gap="$2.5">
          {onDescansar ? (
            <Pressable
              onPress={() => onDescansar(registro.ejercicio_nombre, segundosDescansoManual)}
              accessibilityRole="button"
              accessibilityLabel={`Iniciar descanso de ${segundosDescansoManual} segundos para ${registro.ejercicio_nombre}`}
              aria-label={`Iniciar descanso de ${segundosDescansoManual} segundos para ${registro.ejercicio_nombre}`}
              hitSlop={8}
            >
              <Ionicons name="timer-outline" size={22} color={tema.blue9?.val} />
            </Pressable>
          ) : null}
          {onVerDetalle && (
            <Pressable
              onPress={onVerDetalle}
              accessibilityRole="button"
              accessibilityLabel={`Ver técnica y demostración de ${registro.ejercicio_nombre}`}
              hitSlop={8}
            >
              <Ionicons name="eye-outline" size={22} color={tema.blue9?.val} />
            </Pressable>
          )}
        </XStack>
      </XStack>

      {registro.series.length > 0 ? (
        <YStack backgroundColor="$gray3" borderRadius="$3" padding="$2" gap="$1.5">
          {registro.series.map((serie) => {
            const persistiendoFila = serieOcupadaId === serie.id
            return (
              <XStack
                key={serie.id}
                justifyContent="space-between"
                alignItems="center"
                gap="$2"
                paddingVertical="$1"
                opacity={persistiendoFila ? 0.55 : 1}
              >
                <YStack flex={1} gap="$0.5">
                  <XStack alignItems="center" gap="$2">
                    <Text fontSize="$2" fontWeight="600" color="$gray11">
                      S{serie.numero_serie}
                    </Text>
                    <Text fontSize="$2" color="$gray11" flex={1}>
                      {serie.peso_levantado} kg × {serie.reps_realizadas}
                      {serie.rpe_serie != null ? ` · RPE ${serie.rpe_serie}` : ''}
                    </Text>
                  </XStack>
                  {serie.notas ? (
                    <Text fontSize="$1" color="$gray10" numberOfLines={2}>
                      {serie.notas}
                    </Text>
                  ) : null}
                </YStack>

                <XStack alignItems="center" gap="$2.5">
                  {persistiendoFila ? <Spinner size="small" color="$color" /> : null}
                  <Pressable
                    disabled={ocupado}
                    onPress={() =>
                      onEditarSerie(registro.registro_id, registro.ejercicio_nombre, serie)
                    }
                    accessibilityRole="button"
                    accessibilityLabel={`Editar serie S${serie.numero_serie} de ${registro.ejercicio_nombre}`}
                    hitSlop={8}
                    style={{ opacity: ocupado ? 0.45 : 1 }}
                  >
                    <Ionicons name="pencil-outline" size={18} color={tema.gray11?.val} />
                  </Pressable>
                  <Pressable
                    disabled={ocupado}
                    onPress={() => onEliminarSerie(registro.registro_id, serie)}
                    accessibilityRole="button"
                    accessibilityLabel={`Eliminar serie S${serie.numero_serie} de ${registro.ejercicio_nombre}`}
                    hitSlop={8}
                    style={{ opacity: ocupado ? 0.45 : 1 }}
                  >
                    <Ionicons name="trash-outline" size={18} color={tema.red11?.val} />
                  </Pressable>
                </XStack>
              </XStack>
            )
          })}
        </YStack>
      ) : (
        <Text fontSize="$2" color="$gray9">
          Sin series todavía.
        </Text>
      )}

      <XStack gap="$2" alignItems="center">
        <Input
          flex={1.2}
          keyboardType="numeric"
          value={peso}
          onChangeText={(texto) => {
            setPeso(texto)
            setAviso(null)
          }}
          placeholder="Peso (kg)"
          placeholderTextColor={tema.placeholderColor?.val}
          borderRadius="$3"
          padding="$2"
        />
        <Input
          flex={1}
          keyboardType="numeric"
          value={reps}
          onChangeText={(texto) => {
            setReps(texto)
            setAviso(null)
          }}
          placeholder="Reps"
          placeholderTextColor={tema.placeholderColor?.val}
          borderRadius="$3"
          padding="$2"
        />
        <Input
          flex={0.8}
          keyboardType="numeric"
          value={rpe}
          onChangeText={(texto) => {
            setRpe(texto)
            setAviso(null)
          }}
          placeholder="RPE"
          placeholderTextColor={tema.placeholderColor?.val}
          borderRadius="$3"
          padding="$2"
        />
        <Button
          size="$3"
          circular
          backgroundColor="$gray12"
          color="$gray1"
          disabled={ocupado}
          icon={<Ionicons name="add" size={20} color={tema.gray1?.val} />}
          onPress={agregar}
          aria-label="Añadir serie"
        />
      </XStack>

      {aviso ? (
        <Text fontSize="$1" color="$red11">
          {aviso}
        </Text>
      ) : null}
    </Card>
  )
}

interface SerieEnEdicion {
  registroId: string
  ejercicioNombre: string
  serie: SerieReal
}

interface FormularioEditarSerieProps {
  objetivo: SerieEnEdicion
  ocupado: boolean
  error: string | null
  onCerrar: () => void
  onGuardar: (registroId: string, serieId: string, cambios: CambiosSerie) => Promise<boolean>
}

/** Contenido del modal de edición de serie; se monta por `serie.id` sin efectos. */
function FormularioEditarSerie({
  objetivo,
  ocupado,
  error,
  onCerrar,
  onGuardar,
}: FormularioEditarSerieProps) {
  const { serie, registroId, ejercicioNombre } = objetivo
  const [peso, setPeso] = useState(String(serie.peso_levantado))
  const [reps, setReps] = useState(String(serie.reps_realizadas))
  const [rpe, setRpe] = useState(serie.rpe_serie != null ? String(serie.rpe_serie) : '')
  const [notas, setNotas] = useState(serie.notas ?? '')
  const [aviso, setAviso] = useState<string | null>(null)
  const tema = useTheme()

  const guardar = async () => {
    const pesoNum = aNumero(peso)
    const repsNum = aNumero(reps)
    if (pesoNum === null || pesoNum < 0) {
      setAviso('Ingresa un peso válido en kg (ej. 62,5).')
      return
    }
    if (repsNum === null || repsNum < 0 || !Number.isInteger(repsNum)) {
      setAviso('Ingresa las repeticiones (número entero).')
      return
    }
    const rpeNum = aRPE(rpe)
    if (rpeNum === 'invalido') {
      setAviso('El RPE debe estar entre 1 y 10, o vacío.')
      return
    }
    setAviso(null)
    await onGuardar(registroId, serie.id, {
      peso_levantado: pesoNum,
      reps_realizadas: repsNum,
      rpe_serie: rpeNum,
      notas: notas.trim() === '' ? null : notas.trim(),
    })
  }

  return (
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
      <YStack gap="$0.5">
        <Text fontSize="$5" fontWeight="bold" color="$color">
          Editar serie S{serie.numero_serie}
        </Text>
        <Text fontSize="$2" color="$gray10" numberOfLines={1}>
          {ejercicioNombre}
        </Text>
      </YStack>

      <XStack gap="$2">
        <YStack flex={1} gap="$1">
          <Label fontSize="$2" color="$gray10">
            Peso (kg)
          </Label>
          <Input
            keyboardType="numeric"
            value={peso}
            disabled={ocupado}
            onChangeText={(texto) => {
              setPeso(texto)
              setAviso(null)
            }}
            placeholder="Ej. 62,5"
            placeholderTextColor={tema.placeholderColor?.val}
            borderRadius="$3"
            padding="$2"
          />
        </YStack>

        <YStack flex={1} gap="$1">
          <Label fontSize="$2" color="$gray10">
            Repeticiones
          </Label>
          <Input
            keyboardType="numeric"
            value={reps}
            disabled={ocupado}
            onChangeText={(texto) => {
              setReps(texto)
              setAviso(null)
            }}
            placeholder="Ej. 10"
            placeholderTextColor={tema.placeholderColor?.val}
            borderRadius="$3"
            padding="$2"
          />
        </YStack>

        <YStack flex={0.8} gap="$1">
          <Label fontSize="$2" color="$gray10">
            RPE (1-10)
          </Label>
          <Input
            keyboardType="numeric"
            value={rpe}
            disabled={ocupado}
            onChangeText={(texto) => {
              setRpe(texto)
              setAviso(null)
            }}
            placeholder="Opc."
            placeholderTextColor={tema.placeholderColor?.val}
            borderRadius="$3"
            padding="$2"
          />
        </YStack>
      </XStack>

      <YStack gap="$1">
        <Label fontSize="$2" color="$gray10">
          Notas de la serie (opcional)
        </Label>
        <TextArea
          value={notas}
          disabled={ocupado}
          onChangeText={(texto) => {
            setNotas(texto)
            setAviso(null)
          }}
          placeholder="Sensaciones, agarre, tempo…"
          placeholderTextColor={tema.placeholderColor?.val}
          borderRadius="$3"
          padding="$2"
          numberOfLines={2}
        />
      </YStack>

      {aviso ? (
        <Text fontSize="$2" color="$red11">
          {aviso}
        </Text>
      ) : null}

      {error ? (
        <Text fontSize="$2" color="$red11">
          {error}
        </Text>
      ) : null}

      <XStack gap="$2" marginTop="$1">
        <Button
          size="$4"
          flex={1}
          borderWidth={1}
          borderColor="$borderColor"
          disabled={ocupado}
          onPress={onCerrar}
        >
          Cancelar
        </Button>
        <Button
          size="$4"
          flex={1}
          backgroundColor="$gray12"
          color="$gray1"
          fontWeight="bold"
          pressStyle={{ opacity: 0.85 }}
          disabled={ocupado}
          icon={
            ocupado ? (
              <Spinner size="small" color="$gray1" />
            ) : (
              <Ionicons name="checkmark-circle" size={18} color={tema.gray1?.val} />
            )
          }
          onPress={() => void guardar()}
        >
          {ocupado ? 'Guardando…' : 'Guardar'}
        </Button>
      </XStack>
    </YStack>
  )
}

interface ModalEditarSerieProps {
  objetivo: SerieEnEdicion | null
  ocupado: boolean
  error: string | null
  onCerrar: () => void
  onGuardar: (registroId: string, serieId: string, cambios: CambiosSerie) => Promise<boolean>
}

/** Modal de edición de serie registrada: peso, reps, RPE opcional y notas. */
function ModalEditarSerie({
  objetivo,
  ocupado,
  error,
  onCerrar,
  onGuardar,
}: ModalEditarSerieProps) {
  return (
    <Modal
      visible={objetivo !== null}
      animationType="slide"
      transparent
      onRequestClose={ocupado ? undefined : onCerrar}
      statusBarTranslucent
    >
      <YStack flex={1} justifyContent="flex-end">
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          onPress={ocupado ? undefined : onCerrar}
          accessibilityLabel="Cerrar edición de serie"
        />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {objetivo ? (
            <FormularioEditarSerie
              key={objetivo.serie.id}
              objetivo={objetivo}
              ocupado={ocupado}
              error={error}
              onCerrar={onCerrar}
              onGuardar={onGuardar}
            />
          ) : null}
        </KeyboardAvoidingView>
      </YStack>
    </Modal>
  )
}

interface ModalFinalizarProps {
  visible: boolean
  ocupado: boolean
  duracionMinutos: number
  error: string | null
  onCerrar: () => void
  /** Devuelve true si la sesión se finalizó correctamente. */
  onFinalizar: (datos: { rpe_sesion: number | null; notas: string | null }) => Promise<boolean>
}

/** Modal de cierre de sesión: duración estimada, RPE global (1-10, opcional) + notas. */
function ModalFinalizar({
  visible,
  ocupado,
  duracionMinutos,
  error,
  onCerrar,
  onFinalizar,
}: ModalFinalizarProps) {
  const [rpe, setRpe] = useState('')
  const [notas, setNotas] = useState('')
  const tema = useTheme()

  const rpeValido = aRPE(rpe) !== 'invalido'

  const cerrar = () => {
    setRpe('')
    setNotas('')
    onCerrar()
  }

  const finalizar = async () => {
    const rpeNum = aRPE(rpe)
    const exito = await onFinalizar({
      rpe_sesion: rpeNum === 'invalido' ? null : rpeNum,
      notas: notas.trim() === '' ? null : notas.trim(),
    })
    if (exito) {
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
            <YStack gap="$0.5">
              <Text fontSize="$5" fontWeight="bold" color="$color">
                Finalizar sesión
              </Text>
              <Text fontSize="$2" color="$gray10">
                Duración: ~{duracionMinutos} min
              </Text>
            </YStack>

            <YStack gap="$1">
              <Label fontSize="$2" color="$gray10">
                RPE de la sesión (1-10, opcional)
              </Label>
              <Input
                keyboardType="numeric"
                value={rpe}
                onChangeText={(texto) => setRpe(texto)}
                placeholder="Ej. 8"
                placeholderTextColor={tema.placeholderColor?.val}
                borderRadius="$3"
                padding="$2"
              />
              {!rpeValido ? (
                <Text fontSize="$1" color="$red11">
                  El RPE debe ser un número entero entre 1 y 10.
                </Text>
              ) : null}
            </YStack>

            <YStack gap="$1">
              <Label fontSize="$2" color="$gray10">
                Notas (opcional)
              </Label>
              <TextArea
                value={notas}
                onChangeText={setNotas}
                placeholder="Cómo fue el entrenamiento…"
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
                disabled={ocupado || !rpeValido}
                icon={ocupado ? undefined : <Ionicons name="checkmark-circle" size={18} color={tema.gray1?.val} />}
                onPress={() => void finalizar()}
              >
                {ocupado ? 'Guardando…' : 'Finalizar'}
              </Button>
            </XStack>
          </YStack>
        </KeyboardAvoidingView>
      </YStack>
    </Modal>
  )
}

/**
 * Pantalla de Sesión: arranca el entrenamiento del día elegido de la rutina
 * activa y registra las series (peso, reps, RPE) en vivo. Al finalizar, la
 * sesión pasa al historial (se ve en "Actividad reciente" del Dashboard);
 * al descartar se elimina de la base de datos.
 */
export default function SesionScreen() {
  const usuario = useConfiguracionStore((s) => s.usuarioActivo)

  const rutinas = useRutinasStore((s) => s.rutinas)
  const rutinaSeleccionada = useRutinasStore((s) => s.rutinaSeleccionada)
  const cargandoRutinas = useRutinasStore((s) => s.cargando)
  const errorRutinas = useRutinasStore((s) => s.error)
  const cargarRutinas = useRutinasStore((s) => s.cargarRutinas)
  const seleccionarRutina = useRutinasStore((s) => s.seleccionarRutina)

  const sesionActual = useSesionStore((s) => s.sesionActual)
  const sesionAbierta = useSesionStore((s) => s.sesionAbierta)
  const cargandoSesion = useSesionStore((s) => s.cargando)
  const errorSesion = useSesionStore((s) => s.error)
  const iniciarSesion = useSesionStore((s) => s.iniciarSesion)
  const cargarSesionAbierta = useSesionStore((s) => s.cargarSesionAbierta)
  const reanudarSesion = useSesionStore((s) => s.reanudarSesion)
  const agregarSerie = useSesionStore((s) => s.agregarSerie)
  const actualizarSerie = useSesionStore((s) => s.actualizarSerie)
  const eliminarSerie = useSesionStore((s) => s.eliminarSerie)
  const finalizarSesion = useSesionStore((s) => s.finalizarSesion)
  const descartarSesion = useSesionStore((s) => s.descartarSesion)
  const cancelarSesion = useSesionStore((s) => s.cancelarSesion)
  const limpiarError = useSesionStore((s) => s.limpiarError)

  const ejerciciosPorId = useEjerciciosStore((s) => s.ejerciciosPorId)
  const cargarEjercicios = useEjerciciosStore((s) => s.cargarEjercicios)

  const tema = useTheme()
  const [diaElegidoId, setDiaElegidoId] = useState<string | null>(null)
  const [modalFinalizarAbierto, setModalFinalizarAbierto] = useState(false)
  const [sesionTerminada, setSesionTerminada] = useState<{
    volumen: number
    duracionMinutos: number
  } | null>(null)
  const [serieOcupadaId, setSerieOcupadaId] = useState<string | null>(null)
  const [serieEditando, setSerieEditando] = useState<SerieEnEdicion | null>(null)
  const [accionFallidaSerie, setAccionFallidaSerie] = useState<
    | { tipo: 'actualizar'; registroId: string; serieId: string; cambios: CambiosSerie }
    | { tipo: 'eliminar'; registroId: string; serieId: string }
    | null
  >(null)
  const [detalleModal, setDetalleModal] = useState<{
    ejercicio: Ejercicio
    imagenUrl: string | null
  } | null>(null)

  const cronometroSesion = useCronometroSesion(sesionActual?.sesion.creado_en ?? null)
  const temporizador = useTemporizadorDescanso({ habilitado: Boolean(sesionActual) })

  useEffect(() => {
    void cargarEjercicios()
  }, [cargarEjercicios])

  const usuarioId = usuario?.id ?? null
  const cargando = cargandoRutinas || cargandoSesion
  const error = errorRutinas ?? errorSesion

  // Carga las rutinas al montar para conocer la activa.
  useEffect(() => {
    void cargarRutinas(usuarioId)
  }, [usuarioId, cargarRutinas])

  // Detecta si quedó una sesión abierta sin finalizar en BD cuando no hay sesión en memoria.
  useEffect(() => {
    if (!usuarioId || sesionActual) {
      return
    }
    void cargarSesionAbierta(usuarioId)
  }, [usuarioId, sesionActual, cargarSesionAbierta])

  const rutinaActiva = useMemo(() => rutinas.find((r) => r.activa === 1) ?? null, [rutinas])

  const diaSesionId = sesionActual?.sesion.dia_rutina_id ?? null

  // El detalle de la rutina activa alimenta el selector de días (sin sesión)
  // y los objetivos por ejercicio (con sesión). Con sesión en curso solo se
  // re-selecciona si el detalle cargado no corresponde al día de la sesión
  // (p. ej. el usuario tocó otra rutina en la pestaña Rutinas).
  useEffect(() => {
    if (!rutinaActiva) {
      return
    }
    const seleccionada = useRutinasStore.getState().rutinaSeleccionada
    if (sesionActual) {
      if (seleccionada?.dias.some((d) => d.id === diaSesionId)) {
        return
      }
      void seleccionarRutina(rutinaActiva.id)
      return
    }
    if (seleccionada?.id === rutinaActiva.id) {
      return
    }
    void seleccionarRutina(rutinaActiva.id)
  }, [rutinaActiva, sesionActual, diaSesionId, seleccionarRutina])

  const diasDeLaRutinaActiva =
    rutinaSeleccionada && rutinaActiva && rutinaSeleccionada.id === rutinaActiva.id
      ? rutinaSeleccionada.dias
      : []

  // Si cambia la rutina activa, un diaElegidoId guardado puede pertenecer a
  // la rutina anterior: se deriva el día válido en vez de resetearlo en un
  // efecto (evita iniciar con un diaRutinaId de otra rutina).
  const diaElegido =
    diaElegidoId && diasDeLaRutinaActiva.some((d) => d.id === diaElegidoId) ? diaElegidoId : null

  // Objetivo de cada ejercicio del día en curso (si hay sesión activa).
  const objetivosPorEjercicio = useMemo(() => {
    const mapa = new Map<string, EjercicioEnRutinaDetalle>()
    const dia = diaSesionId
      ? rutinaSeleccionada?.dias.find((d) => d.id === diaSesionId)
      : undefined
    dia?.ejercicios.forEach((ejercicio) => mapa.set(ejercicio.ejercicio_id, ejercicio))
    return mapa
  }, [rutinaSeleccionada, diaSesionId])

  const volumenSesion = useMemo(
    () =>
      sesionActual
        ? sesionActual.registros.reduce((total, registro) => total + calcularVolumenTotal(registro.series), 0)
        : 0,
    [sesionActual],
  )

  const iniciar = async () => {
    // `sesiones.usuario_id` es NOT NULL con FK: sin usuario activo el INSERT
    // fallaría (el bootstrap del root layout lo garantiza en la práctica).
    if (!rutinaActiva || !diaElegido || !usuarioId) {
      return
    }
    temporizador.saltar()
    setSesionTerminada(null)
    await iniciarSesion({
      rutinaId: rutinaActiva.id,
      diaRutinaId: diaElegido,
      usuarioId,
    })
  }

  const finalizar = async (datos: { rpe_sesion: number | null; notas: string | null }) => {
    if (!sesionActual) {
      return false
    }
    // El volumen y la duración real se capturan antes de finalizar: la sesión deja de estar en curso.
    const volumen = volumenSesion
    const duracion = calcularDuracionMinutos(sesionActual.sesion.creado_en)
    await finalizarSesion({
      duracion_minutos: duracion,
      notas: datos.notas ?? undefined,
      rpe_sesion: datos.rpe_sesion ?? undefined,
    })
    if (!useSesionStore.getState().sesionActual) {
      temporizador.saltar()
      setSesionTerminada({ volumen, duracionMinutos: duracion })
      setDiaElegidoId(null)
      return true
    }
    return false
  }

  const confirmarDescartar = () => {
    const mensaje = '¿Descartar la sesión? Se borrarán las series registradas y no se guardará nada.'
    if (Platform.OS === 'web') {
      if (window.confirm(mensaje)) {
        void descartarSesion()
      }
      return
    }
    Alert.alert('Descartar sesión', mensaje, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Descartar',
        style: 'destructive',
        onPress: () => void descartarSesion(),
      },
    ])
  }

  const reanudarAbierta = async () => {
    if (!sesionAbierta) return
    temporizador.saltar()
    setSesionTerminada(null)
    await reanudarSesion(sesionAbierta.id)
  }

  const confirmarDescartarAbierta = () => {
    if (!sesionAbierta) return
    const mensaje = '¿Descartar la sesión sin terminar? Se borrarán sus registros y series.'
    if (Platform.OS === 'web') {
      if (window.confirm(mensaje)) {
        void cancelarSesion(sesionAbierta.id)
      }
      return
    }
    Alert.alert('Descartar sesión', mensaje, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Descartar',
        style: 'destructive',
        onPress: () => void cancelarSesion(sesionAbierta.id),
      },
    ])
  }

  const guardarEdicionSerie = async (
    registroId: string,
    serieId: string,
    cambios: CambiosSerie,
  ): Promise<boolean> => {
    setSerieOcupadaId(serieId)
    setAccionFallidaSerie(null)
    try {
      await actualizarSerie(registroId, serieId, cambios)
    } finally {
      setSerieOcupadaId(null)
    }
    if (!useSesionStore.getState().error) {
      setSerieEditando((actual) => (actual?.serie.id === serieId ? null : actual))
      return true
    }
    setAccionFallidaSerie({ tipo: 'actualizar', registroId, serieId, cambios })
    return false
  }

  const ejecutarEliminarSerie = async (registroId: string, serieId: string): Promise<void> => {
    setSerieOcupadaId(serieId)
    setAccionFallidaSerie(null)
    try {
      await eliminarSerie(registroId, serieId)
    } finally {
      setSerieOcupadaId(null)
    }
    if (useSesionStore.getState().error) {
      setAccionFallidaSerie({ tipo: 'eliminar', registroId, serieId })
    }
  }

  const confirmarEliminarSerie = (registroId: string, serie: SerieReal) => {
    const mensaje = `¿Eliminar la serie S${serie.numero_serie} (${serie.peso_levantado} kg × ${serie.reps_realizadas})? Se borrará de la sesión en curso.`
    if (Platform.OS === 'web') {
      if (window.confirm(mensaje)) {
        void ejecutarEliminarSerie(registroId, serie.id)
      }
      return
    }
    Alert.alert('Eliminar serie', mensaje, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => void ejecutarEliminarSerie(registroId, serie.id),
      },
    ])
  }

  /**
   * Reintento contextual: si falló una edición/eliminación de serie en la
   * sesión activa se reintenta esa operación; si falló el arranque de la
   * sesión (día elegido y sin sesión en curso), se reintenta iniciar; si no,
   * se recargan las rutinas y se limpia el error.
   */
  const reintentar = () => {
    limpiarError()
    if (sesionActual && accionFallidaSerie) {
      if (accionFallidaSerie.tipo === 'actualizar') {
        void guardarEdicionSerie(
          accionFallidaSerie.registroId,
          accionFallidaSerie.serieId,
          accionFallidaSerie.cambios,
        )
      } else {
        void ejecutarEliminarSerie(accionFallidaSerie.registroId, accionFallidaSerie.serieId)
      }
      return
    }
    if (!sesionActual && diaElegido && rutinaActiva && usuarioId && errorSesion) {
      void iniciar()
      return
    }
    void cargarRutinas(usuarioId)
  }

  const bannerError = error ? (
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
        <Button size="$2" borderColor="$red8" onPress={reintentar}>
          Reintentar
        </Button>
      </XStack>
    </Card>
  ) : null

  if (sesionTerminada) {
    return (
      <YStack flex={1} backgroundColor="$background" padding="$4" gap="$4">
        {bannerError}
        <YStack flex={1} justifyContent="center" alignItems="center" gap="$3">
          <Ionicons name="checkmark-circle" size={64} color={tema.blue9?.val} />
          <Text fontSize="$6" fontWeight="bold" color="$color" textAlign="center">
            ¡Sesión registrada!
          </Text>
          <Text fontSize="$3" color="$gray11" textAlign="center">
            Volumen {formatearCantidad(sesionTerminada.volumen)} kg · Duración{' '}
            {sesionTerminada.duracionMinutos} min
          </Text>
          <Text fontSize="$2" color="$gray10" textAlign="center">
            Ya puedes verla en «Actividad reciente» del Dashboard.
          </Text>
        </YStack>
        <YStack gap="$2">
          <Button
            size="$4"
            backgroundColor="$gray12"
            color="$gray1"
            fontWeight="bold"
            pressStyle={{ opacity: 0.85 }}
            icon={<Ionicons name="home" size={18} color={tema.gray1?.val} />}
            onPress={() => router.navigate('/')}
          >
            Ir al Dashboard
          </Button>
          <Button
            size="$4"
            borderWidth={1}
            borderColor="$borderColor"
            icon={<Ionicons name="play-circle" size={18} color={tema.color?.val} />}
            onPress={() => setSesionTerminada(null)}
          >
            Entrenar otro día
          </Button>
        </YStack>
      </YStack>
    )
  }

  if (sesionActual) {
    return (
      <YStack flex={1} backgroundColor="$background">
        <YStack padding="$4" paddingBottom="$2" gap="$3">
          {bannerError}
          <Card size="$4" borderWidth={1} borderColor="$borderColor" padding="$4" gap="$3">
            <XStack justifyContent="space-between" alignItems="flex-start" gap="$2">
              <YStack flex={1} gap="$1">
                <Text fontSize="$5" fontWeight="bold" color="$color" numberOfLines={1}>
                  {sesionActual.rutina_nombre}
                </Text>
                <Text fontSize="$2" color="$gray10" numberOfLines={1}>
                  {sesionActual.nombre_dia}
                </Text>
              </YStack>
              <XStack gap="$4" alignItems="flex-end">
                <YStack alignItems="flex-end" gap="$0.5">
                  <Text fontSize="$1" color="$gray9">
                    Tiempo
                  </Text>
                  <Text
                    fontSize="$4"
                    fontWeight="bold"
                    color="$color"
                    accessibilityLabel={`Tiempo transcurrido de sesión: ${cronometroSesion.textoMMSS}`}
                  >
                    {cronometroSesion.textoMMSS}
                  </Text>
                </YStack>
                <YStack alignItems="flex-end" gap="$0.5">
                  <Text fontSize="$1" color="$gray9">
                    Volumen
                  </Text>
                  <Text fontSize="$4" fontWeight="bold" color="$color">
                    {formatearCantidad(volumenSesion)} kg
                  </Text>
                </YStack>
              </XStack>
            </XStack>
            <XStack gap="$2" marginTop="$1">
              <Button
                size="$3"
                flex={1}
                borderWidth={1}
                borderColor="$red8"
                color="$red11"
                disabled={cargando}
                icon={<Ionicons name="trash-outline" size={16} color={tema.red11?.val} />}
                onPress={confirmarDescartar}
              >
                Descartar
              </Button>
              <Button
                size="$3"
                flex={1}
                backgroundColor="$gray12"
                color="$gray1"
                fontWeight="bold"
                pressStyle={{ opacity: 0.85 }}
                disabled={cargando}
                icon={<Ionicons name="checkmark-circle" size={16} color={tema.gray1?.val} />}
                onPress={() => setModalFinalizarAbierto(true)}
              >
                Finalizar
              </Button>
            </XStack>
          </Card>

          {temporizador.activo && temporizador.ejercicioNombre ? (
            <TemporizadorDescanso
              ejercicioNombre={temporizador.ejercicioNombre}
              segundosTotales={temporizador.segundosTotales}
              segundosRestantes={temporizador.segundosRestantes}
              textoRestante={temporizador.textoRestante}
              pausado={temporizador.pausado}
              terminado={temporizador.terminado}
              onPausar={temporizador.pausar}
              onReanudar={temporizador.reanudar}
              onAgregarTiempo={temporizador.agregarTiempo}
              onSaltar={temporizador.saltar}
            />
          ) : null}
        </YStack>

        <ScrollView flex={1}>
          <YStack padding="$4" paddingTop="$2" paddingBottom="$5" gap="$3">
            {sesionActual.registros.length === 0 ? (
              <Text fontSize="$2" color="$gray10" textAlign="center" paddingVertical="$4">
                Este día no tiene ejercicios configurados.
              </Text>
            ) : (
              sesionActual.registros.map((registro) => {
                const objetivoEjercicio = objetivosPorEjercicio.get(registro.ejercicio_id)
                return (
                  <TarjetaEjercicio
                    key={registro.registro_id}
                    registro={registro}
                    objetivo={objetivoEjercicio}
                    ocupado={cargando}
                    serieOcupadaId={serieOcupadaId}
                    onAgregar={async (registroId, serie) => {
                      setAccionFallidaSerie(null)
                      const creada = await agregarSerie(registroId, serie)
                      if (
                        creada &&
                        objetivoEjercicio?.descanso_segundos &&
                        objetivoEjercicio.descanso_segundos > 0
                      ) {
                        temporizador.iniciarDescanso(
                          registro.ejercicio_nombre,
                          objetivoEjercicio.descanso_segundos,
                        )
                      }
                    }}
                    onDescansar={temporizador.iniciarDescanso}
                    onEditarSerie={(registroId, ejercicioNombre, serie) => {
                      limpiarError()
                      setAccionFallidaSerie(null)
                      setSerieEditando({ registroId, ejercicioNombre, serie })
                    }}
                    onEliminarSerie={confirmarEliminarSerie}
                    onVerDetalle={() => {
                      const ej = ejerciciosPorId.get(registro.ejercicio_id) ?? {
                        id: registro.ejercicio_id,
                        nombre: registro.ejercicio_nombre,
                        grupo_muscular_primario: 'cuerpo_completo' as const,
                        grupos_musculares_secundarios: [],
                        equipamiento: 'peso_corporal' as const,
                        es_compuesto: 0 as const,
                        factor_fraccional: 1.0,
                        instrucciones: null,
                        video_url: null,
                      }
                      setDetalleModal({
                        ejercicio: ej,
                        imagenUrl: objetivoEjercicio?.imagen_url ?? registro.imagen_url ?? null,
                      })
                    }}
                  />
                )
              })
            )}
          </YStack>
        </ScrollView>

        <ModalEditarSerie
          objetivo={serieEditando}
          ocupado={cargando}
          error={errorSesion}
          onCerrar={() => setSerieEditando(null)}
          onGuardar={guardarEdicionSerie}
        />

        <ModalFinalizar
          visible={modalFinalizarAbierto}
          ocupado={cargando}
          duracionMinutos={cronometroSesion.duracionMinutos}
          error={errorSesion}
          onCerrar={() => setModalFinalizarAbierto(false)}
          onFinalizar={finalizar}
        />

        <ModalVisualEjercicio
          visible={detalleModal !== null}
          ejercicio={detalleModal?.ejercicio ?? null}
          imagenUrl={detalleModal?.imagenUrl ?? null}
          onCerrar={() => setDetalleModal(null)}
        />
      </YStack>
    )
  }

  // ── Sin sesión activa ────────────────────────────────────────────────────────
  const tarjetaSesionAbierta = sesionAbierta ? (
    <Card
      size="$4"
      backgroundColor="$blue2"
      borderWidth={1}
      borderColor="$blue8"
      padding="$3"
      gap="$2.5"
    >
      <Text fontSize="$3" fontWeight="600" color="$color">
        {`Sesión sin terminar · ${sesionAbierta.rutina_nombre ?? 'Rutina'} · ${sesionAbierta.nombre_dia ?? 'Día'} · ${formatearFecha(sesionAbierta.fecha)}`}
      </Text>
      <XStack gap="$2">
        <Button
          size="$3"
          flex={1}
          borderWidth={1}
          borderColor="$red8"
          color="$red11"
          disabled={cargando}
          icon={<Ionicons name="trash-outline" size={16} color={tema.red11?.val} />}
          onPress={confirmarDescartarAbierta}
        >
          Descartar
        </Button>
        <Button
          size="$3"
          flex={1}
          backgroundColor="$gray12"
          color="$gray1"
          fontWeight="bold"
          pressStyle={{ opacity: 0.85 }}
          disabled={cargando}
          icon={<Ionicons name="play" size={16} color={tema.gray1?.val} />}
          onPress={() => void reanudarAbierta()}
        >
          Reanudar
        </Button>
      </XStack>
    </Card>
  ) : null

  return (
    <YStack flex={1} backgroundColor="$background">
      <YStack padding="$4" paddingBottom="$2">
        {bannerError}
      </YStack>

      <ScrollView flex={1}>
        {cargando && rutinas.length === 0 ? (
          <YStack flex={1} justifyContent="center" alignItems="center" gap="$4" paddingVertical="$8">
            <Spinner size="large" color="$color" />
            <Text color="$gray10">Cargando tu rutina…</Text>
          </YStack>
        ) : !rutinaActiva ? (
          <YStack padding="$4" gap="$4">
            {tarjetaSesionAbierta}
            <YStack paddingVertical="$6" gap="$3" alignItems="center">
              <Ionicons name="barbell-outline" size={48} color={tema.gray9?.val} />
              <Text fontSize="$4" fontWeight="bold" color="$color" textAlign="center">
                No hay una rutina activa
              </Text>
              <Text fontSize="$2" color="$gray10" textAlign="center">
                Activa una rutina en la pestaña de Rutinas para empezar a entrenar.
              </Text>
              <Button
                size="$4"
                backgroundColor="$gray12"
                color="$gray1"
                fontWeight="bold"
                pressStyle={{ opacity: 0.85 }}
                icon={<Ionicons name="barbell-outline" size={18} color={tema.gray1?.val} />}
                onPress={() => router.navigate('/rutinas')}
              >
                Ir a Rutinas
              </Button>
            </YStack>
          </YStack>
        ) : (
          <YStack padding="$4" paddingTop="$2" gap="$3">
            {tarjetaSesionAbierta}
            <Text fontSize="$5" fontWeight="bold" color="$color">
              {rutinaActiva.nombre}
            </Text>
            <Text fontSize="$2" color="$gray10">
              Elige el día que vas a entrenar:
            </Text>

            {diasDeLaRutinaActiva.length === 0 ? (
              cargando || rutinaSeleccionada?.id !== rutinaActiva.id ? (
                <YStack paddingVertical="$6" alignItems="center" gap="$3">
                  <Spinner color="$color" />
                  <Text fontSize="$2" color="$gray10">
                    Cargando los días de la rutina…
                  </Text>
                </YStack>
              ) : (
                <YStack paddingVertical="$4" gap="$3" alignItems="center">
                  <Text fontSize="$3" fontWeight="600" color="$color" textAlign="center">
                    Esta rutina todavía no tiene días configurados
                  </Text>
                  <Text fontSize="$2" color="$gray10" textAlign="center">
                    Crea una rutina con días o activa una de las plantillas desde la pestaña de
                    Rutinas.
                  </Text>
                  <Button
                    size="$4"
                    borderWidth={1}
                    borderColor="$borderColor"
                    icon={<Ionicons name="barbell-outline" size={18} color={tema.color?.val} />}
                    onPress={() => router.navigate('/rutinas')}
                  >
                    Ir a Rutinas
                  </Button>
                </YStack>
              )
            ) : (
              <YStack gap="$2">
                {diasDeLaRutinaActiva.map((dia) => {
                  const elegido = diaElegido === dia.id
                  return (
                    <Pressable
                      key={dia.id}
                      onPress={() => setDiaElegidoId(dia.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`Elegir ${dia.nombre_dia}`}
                    >
                      <YStack
                        borderWidth={2}
                        borderColor={elegido ? '$blue8' : '$borderColor'}
                        backgroundColor={elegido ? '$blue2' : undefined}
                        borderRadius="$4"
                        padding="$3"
                        gap="$1"
                      >
                        <Text fontSize="$3" fontWeight="600" color="$color" numberOfLines={1}>
                          {dia.nombre_dia}
                        </Text>
                        <Text fontSize="$2" color="$gray10" numberOfLines={1}>
                          {dia.ejercicios.length} ejercicios
                        </Text>
                      </YStack>
                    </Pressable>
                  )
                })}
              </YStack>
            )}
          </YStack>
        )}
      </ScrollView>

      {rutinaActiva && diasDeLaRutinaActiva.length > 0 ? (
        <YStack padding="$4" paddingTop="$2">
          <Button
            size="$4"
            backgroundColor="$gray12"
            color="$gray1"
            fontWeight="bold"
            pressStyle={{ opacity: 0.85 }}
            disabled={!diaElegido || cargando || !usuarioId}
            icon={<Ionicons name="play-circle" size={18} color={tema.gray1?.val} />}
            onPress={() => void iniciar()}
          >
            {cargando ? 'Iniciando…' : 'Iniciar entrenamiento'}
          </Button>
          {!usuarioId ? (
            <Text fontSize="$1" color="$gray9" textAlign="center" marginTop="$2">
              Preparando tu perfil de usuario…
            </Text>
          ) : null}
        </YStack>
      ) : null}

      <ModalVisualEjercicio
        visible={detalleModal !== null}
        ejercicio={detalleModal?.ejercicio ?? null}
        imagenUrl={detalleModal?.imagenUrl ?? null}
        onCerrar={() => setDetalleModal(null)}
      />
    </YStack>
  )
}
