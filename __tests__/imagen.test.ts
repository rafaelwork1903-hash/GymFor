import { SaveFormat } from 'expo-image-manipulator'
import { Platform } from 'react-native'
import {
  ANCHO_MAXIMO_IMAGEN,
  CALIDAD_COMPRESION_WEBP,
  comprimirImagen,
  esUriImagenValida,
} from '../src/utils/imagen'

const mockSaveAsync = jest.fn()
const mockReleaseImageRef = jest.fn()
const mockRenderAsync = jest.fn()
const mockResize = jest.fn()
const mockReleaseContext = jest.fn()
const mockManipulate = jest.fn()
const mockCreateDirectory = jest.fn()
const mockCopyFile = jest.fn()

let mockExisteDirectorio = false
let mockUriDocumentos = 'file:///datos/app/Documents/'

jest.mock('expo-image-manipulator', () => ({
  ImageManipulator: {
    manipulate: (...args: unknown[]) => mockManipulate(...args),
  },
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

describe('utilidad comprimirImagen (API contextual WEBP)', () => {
  const plataformaOriginal = Platform.OS

  beforeEach(() => {
    jest.clearAllMocks()
    mockExisteDirectorio = false
    mockUriDocumentos = 'file:///datos/app/Documents/'
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true })

    const mockContexto = {
      resize: (...args: unknown[]) => {
        mockResize(...args)
        return mockContexto
      },
      renderAsync: (...args: unknown[]) => mockRenderAsync(...args),
      release: () => mockReleaseContext(),
    }

    mockManipulate.mockReturnValue(mockContexto)
    mockRenderAsync.mockResolvedValue({
      width: 800,
      height: 600,
      saveAsync: (...args: unknown[]) => mockSaveAsync(...args),
      release: () => mockReleaseImageRef(),
    })
  })

  afterAll(() => {
    Object.defineProperty(Platform, 'OS', { value: plataformaOriginal, configurable: true })
  })

  it('usa ImageManipulator.manipulate(uri, { maxWidth: 800 }) -> renderAsync -> saveAsync en WEBP (0.8), sin resize redundante, liberando recursos y persistiendo en nativo', async () => {
    mockSaveAsync.mockResolvedValue({
      uri: 'file:///datos/app/Caches/ImageManipulator/temp.webp',
      width: 800,
      height: 600,
    })

    const resultado = await comprimirImagen('file:///galeria/original.jpg')

    expect(mockManipulate).toHaveBeenCalledTimes(1)
    expect(mockManipulate).toHaveBeenCalledWith('file:///galeria/original.jpg', {
      maxWidth: ANCHO_MAXIMO_IMAGEN,
    })
    expect(mockResize).not.toHaveBeenCalled()
    expect(mockRenderAsync).toHaveBeenCalledTimes(1)
    expect(mockSaveAsync).toHaveBeenCalledWith({
      compress: CALIDAD_COMPRESION_WEBP,
      format: SaveFormat.WEBP,
    })
    expect(mockReleaseImageRef).toHaveBeenCalledTimes(1)
    expect(mockReleaseContext).toHaveBeenCalledTimes(1)
    expect(mockCreateDirectory).toHaveBeenCalledWith({ intermediates: true, idempotent: true })
    expect(mockCopyFile).toHaveBeenCalledTimes(1)
    expect(resultado).toMatch(
      /^file:\/\/\/datos\/app\/Documents\/ejercicios_rutina\/ejercicio_.+\.webp$/,
    )
  })

  it('respeta parámetros personalizados de ancho máximo (redondeado) y calidad sin reutilizar resize', async () => {
    mockExisteDirectorio = true
    mockSaveAsync.mockResolvedValue({
      uri: 'file:///datos/app/Caches/temp2.webp',
      width: 600,
      height: 450,
    })

    const resultado = await comprimirImagen('file:///galeria/foto.png', {
      anchoMaximo: 599.6,
      calidad: 0.7,
    })

    expect(mockManipulate).toHaveBeenCalledWith('file:///galeria/foto.png', { maxWidth: 600 })
    expect(mockResize).not.toHaveBeenCalled()
    expect(mockSaveAsync).toHaveBeenCalledWith({
      compress: 0.7,
      format: SaveFormat.WEBP,
    })
    // El directorio ya existía: no vuelve a crearlo
    expect(mockCreateDirectory).not.toHaveBeenCalled()
    expect(resultado).toMatch(/\.webp$/)
  })

  it('no reestructura ni copia el archivo cuando el URI ya reside dentro de Paths.document', async () => {
    const uriYaPersistida = 'file:///datos/app/Documents/ejercicios_rutina/previo.webp'
    mockSaveAsync.mockResolvedValue({
      uri: uriYaPersistida,
      width: 480,
      height: 360,
    })

    const resultado = await comprimirImagen('file:///galeria/pequena.jpg')

    expect(mockManipulate).toHaveBeenCalledWith('file:///galeria/pequena.jpg', { maxWidth: 800 })
    expect(mockResize).not.toHaveBeenCalled()
    expect(mockCopyFile).not.toHaveBeenCalled()
    expect(resultado).toBe(uriYaPersistida)
    expect(mockReleaseImageRef).toHaveBeenCalledTimes(1)
    expect(mockReleaseContext).toHaveBeenCalledTimes(1)
  })

  it('en web solicita base64 y devuelve un data URI WEBP persistente sin usar expo-file-system', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true })
    mockSaveAsync.mockResolvedValue({
      uri: 'blob:http://localhost:8081/abc',
      width: 800,
      height: 600,
      base64: 'UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/AAA=',
    })

    const resultado = await comprimirImagen('blob:http://localhost:8081/origen')

    expect(mockManipulate).toHaveBeenCalledWith('blob:http://localhost:8081/origen', {
      maxWidth: 800,
    })
    expect(mockResize).not.toHaveBeenCalled()
    expect(mockSaveAsync).toHaveBeenCalledWith({
      compress: 0.8,
      format: SaveFormat.WEBP,
      base64: true,
    })
    expect(mockCopyFile).not.toHaveBeenCalled()
    expect(resultado).toBe(
      'data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/AAA=',
    )
  })

  it('rechaza URIs vacías o parámetros fuera de rango y libera recursos aun si el manipulador falla', async () => {
    await expect(comprimirImagen('   ')).rejects.toThrow(/URI/i)
    await expect(comprimirImagen('file:///a.jpg', { anchoMaximo: 0 })).rejects.toThrow(/ancho/i)
    await expect(comprimirImagen('file:///a.jpg', { calidad: 0 })).rejects.toThrow(/calidad/i)
    await expect(comprimirImagen('file:///a.jpg', { calidad: 1.5 })).rejects.toThrow(/calidad/i)

    mockRenderAsync.mockRejectedValueOnce(new Error('Fallo nativo al decodificar'))
    await expect(comprimirImagen('file:///corrupta.jpg')).rejects.toThrow(
      'Fallo nativo al decodificar',
    )
    expect(mockReleaseContext).toHaveBeenCalledTimes(1)

    mockSaveAsync.mockRejectedValueOnce(new Error('Fallo al codificar WEBP'))
    await expect(comprimirImagen('file:///error-guardado.jpg')).rejects.toThrow(
      'Fallo al codificar WEBP',
    )
    expect(mockReleaseImageRef).toHaveBeenCalledTimes(1)
    expect(mockReleaseContext).toHaveBeenCalledTimes(2)
  })
})

