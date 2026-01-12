# Performance Monitoring

## Overview

The application includes comprehensive performance monitoring to track Core Web Vitals, custom metrics, and application performance.

## Core Web Vitals

The performance monitor tracks the following Core Web Vitals:

- **LCP (Largest Contentful Paint)**: Measures loading performance. Good: < 2.5s
- **FID (First Input Delay)**: Measures interactivity. Good: < 100ms
- **CLS (Cumulative Layout Shift)**: Measures visual stability. Good: < 0.1
- **FCP (First Contentful Paint)**: Time to first content. Good: < 1.8s
- **TTFB (Time to First Byte)**: Server response time. Good: < 800ms

## Usage

### Basic Usage

```typescript
import { performanceMonitor } from './services/performanceMonitor';

// Get all metrics
const metrics = performanceMonitor.getMetrics();

// Get Core Web Vitals
const coreWebVitals = performanceMonitor.getCoreWebVitals();
console.log('LCP:', coreWebVitals.lcp);
console.log('FID:', coreWebVitals.fid);
console.log('CLS:', coreWebVitals.cls);

// Report metrics (logs in dev, can send to analytics in prod)
performanceMonitor.reportMetrics();
```

### Measuring Custom Performance

```typescript
import { performanceMonitor } from './services/performanceMonitor';

// Mark the start of an operation
performanceMonitor.mark('api-call-start');

// ... perform operation ...

// Measure duration
const duration = performanceMonitor.measure('api-call', 'api-call-start');
```

### Tracking API Calls

```typescript
import { performanceMonitor } from './services/performanceMonitor';

async function fetchData() {
  const start = performance.now();
  try {
    const data = await api.getData();
    const duration = performance.now() - start;
    performanceMonitor.trackApiCall('getData', duration);
    return data;
  } catch (error) {
    const duration = performance.now() - start;
    performanceMonitor.trackApiCall('getData', duration);
    throw error;
  }
}

// Get average API call duration
const avgDuration = performanceMonitor.getAverageApiCallDuration('getData');
```

### Tracking Component Render Time

```typescript
import { performanceMonitor } from './services/performanceMonitor';
import { useEffect, useRef } from 'react';

function MyComponent() {
  const renderStartRef = useRef<number>();
  
  useEffect(() => {
    renderStartRef.current = performance.now();
    
    return () => {
      if (renderStartRef.current) {
        const duration = performance.now() - renderStartRef.current;
        performanceMonitor.trackComponentRender('MyComponent', duration);
      }
    };
  });
  
  // ... component code ...
}
```

## Metrics Storage

Metrics are stored in memory and updated in real-time. The monitor keeps:

- Last 100 API call measurements per API endpoint
- Last 50 component render measurements per component
- Current Core Web Vitals values
- Timestamps for page load and last update

## Reporting

### Development Mode

In development, metrics are logged to the console when:
- Core Web Vitals are captured
- `reportMetrics()` is called
- Custom metrics are measured

### Production Mode

In production, you can extend the `reportMetrics()` method to:
- Send metrics to an analytics service (Google Analytics, Sentry, etc.)
- Log to your backend API
- Store in a monitoring service (Datadog, New Relic, etc.)

Example integration:

```typescript
// In performanceMonitor.ts reportMetrics()
if (import.meta.env.PROD) {
  // Send to analytics
  if (window.gtag) {
    window.gtag('event', 'performance_metrics', {
      custom_map: {
        lcp: metrics.coreWebVitals.lcp,
        fid: metrics.coreWebVitals.fid,
        cls: metrics.coreWebVitals.cls,
      }
    });
  }
}
```

## Best Practices

1. **Track Critical Paths**: Monitor the most important user journeys
2. **Monitor API Performance**: Track API calls that affect user experience
3. **Component Performance**: Monitor heavy components that may cause slowdowns
4. **Set Thresholds**: Define acceptable performance thresholds and alert when exceeded
5. **Regular Review**: Review performance metrics regularly to identify degradation

## Integration with Logging

The performance monitor integrates with the logging service:

```typescript
import { logger } from './services/loggingService';
import { performanceMonitor } from './services/performanceMonitor';

// Performance metrics are automatically logged
// Custom logging can be added:
logger.info('Performance check', 'performance', undefined, {
  metrics: performanceMonitor.getMetrics()
});
```

## Cleanup

The performance monitor should be cleaned up when the application unmounts:

```typescript
import { performanceMonitor } from './services/performanceMonitor';

// In App cleanup
useEffect(() => {
  return () => {
    performanceMonitor.destroy();
  };
}, []);
```

## Future Enhancements

- [ ] Add performance budgets and alerts
- [ ] Integrate with real-time monitoring service
- [ ] Add performance regression testing
- [ ] Create performance dashboard
- [ ] Add user session replay for performance analysis
- [ ] Track resource loading times
- [ ] Monitor memory usage
