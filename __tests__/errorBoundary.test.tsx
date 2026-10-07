import { Text } from 'react-native'
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer'

import { ErrorBoundary } from '../src/components/ui/ErrorBoundary'

/** Interruptor externo para controlar el fallo entre renderizados del test. */
const interruptorFallo = { activo: true }

/** Componente que lanza en render mientras el interruptor esté activo. */
function ComponenteRiesgoso() {
  if (interruptorFallo.activo) {
    throw new Error('fallo forzado de prueba')
  }
  return <Text>Contenido protegido</Text>
}

/** Concatena todo el texto visible del árbol renderizado. */
function obtenerTextos(renderer: ReactTestRenderer): string {
  const partes: string[] = []
  const caminar = (nodo: unknown): void => {
    if (typeof nodo === 'string') {
      partes.push(nodo)
      return
    }
    if (Array.isArray(nodo)) {
      nodo.forEach(caminar)
      return
    }
    if (nodo && typeof nodo === 'object' && 'children' in nodo) {
      caminar((nodo as { children?: unknown }).children)
    }
  }
  caminar(renderer.toJSON())
  return partes.join(' ')
}

/** Localiza el botón "Reintentar" de la pantalla de error. */
function obtenerBotonReintentar(renderer: ReactTestRenderer): ReactTestInstance {
  return renderer.root.find((nodo) => nodo.props?.accessibilityRole === 'button')
}

describe('ErrorBoundary', () => {
  let espiaError: jest.SpyInstance

  beforeEach(() => {
    // Silencia los logs esperados: React y el propio boundary reportan el error.
    espiaError = jest.spyOn(console, 'error').mockImplementation(() => {})
    interruptorFallo.activo = true
  })

  afterEach(() => {
    espiaError.mockRestore()
  })

  it('renderiza los hijos cuando no hay error', () => {
    interruptorFallo.activo = false
    let renderer!: ReactTestRenderer
    act(() => {
      renderer = create(
        <ErrorBoundary titulo="Contexto de prueba">
          <ComponenteRiesgoso />
        </ErrorBoundary>,
      )
    })
    expect(obtenerTextos(renderer)).toContain('Contenido protegido')
  })

  it('captura un error de render y muestra la pantalla de error en lugar de los hijos', () => {
    let renderer!: ReactTestRenderer
    act(() => {
      renderer = create(
        <ErrorBoundary titulo="No se pudo iniciar la base de datos">
          <ComponenteRiesgoso />
        </ErrorBoundary>,
      )
    })
    const textos = obtenerTextos(renderer)
    expect(textos).toContain('No se pudo iniciar la base de datos')
    expect(textos).toContain('fallo forzado de prueba')
    expect(textos).not.toContain('Contenido protegido')
    expect(obtenerBotonReintentar(renderer).props.accessibilityLabel).toBe('Reintentar')
  })

  it('el botón Reintentar remonta los hijos y la app se recupera', () => {
    let renderer!: ReactTestRenderer
    act(() => {
      renderer = create(
        <ErrorBoundary titulo="Contexto de prueba">
          <ComponenteRiesgoso />
        </ErrorBoundary>,
      )
    })
    expect(obtenerTextos(renderer)).not.toContain('Contenido protegido')

    // Simula que la causa del fallo desaparece (p. ej. la BD ya responde).
    interruptorFallo.activo = false
    act(() => {
      obtenerBotonReintentar(renderer).props.onPress()
    })
    expect(obtenerTextos(renderer)).toContain('Contenido protegido')
  })
})
