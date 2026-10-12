import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
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

import type { SesionDetalle, SesionResumen } from '../../src/domain/types'
import { calcularMejor1RM } from '../../src/domain/metrics'
import { useConfiguracionStore } from '../../src/store/configuracion.store'
import { useSesionStore } from '../../src/store/sesion.store'
import {
  calcularMejor1RMSesiones,
  calcularVolumenTotalSesiones,
} from '../../src/store/selectores'

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

/** Desglose de un registro: `60×10 · 60×10 · 62,5×8` + mejor 1RM estimado. */
function formatearSeries(detalle: SesionDetalle['registros'][number]): {
  series: string
  mejor1RM: number
} {
  const completadas = detalle.series.filter((serie) => serie.completada === 1)
  return {
    series: completadas
      .map((serie) => `${serie.peso_levantado}×${serie.reps_realizadas}`)
      .join(' · '),
    mejor1RM: calcularMejor1RM(completadas),
  }
}

interface TarjetaSesionProps {
  sesion: SesionResumen
  /** Detalle (registros + series) si está disponible; si no, null. */
  detalle: SesionDetalle | null
  /**
   * Se invoca al expandir una sesión sin detalle cargado (p. ej. una sesión
   * antigua fuera de las últimas 5) para traerlo bajo demanda.
   */
  onExpandirSinDetalle: (sesionId: string) => void
}

/**
 * Tarjeta de sesión pasada: resumen siempre; al expandir, series por ejercicio
 * y 1RM estimado (bajo demanda para las sesiones antiguas).
 */
function TarjetaSesion({ sesion, detalle, onExpandirSinDetalle }: TarjetaSesionProps) {
  const [abierta, setAbierta] = useState(false)

  const volumen = detalle ? calcularVolumenTotalSesiones([detalle]) : null
  const mejor1RMSesion = detalle ? calcularMejor1RMSesiones([detalle]) : null

  const alternar = () => {
    const seAbre = !abierta
    setAbierta(seAbre)
    if (seAbre && !detalle) {
      onExpandirSinDetalle(sesion.id)
    }
  }

  return (
    <Pressable
      onPress={alternar}
      accessibilityRole="button"
      accessibilityLabel={`Ver detalle de la sesión del ${formatearFecha(sesion.fecha)}`}
    >
      <Card size="$4" borderWidth={1} borderColor="$borderColor" padding="$4" gap="$2">
        <XStack justifyContent="space-between" alignItems="flex-start" gap="$2">
          <YStack flex={1} gap="$0.5">
            <Text fontSize="$4" fontWeight="bold" color="$color" numberOfLines={1}>
              {sesion.rutina_nombre ?? 'Rutina'}
            </Text>
            {sesion.nombre_dia ? (
              <Text fontSize="$2" color="$gray10" numberOfLines={1}>
                {sesion.nombre_dia}
              </Text>
            ) : null}
          </YStack>
          <YStack alignItems="flex-end" gap="$0.5">
            <Text fontSize="$2" color="$gray11">
              {formatearFecha(sesion.fecha)}
            </Text>
            {sesion.duracion_minutos != null ? (
              <Text fontSize="$1" color="$gray9">
                {sesion.duracion_minutos} min
                {sesion.rpe_sesion != null ? ` · RPE ${sesion.rpe_sesion}` : ''}
              </Text>
            ) : null}
          </YStack>
        </XStack>

        {detalle ? (
          <XStack gap="$3" marginTop="$1" flexWrap="wrap">
            <Text fontSize="$2" color="$gray11">
              Volumen: {formatearCantidad(volumen ?? 0)} kg
            </Text>
            <Text fontSize="$2" color="$gray11">
              {detalle.registros.length}{' '}
              {detalle.registros.length === 1 ? 'ejercicio' : 'ejercicios'}
            </Text>
            {mejor1RMSesion != null && mejor1RMSesion > 0 ? (
              <Text fontSize="$2" color="$gray11">
                1RM est.: {formatearCantidad(mejor1RMSesion)} kg
              </Text>
            ) : null}
          </XStack>
        ) : null}

        {sesion.notas ? (
          <Text fontSize="$2" color="$gray10" marginTop="$1" numberOfLines={3}>
            {sesion.notas}
          </Text>
        ) : null}

        {abierta ? (
          <YStack marginTop="$2" gap="$2" borderTopWidth={1} borderColor="$borderColor" paddingTop="$2">
            {detalle ? (
              detalle.registros.map((registro) => {
                const resumen = formatearSeries(registro)
                return (
                  <YStack key={registro.id} gap="$0.5">
                    <XStack justifyContent="space-between" gap="$2">
                      <Text fontSize="$2" fontWeight="600" color="$color" flex={1} numberOfLines={1}>
                        {registro.ejercicio_nombre}
                      </Text>
                      {resumen.mejor1RM > 0 ? (
                        <Text fontSize="$1" color="$gray10">
                          1RM {formatearCantidad(resumen.mejor1RM)} kg
                        </Text>
                      ) : null}
                    </XStack>
                    <Text fontSize="$2" color="$gray10">
                      {resumen.series || 'Sin series completadas'}
                    </Text>
                  </YStack>
                )
              })
            ) : (
              <XStack gap="$2" alignItems="center">
                <Spinner size="small" color="$gray11" />
                <Text fontSize="$2" color="$gray10">
                  Cargando el detalle de la sesión…
                </Text>
              </XStack>
            )}
          </YStack>
        ) : null}
      </Card>
    </Pressable>
  )
}

