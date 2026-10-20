import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { KeyboardAvoidingView, Modal, Platform, Pressable } from 'react-native'
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

import type { Ejercicio, Equipamiento, GrupoMuscular, NuevaRutina } from '../src/domain/types'
import { EQUIPAMIENTOS, GRUPOS_MUSCULARES } from '../src/domain/types'
import { useConfiguracionStore } from '../src/store/configuracion.store'
import { useEjerciciosStore } from '../src/store/ejercicios.store'
import { useRutinasStore } from '../src/store/rutinas.store'

// ─── Etiquetas de catálogo ────────────────────────────────────────────────────

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

// ─── Helpers de parseo (los inputs son texto con keyboardType numeric) ────────

/** Entero válido o null (vacío/basura). */
function aEntero(texto: string): number | null {
  const limpio = texto.trim()
  if (!/^\d+$/.test(limpio)) {
    return null
  }
  return Number(limpio)
}

/** Decimal válido (acepta coma) o null (vacío/basura). */
function aDecimal(texto: string): number | null {
  const limpio = texto.trim().replace(',', '.')
  if (!/^\d+(\.\d+)?$/.test(limpio)) {
    return null
  }
  return Number(limpio)
}

// ─── Estado del formulario ────────────────────────────────────────────────────

/** Claves locales estables para listas de días/ejercicios del formulario. */
let contadorClaves = 0
function siguienteClave(prefijo: string): string {
  contadorClaves += 1
  return `${prefijo}:${contadorClaves}`
}

interface EjercicioFormulario {
  key: string
  ejercicio_id: string
  series_objetivo: string
  reps_objetivo_min: string
  reps_objetivo_max: string
  /** '' = sin peso objetivo. */
  peso_objetivo: string
  /** '' = sin descanso definido. */
  descanso_segundos: string
}

interface DiaFormulario {
  key: string
  nombre_dia: string
  notas: string
  ejercicios: EjercicioFormulario[]
}

function crearDiaFormulario(orden: number): DiaFormulario {
  return {
    key: siguienteClave('dia'),
    nombre_dia: `Día ${orden}`,
    notas: '',
    ejercicios: [],
  }
}

function crearEjercicioFormulario(ejercicio: Ejercicio): EjercicioFormulario {
  return {
    key: siguienteClave('eje'),
    ejercicio_id: ejercicio.id,
    series_objetivo: '3',
    reps_objetivo_min: '8',
    reps_objetivo_max: '12',
    peso_objetivo: '',
    descanso_segundos: '90',
  }
}

/** Campos numéricos de un ejercicio que no superan la validación. */
function camposInvalidos(ejercicio: EjercicioFormulario): Set<keyof EjercicioFormulario> {
  const invalidos = new Set<keyof EjercicioFormulario>()
  const series = aEntero(ejercicio.series_objetivo)
  const repsMin = aEntero(ejercicio.reps_objetivo_min)
  const repsMax = aEntero(ejercicio.reps_objetivo_max)
  const peso = ejercicio.peso_objetivo.trim() === '' ? 0 : aDecimal(ejercicio.peso_objetivo)
  const descanso =
    ejercicio.descanso_segundos.trim() === '' ? 0 : aEntero(ejercicio.descanso_segundos)

  if (series === null || series < 1) {
    invalidos.add('series_objetivo')
  }
  if (repsMin === null || repsMin < 1) {
    invalidos.add('reps_objetivo_min')
  }
  if (repsMax === null || repsMax < 1) {
    invalidos.add('reps_objetivo_max')
  }
  if (repsMin !== null && repsMax !== null && repsMax < repsMin) {
    invalidos.add('reps_objetivo_max')
  }
  if (peso === null || peso < 0) {
    invalidos.add('peso_objetivo')
  }
  if (descanso === null || descanso < 0) {
    invalidos.add('descanso_segundos')
  }
  return invalidos
}

