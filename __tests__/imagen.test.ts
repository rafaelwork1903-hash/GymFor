import { Platform } from 'react-native'
import * as ImageManipulator from 'expo-image-manipulator'
import {
  ANCHO_MAXIMO_IMAGEN,
  CALIDAD_COMPRESION_WEBP,
  comprimirImagen,
  esUriImagenValida,
} from '../src/utils/imagen'

const mockManipulateAsync = jest.fn()
const mockCreateDirectory = jest.fn()
const mockCopyFile = jest.fn()

let mockExisteDirectorio = false
let mockUriDocumentos = 'file:///datos/app/Documents/'

jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: (...args: unknown[]) => mockManipulateAsync(...args),
  SaveFormat: {
    JPEG: 'jpeg',
    PNG: 'png',
    WEBP: 'webp',
  },
}))

jest.mock('expo-file-system', () => {
  class MockDirectory {
    readonly uri: string
    constructor(...partes: ({ uri?: string } | string)[]) {
      this.uri = partes
        .map((p) => (typeof p === 'string' ? p : (p.uri ?? '')))
        .join('/')
        .replace(/\/+/g, '/')
        .replace('file:/', 'file:///')
    }
    get exists(): boolean {
      return mockExisteDirectorio
    }
    create(opciones?: unknown): void {
      mockCreateDirectory(opciones)
      mockExisteDirectorio = true
    }
  }

  class MockFile {
    readonly uri: string
    constructor(...partes: ({ uri?: string } | string)[]) {
      this.uri = partes
        .map((p) => (typeof p === 'string' ? p : (p.uri ?? '')))
        .join('/')
        .replace(/\/+/g, '/')
        .replace('file:/', 'file:///')
    }
    async copy(destino: MockFile, opciones?: unknown): Promise<void> {
      mockCopyFile(this.uri, destino.uri, opciones)
    }
  }

  return {
    Directory: MockDirectory,
    File: MockFile,
    Paths: {
      get document() {
        return { uri: mockUriDocumentos }
      },
    },
  }
})

