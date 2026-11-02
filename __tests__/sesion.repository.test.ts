import type { SQLiteDatabase } from 'expo-sqlite'

import {
  actualizarSerie,
  eliminarSerie,
  eliminarSesion,
} from '../src/db/repositories/sesion.repository'
import type { SerieReal } from '../src/domain/types'

/** Crea un objeto db con la interfaz mínima que usan los repositorios. */
function crearBDMock(metodos: {
  runAsync?: jest.Mock
  getFirstAsync?: jest.Mock
  withTransactionAsync?: jest.Mock
}): SQLiteDatabase {
  const runAsync = metodos.runAsync ?? jest.fn().mockResolvedValue(undefined)
  const getFirstAsync = metodos.getFirstAsync ?? jest.fn().mockResolvedValue(null)
  const withTransactionAsync =
    metodos.withTransactionAsync ??
    jest.fn(async (cb: () => Promise<void>) => {
      await cb()
    })
  return {
    runAsync,
    getFirstAsync,
    withTransactionAsync,
  } as unknown as SQLiteDatabase
}

describe('sesion.repository', () => {
  const serieExistente: SerieReal = {
    id: 'se-2',
    registro_id: 'reg-1',
    numero_serie: 2,
    peso_levantado: 60,
    reps_realizadas: 10,
    rpe_serie: 8,
    rir: null,
    completada: 1,
    notas: null,
  }

  describe('eliminarSesion', () => {
    it('éxito: ejecuta el DELETE por id de la sesión', async () => {
      const runAsync = jest.fn().mockResolvedValue(undefined)

      await eliminarSesion(crearBDMock({ runAsync }), 's1')

      expect(runAsync).toHaveBeenCalledTimes(1)
      expect(runAsync).toHaveBeenCalledWith('DELETE FROM sesiones WHERE id = ?', ['s1'])
    })

    it('error: propaga el fallo de la BD al caller (el store lo captura)', async () => {
      const runAsync = jest.fn().mockRejectedValue(new Error('disk full'))

      await expect(eliminarSesion(crearBDMock({ runAsync }), 's1')).rejects.toThrow('disk full')
      expect(runAsync).toHaveBeenCalledTimes(1)
    })
  })

  describe('actualizarSerie', () => {
    it('arma el UPDATE correcto con los cambios, conserva los no editados e ignora numero_serie', async () => {
      const getFirstAsync = jest.fn().mockResolvedValue(serieExistente)
      const runAsync = jest.fn().mockResolvedValue(undefined)
      const db = crearBDMock({ getFirstAsync, runAsync })

      const resultado = await actualizarSerie(db, 'se-2', {
        peso_levantado: 65,
        reps_realizadas: 9,
        rpe_serie: null,
        notas: 'agarre cerrado',
        // Incluso si llegara numero_serie forzado en runtime, no debe mutar.
        ...({ numero_serie: 99 } as Record<string, unknown>),
      })

      expect(getFirstAsync).toHaveBeenCalledWith('SELECT * FROM series WHERE id = ?', ['se-2'])
      expect(runAsync).toHaveBeenCalledTimes(1)
      const [sql, params] = runAsync.mock.calls[0] as [string, unknown[]]
      expect(sql).toMatch(/UPDATE\s+series/i)
      expect(sql).toMatch(
        /SET\s+peso_levantado\s*=\s*\?,\s*reps_realizadas\s*=\s*\?,\s*rpe_serie\s*=\s*\?,\s*rir\s*=\s*\?,\s*completada\s*=\s*\?,\s*notas\s*=\s*\?/i,
      )
      expect(sql).toMatch(/WHERE\s+id\s*=\s*\?/i)
      expect(params).toEqual([65, 9, null, null, 1, 'agarre cerrado', 'se-2'])
      expect(resultado).toEqual({
        id: 'se-2',
        registro_id: 'reg-1',
        numero_serie: 2,
        peso_levantado: 65,
        reps_realizadas: 9,
        rpe_serie: null,
        rir: null,
        completada: 1,
        notas: 'agarre cerrado',
      })
    })

    it('lanza error descriptivo si la serie no existe en BD y no ejecuta UPDATE', async () => {
      const getFirstAsync = jest.fn().mockResolvedValue(null)
      const runAsync = jest.fn()

      await expect(
        actualizarSerie(crearBDMock({ getFirstAsync, runAsync }), 'se-inexistente', {
          peso_levantado: 70,
        }),
      ).rejects.toThrow('Serie no encontrada: se-inexistente')
      expect(runAsync).not.toHaveBeenCalled()
    })
  })

  describe('eliminarSerie', () => {
    it('ejecuta DELETE + renumeración contigua dentro de withTransactionAsync', async () => {
      const getFirstAsync = jest.fn().mockResolvedValue({
        registro_id: 'reg-1',
        numero_serie: 2,
      })
      const runAsync = jest.fn().mockResolvedValue(undefined)
      const withTransactionAsync = jest.fn(async (cb: () => Promise<void>) => {
        await cb()
      })
      const db = crearBDMock({ getFirstAsync, runAsync, withTransactionAsync })

      await eliminarSerie(db, 'se-2')

      expect(withTransactionAsync).toHaveBeenCalledTimes(1)
      expect(getFirstAsync).toHaveBeenCalledWith(
        'SELECT registro_id, numero_serie FROM series WHERE id = ?',
        ['se-2'],
      )
      expect(runAsync).toHaveBeenCalledTimes(2)
      expect(runAsync).toHaveBeenNthCalledWith(1, 'DELETE FROM series WHERE id = ?', ['se-2'])
      const [sqlRenum, paramsRenum] = runAsync.mock.calls[1] as [string, unknown[]]
      expect(sqlRenum).toMatch(/UPDATE\s+series/i)
      expect(sqlRenum).toMatch(/SET\s+numero_serie\s*=\s*numero_serie\s*-\s*1/i)
      expect(sqlRenum).toMatch(/WHERE\s+registro_id\s*=\s*\?\s+AND\s+numero_serie\s*>\s*\?/i)
      expect(paramsRenum).toEqual(['reg-1', 2])
    })

    it('lanza error si la serie a eliminar no existe y no ejecuta DELETE ni UPDATE', async () => {
      const getFirstAsync = jest.fn().mockResolvedValue(null)
      const runAsync = jest.fn()

      await expect(
        eliminarSerie(crearBDMock({ getFirstAsync, runAsync }), 'se-inexistente'),
      ).rejects.toThrow('Serie no encontrada: se-inexistente')
      expect(runAsync).not.toHaveBeenCalled()
    })
  })
})
