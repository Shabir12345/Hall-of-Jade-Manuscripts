# Error Handling Standardization

## Overview

This document describes the standardized error handling patterns used throughout the application.

## Standardized Error Handling Patterns

### 1. Use AppError for Application Errors

```typescript
import { AppError } from './utils/errorHandling';

// Create an error with context
throw new AppError(
  'User must be authenticated',
  'AUTH_ERROR',
  401,
  false, // retryable
  false  // recoverable
);
```

### 2. Use Logger Service for Error Logging

```typescript
import { logger } from './services/loggingService';

try {
  // operation
} catch (error) {
  logger.error('Operation failed', 'context', error instanceof Error ? error : new Error(String(error)));
  throw error;
}
```

### 3. Use withRetry for Retryable Operations

```typescript
import { withRetry, isRetryableError } from './utils/errorHandling';

const result = await withRetry(
  async () => {
    // operation that might fail
  },
  {
    maxRetries: 3,
    retryable: isRetryableError,
  }
);
```

### 4. Format Error Messages for Users

```typescript
import { formatErrorMessage } from './utils/errorHandling';

try {
  // operation
} catch (error) {
  const userMessage = formatErrorMessage(error);
  showError(userMessage);
}
```

## Error Handling Checklist

- [ ] Use `AppError` for application-specific errors
- [ ] Use `logger.error()` instead of `console.error()`
- [ ] Use `withRetry()` for operations that might fail due to network issues
- [ ] Use `formatErrorMessage()` to show user-friendly error messages
- [ ] Log errors with context information
- [ ] Handle both `Error` instances and unknown error types

## Remaining Work

While error handling utilities exist and have been improved, some files still need updates:

### Files Needing Error Handling Updates:
- `App.tsx` - Many console calls remain (62 found)
- `services/editorService.ts` - Some `any` types in error handling
- `services/promptEngine/*` - Error handling could be more consistent
- Other service files - Standardize error handling patterns

### Pattern to Follow:

```typescript
try {
  // Operation
} catch (error) {
  logger.error('Operation failed', 'serviceName', error instanceof Error ? error : new Error(String(error)));
  throw new AppError(
    formatErrorMessage(error),
    'ERROR_CODE',
    undefined,
    isRetryableError(error),
    false
  );
}
```
