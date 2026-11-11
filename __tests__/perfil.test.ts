import {
  construirFechaISO,
  desglosarFechaISO,
  fechaLocalISO,
  formatearFechaLegible,
  obtenerDiasDelMes,
  obtenerPrimerDiaSemana,
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

  describe('utilidades de calendario para selector de fecha', () => {
    it('obtenerDiasDelMes calcula correctamente días en meses regulares y bisiestos', () => {
      expect(obtenerDiasDelMes(2024, 2)).toBe(29) // bisiesto
      expect(obtenerDiasDelMes(2025, 2)).toBe(28)
      expect(obtenerDiasDelMes(2025, 4)).toBe(30)
      expect(obtenerDiasDelMes(2025, 12)).toBe(31)
    })

    it('obtenerPrimerDiaSemana devuelve índice con lunes=0 y domingo=6', () => {
      // 1 de febrero de 2024 fue jueves (índice 3: Lu=0, Ma=1, Mi=2, Ju=3)
      expect(obtenerPrimerDiaSemana(2024, 2)).toBe(3)
      // 1 de marzo de 2026 es domingo (índice 6)
      expect(obtenerPrimerDiaSemana(2026, 3)).toBe(6)
      // 1 de junio de 2026 es lunes (índice 0)
      expect(obtenerPrimerDiaSemana(2026, 6)).toBe(0)
    })

    it('construirFechaISO formatea componentes numéricos con ceros a la izquierda', () => {
      expect(construirFechaISO(1996, 5, 4)).toBe('1996-05-04')
      expect(construirFechaISO(2001, 12, 25)).toBe('2001-12-25')
    })

    it('desglosarFechaISO extrae año, mes y día de una fecha válida o retorna valores por defecto', () => {
      expect(desglosarFechaISO('1996-05-04')).toEqual({ anio: 1996, mes: 5, dia: 4 })
      expect(desglosarFechaISO('', 1995)).toEqual({ anio: 1995, mes: 1, dia: 1 })
      expect(desglosarFechaISO('invalido', 2000)).toEqual({ anio: 2000, mes: 1, dia: 1 })
    })

    it('formatearFechaLegible devuelve texto descriptivo en español o vacío si no es válida', () => {
      expect(formatearFechaLegible('1996-05-14')).toBe('14 de mayo de 1996')
      expect(formatearFechaLegible('2000-01-01')).toBe('1 de enero de 2000')
      expect(formatearFechaLegible('')).toBe('')
      expect(formatearFechaLegible('no-es-fecha')).toBe('')
    })
  })
})
