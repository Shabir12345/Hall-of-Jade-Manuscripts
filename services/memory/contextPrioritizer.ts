/**
 * Context Prioritizer
 * 
 * Ranks retrieved context by relevance and ensures the most important
 * information is included within the token budget. Implements smart
 * prioritization based on entity importance, recency, and narrative relevance.
 */

import { NovelState, Chapter, Character } from '../../types';
import { SemanticSearchResult } from '../vectorDb';
import { LoreBible } from '../../types/loreBible';
import { estimateTokens } from '../promptEngine/tokenEstimator';
import { logger } from '../loggingService';

/**
 * Prioritized context item
 */
export interface PrioritizedItem {
  id: string;
  type: 'character' | 'world' | 'plot' | 'power' | 'chapter' | 'lore_bible' | 'continuity';
  content: string;
  priority: number; // Higher = more important
  tokenCount: number;
  reason: string;
}

/**
 * Context budget allocation
 */
export interface BudgetAllocation {
  continuity: number;      // Chapter transition/bridge
  loreBible: number;       // Source of truth
  characters: number;      // Character context
  plotElements: number;    // Story threads, conflicts
  worldBuilding: number;   // World rules, locations
  powerElements: number;   // Techniques, items
  recentChapters: number;  // Chapter summaries
  styleProfile: number;    // Writing style
}

/**
 * Default budget allocation percentages
 */
const DEFAULT_ALLOCATION: BudgetAllocation = {
  continuity: 0.20,      // 20% - Critical for consistency
  loreBible: 0.15,       // 15% - Source of truth
  characters: 0.15,      // 15% - Character context
  plotElements: 0.15,    // 15% - Plot continuity
  worldBuilding: 0.10,   // 10% - World rules
  powerElements: 0.10,   // 10% - Power system
  recentChapters: 0.10,  // 10% - Recent context
  styleProfile: 0.05,    // 5%  - Style consistency
};

/**
 * Calculate priority score for a character
 */
function calculateCharacterPriority(
  character: Character,
  state: NovelState,
  searchResult?: SemanticSearchResult
): number {
  let priority = 50; // Base priority

  // Protagonist gets highest priority
  if (character.isProtagonist) {
    priority += 100;
  }

  // Characters with more relationships are more important
  priority += (character.relationships?.length || 0) * 5;

  // Alive characters are more relevant
  if (character.status === 'Alive') {
    priority += 20;
  }

  // Recently mentioned characters (from search score)
  if (searchResult) {
    priority += searchResult.score * 30;
  }

  // Characters in active conflicts/threads
  if (state.storyThreads) {
    const inActiveThread = state.storyThreads.some(t =>
      t.status === 'active' &&
      (t.description?.toLowerCase().includes(character.name.toLowerCase()) ||
       t.title?.toLowerCase().includes(character.name.toLowerCase()))
    );
    if (inActiveThread) {
      priority += 25;
    }
  }

  // Characters related to antagonists
  if (state.antagonists) {
    const relatedToAntagonist = state.antagonists.some(a =>
      a.status === 'active' &&
      a.relationships?.some(r => r.characterId === character.id)
    );
    if (relatedToAntagonist) {
      priority += 15;
    }
  }

  return priority;
}

/**
 * Calculate priority for world building content
 */
function calculateWorldPriority(
  searchResult: SemanticSearchResult,
  state: NovelState
): number {
  let priority = 30; // Base priority

  // Add search relevance
  priority += searchResult.score * 40;

  // Power levels and systems are always important
  if (searchResult.metadata.category === 'PowerLevels' ||
      searchResult.metadata.category === 'Systems') {
    priority += 20;
  }

  // Content from current realm is more relevant
  if (searchResult.metadata.realmId === state.currentRealmId) {
    priority += 15;
  }

  return priority;
}

/**
 * Calculate priority for plot elements
 */
function calculatePlotPriority(
  searchResult: SemanticSearchResult,
  state: NovelState
): number {
  let priority = 40; // Base priority

  // Add search relevance
  priority += searchResult.score * 35;

  // Active elements are more important
  if (searchResult.metadata.status === 'active') {
    priority += 25;
  }

  // High priority threads
  if (searchResult.metadata.priority === 'critical') {
    priority += 30;
  } else if (searchResult.metadata.priority === 'high') {
    priority += 20;
  }

  // Antagonists with high threat level
  if (searchResult.type === 'antagonist') {
    if (searchResult.metadata.threatLevel === 'extreme') {
      priority += 25;
    } else if (searchResult.metadata.threatLevel === 'high') {
      priority += 15;
    }
  }

  return priority;
}

