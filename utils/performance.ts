/**
 * Performance utilities for optimizing expensive operations
 */

/**
 * Throttle a function to limit how often it can be called
 * 
 * @param func - Function to throttle
 * @param delay - Delay in milliseconds
 * @returns Throttled function
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return function throttled(...args: Parameters<T>) {
    const now = Date.now();
    const timeSinceLastCall = now - lastCall;

    const execute = () => {
      lastCall = Date.now();
      func(...args);
    };

    if (timeSinceLastCall >= delay) {
      execute();
    } else {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(execute, delay - timeSinceLastCall);
    }
  };
}

/**
 * Batch multiple operations together to reduce re-renders
 * 
 * @param operations - Array of operations to batch
 * @param batchSize - Number of operations per batch
 * @returns Promise that resolves when all batches complete
 */
export async function batchOperations<T>(
  operations: (() => Promise<T>)[],
  batchSize: number = 10
): Promise<T[]> {
  const results: T[] = [];
  
  for (let i = 0; i < operations.length; i += batchSize) {
    const batch = operations.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(op => op()));
    results.push(...batchResults);
  }
  
  return results;
}

/**
 * Memoize a function with a cache
 * 
 * @param fn - Function to memoize
 * @param getKey - Function to generate cache key from arguments
 * @returns Memoized function
 */
export function memoize<T extends (...args: any[]) => any>(
  fn: T,
  getKey?: (...args: Parameters<T>) => string
): T {
  const cache = new Map<string, ReturnType<T>>();

  return ((...args: Parameters<T>): ReturnType<T> => {
    const key = getKey 
      ? getKey(...args)
      : JSON.stringify(args);
    
    if (cache.has(key)) {
      return cache.get(key)!;
    }
    
    const result = fn(...args);
    cache.set(key, result);
    return result;
  }) as T;
}

/**
 * Check if a value has changed using deep equality
 * 
 * @param prev - Previous value
 * @param next - Next value
 * @returns True if values are different
 */
export function hasChanged(prev: any, next: any): boolean {
  if (prev === next) return false;
  if (prev == null || next == null) return prev !== next;
  if (typeof prev !== typeof next) return true;
  
  if (typeof prev === 'object') {
    if (Array.isArray(prev) !== Array.isArray(next)) return true;
    if (Array.isArray(prev)) {
      if (prev.length !== next.length) return true;
      return prev.some((item, index) => hasChanged(item, next[index]));
    }
    
    const prevKeys = Object.keys(prev);
    const nextKeys = Object.keys(next);
    if (prevKeys.length !== nextKeys.length) return true;
    
    return prevKeys.some(key => hasChanged(prev[key], next[key]));
  }
  
  return prev !== next;
}

/**
 * Lazy load a value that's expensive to compute
 * Only computes on first access
 * 
 * @param factory - Factory function to create the value
 * @returns Lazy value getter
 */
export function lazyValue<T>(factory: () => T): () => T {
  let cached: T | undefined;
  let initialized = false;

  return () => {
    if (!initialized) {
      cached = factory();
      initialized = true;
    }
    return cached!;
  };
}
