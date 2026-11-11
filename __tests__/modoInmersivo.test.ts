import { renderHook } from '@testing-library/react-native'
import { AppState, Platform } from 'react-native'
import { NavigationBar } from 'expo-navigation-bar'
import {
  aplicarModoInmersivoAndroid,
  useModoInmersivoAndroid,
} from '../src/hooks/useModoInmersivoAndroid'

describe('useModoInmersivoAndroid y aplicarModoInmersivoAndroid', () => {
  const originalPlatform = Platform.OS

  beforeEach(() => {
    jest.clearAllMocks()
    Platform.OS = 'android'
  })

  afterAll(() => {
    Platform.OS = originalPlatform
  })

  it('en Android, aplica setHidden(true) y setStyle con los valores por defecto', () => {
    aplicarModoInmersivoAndroid()

    expect(NavigationBar.setHidden).toHaveBeenCalledTimes(1)
    expect(NavigationBar.setHidden).toHaveBeenCalledWith(true)
    expect(NavigationBar.setStyle).toHaveBeenCalledTimes(1)
    expect(NavigationBar.setStyle).toHaveBeenCalledWith('auto')
  })

  it('en Android, permite configurar activo=false y un estilo personalizado', () => {
    aplicarModoInmersivoAndroid({ activo: false, estilo: 'light' })

    expect(NavigationBar.setHidden).toHaveBeenCalledWith(false)
    expect(NavigationBar.setStyle).toHaveBeenCalledWith('light')
  })

  it('no invoca NavigationBar si la plataforma no es Android (iOS / Web)', () => {
    Platform.OS = 'ios'
    aplicarModoInmersivoAndroid({ activo: true })

    expect(NavigationBar.setHidden).not.toHaveBeenCalled()
    expect(NavigationBar.setStyle).not.toHaveBeenCalled()

    Platform.OS = 'web'
    aplicarModoInmersivoAndroid({ activo: true })

    expect(NavigationBar.setHidden).not.toHaveBeenCalled()
    expect(NavigationBar.setStyle).not.toHaveBeenCalled()
  })

  it('suscribe a AppState y re-aplica el modo inmersivo cuando el estado cambia a "active"', async () => {
    let appStateCallback: ((estado: string) => void) | undefined
    const mockRemove = jest.fn()

    jest.spyOn(AppState, 'addEventListener').mockImplementation((event: any, handler: any) => {
      if (event === 'change') {
        appStateCallback = handler
      }
      return { remove: mockRemove } as any
    })

    // Ejecuta el hook real: aplica al montar y se suscribe a AppState
    const { unmount } = await renderHook(() =>
      useModoInmersivoAndroid({ activo: true, estilo: 'dark' }),
    )

    expect(NavigationBar.setHidden).toHaveBeenCalledTimes(1)
    expect(NavigationBar.setStyle).toHaveBeenCalledWith('dark')

    // Cambia a 'background' -> no vuelve a llamar
    appStateCallback?.('background')
    expect(NavigationBar.setHidden).toHaveBeenCalledTimes(1)

    // Cambia a 'active' -> re-aplica el modo inmersivo
    appStateCallback?.('active')
    expect(NavigationBar.setHidden).toHaveBeenCalledTimes(2)
    expect(NavigationBar.setHidden).toHaveBeenLastCalledWith(true)

    // Al desmontar se libera la suscripción
    await unmount()
    expect(mockRemove).toHaveBeenCalled()
  })

  it('el hook no se suscribe a AppState fuera de Android', async () => {
    Platform.OS = 'ios'
    const espia = jest.spyOn(AppState, 'addEventListener')

    await renderHook(() => useModoInmersivoAndroid())

    expect(espia).not.toHaveBeenCalled()
    expect(NavigationBar.setHidden).not.toHaveBeenCalled()
  })
})
