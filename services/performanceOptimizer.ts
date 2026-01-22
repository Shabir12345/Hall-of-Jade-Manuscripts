/**
 * Performance Optimizer Service
 * 
 * Coordinates performance optimizations across the application
 * to improve chapter generation speed and overall responsiveness.
 */

import { logger } from './loggingService';
import { queryCache } from './queryCache';
import { NovelState } from '../types';

/**
 * Performance metrics tracking
 */
interface PerformanceMetrics {
  chapterGenerationTime: number;
  memoryRetrievalTime: number;
  promptBuildTime: number;
  llmRequestTime: number;
  totalTime: number;
  cacheHitRate: number;
  optimizationsActive: string[];
}

/**
 * Optimization configuration
 */
interface OptimizationConfig {
  enableParallelMemory: boolean;
  enableAggressiveCaching: boolean;
  enablePromptOptimization: boolean;
  enableRateLimitOptimization: boolean;
  maxMemoryRetrievalTime: number; // ms
  maxPromptBuildTime: number; // ms
}

class PerformanceOptimizer {
  private metrics: PerformanceMetrics[] = [];
  private config: OptimizationConfig = {
    enableParallelMemory: true,
    enableAggressiveCaching: true,
    enablePromptOptimization: true,
    enableRateLimitOptimization: true,
    maxMemoryRetrievalTime: 8000, // 8 seconds
    maxPromptBuildTime: 5000, // 5 seconds
  };

  /**
   * Get current optimization configuration
   */
  getConfig(): OptimizationConfig {
    return { ...this.config };
  }

  /**
   * Update optimization configuration
   */
  updateConfig(updates: Partial<OptimizationConfig>): void {
    this.config = { ...this.config, ...updates };
    logger.info('Performance optimizer configuration updated', 'performance', { config: this.config });
  }

