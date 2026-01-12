import { useState, useEffect } from 'react';

/**
 * Hook to debounce a value.
 * 
 * Useful for search inputs, auto-save, and other scenarios where you want
 * to delay updating a value until after the user has stopped making changes.
 * 
 * @template T - The type of the value to debounce
 * @param value - The value to debounce
 * @param delay - Delay in milliseconds before updating the debounced value (default: 300ms)
 * @returns {T} The debounced value that updates after the delay period
 * 
 * @example
 * ```typescript
 * const [searchTerm, setSearchTerm] = useState('');
 * const debouncedSearchTerm = useDebounce(searchTerm, 500);
 * 
 * // debouncedSearchTerm updates 500ms after searchTerm stops changing
 * useEffect(() => {
 *   if (debouncedSearchTerm) {
 *     performSearch(debouncedSearchTerm);
 *   }
 * }, [debouncedSearchTerm]);
 * ```
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
