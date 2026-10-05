/**
 * Repositorio de métricas de progreso calculadas. Único punto de acceso a la
 * tabla `metricas_progreso`.
 */

import type { SQLiteDatabase } from 'expo-sqlite'

import type { MetricaProgreso, Tendencia } from '../../domain/types'
import { ahoraISO } from '../../utils/id'

interface MetricaFila {
  id: string
  usuario_id: string
  ejercicio_id: string
  fecha: string
  volumen_total: number
  rm1_estimado: number
  series_efectivas_semana: number
  tendencia: Tendencia
  creado_en: string
  actualizado_en: string
  sincronizado: number
}

function aDominio(fila: MetricaFila): MetricaProgreso {
  return { ...fila, sincronizado: fila.sincronizado === 1 ? 1 : 0 }
}

export type NuevaMetrica = Omit<MetricaProgreso, 'creado_en' | 'actualizado_en' | 'sincronizado'>

export async function guardarMetrica(
  db: SQLiteDatabase,
  metrica: NuevaMetrica,
): Promise<MetricaProgreso> {
  const ahora = ahoraISO()
  await db.runAsync(
    `INSERT INTO metricas_progreso (
      id, usuario_id, ejercicio_id, fecha, volumen_total, rm1_estimado,
      series_efectivas_semana, tendencia, creado_en, actualizado_en, sincronizado
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [
      metrica.id,
      metrica.usuario_id,
      metrica.ejercicio_id,
      metrica.fecha,
      metrica.volumen_total,
      metrica.rm1_estimado,
      metrica.series_efectivas_semana,
      metrica.tendencia,
      ahora,
      ahora,
    ],
  )
  return { ...metrica, creado_en: ahora, actualizado_en: ahora, sincronizado: 0 }
}

/** Historial de métricas de un ejercicio, de más reciente a más antigua. */
export async function listarMetricasPorEjercicio(
  db: SQLiteDatabase,
  usuarioId: string,
  ejercicioId: string,
  limite = 30,
): Promise<MetricaProgreso[]> {
  const filas = await db.getAllAsync<MetricaFila>(
    `SELECT * FROM metricas_progreso
     WHERE usuario_id = ? AND ejercicio_id = ?
     ORDER BY fecha DESC
     LIMIT ?`,
    [usuarioId, ejercicioId, limite],
  )
  return filas.map(aDominio)
}
