/**
 * Safe Console Helpers
 * 
 * Provides safe console logging functions that handle objects that can't be converted to strings.
 * Prevents "Cannot convert object to primitive value" errors.
 */

/**
 * Safely converts a value to a string representation
 */
function safeStringify(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return value;
  if (typeof value !== 'object') return String(value);
  
  if (value instanceof Error) {
    return value.message || value.toString() || 'Error (no message)';
  }
  
  try {
    const seen = new WeakSet();
    return JSON.stringify(value, (key, val) => {
      if (typeof val === 'object' && val !== null) {
        if (seen.has(val)) return '[Circular]';
        seen.add(val);
      }
      return val;
    }, 2);
  } catch {
    try {
      return String(value);
    } catch {
      return '[Object that cannot be stringified]';
    }
  }
}

/**
 * Safely logs an error
 */
export function safeError(message: string, error?: unknown, ...args: unknown[]): void {
  try {
    if (error !== undefined) {
      console.error(message, safeStringify(error), ...args.map(safeStringify));
    } else {
      console.error(message, ...args.map(safeStringify));
    }
  } catch {
    console.error(message, '[Error logging failed]');
  }
}

/**
 * Safely logs a warning
 */
export function safeWarn(message: string, ...args: unknown[]): void {
  try {
    console.warn(message, ...args.map(safeStringify));
  } catch {
    console.warn(message, '[Warning logging failed]');
  }
}

/**
 * Safely logs info
 */
export function safeInfo(message: string, ...args: unknown[]): void {
  try {
    console.info(message, ...args.map(safeStringify));
  } catch {
    console.info(message, '[Info logging failed]');
  }
}
