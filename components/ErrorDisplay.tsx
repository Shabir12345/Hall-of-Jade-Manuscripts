/**
 * Error Display Component
 * Consistent error display with recovery options
 */

import React, { useState } from 'react';
import { formatErrorWithActions, type FormattedError } from '../utils/errorHandling';

export type ErrorDisplayVariant = 'inline' | 'banner' | 'toast';
export type ErrorDisplayType = 'error' | 'warning';

interface ErrorDisplayProps {
  error: Error | string | FormattedError;
  type?: ErrorDisplayType;
  variant?: ErrorDisplayVariant;
  onRetry?: () => void;
  onDismiss?: () => void;
  showDetails?: boolean;
  className?: string;
  onAction?: () => void;
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  error,
  type = 'error',
  variant = 'banner',
  onRetry,
  onDismiss,
  showDetails = false,
  className = '',
  onAction,
}) => {
  const [showFullDetails, setShowFullDetails] = React.useState(false);
  
  // Format error with actionable guidance
  const formattedError: FormattedError = 
    typeof error === 'object' && 'message' in error && 'action' in error
      ? error as FormattedError
      : formatErrorWithActions(error);
  
  const errorMessage = formattedError.message;
  const errorAction = formattedError.action;
  const errorActionLabel = formattedError.actionLabel || 'Fix';
  const errorDetails = formattedError.details;
  const isRetryable = formattedError.retryable ?? true;
  
  // Get original error for stack trace
  const originalError = error instanceof Error ? error : undefined;
  const errorStack = originalError?.stack;
  const errorName = originalError?.name;

  const getErrorIcon = () => {
    if (type === 'warning') return '⚠️';
    return '❌';
  };

  const getErrorStyles = () => {
    if (type === 'warning') {
      return {
        bg: 'bg-amber-950/95',
        border: 'border-amber-500/50',
        text: 'text-amber-400',
        button: 'bg-amber-600/20 hover:bg-amber-600/30 border-amber-500/30 text-amber-400',
      };
    }
    return {
      bg: 'bg-red-950/95',
      border: 'border-red-500/50',
      text: 'text-red-400',
      button: 'bg-red-600/20 hover:bg-red-600/30 border-red-500/30 text-red-400',
    };
  };

  const styles = getErrorStyles();

  // Inline variant (for forms)
  if (variant === 'inline') {
    return (
      <div className={`${styles.bg} ${styles.border} border rounded-lg p-3 ${className}`}>
        <div className="flex items-start gap-2">
          <span className="text-base flex-shrink-0">{getErrorIcon()}</span>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-semibold ${styles.text} break-words`}>
              {errorMessage}
            </p>
            {showDetails && errorStack && (
              <details className="mt-2">
                <summary className="text-xs text-zinc-500 cursor-pointer hover:text-zinc-400">
                  Technical Details
                </summary>
                <pre className="mt-2 text-xs text-zinc-600 overflow-x-auto p-2 bg-zinc-900/50 rounded">
                  {errorName && <div className="font-bold">{errorName}</div>}
                  {errorStack}
                </pre>
              </details>
            )}
            {errorDetails && (
              <p className={`text-xs ${styles.text} opacity-80 mt-2`}>
                {errorDetails}
              </p>
            )}
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              {errorAction && onAction && (
                <button
                  onClick={onAction}
                  className={`text-xs px-3 py-1.5 rounded border transition-all font-semibold ${styles.button}`}
                >
                  {errorActionLabel}
                </button>
              )}
              {isRetryable && onRetry && (
                <button
                  onClick={onRetry}
                  className={`text-xs px-3 py-1.5 rounded border transition-all font-semibold ${styles.button}`}
                >
                  Retry
                </button>
              )}
              {onDismiss && (
                <button
                  onClick={onDismiss}
                  className="text-xs px-3 py-1.5 rounded border border-zinc-700 bg-zinc-800 text-zinc-400 hover:text-zinc-300 transition-all font-semibold"
                >
                  Dismiss
                </button>
              )}
            </div>
            {showDetails && errorStack && (
              <details className="mt-2" open={showFullDetails}>
                <summary 
                  className="text-xs text-zinc-500 cursor-pointer hover:text-zinc-400"
                  onClick={(e) => {
                    e.preventDefault();
                    setShowFullDetails(!showFullDetails);
                  }}
                >
                  {showFullDetails ? 'Hide' : 'Show'} Technical Details
                </summary>
                <pre className="mt-2 text-xs text-zinc-600 overflow-x-auto p-2 bg-zinc-900/50 rounded">
                  {errorName && <div className="font-bold">{errorName}</div>}
                  {errorStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Banner variant (for page-level errors)
  if (variant === 'banner') {
    return (
      <div className={`${styles.bg} ${styles.border} border rounded-xl p-4 shadow-lg ${className}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <span className="text-xl flex-shrink-0">{getErrorIcon()}</span>
            <div className="flex-1 min-w-0">
              <h3 className={`text-base font-bold ${styles.text} mb-1`}>
                {type === 'warning' ? 'Warning' : 'Error'}
              </h3>
              <p className={`text-sm ${styles.text} break-words`}>
                {errorMessage}
              </p>
              {showDetails && errorStack && (
                <details className="mt-2">
                  <summary className="text-xs text-zinc-500 cursor-pointer hover:text-zinc-400">
                    Technical Details
                  </summary>
                  <pre className="mt-2 text-xs text-zinc-600 overflow-x-auto p-2 bg-zinc-900/50 rounded">
                    {errorName && <div className="font-bold">{errorName}</div>}
                    {errorStack}
                  </pre>
                </details>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
            {errorAction && onAction && (
              <button
                onClick={onAction}
                className={`text-xs px-3 py-1.5 rounded border transition-all font-semibold ${styles.button}`}
              >
                {errorActionLabel}
              </button>
            )}
            {isRetryable && onRetry && (
              <button
                onClick={onRetry}
                className={`text-xs px-3 py-1.5 rounded border transition-all font-semibold ${styles.button}`}
              >
                Retry
              </button>
            )}
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="text-zinc-500 hover:text-zinc-300 transition-colors w-6 h-6 flex items-center justify-center rounded"
                aria-label="Dismiss error"
              >
                ×
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Toast variant (for non-critical errors)
  return (
    <div className={`${styles.bg} ${styles.border} border rounded-lg p-3 shadow-lg ${className}`}>
      <div className="flex items-center gap-2">
        <span className="text-base">{getErrorIcon()}</span>
        <p className={`text-sm font-semibold ${styles.text} flex-1 break-words`}>
          {errorMessage}
        </p>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-zinc-500 hover:text-zinc-300 transition-colors flex-shrink-0"
            aria-label="Dismiss"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
};
