/**
 * Memory-Enhanced Context Service
 * 
 * Integrates the Hierarchical Memory Architecture with the existing
 * prompt builder system. This service provides enhanced context gathering
 * that incorporates the three-tier memory system:
 * 
 * 1. Short-Term (Current Breath): Last 3-5 chapters
 * 2. Mid-Term (Episodic Arc): Arc summaries  
 * 3. Long-Term (Sect Library): Pinecone vector search + Lore Bible
 */

import { NovelState, PromptContext } from '../../types';
import { logger } from '../loggingService';
import { gatherMemoryContext, assembleContextWithBudget, MemoryContext, MemoryGatherOptions } from './memoryTierManager';
import { analyzeChapterContext, getSearchQueries } from './queryAnalyzer';
import { buildLoreBible, formatLoreBibleForPrompt, formatLoreBibleCompact } from '../loreBible/loreBibleService';
import { getRelevantArcMemories, formatArcMemoriesCompact, ArcMemorySummary } from './arcMemoryService';
import { isPineconeReady, getContextForChapterGeneration } from '../vectorDb';
import { estimateTokens } from '../promptEngine/tokenEstimator';

/**
 * Enhanced context with hierarchical memory
 */
export interface MemoryEnhancedContext {
  /** Lore Bible formatted for prompt */
  loreBibleContext: string;
  
  /** Arc memory summaries formatted for prompt */
  arcMemoryContext: string;
  
  /** Semantic search results formatted for prompt */
  semanticSearchContext: string;
  
  /** Combined memory context (all tiers) */
  combinedMemoryContext: string;
  
  /** Queries used for semantic search */
  searchQueries: string[];
  
  /** Token counts for each section */
  tokenCounts: {
    loreBible: number;
    arcMemory: number;
    semanticSearch: number;
    total: number;
  };
  
  /** Whether vector DB was used */
  vectorDbUsed: boolean;
  
  /** Retrieval duration in ms */
  retrievalDuration: number;
}

/**
 * Options for memory-enhanced context gathering
 */
export interface MemoryEnhancedContextOptions {
  /** User instruction for context relevance */
  userInstruction?: string;
  /** Maximum token budget for memory context */
  tokenBudget?: number;
  /** Whether to use compact formatting */
  compactFormat?: boolean;
  /** Custom search queries (otherwise auto-generated) */
  searchQueries?: string[];
  /** Maximum arc memories to include */
  maxArcMemories?: number;
  /** Whether to skip vector DB (for testing) */
  skipVectorDb?: boolean;
}

const DEFAULT_OPTIONS: MemoryEnhancedContextOptions = {
  tokenBudget: 4000, // Reserve 4000 tokens for memory context
  compactFormat: false,
  maxArcMemories: 3,
  skipVectorDb: false,
};

/**
 * Gather memory-enhanced context for chapter generation
 */
