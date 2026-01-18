# Event-Driven Service Communication Guide

## Overview

This document describes how services should communicate using the event bus instead of direct imports. This enables better decoupling, testability, and observability.

## Event Patterns

### 1. Request/Response Pattern

For operations that need a return value:

```typescript
// Service A emits request
const requestId = generateUUID();
const responsePromise = new Promise((resolve) => {
  eventBus.once(`analysis:story:response:${requestId}`, (data) => {
    resolve(data.result);
  });
});

eventBus.emit('analysis:story:request', {
  requestId,
  novelState,
});

const result = await responsePromise;
```

```typescript
// Service B listens and responds
eventBus.on('analysis:story:request', async (data) => {
  const result = analyzeStoryStructure(data.novelState);
  eventBus.emit(`analysis:story:response:${data.requestId}`, {
    requestId: data.requestId,
    result,
  });
});
```

### 2. Fire-and-Forget Pattern

For operations that don't need responses:

```typescript
// Emit event
eventBus.emit('service:operation:complete', {
  novelId: '...',
  data: { ... }
});
```

### 3. Progress Events

For long-running operations:

```typescript
// Emit progress
eventBus.emit('service:operation:progress', {
  operationId: '...',
  progress: 50,
  message: 'Processing...'
});
```

## Service Communication Examples

### Editor Service → Editor Analyzer

**Before (Direct Call)**:
```typescript
import { analyzeChapterBatch } from './editorAnalyzer';
const analysis = await analyzeChapterBatch(input, options);
```

**After (Event-Driven)**:
```typescript
// Emit request
const requestId = generateUUID();
const analysisPromise = new Promise<EditorAnalysis>((resolve, reject) => {
  eventBus.once(`editor:analyze:response:${requestId}`, (data) => {
    if (data.error) {
      reject(new Error(data.error));
    } else {
      resolve(data.analysis);
    }
  });
});

eventBus.emit('editor:analyze:request', {
  requestId,
  input,
  options,
});

const analysis = await analysisPromise;
```

### Improvement Strategy Generator → Analysis Services

**Before (Direct Call)**:
```typescript
import { analyzeStoryStructure } from './storyStructureAnalyzer';
const analysis = analyzeStoryStructure(state);
```

**After (Event-Driven)**:
```typescript
// Emit request
const requestId = generateUUID();
const analysisPromise = new Promise<StoryStructureAnalysis>((resolve) => {
  eventBus.once(`analysis:story:response:${requestId}`, (data) => {
    resolve(data.result);
  });
});

eventBus.emit('analysis:story:request', {
  requestId,
  novelState: state,
});

const analysis = await analysisPromise;
```

## Event Naming Convention

Format: `{domain}:{operation}:{status}`

- `domain`: Service domain (analysis, editor, improvement, etc.)
- `operation`: Specific operation (story, engagement, analyze, etc.)
- `status`: request, response, start, complete, error, progress

Examples:
- `analysis:story:request` - Request story structure analysis
- `analysis:story:response` - Response with story structure analysis
- `editor:analyze:request` - Request editor analysis
- `editor:analyze:response` - Response with editor analysis
- `improvement:strategy:request` - Request improvement strategy
- `improvement:strategy:response` - Response with improvement strategy

## Migration Strategy

### Phase 1: Add Event Listeners
1. Create event listeners for each service
2. Listen for request events
3. Execute service logic
4. Emit response events

### Phase 2: Update Callers
1. Replace direct calls with event emissions
2. Use request/response pattern
3. Remove direct imports

### Phase 3: Cleanup
1. Remove unused imports
2. Verify no circular dependencies
3. Test event-driven communication

## Benefits

1. **Decoupling**: Services don't need direct imports
2. **Testability**: Easy to mock via events
3. **Observability**: All communication via events
4. **Flexibility**: Can swap implementations
5. **Scalability**: Can add multiple listeners

## Current Status

- ✅ Event bus implemented
- ✅ Services registered with DI container
- ✅ Events emitted for operations (Week 6)
- ⏳ Direct calls still exist (Week 8 - in progress)
- ⏳ Event listeners for service communication (Week 8 - in progress)
