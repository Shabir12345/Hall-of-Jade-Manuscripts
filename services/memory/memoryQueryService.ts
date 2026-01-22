/**
 * Memory Query Service
 * Provides API endpoints to query the hierarchical memory system
 */

import { NovelState } from '../../types';
import { MemoryContext, gatherMemoryContext } from './memoryTierManager';
import { ArcMemorySummary, buildArcMemorySummary } from './arcMemoryService';
import { logger } from '../loggingService';

/**
 * Query options for memory retrieval
 */
export interface MemoryQueryOptions {
  /** Depth of memory to retrieve (1=short, 2=mid, 3=long) */
  depth?: number;
  /** Maximum token budget for the response */
  tokenBudget?: number;
  /** Specific character ID to focus on */
  characterId?: string;
  /** Specific event or keyword to search for */
  eventKeyword?: string;
}

/**
 * Query the hierarchical memory system
 */
export async function queryMemory(
  state: NovelState,
  options: MemoryQueryOptions = {}
): Promise<MemoryContext> {
  const opts = {
    depth: 3,
    tokenBudget: 4000,
    ...options
  };

  logger.info('Querying memory system', 'memoryQueryService', {
    characterId: opts.characterId,
    eventKeyword: opts.eventKeyword,
    depth: opts.depth
  });

  // Use the memory tier manager to gather context
  const context = await gatherMemoryContext(state, {
    recentChaptersCount: opts.depth >= 1 ? 5 : 0,
    maxArcMemories: opts.depth >= 2 ? 3 : 0,
    tokenBudget: opts.tokenBudget,
    searchQueries: opts.eventKeyword ? [opts.eventKeyword] : undefined
  });

  // Filter by character if specified
  if (opts.characterId) {
    context.shortTerm = filterContextByCharacter(context.shortTerm, opts.characterId);
    context.midTerm = filterContextByCharacter(context.midTerm, opts.characterId);
    context.longTerm = filterContextByCharacter(context.longTerm, opts.characterId);
  }

  return context;
}

/**
 * Filter memory context to focus on specific character
 */
function filterContextByCharacter(context: any, characterId: string): any {
  if (!context || !characterId) return context;

  // For now, return context as-is since character filtering is complex
  // TODO: Implement proper character-based filtering when needed
  return context;
}

/**
 * Get character-specific memory across arcs
 */
export async function getCharacterMemory(
  characterId: string,
  state: NovelState,
  depth: number = 3
): Promise<ArcMemorySummary[]> {
  return state.plotLedger
    .filter(arc => arc.status === 'completed')
    .map(arc => buildArcMemorySummary(arc, state))
    .filter(summary =>
      summary.characterStates.some(char => char.characterId === characterId)
    )
    .slice(0, depth);
}