describe('utilidad comprimirImagen (WEBP)', () => {
  const plataformaOriginal = Platform.OS

  beforeEach(() => {
    jest.clearAllMocks()
    mockExisteDirectorio = false
    mockUriDocumentos = 'file:///datos/app/Documents/'
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true })
  })

  afterAll(() => {
    Object.defineProperty(Platform, 'OS', { value: plataformaOriginal, configurable: true })
  })

  it('redimensiona a 800 px y comprime en formato WEBP (calidad 0.8) por defecto, copiando a almacenamiento persistente', async () => {
    mockManipulateAsync.mockResolvedValue({
      uri: 'file:///datos/app/Caches/ImageManipulator/temp.webp',
      width: 800,
      height: 600,
    })

    const resultado = await comprimirImagen('file:///galeria/original.jpg')

    expect(mockManipulateAsync).toHaveBeenCalledTimes(1)
    expect(mockManipulateAsync).toHaveBeenCalledWith(
      'file:///galeria/original.jpg',
      [{ resize: { width: ANCHO_MAXIMO_IMAGEN } }],
      {
        compress: CALIDAD_COMPRESION_WEBP,
        format: ImageManipulator.SaveFormat.WEBP,
      },
    )
    expect(mockCreateDirectory).toHaveBeenCalledWith({ intermediates: true, idempotent: true })
    expect(mockCopyFile).toHaveBeenCalledTimes(1)
    expect(resultado).toMatch(/^file:\/\/\/datos\/app\/Documents\/ejercicios_rutina\/ejercicio_.+\.webp$/)
  })

  it('respeta parámetros personalizados de ancho máximo y calidad', async () => {
    mockExisteDirectorio = true
    mockManipulateAsync.mockResolvedValue({
      uri: 'file:///datos/app/Caches/temp2.webp',
      width: 600,
      height: 450,
    })

    const resultado = await comprimirImagen('file:///galeria/foto.png', {
      anchoMaximo: 600,
      calidad: 0.7,
    })

    expect(mockManipulateAsync).toHaveBeenCalledWith(
      'file:///galeria/foto.png',
      [{ resize: { width: 600 } }],
      {
        compress: 0.7,
        format: ImageManipulator.SaveFormat.WEBP,
      },
    )
    // El directorio ya existía: no vuelve a crearlo
    expect(mockCreateDirectory).not.toHaveBeenCalled()
    expect(resultado).toMatch(/\.webp$/)
  })

  it('no reescala hacia arriba si anchoOriginal es menor o igual al ancho máximo', async () => {
    mockManipulateAsync.mockResolvedValue({
      uri: 'file:///datos/app/Caches/pequena.webp',
      width: 480,
      height: 360,
    })

    await comprimirImagen('file:///galeria/pequena.jpg', {
      anchoMaximo: 800,
      anchoOriginal: 480,
    })

    expect(mockManipulateAsync).toHaveBeenCalledWith(
      'file:///galeria/pequena.jpg',
      [],
      {
        compress: CALIDAD_COMPRESION_WEBP,
        format: ImageManipulator.SaveFormat.WEBP,
      },
    )
  })

  it('en web solicita base64 y devuelve un data URI WEBP persistente sin usar expo-file-system', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true })
    mockManipulateAsync.mockResolvedValue({
      uri: 'blob:http://localhost:8081/abc',
      width: 800,
      height: 600,
      base64: 'UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/AAA=',
    })

    const resultado = await comprimirImagen('blob:http://localhost:8081/origen')

    expect(mockManipulateAsync).toHaveBeenCalledWith(
      'blob:http://localhost:8081/origen',
      [{ resize: { width: 800 } }],
      {
        compress: 0.8,
        format: ImageManipulator.SaveFormat.WEBP,
        base64: true,
      },
    )
    expect(mockCopyFile).not.toHaveBeenCalled()
    expect(resultado).toBe(
      'data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/AAA=',
    )
  })

  it('rechaza URIs vacías o parámetros fuera de rango y propaga errores del manipulador', async () => {
    await expect(comprimirImagen('   ')).rejects.toThrow(/URI/i)
    await expect(comprimirImagen('file:///a.jpg', { anchoMaximo: 0 })).rejects.toThrow(/ancho/i)
    await expect(comprimirImagen('file:///a.jpg', { calidad: 0 })).rejects.toThrow(/calidad/i)
    await expect(comprimirImagen('file:///a.jpg', { calidad: 1.5 })).rejects.toThrow(/calidad/i)

    mockManipulateAsync.mockRejectedValueOnce(new Error('Fallo nativo al decodificar'))
    await expect(comprimirImagen('file:///corrupta.jpg')).rejects.toThrow(
      'Fallo nativo al decodificar',
    )
  })
})

describe('esUriImagenValida', () => {
  it('acepta URLs remotas http/https y URIs locales válidas', () => {
    expect(esUriImagenValida('https://ejemplo.com/foto.webp')).toBe(true)
    expect(esUriImagenValida('http://cdn.ejemplo.com/img.png?w=800')).toBe(true)
    expect(esUriImagenValida('file:///datos/app/Documents/ej.webp')).toBe(true)
    expect(esUriImagenValida('data:image/webp;base64,AAAA')).toBe(true)
  })

  it('rechaza cadenas vacías, con espacios o sin esquema soportado', () => {
    expect(esUriImagenValida('')).toBe(false)
    expect(esUriImagenValida('   ')).toBe(false)
    expect(esUriImagenValida('texto-suelto')).toBe(false)
    expect(esUriImagenValida('https://con espacios.com/a.jpg')).toBe(false)
    expect(esUriImagenValida('ftp://servidor.com/a.jpg')).toBe(false)
  })
})