// ─── Selector de ejercicio (modal con búsqueda + filtros) ─────────────────────

interface SelectorEjercicioModalProps {
  visible: boolean
  /** Catálogo cargado desde `useEjerciciosStore`. */
  catalogo: Ejercicio[]
  /** IDs ya añadidos al día: no se pueden duplicar. */
  yaAñadidos: Set<string>
  onCerrar: () => void
  onSeleccionar: (ejercicio: Ejercicio) => void
}

/**
 * Selector de ejercicios del catálogo maestro: búsqueda por nombre y filtros
 * por grupo muscular y equipamiento (chips). Filtra en memoria sobre el
 * catálogo ya cargado en `useEjerciciosStore` (sin nuevas consultas a BD).
 */
function SelectorEjercicioModal({
  visible,
  catalogo,
  yaAñadidos,
  onCerrar,
  onSeleccionar,
}: SelectorEjercicioModalProps) {
  const tema = useTheme()
  const [busqueda, setBusqueda] = useState('')
  const [filtroGrupo, setFiltroGrupo] = useState<GrupoMuscular | null>(null)
  const [filtroEquipamiento, setFiltroEquipamiento] = useState<Equipamiento | null>(null)

  const cerrar = () => {
    setBusqueda('')
    setFiltroGrupo(null)
    setFiltroEquipamiento(null)
    onCerrar()
  }

  const resultados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()
    return catalogo.filter((ejercicio) => {
      if (filtroGrupo && ejercicio.grupo_muscular_primario !== filtroGrupo) {
        return false
      }
      if (filtroEquipamiento && ejercicio.equipamiento !== filtroEquipamiento) {
        return false
      }
      if (texto !== '' && !ejercicio.nombre.toLowerCase().includes(texto)) {
        return false
      }
      return true
    })
  }, [catalogo, busqueda, filtroGrupo, filtroEquipamiento])

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
          accessibilityLabel="Cerrar selector de ejercicios"
        />
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
          <XStack justifyContent="space-between" alignItems="center">
            <Text fontSize="$5" fontWeight="bold" color="$color">
              Añadir ejercicio
            </Text>
            <Pressable onPress={cerrar} accessibilityRole="button" accessibilityLabel="Cerrar">
              <Ionicons name="close" size={24} color={tema.color?.val} />
            </Pressable>
          </XStack>

          <Input
            value={busqueda}
            onChangeText={setBusqueda}
            placeholder="Buscar ejercicio…"
            placeholderTextColor={tema.placeholderColor?.val}
            borderRadius="$3"
            padding="$2"
            autoCorrect={false}
          />

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <XStack gap="$2" paddingVertical="$1">
              <Chip
                etiqueta="Todos"
                activo={filtroGrupo === null && filtroEquipamiento === null}
                onPress={() => {
                  setFiltroGrupo(null)
                  setFiltroEquipamiento(null)
                }}
              />
              {GRUPOS_MUSCULARES.map((grupo) => (
                <Chip
                  key={grupo}
                  etiqueta={ETIQUETAS_GRUPO[grupo]}
                  activo={filtroGrupo === grupo}
                  onPress={() => setFiltroGrupo(filtroGrupo === grupo ? null : grupo)}
                />
              ))}
            </XStack>
          </ScrollView>

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <XStack gap="$2" paddingVertical="$1">
              {EQUIPAMIENTOS.map((equipamiento) => (
                <Chip
                  key={equipamiento}
                  etiqueta={ETIQUETAS_EQUIPAMIENTO[equipamiento]}
                  activo={filtroEquipamiento === equipamiento}
                  onPress={() =>
                    setFiltroEquipamiento(filtroEquipamiento === equipamiento ? null : equipamiento)
                  }
                />
              ))}
            </XStack>
          </ScrollView>

          <ScrollView style={{ maxHeight: 320 }} nestedScrollEnabled>
            {resultados.length === 0 ? (
              <Text fontSize="$2" color="$gray10" textAlign="center" paddingVertical="$4">
                No hay ejercicios con ese criterio.
              </Text>
            ) : (
              <YStack gap="$2">
                {resultados.map((ejercicio) => {
                  const añadido = yaAñadidos.has(ejercicio.id)
                  return (
                    <Pressable
                      key={ejercicio.id}
                      disabled={añadido}
                      onPress={() => {
                        onSeleccionar(ejercicio)
                        cerrar()
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={
                        añadido
                          ? `${ejercicio.nombre} (ya añadido)`
                          : `Añadir ${ejercicio.nombre}`
                      }
                    >
                      <XStack
                        borderWidth={1}
                        borderColor="$borderColor"
                        borderRadius="$3"
                        padding="$2"
                        gap="$2"
                        alignItems="center"
                        opacity={añadido ? 0.5 : 1}
                      >
                        <YStack flex={1} gap="$0.5">
                          <Text fontSize="$3" color="$color" numberOfLines={1}>
                            {ejercicio.nombre}
                          </Text>
                          <Text fontSize="$1" color="$gray10" numberOfLines={1}>
                            {ETIQUETAS_GRUPO[ejercicio.grupo_muscular_primario]} ·{' '}
                            {ETIQUETAS_EQUIPAMIENTO[ejercicio.equipamiento]}
                          </Text>
                        </YStack>
                        {añadido ? (
                          <Ionicons name="checkmark" size={18} color={tema.blue9?.val} />
                        ) : (
                          <Ionicons name="add" size={18} color={tema.color?.val} />
                        )}
                      </XStack>
                    </Pressable>
                  )
                })}
              </YStack>
            )}
          </ScrollView>

          <Button size="$3" borderWidth={1} borderColor="$borderColor" onPress={cerrar}>
            Cancelar
          </Button>
        </YStack>
      </YStack>
    </Modal>
  )
}

