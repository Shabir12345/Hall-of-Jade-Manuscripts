import { NovelState, Chapter } from '../types';
import { generateUUID } from '../utils/uuid';
import { logger } from '../services/loggingService';

interface BatchCache {
  directorBeatSheets: Map<number, any>;
  memoryContext: any;
  faceGraphContext: Map<string, any>;
  marketContext: any;
  livingWorldContext: any;
  lastUpdated: number;
}

interface BatchGenerationConfig {
  batchSize: number;
  maxRegenerationAttempts: number;
  timeoutMs: number;
  enableParallelProcessing: boolean;
  cacheContext: boolean;
}

const DEFAULT_BATCH_CONFIG: BatchGenerationConfig = {
  batchSize: 5,
  maxRegenerationAttempts: 2, // Reduced from default for faster batch processing
  timeoutMs: 600000, // 10 minutes per chapter
  enableParallelProcessing: false, // DISABLED for narrative consistency
  cacheContext: true,
};

class BatchGenerationCache {
  private cache: BatchCache = {
    directorBeatSheets: new Map(),
    memoryContext: null,
    faceGraphContext: new Map(),
    marketContext: null,
    livingWorldContext: null,
    lastUpdated: Date.now(),
  };

  private readonly CACHE_TTL = 600000; // 10 minutes

  isValid(): boolean {
    return Date.now() - this.cache.lastUpdated < this.CACHE_TTL;
  }

  setDirectorBeatSheet(chapterNumber: number, beatSheet: any): void {
    this.cache.directorBeatSheets.set(chapterNumber, beatSheet);
    this.cache.lastUpdated = Date.now();
  }

  getDirectorBeatSheet(chapterNumber: number): any | null {
    return this.cache.directorBeatSheets.get(chapterNumber) || null;
  }

  setMemoryContext(context: any): void {
    this.cache.memoryContext = context;
    this.cache.lastUpdated = Date.now();
  }

  getMemoryContext(): any | null {
    return this.cache.memoryContext;
  }

  setFaceGraphContext(key: string, context: any): void {
    this.cache.faceGraphContext.set(key, context);
    this.cache.lastUpdated = Date.now();
  }

  getFaceGraphContext(key: string): any | null {
    return this.cache.faceGraphContext.get(key) || null;
  }

  setMarketContext(context: any): void {
    this.cache.marketContext = context;
    this.cache.lastUpdated = Date.now();
  }

  getMarketContext(): any | null {
    return this.cache.marketContext;
  }

  setLivingWorldContext(context: any): void {
    this.cache.livingWorldContext = context;
    this.cache.lastUpdated = Date.now();
  }

  getLivingWorldContext(): any | null {
    return this.cache.livingWorldContext;
  }

  getLivingWorldBase(): any | null {
    return this.cache.livingWorldContext;
  }

  clear(): void {
    this.cache = {
      directorBeatSheets: new Map(),
      memoryContext: null,
      faceGraphContext: new Map(),
      marketContext: null,
      livingWorldContext: null,
      lastUpdated: Date.now(),
    };
  }
}

/**
 * Optimized batch generation service with caching and parallel processing
 */
export class OptimizedBatchGenerator {
  private cache = new BatchGenerationCache();
  private config: BatchGenerationConfig;

  constructor(config: Partial<BatchGenerationConfig> = {}) {
    this.config = { ...DEFAULT_BATCH_CONFIG, ...config };
  }

  /**
   * Generate multiple chapters with optimizations
   */
  async generateBatch(
    state: NovelState,
    userInstruction: string = '',
    onProgress?: (progress: number, status: string) => void
  ): Promise<{ chapters: Chapter[]; errors: string[] }> {
    const startTime = Date.now();
    const errors: string[] = [];
    const chapters: Chapter[] = [];

    logger.info('Starting optimized batch generation', 'batchGenerator', {
      batchSize: this.config.batchSize,
      enableParallel: this.config.enableParallelProcessing,
      cacheEnabled: this.config.cacheContext,
    });

    try {
      if (this.config.enableParallelProcessing) {
        const result = await this.generateParallel(state, userInstruction, onProgress);
        chapters.push(...result.chapters);
        errors.push(...result.errors);
      } else {
        const result = await this.generateSequential(state, userInstruction, onProgress);
        chapters.push(...result.chapters);
        errors.push(...result.errors);
      }

      const duration = Date.now() - startTime;
      logger.info('Batch generation completed', 'batchGenerator', {
        duration,
        chaptersGenerated: chapters.length,
        errors: errors.length,
        avgTimePerChapter: duration / this.config.batchSize,
      });

      return { chapters, errors };
    } catch (error) {
      logger.error('Batch generation failed', 'batchGenerator', error instanceof Error ? error : new Error(String(error)));
      throw error;
    } finally {
      // Clear cache after batch completion
      if (this.config.cacheContext) {
        this.cache.clear();
      }
    }
  }

