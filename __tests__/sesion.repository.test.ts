import type { ConexionBD } from '../src/db/port'
import {
  actualizarSerie,
  eliminarSerie,
  eliminarSesion,
  finalizarSesion,
  obtenerSesionAbierta,
  reordenarSeries,
} from '../src/db/repositories/sesion.repository'
import type { SerieReal } from '../src/domain/types'

/** Crea un objeto db con la interfaz mínima que usan los repositorios. */
function crearBDMock(metodos: {
  runAsync?: jest.Mock
  getFirstAsync?: jest.Mock
  getAllAsync?: jest.Mock
  withTransactionAsync?: jest.Mock
}): ConexionBD {
  const runAsync = metodos.runAsync ?? jest.fn().mockResolvedValue(undefined)
  const getFirstAsync = metodos.getFirstAsync ?? jest.fn().mockResolvedValue(null)
  const getAllAsync = metodos.getAllAsync ?? jest.fn().mockResolvedValue([])
  const execAsync = jest.fn().mockResolvedValue(undefined)
  const withTransactionAsync =
    metodos.withTransactionAsync ??
    jest.fn(async (cb: () => Promise<void>) => {
      await cb()
    })
  return {
    runAsync,
    getFirstAsync,
    getAllAsync,
    execAsync,
    withTransactionAsync,
  }
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

  describe('finalizarSesion', () => {
    it('ejecuta UPDATE sobre sesiones con duración, notas, RPE, finalizada = 1 y marca sincronizado = 0', async () => {
      const runAsync = jest.fn().mockResolvedValue(undefined)

      const res = await finalizarSesion(crearBDMock({ runAsync }), 's1', {
        duracion_minutos: 55,
        notas: 'buen bombeo',
        rpe_sesion: 8,
      })

      expect(runAsync).toHaveBeenCalledTimes(1)
      const [sql, params] = runAsync.mock.calls[0] as [string, unknown[]]
      expect(sql).toMatch(/UPDATE\s+sesiones/i)
      expect(sql).toMatch(
        /SET\s+duracion_minutos\s*=\s*\?,\s*notas\s*=\s*\?,\s*rpe_sesion\s*=\s*\?,\s*finalizada\s*=\s*1,\s*actualizado_en\s*=\s*\?,\s*sincronizado\s*=\s*0/i,
      )
      expect(params).toEqual([55, 'buen bombeo', 8, res.actualizado_en, 's1'])
    })
  })

  describe('obtenerSesionAbierta', () => {
    it('devuelve la sesión abierta más reciente con nombres de rutina y día e ignora finalizadas', async () => {
      const getFirstAsync = jest.fn().mockResolvedValue({
        id: 's-abierta',
        usuario_id: 'u1',
        dia_rutina_id: 'd1',
        fecha: '2026-11-09',
        duracion_minutos: null,
        notas: null,
        rpe_sesion: null,
        finalizada: 0,
        creado_en: '2026-11-09T10:00:00.000Z',
        actualizado_en: '2026-11-09T10:00:00.000Z',
        sincronizado: 0,
        rutina_nombre: 'Fuerza 5x5',
        nombre_dia: 'Día A',
      })

      const resultado = await obtenerSesionAbierta(crearBDMock({ getFirstAsync }), 'u1')

      expect(getFirstAsync).toHaveBeenCalledTimes(1)
      const [sql, params] = getFirstAsync.mock.calls[0] as [string, unknown[]]
      expect(sql).toMatch(/FROM\s+sesiones\s+s/i)
      expect(sql).toMatch(/LEFT\s+JOIN\s+dias_rutina/i)
      expect(sql).toMatch(/LEFT\s+JOIN\s+rutinas/i)
      expect(sql).toMatch(/s\.usuario_id\s*=\s*\?\s+AND\s+s\.finalizada\s*=\s*0/i)
      expect(params).toEqual(['u1'])
      expect(resultado).toEqual({
        id: 's-abierta',
        usuario_id: 'u1',
        dia_rutina_id: 'd1',
        fecha: '2026-11-09',
        duracion_minutos: null,
        notas: null,
        rpe_sesion: null,
        finalizada: 0,
        creado_en: '2026-11-09T10:00:00.000Z',
        actualizado_en: '2026-11-09T10:00:00.000Z',
        sincronizado: 0,
        rutina_nombre: 'Fuerza 5x5',
        nombre_dia: 'Día A',
      })
    })

    it('devuelve null cuando no existe ninguna sesión con finalizada = 0', async () => {
      const getFirstAsync = jest.fn().mockResolvedValue(null)

      const resultado = await obtenerSesionAbierta(crearBDMock({ getFirstAsync }), 'u1')

      expect(resultado).toBeNull()
      expect(getFirstAsync).toHaveBeenCalledTimes(1)
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
    it('ejecuta DELETE + renumeración en dos fases dentro de withTransactionAsync', async () => {
      const getFirstAsync = jest
        .fn()
        .mockResolvedValueOnce({
          registro_id: 'reg-1',
          numero_serie: 2,
        })
        .mockResolvedValueOnce({
          max_numero: 4,
        })
      const runAsync = jest.fn().mockResolvedValue(undefined)
      const withTransactionAsync = jest.fn(async (cb: () => Promise<void>) => {
        await cb()
      })
      const db = crearBDMock({ getFirstAsync, runAsync, withTransactionAsync })

      await eliminarSerie(db, 'se-2')

      expect(withTransactionAsync).toHaveBeenCalledTimes(1)
      expect(getFirstAsync).toHaveBeenNthCalledWith(
        1,
        'SELECT registro_id, numero_serie FROM series WHERE id = ?',
        ['se-2'],
      )
      expect(getFirstAsync).toHaveBeenNthCalledWith(
        2,
        'SELECT MAX(numero_serie) AS max_numero FROM series WHERE registro_id = ? AND numero_serie > ?',
        ['reg-1', 2],
      )
      expect(runAsync).toHaveBeenCalledTimes(3)
      expect(runAsync).toHaveBeenNthCalledWith(1, 'DELETE FROM series WHERE id = ?', ['se-2'])

      // Fase 1: desplaza (2..4] -> (6..8] con +4 (fuera de [1..4] y > 0)
      const [sqlFase1, paramsFase1] = runAsync.mock.calls[1] as [string, unknown[]]
      expect(sqlFase1).toMatch(/SET\s+numero_serie\s*=\s*numero_serie\s*\+\s*\?/i)
      expect(sqlFase1).toMatch(/WHERE\s+registro_id\s*=\s*\?\s+AND\s+numero_serie\s*>\s*\?/i)
      expect(paramsFase1).toEqual([4, 'reg-1', 2])

      // Fase 2: desplaza (6..8] -> [2..3] con -5
      const [sqlFase2, paramsFase2] = runAsync.mock.calls[2] as [string, unknown[]]
      expect(sqlFase2).toMatch(/SET\s+numero_serie\s*=\s*numero_serie\s*-\s*\?/i)
      expect(sqlFase2).toMatch(/WHERE\s+registro_id\s*=\s*\?\s+AND\s+numero_serie\s*>\s*\?/i)
      expect(paramsFase2).toEqual([5, 'reg-1', 4])
    })

    it('al eliminar la última serie (sin posteriores) no ejecuta UPDATEs innecesarios', async () => {
      const getFirstAsync = jest
        .fn()
        .mockResolvedValueOnce({ registro_id: 'reg-1', numero_serie: 3 })
        .mockResolvedValueOnce({ max_numero: null })
      const runAsync = jest.fn().mockResolvedValue(undefined)

      await eliminarSerie(crearBDMock({ getFirstAsync, runAsync }), 'se-3')

      expect(runAsync).toHaveBeenCalledTimes(1)
      expect(runAsync).toHaveBeenCalledWith('DELETE FROM series WHERE id = ?', ['se-3'])
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

  describe('reordenarSeries', () => {
    it('renumera en dos fases dentro de withTransactionAsync sin colisiones', async () => {
      const getAllAsync = jest.fn().mockResolvedValue([
        { id: 'se-1', numero_serie: 1 },
        { id: 'se-2', numero_serie: 2 },
        { id: 'se-3', numero_serie: 3 },
      ])
      const runAsync = jest.fn().mockResolvedValue(undefined)
      const withTransactionAsync = jest.fn(async (cb: () => Promise<void>) => {
        await cb()
      })

      await reordenarSeries(
        crearBDMock({ getAllAsync, runAsync, withTransactionAsync }),
        'reg-1',
        ['se-3', 'se-1', 'se-2'],
      )

      expect(withTransactionAsync).toHaveBeenCalledTimes(1)
      expect(runAsync).toHaveBeenCalledTimes(4)
      expect(runAsync).toHaveBeenNthCalledWith(
        1,
        'UPDATE series SET numero_serie = numero_serie + ? WHERE registro_id = ?',
        [3, 'reg-1'],
      )
      expect(runAsync).toHaveBeenNthCalledWith(
        2,
        'UPDATE series SET numero_serie = ? WHERE id = ? AND registro_id = ?',
        [1, 'se-3', 'reg-1'],
      )
      expect(runAsync).toHaveBeenNthCalledWith(
        3,
        'UPDATE series SET numero_serie = ? WHERE id = ? AND registro_id = ?',
        [2, 'se-1', 'reg-1'],
      )
      expect(runAsync).toHaveBeenNthCalledWith(
        4,
        'UPDATE series SET numero_serie = ? WHERE id = ? AND registro_id = ?',
        [3, 'se-2', 'reg-1'],
      )
    })

    it('rechaza IDs duplicados o que no coincidan con el registro', async () => {
      await expect(
        reordenarSeries(crearBDMock({}), 'reg-1', ['se-1', 'se-1']),
      ).rejects.toThrow('duplicados')

      const getAllAsync = jest.fn().mockResolvedValue([{ id: 'se-1', numero_serie: 1 }])
      await expect(
        reordenarSeries(crearBDMock({ getAllAsync }), 'reg-1', ['se-otro']),
      ).rejects.toThrow('no coinciden')
    })
  })
})
