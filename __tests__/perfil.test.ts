import {
  fechaLocalISO,
  validarFechaNacimiento,
  validarFormularioPerfil,
  validarPesoInicial,
} from '../src/utils/perfil'

describe('validación pura del formulario de perfil (src/utils/perfil.ts)', () => {
  const HOY = '2026-11-03'

  describe('fechaLocalISO', () => {
    it('formatea año, mes y día locales con relleno de dos dígitos', () => {
      const fecha = new Date(2026, 3, 5) // 5 de abril de 2026 en hora local
      expect(fechaLocalISO(fecha)).toBe('2026-04-05')
    })
  })

  describe('validarFechaNacimiento', () => {
    it('acepta cadena vacía como null al ser opcional', () => {
      expect(validarFechaNacimiento('   ', HOY)).toEqual({ valido: true, valor: null })
    })

    it('acepta fechas reales pasadas, de hoy y años bisiestos reales', () => {
      expect(validarFechaNacimiento('1995-04-21', HOY)).toEqual({
        valido: true,
        valor: '1995-04-21',
      })
      expect(validarFechaNacimiento(HOY, HOY)).toEqual({
        valido: true,
        valor: HOY,
      })
      expect(validarFechaNacimiento('2024-02-29', HOY)).toEqual({
        valido: true,
        valor: '2024-02-29',
      })
    })

    it('rechaza formatos incorrectos, fechas inexistentes en calendario, años < 1900 y fechas futuras', () => {
      expect(validarFechaNacimiento('21/04/1995', HOY).valido).toBe(false)
      expect(validarFechaNacimiento('2025-02-29', HOY).valido).toBe(false)
      expect(validarFechaNacimiento('2025-02-30', HOY).valido).toBe(false)
      expect(validarFechaNacimiento('2025-13-01', HOY).valido).toBe(false)
      expect(validarFechaNacimiento('1899-12-31', HOY).valido).toBe(false)
      expect(validarFechaNacimiento('2026-11-04', HOY).valido).toBe(false)
    })
  })

  describe('validarPesoInicial', () => {
    it('acepta vacío como null y convierte enteros o decimales con punto o coma', () => {
      expect(validarPesoInicial('')).toEqual({ valido: true, valor: null })
      expect(validarPesoInicial('80')).toEqual({ valido: true, valor: 80 })
      expect(validarPesoInicial('72,5')).toEqual({ valido: true, valor: 72.5 })
      expect(validarPesoInicial(' 68.25 ')).toEqual({ valido: true, valor: 68.25 })
    })

    it('rechaza cero, negativos y texto no numérico', () => {
      expect(validarPesoInicial('0').valido).toBe(false)
      expect(validarPesoInicial('0,0').valido).toBe(false)
      expect(validarPesoInicial('-70').valido).toBe(false)
      expect(validarPesoInicial('70kg').valido).toBe(false)
      expect(validarPesoInicial('72..5').valido).toBe(false)
    })
  })

  describe('validarFormularioPerfil', () => {
    it('exige nombre no vacío y devuelve errores por campo cuando hay entradas inválidas', () => {
      const resultado = validarFormularioPerfil(
        {
          nombre: '   ',
          fecha_nacimiento: '2025-02-30',
          sexo: null,
          peso_inicial: '0',
          objetivo: null,
          nivel: null,
        },
        HOY,
      )

      expect(resultado.valido).toBe(false)
      expect(resultado.errores.nombre).toBeDefined()
      expect(resultado.errores.fecha_nacimiento).toBeDefined()
      expect(resultado.errores.peso_inicial).toBeDefined()
    })

    it('normaliza nombre recortado y datos opcionales válidos', () => {
      const resultado = validarFormularioPerfil(
        {
          nombre: '  Diego  ',
          fecha_nacimiento: '1998-10-02',
          sexo: 'masculino',
          peso_inicial: '77,4',
          objetivo: 'fuerza',
          nivel: 'principiante',
        },
        HOY,
      )

      expect(resultado).toEqual({
        valido: true,
        datos: {
          nombre: 'Diego',
          fecha_nacimiento: '1998-10-02',
          sexo: 'masculino',
          peso_inicial: 77.4,
          objetivo: 'fuerza',
          nivel: 'principiante',
        },
        errores: {},
      })
    })
  })
})
