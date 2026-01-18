/**
 * Error handling utilities with retry logic
 */

// Import logger dynamically to avoid circular dependencies
let loggerInstance: typeof import('../services/loggingService').logger | null = null;

async function getLogger() {
  if (!loggerInstance) {
    const loggerModule = await import('../services/loggingService');
    loggerInstance = loggerModule.logger;
  }
  return loggerInstance;
}

export interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  retryable?: (error: unknown) => boolean;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  retryable: () => true,
};

/**
 * Determines if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    // Network errors
    if (error.message.includes('network') || error.message.includes('fetch')) {
      return true;
    }
    // Timeout errors
    if (error.message.includes('timeout')) {
      return true;
    }
    // Rate limiting (429)
    if (error.message.includes('429') || error.message.includes('rate limit')) {
      return true;
    }
    // Server errors (5xx)
    if (error.message.match(/5\d{2}/)) {
      return true;
    }
  }
  return false;
}

/**
 * Sleep utility for delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retries a function with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: unknown;
  let delay = opts.initialDelay;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry if error is not retryable
      if (!opts.retryable(error)) {
        throw error;
      }

      // Don't sleep after last attempt
      if (attempt < opts.maxRetries) {
        await sleep(delay);
        delay = Math.min(delay * opts.backoffMultiplier, opts.maxDelay);
      }
    }
  }

  throw lastError;
}

/**
 * Wraps an async function with error handling and retry logic
 */
export function createErrorHandler<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options: RetryOptions & {
    onError?: (error: unknown, context: string) => void;
    context?: string;
  } = {}
): T {
  const { onError, context = 'Operation', ...retryOptions } = options;

  return (async (...args: Parameters<T>) => {
    try {
      return await withRetry(() => fn(...args), retryOptions);
    } catch (error) {
      if (onError) {
        onError(error, context);
      } else {
        // Log error using logger service
        getLogger().then(logger => {
          logger.error(`Error in ${context}`, 'errorHandling', error instanceof Error ? error : new Error(String(error)));
        }).catch(() => {
          // Fallback to console if logger unavailable - use safe logging
          try {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`Error in ${context}:`, errorMessage);
          } catch (e) {
            console.error(`Error in ${context} (details unavailable)`);
          }
        });
      }
      throw error;
    }
  }) as T;
}

/**
 * Formats error messages for user display with actionable guidance
 */
export interface FormattedError {
  message: string;
  action?: string;
  actionLabel?: string;
  details?: string;
  retryable?: boolean;
}

export function formatErrorMessage(error: unknown): string {
  const formatted = formatErrorWithActions(error);
  return formatted.message;
}

