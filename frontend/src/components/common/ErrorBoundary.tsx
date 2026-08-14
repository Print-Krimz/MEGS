import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertOctagon, RefreshCw, RotateCcw, Copy, Check, Terminal } from 'lucide-react';

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | ((props: { error: Error | null; resetError: () => void }) => ReactNode);
  onReset?: () => void;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private copyTimeout: ReturnType<typeof setTimeout> | null = null;

  public state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    errorInfo: null,
    copied: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error('ErrorBoundary caught unhandled error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  public componentWillUnmount() {
    if (this.copyTimeout) {
      clearTimeout(this.copyTimeout);
    }
  }

  public handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false,
    });
    this.props.onReset?.();
  };

  public handleReload = () => {
    window.location.reload();
  };

  public handleCopyDiagnostics = async () => {
    const { error, errorInfo } = this.state;
    const diagnostics = [
      '=== MEGS RUNTIME ERROR DIAGNOSTICS ===',
      `Timestamp: ${new Date().toISOString()}`,
      `URL: ${typeof window !== 'undefined' ? window.location.href : 'N/A'}`,
      `Error Name: ${error?.name || 'Error'}`,
      `Error Message: ${error?.message || 'Unknown error'}`,
      '\n--- STACK TRACE ---',
      error?.stack || 'No stack trace available',
      '\n--- COMPONENT STACK ---',
      errorInfo?.componentStack || 'No component stack available',
      '\n--- CLIENT INFO ---',
      `User Agent: ${typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A'}`,
      '======================================',
    ].join('\n');

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(diagnostics);
      }
      this.setState({ copied: true });
      if (this.copyTimeout) clearTimeout(this.copyTimeout);
      this.copyTimeout = setTimeout(() => {
        this.setState({ copied: false });
      }, 2500);
    } catch (err) {
      console.warn('Failed to copy diagnostics to clipboard:', err);
    }
  };

  public render() {
    const { hasError, error, errorInfo, copied } = this.state;

    if (hasError) {
      if (this.props.fallback) {
        if (typeof this.props.fallback === 'function') {
          return this.props.fallback({ error, resetError: this.handleReset });
        }
        return this.props.fallback;
      }

      return (
        <div
          data-testid="error-boundary-fallback"
          className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-6 select-none relative overflow-hidden"
        >
          {/* Subtle error accent backdrop */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(244,63,94,0.12),rgba(255,255,255,0))] pointer-events-none" />

          <div className="max-w-xl w-full bg-slate-800/90 backdrop-blur border border-slate-700 rounded-xl p-8 shadow-2xl space-y-6 relative z-10">
            {/* System Status Header */}
            <div className="flex items-center justify-between border-b border-slate-700/80 pb-4">
              <div className="flex items-center space-x-2">
                <span className="flex h-2.5 w-2.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                </span>
                <span className="font-mono text-xs text-slate-400 uppercase tracking-widest">
                  SYSTEM FAULT // UNHANDLED_RUNTIME_EXCEPTION
                </span>
              </div>
              <div className="font-mono text-xs px-2 py-0.5 rounded bg-rose-950/70 text-rose-300 border border-rose-800/60">
                CRASH 500
              </div>
            </div>

            {/* Error Graphic & Main Title */}
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                <AlertOctagon className="w-8 h-8 animate-pulse" />
              </div>
              <div className="space-y-1">
                <h1 className="text-2xl font-bold tracking-tight text-white font-sans">
                  Application Error Occurred
                </h1>
                <p className="text-sm text-slate-400">
                  An unexpected client-side runtime error prevented this component tree from rendering.
                </p>
              </div>
            </div>

            {/* Error Message Summary Box */}
            <div className="bg-rose-950/40 rounded-lg p-4 border border-rose-800/60 font-mono text-xs text-rose-200 break-words space-y-1">
              <div className="text-[10px] uppercase font-bold text-rose-400 tracking-wider">
                ERROR REASON:
              </div>
              <p className="font-semibold text-rose-200" data-testid="error-boundary-message">
                {error?.message || 'Unknown runtime error occurred.'}
              </p>
            </div>

            {/* Diagnostic Details Accordion */}
            {(error?.stack || errorInfo?.componentStack) && (
              <details className="group bg-slate-900/80 rounded-lg border border-slate-700/60 text-xs font-mono text-slate-300 overflow-hidden">
                <summary className="cursor-pointer px-4 py-2.5 flex items-center justify-between text-slate-400 hover:text-slate-200 transition select-none">
                  <div className="flex items-center space-x-2">
                    <Terminal className="w-3.5 h-3.5" />
                    <span>View Stack Trace &amp; Component Hierarchy</span>
                  </div>
                  <span className="text-[10px] text-slate-500 group-open:rotate-90 transition-transform">
                    ▶
                  </span>
                </summary>
                <div className="p-4 border-t border-slate-800 max-h-48 overflow-y-auto space-y-3 select-text">
                  {error?.stack && (
                    <div>
                      <div className="text-slate-500 font-bold mb-1">Stack Trace:</div>
                      <pre className="text-[11px] leading-relaxed whitespace-pre-wrap text-slate-300">
                        {error.stack}
                      </pre>
                    </div>
                  )}
                  {errorInfo?.componentStack && (
                    <div>
                      <div className="text-slate-500 font-bold mb-1">Component Stack:</div>
                      <pre className="text-[11px] leading-relaxed whitespace-pre-wrap text-slate-400">
                        {errorInfo.componentStack}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            )}

            {/* Action Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
              <button
                type="button"
                onClick={this.handleReset}
                data-testid="error-boundary-retry-btn"
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-500 active:bg-teal-700 text-white font-semibold text-sm rounded-lg shadow-md hover:shadow-teal-900/30 transition duration-150 border border-teal-500/50"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Try Again</span>
              </button>

              <button
                type="button"
                onClick={this.handleReload}
                data-testid="error-boundary-reload-btn"
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 active:bg-slate-700 text-slate-200 hover:text-white font-medium text-sm rounded-lg border border-slate-600 transition duration-150 shadow-sm"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reload Application</span>
              </button>

              <button
                type="button"
                onClick={this.handleCopyDiagnostics}
                data-testid="error-boundary-copy-btn"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-800 text-slate-300 hover:text-white font-medium text-sm rounded-lg border border-slate-700 transition duration-150 shadow-sm"
                title="Copy Error Diagnostics to Clipboard"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-teal-400" />
                    <span className="text-teal-400">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy Diagnostics</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