describe('esUriImagenValida', () => {
  it('acepta URLs remotas http/https y todos los esquemas de URIs locales soportados', () => {
    expect(esUriImagenValida('https://ejemplo.com/foto.webp')).toBe(true)
    expect(esUriImagenValida('http://cdn.ejemplo.com/img.png?w=800')).toBe(true)
    expect(esUriImagenValida('file:///datos/app/Documents/ej.webp')).toBe(true)
    expect(esUriImagenValida('content://media/external/images/media/42')).toBe(true)
    expect(esUriImagenValida('ph://ED7AC36B-A150-4C38-BB8C-B6D696F4F2ED/L0/001')).toBe(true)
    expect(esUriImagenValida('assets-library://asset/asset.JPG?id=1000000477&ext=JPG')).toBe(true)
    expect(esUriImagenValida('blob:http://localhost:8081/1234-5678')).toBe(true)
    expect(esUriImagenValida('data:image/webp;base64,AAAA')).toBe(true)
  })

  it('rechaza cadenas vacías, con espacios o sin esquema soportado', () => {
    expect(esUriImagenValida('')).toBe(false)
    expect(esUriImagenValida('   ')).toBe(false)
    expect(esUriImagenValida('texto-suelto')).toBe(false)
    expect(esUriImagenValida('https://con espacios.com/a.jpg')).toBe(false)
    expect(esUriImagenValida('ftp://servidor.com/a.jpg')).toBe(false)
    expect(esUriImagenValida('data:image/webp,sin-base64')).toBe(false)
  })
})