  /**
   * Preload and cache critical data for faster chapter generation
   */
  async preloadCriticalData(state: NovelState): Promise<void> {
    if (!this.config.enableAggressiveCaching) return;

    const startTime = Date.now();
    
    try {
      // Preload protagonist data
      const protagonist = state.characterCodex.find(c => c.isProtagonist);
      if (protagonist) {
        queryCache.set(`protagonist:${state.id}`, protagonist, 300000); // 5 minutes
      }

      // Preload recent chapters
      const recentChapters = state.chapters.slice(-3);
      queryCache.set(`recent-chapters:${state.id}`, recentChapters, 300000);

      // Preload active arc
      const activeArc = state.plotLedger.find(a => a.status === 'active');
      if (activeArc) {
        queryCache.set(`active-arc:${state.id}`, activeArc, 300000);
      }

      // Preload world state
      if (state.globalWorldState) {
        queryCache.set(`world-state:${state.id}`, state.globalWorldState, 300000);
      }

      logger.info('Critical data preloaded for performance', 'performance', {
        duration: Date.now() - startTime,
        cachedItems: ['protagonist', 'recent-chapters', 'active-arc', 'world-state'].filter(Boolean),
      });
    } catch (error) {
      logger.warn('Failed to preload critical data', 'performance', error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Optimize chapter generation request
   */
  optimizeChapterGeneration(state: NovelState, userInstruction: string): {
    optimizedState: NovelState;
    optimizedInstruction: string;
    optimizations: string[];
  } {
    const optimizations: string[] = [];
    const startTime = Date.now();

    // Create optimized state (remove unnecessary data for LLM)
    const optimizedState: NovelState = {
      ...state,
      // Only keep recent chapters for context (last 3 instead of all)
      chapters: state.chapters.slice(-3),
      // Limit characters to most relevant ones
      characterCodex: state.characterCodex
        .filter(c => c.isProtagonist || c.status === 'Alive')
        .slice(0, 10), // Top 10 most relevant characters
    };

    optimizations.push('Limited chapters to last 3 for context');
    optimizations.push('Limited characters to top 10 most relevant');

    // Optimize user instruction if too long
    let optimizedInstruction = userInstruction;
    if (userInstruction.length > 500) {
      optimizedInstruction = userInstruction.substring(0, 500) + '...';
      optimizations.push('Trimmed user instruction to reduce prompt size');
    }

    logger.info('Chapter generation request optimized', 'performance', {
      duration: Date.now() - startTime,
      optimizations,
      originalChapterCount: state.chapters.length,
      optimizedChapterCount: optimizedState.chapters.length,
      originalCharacterCount: state.characterCodex.length,
      optimizedCharacterCount: optimizedState.characterCodex.length,
    });

    return {
      optimizedState,
      optimizedInstruction,
      optimizations,
    };
  }

  /**
   * Record performance metrics
   */
  recordMetrics(metrics: PerformanceMetrics): void {
    this.metrics.push(metrics);
    
    // Keep only last 100 metrics
    if (this.metrics.length > 100) {
      this.metrics.shift();
    }

    logger.debug('Performance metrics recorded', 'performance', {
      totalTime: metrics.totalTime,
      cacheHitRate: metrics.cacheHitRate,
      optimizationsActive: metrics.optimizationsActive,
    });
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(): {
    averageGenerationTime: number;
    averageCacheHitRate: number;
    totalOptimizations: number;
    recommendations: string[];
  } {
    if (this.metrics.length === 0) {
      return {
        averageGenerationTime: 0,
        averageCacheHitRate: 0,
        totalOptimizations: 0,
        recommendations: ['No performance data available'],
      };
    }

    const averageGenerationTime = this.metrics.reduce((sum, m) => sum + m.totalTime, 0) / this.metrics.length;
    const averageCacheHitRate = this.metrics.reduce((sum, m) => sum + m.cacheHitRate, 0) / this.metrics.length;
    const totalOptimizations = this.metrics.reduce((sum, m) => sum + m.optimizationsActive.length, 0);

    const recommendations: string[] = [];
    
    if (averageGenerationTime > 45000) { // > 45 seconds
      recommendations.push('Consider enabling more aggressive optimizations');
    }
    
    if (averageCacheHitRate < 30) { // < 30% cache hit rate
      recommendations.push('Cache hit rate is low, consider increasing cache TTL');
    }
    
    if (totalOptimizations < this.metrics.length * 2) { // < 2 optimizations per request
      recommendations.push('Enable more optimization features for better performance');
    }

    return {
      averageGenerationTime,
      averageCacheHitRate,
      totalOptimizations,
      recommendations,
    };
  }

  /**
   * Clear performance metrics
   */
  clearMetrics(): void {
    this.metrics = [];
    logger.info('Performance metrics cleared', 'performance');
  }

  /**
   * Run performance diagnostics
   */
  async runDiagnostics(state: NovelState): Promise<{
    memoryRetrievalTest: number;
    cachePerformanceTest: number;
    promptBuildTest: number;
    overallScore: 'excellent' | 'good' | 'fair' | 'poor';
  }> {
    const startTime = Date.now();

    // Test memory retrieval performance
    const memoryStart = Date.now();
    try {
      // Simulate memory retrieval (this would use actual memory service)
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      // Handle error
    }
    const memoryRetrievalTest = Date.now() - memoryStart;

    // Test cache performance
    const cacheStart = Date.now();
    const testKey = `diagnostic-test-${Date.now()}`;
    queryCache.set(testKey, { test: 'data' }, 60000);
    queryCache.get(testKey);
    queryCache.invalidate(testKey);
    const cachePerformanceTest = Date.now() - cacheStart;

    // Test prompt building performance
    const promptStart = Date.now();
    try {
      // Simulate prompt building
      await new Promise(resolve => setTimeout(resolve, 50));
    } catch (error) {
      // Handle error
    }
    const promptBuildTest = Date.now() - promptStart;

    // Calculate overall score
    const totalTime = Date.now() - startTime;
    let overallScore: 'excellent' | 'good' | 'fair' | 'poor' = 'excellent';
    
    if (totalTime > 1000) overallScore = 'poor';
    else if (totalTime > 500) overallScore = 'fair';
    else if (totalTime > 200) overallScore = 'good';

    logger.info('Performance diagnostics completed', 'performance', {
      memoryRetrievalTest,
      cachePerformanceTest,
      promptBuildTest,
      overallScore,
      totalDuration: totalTime,
    });

    return {
      memoryRetrievalTest,
      cachePerformanceTest,
      promptBuildTest,
      overallScore,
    };
  }
}

// Singleton instance
export const performanceOptimizer = new PerformanceOptimizer();
