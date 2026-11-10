import { Ionicons } from '@expo/vector-icons'
import React, { useMemo, useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable } from 'react-native'
import {
  Button,
  Card,
  Input,
  Label,
  ScrollView,
  Spinner,
  Text,
  useTheme,
  XStack,
  YStack,
} from 'tamagui'

import {
  NIVELES,
  OBJETIVOS,
  SEXOS,
  type Nivel,
  type Objetivo,
  type Sexo,
} from '../../domain/types'
import type { DatosPerfil } from '../../store/configuracion.store'
import { validarFormularioPerfil, type BorradorPerfil, type ErroresPerfil } from '../../utils/perfil'
import { CampoFechaNacimiento } from './CampoFechaNacimiento'

/** Etiquetas legibles para `Objetivo`. */
export const ETIQUETAS_OBJETIVO: Record<Objetivo, string> = {
  hipertrofia: 'Hipertrofia',
  fuerza: 'Fuerza',
  resistencia: 'Resistencia',
  perdida_grasa: 'Pérdida de grasa',
}

/** Etiquetas legibles para `Nivel`. */
export const ETIQUETAS_NIVEL: Record<Nivel, string> = {
  principiante: 'Principiante',
  intermedio: 'Intermedio',
  avanzado: 'Avanzado',
}

/** Etiquetas legibles para `Sexo`. */
export const ETIQUETAS_SEXO: Record<Sexo, string> = {
  masculino: 'Masculino',
  femenino: 'Femenino',
  otro: 'Otro',
}

export interface FormularioPerfilProps {
  /** Bloque superior (cabecera de bienvenida en onboarding o barra con volver en edición). */
  encabezado?: React.ReactNode
  /** Texto del botón principal de acción. */
  textoBotonGuardar: string
  /** Valores iniciales precargados cuando se edita un perfil existente. */
  valoresIniciales?: Partial<DatosPerfil>
  /** Indica si se está persistiendo el perfil en la base de datos. */
  guardando: boolean
  /** Error de persistencia procedente del store. */
  error?: string | null
  /** Callback asíncrono invocado únicamente cuando todos los campos son válidos. */
  onGuardar: (datos: DatosPerfil) => Promise<void>
}

interface ChipOpcionProps {
  etiqueta: string
  descripcionAccesible: string
  activo: boolean
  deshabilitado: boolean
  onPress: () => void
}

/** Chip seleccionable/deseleccionable con soporte de tema claro/oscuro y accesibilidad. */
function ChipOpcion({
  etiqueta,
  descripcionAccesible,
  activo,
  deshabilitado,
  onPress,
}: ChipOpcionProps) {
  return (
    <Pressable
      disabled={deshabilitado}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: activo, disabled: deshabilitado }}
      accessibilityLabel={`${descripcionAccesible}${activo ? ' (seleccionado)' : ''}`}
      aria-label={descripcionAccesible}
    >
      <XStack
        paddingHorizontal="$3.5"
        paddingVertical="$2"
        borderRadius="$10"
        borderWidth={1}
        borderColor={activo ? '$blue8' : '$borderColor'}
        backgroundColor={activo ? '$blue2' : '$gray2'}
        opacity={deshabilitado ? 0.6 : 1}
      >
        <Text
          fontSize="$3"
          fontWeight={activo ? '600' : '400'}
          color={activo ? '$blue11' : '$gray11'}
        >
          {etiqueta}
        </Text>
      </XStack>
    </Pressable>
  )
}

/**
 * Formulario reutilizable de creación (onboarding de primer uso) y edición de
 * perfil de usuario. Gestiona validación inline por campo, teclado en iOS y
 * estados de guardado y error con reintento.
 */
