import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useEffect, useMemo } from 'react'
import {
  Button,
  Card,
  ScrollView,
  Separator,
  Spinner,
  Text,
  useTheme,
  XStack,
  YStack,
} from 'tamagui'

import { calcularMejor1RM } from '../../src/domain/metrics'
import type { SesionDetalle, SesionResumen } from '../../src/domain/types'
import { useConfiguracionStore } from '../../src/store/configuracion.store'
import { useSesionStore } from '../../src/store/sesion.store'
import { calcularVolumenTotal } from '../../src/domain/metrics'

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

interface TarjetaSesionProps {
  sesion: SesionResumen
  /** Volumen calculado a partir del detalle (si está disponible). */
  volumen: number | null
  /** Nº de ejercicios del detalle (si está disponible). */
  ejercicios: number | null
}

/** Tarjeta de sesión pasada: resumen + métricas si el detalle está cargado. */
function TarjetaSesion({ sesion, volumen, ejercicios }: TarjetaSesionProps) {
  const tema = useTheme()

  return (
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

      <XStack gap="$3" marginTop="$1" flexWrap="wrap">
        {volumen != null ? (
          <Text fontSize="$2" color="$gray11">
            Volumen: {formatearCantidad(volumen)} kg
          </Text>
        ) : null}
        {ejercicios != null ? (
          <Text fontSize="$2" color="$gray11">
            {ejercicios} {ejercicios === 1 ? 'ejercicio' : 'ejercicios'}
          </Text>
        ) : null}
      </XStack>

      {sesion.notas ? (
        <Text fontSize="$2" color="$gray10" marginTop="$1" numberOfLines={3}>
          {sesion.notas}
        </Text>
      ) : null}

      {volumen == null && ejercicios == null && !sesion.notas ? (
        <Text fontSize="$1" color={tema.gray9?.val} marginTop="$1">
          Sin detalle cargado para esta sesión.
        </Text>
      ) : null}
    </Card>
  )
}

/**
 * Pantalla de Historial: sesiones pasadas con métricas y comparativas.
 *
 * Lista el historial completo desde `useSesionStore.cargarHistorial` y, para
 * las últimas sesiones cuyo detalle está disponible, muestra volumen por
 * sesión, nº de ejercicios y notas. Sin sesiones muestra un estado vacío con
 * CTA; con error, tarjeta de reintento.
 */
export default function HistorialScreen() {
  const usuario = useConfiguracionStore((s) => s.usuarioActivo)

  const sesiones = useSesionStore((s) => s.sesiones)
  const sesionesDetalle = useSesionStore((s) => s.sesionesDetalle)
  const cargandoSesiones = useSesionStore((s) => s.cargando)
  const errorSesiones = useSesionStore((s) => s.error)
  const cargarHistorial = useSesionStore((s) => s.cargarHistorial)
  const limpiarError = useSesionStore((s) => s.limpiarError)

  const tema = useTheme()
  const usuarioId = usuario?.id ?? null

  useEffect(() => {
    if (!usuarioId) return
    void cargarHistorial(usuarioId)
  }, [usuarioId, cargarHistorial])

  const detallePorSesion = useMemo(() => {
    const mapa = new Map<string, SesionDetalle>()
    sesionesDetalle.forEach((detalle) => mapa.set(detalle.id, detalle))
    return mapa
  }, [sesionesDetalle])

  const volumenTotal = useMemo(
    () =>
      sesionesDetalle.reduce(
        (total, detalle) =>
          total +
          detalle.registros.reduce(
            (acc, registro) => acc + calcularVolumenTotal(registro.series),
            0,
          ),
        0,
      ),
    [sesionesDetalle],
  )

  const mejor1RM = useMemo(
    () =>
      sesionesDetalle.reduce((max, detalle) => {
        const maxSesion = detalle.registros.reduce(
          (maxRegistro, registro) => Math.max(maxRegistro, calcularMejor1RM(registro.series)),
          0,
        )
        return Math.max(max, maxSesion)
      }, 0),
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
              {sesiones.map((sesion, indice) => {
                const detalle = detallePorSesion.get(sesion.id)
                const volumen = detalle
                  ? detalle.registros.reduce(
                      (acc, registro) => acc + calcularVolumenTotal(registro.series),
                      0,
                    )
                  : null
                const ejercicios = detalle ? detalle.registros.length : null

                return (
                  <YStack key={sesion.id}>
                    {indice > 0 ? <Separator borderColor="$borderColor" /> : null}
                    <TarjetaSesion
                      sesion={sesion}
                      volumen={volumen}
                      ejercicios={ejercicios}
                    />
                  </YStack>
                )
              })}
            </YStack>
          </>
        )}
      </YStack>
    </ScrollView>
  )
}