/**
 * Pantalla de Historial: sesiones pasadas con métricas y comparativas.
 *
 * Lista el historial completo desde `useSesionStore.cargarHistorial` con
 * resumen global (volumen y mejor 1RM via selectores) y tarjetas expandibles:
 * las últimas N sesiones ya traen su detalle (`sesionesDetalle`); las
 * antiguas lo cargan bajo demanda con `cargarDetalleSesion`.
 */
export default function HistorialScreen() {
  const usuario = useConfiguracionStore((s) => s.usuarioActivo)

  const sesiones = useSesionStore((s) => s.sesiones)
  const sesionesDetalle = useSesionStore((s) => s.sesionesDetalle)
  const detallesPorId = useSesionStore((s) => s.detallesPorId)
  const cargandoSesiones = useSesionStore((s) => s.cargando)
  const errorSesiones = useSesionStore((s) => s.error)
  const cargarHistorial = useSesionStore((s) => s.cargarHistorial)
  const cargarDetalleSesion = useSesionStore((s) => s.cargarDetalleSesion)
  const limpiarError = useSesionStore((s) => s.limpiarError)

  const tema = useTheme()
  const usuarioId = usuario?.id ?? null

  useEffect(() => {
    if (!usuarioId) return
    void cargarHistorial(usuarioId)
  }, [usuarioId, cargarHistorial])

  // Detalle por sesión: últimas N ya están en memoria; las antiguas se
  // cargan bajo demanda al expandirlas.
  const detallePorSesion = useMemo(() => {
    const mapa = new Map<string, SesionDetalle>()
    sesionesDetalle.forEach((detalle) => mapa.set(detalle.id, detalle))
    Object.values(detallesPorId).forEach((detalle) => mapa.set(detalle.id, detalle))
    return mapa
  }, [sesionesDetalle, detallesPorId])

  const volumenTotal = useMemo(
    () => calcularVolumenTotalSesiones(sesionesDetalle),
    [sesionesDetalle],
  )

  const mejor1RM = useMemo(
    () => calcularMejor1RMSesiones(sesionesDetalle),
    [sesionesDetalle],
  )

  const recargar = () => {
    limpiarError()
    if (usuarioId) {
      void cargarHistorial(usuarioId)
    }
  }

  const bannerError = errorSesiones ? (
    <Card size="$4" backgroundColor="$red5" borderWidth={1} borderColor="$red8" padding="$3">
      <XStack gap="$2" alignItems="center" justifyContent="space-between">
        <YStack flex={1} gap="$1">
          <Text fontWeight="600" color="$red11">
            No se pudo cargar el historial
          </Text>
          <Text fontSize="$2" color="$red10" numberOfLines={2}>
            {errorSesiones}
          </Text>
        </YStack>
        <Button size="$2" borderColor="$red8" onPress={recargar}>
          Reintentar
        </Button>
      </XStack>
    </Card>
  ) : null

  const cargando = cargandoSesiones && sesiones.length === 0

  if (cargando) {
    return (
      <YStack flex={1} backgroundColor="$background" justifyContent="center" alignItems="center" gap="$4">
        <Spinner size="large" color="$color" />
        <Text color="$gray10">Cargando tu historial…</Text>
      </YStack>
    )
  }

  return (
    <ScrollView backgroundColor="$background">
      <YStack padding="$4" paddingBottom="$6" gap="$4">
        {bannerError}

        {sesiones.length === 0 ? (
          <YStack flex={1} justifyContent="center" alignItems="center" gap="$3" paddingVertical="$8">
            <Ionicons name="time-outline" size={48} color={tema.gray9?.val} />
            <Text fontSize="$5" fontWeight="bold" color="$color" textAlign="center">
              Aún no tienes sesiones registradas
            </Text>
            <Text fontSize="$2" color="$gray10" textAlign="center">
              Cuando finalices un entrenamiento aparecerá aquí con sus métricas.
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
            <XStack gap="$3">
              <YStack flex={1} backgroundColor="$gray3" borderRadius="$4" padding="$3" gap="$1">
                <Text fontSize="$2" color="$gray10" numberOfLines={1}>
                  Volumen (últimas {sesionesDetalle.length} sesiones)
                </Text>
                <Text fontSize="$6" fontWeight="bold" color="$color" numberOfLines={1}>
                  {formatearCantidad(volumenTotal)} kg
                </Text>
              </YStack>
              <YStack flex={1} backgroundColor="$gray3" borderRadius="$4" padding="$3" gap="$1">
                <Text fontSize="$2" color="$gray10" numberOfLines={1}>
                  Mejor 1RM
                </Text>
                <Text fontSize="$6" fontWeight="bold" color="$color" numberOfLines={1}>
                  {mejor1RM > 0 ? `${formatearCantidad(mejor1RM)} kg` : '—'}
                </Text>
              </YStack>
            </XStack>

            <YStack gap="$3">
              {sesiones.map((sesion) => (
                <TarjetaSesion
                  key={sesion.id}
                  sesion={sesion}
                  detalle={detallePorSesion.get(sesion.id) ?? null}
                  onExpandirSinDetalle={(id) => void cargarDetalleSesion(id)}
                />
              ))}
            </YStack>
          </>
        )}
      </YStack>
    </ScrollView>
  )
}
