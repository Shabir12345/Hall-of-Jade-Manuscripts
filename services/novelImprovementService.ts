import { NovelState } from '../types';
import { ImprovementRequest, ImprovementStrategy, ImprovementExecutionResult, ImprovementHistory, ImprovementCategory, ImprovementHistoryRecord, HistoryFilters } from '../types/improvement';
import { generateUUID } from '../utils/uuid';
import { generateImprovementStrategy, analyzeCategoryWeaknesses } from './improvementStrategyGenerator';
import { executeImprovementStrategy } from './improvementExecutor';
import { 
  NarrativeOptimizationEngine, 
  OptimizationResult, 
  ChapterTargetingOptions, 
  MultiCategoryOptions 
} from './narrativeOptimizationEngine';
import { 
  createImprovementRecord,
  getImprovementHistory as getHistoryRecords,
  getImprovementById,
  rollbackImprovement as rollbackFromHistory,
  evaluateImprovement,
  computeImprovementStatistics,
  getScoreProgression,
  exportImprovementHistory,
} from './improvementHistoryService';

/**
 * Novel Improvement Service
 * Main orchestration service that coordinates the entire improvement workflow
 */

/**
 * Main entry point: Improves novel based on request
 * Now routes to Narrative Optimization Engine (NOE) for comprehensive optimization
 */
