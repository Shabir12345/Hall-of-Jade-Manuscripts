import { describe, it, expect } from 'vitest';
import { formatErrorMessage, isRetryableError, AppError } from '../../utils/errorHandling';

describe('errorHandling utilities', () => {
  describe('formatErrorMessage', () => {
    it('should format API key errors', () => {
      const error = new Error('API key is missing');
      expect(formatErrorMessage(error)).toContain('API key');
    });

    it('should format network errors', () => {
      const error = new Error('network error occurred');
      expect(formatErrorMessage(error)).toContain('Network error');
    });

    it('should format rate limit errors', () => {
      const error = new Error('429 rate limit');
      expect(formatErrorMessage(error)).toContain('Rate limit');
    });

    it('should return generic message for unknown errors', () => {
      const error = { message: 'Some unknown error' };
      const message = formatErrorMessage(error);
      expect(message).toContain('An unexpected error occurred');
    });
  });

  describe('isRetryableError', () => {
    it('should identify network errors as retryable', () => {
      const error = new Error('network failure');
      expect(isRetryableError(error)).toBe(true);
    });

    it('should identify timeout errors as retryable', () => {
      const error = new Error('request timeout');
      expect(isRetryableError(error)).toBe(true);
    });

    it('should identify rate limit errors as retryable', () => {
      const error = new Error('429 rate limit exceeded');
      expect(isRetryableError(error)).toBe(true);
    });

    it('should identify server errors as retryable', () => {
      const error = new Error('500 internal server error');
      expect(isRetryableError(error)).toBe(true);
    });

    it('should not identify validation errors as retryable', () => {
      const error = new Error('validation failed');
      expect(isRetryableError(error)).toBe(false);
    });
  });

  describe('AppError', () => {
    it('should create an AppError with correct properties', () => {
      const error = new AppError('test error', 'TEST_CODE', 400, false);
      expect(error.message).toBe('test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.statusCode).toBe(400);
      expect(error.retryable).toBe(false);
    });
  });
});
