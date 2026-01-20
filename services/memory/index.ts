/**
 * Memory Services Module
 * 
 * Exports all memory-related services for the hierarchical memory architecture.
 */

// Arc Memory Service (Mid-Term)
export {
  generateArcSummary,
  buildArcCharacterStates,
  buildArcThreadStates,
  buildArcMemorySummary,
  buildAllArcMemories,
  getRelevantArcMemories,
  formatArcMemoryForPrompt,
  formatArcMemoriesCompact,
  type ArcCharacterState,
  type ArcThreadState,
  type ArcMemorySummary,
} from './arcMemoryService';

// Memory Tier Manager
export {
  gatherMemoryContext,
  assembleContextWithBudget,
  getQuickContext,
  type ShortTermContext,
  type MidTermContext,
  type LongTermContext,
  type MemoryContext,
  type MemoryGatherOptions,
} from './memoryTierManager';

// Query Analyzer
export {
  analyzeChapterContext,
  getSearchQueries,
  analyzeText,
  type ExtractedEntity,
  type GeneratedQuery,
  type QueryAnalysisResult,
} from './queryAnalyzer';

// Context Prioritizer
export {
  prioritizeSearchResults,
  buildPrioritizedContextList,
  selectWithinBudget,
  allocateBudget,
  rebalanceBudget,
  formatPrioritizedContext,
  getPrioritySummary,
  type PrioritizedItem,
  type BudgetAllocation,
} from './contextPrioritizer';

// Memory-Enhanced Context Service
export {
  gatherMemoryEnhancedContext,
  getQuickMemoryPreview,
  injectMemoryContext,
  type MemoryEnhancedContext,
  type MemoryEnhancedContextOptions,
} from './memoryEnhancedContextService';
