import { Component, type ReactNode, type ErrorInfo } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  name?: string
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[ErrorBoundary:${this.props.name || 'Root'}]`, error, errorInfo)
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div style={{
          padding: '40px 20px',
          textAlign: 'center',
          color: '#d4af37',
          background: 'rgba(10, 10, 15, 0.95)',
          border: '1px solid rgba(212, 175, 55, 0.3)',
          borderRadius: '12px',
          margin: '20px auto',
          maxWidth: '600px',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          <h2 style={{ fontSize: '1.4rem', marginBottom: '8px' }}>Experiencia Temporalmente No Disponible</h2>
          <p style={{ color: '#aaa', fontSize: '0.95rem', marginBottom: '16px' }}>
            Hubo una interrupción en el módulo visual ({this.props.name || 'Componente'}).
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              padding: '8px 20px',
              backgroundColor: '#d4af37',
              color: '#000',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.9rem'
            }}
          >
            Reintentar
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
