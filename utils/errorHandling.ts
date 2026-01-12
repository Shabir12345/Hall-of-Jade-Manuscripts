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
          // Fallback to console if logger unavailable
          console.error(`Error in ${context}:`, error);
        });
      }
      throw error;
    }
  }) as T;
}

/**
 * Formats error messages for user display
 */
export function formatErrorMessage(error: unknown): string {
  // Handle Supabase-specific errors
  if (error && typeof error === 'object') {
    const supabaseError = error as Record<string, unknown>;
    
    // Check for Supabase error structure
    if (supabaseError.code) {
      // Common Supabase error codes
      if (supabaseError.code === 'PGRST116' || supabaseError.message?.includes('JWT')) {
        return 'Supabase authentication failed. Check your VITE_SUPABASE_ANON_KEY in .env.local';
      }
      if (supabaseError.code === '22P02' || supabaseError.message?.includes('invalid input')) {
        return 'Database validation error. Check your data format.';
      }
      if (supabaseError.code === '23503' || supabaseError.message?.includes('foreign key')) {
        return 'Database relationship error. Some referenced data may be missing.';
      }
      if (supabaseError.message) {
        return supabaseError.message.length < 200 
          ? `${supabaseError.message} (Code: ${supabaseError.code})`
          : `Database error (Code: ${supabaseError.code})`;
      }
    }
    
    // Check for network-related errors
    if (supabaseError.message) {
      if (supabaseError.message.includes('Failed to fetch') || 
          supabaseError.message.includes('NetworkError') ||
          supabaseError.message.includes('fetch')) {
        return 'Cannot connect to Supabase. Check your VITE_SUPABASE_URL and internet connection.';
      }
      if (supabaseError.message.includes('API key') || 
          supabaseError.message.includes('JWT') ||
          supabaseError.message.includes('Invalid API key')) {
        return 'Supabase API key is missing or invalid. Check your .env.local file.';
      }
    }
  }
  
  if (error instanceof Error) {
    // User-friendly messages for common errors
    if (error.message.includes('API key') || error.message.includes('JWT')) {
      return 'API key is missing or invalid. Please check your environment variables.';
    }
    if (error.message.includes('network') || error.message.includes('fetch')) {
      return 'Network error. Please check your internet connection and try again.';
    }
    if (error.message.includes('429') || error.message.includes('rate limit')) {
      return 'Rate limit exceeded. Please wait a moment and try again.';
    }
    if (error.message.includes('timeout')) {
      return 'Request timed out. Please try again.';
    }
    // Return the error message if it's user-friendly
    if (error.message.length < 200) {
      return error.message;
    }
  }
  return 'An unexpected error occurred. Please try again. Check browser console (F12) for details.';
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