/** Chip de filtro reutilizable (grupos y equipamiento). */
function Chip({
  etiqueta,
  activo,
  onPress,
}: {
  etiqueta: string
  activo: boolean
  onPress: () => void
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={etiqueta}>
      <XStack
        paddingHorizontal="$3"
        paddingVertical="$1.5"
        borderRadius="$10"
        borderWidth={1}
        borderColor={activo ? '$blue8' : '$borderColor'}
        backgroundColor={activo ? '$blue2' : '$gray2'}
      >
        <Text fontSize="$2" fontWeight={activo ? '600' : '400'} color={activo ? '$blue11' : '$gray11'}>
          {etiqueta}
        </Text>
      </XStack>
    </Pressable>
  )
}

// ─── Fila de ejercicio dentro de un día ───────────────────────────────────────

interface FilaEjercicioProps {
  dia: DiaFormulario
  ejercicio: EjercicioFormulario
  /** Datos del catálogo para nombre/grupo (si el catálogo aún no llega, se muestra el ID). */
  datosEjercicio: Ejercicio | undefined
  /** Marca en rojo los campos inválidos tras un intento de guardado. */
  mostrarErrores: boolean
  ocupado: boolean
  onCambiar: (
    claveDia: string,
    claveEjercicio: string,
    campo: keyof EjercicioFormulario,
    valor: string,
  ) => void
  onQuitar: (clave: string) => void
}

/** Input numérico compacto con etiqueta; enrojece si el campo es inválido. */
function InputObjetivo({
  etiqueta,
  valor,
  invalido,
  ocupado,
  onChange,
}: {
  etiqueta: string
  valor: string
  invalido: boolean
  ocupado: boolean
  onChange: (texto: string) => void
}) {
  const tema = useTheme()
  return (
    <YStack flex={1} gap="$0.5">
      <Label fontSize="$1" color="$gray10" numberOfLines={1}>
        {etiqueta}
      </Label>
      <Input
        keyboardType="numeric"
        value={valor}
        onChangeText={onChange}
        borderRadius="$3"
        padding="$2"
        fontSize="$2"
        disabled={ocupado}
        borderWidth={invalido ? 2 : 1}
        borderColor={invalido ? '$red8' : '$borderColor'}
        placeholderTextColor={tema.placeholderColor?.val}
      />
    </YStack>
  )
}

