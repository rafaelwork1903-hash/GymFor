/**
 * Dominio puro de media de ejercicios (sin I/O).
 *
 * Provee metadatos visuales (fotos reales, ilustraciones/modelos 2D vectoriales en SVG
 * y URLs remotas) para demostrar la ejecución de los ejercicios del catálogo maestro.
 */

import type { FC } from 'react'
import type { ImageSourcePropType } from 'react-native'
import type { SvgProps } from 'react-native-svg'

// Assets locales vectoriales (SVG)
import BurpeesSvg from '../../assets/ejercicios/burpees.svg'
import FlexionesSvg from '../../assets/ejercicios/flexiones.svg'
import FondosEnBancaSvg from '../../assets/ejercicios/fondos_en_banca.svg'
import HipThrustSvg from '../../assets/ejercicios/hip_thrust.svg'
import JalonAlPechoSvg from '../../assets/ejercicios/jalon_al_pecho.svg'
import PesoMuertoRumanoSvg from '../../assets/ejercicios/peso_muerto_rumano.svg'
import PlaceholderSvg from '../../assets/ejercicios/placeholder.svg'
import PlanchaFrontalSvg from '../../assets/ejercicios/plancha_frontal.svg'
import PressBancaMancuernasSvg from '../../assets/ejercicios/press_banca_mancuernas.svg'
import RemoMancuernaUnaManoSvg from '../../assets/ejercicios/remo_mancuerna_una_mano.svg'
import SentadillaBarraSvg from '../../assets/ejercicios/sentadilla_barra.svg'

// Assets locales rasterizados (PNG)
const CurlBicepsMancuernasPng: ImageSourcePropType = require('../../assets/ejercicios/curl_biceps_mancuernas.png')
const ElevacionesLateralesPng: ImageSourcePropType = require('../../assets/ejercicios/elevaciones_laterales.png')
const MountainClimbersPng: ImageSourcePropType = require('../../assets/ejercicios/mountain_climbers.png')
const RussianTwistsPng: ImageSourcePropType = require('../../assets/ejercicios/russian_twists.png')
const SentadillaBulgaraPng: ImageSourcePropType = require('../../assets/ejercicios/sentadilla_bulgara.png')

export type TipoMedia = 'foto' | 'svg' | 'url'

export interface MediaEjercicio {
  id: string
  ejercicioId: string
  tipo: TipoMedia
  uri?: string
  recurso?: ImageSourcePropType | FC<SvgProps>
  alt: string
  accessibilityLabel: string
}

/** Placeholder estándar cuando no existe media o falla la carga. */
export function mediaPlaceholder(ejercicioNombre?: string): MediaEjercicio {
  const nombre = ejercicioNombre ? ` para ${ejercicioNombre}` : ''
  return {
    id: 'media:placeholder',
    ejercicioId: '',
    tipo: 'svg',
    recurso: PlaceholderSvg,
    alt: `Ilustración no disponible${nombre}`,
    accessibilityLabel: `Ilustración no disponible${nombre}`,
  }
}

/**
 * Registro de media en memoria indexado por `ejercicioId`.
 * Cobertura de los ejercicios de las rutinas plantilla y catálogo maestro.
 */