/**
 * Calculate priority for power elements (techniques, items)
 */
function calculatePowerPriority(
  searchResult: SemanticSearchResult,
  state: NovelState
): number {
  let priority = 35; // Base priority

  // Add search relevance
  priority += searchResult.score * 35;

  // Core techniques are more important
  if (searchResult.metadata.category === 'Core') {
    priority += 20;
  } else if (searchResult.metadata.category === 'Important') {
    priority += 10;
  }

  // Treasure items are more important
  if (searchResult.metadata.category === 'Treasure') {
    priority += 15;
  }

  return priority;
}

/**
 * Prioritize search results
 */
export function prioritizeSearchResults(
  results: {
    characters: SemanticSearchResult[];
    worldEntries: SemanticSearchResult[];
    plotElements: SemanticSearchResult[];
    powerElements: SemanticSearchResult[];
  },
  state: NovelState
): PrioritizedItem[] {
  const items: PrioritizedItem[] = [];

  // Prioritize characters
  for (const result of results.characters) {
    const character = state.characterCodex.find(c => c.id === result.id);
    const priority = character 
      ? calculateCharacterPriority(character, state, result)
      : 30 + result.score * 30;

    items.push({
      id: result.id,
      type: 'character',
      content: `Character: ${result.name}`,
      priority,
      tokenCount: estimateTokens(result.name + (result.metadata?.cultivation || '')),
      reason: `Search score: ${(result.score * 100).toFixed(0)}%`,
    });
  }

  // Prioritize world entries
  for (const result of results.worldEntries) {
    const priority = calculateWorldPriority(result, state);

    items.push({
      id: result.id,
      type: 'world',
      content: result.name,
      priority,
      tokenCount: estimateTokens(result.name),
      reason: `Category: ${result.metadata.category || 'general'}`,
    });
  }

  // Prioritize plot elements
  for (const result of results.plotElements) {
    const priority = calculatePlotPriority(result, state);

    items.push({
      id: result.id,
      type: 'plot',
      content: result.name,
      priority,
      tokenCount: estimateTokens(result.name),
      reason: `Type: ${result.type}, Status: ${result.metadata.status || 'unknown'}`,
    });
  }

  // Prioritize power elements
  for (const result of results.powerElements) {
    const priority = calculatePowerPriority(result, state);

    items.push({
      id: result.id,
      type: 'power',
      content: result.name,
      priority,
      tokenCount: estimateTokens(result.name),
      reason: `Type: ${result.type}`,
    });
  }

  // Sort by priority (highest first)
  items.sort((a, b) => b.priority - a.priority);

  return items;
}

/**
 * Build prioritized context list from all sources
 */
export function buildPrioritizedContextList(
  continuityBridge: string,
  loreBible: string,
  characterContext: string,
  worldContext: string,
  plotContext: string,
  powerContext: string,
  recentChapters: string,
  styleProfile: string
): PrioritizedItem[] {
  const items: PrioritizedItem[] = [];

  // Continuity bridge - highest priority
  if (continuityBridge) {
    items.push({
      id: 'continuity',
      type: 'continuity',
      content: continuityBridge,
      priority: 1000, // Always first
      tokenCount: estimateTokens(continuityBridge),
      reason: 'Critical for chapter transition',
    });
  }

  // Lore Bible - second highest
  if (loreBible) {
    items.push({
      id: 'lore_bible',
      type: 'lore_bible',
      content: loreBible,
      priority: 900, // Second
      tokenCount: estimateTokens(loreBible),
      reason: 'Source of truth for consistency',
    });
  }

  // Character context
  if (characterContext) {
    items.push({
      id: 'characters',
      type: 'character',
      content: characterContext,
      priority: 700,
      tokenCount: estimateTokens(characterContext),
      reason: 'Character states and relationships',
    });
  }

  // Plot context
  if (plotContext) {
    items.push({
      id: 'plot',
      type: 'plot',
      content: plotContext,
      priority: 650,
      tokenCount: estimateTokens(plotContext),
      reason: 'Active threads and conflicts',
    });
  }

  // World context
  if (worldContext) {
    items.push({
      id: 'world',
      type: 'world',
      content: worldContext,
      priority: 500,
      tokenCount: estimateTokens(worldContext),
      reason: 'World building and rules',
    });
  }

  // Power elements
  if (powerContext) {
    items.push({
      id: 'power',
      type: 'power',
      content: powerContext,
      priority: 400,
      tokenCount: estimateTokens(powerContext),
      reason: 'Techniques and items',
    });
  }

  // Recent chapters
  if (recentChapters) {
    items.push({
      id: 'chapters',
      type: 'chapter',
      content: recentChapters,
      priority: 300,
      tokenCount: estimateTokens(recentChapters),
      reason: 'Recent narrative context',
    });
  }

  return items.sort((a, b) => b.priority - a.priority);
}