/** Ejercicio añadido a un día: objetivo editable (series/reps/peso/descanso). */
function FilaEjercicio({
  dia,
  ejercicio,
  datosEjercicio,
  mostrarErrores,
  ocupado,
  onCambiar,
  onQuitar,
}: FilaEjercicioProps) {
  const tema = useTheme()
  const invalidos = mostrarErrores ? camposInvalidos(ejercicio) : new Set<keyof EjercicioFormulario>()
  const esInvalido = (campo: keyof EjercicioFormulario) => invalidos.has(campo)

  return (
    <YStack
      borderWidth={1}
      borderColor="$borderColor"
      borderRadius="$3"
      padding="$2"
      gap="$2"
      backgroundColor="$gray1"
    >
      <XStack alignItems="center" gap="$2">
        <YStack flex={1} gap="$0.5">
          <Text fontSize="$3" fontWeight="600" color="$color" numberOfLines={1}>
            {datosEjercicio?.nombre ?? ejercicio.ejercicio_id}
          </Text>
          {datosEjercicio ? (
            <Text fontSize="$1" color="$gray10" numberOfLines={1}>
              {ETIQUETAS_GRUPO[datosEjercicio.grupo_muscular_primario]} ·{' '}
              {ETIQUETAS_EQUIPAMIENTO[datosEjercicio.equipamiento]}
            </Text>
          ) : null}
        </YStack>
        <Pressable
          disabled={ocupado}
          onPress={() => onQuitar(ejercicio.key)}
          accessibilityRole="button"
          accessibilityLabel={`Quitar ${
            datosEjercicio?.nombre ?? 'ejercicio'
          } del día ${dia.nombre_dia}`}
        >
          <Ionicons name="close-circle-outline" size={22} color={tema.red11?.val} />
        </Pressable>
      </XStack>

      <XStack gap="$2">
        <InputObjetivo
          etiqueta="Series"
          valor={ejercicio.series_objetivo}
          invalido={esInvalido('series_objetivo')}
          ocupado={ocupado}
          onChange={(texto) => onCambiar(dia.key, ejercicio.key, 'series_objetivo', texto)}
        />
        <InputObjetivo
          etiqueta="Reps min"
          valor={ejercicio.reps_objetivo_min}
          invalido={esInvalido('reps_objetivo_min')}
          ocupado={ocupado}
          onChange={(texto) => onCambiar(dia.key, ejercicio.key, 'reps_objetivo_min', texto)}
        />
        <InputObjetivo
          etiqueta="Reps max"
          valor={ejercicio.reps_objetivo_max}
          invalido={esInvalido('reps_objetivo_max')}
          ocupado={ocupado}
          onChange={(texto) => onCambiar(dia.key, ejercicio.key, 'reps_objetivo_max', texto)}
        />
      </XStack>
      <XStack gap="$2">
        <InputObjetivo
          etiqueta="Peso (kg, opcional)"
          valor={ejercicio.peso_objetivo}
          invalido={esInvalido('peso_objetivo')}
          ocupado={ocupado}
          onChange={(texto) => onCambiar(dia.key, ejercicio.key, 'peso_objetivo', texto)}
        />
        <InputObjetivo
          etiqueta="Descanso (s, opcional)"
          valor={ejercicio.descanso_segundos}
          invalido={esInvalido('descanso_segundos')}
          ocupado={ocupado}
          onChange={(texto) => onCambiar(dia.key, ejercicio.key, 'descanso_segundos', texto)}
        />
      </XStack>
    </YStack>
  )
}

