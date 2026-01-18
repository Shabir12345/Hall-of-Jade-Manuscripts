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

// ============================================================================
// Structured Logging for Chapter Generation
// ============================================================================

export interface GenerationLogEntry {
  chapterNumber: number;
  phase: string;
  health?: number;
  warnings?: number;
  blockers?: number;
  constraints?: string[];
  threadSummary?: {
    active: number;
    stalled: number;
    atRisk: number;
  };
  duration?: number;
  error?: string;
}

/**
 * Log chapter generation start with health summary
 */
export function logGenerationStart(entry: GenerationLogEntry): void {
  const healthEmoji = (entry.health || 0) >= 80 ? '✅' : 
                      (entry.health || 0) >= 60 ? '⚠️' : '❌';
  
  console.group(`📝 Chapter ${entry.chapterNumber} Generation Starting`);
  console.log(`${healthEmoji} Story Health: ${entry.health || 'N/A'}/100`);
  
  if (entry.threadSummary) {
    console.log(`📚 Threads: ${entry.threadSummary.active} active, ${entry.threadSummary.stalled} stalled, ${entry.threadSummary.atRisk} at risk`);
  }
  
  if (entry.blockers && entry.blockers > 0) {
    console.error(`🚫 ${entry.blockers} blocker(s) detected`);
  }
  
  if (entry.warnings && entry.warnings > 0) {
    console.warn(`⚠️ ${entry.warnings} warning(s)`);
  }
  
  if (entry.constraints && entry.constraints.length > 0) {
    console.log(`📋 ${entry.constraints.length} constraint(s) added to prompt`);
  }
  
  console.groupEnd();
}

/**
 * Log chapter generation phase
 */
export function logGenerationPhase(chapterNumber: number, phase: string, data?: Record<string, unknown>): void {
  const phaseEmoji: Record<string, string> = {
    'quality_check': '🔍',
    'prompt_build_start': '🔧',
    'prompt_build_end': '✅',
    'queue_estimate': '⏳',
    'queue_dequeued': '▶️',
    'llm_request_start': '🤖',
    'llm_request_end': '📄',
    'quality_validation': '📊',
    'parse_start': '📝',
    'parse_end': '✅',
    'regeneration_start': '🔄',
    'regeneration_complete': '✅',
    'regeneration_error': '❌',
  };
  
  const emoji = phaseEmoji[phase] || '📌';
  console.log(`${emoji} Chapter ${chapterNumber} - ${phase}`, data ? data : '');
}

/**
 * Log chapter generation complete with summary
 */
export function logGenerationComplete(entry: GenerationLogEntry): void {
  console.group(`✅ Chapter ${entry.chapterNumber} Generation Complete`);
  
  if (entry.duration) {
    console.log(`⏱️ Duration: ${(entry.duration / 1000).toFixed(1)}s`);
  }
  
  if (entry.health !== undefined) {
    const healthEmoji = entry.health >= 80 ? '✅' : entry.health >= 60 ? '⚠️' : '❌';
    console.log(`${healthEmoji} Final Health: ${entry.health}/100`);
  }
  
  console.groupEnd();
}

/**
 * Log chapter generation error
 */
export function logGenerationError(chapterNumber: number, error: string, details?: Record<string, unknown>): void {
  console.group(`❌ Chapter ${chapterNumber} Generation Failed`);
  console.error(`Error: ${error}`);
  if (details) {
    console.error('Details:', details);
  }
  console.groupEnd();
}