export async function gatherMemoryEnhancedContext(
  state: NovelState,
  options: MemoryEnhancedContextOptions = {}
): Promise<MemoryEnhancedContext> {
  const startTime = Date.now();
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  logger.info('Gathering memory-enhanced context', 'memoryEnhancedContextService', {
    novelId: state.id,
    chapterCount: state.chapters.length,
    tokenBudget: opts.tokenBudget,
  });

  // Generate search queries if not provided
  let searchQueries = opts.searchQueries || [];
  if (searchQueries.length === 0) {
    const analysis = analyzeChapterContext(state, {
      additionalContext: opts.userInstruction,
      maxQueries: 5,
    });
    searchQueries = analysis.queries.map(q => q.query);
  }

  // Build Lore Bible
  const loreBible = buildLoreBible(state, state.chapters.length);
  const loreBibleContext = opts.compactFormat 
    ? formatLoreBibleCompact(loreBible)
    : formatLoreBibleForPrompt(loreBible);

  // Get arc memories
  const arcMemories = getRelevantArcMemories(state, state.chapters.length, opts.maxArcMemories || 3);
  const arcMemoryContext = formatArcMemoriesCompact(arcMemories);

  // Get semantic search results (if vector DB available)
  let semanticSearchContext = '';
  let vectorDbUsed = false;

  if (!opts.skipVectorDb) {
    const pineconeReady = await isPineconeReady();
    if (pineconeReady && searchQueries.length > 0) {
      try {
        const searchResults = await getContextForChapterGeneration(state.id, searchQueries, {
          maxCharacters: 5,
          maxWorldEntries: 3,
          maxPlotElements: 3,
          maxPowerElements: 3,
          minScore: 0.5,
        });

        semanticSearchContext = formatSemanticSearchResults(searchResults);
        vectorDbUsed = true;

        logger.debug('Semantic search completed', 'memoryEnhancedContextService', undefined, {
          characterResults: searchResults.characters.length,
          worldResults: searchResults.worldEntries.length,
          plotResults: searchResults.plotElements.length,
          powerResults: searchResults.powerElements.length,
        });
      } catch (error) {
        logger.warn('Semantic search failed, continuing without vector results', 'memoryEnhancedContextService', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  // Calculate token counts
  const tokenCounts = {
    loreBible: estimateTokens(loreBibleContext),
    arcMemory: estimateTokens(arcMemoryContext),
    semanticSearch: estimateTokens(semanticSearchContext),
    total: 0,
  };
  tokenCounts.total = tokenCounts.loreBible + tokenCounts.arcMemory + tokenCounts.semanticSearch;

  // Assemble combined context within budget
  const combinedMemoryContext = assembleMemoryContext(
    loreBibleContext,
    arcMemoryContext,
    semanticSearchContext,
    opts.tokenBudget || 4000
  );

  const retrievalDuration = Date.now() - startTime;

  logger.info('Memory-enhanced context gathered', 'memoryEnhancedContextService', {
    tokenCounts,
    searchQueries: searchQueries.length,
    vectorDbUsed,
    retrievalDuration,
  });

  return {
    loreBibleContext,
    arcMemoryContext,
    semanticSearchContext,
    combinedMemoryContext,
    searchQueries,
    tokenCounts,
    vectorDbUsed,
    retrievalDuration,
  };
}

/**
 * Format semantic search results for prompt
 */
function formatSemanticSearchResults(results: {
  characters: any[];
  worldEntries: any[];
  plotElements: any[];
  powerElements: any[];
}): string {
  const sections: string[] = [];
  
  if (results.characters.length === 0 && 
      results.worldEntries.length === 0 && 
      results.plotElements.length === 0 && 
      results.powerElements.length === 0) {
    return '';
  }

  sections.push('[RELEVANT KNOWLEDGE FROM SECT LIBRARY]');
  sections.push('(Retrieved via semantic search for this chapter)');
  sections.push('');

  if (results.characters.length > 0) {
    sections.push('Related Characters:');
    results.characters.forEach(r => {
      sections.push(`• ${r.name}${r.metadata?.cultivation ? ` (${r.metadata.cultivation})` : ''}`);
    });
    sections.push('');
  }

  if (results.worldEntries.length > 0) {
    sections.push('World Knowledge:');
    results.worldEntries.forEach(r => {
      sections.push(`• ${r.name} [${r.metadata?.category || 'General'}]`);
    });
    sections.push('');
  }

  if (results.plotElements.length > 0) {
    sections.push('Plot Elements:');
    results.plotElements.forEach(r => {
      sections.push(`• ${r.name} (${r.type})`);
    });
    sections.push('');
  }

  if (results.powerElements.length > 0) {
    sections.push('Techniques/Items:');
    results.powerElements.forEach(r => {
      sections.push(`• ${r.name}`);
    });
  }

  return sections.join('\n');
}

/**
 * Assemble memory context within token budget
 */
function assembleMemoryContext(
  loreBible: string,
  arcMemory: string,
  semanticSearch: string,
  tokenBudget: number
): string {
  const sections: string[] = [];
  let usedTokens = 0;

  // Priority 1: Lore Bible (Source of Truth)
  const loreBibleTokens = estimateTokens(loreBible);
  if (usedTokens + loreBibleTokens <= tokenBudget) {
    sections.push(loreBible);
    usedTokens += loreBibleTokens;
  } else if (loreBibleTokens > tokenBudget * 0.5) {
    // If Lore Bible is too big, use first half
    const halfLength = Math.floor(loreBible.length / 2);
    sections.push(loreBible.substring(0, halfLength) + '\n[...truncated...]');
    usedTokens += estimateTokens(sections[0]);
  }

  // Priority 2: Arc Memory
  const arcMemoryTokens = estimateTokens(arcMemory);
  if (arcMemory && usedTokens + arcMemoryTokens <= tokenBudget) {
    sections.push(arcMemory);
    usedTokens += arcMemoryTokens;
  }

  // Priority 3: Semantic Search Results
  const semanticTokens = estimateTokens(semanticSearch);
  if (semanticSearch && usedTokens + semanticTokens <= tokenBudget) {
    sections.push(semanticSearch);
    usedTokens += semanticTokens;
  }

  return sections.join('\n\n');
}

/**
 * Get quick memory context for UI preview
 */
export async function getQuickMemoryPreview(
  state: NovelState
): Promise<{
  loreBibleSummary: string;
  arcMemorySummary: string;
  vectorDbStatus: string;
}> {
  // Build compact Lore Bible
  const loreBible = buildLoreBible(state, state.chapters.length);
  const loreBibleSummary = `${loreBible.protagonist.identity.name} | ${loreBible.protagonist.cultivation.realm}-${loreBible.protagonist.cultivation.stage} | ${loreBible.activeConflicts.length} conflicts | ${loreBible.karmaDebts.length} karma debts`;

  // Get arc memories
  const arcMemories = getRelevantArcMemories(state, state.chapters.length, 2);
  const arcMemorySummary = arcMemories.length > 0
    ? arcMemories.map(m => `${m.arcTitle} (${m.status})`).join(', ')
    : 'No arc memories';

  // Check vector DB
  const pineconeReady = await isPineconeReady();
  const vectorDbStatus = pineconeReady ? 'Connected' : 'Not configured';

  return {
    loreBibleSummary,
    arcMemorySummary,
    vectorDbStatus,
  };
}

/**
 * Inject memory context into existing prompt
 */
export function injectMemoryContext<T extends { systemInstruction: string; userPrompt: string }>(
  existingPrompt: T,
  memoryContext: MemoryEnhancedContext
): T {
  // Inject combined memory context at the beginning of the system instruction
  const memorySection = `
╔══════════════════════════════════════════════════════════════════════════════╗
║  HIERARCHICAL MEMORY CONTEXT - SOURCE OF TRUTH FOR NARRATIVE CONSISTENCY     ║
╚══════════════════════════════════════════════════════════════════════════════╝

${memoryContext.combinedMemoryContext}

══════════════════════════════════════════════════════════════════════════════════

`;

  return {
    ...existingPrompt,
    systemInstruction: memorySection + existingPrompt.systemInstruction,
  };
}

// Export for use in other services
export { formatSemanticSearchResults, assembleMemoryContext };
