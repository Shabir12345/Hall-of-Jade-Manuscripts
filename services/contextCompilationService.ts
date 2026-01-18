/**
 * Context Compilation Service
 * Main service that compiles comprehensive context for chapter generation
 * Integrates thread context, character context, plot points, and story progression
 */

import { NovelState, Character, PostChapterExtraction, Chapter } from '../types';
import { compileThreadContext, ThreadContextSection } from './threadProgressionService';
import { 
  buildComprehensiveCharacterContext, 
  buildMultipleCharacterContexts,
  ComprehensiveCharacterContext 
} from './characterContextEnhancer';
import { getOpenPlotPoints, OpenPlotPointsContext } from './openPlotPointsTracker';
import { analyzeProgression, StoryProgressionAnalysis } from './storyProgressionAnalyzer';
import { textContainsCharacterName } from '../utils/characterNameMatching';

export interface ComprehensiveContext {
  threadContext: ThreadContextSection;
  characterContexts: ComprehensiveCharacterContext[];
  openPlotPoints: OpenPlotPointsContext;
  storyProgression: StoryProgressionAnalysis;
  formattedContext: string;
}

/**
 * Compile comprehensive thread context
 */
export function compileThreadContextForPrompt(
  state: NovelState,
  nextChapterNumber: number
): ThreadContextSection {
  return compileThreadContext(state, nextChapterNumber);
}

/**
 * Compile comprehensive character context for characters appearing in chapter
 */
export function compileCharacterContextForPrompt(
  state: NovelState,
  characterIds: string[]
): ComprehensiveCharacterContext[] {
  if (characterIds.length === 0) {
    // If no specific characters, get characters from previous chapter ending
    const previousChapter = state.chapters[state.chapters.length - 1];
    if (previousChapter) {
      const charactersInEnding = state.characterCodex.filter(c =>
        textContainsCharacterName(previousChapter.content.slice(-1000), c.name)
      );
      
      if (charactersInEnding.length > 0) {
        return buildMultipleCharacterContexts(
          charactersInEnding.map(c => c.id),
          state
        );
      }
    }
    
    // Fallback to protagonist
    const protagonist = state.characterCodex.find(c => c.isProtagonist);
    if (protagonist) {
      return [buildComprehensiveCharacterContext(protagonist, state)];
    }
    
    return [];
  }
  
  return buildMultipleCharacterContexts(characterIds, state);
}

/**
 * Compile open plot points
 */
export function compileOpenPlotPointsForPrompt(
  state: NovelState
): OpenPlotPointsContext {
  return getOpenPlotPoints(state);
}

/**
 * Analyze story progression
 */
export function analyzeStoryProgressionForPrompt(
  state: NovelState
): StoryProgressionAnalysis {
  return analyzeProgression(state);
}

/**
 * Compile all comprehensive context for chapter generation
 */
export function compileComprehensiveContext(
  state: NovelState,
  nextChapterNumber: number,
  characterIds?: string[]
): ComprehensiveContext {
  // Get characters that will appear (either provided or from previous chapter)
  const charactersToInclude = characterIds || (() => {
    const previousChapter = state.chapters[state.chapters.length - 1];
    if (previousChapter) {
      const charsInEnding = state.characterCodex.filter(c =>
        textContainsCharacterName(previousChapter.content.slice(-1000), c.name)
      );
      return charsInEnding.length > 0 
        ? charsInEnding.map(c => c.id)
        : state.characterCodex.filter(c => c.isProtagonist).map(c => c.id);
    }
    return state.characterCodex.filter(c => c.isProtagonist).map(c => c.id);
  })();

  // Compile all context sections
  const threadContext = compileThreadContextForPrompt(state, nextChapterNumber);
  const characterContexts = compileCharacterContextForPrompt(state, charactersToInclude);
  const openPlotPoints = compileOpenPlotPointsForPrompt(state);
  const storyProgression = analyzeStoryProgressionForPrompt(state);

  // Format comprehensive context
  const sections: string[] = [];
  
  // Thread context (most important for continuity)
  sections.push(threadContext.formattedContext);
  sections.push('');

  // Character contexts
  if (characterContexts.length > 0) {
    sections.push('[COMPREHENSIVE CHARACTER CONTEXTS]');
    sections.push('');
    characterContexts.forEach(charContext => {
      sections.push(charContext.formattedContext);
      sections.push('');
    });
  }

  // Open plot points
  sections.push(openPlotPoints.formattedContext);
  sections.push('');

  // Story progression
  sections.push(storyProgression.formattedContext);
  sections.push('');

  return {
    threadContext,
    characterContexts,
    openPlotPoints,
    storyProgression,
    formattedContext: sections.join('\n'),
  };
}
