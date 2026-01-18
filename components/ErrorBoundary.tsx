import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary component to catch React errors in the component tree
 * Prevents the entire app from crashing and shows a user-friendly error message
 */
class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error using logger service
    import('../services/loggingService').then(({ logger }) => {
      logger.error('ErrorBoundary caught an error', 'errorBoundary', error, {
        componentStack: errorInfo.componentStack,
        errorInfo: errorInfo.toString()
      });
    }).catch(() => {
      // Fallback to console if logger import fails
      if (import.meta.env.DEV) {
        try {
          // Safely convert error and errorInfo to strings
          const errorStr = error instanceof Error ? error.message : String(error);
          const errorInfoStr = errorInfo?.componentStack || String(errorInfo);
          console.error('ErrorBoundary caught an error:', errorStr, errorInfoStr);
        } catch (e) {
          // If even string conversion fails, use minimal logging
          console.error('ErrorBoundary caught an error (details unavailable)');
        }
      }
    });

    // In production, you could log to an error reporting service here
    // Example: Sentry.captureException(error, { contexts: { react: errorInfo } });

    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
          <div className="max-w-2xl w-full bg-zinc-900 border border-red-500/50 rounded-2xl p-8 space-y-6">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
                <span className="text-3xl">⚠️</span>
              </div>
              <div>
                <h1 className="text-2xl font-fantasy font-bold text-red-400">
                  Something Went Wrong
                </h1>
                <p className="text-zinc-400 mt-1">
                  The application encountered an unexpected error
                </p>
              </div>
            </div>

            {import.meta.env.DEV && this.state.error && (
              <div className="bg-zinc-950 border border-zinc-700 rounded-xl p-4 space-y-2">
                <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">
                  Error Details (Development Only)
                </h2>
                <pre className="text-xs text-red-400 font-mono overflow-auto max-h-64">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </div>
            )}

            <div className="flex items-center space-x-4 pt-4 border-t border-zinc-700">
              <button
                onClick={this.handleReset}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-semibold transition-all duration-200 hover:scale-105"
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl font-semibold transition-all duration-200"
              >
                Reload Page
              </button>
            </div>

            <p className="text-xs text-zinc-500 text-center">
              If this problem persists, please check your browser console for more details.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
