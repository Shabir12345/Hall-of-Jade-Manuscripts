import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
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
    };
  }

  static getDerivedStateFromError(_: Error): State {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
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
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div className="p-4 bg-red-100 text-red-800 rounded-lg">
          <h3 className="font-bold">Component Failed to Load</h3>
          <p>Please try refreshing the page.</p>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
