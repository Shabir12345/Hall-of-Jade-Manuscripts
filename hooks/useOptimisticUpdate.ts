import { useState, useCallback, useRef } from 'react';

/**
 * Hook for optimistic UI updates with automatic rollback on failure.
 * 
 * Immediately updates the UI for better perceived performance, then
 * reverts to the previous value if the async operation fails.
 * 
 * @template T - The type of the value being updated
 * @param initialValue - Initial state value
 * @param updateFn - Async function that performs the actual update operation
 * @returns {[T, (value: T) => Promise<void>, boolean, Error | null]} Tuple containing:
 *   - currentValue: Current value (optimistically updated)
 *   - optimisticUpdate: Function to trigger optimistic update
 *   - isPending: Boolean indicating if update is in progress
 *   - error: Error object if update failed (null otherwise)
 * 
 * @example
 * ```typescript
 * const [count, updateCount, isPending, error] = useOptimisticUpdate(
 *   0,
 *   async (newCount) => await saveCountToServer(newCount)
 * );
 * 
 * // Optimistically update UI immediately
 * await updateCount(count + 1);
 * // UI updates immediately, rollback if save fails
 * ```
 */
export function useOptimisticUpdate<T>(
  initialValue: T,
  updateFn: (value: T) => Promise<T>
): [T, (value: T) => Promise<void>, boolean, Error | null] {
  const [value, setValue] = useState<T>(initialValue);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const previousValueRef = useRef<T>(initialValue);

  const optimisticUpdate = useCallback(
    async (newValue: T) => {
      // Save previous value for potential rollback
      previousValueRef.current = value;
      
      // Optimistically update UI
      setValue(newValue);
      setError(null);
      setIsPending(true);

      try {
        // Perform actual update
        const result = await updateFn(newValue);
        setValue(result);
      } catch (err) {
        // Rollback on error
        setValue(previousValueRef.current);
        setError(err instanceof Error ? err : new Error(String(err)));
        throw err;
      } finally {
        setIsPending(false);
      }
    },
    [value, updateFn]
  );

  return [value, optimisticUpdate, isPending, error];
}