export async function improveNovel(
  state: NovelState,
  request: ImprovementRequest,
  onProgress?: (message: string, progress: number) => void
): Promise<{
  improvedState: NovelState;
  result: ImprovementExecutionResult;
  history: ImprovementHistory;
}> {
  // 1. Validate request
  const validation = validateRequest(state, request);
  if (!validation.valid) {
    throw new Error(`Invalid request: ${validation.errors.join('; ')}`);
  }
  
  onProgress?.('Initializing Narrative Optimization Engine...', 2);
  
  // 2. Use NOE for optimization (targeted or full novel)
  const targetScore = request.targetScore || 90; // Default to 90 for NOE
  let optimizationResult: OptimizationResult;
  
  // If chapter selection is provided, use targeted optimization
  if (request.chapterSelection) {
    onProgress?.('Preparing targeted chapter optimization...', 3);
    optimizationResult = await NarrativeOptimizationEngine.optimizeChapters(
      state,
      request.category as ImprovementCategory,
      request.chapterSelection,
      targetScore,
      onProgress
    );
  } else {
    // Otherwise, optimize the full novel
    optimizationResult = await NarrativeOptimizationEngine.optimizeNovel(
      state,
      request.category as ImprovementCategory,
      targetScore,
      onProgress
    );
  }
  
  if (!optimizationResult.success) {
    throw new Error(optimizationResult.message);
  }
  
  // 3. Convert NOE result to ImprovementExecutionResult format
  const improvedState = optimizationResult.improvedState;
  
  // Create a synthetic execution result from NOE results
  const executionResult: ImprovementExecutionResult = {
    strategyId: generateUUID(),
    category: request.category,
    success: optimizationResult.success,
    actionsExecuted: optimizationResult.executionResults.reduce((sum, r) => sum + r.actionsExecuted, 0),
    actionsSucceeded: optimizationResult.executionResults.reduce((sum, r) => sum + r.actionsSucceeded, 0),
    actionsFailed: optimizationResult.executionResults.reduce((sum, r) => sum + r.actionsFailed, 0),
    chaptersEdited: optimizationResult.executionResults.reduce((sum, r) => sum + r.chaptersEdited, 0),
    chaptersInserted: optimizationResult.executionResults.reduce((sum, r) => sum + r.chaptersInserted, 0),
    chaptersRegenerated: optimizationResult.executionResults.reduce((sum, r) => sum + r.chaptersRegenerated, 0),
    scoreBefore: optimizationResult.finalScore - optimizationResult.scoreImprovement,
    scoreAfter: optimizationResult.finalScore,
    scoreImprovement: optimizationResult.scoreImprovement,
    actionResults: optimizationResult.executionResults.flatMap(r => r.actionResults),
    failures: optimizationResult.executionResults.flatMap(r => r.failures),
    validationResults: {
      improvementsValidated: true,
      scoreImproved: optimizationResult.scoreImprovement > 0,
      allGoalsMet: optimizationResult.finalScore >= targetScore,
      warnings: optimizationResult.executionResults.flatMap(r => r.validationResults.warnings),
    },
    summary: optimizationResult.message,
    executionTime: 0, // NOE tracks this internally
    updatedState: improvedState,
  };
  
  // 4. Generate strategy for history (synthetic, based on NOE results)
  const weaknesses = analyzeCategoryWeaknesses(state, request.category);
  
  // Determine chapters affected based on selection
  let chaptersAffected: number[];
  if (request.chapterSelection) {
    if (request.chapterSelection.chapterNumbers) {
      chaptersAffected = request.chapterSelection.chapterNumbers;
    } else if (request.chapterSelection.chapterIds) {
      chaptersAffected = state.chapters
        .filter(ch => request.chapterSelection!.chapterIds!.includes(ch.id))
        .map(ch => ch.number);
    } else if (request.chapterSelection.chapterRange) {
      chaptersAffected = state.chapters
        .filter(ch => ch.number >= request.chapterSelection!.chapterRange!.start && 
                     ch.number <= request.chapterSelection!.chapterRange!.end)
        .map(ch => ch.number);
    } else {
      chaptersAffected = improvedState.chapters.map(ch => ch.number);
    }
  } else {
    chaptersAffected = improvedState.chapters.map(ch => ch.number);
  }
  
  const strategy: ImprovementStrategy = {
    id: generateUUID(),
    category: request.category,
    priority: 'high',
    targetScore: weaknesses.overallScore,
    goalScore: targetScore,
    description: `NOE optimization: ${optimizationResult.message}${request.chapterSelection ? ' (targeted chapters)' : ''}`,
    rationale: `Optimized through ${optimizationResult.iterations} iteration(s)${request.chapterSelection ? ` on ${chaptersAffected.length} selected chapter(s)` : ''}`,
    strategyType: 'hybrid',
    estimatedImpact: optimizationResult.scoreImprovement > 15 ? 'high' : 'medium',
    estimatedEffort: 'high',
    chaptersAffected,
    expectedImprovement: optimizationResult.scoreImprovement,
  };
  
  // 5. Create history record with full state snapshots
  // The new improvementHistoryService handles storage optimization
  const history: ImprovementHistory = {
    id: generateUUID(),
    novelId: state.id,
    timestamp: Date.now(),
    category: request.category,
    request,
    strategy,
    result: executionResult,
    rolledBack: false,
    originalState: state, // Full state for rollback
  };
  
  onProgress?.('Saving improvement history...', 95);
  
  // Save to the new history service with full before/after states
  // This stores to Supabase (with localStorage fallback) and generates diff snapshots
  try {
    await createImprovementRecord(
      state.id,
      undefined, // userId - will be populated if auth is available
      state,     // Full before state
      improvedState, // Full after state
      history
    );
  } catch (historyError) {
    // Don't fail the improvement if history saving fails
    console.error('Failed to save to improvement history service:', historyError);
    // Fall back to legacy localStorage save
    await saveImprovementHistory(history);
  }
  
  onProgress?.('Improvement complete!', 100);
  
  return {
    improvedState,
    result: executionResult,
    history,
  };
}

/**
 * Validates improvement request
 */
