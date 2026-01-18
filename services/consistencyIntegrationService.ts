/**
 * Consistency Integration Service
 * 
 * Integrates the consistency system into the chapter generation workflow.
 * Handles pre-generation validation, context enhancement, and post-generation checking.
 */

import { NovelState, Chapter } from '../types';
import { PostChapterExtraction } from './aiService';
import { getPreGenerationValidator } from './preGenerationValidator';
import { getSemanticContextRetriever } from './semanticContextRetriever';
import { getContextCompiler } from './contextCompiler';
import { getKnowledgeGraphService } from './knowledgeGraphService';
import { getKnowledgeGraphUpdater } from './knowledgeGraphUpdater';
import { getPostGenerationConsistencyChecker } from './postGenerationConsistencyChecker';
import { getEntityStateTracker } from './entityStateTracker';
import { getConsistencyAutoCorrector } from './consistencyAutoCorrector';
import { gatherEnhancedPromptContext } from './promptEngine/enhancedContextGatherer';
import { generateConsistencyConstraints } from './promptEngine/consistencyConstraints';
import { getSceneContextManager } from './sceneContextManager';

export interface ConsistencyIntegrationResult {
  preValidation: {
    passed: boolean;
    report: any;
  };
  contextEnhanced: boolean;
  postValidation: {
    passed: boolean;
    report: any;
    corrections: any[];
  };
  graphUpdated: boolean;
  stateTracked: boolean;
}

/**
 * Run pre-generation validation and return enhanced context
 */
export async function prepareConsistencyContext(
  state: NovelState,
  nextChapterNumber: number
): Promise<{
  validationReport: any;
  enhancedContext: any;
  constraints: string;
  canProceed: boolean;
}> {
  const validator = getPreGenerationValidator();
  const validationReport = validator.validateBeforeGeneration(state, nextChapterNumber);

  // Get enhanced context
  const enhancedContext = await gatherEnhancedPromptContext(state, {
    includeKnowledgeGraph: true,
    includePowerProgression: true,
    includeRelationships: true,
    maxRecentChapters: 3,
  });

  // Generate consistency constraints
  const previousChapter = state.chapters[state.chapters.length - 1];
  const charactersInEnding = previousChapter
    ? extractCharactersFromText(previousChapter.content.slice(-1000), state.characterCodex)
    : state.characterCodex.filter(c => c.isProtagonist).map(c => c.id);

  const constraints = generateConsistencyConstraints(state, charactersInEnding);

  return {
    validationReport,
    enhancedContext,
    constraints: constraints.formattedText,
    canProceed: validationReport.valid,
  };
}

/**
 * Process post-generation consistency checking and updates
 */
export async function processPostGenerationConsistency(
  state: NovelState,
  newChapter: Chapter,
  extraction: PostChapterExtraction
): Promise<ConsistencyIntegrationResult> {
  const graphService = getKnowledgeGraphService();
  const graphUpdater = getKnowledgeGraphUpdater();
  const postChecker = getPostGenerationConsistencyChecker();
  const stateTracker = getEntityStateTracker();
  const autoCorrector = getConsistencyAutoCorrector();
  const sceneManager = getSceneContextManager();

  // Initialize graph if needed
  if (!graphService.getGraph()) {
    graphService.initializeGraph(state);
  }

  // Update knowledge graph
  const updateResult = graphUpdater.updateGraph(state, newChapter, extraction);

  // Check post-generation consistency
  const consistencyReport = postChecker.checkConsistency(state, newChapter, extraction);

  // Generate auto-corrections
  const corrections = autoCorrector.generateCorrections(state, consistencyReport.issues);

  // Track entity state changes
  if (extraction.characterUpserts) {
    extraction.characterUpserts.forEach(upsert => {
      const character = state.characterCodex.find(c =>
        c.name.toLowerCase() === upsert.name.toLowerCase()
      );

      if (character) {
        // Get previous state
        const previousState = stateTracker.getCurrentState('character', character.id);
        
        // Build current state
        const currentState: Record<string, any> = {
          name: character.name,
          age: upsert.set?.age || character.age,
          personality: upsert.set?.personality || character.personality,
          currentCultivation: upsert.set?.currentCultivation || character.currentCultivation,
          status: upsert.set?.status || character.status,
          notes: upsert.set?.notes || character.notes,
        };

        stateTracker.trackStateChange(
          'character',
          character.id,
          newChapter.id,
          newChapter.number,
          currentState,
          previousState || undefined
        );
      }
    });
  }

  // Build scene metadata
  if (newChapter.scenes && newChapter.scenes.length > 0) {
    newChapter.scenes.forEach(scene => {
      sceneManager.buildSceneMetadata(scene, newChapter, state);
    });
  }

  // Persist to database
  await persistConsistencyData(state, newChapter, updateResult, consistencyReport);

  return {
    preValidation: {
      passed: true, // Already passed if we got here
      report: null,
    },
    contextEnhanced: true,
    postValidation: {
      passed: consistencyReport.valid,
      report: consistencyReport,
      corrections,
    },
    graphUpdated: true,
    stateTracked: true,
  };
}


/**
 * Save context snapshot to database
 * This will gracefully handle cases where the chapter hasn't been saved to the database yet
 */
export async function saveContextSnapshot(
  novelId: string,
  chapterId: string,
  chapterNumber: number,
  contextData: any,
  entitiesIncluded: string[],
  tokenCount?: number
): Promise<void> {
  try {
    const { saveContextSnapshot: saveSnapshot } = await import('./consistencyPersistenceService');
    await saveSnapshot(novelId, chapterId, chapterNumber, contextData, entitiesIncluded, tokenCount);
  } catch (error) {
    // Error is already handled gracefully in persistence service
    // Only log if it's not a foreign key constraint error
    if (error && typeof error === 'object' && 'code' in error && error.code !== '23503') {
      console.error('Failed to save context snapshot:', error);
    }
  }
}

/**
 * Extract character IDs from text
 */
function extractCharactersFromText(text: string, characters: NovelState['characterCodex']): string[] {
  const found: string[] = [];
  const textLower = text.toLowerCase();

  characters.forEach(char => {
    if (textLower.includes(char.name.toLowerCase())) {
      found.push(char.id);
    }
  });

  return found;
}

/**
 * Initialize consistency system for a novel
 * Delegates to centralized initializer
 */
export async function initializeConsistencySystem(state: NovelState): Promise<void> {
  const { initializeConsistencySystemForNovel } = await import('./consistencySystemInitializer');
  await initializeConsistencySystemForNovel(state);
}
