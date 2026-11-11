import { Ionicons } from '@expo/vector-icons'
import React, { useMemo, useState } from 'react'
import { Modal, Pressable } from 'react-native'
import { Button, Card, ScrollView, Text, useTheme, XStack, YStack } from 'tamagui'

import {
  construirFechaISO,
  desglosarFechaISO,
  DIAS_SEMANA_ABREV,
  fechaLocalISO,
  formatearFechaLegible,
  MESES_ANIO,
  obtenerDiasDelMes,
  obtenerPrimerDiaSemana,
} from '../../utils/perfil'

export interface CampoFechaNacimientoProps {
  /** Valor en formato AAAA-MM-DD o cadena vacía. */
  valor: string
  /** Notifica la fecha seleccionada en formato AAAA-MM-DD o vacía. */
  onChange: (fecha: string) => void
  /** Notifica cuando el control pierde el foco o se cierra. */
  onBlur?: () => void
  /** Deshabilita la interacción durante el guardado. */
  deshabilitado?: boolean
  /** Mensaje de error para destacar el borde. */
  error?: string
  /** Fecha máxima permitida (por defecto la fecha local de hoy). */
  hoyISO?: string
}

type VistaSelector = 'calendario' | 'meses' | 'anios'

export function CampoFechaNacimiento({
  valor,
  onChange,
  onBlur,
  deshabilitado = false,
  error,
  hoyISO = fechaLocalISO(),
}: CampoFechaNacimientoProps) {
  const tema = useTheme()
  const [modalAbierto, setModalAbierto] = useState(false)
  const [vista, setVista] = useState<VistaSelector>('calendario')

  // Año de anclaje inicial para el selector cuando el valor está vacío (25 años atrás o 2000)
  const anioActual = useMemo(() => Number(hoyISO.split('-')[0]), [hoyISO])
  const anioDefecto = useMemo(() => Math.max(1920, anioActual - 25), [anioActual])

  // Estado temporal de selección dentro del modal
  const [anioTemp, setAnioTemp] = useState<number>(() => desglosarFechaISO(valor, anioDefecto).anio)
  const [mesTemp, setMesTemp] = useState<number>(() => desglosarFechaISO(valor, anioDefecto).mes)
  const [diaTemp, setDiaTemp] = useState<number>(() => desglosarFechaISO(valor, anioDefecto).dia)

  const abrirModal = () => {
    if (deshabilitado) return
    const desglosada = desglosarFechaISO(valor, anioDefecto)
    setAnioTemp(desglosada.anio)
    setMesTemp(desglosada.mes)
    setDiaTemp(desglosada.dia)
    setVista('calendario')
    setModalAbierto(true)
  }

  const cerrarModal = () => {
    setModalAbierto(false)
    setVista('calendario')
    onBlur?.()
  }

  const confirmarSeleccion = () => {
    const fechaResultado = construirFechaISO(anioTemp, mesTemp, diaTemp)
    onChange(fechaResultado)
    cerrarModal()
  }

  const limpiarFecha = () => {
    onChange('')
    cerrarModal()
  }

  // Lista de años disponibles (desde el año actual descendente hasta 1920)
  const aniosDisponibles = useMemo(() => {
    const lista: number[] = []
    for (let a = anioActual; a >= 1920; a--) {
      lista.push(a)
    }
    return lista
  }, [anioActual])

  // Días del mes y espacios de inicio de la semana
  const diasEnMes = useMemo(() => obtenerDiasDelMes(anioTemp, mesTemp), [anioTemp, mesTemp])
  const espaciosInicio = useMemo(
    () => obtenerPrimerDiaSemana(anioTemp, mesTemp),
    [anioTemp, mesTemp],
  )

  const navegarMes = (delta: number) => {
    let nuevoMes = mesTemp + delta
    let nuevoAnio = anioTemp
    if (nuevoMes > 12) {
      nuevoMes = 1
      nuevoAnio++
    } else if (nuevoMes < 1) {
      nuevoMes = 12
      nuevoAnio--
    }
    // No permitir navegar más allá del año/mes actual
    const isoCandidato = construirFechaISO(nuevoAnio, nuevoMes, 1)
    if (isoCandidato.slice(0, 7) > hoyISO.slice(0, 7)) {
      return
    }
    setAnioTemp(nuevoAnio)
    setMesTemp(nuevoMes)
    // Ajustar el día si el mes destino tiene menos días
    const maxDias = obtenerDiasDelMes(nuevoAnio, nuevoMes)
    if (diaTemp > maxDias) {
      setDiaTemp(maxDias)
    }
  }

  const fechaTempISO = construirFechaISO(anioTemp, mesTemp, diaTemp)
  const esFechaTempFutura = fechaTempISO > hoyISO

  const textoFechaLegible = valor ? formatearFechaLegible(valor) : ''

  return (
    <YStack gap="$1">
      {/* ── Control activador tipo input ───────────────────────────── */}
      <Pressable
        onPress={abrirModal}
        disabled={deshabilitado}
        accessibilityRole="button"
        accessibilityLabel={
          valor
            ? `Fecha de nacimiento seleccionada: ${textoFechaLegible || valor}. Presiona para cambiar.`
            : 'Seleccionar fecha de nacimiento en el calendario'
        }
      >
        <XStack
          alignItems="center"
          justifyContent="space-between"
          backgroundColor="$background"
          borderWidth={error ? 2 : 1}
          borderColor={error ? '$red8' : '$borderColor'}
          borderRadius="$3"
          paddingVertical="$2.5"
          paddingHorizontal="$3"
          opacity={deshabilitado ? 0.6 : 1}
        >
          <XStack alignItems="center" gap="$2.5" flex={1}>
            <Ionicons name="calendar-outline" size={18} color={tema.color?.val} />
            {valor ? (
              <YStack flex={1}>
                <Text fontSize="$3" color="$color" fontWeight="500">
                  {textoFechaLegible || valor}
                </Text>
                {textoFechaLegible ? (
                  <Text fontSize="$1" color="$gray10">
                    {valor}
                  </Text>
                ) : null}
              </YStack>
            ) : (
              <Text fontSize="$3" color="$gray9">
                Selecciona tu fecha en el calendario
              </Text>
            )}
          </XStack>

          {valor && !deshabilitado ? (
            <Pressable
              onPress={(e) => {
                e.stopPropagation?.()
                onChange('')
                onBlur?.()
              }}
              accessibilityLabel="Borrar fecha de nacimiento"
              hitSlop={8}
            >
              <Ionicons name="close-circle" size={18} color={tema.placeholderColor?.val} />
            </Pressable>
          ) : (
            <Ionicons name="chevron-down" size={16} color={tema.placeholderColor?.val} />
          )}
        </XStack>
      </Pressable>

      {/* ── Modal de selección de fecha ────────────────────────────── */}
      <Modal
        visible={modalAbierto}
        transparent={true}
        animationType="fade"
        onRequestClose={cerrarModal}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 16,
          }}
          onPress={cerrarModal}
        >
          {/* Tarjeta del calendario (evita que el tap cierre el modal) */}
          <Pressable onPress={(e) => e.stopPropagation?.()} style={{ width: '100%', maxWidth: 360 }}>
            <Card
              size="$4"
              backgroundColor="$background"
              borderWidth={1}
              borderColor="$borderColor"
              borderRadius="$4"
              padding="$4"
              gap="$3"
            >
              {/* Encabezado del modal */}
              <YStack gap="$1" borderBottomWidth={1} borderBottomColor="$borderColor" paddingBottom="$2.5">
                <Text fontSize="$2" fontWeight="600" color="$gray10" textTransform="uppercase">
                  Fecha de nacimiento
                </Text>
                <Text fontSize="$4" fontWeight="bold" color="$color">
                  {formatearFechaLegible(fechaTempISO) || fechaTempISO}
                </Text>
              </YStack>

              {/* Botonera de cambio de vista: Mes / Año */}
              <XStack alignItems="center" justifyContent="space-between" gap="$2">
                <Button
                  size="$2"
                  circular
                  disabled={vista !== 'calendario'}
                  onPress={() => navegarMes(-1)}
                  accessibilityLabel="Mes anterior"
                >
                  <Ionicons name="chevron-back" size={16} color={tema.color?.val} />
                </Button>

                <XStack gap="$2" alignItems="center">
                  <Button
                    size="$2"
                    backgroundColor={vista === 'meses' ? '$blue5' : '$gray3'}
                    borderColor={vista === 'meses' ? '$blue8' : '$borderColor'}
                    onPress={() => setVista((v) => (v === 'meses' ? 'calendario' : 'meses'))}
                    accessibilityLabel={`Seleccionar mes. Actualmente ${MESES_ANIO[mesTemp - 1]}`}
                  >
                    <Text fontSize="$2" fontWeight="600" color={vista === 'meses' ? '$blue11' : '$color'}>
                      {MESES_ANIO[mesTemp - 1]}
                    </Text>
                  </Button>

                  <Button
                    size="$2"
                    backgroundColor={vista === 'anios' ? '$blue5' : '$gray3'}
                    borderColor={vista === 'anios' ? '$blue8' : '$borderColor'}
                    onPress={() => setVista((v) => (v === 'anios' ? 'calendario' : 'anios'))}
                    accessibilityLabel={`Seleccionar año. Actualmente ${anioTemp}`}
                  >
                    <Text fontSize="$2" fontWeight="600" color={vista === 'anios' ? '$blue11' : '$color'}>
                      {anioTemp}
                    </Text>
                  </Button>
                </XStack>

                <Button
                  size="$2"
                  circular
                  disabled={
                    vista !== 'calendario' ||
                    construirFechaISO(anioTemp, mesTemp, 1).slice(0, 7) >= hoyISO.slice(0, 7)
                  }
                  onPress={() => navegarMes(1)}
                  accessibilityLabel="Mes siguiente"
                >
                  <Ionicons name="chevron-forward" size={16} color={tema.color?.val} />
                </Button>
              </XStack>

              {/* ── Vista 1: Selector de Años ───────────────────────── */}
              {vista === 'anios' ? (
                <YStack height={260}>
                  <Text fontSize="$2" color="$gray10" marginBottom="$2">
                    Toca un año para seleccionarlo:
                  </Text>
                  <ScrollView flex={1} showsVerticalScrollIndicator={true}>
                    <XStack flexWrap="wrap" gap="$2" justifyContent="space-between">
                      {aniosDisponibles.map((a) => {
                        const seleccionado = a === anioTemp
                        return (
                          <Pressable
                            key={a}
                            onPress={() => {
                              setAnioTemp(a)
                              // Si en el nuevo año el mes/día supera hoy, ajustar
                              const fechaCand = construirFechaISO(a, mesTemp, diaTemp)
                              if (fechaCand > hoyISO) {
                                const [hoyA, hoyM, hoyD] = hoyISO.split('-').map(Number)
                                setMesTemp(hoyM)
                                setDiaTemp(hoyD)
                              }
                              setVista('calendario')
                            }}
                            style={{ width: '23%', marginVertical: 3 }}
                            accessibilityRole="button"
                            accessibilityLabel={`Año ${a}`}
                          >
                            <Card
                              paddingVertical="$2"
                              alignItems="center"
                              backgroundColor={seleccionado ? '$blue9' : '$gray3'}
                              borderWidth={1}
                              borderColor={seleccionado ? '$blue10' : '$borderColor'}
                              borderRadius="$2"
                            >
                              <Text
                                fontSize="$2"
                                fontWeight={seleccionado ? 'bold' : 'normal'}
                                color={seleccionado ? 'white' : '$color'}
                              >
                                {a}
                              </Text>
                            </Card>
                          </Pressable>
                        )
                      })}
                    </XStack>
                  </ScrollView>
                </YStack>
              ) : null}

              {/* ── Vista 2: Selector de Meses ──────────────────────── */}
              {vista === 'meses' ? (
                <YStack height={260} justifyContent="center">
                  <Text fontSize="$2" color="$gray10" marginBottom="$2">
                    Toca un mes para seleccionarlo:
                  </Text>
                  <XStack flexWrap="wrap" gap="$2" justifyContent="space-between">
                    {MESES_ANIO.map((nombreMes, indice) => {
                      const numMes = indice + 1
                      const seleccionado = numMes === mesTemp
                      const esMesFuturo = construirFechaISO(anioTemp, numMes, 1).slice(0, 7) > hoyISO.slice(0, 7)
                      return (
                        <Pressable
                          key={nombreMes}
                          disabled={esMesFuturo}
                          onPress={() => {
                            setMesTemp(numMes)
                            // Ajustar día según capacidad del mes
                            const maxDias = obtenerDiasDelMes(anioTemp, numMes)
                            if (diaTemp > maxDias) {
                              setDiaTemp(maxDias)
                            }
                            setVista('calendario')
                          }}
                          style={{ width: '31%', marginVertical: 4, opacity: esMesFuturo ? 0.35 : 1 }}
                          accessibilityRole="button"
                          accessibilityLabel={`Mes ${nombreMes}`}
                        >
                          <Card
                            paddingVertical="$2.5"
                            alignItems="center"
                            backgroundColor={seleccionado ? '$blue9' : '$gray3'}
                            borderWidth={1}
                            borderColor={seleccionado ? '$blue10' : '$borderColor'}
                            borderRadius="$2"
                          >
                            <Text
                              fontSize="$2"
                              fontWeight={seleccionado ? 'bold' : '500'}
                              color={seleccionado ? 'white' : '$color'}
                              numberOfLines={1}
                            >
                              {nombreMes.slice(0, 3)}
                            </Text>
                          </Card>
                        </Pressable>
                      )
                    })}
                  </XStack>
                </YStack>
              ) : null}

              {/* ── Vista 3: Cuadrícula del Calendario Mensual ─────── */}
              {vista === 'calendario' ? (
                <YStack gap="$1.5">
                  {/* Fila de cabecera de días de la semana */}
                  <XStack justifyContent="space-between" paddingVertical="$1">
                    {DIAS_SEMANA_ABREV.map((d) => (
                      <YStack key={d} width="13%" alignItems="center">
                        <Text fontSize="$1" fontWeight="600" color="$gray10">
                          {d}
                        </Text>
                      </YStack>
                    ))}
                  </XStack>

                  {/* Cuadrícula de 7 columnas */}
                  <XStack flexWrap="wrap">
                    {/* Espacios vacíos antes del primer día del mes */}
                    {Array.from({ length: espaciosInicio }).map((_, i) => (
                      <YStack key={`vacio-${i}`} width="14.28%" height={36} />
                    ))}

                    {/* Botones de días del mes */}
                    {Array.from({ length: diasEnMes }).map((_, i) => {
                      const numDia = i + 1
                      const fechaDiaISO = construirFechaISO(anioTemp, mesTemp, numDia)
                      const esFuturo = fechaDiaISO > hoyISO
                      const esSeleccionado = numDia === diaTemp

                      return (
                        <Pressable
                          key={`dia-${numDia}`}
                          disabled={esFuturo}
                          onPress={() => setDiaTemp(numDia)}
                          style={{
                            width: '14.28%',
                            height: 36,
                            justifyContent: 'center',
                            alignItems: 'center',
                            opacity: esFuturo ? 0.25 : 1,
                          }}
                          accessibilityRole="button"
                          accessibilityLabel={`Día ${numDia} de ${MESES_ANIO[mesTemp - 1]} de ${anioTemp}`}
                        >
                          <YStack
                            width={32}
                            height={32}
                            borderRadius={16}
                            backgroundColor={esSeleccionado ? '$blue9' : 'transparent'}
                            justifyContent="center"
                            alignItems="center"
                          >
                            <Text
                              fontSize="$2"
                              fontWeight={esSeleccionado ? 'bold' : '500'}
                              color={esSeleccionado ? 'white' : '$color'}
                            >
                              {numDia}
                            </Text>
                          </YStack>
                        </Pressable>
                      )
                    })}
                  </XStack>
                </YStack>
              ) : null}

              {/* ── Botones de acción inferiores ───────────────────── */}
              <XStack justifyContent="space-between" alignItems="center" paddingTop="$3" borderTopWidth={1} borderTopColor="$borderColor">
                <Button size="$2" chromeless onPress={limpiarFecha} accessibilityLabel="Limpiar fecha">
                  <Text fontSize="$2" color="$gray10">
                    Limpiar
                  </Text>
                </Button>

                <XStack gap="$2">
                  <Button size="$2" chromeless onPress={cerrarModal} accessibilityLabel="Cancelar selección">
                    <Text fontSize="$2" color="$gray11">
                      Cancelar
                    </Text>
                  </Button>

                  <Button
                    size="$2"
                    backgroundColor={esFechaTempFutura ? '$gray6' : '$blue9'}
                    disabled={esFechaTempFutura}
                    onPress={confirmarSeleccion}
                    accessibilityLabel="Aceptar fecha"
                  >
                    <Text fontSize="$2" fontWeight="600" color="white">
                      Aceptar
                    </Text>
                  </Button>
                </XStack>
              </XStack>
            </Card>
          </Pressable>
        </Pressable>
      </Modal>
    </YStack>
  )
}
