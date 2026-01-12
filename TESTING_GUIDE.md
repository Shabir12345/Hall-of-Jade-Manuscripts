# Testing Guide

## Overview

This guide covers testing strategies and best practices for the Hall of Jade Manuscripts application.

## Test Setup

### Vitest Configuration

The project uses Vitest for testing:
- Configuration: `vitest.config.ts`
- Setup file: `src/test/setup.ts`

### Running Tests

```bash
# Run all tests
npm test

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage
```

## Test Structure

```
src/test/
├── setup.ts              # Test setup and mocks
├── validation.test.ts    # Validation utility tests
└── utils.test.ts         # Utility function tests
```

## Testing Patterns

### 1. Unit Tests

Test individual functions in isolation:

```typescript
import { describe, it, expect } from 'vitest';
import { validateWorldEntryInput } from '../utils/validation';

describe('validateWorldEntryInput', () => {
  it('should validate correct world entry', () => {
    const entry = {
      id: '123',
      title: 'Test Entry',
      content: 'Content here',
      category: 'Geography' as const,
      realmId: 'realm-1',
    };
    
    const result = validateWorldEntryInput(entry);
    expect(result.valid).toBe(true);
  });
});
```

### 2. Service Tests

Test service functions with mocked dependencies:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { fetchAllNovels } from '../services/supabaseService';

describe('fetchAllNovels', () => {
  it('should return empty array if not authenticated', async () => {
    // Mock getCurrentUserId to return null
    vi.spyOn(supabaseService, 'getCurrentUserId').mockResolvedValue(null);
    
    const novels = await fetchAllNovels();
    expect(novels).toEqual([]);
  });
});
```

### 3. Component Tests

Test React components:

```typescript
import { render, screen } from '@testing-library/react';
import { CharactersView } from '../components/views/CharactersView';

describe('CharactersView', () => {
  it('should show empty state when no characters', () => {
    const mockNovel = {
      characterCodex: [],
      // ... other required fields
    };
    
    render(<CharactersView novel={mockNovel} ... />);
    expect(screen.getByText('No Characters Yet')).toBeInTheDocument();
  });
});
```

## Test Coverage Goals

- **Target**: 80%+ code coverage
- **Critical Paths**: 100% coverage
- **Services**: 80%+ coverage
- **Components**: 70%+ coverage
- **Utilities**: 90%+ coverage

## Mocking Strategies

### Mock Supabase

```typescript
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          data: [],
          error: null,
        })),
      })),
    })),
  })),
}));
```

### Mock AI Services

```typescript
vi.mock('../services/aiService', () => ({
  generateNextChapter: vi.fn(() => Promise.resolve({
    chapterTitle: 'Test Chapter',
    chapterContent: 'Test content',
    // ... other fields
  })),
}));
```

## Testing Checklist

- [ ] Unit tests for all utilities
- [ ] Integration tests for services
- [ ] Component tests for views
- [ ] E2E tests for critical flows
- [ ] Mock external dependencies
- [ ] Test error cases
- [ ] Test edge cases
- [ ] Test authentication flows

## Remaining Test Work

### High Priority
- [ ] Add tests for `services/aiService.ts`
- [ ] Add tests for `services/supabaseService.ts`
- [ ] Add tests for `services/editorService.ts`
- [ ] Add component tests for main views

### Medium Priority
- [ ] Add integration tests for chapter generation flow
- [ ] Add tests for authentication flow
- [ ] Add tests for prompt building

### Low Priority
- [ ] Add E2E tests with Playwright/Cypress
- [ ] Add performance tests
- [ ] Add visual regression tests

## Test Utilities Needed

Create test utilities:
- `test/utils/mockSupabase.ts` - Supabase mocks
- `test/utils/mockNovel.ts` - Novel state factories
- `test/utils/renderWithProviders.tsx` - Render with all contexts
