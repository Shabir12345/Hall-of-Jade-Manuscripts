/**
 * Memory Tier Manager
 * 
 * Orchestrates the three-tier hierarchical memory system:
 * 1. Short-Term (Current Breath): Last 3-5 chapters of raw text
 * 2. Mid-Term (Episodic Arc): Arc summaries and character states
 * 3. Long-Term (Sect Library): Vector DB semantic search + Lore Bible
 * 
 * This is the main entry point for retrieving comprehensive context
 * for chapter generation.
 */

import { NovelState } from '../../types';
import { LoreBible } from '../../types/loreBible';
import { logger } from '../loggingService';
import { buildLoreBible, formatLoreBibleForPrompt, formatLoreBibleCompact } from '../loreBible/loreBibleService';
import { getRelevantArcMemories, formatArcMemoriesCompact, ArcMemorySummary } from './arcMemoryService';
import { getContextForChapterGeneration, SemanticSearchResult, isPineconeReady } from '../vectorDb';
import { extractChapterEnding, buildContinuityBridge } from '../promptEngine/contextGatherer';
import { getStyleProfile } from '../promptEngine/styleAnalyzer';
import { estimateTokens } from '../promptEngine/tokenEstimator';

/**
 * Short-term memory context (Current Breath)
 */
export interface ShortTermContext {
  /** Raw text of recent chapters */
  recentChaptersText: string[];
  /** Chapter numbers included */
  chapterNumbers: number[];
  /** Continuity bridge for smooth transitions */
  continuityBridge: string;
  /** Previous chapter ending for reference */
  previousEnding: string;
  /** Prose style profile */
  styleProfile: string;
  /** Estimated token count */
  tokenCount: number;
}

/**
 * Mid-term memory context (Episodic Arc)
 */
export interface MidTermContext {
  /** Arc memory summaries */
  arcMemories: ArcMemorySummary[];
  /** Formatted arc context */
  formattedContext: string;
  /** Active arc summary */
  activeArcSummary: string;
  /** Character states at current point */
  characterStates: string;
  /** Thread status summary */
  threadStatus: string;
  /** Estimated token count */
  tokenCount: number;
}

/**
 * Long-term memory context (Sect Library)
 */
export interface LongTermContext {
  /** Semantic search results by category */
  searchResults: {
    characters: SemanticSearchResult[];
    worldEntries: SemanticSearchResult[];
    plotElements: SemanticSearchResult[];
    powerElements: SemanticSearchResult[];
  };
  /** Formatted search context */
  formattedSearchContext: string;
  /** Search queries used */
  queriesUsed: string[];
  /** Whether vector DB was available */
  vectorDbAvailable: boolean;
  /** Estimated token count */
  tokenCount: number;
}

/**
 * Complete memory context from all tiers
 */
export interface MemoryContext {
  shortTerm: ShortTermContext;
  midTerm: MidTermContext;
  longTerm: LongTermContext;
  loreBible: LoreBible;
  formattedLoreBible: string;
  /** Total estimated token count */
  totalTokenCount: number;
  /** Retrieval duration in ms */
  retrievalDuration: number;
}

/**
 * Options for gathering memory context
 */
export interface MemoryGatherOptions {
  /** Number of recent chapters for short-term memory */
  recentChaptersCount?: number;
  /** Number of arc memories to include */
  maxArcMemories?: number;
  /** Semantic search queries for long-term memory */
  searchQueries?: string[];
  /** Maximum results per search category */
  maxSearchResults?: number;
  /** Token budget for context */
  tokenBudget?: number;
  /** Whether to use compact formatting */
  compactFormat?: boolean;
}

const DEFAULT_OPTIONS: MemoryGatherOptions = {
  recentChaptersCount: 5,
  maxArcMemories: 3,
  maxSearchResults: 5,
  tokenBudget: 12000,
  compactFormat: false,
};

/**
 * Gather short-term memory (Current Breath)
 */
