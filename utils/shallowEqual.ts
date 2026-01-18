/**
 * Shallow equality check for objects and arrays
 * Replaces expensive JSON.stringify comparisons
 */

/**
 * Shallow equality check for objects
 */
export function shallowEqualObjects<T extends Record<string, any>>(
  objA: T | null | undefined,
  objB: T | null | undefined
): boolean {
  if (objA === objB) return true;
  if (!objA || !objB) return false;
  if (typeof objA !== 'object' || typeof objB !== 'object') return false;

  const keysA = Object.keys(objA);
  const keysB = Object.keys(objB);

  if (keysA.length !== keysB.length) return false;

  for (let i = 0; i < keysA.length; i++) {
    const key = keysA[i];
    if (!(key in objB) || objA[key] !== objB[key]) {
      return false;
    }
  }

  return true;
}

/**
 * Shallow equality check for arrays
 */
export function shallowEqualArrays<T>(arrA: T[] | null | undefined, arrB: T[] | null | undefined): boolean {
  if (arrA === arrB) return true;
  if (!arrA || !arrB) return false;
  if (arrA.length !== arrB.length) return false;

  for (let i = 0; i < arrA.length; i++) {
    if (arrA[i] !== arrB[i]) {
      return false;
    }
  }

  return true;
}

/**
 * Shallow equality check for any value (handles primitives, objects, arrays)
 */
export function shallowEqual<T>(a: T, b: T): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    return shallowEqualArrays(a, b);
  }

  if (typeof a === 'object' && typeof b === 'object') {
    return shallowEqualObjects(a as Record<string, any>, b as Record<string, any>);
  }

  return false;
}
