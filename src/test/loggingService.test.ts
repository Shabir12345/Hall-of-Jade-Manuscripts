/**
 * Logging Service Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { logger, LogLevel } from '../../services/loggingService';

describe('loggingService', () => {
  beforeEach(() => {
    // Clear console mocks before each test
    vi.clearAllMocks();
  });

  describe('logger', () => {
    it('should log debug messages in development', () => {
      const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
      
      logger.debug('Test debug message', 'test');
      
      if (import.meta.env.DEV) {
        expect(consoleSpy).toHaveBeenCalled();
      }
      
      consoleSpy.mockRestore();
    });

    it('should log info messages', () => {
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      
      logger.info('Test info message', 'test');
      
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('should log warning messages', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      logger.warn('Test warning message', 'test');
      
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('should log error messages', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const testError = new Error('Test error');
      
      logger.error('Test error message', 'test', testError);
      
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('should sanitize sensitive data', () => {
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      
      logger.info('Test with sensitive data', 'test', {
        apiKey: 'secret-api-key-12345',
        password: 'secret-password',
      });
      
      expect(consoleSpy).toHaveBeenCalled();
      const callArgs = consoleSpy.mock.calls[0][0];
      
      // Check that sensitive data is masked
      expect(callArgs).not.toContain('secret-api-key-12345');
      expect(callArgs).not.toContain('secret-password');
      
      consoleSpy.mockRestore();
    });

    it('should create logger with context', () => {
      const contextLogger = logger.createLogger('test-context');
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      
      contextLogger.info('Test message', { data: 'test' });
      
      expect(consoleSpy).toHaveBeenCalled();
      const callArgs = consoleSpy.mock.calls[0][0];
      expect(callArgs).toContain('test-context');
      
      consoleSpy.mockRestore();
    });
  });

  describe('log levels', () => {
    it('should respect minimum log level in production', () => {
      const originalEnv = import.meta.env.PROD;
      Object.defineProperty(import.meta, 'env', {
        value: { ...import.meta.env, PROD: true },
        writable: true,
      });

      const consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
      
      logger.setMinLevel('INFO');
      logger.debug('This should not log in production', 'test');
      
      expect(consoleDebugSpy).not.toHaveBeenCalled();
      
      consoleDebugSpy.mockRestore();
      Object.defineProperty(import.meta, 'env', {
        value: { ...import.meta.env, PROD: originalEnv },
        writable: true,
      });
    });
  });
});