// ─── Tarjeta de día ───────────────────────────────────────────────────────────

interface TarjetaDiaProps {
  dia: DiaFormulario
  orden: number
  catalogo: Ejercicio[]
  mostrarErrores: boolean
  ocupado: boolean
  onCambiarDia: (clave: string, campo: 'nombre_dia' | 'notas', valor: string) => void
  onCambiarEjercicio: (
    claveDia: string,
    claveEjercicio: string,
    campo: keyof EjercicioFormulario,
    valor: string,
  ) => void
  onQuitarDia: (clave: string) => void
  onQuitarEjercicio: (claveDia: string, claveEjercicio: string) => void
  onAnadirEjercicio: (claveDia: string) => void
}

/** Día de la rutina: nombre, notas y ejercicios con sus objetivos. */
function TarjetaDia({
  dia,
  orden,
  catalogo,
  mostrarErrores,
  ocupado,
  onCambiarDia,
  onCambiarEjercicio,
  onQuitarDia,
  onQuitarEjercicio,
  onAnadirEjercicio,
}: TarjetaDiaProps) {
  const tema = useTheme()
  const ejerciciosPorId = useMemo(
    () => new Map(catalogo.map((ejercicio) => [ejercicio.id, ejercicio])),
    [catalogo],
  )
  const nombreDiaVacio = mostrarErrores && dia.nombre_dia.trim() === ''
  const diaSinEjercicios = mostrarErrores && dia.ejercicios.length === 0

  return (
    <Card size="$4" borderWidth={1} borderColor="$borderColor" padding="$3" gap="$3">
      <XStack alignItems="center" justifyContent="space-between" gap="$2">
        <Text fontSize="$2" fontWeight="bold" color="$gray10" textTransform="uppercase">
          Día {orden}
        </Text>
        <Pressable
          disabled={ocupado}
          onPress={() => onQuitarDia(dia.key)}
          accessibilityRole="button"
          accessibilityLabel={`Eliminar ${dia.nombre_dia}`}
        >
          <Ionicons name="trash-outline" size={18} color={tema.red11?.val} />
        </Pressable>
      </XStack>

      <YStack gap="$1">
        <Label fontSize="$2" color="$gray10">
          Nombre del día
        </Label>
        <Input
          value={dia.nombre_dia}
          onChangeText={(texto) => onCambiarDia(dia.key, 'nombre_dia', texto)}
          placeholder="Ej. Tren Superior - Empuje"
          placeholderTextColor={tema.placeholderColor?.val}
          borderRadius="$3"
          padding="$2"
          disabled={ocupado}
          borderWidth={nombreDiaVacio ? 2 : 1}
          borderColor={nombreDiaVacio ? '$red8' : '$borderColor'}
        />
      </YStack>

      <YStack gap="$1">
        <Label fontSize="$2" color="$gray10">
          Notas (opcional)
        </Label>
        <TextArea
          value={dia.notas}
          onChangeText={(texto) => onCambiarDia(dia.key, 'notas', texto)}
          placeholder="Pauta, intensidad, superset…"
          placeholderTextColor={tema.placeholderColor?.val}
          borderRadius="$3"
          padding="$2"
          numberOfLines={2}
          disabled={ocupado}
        />
      </YStack>

      <YStack gap="$2">
        {dia.ejercicios.length === 0 ? (
          <Text
            fontSize="$2"
            color={diaSinEjercicios ? '$red11' : '$gray9'}
            textAlign="center"
            paddingVertical="$2"
          >
            {diaSinEjercicios
              ? 'Este día no tiene ejercicios: añade al menos uno.'
              : 'Sin ejercicios todavía.'}
          </Text>
        ) : (
          dia.ejercicios.map((ejercicio) => (
            <FilaEjercicio
              key={ejercicio.key}
              dia={dia}
              ejercicio={ejercicio}
              datosEjercicio={ejerciciosPorId.get(ejercicio.ejercicio_id)}
              mostrarErrores={mostrarErrores}
              ocupado={ocupado}
              onCambiar={onCambiarEjercicio}
              onQuitar={(clave) => onQuitarEjercicio(dia.key, clave)}
            />
          ))
        )}
      </YStack>

      <Button
        size="$3"
        borderWidth={1}
        borderColor="$borderColor"
        borderStyle="dashed"
        color="$color"
        disabled={ocupado}
        icon={<Ionicons name="add" size={16} color={tema.color?.val} />}
        onPress={() => onAnadirEjercicio(dia.key)}
        aria-label={`Añadir ejercicio a ${dia.nombre_dia}`}
      >
        Añadir ejercicio
      </Button>
    </Card>
  )
}