export function validateRequest(
  state: NovelState,
  request: ImprovementRequest
): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Validate novel has chapters
  if (state.chapters.length === 0) {
    errors.push('Novel has no chapters to improve');
  }
  
  // Validate category
  const validCategories = [
    'excellence',
    'structure',
    'engagement',
    'character',
    'theme',
    'tension',
    'prose',
    'originality',
    'voice',
    'literary_devices',
    'market_readiness',
  ];
  if (!validCategories.includes(request.category)) {
    errors.push(`Invalid category: ${request.category}`);
  }
  
  // Validate target score
  if (request.targetScore !== undefined) {
    if (request.targetScore < 0 || request.targetScore > 100) {
      errors.push('Target score must be between 0 and 100');
    }
  }
  
  // Validate limits
  if (request.maxChaptersToInsert !== undefined && request.maxChaptersToInsert < 0) {
    errors.push('maxChaptersToInsert must be non-negative');
  }
  
  if (request.maxChaptersToEdit !== undefined && request.maxChaptersToEdit < 0) {
    errors.push('maxChaptersToEdit must be non-negative');
  }
  
  // Validate novel structure
  if (!state.id) {
    errors.push('Novel ID is required');
  }
  
  if (!state.title || state.title.trim().length === 0) {
    warnings.push('Novel title is empty');
  }
  
  // Validate chapter structure
  state.chapters.forEach((chapter, index) => {
    if (!chapter.id) {
      warnings.push(`Chapter ${index + 1} is missing an ID`);
    }
    if (!chapter.content || chapter.content.trim().length < 10) {
      warnings.push(`Chapter ${index + 1} has very little content (may affect improvement quality)`);
    }
  });
  
  // Warnings
  if (state.chapters.length < 5) {
    warnings.push('Novel has few chapters; improvements may have limited impact');
  }
  
  if (state.chapters.length > 100) {
    warnings.push('Novel has many chapters; improvements may take longer to process');
  }
  
  // Validate target score is achievable
  if (request.targetScore !== undefined) {
    const weaknesses = analyzeCategoryWeaknesses(state, request.category);
    if (request.targetScore > weaknesses.overallScore + 50) {
      warnings.push(`Target score (${request.targetScore}) is significantly higher than current score (${weaknesses.overallScore}); may require extensive improvements`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Calculates optimal target score based on current score and novel length
 */
function calculateOptimalTargetScore(currentScore: number, chapterCount: number): number {
  // Base improvement: aim for 15-25 point increase
  let targetIncrease = 20;
  
  // Adjust based on current score
  if (currentScore < 40) {
    // Very low score - more aggressive improvement possible
    targetIncrease = 25;
  } else if (currentScore < 60) {
    // Low score - good improvement potential
    targetIncrease = 22;
  } else if (currentScore < 80) {
    // Medium score - moderate improvement
    targetIncrease = 18;
  } else {
    // High score - smaller improvements
    targetIncrease = 12;
  }
  
  // Adjust based on novel length (longer novels have more room for improvement)
  if (chapterCount > 20) {
    targetIncrease = Math.floor(targetIncrease * 1.1);
  } else if (chapterCount < 5) {
    targetIncrease = Math.floor(targetIncrease * 0.8);
  }
  
  return Math.min(100, currentScore + targetIncrease);
}

/**
 * Validates improved state structure and integrity
 */
function validateImprovedState(
  improvedState: NovelState,
  originalState: NovelState
): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Validate state structure
  if (!improvedState.id) {
    errors.push('Improved state missing ID');
  }
  
  if (improvedState.id !== originalState.id) {
    errors.push('Improved state ID does not match original state ID');
  }
  
  // Validate chapters
  if (!improvedState.chapters || improvedState.chapters.length === 0) {
    errors.push('Improved state has no chapters');
  }
  
  // Check for significant chapter loss (more than 50%)
  if (improvedState.chapters.length < originalState.chapters.length * 0.5) {
    warnings.push(`Chapter count reduced significantly (${originalState.chapters.length} → ${improvedState.chapters.length})`);
  }
  
  // Validate chapter structure
  improvedState.chapters.forEach((chapter, index) => {
    if (!chapter.id) {
      warnings.push(`Improved chapter ${index + 1} is missing an ID`);
    }
    if (!chapter.content || chapter.content.trim().length === 0) {
      warnings.push(`Improved chapter ${index + 1} has empty content`);
    }
  });
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

const IMPROVEMENT_HISTORY_STORAGE_KEY = 'improvement_history';

/**
 * Saves improvement to history
 * Uses localStorage as temporary storage until database persistence is implemented
 */
async function saveImprovementHistory(history: ImprovementHistory): Promise<void> {
  try {
    // Try to save to database first (when implemented)
    // await supabase.from('improvement_history').insert(history);
    
    // For now, save to localStorage as backup/temporary storage
    const stored = localStorage.getItem(IMPROVEMENT_HISTORY_STORAGE_KEY);
    let allHistory: ImprovementHistory[] = stored ? JSON.parse(stored) : [];
    
    // Create a minimal version of history for storage (no full content)
    const minimalHistory = {
      ...history,
      // Strip out large data from result
      result: {
        ...history.result,
        actionResults: history.result.actionResults.map(ar => ({
          ...ar,
          // Remove newContent from stored results to save space
          newContent: undefined,
        })),
        // Don't store updatedState in history
        updatedState: undefined,
      },
    };
    
    // Add new history entry
    allHistory.push(minimalHistory as ImprovementHistory);
    
    // Keep only last 50 entries to prevent localStorage from getting too large
    const recentHistory = allHistory
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 50);
    
    // Try to save, with quota handling
    try {
      localStorage.setItem(IMPROVEMENT_HISTORY_STORAGE_KEY, JSON.stringify(recentHistory));
    } catch (quotaError) {
      // If quota exceeded, clear old entries and try again
      console.warn('localStorage quota exceeded, clearing old history entries');
      const minimalRecentHistory = recentHistory.slice(0, 20);
      try {
        localStorage.setItem(IMPROVEMENT_HISTORY_STORAGE_KEY, JSON.stringify(minimalRecentHistory));
      } catch (e) {
        // If still failing, clear all history
        console.warn('Still exceeding quota, clearing all improvement history');
        localStorage.removeItem(IMPROVEMENT_HISTORY_STORAGE_KEY);
      }
    }
    
    console.log('Improvement history saved:', {
      id: history.id,
      novelId: history.novelId,
      category: history.category,
      timestamp: new Date(history.timestamp).toISOString(),
      success: history.result.success,
      scoreImprovement: history.result.scoreImprovement,
    });
  } catch (error) {
    console.error('Failed to save improvement history:', error);
    // Don't throw - history saving is not critical for improvement execution
  }
}

/**
 * Gets improvement history for a novel
 * Now uses the improvementHistoryService which stores to Supabase with localStorage fallback
 */
export async function getImprovementHistory(
  novelId: string, 
  filters?: HistoryFilters
): Promise<ImprovementHistoryRecord[]> {
  try {
    // Use the new history service
    return await getHistoryRecords(novelId, filters);
  } catch (error) {
    console.error('Failed to get improvement history:', error);
    return [];
  }
}

/**
 * Gets a specific improvement history entry by ID
 * Now uses the improvementHistoryService
 */
export async function getImprovementHistoryById(historyId: string): Promise<ImprovementHistoryRecord | null> {
  try {
    return await getImprovementById(historyId);
  } catch (error) {
    console.error('Failed to get improvement history by ID:', error);
    return null;
  }
}

/**
 * Rolls back an improvement by restoring the original state
 * Now uses the improvementHistoryService
 */
export async function rollbackImprovement(historyId: string): Promise<NovelState | null> {
  try {
    return await rollbackFromHistory(historyId);
  } catch (error) {
    console.error('Failed to rollback improvement:', error);
    throw error;
  }
}

/**
 * Improve specific chapters only (targeted optimization)
 */
export async function improveChapters(
  state: NovelState,
  category: ImprovementCategory,
  targeting: ChapterTargetingOptions,
  targetScore?: number,
  onProgress?: (message: string, progress: number) => void
): Promise<OptimizationResult> {
  return NarrativeOptimizationEngine.optimizeChapters(
    state,
    category,
    targeting,
    targetScore,
    onProgress
  );
}

/**
 * Improve multiple categories at once
 */
export async function improveMultipleCategories(
  state: NovelState,
  options: MultiCategoryOptions,
  targetScore?: number,
  onProgress?: (message: string, progress: number) => void
): Promise<{
  results: Map<ImprovementCategory, OptimizationResult>;
  combinedState: NovelState;
  totalScoreImprovement: number;
  success: boolean;
  message: string;
}> {
  return NarrativeOptimizationEngine.optimizeMultipleCategories(
    state,
    options,
    targetScore,
    onProgress
  );
}

/**
 * Analyze all categories without making changes
 * Useful for dashboard overview
 */
export async function analyzeAllCategories(
  state: NovelState,
  onProgress?: (message: string, progress: number) => void
): Promise<Map<ImprovementCategory, { score: number; topIssues: string[] }>> {
  return NarrativeOptimizationEngine.analyzeAllCategories(state, onProgress);
}

// Re-export types for convenience
export type { ChapterTargetingOptions } from '../types/improvement';
export type { MultiCategoryOptions, OptimizationResult } from './narrativeOptimizationEngine';

// Re-export history service functions for convenience
export {
  evaluateImprovement,
  computeImprovementStatistics,
  getScoreProgression,
  exportImprovementHistory,
} from './improvementHistoryService';
