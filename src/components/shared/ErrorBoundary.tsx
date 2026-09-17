import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /**
   * Render a panel sized to its container rather than a full-screen takeover.
   *
   * The dashboard mounts one boundary per tab in this mode, so a tab that
   * throws — a corrupt localStorage blob in Parser Rules, an unexpected shape
   * from /api/analytics — loses only its own panel. With the root boundary
   * alone, any one of those blanked the entire admin app.
   */
  inline?: boolean;
  /** Changing this clears a caught error, so switching tabs recovers. */
  resetKey?: unknown;
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

  componentDidUpdate(prevProps: Props) {
    // Without this, a tab that threw once stayed broken for the rest of the
    // session: the boundary kept rendering its error even after the admin
    // navigated somewhere else.
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.inline) {
      return (
        <div
          role="alert"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem',
            padding: '3rem 1.5rem',
            textAlign: 'center',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            background: '#ffffff',
            border: '1px solid #e5e5e5',
            borderRadius: '1.75rem',
            color: '#171717',
          }}
        >
          <div style={{ fontSize: '2rem', lineHeight: 1 }}>⚠️</div>
          <div>
            <p style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 0.25rem' }}>
              Този раздел не можа да се зареди
            </p>
            <p style={{ fontSize: '0.875rem', opacity: 0.6, margin: 0 }}>
              This section failed to load
            </p>
          </div>
          <button
            onClick={() => this.setState({ error: null })}
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              padding: '0.75rem 2rem',
              borderRadius: '9999px',
              border: 'none',
              cursor: 'pointer',
              background: '#171717',
              color: '#ffffff',
            }}
          >
            Опитай пак / Retry
          </button>
          <details style={{ maxWidth: '32rem', width: '100%', opacity: 0.55 }}>
            <summary style={{ cursor: 'pointer', fontSize: '0.75rem' }}>Details</summary>
            <pre
              style={{
                marginTop: '0.5rem',
                padding: '0.75rem',
                overflowX: 'auto',
                textAlign: 'left',
                fontSize: '0.7rem',
                background: 'rgba(0,0,0,0.04)',
                borderRadius: '0.5rem',
              }}
            >
              {error.message}
            </pre>
          </details>
        </div>
      );
    }

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