  /**
   * Sequential generation with optimizations (fixed for narrative consistency)
   */
  private async generateSequential(
    state: NovelState,
    userInstruction: string,
    onProgress?: (progress: number, status: string) => void
  ): Promise<{ chapters: Chapter[]; errors: string[] }> {
    const chapters: Chapter[] = [];
    const errors: string[] = [];
    let currentState = state;

    // Pre-build shared context once (this is the main optimization)
    const sharedContext = await this.buildSharedContext(state);

    for (let i = 0; i < this.config.batchSize; i++) {
      const nextChapterNumber = currentState.chapters.length + 1;
      const progress = (i / this.config.batchSize) * 100;
      onProgress?.(progress, `Generating chapter ${nextChapterNumber}...`);

      try {
        // Generate chapter with updated state that includes previous chapters
        const chapter = await this.generateSingleChapter(
          currentState, // Pass updated state with previous chapters
          userInstruction,
          nextChapterNumber,
          {
            sharedContext,
            skipRegeneration: true, // CRITICAL: Skip regeneration for batch to prevent infinite loops
            skipTribulationGate: true, // Auto-skip interactive gates in batch
            onPhase: (phase: string, _data?: Record<string, unknown>) => this.handlePhase(phase, i, this.config.batchSize, onProgress)
          }
        );

        chapters.push(chapter);

        // Update state with the new chapter for next iteration
        currentState = {
          ...currentState,
          chapters: [...currentState.chapters, chapter],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push(`Chapter ${nextChapterNumber}: ${errorMessage}`);
        logger.warn(`Failed to generate chapter ${nextChapterNumber}`, 'batchGenerator', { error: errorMessage });

        // Stop sequential generation on failure to preserve sequence integrity
        break;
      }
    }

    return { chapters, errors };
  }

  /**
   * Parallel generation with optimizations
   */
  private async generateParallel(
    state: NovelState,
    userInstruction: string,
    onProgress?: (progress: number, status: string) => void
  ): Promise<{ chapters: Chapter[]; errors: string[] }> {
    const chapters: Chapter[] = [];
    const errors: string[] = [];

    // Pre-build shared context once
    const sharedContext = await this.buildSharedContext(state);

    // Generate chapters in parallel batches
    const parallelBatchSize = Math.min(3, this.config.batchSize); // Process 3 at a time max
    for (let batchStart = 0; batchStart < this.config.batchSize; batchStart += parallelBatchSize) {
      const batchEnd = Math.min(batchStart + parallelBatchSize, this.config.batchSize);
      const batchPromises: Promise<Chapter>[] = [];

      for (let i = batchStart; i < batchEnd; i++) {
        const chapterNumber = state.chapters.length + 1 + i;
        const promise = this.generateSingleChapter(
          state,
          userInstruction,
          chapterNumber,
          {
            sharedContext,
            skipTribulationGate: true,
            onPhase: (phase: string, _data?: Record<string, unknown>) => this.handlePhase(phase, i, this.config.batchSize, onProgress)
          }
        ).catch(error => {
          const errorMessage = error instanceof Error ? error.message : String(error);
          errors.push(`Chapter ${chapterNumber}: ${errorMessage}`);
          throw error;
        });

        batchPromises.push(promise);
      }

      try {
        const batchResults = await Promise.allSettled(batchPromises);

        for (let i = 0; i < batchResults.length; i++) {
          const result = batchResults[i];
          if (result.status === 'fulfilled') {
            chapters.push(result.value);
          }
          // Errors already collected above
        }

        const progress = (batchEnd / this.config.batchSize) * 100;
        onProgress?.(progress, `Completed batch ${Math.floor(batchStart / parallelBatchSize) + 1}/${Math.ceil(this.config.batchSize / parallelBatchSize)}`);
      } catch (error) {
        logger.warn(`Parallel batch failed`, 'batchGenerator', { error: String(error) });
      }
    }

    // Sort chapters by number
    chapters.sort((a, b) => a.number - b.number);

    return { chapters, errors };
  }

  /**
   * Build shared context for all chapters in batch
   */
  private async buildSharedContext(state: NovelState): Promise<any> {
    if (!this.config.cacheContext || !this.cache.isValid()) {
      logger.debug('Building fresh shared context for batch', 'batchGenerator');

      // Build context that can be shared across chapters
      const context = {
        memoryContext: await this.buildMemoryContext(state),
        faceGraphBase: await this.buildFaceGraphBase(state),
        marketBase: await this.buildMarketBase(state),
        livingWorldBase: await this.buildLivingWorldBase(state),
      };

      if (this.config.cacheContext) {
        this.cache.setMemoryContext(context.memoryContext);
        this.cache.setMarketContext(context.marketBase);
        this.cache.setLivingWorldContext(context.livingWorldBase);
      }

      return context;
    }

    return {
      memoryContext: this.cache.getMemoryContext(),
      faceGraphBase: null, // Face graph is character-specific, don't cache
      marketBase: this.cache.getMarketContext(),
      livingWorldBase: this.cache.getLivingWorldBase(),
    };
  }

  /**
   * Generate a single chapter with optimizations
   */
  private async generateSingleChapter(
    state: NovelState,
    userInstruction: string,
    chapterNumber: number,
    opts: {
      sharedContext?: any;
      onPhase?: (phase: string, data?: Record<string, unknown>) => void;
      skipRegeneration?: boolean;
      skipTribulationGate?: boolean;
    } = {}
  ): Promise<Chapter> {
    const { generateNextChapter } = await import('./aiService');

    // Apply timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Chapter ${chapterNumber} generation timeout`)), this.config.timeoutMs);
    });

