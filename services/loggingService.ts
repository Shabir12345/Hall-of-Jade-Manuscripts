/**
 * Logging Service
 * 
 * Provides structured logging with levels and environment-based filtering.
 * Replaces all console.* calls with a centralized, configurable logging system.
 * 
 * Features:
 * - Environment-based log levels (DEBUG in dev, INFO+ in production)
 * - Automatic sanitization of sensitive data (API keys, passwords)
 * - Structured logging with context and metadata
 * - Module-specific loggers for better organization
 * 
 * @example
 * ```typescript
 * import { logger } from './services/loggingService';
 * 
 * logger.info('User logged in', 'auth', { userId: user.id });
 * logger.error('Database error', 'database', error);
 * 
 * // Module-specific logger
 * const authLogger = logger.createLogger('auth');
 * authLogger.info('Authentication successful');
 * ```
 */

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: number;
  context?: string;
  data?: Record<string, unknown>;
  error?: Error;
}

type LogFilter = (entry: LogEntry) => boolean;

class LoggingService {
  private minLevel: LogLevel;
  private filters: LogFilter[] = [];
  private isProduction: boolean;
  private isDevelopment: boolean;

  constructor() {
    // Determine environment
    this.isProduction = import.meta.env.PROD;
    this.isDevelopment = import.meta.env.DEV;

    // Set minimum log level based on environment
    // In production: INFO and above
    // In development: DEBUG and above
    this.minLevel = this.isProduction ? 'INFO' : 'DEBUG';

    // Add environment-based filter
    this.addFilter((entry) => {
      const levels: LogLevel[] = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
      const entryLevelIndex = levels.indexOf(entry.level);
      const minLevelIndex = levels.indexOf(this.minLevel);
      return entryLevelIndex >= minLevelIndex;
    });
  }

  /**
   * Sets the minimum log level
   */
  setMinLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  /**
   * Adds a filter function to the logging pipeline
   */
  addFilter(filter: LogFilter): void {
    this.filters.push(filter);
  }

  /**
   * Removes all filters
   */
  clearFilters(): void {
    this.filters = [];
  }

  /**
   * Sanitizes data to prevent logging sensitive information
   */
  private sanitizeData(data: unknown): unknown {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const sensitiveKeys = [
      'password',
      'apiKey',
      'api_key',
      'apikey',
      'secret',
      'token',
      'authorization',
      'auth',
      'anonKey',
      'anon_key',
      'supabaseKey',
      'supabase_key',
      'geminiApiKey',
      'gemini_api_key',
      'deepseekApiKey',
      'deepseek_api_key',
    ];

    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      const lowerKey = key.toLowerCase();
      const isSensitive = sensitiveKeys.some((sensitive) =>
        lowerKey.includes(sensitive)
      );

      if (isSensitive && typeof value === 'string' && value.length > 0) {
        // Mask sensitive data: show only first 4 chars and last 4 chars if long enough
        if (value.length > 8) {
          sanitized[key] = `${value.substring(0, 4)}...${value.substring(value.length - 4)}`;
        } else {
          sanitized[key] = '***REDACTED***';
        }
      } else if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Error)) {
        // Recursively sanitize nested objects
        sanitized[key] = this.sanitizeData(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Formats log entry for output
   */
  private formatEntry(entry: LogEntry): string {
    const time = new Date(entry.timestamp).toISOString();
    const context = entry.context ? `[${entry.context}]` : '';
    const prefix = `${time} ${entry.level} ${context}`.trim();

    if (entry.error) {
      return `${prefix} ${entry.message}\n${entry.error.stack || entry.error.message}`;
    }

    if (entry.data) {
      try {
        const dataStr = JSON.stringify(this.sanitizeData(entry.data), null, 2);
        return `${prefix} ${entry.message}\n${dataStr}`;
      } catch {
        // If JSON.stringify fails, just include the message
        return `${prefix} ${entry.message}`;
      }
    }

    return `${prefix} ${entry.message}`;
  }

  /**
   * Determines if an entry should be logged based on filters
   */
  private shouldLog(entry: LogEntry): boolean {
    return this.filters.every((filter) => filter(entry));
  }

  /**
   * Internal logging method
   */
  private log(level: LogLevel, message: string, context?: string, data?: Record<string, unknown>, error?: Error): void {
    const entry: LogEntry = {
      level,
      message,
      timestamp: Date.now(),
      context,
      data: data ? (this.sanitizeData(data) as Record<string, unknown>) : undefined,
      error,
    };

    if (!this.shouldLog(entry)) {
      return;
    }

    const formatted = this.formatEntry(entry);

    // Route to appropriate console method
    switch (level) {
      case 'DEBUG':
        if (this.isDevelopment) {
          console.debug(formatted);
        }
        break;
      case 'INFO':
        console.info(formatted);
        break;
      case 'WARN':
        console.warn(formatted);
        break;
      case 'ERROR':
        console.error(formatted);
        // In production, you might want to send to error tracking service
        if (this.isProduction && entry.error) {
          // TODO: Send to error tracking service (Sentry, etc.)
        }
        break;
    }
  }

  /**
   * Logs a debug message (only in development)
   */
  debug(message: string, context?: string, data?: Record<string, unknown>): void {
    this.log('DEBUG', message, context, data);
  }

  /**
   * Logs an info message
   */
  info(message: string, context?: string, data?: Record<string, unknown>): void {
    this.log('INFO', message, context, data);
  }

  /**
   * Logs a warning message
   */
  warn(message: string, context?: string, data?: Record<string, unknown>): void {
    this.log('WARN', message, context, data);
  }

  /**
   * Logs an error message
   */
  error(message: string, context?: string, error?: Error, data?: Record<string, unknown>): void {
    this.log('ERROR', message, context, data, error);
  }

  /**
   * Creates a logger instance with a specific context
   * Useful for module-specific logging
   */
  createLogger(context: string) {
    return {
      debug: (message: string, data?: Record<string, unknown>) => this.debug(message, context, data),
      info: (message: string, data?: Record<string, unknown>) => this.info(message, context, data),
      warn: (message: string, data?: Record<string, unknown>) => this.warn(message, context, data),
      error: (message: string, error?: Error, data?: Record<string, unknown>) =>
        this.error(message, context, error, data),
    };
  }
}

// Singleton instance
export const logger = new LoggingService();

// Export convenience functions
export const logDebug = (message: string, context?: string, data?: Record<string, unknown>) =>
  logger.debug(message, context, data);
export const logInfo = (message: string, context?: string, data?: Record<string, unknown>) =>
  logger.info(message, context, data);
export const logWarn = (message: string, context?: string, data?: Record<string, unknown>) =>
  logger.warn(message, context, data);
export const logError = (message: string, context?: string, error?: Error, data?: Record<string, unknown>) =>
  logger.error(message, context, error, data);