/**
 * Select items within token budget
 */
export function selectWithinBudget(
  items: PrioritizedItem[],
  tokenBudget: number,
  minInclude?: string[] // IDs that must be included
): PrioritizedItem[] {
  const selected: PrioritizedItem[] = [];
  let usedTokens = 0;
  
  const mustInclude = new Set(minInclude || []);

  // First pass: add must-include items
  for (const item of items) {
    if (mustInclude.has(item.id)) {
      if (usedTokens + item.tokenCount <= tokenBudget) {
        selected.push(item);
        usedTokens += item.tokenCount;
      }
    }
  }

  // Second pass: add remaining items by priority
  for (const item of items) {
    if (selected.some(s => s.id === item.id)) {
      continue; // Already added
    }

    if (usedTokens + item.tokenCount <= tokenBudget) {
      selected.push(item);
      usedTokens += item.tokenCount;
    }
  }

  logger.debug('Selected context within budget', 'contextPrioritizer', undefined, {
    totalItems: items.length,
    selectedItems: selected.length,
    tokenBudget,
    usedTokens,
  });

  return selected;
}

/**
 * Allocate token budget across categories
 */
export function allocateBudget(
  totalBudget: number,
  allocation: Partial<BudgetAllocation> = {}
): BudgetAllocation {
  const alloc = { ...DEFAULT_ALLOCATION, ...allocation };
  
  return {
    continuity: Math.floor(totalBudget * alloc.continuity),
    loreBible: Math.floor(totalBudget * alloc.loreBible),
    characters: Math.floor(totalBudget * alloc.characters),
    plotElements: Math.floor(totalBudget * alloc.plotElements),
    worldBuilding: Math.floor(totalBudget * alloc.worldBuilding),
    powerElements: Math.floor(totalBudget * alloc.powerElements),
    recentChapters: Math.floor(totalBudget * alloc.recentChapters),
    styleProfile: Math.floor(totalBudget * alloc.styleProfile),
  };
}

/**
 * Rebalance budget based on available content
 * If one category has less content, redistribute to others
 */
export function rebalanceBudget(
  allocation: BudgetAllocation,
  actualUsage: Partial<BudgetAllocation>
): BudgetAllocation {
  const rebalanced = { ...allocation };
  let surplus = 0;

  // Calculate surplus from underused categories
  for (const [key, allocated] of Object.entries(allocation)) {
    const used = actualUsage[key as keyof BudgetAllocation] || 0;
    if (used < allocated) {
      surplus += allocated - used;
      rebalanced[key as keyof BudgetAllocation] = used;
    }
  }

  if (surplus <= 0) {
    return rebalanced;
  }

  // Distribute surplus to categories that can use more
  // Priority: continuity > loreBible > characters > plotElements
  const redistributionOrder: (keyof BudgetAllocation)[] = [
    'continuity', 'loreBible', 'characters', 'plotElements', 
    'worldBuilding', 'powerElements', 'recentChapters'
  ];

  for (const key of redistributionOrder) {
    if (surplus <= 0) break;
    
    const current = rebalanced[key];
    const original = allocation[key];
    const maxIncrease = original * 0.5; // Allow up to 50% increase
    const increase = Math.min(surplus, maxIncrease);
    
    rebalanced[key] = current + increase;
    surplus -= increase;
  }

  return rebalanced;
}

/**
 * Format prioritized items into context string
 */
export function formatPrioritizedContext(
  items: PrioritizedItem[],
  includeDebugInfo: boolean = false
): string {
  const sections: string[] = [];

  for (const item of items) {
    if (includeDebugInfo) {
      sections.push(`<!-- Priority: ${item.priority}, Reason: ${item.reason} -->`);
    }
    sections.push(item.content);
    sections.push('');
  }

  return sections.join('\n');
}

/**
 * Get priority summary for debugging/logging
 */
export function getPrioritySummary(items: PrioritizedItem[]): string {
  const byType: Record<string, number> = {};
  let totalTokens = 0;

  for (const item of items) {
    byType[item.type] = (byType[item.type] || 0) + 1;
    totalTokens += item.tokenCount;
  }

  const parts = Object.entries(byType).map(([type, count]) => `${type}: ${count}`);
  return `Items: ${items.length} (${parts.join(', ')}), Tokens: ${totalTokens}`;
}
