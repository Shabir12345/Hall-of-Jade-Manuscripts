import { NovelState, Chapter, Character } from '../types';
import { estimateTokens } from './promptEngine/tokenEstimator';
import { WorldBibleExtractor, StoryConstants } from './worldBibleExtractor';

/**
 * Context Management Service
 * Manages context size, token estimation, and intelligent context reduction
 * for LLM operations, especially for large novels
 */

export interface ContextSizeEstimate {
  totalTokens: number;
  systemTokens: number;
  userTokens: number;
  breakdown: {
    worldBibleTokens: number;
    chapterContentTokens: number;
    characterCodexTokens: number;
    novelContextTokens: number;
    instructionTokens: number;
  };
}

export interface ReducedContext {
  state: NovelState;
  chaptersIncluded: number[];
  charactersIncluded: string[];
  worldBibleEntriesIncluded: number;
  contextType: 'full' | 'reduced' | 'minimal';
}

/**
 * Context Manager
 * Provides utilities for managing context size and token usage
 */
export class ContextManager {
  static readonly MAX_SAFE_TOKENS = 100000; // Safety margin for 128k window
  static readonly TARGET_TOKENS = 50000; // Target for large novels
  static readonly MINIMAL_TOKENS = 20000; // Minimal context target

  /**
   * Estimates context size for a novel state
   */
  static estimateContextSize(
    state: NovelState,
    options: {
      includeFullChapters?: boolean;
      maxRecentChapters?: number;
      includeWorldBible?: boolean;
      includeCharacterCodex?: boolean;
      instruction?: string;
      worldBibleConstraints?: string;
    } = {}
  ): ContextSizeEstimate {
    const {
      includeFullChapters = false,
      maxRecentChapters = 5,
      includeWorldBible = true,
      includeCharacterCodex = true,
      instruction = '',
      worldBibleConstraints = '',
    } = options;

    let worldBibleTokens = 0;
    if (includeWorldBible && state.worldBible.length > 0) {
      const worldBibleText = state.worldBible
        .map(e => `${e.title}: ${e.content}`)
        .join('\n');
      worldBibleTokens = estimateTokens(worldBibleText);
    }

    // Add world bible constraint prompt tokens
    if (worldBibleConstraints) {
      worldBibleTokens += estimateTokens(worldBibleConstraints);
    }

    let chapterContentTokens = 0;
    if (includeFullChapters) {
      const recentChapters = state.chapters.slice(-maxRecentChapters);
      const chapterText = recentChapters
        .map(ch => `${ch.title}\n${ch.content}\n${ch.summary || ''}`)
        .join('\n\n');
      chapterContentTokens = estimateTokens(chapterText);
    } else {
      // Use summaries only
      const recentChapters = state.chapters.slice(-maxRecentChapters);
      const chapterSummaries = recentChapters
        .map(ch => `Ch ${ch.number}: ${ch.title} - ${ch.summary || 'No summary'}`)
        .join('\n');
      chapterContentTokens = estimateTokens(chapterSummaries);
    }

    let characterCodexTokens = 0;
    if (includeCharacterCodex && state.characterCodex.length > 0) {
      const codexText = state.characterCodex
        .map(char => `${char.name}: ${char.personality || ''} ${char.currentCultivation || ''}`)
        .join('\n');
      characterCodexTokens = estimateTokens(codexText);
    }

    // Estimate novel context (title, genre, arcs, etc.)
    const novelContext = [
      state.title,
      state.genre,
      state.grandSaga || '',
      state.plotLedger.map(a => a.title + ' ' + a.description).join(' '),
    ].join(' ');
    const novelContextTokens = estimateTokens(novelContext);

    const instructionTokens = estimateTokens(instruction);

    const userTokens =
      worldBibleTokens +
      chapterContentTokens +
      characterCodexTokens +
      novelContextTokens +
      instructionTokens;

    // System instruction is typically ~2k tokens
    const systemTokens = 2000;

    return {
      totalTokens: systemTokens + userTokens,
      systemTokens,
      userTokens,
      breakdown: {
        worldBibleTokens,
        chapterContentTokens,
        characterCodexTokens,
        novelContextTokens,
        instructionTokens,
      },
    };
  }