// ─── Pantalla ─────────────────────────────────────────────────────────────────

/** Regresa a la pestaña de Rutinas (back si hay historial, navegar si no). */
function volverARutinas() {
  if (router.canGoBack()) {
    router.back()
  } else {
    router.navigate('/rutinas')
  }
}

/**
 * Pantalla dedicada de creación completa de rutinas: datos generales, días
 * (nombre + notas) y ejercicios del catálogo con series/reps/peso/descanso.
 * Reutiliza `crearRutinaNueva` (store de rutinas) y el catálogo de
 * `useEjerciciosStore`; la persistencia real la hace `crearRutina()` en BD.
 */
export default function NuevaRutinaScreen() {
  const usuario = useConfiguracionStore((s) => s.usuarioActivo)

  const catalogo = useEjerciciosStore((s) => s.ejercicios)
  const cargandoCatalogo = useEjerciciosStore((s) => s.cargando)
  const errorCatalogo = useEjerciciosStore((s) => s.error)
  const cargarEjercicios = useEjerciciosStore((s) => s.cargarEjercicios)
  const limpiarErrorCatalogo = useEjerciciosStore((s) => s.limpiarError)

  const cargandoGuardar = useRutinasStore((s) => s.cargando)
  const errorGuardar = useRutinasStore((s) => s.error)
  const crearRutinaNueva = useRutinasStore((s) => s.crearRutinaNueva)

  const tema = useTheme()
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [dias, setDias] = useState<DiaFormulario[]>([crearDiaFormulario(1)])
  const [diaSelector, setDiaSelector] = useState<string | null>(null)
  /** Tras el primer intento de guardado se marcan los campos inválidos. */
  const [intentadoGuardar, setIntentadoGuardar] = useState(false)
  const [errorValidacion, setErrorValidacion] = useState<string | null>(null)

  // El catálogo alimenta el selector de ejercicios (idempotente).
  useEffect(() => {
    void cargarEjercicios()
  }, [cargarEjercicios])

  const ocupado = cargandoGuardar

  const cambiarDia = (clave: string, campo: 'nombre_dia' | 'notas', valor: string) => {
    setDias((diasActuales) =>
      diasActuales.map((dia) => (dia.key === clave ? { ...dia, [campo]: valor } : dia)),
    )
  }

  const cambiarEjercicio = (
    claveDia: string,
    claveEjercicio: string,
    campo: keyof EjercicioFormulario,
    valor: string,
  ) => {
    setDias((diasActuales) =>
      diasActuales.map((dia) =>
        dia.key === claveDia
          ? {
              ...dia,
              ejercicios: dia.ejercicios.map((ejercicio) =>
                ejercicio.key === claveEjercicio
                  ? { ...ejercicio, [campo]: valor }
                  : ejercicio,
              ),
            }
          : dia,
      ),
    )
  }

  const anadirDia = () => {
    setDias((diasActuales) => [...diasActuales, crearDiaFormulario(diasActuales.length + 1)])
  }

  const quitarDia = (clave: string) => {
    setDias((diasActuales) => diasActuales.filter((dia) => dia.key !== clave))
  }

  const anadirEjercicio = (claveDia: string, ejercicio: Ejercicio) => {
    setDias((diasActuales) =>
      diasActuales.map((dia) =>
        dia.key === claveDia
          ? { ...dia, ejercicios: [...dia.ejercicios, crearEjercicioFormulario(ejercicio)] }
          : dia,
      ),
    )
  }

  const quitarEjercicio = (claveDia: string, claveEjercicio: string) => {
    setDias((diasActuales) =>
      diasActuales.map((dia) =>
        dia.key === claveDia
          ? { ...dia, ejercicios: dia.ejercicios.filter((e) => e.key !== claveEjercicio) }
          : dia,
      ),
    )
  }

  /** Valida el formulario; devuelve la `NuevaRutina` o null con el error seteado. */
  const construirNuevaRutina = (): NuevaRutina | null => {
    if (nombre.trim() === '') {
      setErrorValidacion('Ponle un nombre a la rutina.')
      return null
    }
    if (dias.length === 0) {
      setErrorValidacion('Añade al menos un día a la rutina.')
      return null
    }
    for (const dia of dias) {
      if (dia.nombre_dia.trim() === '') {
        setErrorValidacion('Ponle nombre a todos los días.')
        return null
      }
      if (dia.ejercicios.length === 0) {
        setErrorValidacion(`El día «${dia.nombre_dia.trim()}» no tiene ejercicios.`)
        return null
      }
      for (const ejercicio of dia.ejercicios) {
        const invalidos = camposInvalidos(ejercicio)
        if (invalidos.size > 0) {
          const nombreEjercicio =
            catalogo.find((e) => e.id === ejercicio.ejercicio_id)?.nombre ??
            ejercicio.ejercicio_id
          setErrorValidacion(
            `Revisa los objetivos de «${nombreEjercicio}» en el día «${dia.nombre_dia.trim()}».`,
          )
          return null
        }
      }
    }

    return {
      usuario_id: usuario?.id ?? null,
      nombre: nombre.trim(),
      descripcion: descripcion.trim(),
      dias: dias.map((dia) => ({
        nombre_dia: dia.nombre_dia.trim(),
        notas: dia.notas.trim() === '' ? null : dia.notas.trim(),
        ejercicios: dia.ejercicios.map((ejercicio, orden) => ({
          ejercicio_id: ejercicio.ejercicio_id,
          orden: orden + 1,
          series_objetivo: aEntero(ejercicio.series_objetivo)!,
          reps_objetivo_min: aEntero(ejercicio.reps_objetivo_min)!,
          reps_objetivo_max: aEntero(ejercicio.reps_objetivo_max)!,
          peso_objetivo:
            ejercicio.peso_objetivo.trim() === '' ? null : aDecimal(ejercicio.peso_objetivo),
          descanso_segundos:
            ejercicio.descanso_segundos.trim() === ''
              ? null
              : aEntero(ejercicio.descanso_segundos),
        })),
      })),
    }
  }

  const guardar = async () => {
    setIntentadoGuardar(true)
    const rutina = construirNuevaRutina()
    if (!rutina) {
      return
    }
    setErrorValidacion(null)
    const creada = await crearRutinaNueva(rutina)
    if (creada) {
      volverARutinas()
    }
  }

  const reintentarCatalogo = () => {
    limpiarErrorCatalogo()
    void cargarEjercicios()
  }

  const diaSeleccionado = dias.find((dia) => dia.key === diaSelector) ?? null
  const idsYaAñadidos = useMemo(
    () =>
      new Set(
        diaSeleccionado?.ejercicios.map((ejercicio) => ejercicio.ejercicio_id) ?? [],
      ),
    [diaSeleccionado],
  )

  const error = errorCatalogo ?? errorGuardar

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
        {errorCatalogo ? (
          <Button size="$2" borderColor="$red8" onPress={reintentarCatalogo}>
            Reintentar
          </Button>
        ) : null}
      </XStack>
    </Card>
  ) : null

  // Sin catálogo no se pueden añadir ejercicios: pantalla de carga dedicada.
  if (cargandoCatalogo && catalogo.length === 0) {
    return (
      <YStack
        flex={1}
        backgroundColor="$background"
        justifyContent="center"
        alignItems="center"
        gap="$4"
      >
        <Spinner size="large" color="$color" />
        <Text color="$gray10">Cargando el catálogo de ejercicios…</Text>
      </YStack>
    )
  }

  return (
    <YStack flex={1} backgroundColor="$background">
      {/* Cabecera propia (headerShown: false): flecha atrás + título. */}
      <XStack padding="$4" paddingBottom="$2" alignItems="center" gap="$3">
        <Pressable
          onPress={volverARutinas}
          accessibilityRole="button"
          accessibilityLabel="Volver a rutinas"
        >
          <Ionicons name="arrow-back" size={24} color={tema.color?.val} />
        </Pressable>
        <Text fontSize="$6" fontWeight="bold" color="$color">
          Nueva rutina
        </Text>
      </XStack>

      <YStack padding="$4" paddingBottom="$2">
        {bannerError}
      </YStack>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView flex={1}>
          <YStack padding="$4" paddingTop="$2" paddingBottom="$5" gap="$3">
            <Card size="$4" borderWidth={1} borderColor="$borderColor" padding="$3" gap="$2">
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
                  disabled={ocupado}
                  borderWidth={intentadoGuardar && nombre.trim() === '' ? 2 : 1}
                  borderColor={intentadoGuardar && nombre.trim() === '' ? '$red8' : '$borderColor'}
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
                  numberOfLines={2}
                  disabled={ocupado}
                />
              </YStack>
            </Card>

            {dias.map((dia, indice) => (
              <TarjetaDia
                key={dia.key}
                dia={dia}
                orden={indice + 1}
                catalogo={catalogo}
                mostrarErrores={intentadoGuardar}
                ocupado={ocupado}
                onCambiarDia={cambiarDia}
                onCambiarEjercicio={(claveDia, claveEjercicio, campo, valor) =>
                  cambiarEjercicio(claveDia, claveEjercicio, campo, valor)
                }
                onQuitarDia={quitarDia}
                onQuitarEjercicio={quitarEjercicio}
                onAnadirEjercicio={setDiaSelector}
              />
            ))}

            <Button
              size="$4"
              borderWidth={1}
              borderColor="$borderColor"
              color="$color"
              disabled={ocupado}
              icon={<Ionicons name="add" size={18} color={tema.color?.val} />}
              onPress={anadirDia}
              aria-label="Añadir día"
            >
              Añadir día
            </Button>

            {errorValidacion ? (
              <Text fontSize="$2" color="$red11" textAlign="center">
                {errorValidacion}
              </Text>
            ) : null}
          </YStack>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Pie fijo con la acción principal, fuera del scroll. */}
      <YStack padding="$4" paddingTop="$2" borderTopWidth={1} borderTopColor="$borderColor">
        <Button
          size="$4"
          backgroundColor="$gray12"
          color="$gray1"
          fontWeight="bold"
          pressStyle={{ opacity: 0.85 }}
          disabled={ocupado}
          icon={ocupado ? undefined : <Ionicons name="checkmark-circle" size={18} color={tema.gray1?.val} />}
          onPress={() => void guardar()}
        >
          {ocupado ? 'Guardando…' : 'Guardar rutina'}
        </Button>
      </YStack>

      <SelectorEjercicioModal
        visible={diaSelector !== null}
        catalogo={catalogo}
        yaAñadidos={idsYaAñadidos}
        onCerrar={() => setDiaSelector(null)}
        onSeleccionar={(ejercicio) => {
          if (diaSeleccionado) {
            anadirEjercicio(diaSeleccionado.key, ejercicio)
          }
        }}
      />
    </YStack>
  )
}
