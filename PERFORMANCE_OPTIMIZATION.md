# Performance Optimization Guide

## Overview

This guide covers performance optimizations implemented and recommended for the Hall of Jade Manuscripts application.

## Current Optimizations

### 1. Lazy Loading

Heavy components are lazy-loaded for code splitting:

```typescript
const ChapterEditor = lazy(() => import('./components/ChapterEditor'));
const WorldMapView = lazy(() => import('./components/WorldMapView'));
// ... other components
```

### 2. Memoization Hooks

Custom hooks for memoization:
- `hooks/useMemoized.ts` - Memoizes computed values with custom equality
- `hooks/useDebounce.ts` - Debounces values for search/auto-save
- `hooks/useOptimisticUpdate.ts` - Optimistic updates with rollback

### 3. Change Tracking

Novel change tracking prevents unnecessary saves:
- `utils/novelTracking.ts` - Tracks changed novels
- Only saves novels that actually changed
- Reduces database writes

### 4. Database Indexing

Comprehensive indexes for fast queries:
- All foreign keys indexed
- Composite indexes for common queries
- GIN indexes for text search

## Recommended Optimizations

### 1. Component Memoization

Memoize heavy components to prevent unnecessary re-renders:

```typescript
import { memo } from 'react';

export const CharacterCard = memo(({ character, onEdit }) => {
  // Component implementation
}, (prevProps, nextProps) => {
  // Custom comparison logic
  return prevProps.character.id === nextProps.character.id &&
         prevProps.character.name === nextProps.character.name;
});
```

### 2. Context Optimization

Split contexts to avoid unnecessary updates:

```typescript
// Instead of one large context
const NovelContext = createContext(...);

// Split into smaller contexts
const NovelDataContext = createContext(...);
const NovelActionsContext = createContext(...);
```

### 3. Virtual Scrolling

Use virtual scrolling for long lists:

```typescript
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={600}
  itemCount={characters.length}
  itemSize={100}
>
  {CharacterRow}
</FixedSizeList>
```

### 4. Query Result Caching

Cache database query results:

```typescript
const queryCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 60000; // 1 minute

async function getCachedQuery(key: string, queryFn: () => Promise<any>) {
  const cached = queryCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  const data = await queryFn();
  queryCache.set(key, { data, timestamp: Date.now() });
  return data;
}
```

### 5. Bundle Optimization

- Analyze bundle with webpack-bundle-analyzer
- Remove unused dependencies
- Optimize imports (avoid full library imports)
- Use tree-shaking

### 6. Image Optimization

- Lazy load images
- Use appropriate image formats (WebP, AVIF)
- Implement responsive images
- Add loading="lazy" to img tags

## Performance Checklist

- [ ] Memoize expensive computations
- [ ] Split large contexts
- [ ] Use React.memo for heavy components
- [ ] Implement virtual scrolling for long lists
- [ ] Cache database query results
- [ ] Optimize bundle size
- [ ] Lazy load images
- [ ] Use code splitting
- [ ] Minimize re-renders
- [ ] Optimize database queries

## Remaining Work

### High Priority
- [ ] Add React.memo to heavy components
- [ ] Split NovelContext into smaller contexts
- [ ] Implement query result caching
- [ ] Add virtual scrolling for long lists

### Medium Priority
- [ ] Analyze bundle size
- [ ] Optimize imports
- [ ] Add image lazy loading
- [ ] Implement service worker caching

### Low Priority
- [ ] Add performance monitoring
- [ ] Implement performance budgets
- [ ] Add performance tests
