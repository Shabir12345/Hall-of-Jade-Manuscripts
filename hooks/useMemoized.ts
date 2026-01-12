import { useMemo, useRef, useEffect } from 'react';

/**
 * Memoize a computed value with a custom equality function.
 * 
 * More flexible than useMemo when you need custom comparison logic.
 * This hook provides fine-grained control over when to recompute values
 * based on custom equality functions.
 * 
 * @template T - The type of the computed value
 * @param computeFn - Function that computes the value
 * @param dependencies - Dependency array (similar to useMemo/useEffect)
 * @param equalityFn - Optional custom equality function for comparing previous and next values (defaults to shallow equality)
 * @returns {T} The memoized value, recomputed only when dependencies change or equality function returns false
 * 
 * @example
 * ```typescript
 * const expensiveValue = useMemoized(
 *   () => computeExpensiveValue(a, b),
 *   [a, b],
 *   (prev, next) => prev.id === next.id // Custom equality check
 * );
 * ```
 */
export function useMemoized<T>(
  computeFn: () => T,
  dependencies: React.DependencyList,
  equalityFn?: (prev: T, next: T) => boolean
): T {
  const prevValueRef = useRef<T | undefined>(undefined);
  const prevDepsRef = useRef<React.DependencyList>(dependencies);
  const computedValueRef = useRef<T | undefined>(undefined);

  const defaultEqualityFn = (prev: T, next: T): boolean => {
    if (prev === next) return true;
    if (typeof prev !== 'object' || typeof next !== 'object') return false;
    if (prev === null || next === null) return false;
    
    // Shallow equality check
    const prevKeys = Object.keys(prev);
    const nextKeys = Object.keys(next);
    if (prevKeys.length !== nextKeys.length) return false;
    
    for (const key of prevKeys) {
      if ((prev as any)[key] !== (next as any)[key]) return false;
    }
    return true;
  };

  // Check if dependencies changed
  const depsChanged = useMemo(() => {
    if (prevDepsRef.current.length !== dependencies.length) return true;
    return !prevDepsRef.current.every((dep, i) => Object.is(dep, dependencies[i]));
  }, dependencies);

  // Recompute value when dependencies change
  useEffect(() => {
    if (depsChanged) {
      prevDepsRef.current = dependencies;
    }
  }, [depsChanged, dependencies]);

  // Compute value with proper memoization
  return useMemo(() => {
    const newValue = computeFn();
    
    // First computation or dependencies changed
    if (computedValueRef.current === undefined || depsChanged) {
      computedValueRef.current = newValue;
      prevValueRef.current = newValue;
      return newValue;
    }

    // Compare with previous value using equality function
    const prevValue = prevValueRef.current;
    const isEqual = prevValue !== undefined && (equalityFn || defaultEqualityFn)(prevValue, newValue);
    
    if (!isEqual) {
      prevValueRef.current = newValue;
      computedValueRef.current = newValue;
    }
    
    return computedValueRef.current;
  }, [computeFn, depsChanged, equalityFn]);
}
