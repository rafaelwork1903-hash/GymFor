/**
 * Repositorio de usuarios. Único punto de acceso a la tabla `usuarios`.
 */

import type { Nivel, Objetivo, Sexo, Usuario } from '../../domain/types'
import { ahoraISO } from '../../utils/id'
import { aEnteroBooleano } from '../dialect'
import type { ConexionBD } from '../port'

interface UsuarioFila {
  id: string
  nombre: string
  fecha_nacimiento: string | null
  sexo: Sexo | null
  peso_inicial: number | null
  objetivo: Objetivo | null
  nivel: Nivel | null
  configuracion_entrenamiento: string
  creado_en: string
  actualizado_en: string
  sincronizado: number | boolean
}

function aDominio(fila: UsuarioFila): Usuario {
  return {
    ...fila,
    configuracion_entrenamiento: JSON.parse(fila.configuracion_entrenamiento || '{}') as Record<
      string,
      unknown
    >,
    sincronizado: aEnteroBooleano(fila.sincronizado),
  }
}

export type NuevoUsuario = Omit<Usuario, 'creado_en' | 'actualizado_en' | 'sincronizado'>

export async function crearUsuario(db: ConexionBD, usuario: NuevoUsuario): Promise<Usuario> {
  const ahora = ahoraISO()
  await db.runAsync(
    `INSERT INTO usuarios (
      id, nombre, fecha_nacimiento, sexo, peso_inicial, objetivo, nivel,
      configuracion_entrenamiento, creado_en, actualizado_en, sincronizado
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [
      usuario.id,
      usuario.nombre,
      usuario.fecha_nacimiento,
      usuario.sexo,
      usuario.peso_inicial,
      usuario.objetivo,
      usuario.nivel,
      JSON.stringify(usuario.configuracion_entrenamiento ?? {}),
      ahora,
      ahora,
    ],
  )
  return { ...usuario, creado_en: ahora, actualizado_en: ahora, sincronizado: 0 }
}

export async function obtenerUsuarioPorId(
  db: ConexionBD,
  id: string,
): Promise<Usuario | null> {
  const fila = await db.getFirstAsync<UsuarioFila>('SELECT * FROM usuarios WHERE id = ?', [id])
  return fila ? aDominio(fila) : null
}

export async function listarUsuarios(db: ConexionBD): Promise<Usuario[]> {
  const filas = await db.getAllAsync<UsuarioFila>('SELECT * FROM usuarios ORDER BY creado_en ASC')
  return filas.map(aDominio)
}

export async function actualizarUsuario(
  db: ConexionBD,
  id: string,
  cambios: Partial<Omit<NuevoUsuario, 'id'>>,
): Promise<void> {
  const actual = await obtenerUsuarioPorId(db, id)
  if (!actual) {
    throw new Error(`Usuario no encontrado: ${id}`)
  }
  const cambiosDefinidos = Object.fromEntries(
    Object.entries(cambios).filter(([, valor]) => valor !== undefined),
  ) as Partial<Omit<NuevoUsuario, 'id'>>
  const fusionado: NuevoUsuario = { ...actual, ...cambiosDefinidos }
  await db.runAsync(
    `UPDATE usuarios SET
      nombre = ?, fecha_nacimiento = ?, sexo = ?, peso_inicial = ?, objetivo = ?,
      nivel = ?, configuracion_entrenamiento = ?, actualizado_en = ?, sincronizado = 0
    WHERE id = ?`,
    [
      fusionado.nombre,
      fusionado.fecha_nacimiento,
      fusionado.sexo,
      fusionado.peso_inicial,
      fusionado.objetivo,
      fusionado.nivel,
      JSON.stringify(fusionado.configuracion_entrenamiento),
      ahoraISO(),
      id,
    ],
  )
}

export async function eliminarUsuario(db: ConexionBD, id: string): Promise<void> {
  await db.runAsync('DELETE FROM usuarios WHERE id = ?', [id])
}
