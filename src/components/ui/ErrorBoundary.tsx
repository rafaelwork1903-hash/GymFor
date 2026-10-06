import { Component, type ErrorInfo, type ReactNode } from 'react'

import { ErrorScreen } from './ErrorScreen'

interface ErrorBoundaryProps {
  children: ReactNode
  /** Contexto del árbol protegido; se usa como título de la pantalla de error. */
  titulo?: string
}

interface ErrorBoundaryState {
  error: Error | null
}

/**
 * Error boundary de React. Captura errores de renderizado del subárbol
 * (p. ej. `SQLiteProvider` lanza durante el render si su `onInit` rechaza)
 * y muestra `ErrorScreen` en lugar de dejar la app en pantalla negra.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(`[ErrorBoundary] ${this.props.titulo ?? 'Error no controlado'}:`, error)
    console.error(info.componentStack)
  }

  private reiniciar = (): void => {
    this.setState({ error: null })
  }

  render(): ReactNode {
    const { error } = this.state
    if (error) {
      return (
        <ErrorScreen
          titulo={this.props.titulo ?? 'Algo salió mal'}
          error={error}
          onReintentar={this.reiniciar}
        />
      )
    }
    return this.props.children
  }
}
