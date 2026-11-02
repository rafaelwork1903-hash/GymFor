/**
 * Utilidades de compresión, conversión a WEBP y persistencia local de imágenes
 * personalizadas asociadas a ejercicios dentro de una rutina.
 */

import { Directory, File, Paths } from 'expo-file-system'
import * as ImageManipulator from 'expo-image-manipulator'
import { Platform } from 'react-native'

import { generarId } from './id'

/** Ancho máximo por defecto (px) al redimensionar imágenes manteniendo proporción. */
export const ANCHO_MAXIMO_IMAGEN = 800

/** Calidad de compresión WEBP por defecto (0 a 1). */
export const CALIDAD_COMPRESION_WEBP = 0.8

/** Subdirectorio persistente dentro de `Paths.document` para imágenes comprimidas. */
export const DIRECTORIO_IMAGENES_RUTINA = 'ejercicios_rutina'

export interface OpcionesCompresionImagen {
  /** Ancho máximo en píxeles (mantiene la relación de aspecto). Por defecto 800. */
  anchoMaximo?: number
  /** Calidad de compresión WEBP en el rango (0, 1]. Por defecto 0.8. */
  calidad?: number
  /** Ancho original conocido (px): si es menor o igual a `anchoMaximo`, no reescala hacia arriba. */
  anchoOriginal?: number
}

/**
 * Valida si una cadena corresponde a una URL remota (`http`/`https`) o un URI
 * de imagen local soportado (`file://`, `content://`, `blob:`, `data:image/`).
 */
export function esUriImagenValida(uri: string): boolean {
  const limpia = uri.trim()
  if (limpia === '' || /\s/.test(limpia)) {
    return false
  }
  return /^(https?:\/\/.+|file:\/\/.+|content:\/\/.+|blob:.+|data:image\/[a-zA-Z0-9.+-]+;base64,.+)$/i.test(
    limpia,
  )
}

/**
 * Copia el archivo WEBP generado en caché al directorio persistente de documentos
 * de la aplicación cuando se ejecuta en nativo y `Paths.document` está disponible.
 */
async function persistirArchivoLocal(uriTemporal: string): Promise<string> {
  if (Platform.OS === 'web' || !uriTemporal.startsWith('file://')) {
    return uriTemporal
  }

  const uriDocumentos = Paths.document?.uri
  if (!uriDocumentos || !uriDocumentos.startsWith('file://')) {
    return uriTemporal
  }

  if (uriTemporal.startsWith(uriDocumentos)) {
    return uriTemporal
  }

  const directorioDestino = new Directory(Paths.document, DIRECTORIO_IMAGENES_RUTINA)
  if (!directorioDestino.exists) {
    directorioDestino.create({ intermediates: true, idempotent: true })
  }

  const archivoOrigen = new File(uriTemporal)
  const archivoDestino = new File(directorioDestino, `ejercicio_${generarId()}.webp`)
  await archivoOrigen.copy(archivoDestino, { overwrite: true })
  return archivoDestino.uri
}

/**
 * Redimensiona y comprime una imagen al formato WEBP usando `ImageManipulator.manipulateAsync`
 * y devuelve el URI persistente resultante.
 *
 * @param uri URI de entrada de la imagen seleccionada o capturada.
 * @param opciones Parámetros opcionales de ancho máximo y calidad de compresión.
 * @returns URI de la imagen resultante en formato WEBP.
 */
export async function comprimirImagen(
  uri: string,
  opciones: OpcionesCompresionImagen = {},
): Promise<string> {
  const uriLimpia = uri.trim()
  if (uriLimpia === '') {
    throw new Error('La URI de la imagen no puede estar vacía.')
  }

  const anchoMaximo = opciones.anchoMaximo ?? ANCHO_MAXIMO_IMAGEN
  const calidad = opciones.calidad ?? CALIDAD_COMPRESION_WEBP

  if (!Number.isFinite(anchoMaximo) || anchoMaximo <= 0) {
    throw new Error('El ancho máximo de la imagen debe ser mayor a 0.')
  }
  if (!Number.isFinite(calidad) || calidad <= 0 || calidad > 1) {
    throw new Error('La calidad de compresión debe estar entre 0 (excluido) y 1.')
  }

  const requiereRedimension =
    opciones.anchoOriginal === undefined ||
    opciones.anchoOriginal <= 0 ||
    opciones.anchoOriginal > anchoMaximo

  const acciones: ImageManipulator.Action[] = requiereRedimension
    ? [{ resize: { width: Math.round(anchoMaximo) } }]
    : []

  const opcionesGuardado: ImageManipulator.SaveOptions = {
    compress: calidad,
    format: ImageManipulator.SaveFormat.WEBP,
    ...(Platform.OS === 'web' ? { base64: true } : {}),
  }

  const resultado = await ImageManipulator.manipulateAsync(
    uriLimpia,
    acciones,
    opcionesGuardado,
  )

  if (Platform.OS === 'web' && resultado.base64) {
    return `data:image/webp;base64,${resultado.base64}`
  }

  return persistirArchivoLocal(resultado.uri)
}
