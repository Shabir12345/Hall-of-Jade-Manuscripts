/**
 * Safe Error Logging Utility
 * 
 * Provides safe error logging that handles objects that can't be converted to strings.
 * Prevents "Cannot convert object to primitive value" errors.
 */

/**
 * Safely converts an error or value to a string representation
 */
function safeStringify(error: unknown): string {
  if (error === null) {
    return 'null';
  }
  
  if (error === undefined) {
    return 'undefined';
  }
  
  // Handle Error objects
  if (error instanceof Error) {
    return error.message || error.toString() || 'Error (no message)';
  }
  
  // Handle strings
  if (typeof error === 'string') {
    return error;
  }
  
  // Handle primitives
  if (typeof error !== 'object') {
    return String(error);
  }
  
  // Handle objects - try JSON.stringify with error handling
  try {
    // Check for circular references by trying to stringify
    const seen = new WeakSet();
    return JSON.stringify(error, (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular]';
        }
        seen.add(value);
      }
      return value;
    }, 2);
  } catch (e) {
    // If JSON.stringify fails, try to get a basic representation
    try {
      return String(error);
    } catch {
      return '[Object that cannot be stringified]';
    }
  }
}

/**
 * Safely logs an error to console.error
 * Handles objects that can't be converted to strings
 */
export function safeConsoleError(message: string, error?: unknown, ...args: unknown[]): void {
  try {
    if (error !== undefined) {
      const errorString = safeStringify(error);
      console.error(message, errorString, ...args.map(arg => safeStringify(arg)));
    } else {
      console.error(message, ...args.map(arg => safeStringify(arg)));
    }
  } catch (e) {
    // Last resort: if even our safe logging fails, use a minimal message
    console.error('Error logging failed:', String(e));
    console.error('Original message:', message);
  }
}

/**
 * Safely logs a warning to console.warn
 */
export function safeConsoleWarn(message: string, ...args: unknown[]): void {
  try {
    console.warn(message, ...args.map(arg => safeStringify(arg)));
  } catch (e) {
    console.warn('Warning logging failed:', String(e));
    console.warn('Original message:', message);
  }
}

/**
 * Safely logs info to console.info
 */
export function safeConsoleInfo(message: string, ...args: unknown[]): void {
  try {
    console.info(message, ...args.map(arg => safeStringify(arg)));
  } catch (e) {
    console.info('Info logging failed:', String(e));
    console.info('Original message:', message);
  }
}

/**
 * Safely logs debug to console.debug
 */
export function safeConsoleDebug(message: string, ...args: unknown[]): void {
  try {
    console.debug(message, ...args.map(arg => safeStringify(arg)));
  } catch (e) {
    console.debug('Debug logging failed:', String(e));
    console.debug('Original message:', message);
  }
}
