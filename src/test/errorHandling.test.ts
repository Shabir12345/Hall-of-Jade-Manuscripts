/**
 * Error Handling Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { formatErrorMessage, isRetryableError, AppError, withRetry } from '../../utils/errorHandling';

describe('errorHandling', () => {
  describe('formatErrorMessage', () => {
    it('should format Supabase authentication errors', () => {
      const error = { code: 'PGRST116', message: 'JWT invalid' };
      const message = formatErrorMessage(error);
      expect(message).toContain('authentication');
    });

    it('should format network errors', () => {
      const error = new Error('Failed to fetch');
      const message = formatErrorMessage(error);
      expect(message).toMatch(/Network|connection/i);
    });

    it('should format rate limit errors', () => {
      const error = new Error('429 rate limit exceeded');
      const message = formatErrorMessage(error);
      expect(message).toContain('Rate limit');
    });

    it('should format timeout errors', () => {
      const error = new Error('request timeout');
      const message = formatErrorMessage(error);
      expect(message).toContain('timed out');
    });
  });

  describe('isRetryableError', () => {
    it('should identify network errors as retryable', () => {
      const error = new Error('network failure');
      expect(isRetryableError(error)).toBe(true);
    });

    it('should identify 5xx errors as retryable', () => {
      const error = new Error('500 internal server error');
      expect(isRetryableError(error)).toBe(true);
    });

    it('should not identify validation errors as retryable', () => {
      const error = new Error('validation failed');
      expect(isRetryableError(error)).toBe(false);
    });
  });

  describe('withRetry', () => {
    it('should retry on failure', async () => {
      let attempts = 0;
      const fn = async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('network error');
        }
        return 'success';
      };

      const result = await withRetry(fn, {
        maxRetries: 3,
        retryable: isRetryableError,
      });

      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });

    it('should not retry non-retryable errors', async () => {
      const fn = async () => {
        throw new Error('validation error');
      };

      await expect(
        withRetry(fn, {
          maxRetries: 3,
          retryable: isRetryableError,
        })
      ).rejects.toThrow('validation error');
    });
  });

  describe('AppError', () => {
    it('should create AppError with correct properties', () => {
      const error = new AppError('test error', 'TEST_CODE', 400, false);
      
      expect(error.message).toBe('test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.statusCode).toBe(400);
      expect(error.retryable).toBe(false);
      expect(error.canRecover()).toBe(false);
    });

    it('should mark retryable errors as recoverable', () => {
      const error = new AppError('retryable error', 'RETRY_CODE', 500, true);
      
      expect(error.retryable).toBe(true);
      expect(error.canRecover()).toBe(true);
    });
  });
});