  /**
   * Reduces context intelligently to fit within token budget
   */
  static reduceContextForImprovement(
    state: NovelState,
    targetTokens: number = ContextManager.TARGET_TOKENS
  ): ReducedContext {
    const fullEstimate = this.estimateContextSize(state, {
      includeFullChapters: true,
      maxRecentChapters: 5,
      includeWorldBible: true,
      includeCharacterCodex: true,
    });

    // If already under target, return full context
    if (fullEstimate.totalTokens <= targetTokens) {
      return {
        state,
        chaptersIncluded: state.chapters.map(ch => ch.number),
        charactersIncluded: state.characterCodex.map(ch => ch.id),
        worldBibleEntriesIncluded: state.worldBible.length,
        contextType: 'full',
      };
    }

    // Strategy: Progressive reduction
    let reducedState = { ...state };
    let chaptersIncluded: number[] = [];
    let charactersIncluded: string[] = [];
    let worldBibleEntriesIncluded = 0;
    let contextType: 'reduced' | 'minimal' = 'reduced';

    // Step 1: Reduce recent chapters (use summaries for older ones)
    const recentChapters = state.chapters.slice(-3); // Reduce from 5 to 3
    const olderChapters = state.chapters.slice(0, -3);
    
    chaptersIncluded = state.chapters.map(ch => ch.number);
    
    // Create reduced chapters (summaries for older chapters)
    const reducedChapters = [
      ...olderChapters.map(ch => ({
        ...ch,
        content: ch.summary || ch.title, // Replace content with summary
      })),
      ...recentChapters, // Keep full content for recent
    ];

    reducedState = {
      ...reducedState,
      chapters: reducedChapters,
    };

    // Step 2: Reduce character codex (only active characters)
    const activeCharacters = state.characterCodex.filter(char => {
      // Character is active if mentioned in recent chapters
      const recentContent = recentChapters
        .map(ch => ch.content + ' ' + ch.summary)
        .join(' ')
        .toLowerCase();
      return recentContent.includes(char.name.toLowerCase());
    });

    // Always include protagonist
    const protagonist = state.characterCodex.find(c => c.isProtagonist);
    const finalCharacters = protagonist && !activeCharacters.find(c => c.id === protagonist.id)
      ? [protagonist, ...activeCharacters]
      : activeCharacters.length > 0
      ? activeCharacters
      : state.characterCodex.slice(0, 10); // Fallback: first 10 characters

    charactersIncluded = finalCharacters.map(ch => ch.id);
    reducedState = {
      ...reducedState,
      characterCodex: finalCharacters,
    };

    // Step 3: Reduce world bible (essential entries only)
    const essentialWorldBible = state.worldBible.filter(entry => {
      // Keep power levels, systems, and frequently referenced entries
      return (
        entry.category === 'PowerLevels' ||
        entry.category === 'Systems' ||
        entry.category === 'Laws'
      );
    });

    // If still too large, limit to first 20 entries
    const limitedWorldBible =
      essentialWorldBible.length > 20
        ? essentialWorldBible.slice(0, 20)
        : essentialWorldBible.length > 0
        ? essentialWorldBible
        : state.worldBible.slice(0, 10); // Fallback

    worldBibleEntriesIncluded = limitedWorldBible.length;
    reducedState = {
      ...reducedState,
      worldBible: limitedWorldBible,
    };

    // Check if we need minimal context
    const reducedEstimate = this.estimateContextSize(reducedState, {
      includeFullChapters: false, // Use summaries
      maxRecentChapters: 3,
      includeWorldBible: true,
      includeCharacterCodex: true,
    });

    if (reducedEstimate.totalTokens > targetTokens) {
      // Need minimal context
      contextType = 'minimal';
      
      // Further reduction: only 2 recent chapters, minimal characters
      const minimalChapters = state.chapters.slice(-2);
      const minimalCharacters = [protagonist, ...activeCharacters.slice(0, 5)].filter(Boolean) as Character[];
      
      reducedState = {
        ...reducedState,
        chapters: [
          ...state.chapters.slice(0, -2).map(ch => ({
            ...ch,
            content: ch.summary || ch.title,
          })),
          ...minimalChapters,
        ],
        characterCodex: minimalCharacters,
        worldBible: limitedWorldBible.slice(0, 10),
      };

      chaptersIncluded = state.chapters.map(ch => ch.number);
      charactersIncluded = minimalCharacters.map(ch => ch.id);
      worldBibleEntriesIncluded = 10;
    }

    return {
      state: reducedState,
      chaptersIncluded,
      charactersIncluded,
      worldBibleEntriesIncluded,
      contextType,
    };
  }

  /**
   * Splits novel into batches for processing
   */
  static splitNovelIntoBatches(
    state: NovelState,
    maxChaptersPerBatch: number = 10
  ): Array<{
    batchNumber: number;
    chapters: Chapter[];
    startChapter: number;
    endChapter: number;
  }> {
    const chapters = state.chapters.sort((a, b) => a.number - b.number);
    const batches: Array<{
      batchNumber: number;
      chapters: Chapter[];
      startChapter: number;
      endChapter: number;
    }> = [];

    for (let i = 0; i < chapters.length; i += maxChaptersPerBatch) {
      const batch = chapters.slice(i, i + maxChaptersPerBatch);
      batches.push({
        batchNumber: Math.floor(i / maxChaptersPerBatch) + 1,
        chapters: batch,
        startChapter: batch[0].number,
        endChapter: batch[batch.length - 1].number,
      });
    }

    return batches;
  }