    const generationPromise = generateNextChapter(state, userInstruction, {
      ...opts,
      skipRegeneration: opts.skipRegeneration || false,
      skipTribulationGate: opts.skipTribulationGate || false,
    });

    // Race between generation and timeout
    const result = await Promise.race([generationPromise, timeoutPromise]);

    if (!result || !result.chapterContent) {
      throw new Error(`Invalid generation result for chapter ${chapterNumber}`);
    }

    return {
      id: generateUUID(),
      number: chapterNumber,
      title: result.chapterTitle || `Chapter ${chapterNumber}`,
      content: result.chapterContent,
      summary: result.chapterSummary || '',
      logicAudit: result.logicAudit,
      wordCount: result.wordCount,
      scenes: [], // Default to empty array since ChapterGenerationResult doesn't have scenes
      createdAt: Date.now(),
    };
  }

  /**
   * Handle phase callbacks for progress tracking
   */
  private handlePhase(
    phase: string,
    chapterIndex: number,
    totalChapters: number,
    onProgress?: (progress: number, status: string) => void
  ): void {
    const baseProgress = (chapterIndex / totalChapters) * 100;
    const chapterProgressWindow = 100 / totalChapters;

    let phaseProgress = baseProgress;
    let status = `Chapter ${chapterIndex + 1}/${totalChapters}`;

    switch (phase) {
      case 'prompt_build_start':
        phaseProgress = baseProgress + (chapterProgressWindow * 0.1);
        status += ' - Building context...';
        break;
      case 'llm_request_start':
        phaseProgress = baseProgress + (chapterProgressWindow * 0.4);
        status += ' - Generating content...';
        break;
      case 'llm_request_end':
        phaseProgress = baseProgress + (chapterProgressWindow * 0.8);
        status += ' - Processing results...';
        break;
      case 'parse_end':
        phaseProgress = baseProgress + (chapterProgressWindow * 0.95);
        status += ' - Finalizing...';
        break;
    }

    onProgress?.(phaseProgress, status);
  }

  // Helper methods for context building
  private async buildMemoryContext(state: NovelState): Promise<any> {
    try {
      const { queryMemory } = await import('./memory/memoryQueryService');
      return await queryMemory(state, {
        depth: 2, // Reduced depth for batch processing
        tokenBudget: 3000, // Reduced budget for speed
        characterId: state.characterCodex.find(c => c.isProtagonist)?.id
      });
    } catch (error) {
      logger.warn('Failed to build memory context', 'batchGenerator', { error: String(error) });
      return null;
    }
  }

  private async buildFaceGraphBase(_state: NovelState): Promise<any> {
    // Face graph is character-specific, build per chapter
    return null;
  }

  private async buildMarketBase(state: NovelState): Promise<any> {
    try {
      if (state.globalMarketState && state.globalMarketState.currencies.length > 0) {
        // Skip market context for batch generation to improve speed
        return null;
      }
      return null;
    } catch (error) {
      logger.warn('Failed to build market context', 'batchGenerator', { error: String(error) });
      return null;
    }
  }

  private async buildLivingWorldBase(_state: NovelState): Promise<any> {
    try {
      // Skip living world context for batch generation to improve speed
      return null;
    } catch (error) {
      logger.warn('Failed to build living world context', 'batchGenerator', { error: String(error) });
      return null;
    }
  }
}

/**
 * Create optimized batch generator with custom config
 */
export function createOptimizedBatchGenerator(config?: Partial<BatchGenerationConfig>): OptimizedBatchGenerator {
  return new OptimizedBatchGenerator(config);
}

/**
 * Quick batch generation for rapid prototyping
 */
export async function quickBatchGenerate(
  state: NovelState,
  userInstruction: string = '',
  onProgress?: (progress: number, status: string) => void
): Promise<{ chapters: Chapter[]; errors: string[] }> {
  const generator = createOptimizedBatchGenerator({
    maxRegenerationAttempts: 1, // No regeneration for speed
    timeoutMs: 600000, // 10 minutes per chapter
    enableParallelProcessing: true,
    cacheContext: true,
  });

  return generator.generateBatch(state, userInstruction, onProgress);
}