export function FormularioPerfil({
  encabezado,
  textoBotonGuardar,
  valoresIniciales,
  guardando,
  error,
  onGuardar,
}: FormularioPerfilProps) {
  const tema = useTheme()

  const [nombre, setNombre] = useState<string>(valoresIniciales?.nombre ?? '')
  const [fechaNacimiento, setFechaNacimiento] = useState<string>(
    valoresIniciales?.fecha_nacimiento ?? '',
  )
  const [sexo, setSexo] = useState<Sexo | null>(valoresIniciales?.sexo ?? null)
  const [pesoInicial, setPesoInicial] = useState<string>(
    valoresIniciales?.peso_inicial != null ? String(valoresIniciales.peso_inicial) : '',
  )
  const [objetivo, setObjetivo] = useState<Objetivo | null>(valoresIniciales?.objetivo ?? null)
  const [nivel, setNivel] = useState<Nivel | null>(valoresIniciales?.nivel ?? null)

  const [intentadoGuardar, setIntentadoGuardar] = useState(false)
  const [camposTocados, setCamposTocados] = useState<
    Partial<Record<keyof BorradorPerfil, boolean>>
  >({})

  const validacion = useMemo(
    () =>
      validarFormularioPerfil({
        nombre,
        fecha_nacimiento: fechaNacimiento,
        sexo,
        peso_inicial: pesoInicial,
        objetivo,
        nivel,
      }),
    [nombre, fechaNacimiento, sexo, pesoInicial, objetivo, nivel],
  )

  const marcarTocado = (campo: keyof BorradorPerfil) => {
    setCamposTocados((previo) => (previo[campo] ? previo : { ...previo, [campo]: true }))
  }

  const obtenerErrorCampo = (campo: keyof ErroresPerfil): string | undefined => {
    if (!intentadoGuardar && !camposTocados[campo]) {
      return undefined
    }
    return validacion.errores[campo]
  }

  const errorNombre = obtenerErrorCampo('nombre')
  const errorFecha = obtenerErrorCampo('fecha_nacimiento')
  const errorPeso = obtenerErrorCampo('peso_inicial')

  const enviar = async () => {
    setIntentadoGuardar(true)
    const resultado = validarFormularioPerfil({
      nombre,
      fecha_nacimiento: fechaNacimiento,
      sexo,
      peso_inicial: pesoInicial,
      objetivo,
      nivel,
    })
    if (!resultado.valido) {
      return
    }
    await onGuardar(resultado.datos)
  }

  return (
    <YStack flex={1} backgroundColor="$background">
      {encabezado}

      {error ? (
        <YStack paddingHorizontal="$4" paddingTop="$2">
          <Card size="$4" backgroundColor="$red5" borderWidth={1} borderColor="$red8" padding="$3">
            <XStack gap="$2" alignItems="center" justifyContent="space-between">
              <YStack flex={1} gap="$1">
                <Text fontWeight="600" color="$red11">
                  No se pudo guardar el perfil
                </Text>
                <Text fontSize="$2" color="$red10" numberOfLines={3}>
                  {error}
                </Text>
              </YStack>
              <Button
                size="$2"
                borderColor="$red8"
                disabled={guardando}
                onPress={() => void enviar()}
                accessibilityLabel="Reintentar guardar perfil"
                aria-label="Reintentar guardar perfil"
              >
                Reintentar
              </Button>
            </XStack>
          </Card>
        </YStack>
      ) : null}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView flex={1} keyboardShouldPersistTaps="handled">
          <YStack padding="$4" paddingBottom="$6" gap="$4">
            {/* ── Datos personales ──────────────────────────────────── */}
            <Card size="$4" borderWidth={1} borderColor="$borderColor" padding="$4" gap="$3">
              <Text fontSize="$4" fontWeight="bold" color="$color">
                Datos personales
              </Text>

              <YStack gap="$1.5">
                <Label fontSize="$2" color="$gray11">
                  Nombre *
                </Label>
                <Input
                  value={nombre}
                  onChangeText={setNombre}
                  onBlur={() => marcarTocado('nombre')}
                  placeholder="Ej. Ana García"
                  placeholderTextColor={tema.placeholderColor?.val}
                  borderRadius="$3"
                  padding="$2.5"
                  disabled={guardando}
                  borderWidth={errorNombre ? 2 : 1}
                  borderColor={errorNombre ? '$red8' : '$borderColor'}
                  accessibilityLabel="Nombre"
                  aria-label="Nombre"
                />
                {errorNombre ? (
                  <Text fontSize="$2" color="$red11">
                    {errorNombre}
                  </Text>
                ) : null}
              </YStack>

              <YStack gap="$1.5">
                <Label fontSize="$2" color="$gray11">
                  Fecha de nacimiento (opcional)
                </Label>
                <CampoFechaNacimiento
                  valor={fechaNacimiento}
                  onChange={(nuevaFecha) => {
                    setFechaNacimiento(nuevaFecha)
                    marcarTocado('fecha_nacimiento')
                  }}
                  onBlur={() => marcarTocado('fecha_nacimiento')}
                  deshabilitado={guardando}
                  error={errorFecha}
                />
                {errorFecha ? (
                  <Text fontSize="$2" color="$red11">
                    {errorFecha}
                  </Text>
                ) : (
                  <Text fontSize="$1" color="$gray10">
                    Selecciona tu fecha en el calendario (no posterior a hoy).
                  </Text>
                )}
              </YStack>

              <YStack gap="$1.5">
                <Label fontSize="$2" color="$gray11">
                  Sexo (opcional)
                </Label>
                <XStack gap="$2" flexWrap="wrap">
                  {SEXOS.map((opcion) => (
                    <ChipOpcion
                      key={opcion}
                      etiqueta={ETIQUETAS_SEXO[opcion]}
                      descripcionAccesible={`Sexo: ${ETIQUETAS_SEXO[opcion]}`}
                      activo={sexo === opcion}
                      deshabilitado={guardando}
                      onPress={() => setSexo(sexo === opcion ? null : opcion)}
                    />
                  ))}
                </XStack>
              </YStack>

              <YStack gap="$1.5">
                <Label fontSize="$2" color="$gray11">
                  Peso inicial en kg (opcional)
                </Label>
                <Input
                  value={pesoInicial}
                  onChangeText={setPesoInicial}
                  onBlur={() => marcarTocado('peso_inicial')}
                  keyboardType="numeric"
                  placeholder="Ej. 72,5"
                  placeholderTextColor={tema.placeholderColor?.val}
                  borderRadius="$3"
                  padding="$2.5"
                  disabled={guardando}
                  borderWidth={errorPeso ? 2 : 1}
                  borderColor={errorPeso ? '$red8' : '$borderColor'}
                  accessibilityLabel="Peso inicial en kilogramos"
                  aria-label="Peso inicial en kilogramos"
                />
                {errorPeso ? (
                  <Text fontSize="$2" color="$red11">
                    {errorPeso}
                  </Text>
                ) : null}
              </YStack>
            </Card>

            {/* ── Perfil de entrenamiento ───────────────────────────── */}
            <Card size="$4" borderWidth={1} borderColor="$borderColor" padding="$4" gap="$3">
              <Text fontSize="$4" fontWeight="bold" color="$color">
                Perfil de entrenamiento
              </Text>

              <YStack gap="$1.5">
                <Label fontSize="$2" color="$gray11">
                  Objetivo principal
                </Label>
                <XStack gap="$2" flexWrap="wrap">
                  {OBJETIVOS.map((opcion) => (
                    <ChipOpcion
                      key={opcion}
                      etiqueta={ETIQUETAS_OBJETIVO[opcion]}
                      descripcionAccesible={`Objetivo: ${ETIQUETAS_OBJETIVO[opcion]}`}
                      activo={objetivo === opcion}
                      deshabilitado={guardando}
                      onPress={() => setObjetivo(objetivo === opcion ? null : opcion)}
                    />
                  ))}
                </XStack>
              </YStack>

              <YStack gap="$1.5">
                <Label fontSize="$2" color="$gray11">
                  Nivel de experiencia
                </Label>
                <XStack gap="$2" flexWrap="wrap">
                  {NIVELES.map((opcion) => (
                    <ChipOpcion
                      key={opcion}
                      etiqueta={ETIQUETAS_NIVEL[opcion]}
                      descripcionAccesible={`Nivel: ${ETIQUETAS_NIVEL[opcion]}`}
                      activo={nivel === opcion}
                      deshabilitado={guardando}
                      onPress={() => setNivel(nivel === opcion ? null : opcion)}
                    />
                  ))}
                </XStack>
              </YStack>
            </Card>
          </YStack>
        </ScrollView>
      </KeyboardAvoidingView>

      <YStack
        padding="$4"
        paddingTop="$2"
        borderTopWidth={1}
        borderTopColor="$borderColor"
        backgroundColor="$background"
      >
        <Button
          size="$4"
          backgroundColor="$gray12"
          color="$gray1"
          fontWeight="bold"
          pressStyle={{ opacity: 0.85 }}
          disabled={guardando}
          icon={
            guardando ? (
              <Spinner size="small" color="$gray1" />
            ) : (
              <Ionicons name="checkmark-circle" size={18} color={tema.gray1?.val} />
            )
          }
          onPress={() => void enviar()}
          accessibilityLabel={textoBotonGuardar}
          aria-label={textoBotonGuardar}
        >
          {guardando ? 'Guardando…' : textoBotonGuardar}
        </Button>
      </YStack>
    </YStack>
  )
}
