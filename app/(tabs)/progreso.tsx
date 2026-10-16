import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import type { ComponentProps } from 'react'
import { Pressable } from 'react-native'
import {
  Button,
  Card,
  ScrollView,
  Spinner,
  Text,
  useTheme,
  XStack,
  YStack,
} from 'tamagui'

import { calcularMejor1RM, calcularVolumenTotal } from '../../src/domain/metrics'
import type { SesionDetalle, Tendencia } from '../../src/domain/types'
import {
  calcularTendencia,
  type AccionProgresion,
  type SugerenciaProgresion,
} from '../../src/domain/progression'
import { useConfiguracionStore } from '../../src/store/configuracion.store'
import { useEjerciciosStore } from '../../src/store/ejercicios.store'
import { useRutinasStore } from '../../src/store/rutinas.store'
import { useSesionStore } from '../../src/store/sesion.store'
import {
  calcularProgresoEjercicio,
  calcularSeriesEfectivasSemanales,
  calcularVolumenPorEjercicio,
  obtenerHistorialEjercicio,
} from '../../src/store/selectores'

type NombreIcono = ComponentProps<typeof Ionicons>['name']

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

/** Número con coma decimal (cargas tipo 62,5 o series semanales tipo 4,5). */
function formatearDecimal(valor: number): string {
  if (Number.isInteger(valor)) return String(valor)
  return valor.toFixed(1).replace('.', ',')
}

/** ISO 'YYYY-MM-DD' de hace N días (ventana semanal de series efectivas). */
function fechaISOHaceDias(dias: number): string {
  const fecha = new Date()
  fecha.setDate(fecha.getDate() - dias)
  return fecha.toISOString().split('T')[0]
}

const ETIQUETA_TENDENCIA: Record<Tendencia, string> = {
  subiendo: 'Subiendo',
  estancado: 'Estancado',
  bajando: 'Bajando',
}

const ICONO_TENDENCIA: Record<Tendencia, NombreIcono> = {
  subiendo: 'trending-up',
  estancado: 'remove',
  bajando: 'trending-down',
}

const ETIQUETA_ACCION: Record<AccionProgresion, string> = {
  subir_peso: 'Subir peso',
  mantener: 'Mantener carga',
  bajar_peso: 'Bajar peso',
  variar_ejercicio: 'Variar ejercicio',
}

const ICONO_ACCION: Record<AccionProgresion, NombreIcono> = {
  subir_peso: 'arrow-up-circle',
  mantener: 'remove-circle',
  bajar_peso: 'arrow-down-circle',
  variar_ejercicio: 'swap-horizontal',
}

/** Punto de evolución del ejercicio en una sesión (cronológico). */
interface PuntoEvolucion {
  sesionId: string
  fecha: string
  volumen: number
  mejor1RM: number
}

/**
 * Evolución por sesión del ejercicio: volumen y mejor 1RM de las series
 * completadas. Solo incluyen las sesiones donde el ejercicio se entrenó
 * con al menos una serie completada.
 */
function evolucionDeEjercicio(
  sesiones: SesionDetalle[],
  ejercicioId: string,
): PuntoEvolucion[] {
  const puntos: PuntoEvolucion[] = []
  const ordenadas = [...sesiones].sort((a, b) => a.fecha.localeCompare(b.fecha))
  for (const sesion of ordenadas) {
    const registro = sesion.registros.find((r) => r.ejercicio_id === ejercicioId)
    const completadas = registro?.series.filter((s) => s.completada === 1) ?? []
    if (completadas.length === 0) {
      continue
    }
    puntos.push({
      sesionId: sesion.id,
      fecha: sesion.fecha,
      volumen: calcularVolumenTotal(completadas),
      mejor1RM: calcularMejor1RM(completadas),
    })
  }
  return puntos
}

interface EjercicioConHistorial {
  id: string
  nombre: string
  /** Nº de sesiones (en la ventana cargada) con series completadas. */
  sesiones: number
}

