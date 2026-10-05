/**
 * Repositorio de usuarios. Único punto de acceso a la tabla `usuarios`.
 */

import type { SQLiteDatabase } from 'expo-sqlite'

import type { Nivel, Objetivo, Sexo, Usuario } from '../../domain/types'
import { ahoraISO } from '../../utils/id'

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
  sincronizado: number
}

function aDominio(fila: UsuarioFila): Usuario {
  return {
    ...fila,
    configuracion_entrenamiento: JSON.parse(fila.configuracion_entrenamiento || '{}') as Record<
      string,
      unknown
    >,
    sincronizado: fila.sincronizado === 1 ? 1 : 0,
  }
}

export type NuevoUsuario = Omit<Usuario, 'creado_en' | 'actualizado_en' | 'sincronizado'>

export async function crearUsuario(db: SQLiteDatabase, usuario: NuevoUsuario): Promise<Usuario> {
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
  db: SQLiteDatabase,
  id: string,
): Promise<Usuario | null> {
  const fila = await db.getFirstAsync<UsuarioFila>('SELECT * FROM usuarios WHERE id = ?', [id])
  return fila ? aDominio(fila) : null
}

export async function listarUsuarios(db: SQLiteDatabase): Promise<Usuario[]> {
  const filas = await db.getAllAsync<UsuarioFila>('SELECT * FROM usuarios ORDER BY creado_en ASC')
  return filas.map(aDominio)
}

export async function actualizarUsuario(
  db: SQLiteDatabase,
  id: string,
  cambios: Partial<Omit<NuevoUsuario, 'id'>>,
): Promise<void> {
  const actual = await obtenerUsuarioPorId(db, id)
  if (!actual) {
    throw new Error(`Usuario no encontrado: ${id}`)
  }
  const fusionado: NuevoUsuario = { ...actual, ...cambios }
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

export async function eliminarUsuario(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM usuarios WHERE id = ?', [id])
}
