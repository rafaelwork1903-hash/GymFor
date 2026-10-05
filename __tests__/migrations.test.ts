import { MIGRACIONES } from '../src/db/migrations'
import { ESQUEMA_VERSION_1, ESQUEMA_VERSION_1_DOWN } from '../src/db/schema'

describe('migraciones', () => {
  it('están ordenadas por versión y empiezan en 0', () => {
    MIGRACIONES.forEach((migracion, indice) => {
      expect(migracion.version).toBe(indice + 1)
    })
  })

  it('todas las migraciones son reversibles (tienen down)', () => {
    for (const migracion of MIGRACIONES) {
      expect(migracion.up.trim().length).toBeGreaterThan(0)
      expect(migracion.down.trim().length).toBeGreaterThan(0)
    }
  })

  it('la migración 1 crea todas las tablas del modelo de datos', () => {
    const tablas = [
      'usuarios',
      'rutinas',
      'dias_rutina',
      'ejercicios',
      'ejercicios_en_rutina',
      'sesiones',
      'registros_ejercicio',
      'series',
      'metricas_progreso',
    ]
    for (const tabla of tablas) {
      expect(ESQUEMA_VERSION_1).toContain(`CREATE TABLE IF NOT EXISTS ${tabla} (`)
      expect(ESQUEMA_VERSION_1_DOWN).toContain(`DROP TABLE IF EXISTS ${tabla};`)
    }
  })

  it('la migración 1 define las claves foráneas del modelo', () => {
    expect(ESQUEMA_VERSION_1).toContain('REFERENCES usuarios(id)')
    expect(ESQUEMA_VERSION_1).toContain('REFERENCES rutinas(id)')
    expect(ESQUEMA_VERSION_1).toContain('REFERENCES dias_rutina(id)')
    expect(ESQUEMA_VERSION_1).toContain('REFERENCES ejercicios(id)')
    expect(ESQUEMA_VERSION_1).toContain('REFERENCES sesiones(id)')
    expect(ESQUEMA_VERSION_1).toContain('REFERENCES registros_ejercicio(id)')
  })
})
