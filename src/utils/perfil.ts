/**
 * Utilidades puras de validación y normalización del perfil de usuario.
 *
 * Sin dependencias de React Native, Tamagui ni acceso a BD para poder
 * probarse de forma determinista desde suites unitarias.
 */

import {
  NIVELES,
  OBJETIVOS,
  SEXOS,
  type Nivel,
  type Objetivo,
  type Sexo,
  type Usuario,
} from '../domain/types'

/** Campos editables del perfil de un atleta. */
export type DatosPerfilValidados = Omit<
  Usuario,
  'id' | 'configuracion_entrenamiento' | 'creado_en' | 'actualizado_en' | 'sincronizado'
>

/** Estado crudo de los controles del formulario de perfil. */
export interface BorradorPerfil {
  nombre: string
  fecha_nacimiento: string
  sexo: Sexo | null
  peso_inicial: string
  objetivo: Objetivo | null
  nivel: Nivel | null
}

/** Mensajes de validación inline por campo del formulario de perfil. */
export interface ErroresPerfil {
  nombre?: string
  fecha_nacimiento?: string
  sexo?: string
  peso_inicial?: string
  objetivo?: string
  nivel?: string
}

/** Resultado discriminado de validar un `BorradorPerfil`. */
export type ResultadoValidacionPerfil =
  | { valido: true; datos: DatosPerfilValidados; errores: ErroresPerfil }
  | { valido: false; errores: ErroresPerfil }

const ANIO_MINIMO_NACIMIENTO = 1900

/**
 * Formatea una instancia `Date` como fecha local `AAAA-MM-DD`.
 */
export function fechaLocalISO(referencia: Date = new Date()): string {
  const anio = referencia.getFullYear()
  const mes = String(referencia.getMonth() + 1).padStart(2, '0')
  const dia = String(referencia.getDate()).padStart(2, '0')
  return `${anio}-${mes}-${dia}`
}

/**
 * Valida una fecha de nacimiento opcional en formato `AAAA-MM-DD`, verificando
 * que exista realmente en el calendario (incluyendo años bisiestos) y que no
 * sea posterior a `hoyISO`.
 */
export function validarFechaNacimiento(
  texto: string,
  hoyISO: string = fechaLocalISO(),
): { valido: true; valor: string | null } | { valido: false; error: string } {
  const limpio = texto.trim()
  if (limpio === '') {
    return { valido: true, valor: null }
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(limpio)) {
    return { valido: false, error: 'Usa el formato AAAA-MM-DD (ej. 1995-04-21).' }
  }

  const [anioTxt, mesTxt, diaTxt] = limpio.split('-')
  const anio = Number(anioTxt)
  const mes = Number(mesTxt)
  const dia = Number(diaTxt)

  const fechaUTC = new Date(Date.UTC(anio, mes - 1, dia))
  const existeEnCalendario =
    fechaUTC.getUTCFullYear() === anio &&
    fechaUTC.getUTCMonth() === mes - 1 &&
    fechaUTC.getUTCDate() === dia

  if (!existeEnCalendario) {
    return { valido: false, error: 'La fecha indicada no existe en el calendario.' }
  }

  if (anio < ANIO_MINIMO_NACIMIENTO) {
    return {
      valido: false,
      error: `Ingresa un año de nacimiento válido (desde ${ANIO_MINIMO_NACIMIENTO}).`,
    }
  }

  if (limpio > hoyISO) {
    return { valido: false, error: 'La fecha de nacimiento no puede ser futura.' }
  }

  return { valido: true, valor: limpio }
}

/**
 * Valida y convierte el peso inicial opcional aceptando punto o coma decimal.
 * Exige un número finito estrictamente mayor que cero.
 */
export function validarPesoInicial(
  texto: string,
): { valido: true; valor: number | null } | { valido: false; error: string } {
  const limpio = texto.trim()
  if (limpio === '') {
    return { valido: true, valor: null }
  }

  const normalizado = limpio.replace(',', '.')
  if (!/^\d+(\.\d+)?$/.test(normalizado)) {
    return { valido: false, error: 'Ingresa un peso numérico válido (ej. 72,5).' }
  }

  const numero = Number(normalizado)
  if (!Number.isFinite(numero) || numero <= 0) {
    return { valido: false, error: 'El peso inicial debe ser mayor a 0.' }
  }

  return { valido: true, valor: numero }
}

/**
 * Valida todos los campos del formulario de perfil y devuelve los datos listos
 * para persistir o el mapa de errores inline por campo.
 */
export function validarFormularioPerfil(
  borrador: BorradorPerfil,
  hoyISO: string = fechaLocalISO(),
): ResultadoValidacionPerfil {
  const errores: ErroresPerfil = {}

  const nombreLimpio = borrador.nombre.trim()
  if (nombreLimpio.length === 0) {
    errores.nombre = 'El nombre es obligatorio.'
  }

  const resFecha = validarFechaNacimiento(borrador.fecha_nacimiento, hoyISO)
  if (!resFecha.valido) {
    errores.fecha_nacimiento = resFecha.error
  }

  const resPeso = validarPesoInicial(borrador.peso_inicial)
  if (!resPeso.valido) {
    errores.peso_inicial = resPeso.error
  }

  if (borrador.sexo !== null && !(SEXOS as readonly string[]).includes(borrador.sexo)) {
    errores.sexo = 'Selecciona una opción de sexo válida.'
  }

  if (borrador.objetivo !== null && !(OBJETIVOS as readonly string[]).includes(borrador.objetivo)) {
    errores.objetivo = 'Selecciona un objetivo válido.'
  }

  if (borrador.nivel !== null && !(NIVELES as readonly string[]).includes(borrador.nivel)) {
    errores.nivel = 'Selecciona un nivel válido.'
  }

  if (Object.keys(errores).length > 0 || !resFecha.valido || !resPeso.valido) {
    return { valido: false, errores }
  }

  return {
    valido: true,
    datos: {
      nombre: nombreLimpio,
      fecha_nacimiento: resFecha.valor,
      sexo: borrador.sexo,
      peso_inicial: resPeso.valor,
      objetivo: borrador.objetivo,
      nivel: borrador.nivel,
    },
    errores: {},
  }
}
