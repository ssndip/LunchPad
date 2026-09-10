import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Last-resort boundary around the whole app.
 *
 * The kiosk runs unattended, so an uncaught render error would otherwise leave
 * a blank screen until someone physically notices. This renders a recovery
 * screen instead.
 *
 * Deliberately dependency-free (no store, no i18n, no icon library): whatever
 * broke the tree below might be exactly those modules, so this component must
 * be able to render on its own.
 */
export class ErrorBoundary extends Component<Props, State> {
  // `@types/react` is not installed in this project, so `Component` resolves to
  // `any` and inherited members are not visible to the compiler. Declaring them
  // here is type-only and emits nothing.
  declare props: Props;
  declare setState: (s: State) => void;

  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Unhandled render error', error, info.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div
        role="alert"
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1.5rem',
          padding: '2rem',
          textAlign: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          background: '#0f172a',
          color: '#f8fafc',
        }}
      >
        <div style={{ fontSize: '3rem', lineHeight: 1 }}>⚠️</div>

        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.5rem' }}>
            Нещо се обърка
          </h1>
          <p style={{ fontSize: '1rem', opacity: 0.75, margin: 0 }}>Something went wrong</p>
        </div>

        <button
          onClick={this.handleReload}
          style={{
            fontSize: '1.125rem',
            fontWeight: 600,
            padding: '0.875rem 2.5rem',
            borderRadius: '9999px',
            border: 'none',
            cursor: 'pointer',
            background: '#3b82f6',
            color: '#ffffff',
            minWidth: '14rem',
            minHeight: '3.5rem',
          }}
        >
          Презареди / Reload
        </button>

        <details style={{ maxWidth: '40rem', width: '100%', opacity: 0.6 }}>
          <summary style={{ cursor: 'pointer', fontSize: '0.875rem' }}>Details</summary>
          <pre
            style={{
              marginTop: '0.75rem',
              padding: '0.75rem',
              overflowX: 'auto',
              textAlign: 'left',
              fontSize: '0.75rem',
              background: 'rgba(255,255,255,0.06)',
              borderRadius: '0.5rem',
            }}
          >
            {error.message}
          </pre>
        </details>
      </div>
    );
  }
}
