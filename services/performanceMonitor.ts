/**
 * Performance Monitoring Service
 * 
 * Tracks and reports performance metrics for the application.
 * Monitors Core Web Vitals, custom metrics, and performance timing.
 */

import { logger } from './loggingService';

/**
 * Core Web Vitals metrics
 */
interface CoreWebVitals {
  lcp?: number; // Largest Contentful Paint
  fid?: number; // First Input Delay
  cls?: number; // Cumulative Layout Shift
  fcp?: number; // First Contentful Paint
  ttfb?: number; // Time to First Byte
}

/**
 * Custom performance metrics
 */
interface CustomMetrics {
  appLoadTime?: number;
  initialRenderTime?: number;
  routeChangeTime?: number;
  apiCallDuration?: Record<string, number[]>;
  componentRenderTime?: Record<string, number[]>;
}

/**
 * Performance metrics storage
 */
interface PerformanceData {
  coreWebVitals: CoreWebVitals;
  customMetrics: CustomMetrics;
  timestamps: {
    pageLoad: number;
    lastUpdate: number;
  };
}

class PerformanceMonitor {
  private metrics: PerformanceData;
  private observers: PerformanceObserver[] = [];
  private isEnabled: boolean;

  constructor() {
    this.isEnabled = typeof window !== 'undefined' && 'PerformanceObserver' in window;
    this.metrics = {
      coreWebVitals: {},
      customMetrics: {
        apiCallDuration: {},
        componentRenderTime: {},
      },
      timestamps: {
        pageLoad: Date.now(),
        lastUpdate: Date.now(),
      },
    };

    if (this.isEnabled) {
      this.initializeObservers();
      this.measureInitialLoad();
    }
  }