async function gatherShortTermMemory(
  state: NovelState,
  options: MemoryGatherOptions
): Promise<ShortTermContext> {
  const count = options.recentChaptersCount || 5;
  const chapters = state.chapters.slice(-count);
  
  // Get raw chapter text
  const recentChaptersText = chapters.map(ch => ch.content);
  const chapterNumbers = chapters.map(ch => ch.number);
  
  // Get previous chapter ending and continuity bridge
  const previousChapter = state.chapters[state.chapters.length - 1] || null;
  const previousEnding = previousChapter ? extractChapterEnding(previousChapter, 600) : '';
  const nextChapterNumber = state.chapters.length + 1;
  const continuityBridge = buildContinuityBridge(previousChapter, nextChapterNumber, state);
  
  // Get style profile
  const styleProfileData = getStyleProfile(state);
  const styleProfile = styleProfileData ? formatStyleProfile(styleProfileData) : '';
  
  // Estimate tokens
  const allText = [...recentChaptersText, continuityBridge, previousEnding, styleProfile].join('\n');
  const tokenCount = estimateTokens(allText);

  return {
    recentChaptersText,
    chapterNumbers,
    continuityBridge,
    previousEnding,
    styleProfile,
    tokenCount,
  };
}

/**
 * Format style profile for context
 */
function formatStyleProfile(profile: any): string {
  if (!profile) return '';
  
  const parts: string[] = [];
  parts.push('[PROSE STYLE PROFILE]');
  
  if (profile.metrics) {
    parts.push(`Sentence Length: ${profile.metrics.averageSentenceLength?.toFixed(1) || 'varies'} words avg`);
    parts.push(`Tone: ${profile.metrics.tone || 'mixed'}`);
    parts.push(`Pacing: ${profile.metrics.pacingPattern || 'medium'}`);
    parts.push(`Dialogue Ratio: ${((profile.metrics.dialogueRatio || 0) * 100).toFixed(0)}%`);
  }
  
  if (profile.styleGuidelines?.length > 0) {
    parts.push('Guidelines:');
    profile.styleGuidelines.slice(0, 3).forEach((g: string) => {
      parts.push(`- ${g}`);
    });
  }
  
  return parts.join('\n');
}

/**
 * Gather mid-term memory (Episodic Arc)
 */
async function gatherMidTermMemory(
  state: NovelState,
  options: MemoryGatherOptions
): Promise<MidTermContext> {
  const maxArcs = options.maxArcMemories || 3;
  
  // Get relevant arc memories
  const arcMemories = getRelevantArcMemories(state, state.chapters.length, maxArcs);
  
  // Format arc context
  const formattedContext = formatArcMemoriesCompact(arcMemories);
  
  // Get active arc summary
  const activeArc = arcMemories.find(m => m.status === 'active');
  const activeArcSummary = activeArc ? activeArc.summary : 'No active arc.';
  
  // Build character states summary
  const characterStates = buildCharacterStatesSummary(state);
  
  // Build thread status summary
  const threadStatus = buildThreadStatusSummary(state);
  
  // Estimate tokens
  const allText = [formattedContext, characterStates, threadStatus].join('\n');
  const tokenCount = estimateTokens(allText);

  return {
    arcMemories,
    formattedContext,
    activeArcSummary,
    characterStates,
    threadStatus,
    tokenCount,
  };
}

/**
 * Build character states summary for mid-term context
 */
function buildCharacterStatesSummary(state: NovelState): string {
  const sections: string[] = [];
  sections.push('[CHARACTER STATES]');
  
  // Get protagonist
  const protagonist = state.characterCodex.find(c => c.isProtagonist);
  if (protagonist) {
    sections.push(`Protagonist: ${protagonist.name} - ${protagonist.currentCultivation} (${protagonist.status})`);
  }
  
  // Get other key characters (recently active)
  const otherCharacters = state.characterCodex
    .filter(c => !c.isProtagonist && c.status === 'Alive')
    .slice(0, 5);
  
  if (otherCharacters.length > 0) {
    sections.push('Key Characters:');
    otherCharacters.forEach(char => {
      sections.push(`- ${char.name}: ${char.currentCultivation || 'Unknown cultivation'}`);
    });
  }
  
  return sections.join('\n');
}

/**
 * Build thread status summary for mid-term context
 */
function buildThreadStatusSummary(state: NovelState): string {
  if (!state.storyThreads || state.storyThreads.length === 0) {
    return '[ACTIVE THREADS]\nNo tracked story threads.';
  }
  
  const sections: string[] = [];
  sections.push('[ACTIVE THREADS]');
  
  // Group by priority
  const critical = state.storyThreads.filter(t => t.status === 'active' && t.priority === 'critical');
  const high = state.storyThreads.filter(t => t.status === 'active' && t.priority === 'high');
  const other = state.storyThreads.filter(t => t.status === 'active' && t.priority !== 'critical' && t.priority !== 'high');
  
  if (critical.length > 0) {
    sections.push('CRITICAL:');
    critical.forEach(t => sections.push(`- ${t.title}: ${t.description.substring(0, 100)}`));
  }
  
  if (high.length > 0) {
    sections.push('High Priority:');
    high.slice(0, 3).forEach(t => sections.push(`- ${t.title}: ${t.description.substring(0, 80)}`));
  }
  
  if (other.length > 0) {
    sections.push(`Other Active: ${other.length} threads`);
  }
  
  return sections.join('\n');
}

