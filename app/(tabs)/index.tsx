import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useEffect, useMemo } from 'react'
import type { ComponentProps } from 'react'
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

import type { Nivel, Objetivo, SesionResumen } from '../../src/domain/types'
import { useConfiguracionStore } from '../../src/store/configuracion.store'
import type { Tema } from '../../src/store/configuracion.store'
import { useRutinasStore } from '../../src/store/rutinas.store'
import { LIMITE_SESIONES_DETALLE, useSesionStore } from '../../src/store/sesion.store'
import {
  calcularMejor1RMSesiones,
  calcularVolumenTotalSesiones,
} from '../../src/store/selectores'

type NombreIcono = ComponentProps<typeof Ionicons>['name']

/** Ciclo del toggle de tema: sistema → claro → oscuro → sistema. */
const SIGUIENTE_TEMA: Record<Tema, Tema> = {
  sistema: 'claro',
  claro: 'oscuro',
  oscuro: 'sistema',
}

const ETIQUETAS_TEMA: Record<Tema, string> = {
  sistema: 'Sistema',
  claro: 'Claro',
  oscuro: 'Oscuro',
}

const ICONOS_TEMA: Record<Tema, NombreIcono> = {
  sistema: 'contrast',
  claro: 'sunny',
  oscuro: 'moon',
}

const ETIQUETAS_OBJETIVO: Record<Objetivo, string> = {
  hipertrofia: 'Hipertrofia',
  fuerza: 'Fuerza',
  resistencia: 'Resistencia',
  perdida_grasa: 'Pérdida de grasa',
}

const ETIQUETAS_NIVEL: Record<Nivel, string> = {
  principiante: 'Principiante',
  intermedio: 'Intermedio',
  avanzado: 'Avanzado',
}