interface TileResumenProps {
  etiqueta: string
  valor: string
  icono?: NombreIcono
  colorIcono?: string
  sub?: string
}

/** Celda de resumen (volumen, 1RM, tendencia, series semanales). */
function TileResumen({ etiqueta, valor, icono, colorIcono, sub }: TileResumenProps) {
  return (
    <YStack flex={1} backgroundColor="$gray3" borderRadius="$4" padding="$3" gap="$1">
      <Text fontSize="$2" color="$gray10" numberOfLines={1}>
        {etiqueta}
      </Text>
      <XStack alignItems="center" gap="$1">
        {icono ? <Ionicons name={icono} size={16} color={colorIcono} /> : null}
        <Text fontSize="$5" fontWeight="bold" color="$color" numberOfLines={1} flex={1}>
          {valor}
        </Text>
      </XStack>
      {sub ? (
        <Text fontSize="$1" color="$gray9" numberOfLines={1}>
          {sub}
        </Text>
      ) : null}
    </YStack>
  )
}

interface FilaBarraProps {
  etiqueta: string
  valor: string
  /** 0-100. */
  porcentaje: number
  color: string
}

/** Barra horizontal simple (sin gráficos externos): track + relleno por flex. */
function FilaBarra({ etiqueta, valor, porcentaje, color }: FilaBarraProps) {
  const lleno = Math.min(Math.max(porcentaje, 0), 100)
  return (
    <XStack alignItems="center" gap="$2">
      <Text width={76} fontSize="$1" color="$gray10">
        {etiqueta}
      </Text>
      <XStack flex={1} height={12} borderRadius="$2" overflow="hidden">
        <YStack flex={Math.max(lleno, 0.5)} backgroundColor={color} />
        <YStack flex={Math.max(100 - lleno, 0.5)} backgroundColor="$gray4" />
      </XStack>
      <Text width={76} fontSize="$1" color="$gray11" textAlign="right">
        {valor}
      </Text>
    </XStack>
  )
}

/**
 * Pantalla de Progreso: evolución por ejercicio y sugerencia de carga.
 *
 * Carga el detalle de las últimas 30 sesiones (`cargarDetallesCompletos`)
 * y el catálogo de ejercicios (`useEjerciciosStore`) para calcular, con los
 * selectores existentes, el volumen total, el mejor 1RM, la tendencia, las
 * series efectivas semanales del grupo del ejercicio y la sugerencia de
 * progresión (`sugerirProgresion` según los objetivos de la rutina activa).
 */
