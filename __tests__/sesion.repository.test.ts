import type { SQLiteDatabase } from 'expo-sqlite'

import { eliminarSesion } from '../src/db/repositories/sesion.repository'

/** Crea un objeto db con la interfaz mínima que usan los repositorios. */
function crearBDMock(runAsync: jest.Mock): SQLiteDatabase {
  return { runAsync } as unknown as SQLiteDatabase
}

describe('sesion.repository', () => {
  describe('eliminarSesion', () => {
    it('éxito: ejecuta el DELETE por id de la sesión', async () => {
      const runAsync = jest.fn().mockResolvedValue(undefined)

      await eliminarSesion(crearBDMock(runAsync), 's1')

      expect(runAsync).toHaveBeenCalledTimes(1)
      expect(runAsync).toHaveBeenCalledWith('DELETE FROM sesiones WHERE id = ?', ['s1'])
    })

    it('error: propaga el fallo de la BD al caller (el store lo captura)', async () => {
      const runAsync = jest.fn().mockRejectedValue(new Error('disk full'))

      await expect(eliminarSesion(crearBDMock(runAsync), 's1')).rejects.toThrow('disk full')
      expect(runAsync).toHaveBeenCalledTimes(1)
    })
  })
})