  /**
   * Initialize Performance Observer for Core Web Vitals
   */
  private initializeObservers(): void {
    try {
      // LCP (Largest Contentful Paint)
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1] as PerformancePaintTiming;
        this.metrics.coreWebVitals.lcp = lastEntry.renderTime || lastEntry.loadTime;
        this.logMetric('LCP', this.metrics.coreWebVitals.lcp);
      });
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
      this.observers.push(lcpObserver);
    } catch (e) {
      logger.warn('LCP observer not supported', 'performance', undefined, { error: e });
    }

    try {
      // FID (First Input Delay)
      const fidObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          this.metrics.coreWebVitals.fid = entry.processingStart - entry.startTime;
          this.logMetric('FID', this.metrics.coreWebVitals.fid);
        });
      });
      fidObserver.observe({ entryTypes: ['first-input'] });
      this.observers.push(fidObserver);
    } catch (e) {
      logger.warn('FID observer not supported', 'performance', undefined, { error: e });
    }

    try {
      // CLS (Cumulative Layout Shift)
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
          }
        });
        this.metrics.coreWebVitals.cls = clsValue;
      });
      clsObserver.observe({ entryTypes: ['layout-shift'] });
      this.observers.push(clsObserver);
      
      // Report CLS when page is hidden (beforeunload)
      window.addEventListener('beforeunload', () => {
        this.logMetric('CLS', clsValue);
      });
    } catch (e) {
      logger.warn('CLS observer not supported', 'performance', undefined, { error: e });
    }

    try {
      // FCP (First Contentful Paint) and TTFB (Time to First Byte)
      const paintObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: PerformancePaintTiming) => {
          if (entry.name === 'first-contentful-paint') {
            this.metrics.coreWebVitals.fcp = entry.startTime;
            this.logMetric('FCP', this.metrics.coreWebVitals.fcp);
          }
        });
      });
      paintObserver.observe({ entryTypes: ['paint'] });
      this.observers.push(paintObserver);

      // TTFB from navigation timing
      const navigationTiming = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (navigationTiming) {
        this.metrics.coreWebVitals.ttfb = navigationTiming.responseStart - navigationTiming.requestStart;
        this.logMetric('TTFB', this.metrics.coreWebVitals.ttfb);
      }
    } catch (e) {
      logger.warn('Paint observer not supported', 'performance', undefined, { error: e });
    }
  }

  /**
   * Measure initial application load time
   */
  private measureInitialLoad(): void {
    if (document.readyState === 'complete') {
      this.onLoadComplete();
    } else {
      window.addEventListener('load', () => this.onLoadComplete());
    }
  }

  /**
   * Handle load complete event
   */
  private onLoadComplete(): void {
    const navigationTiming = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    if (navigationTiming) {
      this.metrics.customMetrics.appLoadTime = navigationTiming.loadEventEnd - navigationTiming.fetchStart;
      this.logMetric('App Load Time', this.metrics.customMetrics.appLoadTime);
    }
  }

  /**
   * Mark the start of a performance measurement
   */
  mark(name: string): void {
    if (this.isEnabled) {
      performance.mark(name);
    }
  }

  /**
   * Measure the duration between two marks
   */
  measure(name: string, startMark: string, endMark?: string): number | null {
    if (!this.isEnabled) return null;

    try {
      if (endMark) {
        performance.measure(name, startMark, endMark);
      } else {
        performance.measure(name, startMark);
      }
      const measure = performance.getEntriesByName(name, 'measure')[0] as PerformanceMeasure;
      if (measure) {
        const duration = measure.duration;
        this.logMetric(name, duration);
        return duration;
      }
    } catch (e) {
      logger.warn(`Failed to measure ${name}`, 'performance', undefined, { error: e });
    }
    return null;
  }

  /**
   * Track API call duration
   */
  trackApiCall(apiName: string, duration: number): void {
    if (!this.metrics.customMetrics.apiCallDuration) {
      this.metrics.customMetrics.apiCallDuration = {};
    }
    if (!this.metrics.customMetrics.apiCallDuration[apiName]) {
      this.metrics.customMetrics.apiCallDuration[apiName] = [];
    }
    this.metrics.customMetrics.apiCallDuration[apiName].push(duration);
    
    // Keep only last 100 measurements per API
    if (this.metrics.customMetrics.apiCallDuration[apiName].length > 100) {
      this.metrics.customMetrics.apiCallDuration[apiName].shift();
    }
  }

  /**
   * Track component render time
   */
  trackComponentRender(componentName: string, duration: number): void {
    if (!this.metrics.customMetrics.componentRenderTime) {
      this.metrics.customMetrics.componentRenderTime = {};
    }
    if (!this.metrics.customMetrics.componentRenderTime[componentName]) {
      this.metrics.customMetrics.componentRenderTime[componentName] = [];
    }
    this.metrics.customMetrics.componentRenderTime[componentName].push(duration);
    
    // Keep only last 50 measurements per component
    if (this.metrics.customMetrics.componentRenderTime[componentName].length > 50) {
      this.metrics.customMetrics.componentRenderTime[componentName].shift();
    }
  }

  /**
   * Get all performance metrics
   */
  getMetrics(): PerformanceData {
    this.metrics.timestamps.lastUpdate = Date.now();
    return { ...this.metrics };
  }

  /**
   * Get Core Web Vitals
   */
  getCoreWebVitals(): CoreWebVitals {
    return { ...this.metrics.coreWebVitals };
  }

  /**
   * Get custom metrics
   */
  getCustomMetrics(): CustomMetrics {
    return { ...this.metrics.customMetrics };
  }

  /**
   * Get average API call duration for a specific API
   */
  getAverageApiCallDuration(apiName: string): number | null {
    const durations = this.metrics.customMetrics.apiCallDuration?.[apiName];
    if (!durations || durations.length === 0) return null;
    
    const sum = durations.reduce((acc, val) => acc + val, 0);
    return sum / durations.length;
  }

  /**
   * Get average component render time
   */
  getAverageComponentRenderTime(componentName: string): number | null {
    const durations = this.metrics.customMetrics.componentRenderTime?.[componentName];
    if (!durations || durations.length === 0) return null;
    
    const sum = durations.reduce((acc, val) => acc + val, 0);
    return sum / durations.length;
  }

  /**
   * Log a performance metric
   */
  private logMetric(name: string, value: number): void {
    if (import.meta.env.DEV) {
      logger.info(`Performance metric: ${name} = ${value.toFixed(2)}ms`, 'performance', undefined, {
        metric: name,
        value,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Report metrics (can be extended to send to analytics service)
   */
  reportMetrics(): void {
    const metrics = this.getMetrics();
    
    if (import.meta.env.DEV) {
      console.group('Performance Metrics');
      console.log('Core Web Vitals:', metrics.coreWebVitals);
      console.log('Custom Metrics:', metrics.customMetrics);
      console.groupEnd();
    }
    
    // In production, you could send metrics to an analytics service:
    // analyticsService.track('performance_metrics', metrics);
  }

  /**
   * Cleanup observers
   */
  destroy(): void {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Export types
export type { CoreWebVitals, CustomMetrics, PerformanceData };