/**
 * Gather long-term memory (Sect Library)
 */
async function gatherLongTermMemory(
  state: NovelState,
  options: MemoryGatherOptions
): Promise<LongTermContext> {
  const vectorDbAvailable = await isPineconeReady();
  
  if (!vectorDbAvailable) {
    logger.warn('Vector DB not available, using empty long-term context', 'memoryTierManager');
    return {
      searchResults: {
        characters: [],
        worldEntries: [],
        plotElements: [],
        powerElements: [],
      },
      formattedSearchContext: '',
      queriesUsed: [],
      vectorDbAvailable: false,
      tokenCount: 0,
    };
  }
  
  // Generate queries if not provided
  const queries = options.searchQueries || generateDefaultQueries(state);
  
  // Perform semantic search
  const searchResults = await getContextForChapterGeneration(state.id, queries, {
    maxCharacters: options.maxSearchResults || 5,
    maxWorldEntries: 3,
    maxPlotElements: 3,
    maxPowerElements: 3,
    minScore: 0.5,
  });
  
  // Format search results
  const formattedSearchContext = formatSearchResults(searchResults);
  
  // Estimate tokens
  const tokenCount = estimateTokens(formattedSearchContext);

  return {
    searchResults,
    formattedSearchContext,
    queriesUsed: queries,
    vectorDbAvailable: true,
    tokenCount,
  };
}

/**
 * Generate default search queries based on current state
 */
function generateDefaultQueries(state: NovelState): string[] {
  const queries: string[] = [];
  
  // Query based on protagonist
  const protagonist = state.characterCodex.find(c => c.isProtagonist);
  if (protagonist) {
    queries.push(`${protagonist.name} abilities and techniques`);
  }
  
  // Query based on active arc
  const activeArc = state.plotLedger.find(a => a.status === 'active');
  if (activeArc) {
    queries.push(activeArc.title);
  }
  
  // Query based on recent chapter
  const recentChapter = state.chapters[state.chapters.length - 1];
  if (recentChapter?.summary) {
    // Extract key noun phrases from summary
    const words = recentChapter.summary.split(/\s+/).filter(w => w.length > 5);
    if (words.length > 0) {
      queries.push(words.slice(0, 5).join(' '));
    }
  }
  
  // Always include a general world query
  queries.push('cultivation system power levels');
  
  return queries.slice(0, 5); // Limit to 5 queries
}

/**
 * Format search results for context
 */
function formatSearchResults(results: {
  characters: SemanticSearchResult[];
  worldEntries: SemanticSearchResult[];
  plotElements: SemanticSearchResult[];
  powerElements: SemanticSearchResult[];
}): string {
  const sections: string[] = [];
  sections.push('[SECT LIBRARY - SEMANTIC SEARCH RESULTS]');
  sections.push('');
  
  if (results.characters.length > 0) {
    sections.push('Relevant Characters:');
    results.characters.forEach(r => {
      sections.push(`- ${r.name} (relevance: ${(r.score * 100).toFixed(0)}%)`);
    });
    sections.push('');
  }
  
  if (results.worldEntries.length > 0) {
    sections.push('World Building:');
    results.worldEntries.forEach(r => {
      sections.push(`- ${r.name} (${r.metadata.category || 'general'})`);
    });
    sections.push('');
  }
  
  if (results.plotElements.length > 0) {
    sections.push('Plot Elements:');
    results.plotElements.forEach(r => {
      sections.push(`- ${r.name} [${r.type}]`);
    });
    sections.push('');
  }
  
  if (results.powerElements.length > 0) {
    sections.push('Techniques/Items:');
    results.powerElements.forEach(r => {
      sections.push(`- ${r.name} (${r.type})`);
    });
  }
  
  return sections.join('\n');
}

/**
 * Main function to gather complete memory context
 * OPTIMIZED: Parallel execution with early termination for performance
 */