  /**
   * Gets minimal context needed for editing a specific chapter
   */
  static getMinimalContextForEdit(
    chapter: Chapter,
    state: NovelState
  ): {
    reducedState: NovelState;
    estimatedTokens: number;
  } {
    // For editing, we need:
    // - The chapter being edited (full content)
    // - Previous chapter (ending only, ~600 words)
    // - Next chapter (beginning only, ~200 words)
    // - Essential world bible
    // - Active characters only

    const chapterIndex = state.chapters.findIndex(ch => ch.id === chapter.id);
    const previousChapter = chapterIndex > 0 ? state.chapters[chapterIndex - 1] : null;
    const nextChapter = chapterIndex < state.chapters.length - 1 ? state.chapters[chapterIndex + 1] : null;

    // Create minimal chapters array
    const minimalChapters: Chapter[] = [];

    if (previousChapter) {
      // Previous chapter: ending only
      const endingContent = previousChapter.content.substring(
        Math.max(0, previousChapter.content.length - 600)
      );
      minimalChapters.push({
        ...previousChapter,
        content: endingContent,
      });
    }

    // Current chapter: full content
    minimalChapters.push(chapter);

    if (nextChapter) {
      // Next chapter: beginning only
      const beginningContent = nextChapter.content.substring(0, 400);
      minimalChapters.push({
        ...nextChapter,
        content: beginningContent,
      });
    }

    // Get active characters (mentioned in these chapters)
    const chapterContent = minimalChapters.map(ch => ch.content).join(' ').toLowerCase();
    const activeCharacters = state.characterCodex.filter(char => {
      return chapterContent.includes(char.name.toLowerCase());
    });

    const protagonist = state.characterCodex.find(c => c.isProtagonist);
    const finalCharacters = protagonist && !activeCharacters.find(c => c.id === protagonist.id)
      ? [protagonist, ...activeCharacters]
      : activeCharacters.length > 0
      ? activeCharacters
      : state.characterCodex.slice(0, 5);

    // Essential world bible only
    const essentialWorldBible = state.worldBible.filter(
      entry => entry.category === 'PowerLevels' || entry.category === 'Systems'
    ).slice(0, 10);

    const reducedState: NovelState = {
      ...state,
      chapters: minimalChapters,
      characterCodex: finalCharacters,
      worldBible: essentialWorldBible,
    };

    const estimatedTokens = this.estimateContextSize(reducedState, {
      includeFullChapters: true,
      maxRecentChapters: minimalChapters.length,
      includeWorldBible: true,
      includeCharacterCodex: true,
    }).totalTokens;

    return {
      reducedState,
      estimatedTokens,
    };
  }

  /**
   * Checks if context size is safe for LLM call
   */
  static isContextSafe(
    estimatedTokens: number,
    maxTokens: number = ContextManager.MAX_SAFE_TOKENS
  ): { safe: boolean; warning: string | null } {
    if (estimatedTokens > maxTokens) {
      return {
        safe: false,
        warning: `Context too large: ${estimatedTokens.toLocaleString()} tokens exceeds limit of ${maxTokens.toLocaleString()}`,
      };
    }

    if (estimatedTokens > maxTokens * 0.8) {
      return {
        safe: true,
        warning: `High token usage: ${estimatedTokens.toLocaleString()} tokens (${Math.round((estimatedTokens / maxTokens) * 100)}% of limit)`,
      };
    }

    return {
      safe: true,
      warning: null,
    };
  }

  /**
   * Gets optimal context configuration based on novel size
   */
  static getOptimalContextConfig(state: NovelState): {
    includeFullChapters: boolean;
    maxRecentChapters: number;
    includeWorldBible: boolean;
    includeCharacterCodex: boolean;
    useSummaries: boolean;
  } {
    const chapterCount = state.chapters.length;
    const characterCount = state.characterCodex.length;
    const worldBibleCount = state.worldBible.length;

    // Small novel (< 20 chapters)
    if (chapterCount < 20) {
      return {
        includeFullChapters: true,
        maxRecentChapters: 5,
        includeWorldBible: true,
        includeCharacterCodex: true,
        useSummaries: false,
      };
    }

    // Medium novel (20-40 chapters)
    if (chapterCount < 40) {
      return {
        includeFullChapters: false, // Use summaries for older chapters
        maxRecentChapters: 4,
        includeWorldBible: true,
        includeCharacterCodex: characterCount < 20, // Only if not too many characters
        useSummaries: true,
      };
    }

    // Large novel (40+ chapters)
    return {
      includeFullChapters: false,
      maxRecentChapters: 3,
      includeWorldBible: worldBibleCount < 30, // Only if not too many entries
      includeCharacterCodex: characterCount < 15,
      useSummaries: true,
    };
  }
}
