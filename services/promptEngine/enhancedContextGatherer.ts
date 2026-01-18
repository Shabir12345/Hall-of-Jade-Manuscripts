/**
 * Enhanced Context Gatherer
 * 
 * Extends existing contextGatherer.ts with knowledge graph queries,
 * semantic retrieval, power level progression context, and relationship network context.
 */

import { NovelState, PromptContext } from '../../types';
import { gatherPromptContext } from './contextGatherer';
import { getKnowledgeGraphService } from '../knowledgeGraphService';
import { getSemanticContextRetriever } from '../semanticContextRetriever';
import { getContextCompiler } from '../contextCompiler';
import { getPowerLevelSystem } from '../powerLevelSystem';

export interface EnhancedPromptContext extends PromptContext {
  criticalState?: string; // Compiled critical state from knowledge graph
  powerProgression?: string; // Power level progression context
  relationshipNetwork?: string; // Relationship network context
  entityStates?: Array<{
    entityId: string;
    entityType: string;
    currentState: Record<string, any>;
  }>;
}

/**
 * Enhanced context gathering with knowledge graph integration
 */
export async function gatherEnhancedPromptContext(
  state: NovelState,
  options: {
    includeFullHistory?: boolean;
    maxRecentChapters?: number;
    includeStyleProfile?: boolean;
    includeCharacterDevelopment?: boolean;
    includeStoryProgression?: boolean;
    includeArcHistory?: boolean;
    includeKnowledgeGraph?: boolean;
    includePowerProgression?: boolean;
    includeRelationships?: boolean;
  } = {}
): Promise<EnhancedPromptContext> {
  const {
    includeKnowledgeGraph = true,
    includePowerProgression = true,
    includeRelationships = true,
    ...baseOptions
  } = options;

  // Get base context
  const baseContext = await gatherPromptContext(state, baseOptions);

  const enhancedContext: EnhancedPromptContext = {
    ...baseContext,
  };

  if (!includeKnowledgeGraph) {
    return enhancedContext;
  }

  // Initialize knowledge graph
  const graphService = getKnowledgeGraphService();
  if (!graphService.getGraph()) {
    graphService.initializeGraph(state);
  }

  // Get characters from previous chapter ending
  const previousChapter = state.chapters[state.chapters.length - 1];
  const charactersToInclude = previousChapter
    ? extractCharactersFromText(previousChapter.content.slice(-1000), state.characterCodex)
    : state.characterCodex.filter(c => c.isProtagonist).map(c => c.id);

  // Retrieve semantic context
  const retriever = getSemanticContextRetriever();
  const retrievedContext = retriever.retrieveContext(state, {
    characters: charactersToInclude,
    recentChapters: options.maxRecentChapters || 3,
    powerLevelChanges: includePowerProgression,
    relationships: includeRelationships,
    worldRules: true,
  });

  // Compile context
  const compiler = getContextCompiler();
  const compiledContext = compiler.compileContext(retrievedContext, {
    maxTokens: 2000,
    includePowerProgression,
    includeRelationships,
    includeWorldRules: true,
  });

  // Add compiled critical state
  enhancedContext.criticalState = compiledContext.criticalState;

  // Build power progression context
  if (includePowerProgression && retrievedContext.powerLevelProgression.length > 0) {
    enhancedContext.powerProgression = buildPowerProgressionContext(
      retrievedContext.powerLevelProgression,
      graphService,
      getPowerLevelSystem()
    );
  }

  // Build relationship network context
  if (includeRelationships && retrievedContext.relationships.length > 0) {
    enhancedContext.relationshipNetwork = buildRelationshipNetworkContext(
      retrievedContext.relationships,
      state
    );
  }

  // Add entity states
  enhancedContext.entityStates = charactersToInclude.map(charId => {
    const character = state.characterCodex.find(c => c.id === charId);
    if (!character) return null;

    const powerLevel = graphService.getCharacterPowerLevel(charId) || character.currentCultivation;
    const relationships = graphService.getCharacterRelationships(charId);

    return {
      entityId: character.id,
      entityType: 'character',
      currentState: {
        name: character.name,
        powerLevel,
        status: character.status,
        relationships: relationships.map(r => ({
          type: r.properties.type,
          targetId: r.targetId.replace('character_', ''),
        })),
      },
    };
  }).filter((s): s is NonNullable<typeof s> => s !== null);

  return enhancedContext;
}

/**
 * Build power progression context string
 */
function buildPowerProgressionContext(
  progressions: Array<{
    characterId: string;
    characterName: string;
    currentLevel: string;
    progression: string;
  }>,
  graphService: ReturnType<typeof getKnowledgeGraphService>,
  powerSystem: ReturnType<typeof getPowerLevelSystem>
): string {
  const sections: string[] = [];

  sections.push('[POWER PROGRESSION]');
  sections.push('');

  progressions.forEach(prog => {
    sections.push(`${prog.characterName}:`);
    sections.push(`  Current: ${prog.currentLevel}`);
    
    if (prog.progression) {
      sections.push(`  History: ${prog.progression}`);
    }

    // Get next expected stage
    const nextStage = powerSystem.getNextStage(prog.currentLevel);
    if (nextStage) {
      sections.push(`  Next Stage: ${nextStage}`);
    }

    sections.push('');
  });

  return sections.join('\n');
}

/**
 * Build relationship network context string
 */
function buildRelationshipNetworkContext(
  relationships: Array<{
    character1Id: string;
    character1Name: string;
    character2Id: string;
    character2Name: string;
    relationshipType: string;
    history: string;
  }>,
  state: NovelState
): string {
  const sections: string[] = [];

  sections.push('[ACTIVE RELATIONSHIPS]');
  sections.push('');

  relationships.forEach(rel => {
    sections.push(`${rel.character1Name} ↔ ${rel.character2Name}: ${rel.relationshipType}`);
    if (rel.history) {
      sections.push(`  ${rel.history.substring(0, 150)}`);
    }
    sections.push('');
  });

  return sections.join('\n');
}

/**
 * Extract character IDs from text
 */
function extractCharactersFromText(text: string, characters: NovelState['characterCodex']): string[] {
  const found: string[] = [];

  characters.forEach(char => {
    if (textContainsCharacterName(text, char.name)) {
      found.push(char.id);
    }
  });

  return found;
}

/**
 * Format enhanced context for prompt
 */
export function formatEnhancedContext(context: EnhancedPromptContext): string {
  const sections: string[] = [];

  // Add critical state first (highest priority)
  if (context.criticalState) {
    sections.push(context.criticalState);
    sections.push('');
  }

  // Add power progression
  if (context.powerProgression) {
    sections.push(context.powerProgression);
    sections.push('');
  }

  // Add relationship network
  if (context.relationshipNetwork) {
    sections.push(context.relationshipNetwork);
    sections.push('');
  }

  // Add continuity bridge if available
  if (context.continuityBridge) {
    sections.push(context.continuityBridge);
    sections.push('');
  }

  return sections.join('\n');
}