export function formatErrorWithActions(error: unknown): FormattedError {
  // Handle Supabase-specific errors
  if (error && typeof error === 'object') {
    const supabaseError = error as Record<string, unknown>;
    
    // Check for Supabase error structure
    if (supabaseError.code) {
      // Common Supabase error codes
      if (supabaseError.code === 'PGRST116' || supabaseError.message?.includes('JWT')) {
        return {
          message: 'Authentication failed. Your Supabase API key may be missing or invalid.',
          action: 'Check your .env.local file for VITE_SUPABASE_ANON_KEY',
          actionLabel: 'View Setup Guide',
          details: 'Ensure VITE_SUPABASE_ANON_KEY is set correctly in your .env.local file.',
          retryable: false,
        };
      }
      if (supabaseError.code === '22P02' || supabaseError.message?.includes('invalid input')) {
        return {
          message: 'Invalid data format. Please check your input and try again.',
          action: 'Review the data you entered',
          actionLabel: 'Review Data',
          details: 'The data format doesn\'t match what the database expects.',
          retryable: true,
        };
      }
      if (supabaseError.code === '23503' || supabaseError.message?.includes('foreign key')) {
        return {
          message: 'Cannot complete this action. Some required data is missing.',
          action: 'Check that all referenced items exist',
          actionLabel: 'Check References',
          details: 'This item references another item that doesn\'t exist. Please create the referenced item first.',
          retryable: false,
        };
      }
      if (supabaseError.message) {
        const message = supabaseError.message.length < 200 
          ? `${supabaseError.message} (Code: ${supabaseError.code})`
          : `Database error (Code: ${supabaseError.code})`;
        return {
          message,
          details: `Error code: ${supabaseError.code}`,
          retryable: true,
        };
      }
    }
    
    // Check for network-related errors
    if (supabaseError.message) {
      if (supabaseError.message.includes('Failed to fetch') || 
          supabaseError.message.includes('NetworkError') ||
          supabaseError.message.includes('fetch')) {
        return {
          message: 'Cannot connect to the server. Please check your internet connection.',
          action: 'Check your connection and try again',
          actionLabel: 'Retry',
          details: 'Verify VITE_SUPABASE_URL is correct and your internet connection is working.',
          retryable: true,
        };
      }
      if (supabaseError.message.includes('API key') || 
          supabaseError.message.includes('JWT') ||
          supabaseError.message.includes('Invalid API key')) {
        return {
          message: 'API key is missing or invalid. Please check your configuration.',
          action: 'Check your .env.local file',
          actionLabel: 'View Setup',
          details: 'Ensure VITE_SUPABASE_ANON_KEY is set correctly.',
          retryable: false,
        };
      }
    }
  }
  
  if (error instanceof Error) {
    // User-friendly messages for common errors
    if (error.message.includes('API key') || error.message.includes('JWT')) {
      return {
        message: 'API key is missing or invalid. Please check your environment variables.',
        action: 'Check your .env.local file',
        actionLabel: 'View Setup',
        details: 'Ensure all required environment variables are set correctly.',
        retryable: false,
      };
    }
    if (error.message.includes('network') || error.message.includes('fetch')) {
      return {
        message: 'Network error. Please check your internet connection.',
        action: 'Check your connection and try again',
        actionLabel: 'Retry',
        details: 'Unable to reach the server. Check your internet connection.',
        retryable: true,
      };
    }
    if (error.message.includes('429') || error.message.includes('rate limit')) {
      return {
        message: 'Rate limit exceeded. Please wait a moment before trying again.',
        action: 'Wait a few seconds and try again',
        actionLabel: 'Retry',
        details: 'Too many requests. Please wait before retrying.',
        retryable: true,
      };
    }
    if (error.message.includes('timeout')) {
      return {
        message: 'Request timed out. The server may be slow or unavailable.',
        action: 'Try again',
        actionLabel: 'Retry',
        details: 'The request took too long to complete.',
        retryable: true,
      };
    }
    // Return the error message if it's user-friendly
    if (error.message.length < 200) {
      return {
        message: error.message,
        retryable: isRetryableError(error),
      };
    }
  }
  return {
    message: 'An unexpected error occurred. Please try again.',
    action: 'Check browser console (F12) for details',
    actionLabel: 'View Details',
    details: 'If this problem persists, please check the browser console for more information.',
    retryable: true,
  };
}

/**
 * Error class for application-specific errors
 */
export class AppError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode?: number,
    public retryable: boolean = false,
    public recoverable: boolean = false
  ) {
    super(message);
    this.name = 'AppError';
    Object.setPrototypeOf(this, AppError.prototype);
  }

  /**
   * Check if this error is recoverable (can be handled gracefully)
   */
  canRecover(): boolean {
    return this.recoverable || this.retryable;
  }
}

/**
 * Create a recoverable error with context
 */
export function createRecoverableError(
  message: string,
  recoveryAction?: () => Promise<void>
): AppError {
  const error = new AppError(message, undefined, undefined, true, true);
  if (recoveryAction) {
    (error as any).recoveryAction = recoveryAction;
  }
  return error;
}

/**
 * Attempt to recover from an error
 * 
 * @param error - Error to recover from
 * @param recoveryActions - Map of error codes to recovery functions
 * @returns True if recovery was attempted
 */
export async function attemptRecovery(
  error: unknown,
  recoveryActions: Map<string, () => Promise<void>>
): Promise<boolean> {
  if (!(error instanceof AppError) || !error.canRecover()) {
    return false;
  }

  // Try recovery action from error
  const errorWithRecovery = error as AppError & { recoveryAction?: () => Promise<void> };
  if (errorWithRecovery.recoveryAction) {
    try {
      await errorWithRecovery.recoveryAction();
      return true;
    } catch {
      return false;
    }
  }

  // Try recovery action from map
  if (error.code && recoveryActions.has(error.code)) {
    try {
      await recoveryActions.get(error.code)!();
      return true;
    } catch {
      return false;
    }
  }

  return false;
}