export async function gatherMemoryContext(
  state: NovelState,
  options: MemoryGatherOptions = {}
): Promise<MemoryContext> {
  const startTime = Date.now();
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  logger.info('Gathering hierarchical memory context (OPTIMIZED)', 'memoryTierManager', {
    novelId: state.id,
    currentChapter: state.chapters.length,
  });

  // OPTIMIZATION: Run all three tiers in parallel with timeout protection
  const memoryPromises = [
    gatherShortTermMemory(state, opts),
    gatherMidTermMemory(state, opts),
    gatherLongTermMemory(state, opts),
  ];

  // Add timeout protection (10 seconds max per tier)
  const timeoutMs = 10000;
  const timeoutPromise = (tier: string) => new Promise((_, reject) => 
    setTimeout(() => reject(new Error(`${tier} memory timeout`)), timeoutMs)
  );

  try {
    // Race each memory tier against timeout
    const [shortTerm, midTerm, longTerm] = await Promise.allSettled([
      Promise.race([memoryPromises[0], timeoutPromise('Short-term')]),
      Promise.race([memoryPromises[1], timeoutPromise('Mid-term')]),
      Promise.race([memoryPromises[2], timeoutPromise('Long-term')]),
    ]);

    // Handle settled results, fallback to empty context on failure
    const finalShortTerm = shortTerm.status === 'fulfilled' ? shortTerm.value as ShortTermContext : createEmptyShortTermContext();
    const finalMidTerm = midTerm.status === 'fulfilled' ? midTerm.value as MidTermContext : createEmptyMidTermContext();
    const finalLongTerm = longTerm.status === 'fulfilled' ? longTerm.value as LongTermContext : createEmptyLongTermContext();

    // Build Lore Bible in parallel to memory gathering
    const loreBiblePromise = buildLoreBible(state, state.chapters.length);
    const loreBible = await Promise.race([loreBiblePromise, 
      new Promise(resolve => setTimeout(() => resolve(createEmptyLoreBible()), 5000))
    ]) as LoreBible;
    
    const formattedLoreBible = opts.compactFormat 
      ? formatLoreBibleCompact(loreBible)
      : formatLoreBibleForPrompt(loreBible);

    // Calculate total token count
    const loreBibleTokens = estimateTokens(formattedLoreBible);
    const totalTokenCount = finalShortTerm.tokenCount + finalMidTerm.tokenCount + 
                            finalLongTerm.tokenCount + loreBibleTokens;

    const retrievalDuration = Date.now() - startTime;

    logger.info('Memory context gathered (OPTIMIZED)', 'memoryTierManager', {
      shortTermTokens: finalShortTerm.tokenCount,
      midTermTokens: finalMidTerm.tokenCount,
      longTermTokens: finalLongTerm.tokenCount,
      loreBibleTokens,
      totalTokenCount,
      retrievalDuration,
      timeouts: [shortTerm.status, midTerm.status, longTerm.status].filter(s => s === 'rejected').length,
    });

    return {
      shortTerm: finalShortTerm,
      midTerm: finalMidTerm,
      longTerm: finalLongTerm,
      loreBible,
      formattedLoreBible,
      totalTokenCount,
      retrievalDuration,
    };
  } catch (error) {
    logger.error('Memory context gathering failed, using fallbacks', 'memoryTierManager', error instanceof Error ? error : new Error(String(error)));
    
    // Return empty contexts as ultimate fallback
    const emptyContext = {
      shortTerm: createEmptyShortTermContext(),
      midTerm: createEmptyMidTermContext(), 
      longTerm: createEmptyLongTermContext(),
      loreBible: createEmptyLoreBible(),
      formattedLoreBible: '',
      totalTokenCount: 0,
      retrievalDuration: Date.now() - startTime,
    };
    
    return emptyContext;
  }
}

/**
 * Create empty short-term context fallback
 */
function createEmptyShortTermContext(): ShortTermContext {
  return {
    recentChaptersText: [],
    chapterNumbers: [],
    continuityBridge: '',
    previousEnding: '',
    styleProfile: '',
    tokenCount: 0,
  };
}

/**
 * Create empty mid-term context fallback
 */
function createEmptyMidTermContext(): MidTermContext {
  return {
    arcMemories: [],
    formattedContext: '',
    activeArcSummary: '',
    characterStates: '',
    threadStatus: '',
    tokenCount: 0,
  };
}

/**
 * Create empty long-term context fallback
 */
function createEmptyLongTermContext(): LongTermContext {
  return {
    searchResults: {
      characters: [],
      worldEntries: [],
      plotElements: [],
      powerElements: [],
    },
    formattedSearchContext: '',
    queriesUsed: [],
    vectorDbAvailable: false,
    tokenCount: 0,
  };
}

/**
 * Create empty lore bible fallback
 */