export default function ProgresoScreen() {
  const usuario = useConfiguracionStore((s) => s.usuarioActivo)

  const sesionesDetalle = useSesionStore((s) => s.sesionesDetalle)
  const detallesCompletos = useSesionStore((s) => s.detallesCompletos)
  const detallesPorId = useSesionStore((s) => s.detallesPorId)
  const sesionActual = useSesionStore((s) => s.sesionActual)
  const cargandoSesiones = useSesionStore((s) => s.cargando)
  const errorSesiones = useSesionStore((s) => s.error)
  const cargarDetallesCompletos = useSesionStore((s) => s.cargarDetallesCompletos)
  const limpiarErrorSesiones = useSesionStore((s) => s.limpiarError)

  const ejerciciosPorId = useEjerciciosStore((s) => s.ejerciciosPorId)
  const cargandoEjercicios = useEjerciciosStore((s) => s.cargando)
  const errorEjercicios = useEjerciciosStore((s) => s.error)
  const cargarEjercicios = useEjerciciosStore((s) => s.cargarEjercicios)
  const limpiarErrorEjercicios = useEjerciciosStore((s) => s.limpiarError)

  const rutinas = useRutinasStore((s) => s.rutinas)
  const rutinaSeleccionada = useRutinasStore((s) => s.rutinaSeleccionada)
  const errorRutinas = useRutinasStore((s) => s.error)
  const cargarRutinas = useRutinasStore((s) => s.cargarRutinas)
  const seleccionarRutina = useRutinasStore((s) => s.seleccionarRutina)

  const tema = useTheme()
  const [ejercicioId, setEjercicioId] = useState<string | null>(null)

  const usuarioId = usuario?.id ?? null

  // Catálogo: no depende del usuario.
  useEffect(() => {
    void cargarEjercicios()
  }, [cargarEjercicios])

  useEffect(() => {
    if (!usuarioId) return
    void cargarDetallesCompletos(usuarioId)
    void cargarRutinas(usuarioId)
  }, [usuarioId, cargarDetallesCompletos, cargarRutinas])

  // Igual que en Sesión: el detalle de la rutina activa alimenta la
  // sugerencia (reps objetivo). Con sesión en curso no se toca la selección
  // si ya corresponde al día de esa sesión.
  const rutinaActiva = useMemo(() => rutinas.find((r) => r.activa === 1) ?? null, [rutinas])
  const diaSesionId = sesionActual?.sesion.dia_rutina_id ?? null

  useEffect(() => {
    if (!rutinaActiva) return
    const seleccionada = useRutinasStore.getState().rutinaSeleccionada
    if (sesionActual && seleccionada?.dias.some((d) => d.id === diaSesionId)) {
      return
    }
    if (seleccionada?.id === rutinaActiva.id) {
      return
    }
    void seleccionarRutina(rutinaActiva.id)
  }, [rutinaActiva, sesionActual, diaSesionId, seleccionarRutina])

  // Detalles disponibles (últimas 30 + cache de las últimas 5 y bajo demanda):
  // sin duplicados por id; el más fresco (sesionesDetalle) gana.
  const sesiones = useMemo(() => {
    const mapa = new Map<string, SesionDetalle>()
    for (const detalle of [
      ...Object.values(detallesPorId),
      ...detallesCompletos,
      ...sesionesDetalle,
    ]) {
      mapa.set(detalle.id, detalle)
    }
    return [...mapa.values()]
  }, [detallesPorId, detallesCompletos, sesionesDetalle])

  // Ejercicios con historial (series completadas), ordenados por última vez.
  const ejerciciosConHistorial = useMemo<EjercicioConHistorial[]>(() => {
    const porId = new Map<string, { nombre: string; ultimaFecha: string; sesiones: number }>()
    for (const sesion of sesiones) {
      for (const registro of sesion.registros) {
        if (!registro.series.some((serie) => serie.completada === 1)) continue
        const previo = porId.get(registro.ejercicio_id)
        if (!previo) {
          porId.set(registro.ejercicio_id, {
            nombre: ejerciciosPorId.get(registro.ejercicio_id)?.nombre ?? registro.ejercicio_nombre,
            ultimaFecha: sesion.fecha,
            sesiones: 1,
          })
        } else {
          previo.sesiones += 1
          if (sesion.fecha > previo.ultimaFecha) {
            previo.ultimaFecha = sesion.fecha
          }
        }
      }
    }
    return [...porId.entries()]
      .sort(([, a], [, b]) => b.ultimaFecha.localeCompare(a.ultimaFecha))
      .map(([id, datos]) => ({ id, nombre: datos.nombre, sesiones: datos.sesiones }))
  }, [sesiones, ejerciciosPorId])

  // Selección derivada: si el id guardado ya no existe, se usa el primero.
  const ejercicioIdValido =
    ejercicioId && ejerciciosConHistorial.some((e) => e.id === ejercicioId)
      ? ejercicioId
      : (ejerciciosConHistorial[0]?.id ?? null)

  const ejercicio = ejercicioIdValido ? (ejerciciosPorId.get(ejercicioIdValido) ?? null) : null

  const historial = useMemo(
    () => (ejercicioIdValido ? obtenerHistorialEjercicio(sesiones, ejercicioIdValido) : []),
    [sesiones, ejercicioIdValido],
  )

  const puntosEvolucion = useMemo(
    () => (ejercicioIdValido ? evolucionDeEjercicio(sesiones, ejercicioIdValido) : []),
    [sesiones, ejercicioIdValido],
  )
  const maxVolumenSesion = useMemo(
    () => puntosEvolucion.reduce((max, punto) => Math.max(max, punto.volumen), 0),
    [puntosEvolucion],
  )
  const max1RMSesion = useMemo(
    () => puntosEvolucion.reduce((max, punto) => Math.max(max, punto.mejor1RM), 0),
    [puntosEvolucion],
  )

  const volumenPorEjercicio = useMemo(() => calcularVolumenPorEjercicio(sesiones), [sesiones])
  const volumenTotal = ejercicioIdValido ? (volumenPorEjercicio.get(ejercicioIdValido) ?? 0) : 0

  const mejor1RM = useMemo(
    () => historial.reduce((max, sesionEjercicio) => Math.max(max, calcularMejor1RM(sesionEjercicio.series)), 0),
    [historial],
  )

  const tendencia = useMemo(() => calcularTendencia(historial), [historial])

  // Series efectivas semanales del grupo primario del ejercicio (últimos 7 días).
  const seriesSemanalesGrupo = useMemo(() => {
    if (!ejercicio) return 0
    const limite = fechaISOHaceDias(6)
    const semana = sesiones.filter((s) => s.fecha >= limite)
    const porGrupo = calcularSeriesEfectivasSemanales(semana, ejerciciosPorId)
    return porGrupo[ejercicio.grupo_muscular_primario] ?? 0
  }, [sesiones, ejerciciosPorId, ejercicio])

  // Objetivo del ejercicio en la rutina activa (reps min/max para la sugerencia).
  const objetivoEnRutina = useMemo(() => {
    if (!ejercicioIdValido || !rutinaSeleccionada) return null
    for (const dia of rutinaSeleccionada.dias) {
      const encontrado = dia.ejercicios.find((e) => e.ejercicio_id === ejercicioIdValido)
      if (encontrado) return encontrado
    }
    return null
  }, [rutinaSeleccionada, ejercicioIdValido])

  // Peso actual: el mayor de las series completadas de la última sesión.
  const pesoActual = useMemo(() => {
    const ultima = historial[historial.length - 1]
    if (!ultima) return 0
    return ultima.series
      .filter((serie) => serie.completada === 1)
      .reduce((max, serie) => Math.max(max, serie.peso_levantado), 0)
  }, [historial])

  // Sugerencia de progresión (usa el selector existente `calcularProgresoEjercicio`).
  const sugerencia = useMemo<SugerenciaProgresion | null>(() => {
    if (!ejercicio || !objetivoEnRutina) return null
    return calcularProgresoEjercicio(
      sesiones,
      ejercicio,
      objetivoEnRutina.reps_objetivo_min,
      objetivoEnRutina.reps_objetivo_max,
      pesoActual,
    ).sugerencia
  }, [sesiones, ejercicio, objetivoEnRutina, pesoActual])

  const cargando = (cargandoSesiones || cargandoEjercicios) && ejerciciosConHistorial.length === 0
  const error = errorSesiones ?? errorEjercicios ?? errorRutinas

  const reintentar = () => {
    limpiarErrorSesiones()
    limpiarErrorEjercicios()
    void cargarEjercicios()
    if (usuarioId) {
      void cargarDetallesCompletos(usuarioId)
      void cargarRutinas(usuarioId)
    }
  }

  const bannerError = error ? (
    <Card size="$4" backgroundColor="$red5" borderWidth={1} borderColor="$red8" padding="$3">
      <XStack gap="$2" alignItems="center" justifyContent="space-between">
        <YStack flex={1} gap="$1">
          <Text fontWeight="600" color="$red11">
            No se pudo cargar el progreso
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

  if (!usuarioId) {
    return (
      <YStack flex={1} backgroundColor="$background" justifyContent="center" alignItems="center" gap="$4">
        <Spinner size="large" color="$color" />
        <Text color="$gray10">Preparando tu perfil…</Text>
      </YStack>
    )
  }

  if (cargando) {
    return (
      <YStack flex={1} backgroundColor="$background" justifyContent="center" alignItems="center" gap="$4">
        <Spinner size="large" color="$color" />
        <Text color="$gray10">Calculando tu progreso…</Text>
      </YStack>
    )
  }

  const colorSubiendo = tema.green9?.val ?? tema.color?.val
  const colorBajando = tema.red10?.val ?? tema.color?.val
  const colorNeutro = tema.gray10?.val

  return (
    <ScrollView backgroundColor="$background">
      <YStack padding="$4" paddingBottom="$6" gap="$4">
        {bannerError}

        {ejerciciosConHistorial.length === 0 ? (
          <YStack justifyContent="center" alignItems="center" gap="$3" paddingVertical="$8">
            <Ionicons name="trending-up-outline" size={48} color={tema.gray9?.val} />
            <Text fontSize="$5" fontWeight="bold" color="$color" textAlign="center">
              Aún no hay progreso que mostrar
            </Text>
            <Text fontSize="$2" color="$gray10" textAlign="center">
              Registra series en tus entrenamientos y aquí verás la evolución de cada ejercicio.
            </Text>
            <Button
              size="$4"
              backgroundColor="$gray12"
              color="$gray1"
              fontWeight="bold"
              pressStyle={{ opacity: 0.85 }}
              icon={<Ionicons name="barbell-outline" size={18} color={tema.gray1?.val} />}
              onPress={() => router.navigate('/sesion')}
            >
              Ir a entrenar
            </Button>
          </YStack>
        ) : (
          <>
            <YStack gap="$2">
              <Text fontSize="$2" color="$gray10">
                Elige un ejercicio ({ejerciciosConHistorial.length} con historial)
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <XStack gap="$2" paddingVertical="$1">
                  {ejerciciosConHistorial.map((ejercicioLista) => {
                    const activo = ejercicioLista.id === ejercicioIdValido
                    return (
                      <Pressable
                        key={ejercicioLista.id}
                        onPress={() => setEjercicioId(ejercicioLista.id)}
                        accessibilityRole="button"
                        accessibilityLabel={`Ver progreso de ${ejercicioLista.nombre}`}
                      >
                        <XStack
                          paddingHorizontal="$3"
                          paddingVertical="$2"
                          borderRadius="$10"
                          borderWidth={1}
                          borderColor={activo ? '$blue8' : '$borderColor'}
                          backgroundColor={activo ? '$blue2' : '$gray2'}
                          gap="$1"
                          alignItems="center"
                        >
                          <Text
                            fontSize="$2"
                            fontWeight={activo ? '600' : '400'}
                            color={activo ? '$blue11' : '$gray11'}
                            numberOfLines={1}
                          >
                            {ejercicioLista.nombre}
                          </Text>
                          <Text fontSize="$1" color={activo ? '$blue10' : '$gray9'}>
                            {ejercicioLista.sesiones}
                          </Text>
                        </XStack>
                      </Pressable>
                    )
                  })}
                </XStack>
              </ScrollView>
            </YStack>

            <YStack gap="$2">
              <XStack gap="$3">
                <TileResumen
                  etiqueta="Volumen total"
                  valor={`${formatearCantidad(volumenTotal)} kg`}
                  sub={`en ${puntosEvolucion.length} sesiones`}
                />
                <TileResumen
                  etiqueta="Mejor 1RM est."
                  valor={mejor1RM > 0 ? `${formatearDecimal(mejor1RM)} kg` : '—'}
                  sub="Epley"
                />
              </XStack>
              <XStack gap="$3">
                <TileResumen
                  etiqueta="Tendencia"
                  valor={ETIQUETA_TENDENCIA[tendencia]}
                  icono={ICONO_TENDENCIA[tendencia]}
                  colorIcono={
                    tendencia === 'subiendo'
                      ? colorSubiendo
                      : tendencia === 'bajando'
                        ? colorBajando
                        : colorNeutro
                  }
                />
                <TileResumen
                  etiqueta={`Series/sem (${ejercicio?.grupo_muscular_primario.replace('_', ' ') ?? '—'})`}
                  valor={formatearDecimal(seriesSemanalesGrupo)}
                  sub="efectivas, últimos 7 días"
                />
              </XStack>
            </YStack>

            {puntosEvolucion.length > 0 ? (
              <>
                <Card size="$4" borderWidth={1} borderColor="$borderColor" padding="$4" gap="$3">
                  <Text fontSize="$4" fontWeight="bold" color="$color">
                    Volumen por sesión
                  </Text>
                  <YStack gap="$2">
                    {puntosEvolucion.map((punto) => (
                      <FilaBarra
                        key={`vol-${punto.sesionId}`}
                        etiqueta={formatearFecha(punto.fecha)}
                        valor={`${formatearCantidad(punto.volumen)} kg`}
                        porcentaje={
                          maxVolumenSesion > 0
                            ? Math.round((punto.volumen / maxVolumenSesion) * 100)
                            : 0
                        }
                        color="$blue8"
                      />
                    ))}
                  </YStack>
                </Card>
                <Card size="$4" borderWidth={1} borderColor="$borderColor" padding="$4" gap="$3">
                  <Text fontSize="$4" fontWeight="bold" color="$color">
                    1RM estimado por sesión
                  </Text>
                  <YStack gap="$2">
                    {puntosEvolucion.map((punto) => (
                      <FilaBarra
                        key={`rm-${punto.sesionId}`}
                        etiqueta={formatearFecha(punto.fecha)}
                        valor={`${formatearDecimal(punto.mejor1RM)} kg`}
                        porcentaje={
                          max1RMSesion > 0 ? Math.round((punto.mejor1RM / max1RMSesion) * 100) : 0
                        }
                        color="$blue8"
                      />
                    ))}
                  </YStack>
                </Card>
              </>
            ) : null}

            {sugerencia ? (
              <Card size="$4" borderWidth={1} borderColor="$borderColor" padding="$4" gap="$2">
                <Text fontSize="$4" fontWeight="bold" color="$color">
                  Sugerencia para la próxima sesión
                </Text>
                <XStack alignItems="center" gap="$2" flexWrap="wrap">
                  <XStack
                    backgroundColor="$gray3"
                    paddingHorizontal="$2"
                    paddingVertical="$1"
                    borderRadius="$10"
                    gap="$1"
                    alignItems="center"
                  >
                    <Ionicons
                      name={ICONO_ACCION[sugerencia.accion]}
                      size={14}
                      color={
                        sugerencia.accion === 'subir_peso'
                          ? colorSubiendo
                          : sugerencia.accion === 'bajar_peso'
                            ? colorBajando
                            : colorNeutro
                      }
                    />
                    <Text fontSize="$2" fontWeight="600" color="$color">
                      {ETIQUETA_ACCION[sugerencia.accion]}
                    </Text>
                  </XStack>
                  <Text fontSize="$3" fontWeight="600" color="$color">
                    {formatearDecimal(sugerencia.peso_sugerido)} kg
                  </Text>
                </XStack>
                <Text fontSize="$2" color="$gray11">
                  {sugerencia.motivo}
                </Text>
              </Card>
            ) : rutinaSeleccionada ? (
              <Text fontSize="$2" color="$gray10" textAlign="center">
                Sin sugerencia de carga: este ejercicio no está en la rutina activa.
              </Text>
            ) : null}
          </>
        )}
      </YStack>
    </ScrollView>
  )
}
