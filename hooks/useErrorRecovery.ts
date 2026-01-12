import { useState, useCallback } from 'react';

export interface RetryOptions {
  maxRetries?: number;
  retryDelay?: number;
  exponentialBackoff?: boolean;
}

/**
 * Hook for error recovery with retry logic
 * Useful for API calls and network operations
 * 
 * @param operation - Async function to execute with retry logic
 * @param options - Retry configuration options
 * @returns [execute, isRetrying, retryCount, error, reset]
 */
export function useErrorRecovery<T extends (...args: any[]) => Promise<any>>(
  operation: T,
  options: RetryOptions = {}
) {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    exponentialBackoff = true,
  } = options;

  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [error, setError] = useState<Error | null>(null);

  const reset = useCallback(() => {
    setIsRetrying(false);
    setRetryCount(0);
    setError(null);
  }, []);

  const execute = useCallback(
    async (...args: Parameters<T>): Promise<ReturnType<T> extends Promise<infer R> ? R : never> => {
      let lastError: Error | null = null;
      
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          setRetryCount(attempt);
          if (attempt > 0) {
            setIsRetrying(true);
            const delay = exponentialBackoff
              ? retryDelay * Math.pow(2, attempt - 1)
              : retryDelay;
            await new Promise(resolve => setTimeout(resolve, delay));
          }
          
          const result = await operation(...args);
          setError(null);
          setIsRetrying(false);
          setRetryCount(0);
          return result as any;
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));
          setError(lastError);
          
          if (attempt === maxRetries) {
            setIsRetrying(false);
            throw lastError;
          }
        }
      }
      
      throw lastError || new Error('Operation failed after retries');
    },
    [operation, maxRetries, retryDelay, exponentialBackoff]
  );

  return [execute, isRetrying, retryCount, error, reset] as const;
}
