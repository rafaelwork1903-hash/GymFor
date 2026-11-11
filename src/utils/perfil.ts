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

/** Nombres en español de los 12 meses del año en minúsculas/capitalizados. */
export const MESES_ANIO = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
] as const

/** Nombres abreviados de los días de la semana (iniciando en lunes). */
export const DIAS_SEMANA_ABREV = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'] as const

/**
 * Devuelve el total de días que tiene un mes para un año determinado (1..31),
 * considerando años bisiestos. `mes` va de 1 a 12.
 */
export function obtenerDiasDelMes(anio: number, mes: number): number {
  return new Date(anio, mes, 0).getDate()
}

/**
 * Devuelve el índice del primer día de la semana para un mes y año dados,
 * donde Lunes = 0, Martes = 1, ..., Domingo = 6. `mes` va de 1 a 12.
 */
export function obtenerPrimerDiaSemana(anio: number, mes: number): number {
  const diaSemanaJS = new Date(anio, mes - 1, 1).getDay() // 0 = Domingo, 1 = Lunes, ...
  return (diaSemanaJS + 6) % 7
}

/**
 * Construye una cadena en formato `AAAA-MM-DD` a partir de sus componentes numéricos.
 */
export function construirFechaISO(anio: number, mes: number, dia: number): string {
  const a = String(anio).padStart(4, '0')
  const m = String(mes).padStart(2, '0')
  const d = String(dia).padStart(2, '0')
  return `${a}-${m}-${d}`
}

/**
 * Desglosa una cadena `AAAA-MM-DD` en sus componentes numéricos `{ anio, mes, dia }`.
 * Si la cadena no es válida o está vacía, devuelve valores por defecto seguros.
 */
export function desglosarFechaISO(
  fechaISO: string,
  defectoAnio: number = 2000,
): { anio: number; mes: number; dia: number } {
  const partes = fechaISO.trim().split('-')
  if (partes.length === 3) {
    const anio = Number(partes[0])
    const mes = Number(partes[1])
    const dia = Number(partes[2])
    if (
      Number.isInteger(anio) &&
      Number.isInteger(mes) &&
      Number.isInteger(dia) &&
      mes >= 1 &&
      mes <= 12 &&
      dia >= 1 &&
      dia <= 31
    ) {
      return { anio, mes, dia }
    }
  }
  return { anio: defectoAnio, mes: 1, dia: 1 }
}

/**
 * Formatea una fecha `AAAA-MM-DD` a texto legible en español (ej. `14 de mayo de 1996`).
 * Si la fecha está vacía o es inválida, retorna una cadena vacía.
 */
export function formatearFechaLegible(fechaISO: string): string {
  const limpio = fechaISO.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(limpio)) {
    return ''
  }
  const [anioTxt, mesTxt, diaTxt] = limpio.split('-')
  const anio = Number(anioTxt)
  const mes = Number(mesTxt)
  const dia = Number(diaTxt)
  if (mes < 1 || mes > 12) {
    return ''
  }
  const nombreMes = MESES_ANIO[mes - 1]
  return `${dia} de ${nombreMes.toLowerCase()} de ${anio}`
}

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