function saludoSegunHora(): string {
  const hora = new Date().getHours()
  if (hora < 12) return 'Buenos días'
  if (hora < 20) return 'Buenas tardes'
  return 'Buenas noches'
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

interface IndicadorProps {
  etiqueta: string
  valor: string
  detalle?: string
}

/** Widget de métrica: valor grande + etiqueta secundaria. */
function Indicador({ etiqueta, valor, detalle }: IndicadorProps) {
  return (
    <YStack flex={1} backgroundColor="$gray3" borderRadius="$4" padding="$3" gap="$1">
      <Text fontSize="$2" color="$gray10" numberOfLines={1}>
        {etiqueta}
      </Text>
      <Text fontSize="$8" fontWeight="bold" color="$color" numberOfLines={1} adjustsFontSizeToFit>
        {valor}
      </Text>
      {detalle ? (
        <Text fontSize="$1" color="$gray9" numberOfLines={1}>
          {detalle}
        </Text>
      ) : null}
    </YStack>
  )
}

/** Fila del listado de actividad reciente. */
function FilaSesion({ sesion }: { sesion: SesionResumen }) {
  return (
    <YStack gap="$1" paddingVertical="$2">
      <XStack justifyContent="space-between" alignItems="center" gap="$2">
        <YStack flex={1} gap="$0.5">
          <Text fontSize="$3" fontWeight="600" color="$color" numberOfLines={1}>
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
    </YStack>
  )
}

interface BotonAccionProps {
  icono: keyof typeof Ionicons.glyphMap
  texto: string
  alPulsar: () => void
  colorIcono: string | undefined
}

/** CTA destacado: contraste invertido (gray12 sobre gray1) en ambos temas. */
function BotonAccion({ icono, texto, alPulsar, colorIcono }: BotonAccionProps) {
  return (
    <Button
      size="$4"
      backgroundColor="$gray12"
      color="$gray1"
      fontWeight="bold"
      pressStyle={{ opacity: 0.85 }}
      icon={<Ionicons name={icono} size={18} color={colorIcono} />}
      marginTop="$2"
      onPress={alPulsar}
    >
      {texto}
    </Button>
  )
}

/**
 * Dashboard: pantalla principal operativa de la app.
 *
 * Resume el estado global (usuario, rutina activa, historial) y da acceso
 * rápido al entrenamiento. Los datos se cargan en el montaje vía los stores
 * (zustand) y se manejan los estados de `cargando`/`error` para no mostrar
 * pantallas vacías sin feedback.
 */
export default function DashboardScreen() {
  const usuario = useConfiguracionStore((s) => s.usuarioActivo)
  const temaPreferido = useConfiguracionStore((s) => s.tema)
  const cambiarTema = useConfiguracionStore((s) => s.cambiarTema)

  const rutinas = useRutinasStore((s) => s.rutinas)
  const cargandoRutinas = useRutinasStore((s) => s.cargando)
  const errorRutinas = useRutinasStore((s) => s.error)
  const cargarRutinas = useRutinasStore((s) => s.cargarRutinas)

  const sesiones = useSesionStore((s) => s.sesiones)
  const sesionesDetalle = useSesionStore((s) => s.sesionesDetalle)
  const cargandoSesiones = useSesionStore((s) => s.cargando)
  const errorSesiones = useSesionStore((s) => s.error)
  const cargarHistorial = useSesionStore((s) => s.cargarHistorial)

  const tema = useTheme()

  const usuarioId = usuario?.id ?? null

  // Carga inicial: rutinas del usuario (+ plantillas) e historial de sesiones.
  useEffect(() => {
    void cargarRutinas(usuarioId)
  }, [usuarioId, cargarRutinas])

  useEffect(() => {
    if (!usuarioId) return
    void cargarHistorial(usuarioId)
  }, [usuarioId, cargarHistorial])

  const rutinaActiva = useMemo(() => rutinas.find((r) => r.activa === 1) ?? null, [rutinas])
  const ultimasSesiones = useMemo(() => sesiones.slice(0, LIMITE_SESIONES_DETALLE), [sesiones])
  const volumenReciente = useMemo(
    () => calcularVolumenTotalSesiones(sesionesDetalle),
    [sesionesDetalle],
  )
  const mejor1RM = useMemo(() => calcularMejor1RMSesiones(sesionesDetalle), [sesionesDetalle])

  const cargando = cargandoRutinas || cargandoSesiones
  const error = errorRutinas ?? errorSesiones
  const sinDatos = rutinas.length === 0 && sesiones.length === 0

  const recargar = () => {
    void cargarRutinas(usuarioId)
    if (usuarioId) {
      void cargarHistorial(usuarioId)
    }
  }

  if (cargando && sinDatos) {
    return (
      <YStack
        flex={1}
        backgroundColor="$background"
        justifyContent="center"
        alignItems="center"
        gap="$4"
      >
        <Spinner size="large" color="$color" />
        <Text color="$gray10">Cargando tus datos…</Text>
      </YStack>
    )
  }

  return (
    <ScrollView backgroundColor="$background">
      <YStack padding="$4" paddingBottom="$6" gap="$4">
        {error ? (
          <Card size="$4" backgroundColor="$red5" borderWidth={1} borderColor="$red8" padding="$3">
            <XStack gap="$2" alignItems="center" justifyContent="space-between">
              <YStack flex={1} gap="$1">
                <Text fontWeight="600" color="$red11">
                  No se pudo cargar la información
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

        {/* ── Usuario ─────────────────────────────────────────────── */}
        <XStack justifyContent="space-between" alignItems="flex-start" gap="$2">
          <YStack gap="$1" flex={1}>
            <Text fontSize="$2" color="$gray10">
              {saludoSegunHora()},
            </Text>
            <Text fontSize="$8" fontWeight="bold" color="$color">
              {usuario?.nombre ?? 'Atleta'}
            </Text>
            {usuario?.objetivo || usuario?.nivel || usuario?.peso_inicial != null ? (
              <XStack gap="$2" marginTop="$1" flexWrap="wrap">
                {usuario?.objetivo ? (
                  <Text fontSize="$2" color="$gray11">
                    {ETIQUETAS_OBJETIVO[usuario.objetivo]}
                  </Text>
                ) : null}
                {usuario?.nivel ? (
                  <Text fontSize="$2" color="$gray11">
                    {ETIQUETAS_NIVEL[usuario.nivel]}
                  </Text>
                ) : null}
                {usuario?.peso_inicial != null ? (
                  <Text fontSize="$2" color="$gray11">
                    {usuario.peso_inicial} kg
                  </Text>
                ) : null}
              </XStack>
            ) : null}
          </YStack>
          <Button
            size="$3"
            circular
            borderWidth={1}
            borderColor="$borderColor"
            backgroundColor="transparent"
            icon={<Ionicons name={ICONOS_TEMA[temaPreferido]} size={18} color={tema.color?.val} />}
            onPress={() => cambiarTema(SIGUIENTE_TEMA[temaPreferido])}
            aria-label={`Tema: ${ETIQUETAS_TEMA[temaPreferido]}. Toca para cambiar.`}
          />
        </XStack>

        {/* ── Rutina activa ───────────────────────────────────────── */}
        <Card size="$4" borderWidth={1} borderColor="$borderColor" padding="$4" gap="$3">
          <Text fontSize="$1" color="$gray10" textTransform="uppercase" letterSpacing={1}>
            Rutina activa
          </Text>
          {rutinaActiva ? (
            <>
              <Text fontSize="$6" fontWeight="bold" color="$color">
                {rutinaActiva.nombre}
              </Text>
              {rutinaActiva.descripcion ? (
                <Text fontSize="$2" color="$gray10" numberOfLines={2}>
                  {rutinaActiva.descripcion}
                </Text>
              ) : null}
              <BotonAccion
                icono="play"
                texto="Iniciar Entrenamiento"
                alPulsar={() => router.navigate('/sesion')}
                colorIcono={tema.gray1?.val}
              />
            </>
          ) : (
            <>
              <Text fontSize="$4" fontWeight="bold" color="$color">
                Todavía no tienes una rutina activa
              </Text>
              <Text fontSize="$2" color="$gray10">
                Ve a la pestaña de Rutinas y selecciona una para empezar a entrenar hoy.
              </Text>
              <BotonAccion
                icono="barbell-outline"
                texto="Ir a Rutinas"
                alPulsar={() => router.navigate('/rutinas')}
                colorIcono={tema.gray1?.val}
              />
            </>
          )}
        </Card>

        {/* ── Indicadores de progreso ────────────────────────────── */}
        <XStack gap="$3">
          <Indicador
            etiqueta="Volumen reciente"
            valor={`${formatearCantidad(volumenReciente)} kg`}
            detalle={`Últimas ${LIMITE_SESIONES_DETALLE} sesiones`}
          />
          <Indicador
            etiqueta="Mejor 1RM"
            valor={mejor1RM > 0 ? `${formatearCantidad(mejor1RM)} kg` : '—'}
            detalle="Estimación Epley"
          />
          <Indicador
            etiqueta="Sesiones"
            valor={formatearCantidad(sesiones.length)}
            detalle="En el historial"
          />
        </XStack>

        {/* ── Actividad reciente ──────────────────────────────────── */}
        <Card size="$4" borderWidth={1} borderColor="$borderColor" padding="$4" gap="$2">
          <Text fontSize="$4" fontWeight="bold" color="$color">
            Actividad reciente
          </Text>
          {ultimasSesiones.length === 0 ? (
            <YStack paddingVertical="$4" alignItems="center" gap="$1">
              <Text fontSize="$2" color="$gray10" textAlign="center">
                Aún no hay sesiones registradas.
              </Text>
              <Text fontSize="$2" color="$gray10" textAlign="center">
                Cuando finalices un entrenamiento aparecerá aquí.
              </Text>
            </YStack>
          ) : (
            <YStack>
              {ultimasSesiones.map((sesion, indice) => (
                <YStack key={sesion.id}>
                  {indice > 0 ? <Separator borderColor="$borderColor" /> : null}
                  <FilaSesion sesion={sesion} />
                </YStack>
              ))}
            </YStack>
          )}
        </Card>
      </YStack>
    </ScrollView>
  )
}