function createEmptyLoreBible(): LoreBible {
  return {
    novelId: '',
    asOfChapter: 0,
    protagonist: {
      identity: {
        name: '',
        aliases: [],
        sect: '',
      },
      cultivation: {
        realm: '',
        stage: '',
        foundationQuality: '',
      },
      techniques: [],
      inventory: {
        equipped: [],
        storageRing: [],
      },
      lastUpdatedChapter: 0,
    },
    majorCharacters: [],
    worldState: {
      currentRealm: '',
      currentLocation: '',
      currentSituation: '',
    },
    narrativeAnchors: {
      lastMajorEvent: '',
      lastMajorEventChapter: 0,
      currentObjective: '',
      activeQuests: [],
      pendingPromises: [],
    },
    powerSystem: {
      currentProtagonistRank: '',
      knownLevelHierarchy: [],
      powerGaps: [],
    },
    activeConflicts: [],
    karmaDebts: [],
    updatedAt: Date.now(),
    version: 1,
  };
}

/**
 * Assemble context with token budget
 * Prioritizes content based on importance within the budget
 */
export function assembleContextWithBudget(
  context: MemoryContext,
  tokenBudget: number
): string {
  const sections: string[] = [];
  let usedTokens = 0;

  // Priority 1: Continuity bridge (MUST include)
  const continuityTokens = estimateTokens(context.shortTerm.continuityBridge);
  if (usedTokens + continuityTokens <= tokenBudget) {
    sections.push(context.shortTerm.continuityBridge);
    usedTokens += continuityTokens;
  }

  // Priority 2: Lore Bible (Source of Truth)
  const bibleTokens = estimateTokens(context.formattedLoreBible);
  if (usedTokens + bibleTokens <= tokenBudget) {
    sections.push(context.formattedLoreBible);
    usedTokens += bibleTokens;
  }

  // Priority 3: Active arc summary
  if (context.midTerm.activeArcSummary) {
    const arcTokens = estimateTokens(context.midTerm.activeArcSummary);
    if (usedTokens + arcTokens <= tokenBudget) {
      sections.push(`[CURRENT ARC]\n${context.midTerm.activeArcSummary}`);
      usedTokens += arcTokens;
    }
  }

  // Priority 4: Character states
  const charTokens = estimateTokens(context.midTerm.characterStates);
  if (usedTokens + charTokens <= tokenBudget) {
    sections.push(context.midTerm.characterStates);
    usedTokens += charTokens;
  }

  // Priority 5: Thread status
  const threadTokens = estimateTokens(context.midTerm.threadStatus);
  if (usedTokens + threadTokens <= tokenBudget) {
    sections.push(context.midTerm.threadStatus);
    usedTokens += threadTokens;
  }

  // Priority 6: Semantic search results (if available)
  if (context.longTerm.vectorDbAvailable && context.longTerm.formattedSearchContext) {
    const searchTokens = context.longTerm.tokenCount;
    if (usedTokens + searchTokens <= tokenBudget) {
      sections.push(context.longTerm.formattedSearchContext);
      usedTokens += searchTokens;
    }
  }

  // Priority 7: Style profile
  if (context.shortTerm.styleProfile) {
    const styleTokens = estimateTokens(context.shortTerm.styleProfile);
    if (usedTokens + styleTokens <= tokenBudget) {
      sections.push(context.shortTerm.styleProfile);
      usedTokens += styleTokens;
    }
  }

  // Priority 8: Previous chapter ending (if not already in continuity bridge)
  if (context.shortTerm.previousEnding && !sections[0].includes(context.shortTerm.previousEnding)) {
    const endingTokens = estimateTokens(context.shortTerm.previousEnding);
    if (usedTokens + endingTokens <= tokenBudget * 0.95) { // Leave 5% buffer
      sections.push(`[PREVIOUS CHAPTER ENDING]\n${context.shortTerm.previousEnding}`);
      usedTokens += endingTokens;
    }
  }

  logger.debug('Context assembled with budget', 'memoryTierManager', undefined, {
    tokenBudget,
    usedTokens,
    sectionCount: sections.length,
  });

  return sections.join('\n\n');
}

/**
 * Quick context getter for simple use cases
 */
export async function getQuickContext(
  state: NovelState,
  searchQueries?: string[]
): Promise<string> {
  const context = await gatherMemoryContext(state, {
    recentChaptersCount: 3,
    maxArcMemories: 2,
    searchQueries,
    compactFormat: true,
  });

  return assembleContextWithBudget(context, 8000);
}