export const REGISTRO_MEDIA_EJERCICIOS: Record<string, MediaEjercicio> = {
  // SVGs locales
  'ej:press_banca_mancuernas': {
    id: 'media:press_banca_mancuernas',
    ejercicioId: 'ej:press_banca_mancuernas',
    tipo: 'svg',
    recurso: PressBancaMancuernasSvg,
    alt: 'Ilustración 2D de Press de banca con mancuernas',
    accessibilityLabel: 'Ilustración demostrativa de Press de banca con mancuernas en banco plano',
  },
  'ej:sentadilla_barra': {
    id: 'media:sentadilla_barra',
    ejercicioId: 'ej:sentadilla_barra',
    tipo: 'svg',
    recurso: SentadillaBarraSvg,
    alt: 'Ilustración 2D de Sentadilla con barra',
    accessibilityLabel: 'Ilustración demostrativa de Sentadilla con barra trasera sobre hombros',
  },
  'ej:peso_muerto_rumano': {
    id: 'media:peso_muerto_rumano',
    ejercicioId: 'ej:peso_muerto_rumano',
    tipo: 'svg',
    recurso: PesoMuertoRumanoSvg,
    alt: 'Ilustración 2D de Peso muerto rumano',
    accessibilityLabel: 'Ilustración demostrativa de bisagra de cadera en Peso muerto rumano',
  },
  'ej:flexiones': {
    id: 'media:flexiones',
    ejercicioId: 'ej:flexiones',
    tipo: 'svg',
    recurso: FlexionesSvg,
    alt: 'Ilustración 2D de Flexiones de pecho',
    accessibilityLabel: 'Ilustración demostrativa de flexión de pecho manteniendo el cuerpo alineado',
  },
  'ej:plancha_frontal': {
    id: 'media:plancha_frontal',
    ejercicioId: 'ej:plancha_frontal',
    tipo: 'svg',
    recurso: PlanchaFrontalSvg,
    alt: 'Ilustración 2D de Plancha frontal isométrica',
    accessibilityLabel: 'Ilustración demostrativa de plancha isométrica sobre antebrazos',
  },
  'ej:fondos_en_banca': {
    id: 'media:fondos_en_banca',
    ejercicioId: 'ej:fondos_en_banca',
    tipo: 'svg',
    recurso: FondosEnBancaSvg,
    alt: 'Ilustración 2D de Fondos en banca para tríceps',
    accessibilityLabel: 'Ilustración demostrativa de fondos en banca con flexión de codos a 90 grados',
  },
  'ej:remo_mancuerna_una_mano': {
    id: 'media:remo_mancuerna_una_mano',
    ejercicioId: 'ej:remo_mancuerna_una_mano',
    tipo: 'svg',
    recurso: RemoMancuernaUnaManoSvg,
    alt: 'Ilustración 2D de Remo con mancuerna a una mano',
    accessibilityLabel: 'Ilustración demostrativa de remo con mancuerna apoyando rodilla en banco',
  },
  'ej:jalon_al_pecho': {
    id: 'media:jalon_al_pecho',
    ejercicioId: 'ej:jalon_al_pecho',
    tipo: 'svg',
    recurso: JalonAlPechoSvg,
    alt: 'Ilustración 2D de Jalón al pecho en polea',
    accessibilityLabel: 'Ilustración demostrativa de tracción vertical de polea hacia el pecho',
  },
  'ej:hip_thrust': {
    id: 'media:hip_thrust',
    ejercicioId: 'ej:hip_thrust',
    tipo: 'svg',
    recurso: HipThrustSvg,
    alt: 'Ilustración 2D de Hip Thrust con barra',
    accessibilityLabel: 'Ilustración demostrativa de extensión de cadera en banco con barra',
  },
  'ej:burpees': {
    id: 'media:burpees',
    ejercicioId: 'ej:burpees',
    tipo: 'svg',
    recurso: BurpeesSvg,
    alt: 'Ilustración 2D de Burpees con salto vertical',
    accessibilityLabel: 'Ilustración demostrativa de movimiento metabólico completo de burpees',
  },

  // Fotos / PNGs locales
  'ej:curl_biceps_mancuernas': {
    id: 'media:curl_biceps_mancuernas',
    ejercicioId: 'ej:curl_biceps_mancuernas',
    tipo: 'foto',
    recurso: CurlBicepsMancuernasPng,
    alt: 'Imagen demostrativa de Curl de bíceps con mancuernas',
    accessibilityLabel: 'Foto demostrativa de flexión de codo con mancuernas de pie',
  },
  'ej:elevaciones_laterales': {
    id: 'media:elevaciones_laterales',
    ejercicioId: 'ej:elevaciones_laterales',
    tipo: 'foto',
    recurso: ElevacionesLateralesPng,
    alt: 'Imagen demostrativa de Elevaciones laterales',
    accessibilityLabel: 'Foto demostrativa de abducción de hombros con mancuernas',
  },
  'ej:sentadilla_bulgara': {
    id: 'media:sentadilla_bulgara',
    ejercicioId: 'ej:sentadilla_bulgara',
    tipo: 'foto',
    recurso: SentadillaBulgaraPng,
    alt: 'Imagen demostrativa de Sentadilla búlgara',
    accessibilityLabel: 'Foto demostrativa de sentadilla unilateral con pie trasero apoyado en banco',
  },
  'ej:mountain_climbers': {
    id: 'media:mountain_climbers',
    ejercicioId: 'ej:mountain_climbers',
    tipo: 'foto',
    recurso: MountainClimbersPng,
    alt: 'Imagen demostrativa de Escaladores (Mountain Climbers)',
    accessibilityLabel: 'Foto demostrativa de escaladores en posición de plancha alta',
  },
  'ej:russian_twists': {
    id: 'media:russian_twists',
    ejercicioId: 'ej:russian_twists',
    tipo: 'foto',
    recurso: RussianTwistsPng,
    alt: 'Imagen demostrativa de Russian Twists',
    accessibilityLabel: 'Foto demostrativa de giros rusos para el core sentado en suelo',
  },

  // URLs remotas
  'ej:press_hombros_mancuernas': {
    id: 'media:press_hombros_mancuernas',
    ejercicioId: 'ej:press_hombros_mancuernas',
    tipo: 'url',
    uri: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=600&auto=format&fit=crop&q=80',
    alt: 'Fotografía de Press de hombros con mancuernas',
    accessibilityLabel: 'Foto de press militar con mancuernas sentado',
  },
  'ej:fondos_triceps_silla': {
    id: 'media:fondos_triceps_silla',
    ejercicioId: 'ej:fondos_triceps_silla',
    tipo: 'url',
    uri: 'https://images.unsplash.com/photo-1598971639058-fab3c3109a00?w=600&auto=format&fit=crop&q=80',
    alt: 'Fotografía de Fondos de tríceps en silla o banco',
    accessibilityLabel: 'Foto de fondos con soporte en silla para tríceps',
  },
  'ej:remo_sentado_polea': {
    id: 'media:remo_sentado_polea',
    ejercicioId: 'ej:remo_sentado_polea',
    tipo: 'url',
    uri: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&auto=format&fit=crop&q=80',
    alt: 'Fotografía de Remo sentado en polea baja',
    accessibilityLabel: 'Foto de remo sentado con agarre neutro en máquina de polea',
  },
  'ej:remo_vertical': {
    id: 'media:remo_vertical',
    ejercicioId: 'ej:remo_vertical',
    tipo: 'url',
    uri: 'https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?w=600&auto=format&fit=crop&q=80',
    alt: 'Fotografía de Remo vertical al mentón con barra',
    accessibilityLabel: 'Foto de remo vertical con barra de pie',
  },
  'ej:face_pulls': {
    id: 'media:face_pulls',
    ejercicioId: 'ej:face_pulls',
    tipo: 'url',
    uri: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=600&auto=format&fit=crop&q=80',
    alt: 'Fotografía de Face pulls en polea',
    accessibilityLabel: 'Foto de jalón con cuerda a la altura de la cara',
  },
  'ej:curl_isquiotibiales_maquina': {
    id: 'media:curl_isquiotibiales_maquina',
    ejercicioId: 'ej:curl_isquiotibiales_maquina',
    tipo: 'url',
    uri: 'https://images.unsplash.com/photo-1434682881908-b43d0467b798?w=600&auto=format&fit=crop&q=80',
    alt: 'Fotografía de Curl de isquiotibiales en máquina',
    accessibilityLabel: 'Foto de curl femoral tumbado en máquina',
  },
  'ej:puente_pelvis_suelo': {
    id: 'media:puente_pelvis_suelo',
    ejercicioId: 'ej:puente_pelvis_suelo',
    tipo: 'url',
    uri: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=600&auto=format&fit=crop&q=80',
    alt: 'Fotografía de Puente de pelvis en suelo',
    accessibilityLabel: 'Foto de puente de glúteos apoyado en esterilla',
  },
  'ej:sentadilla_peso_corporal': {
    id: 'media:sentadilla_peso_corporal',
    ejercicioId: 'ej:sentadilla_peso_corporal',
    tipo: 'url',
    uri: 'https://images.unsplash.com/photo-1574680096145-d05b474e2155?w=600&auto=format&fit=crop&q=80',
    alt: 'Fotografía de Sentadillas con peso corporal',
    accessibilityLabel: 'Foto de sentadilla libre sin peso adicional',
  },
  'ej:prensa_piernas': {
    id: 'media:prensa_piernas',
    ejercicioId: 'ej:prensa_piernas',
    tipo: 'url',
    uri: 'https://images.unsplash.com/photo-1534367507873-d2d7e24c797f?w=600&auto=format&fit=crop&q=80',
    alt: 'Fotografía de Prensa de piernas inclinada',
    accessibilityLabel: 'Foto de prensa de 45 grados en máquina',
  },
  'ej:zancadas_mancuernas': {
    id: 'media:zancadas_mancuernas',
    ejercicioId: 'ej:zancadas_mancuernas',
    tipo: 'url',
    uri: 'https://images.unsplash.com/photo-1507398941214-572c25f4b1dc?w=600&auto=format&fit=crop&q=80',
    alt: 'Fotografía de Zancadas con mancuernas',
    accessibilityLabel: 'Foto de zancadas al frente sosteniendo mancuernas',
  },
  'ej:zancadas_peso_corporal': {
    id: 'media:zancadas_peso_corporal',
    ejercicioId: 'ej:zancadas_peso_corporal',
    tipo: 'url',
    uri: 'https://images.unsplash.com/photo-1538805060514-97d9cc17730c?w=600&auto=format&fit=crop&q=80',
    alt: 'Fotografía de Zancadas con peso corporal',
    accessibilityLabel: 'Foto de zancadas alternadas con peso corporal',
  },
  'ej:extension_piernas_maquina': {
    id: 'media:extension_piernas_maquina',
    ejercicioId: 'ej:extension_piernas_maquina',
    tipo: 'url',
    uri: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=600&auto=format&fit=crop&q=80',
    alt: 'Fotografía de Extensiones de pierna en máquina',
    accessibilityLabel: 'Foto de extensión de rodillas en máquina de cuádriceps',
  },
  'ej:elevacion_gemelos_maquina': {
    id: 'media:elevacion_gemelos_maquina',
    ejercicioId: 'ej:elevacion_gemelos_maquina',
    tipo: 'url',
    uri: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=600&auto=format&fit=crop&q=80',
    alt: 'Fotografía de Elevaciones de gemelos en máquina',
    accessibilityLabel: 'Foto de elevación de talones de pie en máquina de gemelos',
  },
  'ej:peso_muerto_convencional': {
    id: 'media:peso_muerto_convencional',
    ejercicioId: 'ej:peso_muerto_convencional',
    tipo: 'url',
    uri: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=600&auto=format&fit=crop&q=80',
    alt: 'Fotografía de Peso muerto convencional con barra',
    accessibilityLabel: 'Foto de levantamiento de barra desde el suelo en peso muerto',
  },
  'ej:saltos_al_cajon': {
    id: 'media:saltos_al_cajon',
    ejercicioId: 'ej:saltos_al_cajon',
    tipo: 'url',
    uri: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=600&auto=format&fit=crop&q=80',
    alt: 'Fotografía de Saltos al cajón pliométrico',
    accessibilityLabel: 'Foto de salto explosivo sobre cajón pliométrico',
  },
  'ej:plancha_elevacion_piernas': {
    id: 'media:plancha_elevacion_piernas',
    ejercicioId: 'ej:plancha_elevacion_piernas',
    tipo: 'url',
    uri: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=600&auto=format&fit=crop&q=80',
    alt: 'Fotografía de Plancha con elevación alternada de piernas',
    accessibilityLabel: 'Foto de plancha isométrica elevando una pierna para estabilidad de core',
  },
  'ej:elevacion_piernas_suelo': {
    id: 'media:elevacion_piernas_suelo',
    ejercicioId: 'ej:elevacion_piernas_suelo',
    tipo: 'url',
    uri: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=600&auto=format&fit=crop&q=80',
    alt: 'Fotografía de Elevaciones de piernas en el suelo',
    accessibilityLabel: 'Foto de elevación de piernas acostado para abdomen inferior',
  },
  'ej:saltos_tijera': {
    id: 'media:saltos_tijera',
    ejercicioId: 'ej:saltos_tijera',
    tipo: 'url',
    uri: 'https://images.unsplash.com/photo-1434682881908-b43d0467b798?w=600&auto=format&fit=crop&q=80',
    alt: 'Fotografía de Saltos de tijera (Jumping Jacks)',
    accessibilityLabel: 'Foto de saltos de tijera abriendo brazos y piernas',
  },
  'ej:rodillas_al_pecho': {
    id: 'media:rodillas_al_pecho',
    ejercicioId: 'ej:rodillas_al_pecho',
    tipo: 'url',
    uri: 'https://images.unsplash.com/photo-1574680096145-d05b474e2155?w=600&auto=format&fit=crop&q=80',
    alt: 'Fotografía de Rodillas al pecho en carrera estática',
    accessibilityLabel: 'Foto de ejercicio cardiovascular elevando rodillas hacia el pecho',
  },
  'ej:boxeo_sombra': {
    id: 'media:boxeo_sombra',
    ejercicioId: 'ej:boxeo_sombra',
    tipo: 'url',
    uri: 'https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?w=600&auto=format&fit=crop&q=80',
    alt: 'Fotografía de Boxeo en sombra',
    accessibilityLabel: 'Foto de sombra con lanzamientos de golpes en guardia',
  },
  'ej:estiramientos_cuerpo_completo': {
    id: 'media:estiramientos_cuerpo_completo',
    ejercicioId: 'ej:estiramientos_cuerpo_completo',
    tipo: 'url',
    uri: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=600&auto=format&fit=crop&q=80',
    alt: 'Fotografía de Estiramientos de todo el cuerpo',
    accessibilityLabel: 'Foto de sesión de elongación y movilidad general',
  },
  'ej:yoga_movilidad': {
    id: 'media:yoga_movilidad',
    ejercicioId: 'ej:yoga_movilidad',
    tipo: 'url',
    uri: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=600&auto=format&fit=crop&q=80',
    alt: 'Fotografía de Rutina suave de yoga o movilidad',
    accessibilityLabel: 'Foto de posturas suaves de yoga sobre esterilla',
  },
}

/**
 * Obtiene la media asignada a un ejercicio o `null` si no existe.
 * Función pura sin efectos secundarios ni I/O.
 */
export function obtenerMediaEjercicio(ejercicioId: string): MediaEjercicio | null {
  return REGISTRO_MEDIA_EJERCICIOS[ejercicioId] ?? null
}
