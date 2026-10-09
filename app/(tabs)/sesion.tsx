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
import type { EjercicioEnRutinaDetalle, SerieReal } from '../../src/domain/types'
import { useConfiguracionStore } from '../../src/store/configuracion.store'
import { useRutinasStore } from '../../src/store/rutinas.store'
import { useSesionStore } from '../../src/store/sesion.store'

/** Registro en curso tal como lo expone `sesionActual` (subconjunto estructural). */
interface RegistroSesion {
  registro_id: string
  ejercicio_nombre: string
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
  /** Deshabilita el botón mientras hay una operación en curso. */
  ocupado: boolean
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
  ) => void
}

/** Ejercicio de la sesión: series registradas + input rápido de nueva serie. */
function TarjetaEjercicio({ registro, objetivo, ocupado, onAgregar }: TarjetaEjercicioProps) {
  const [peso, setPeso] = useState('')
  const [reps, setReps] = useState('')
  const [rpe, setRpe] = useState('')
  const [aviso, setAviso] = useState<string | null>(null)
  const tema = useTheme()

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
    onAgregar(registro.registro_id, {
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
      <YStack gap="$1">
        <Text fontSize="$4" fontWeight="bold" color="$color" numberOfLines={1}>
          {registro.ejercicio_nombre}
        </Text>
        {partesObjetivo.length > 0 ? (
          <Text fontSize="$2" color="$gray10" numberOfLines={1}>
            Objetivo: {partesObjetivo.join(' · ')}
          </Text>
        ) : null}
      </YStack>

      {registro.series.length > 0 ? (
        <YStack backgroundColor="$gray3" borderRadius="$3" padding="$2" gap="$1">
          {registro.series.map((serie) => (
            <XStack key={serie.id} justifyContent="space-between" gap="$2">
              <Text fontSize="$2" color="$gray11">
                S{serie.numero_serie}
              </Text>
              <Text fontSize="$2" color="$gray11" flex={1} textAlign="right">
                {serie.peso_levantado} kg × {serie.reps_realizadas}
                {serie.rpe_serie != null ? ` · RPE ${serie.rpe_serie}` : ''}
              </Text>
            </XStack>
          ))}
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

interface ModalFinalizarProps {
  visible: boolean
  ocupado: boolean
  error: string | null
  onCerrar: () => void
  /** Devuelve true si la sesión se finalizó correctamente. */
  onFinalizar: (datos: { rpe_sesion: number | null; notas: string | null }) => Promise<boolean>
}

/** Modal de cierre de sesión: RPE global (1-10, opcional) + notas. */
function ModalFinalizar({ visible, ocupado, error, onCerrar, onFinalizar }: ModalFinalizarProps) {
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
            <Text fontSize="$5" fontWeight="bold" color="$color">
              Finalizar sesión
            </Text>

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
  const cargandoSesion = useSesionStore((s) => s.cargando)
  const errorSesion = useSesionStore((s) => s.error)
  const iniciarSesion = useSesionStore((s) => s.iniciarSesion)
  const agregarSerie = useSesionStore((s) => s.agregarSerie)
  const finalizarSesion = useSesionStore((s) => s.finalizarSesion)
  const descartarSesion = useSesionStore((s) => s.descartarSesion)
  const limpiarError = useSesionStore((s) => s.limpiarError)

  const tema = useTheme()
  const [diaElegidoId, setDiaElegidoId] = useState<string | null>(null)
  const [modalFinalizarAbierto, setModalFinalizarAbierto] = useState(false)
  const [sesionTerminada, setSesionTerminada] = useState<{ volumen: number } | null>(null)

  const usuarioId = usuario?.id ?? null
  const cargando = cargandoRutinas || cargandoSesion
  const error = errorRutinas ?? errorSesion

  // Carga las rutinas al montar para conocer la activa.
  useEffect(() => {
    void cargarRutinas(usuarioId)
  }, [usuarioId, cargarRutinas])

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
    if (!rutinaActiva || !diaElegido) {
      return
    }
    setSesionTerminada(null)
    await iniciarSesion({
      rutinaId: rutinaActiva.id,
      diaRutinaId: diaElegido,
      usuarioId: usuarioId ?? '',
    })
  }

  const finalizar = async (datos: { rpe_sesion: number | null; notas: string | null }) => {
    // El volumen se captura antes de finalizar: la sesión deja de estar en curso.
    const volumen = volumenSesion
    // El store tipa los campos como opcionales; `null` se traduce a "sin dato"
    // (la duración automática desde `creado_en` queda como tarea futura).
    await finalizarSesion({
      duracion_minutos: undefined,
      notas: datos.notas ?? undefined,
      rpe_sesion: datos.rpe_sesion ?? undefined,
    })
    if (!useSesionStore.getState().sesionActual) {
      setSesionTerminada({ volumen })
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

  const recargar = () => {
    limpiarError()
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
        <Button size="$2" borderColor="$red8" onPress={recargar}>
          Reintentar
        </Button>
      </XStack>
    </Card>
  ) : null

  if (sesionTerminada) {
    return (
      <YStack flex={1} background="$background" padding="$4" gap="$4">
        {bannerError}
        <YStack flex={1} justifyContent="center" alignItems="center" gap="$3">
          <Ionicons name="checkmark-circle" size={64} color={tema.blue9?.val} />
          <Text fontSize="$6" fontWeight="bold" color="$color" textAlign="center">
            ¡Sesión registrada!
          </Text>
          <Text fontSize="$3" color="$gray11" textAlign="center">
            Volumen total: {formatearCantidad(sesionTerminada.volumen)} kg
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
      <YStack flex={1} background="$background">
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
              <YStack alignItems="flex-end" gap="$0.5">
                <Text fontSize="$1" color="$gray9">
                  Volumen
                </Text>
                <Text fontSize="$4" fontWeight="bold" color="$color">
                  {formatearCantidad(volumenSesion)} kg
                </Text>
              </YStack>
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
        </YStack>

        <ScrollView flex={1}>
          <YStack padding="$4" paddingTop="$2" paddingBottom="$5" gap="$3">
            {sesionActual.registros.length === 0 ? (
              <Text fontSize="$2" color="$gray10" textAlign="center" paddingVertical="$4">
                Este día no tiene ejercicios configurados.
              </Text>
            ) : (
              sesionActual.registros.map((registro) => (
                <TarjetaEjercicio
                  key={registro.registro_id}
                  registro={registro}
                  objetivo={objetivosPorEjercicio.get(registro.ejercicio_id)}
                  ocupado={cargando}
                  onAgregar={(registroId, serie) => void agregarSerie(registroId, serie)}
                />
              ))
            )}
          </YStack>
        </ScrollView>

        <ModalFinalizar
          visible={modalFinalizarAbierto}
          ocupado={cargando}
          error={errorSesion}
          onCerrar={() => setModalFinalizarAbierto(false)}
          onFinalizar={finalizar}
        />
      </YStack>
    )
  }

  // ── Sin sesión activa ────────────────────────────────────────────────────────
  return (
    <YStack flex={1} background="$background">
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
          <YStack padding="$4" paddingVertical="$8" gap="$3" alignItems="center">
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
        ) : (
          <YStack padding="$4" paddingTop="$2" gap="$3">
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
            disabled={!diaElegido || cargando}
            icon={<Ionicons name="play-circle" size={18} color={tema.gray1?.val} />}
            onPress={() => void iniciar()}
          >
            {cargando ? 'Iniciando…' : 'Iniciar entrenamiento'}
          </Button>
        </YStack>
      ) : null}
    </YStack>
  )
}
