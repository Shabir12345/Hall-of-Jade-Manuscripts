/**
 * Consistency System Enhancements
 * 
 * Additional improvements to strengthen logic and connections:
 * - Better power level parsing and validation
 * - Enhanced relationship tracking
 * - Improved context relevance scoring
 * - Cross-entity consistency checks
 */

import { NovelState, Character } from '../types';
import { getKnowledgeGraphService } from './knowledgeGraphService';
import { getPowerLevelSystem } from './powerLevelSystem';
import { getEntityStateTracker } from './entityStateTracker';

/**
 * Enhanced power level validation with better parsing
 */
export function validatePowerLevelWithContext(
  character: Character,
  mentionedLevel: string,
  chapterText: string,
  state: NovelState
): {
  valid: boolean;
  confidence: number;
  issues: string[];
  suggestions: string[];
} {
  const powerSystem = getPowerLevelSystem();
  const graphService = getKnowledgeGraphService();
  
  const issues: string[] = [];
  const suggestions: string[] = [];
  let confidence = 1.0;

  // Get current level from graph
  const currentLevel = graphService.getCharacterPowerLevel(character.id) || character.currentCultivation;
  
  if (!currentLevel || currentLevel === 'Unknown') {
    return {
      valid: true, // Can't validate if no baseline
      confidence: 0.5,
      issues: [],
      suggestions: ['Set an initial power level for this character'],
    };
  }

  // Parse both levels
  const parsedCurrent = powerSystem.parsePowerLevel(currentLevel);
  const parsedMentioned = powerSystem.parsePowerLevel(mentionedLevel);

  if (!parsedCurrent || !parsedMentioned) {
    issues.push('Unable to parse power levels for comparison');
    confidence = 0.3;
    return { valid: false, confidence, issues, suggestions };
  }

  // Check if levels match
  if (parsedCurrent.stageName === parsedMentioned.stageName) {
    // Same stage - check sub-stage progression
    if (parsedCurrent.subStage && parsedMentioned.subStage) {
      const subStageOrder: Record<string, number> = {
        'initial': 1, 'beginner': 1,
        'early': 2,
        'mid': 3, 'middle': 3,
        'late': 4, 'advanced': 4,
        'peak': 5, 'perfected': 5,
      };
      
      const currentOrder = subStageOrder[parsedCurrent.subStage.toLowerCase()] || 0;
      const mentionedOrder = subStageOrder[parsedMentioned.subStage.toLowerCase()] || 0;
      
      if (mentionedOrder < currentOrder) {
        issues.push(`Sub-stage regression: ${parsedCurrent.subStage} → ${parsedMentioned.subStage}`);
        confidence = 0.2;
      } else if (mentionedOrder > currentOrder + 1) {
        issues.push(`Rapid sub-stage progression: ${parsedCurrent.subStage} → ${parsedMentioned.subStage}`);
        suggestions.push('Ensure gradual progression is shown');
        confidence = 0.7;
      }
    }
    
    return { valid: issues.length === 0, confidence, issues, suggestions };
  }

  // Different stages - use full validation
  const comparison = powerSystem.comparePowerLevels(currentLevel, mentionedLevel);
  
  if (comparison > 0) {
    // Regression
    issues.push(`Power level regression: ${currentLevel} → ${mentionedLevel}`);
    
    // Check if regression is justified in text
    const regressionKeywords = ['injured', 'cursed', 'damaged', 'weakened', 'lost', 'sealed'];
    const hasJustification = regressionKeywords.some(keyword => 
      chapterText.toLowerCase().includes(keyword)
    );
    
    if (!hasJustification) {
      issues.push('Power regression not justified in chapter text');
      confidence = 0.1;
    } else {
      suggestions.push('Regression is justified but should be explicitly explained');
      confidence = 0.6;
    }
  } else if (comparison < 0) {
    // Progression
    const progression = graphService.getPowerProgression(character.id);
    if (progression && progression.progression.length > 0) {
      const lastProg = progression.progression[progression.progression.length - 1];
      const chaptersSince = state.chapters.length - lastProg.chapterNumber;
      
      const validation = powerSystem.validateProgression(
        lastProg.powerLevel,
        mentionedLevel,
        chaptersSince,
        false
      );
      
      if (!validation.valid) {
        issues.push(...validation.issues);
        confidence = 0.3;
      } else if (validation.warnings.length > 0) {
        suggestions.push(...validation.warnings);
        confidence = 0.8;
      }
    }
  }

  return {
    valid: issues.length === 0,
    confidence,
    issues,
    suggestions,
  };
}

/**
 * Enhanced relationship consistency check
 */
export function validateRelationshipConsistency(
  character1: Character,
  character2: Character,
  relationshipType: string,
  state: NovelState
): {
  consistent: boolean;
  issues: string[];
  suggestions: string[];
} {
  const issues: string[] = [];
  const suggestions: string[] = [];
  const graphService = getKnowledgeGraphService();

  // Check if relationship exists in graph
  const relationships = graphService.getCharacterRelationships(character1.id);
  const existingRel = relationships.find(r => 
    r.targetId === `character_${character2.id}`
  );

  if (existingRel) {
    const existingType = existingRel.properties.type;
    
    // Check for relationship type changes
    if (existingType !== relationshipType) {
      // Determine if change is logical
      const relationshipHierarchy: Record<string, string[]> = {
        'Enemy': ['Rival', 'Neutral', 'Ally'],
        'Rival': ['Neutral', 'Ally'],
        'Neutral': ['Ally', 'Rival'],
        'Ally': ['Neutral', 'Rival', 'Enemy'],
      };

      const validTransitions = relationshipHierarchy[existingType] || [];
      
      if (!validTransitions.includes(relationshipType)) {
        issues.push(
          `Relationship change may be too abrupt: ${existingType} → ${relationshipType}. ` +
          `Consider intermediate steps.`
        );
        suggestions.push('Show gradual relationship evolution in narrative');
      } else {
        suggestions.push(`Relationship evolution from ${existingType} to ${relationshipType} is logical`);
      }
    }
  }

  // Check bidirectional consistency
  const reverseRelationships = graphService.getCharacterRelationships(character2.id);
  const reverseRel = reverseRelationships.find(r => 
    r.targetId === `character_${character1.id}`
  );

  if (!reverseRel && relationshipType !== 'Unknown') {
    suggestions.push('Consider adding bidirectional relationship for consistency');
  }

  return {
    consistent: issues.length === 0,
    issues,
    suggestions,
  };
}

/**
 * Enhanced context relevance scoring
 */
export function calculateContextRelevance(
  entityId: string,
  entityType: 'character' | 'location' | 'item' | 'technique',
  previousChapterEnding: string,
  activePlotThreads: string[],
  state: NovelState
): number {
  let relevance = 0.0;

  // Check if entity appears in previous chapter ending
  const entity = entityType === 'character'
    ? state.characterCodex.find(c => c.id === entityId)
    : null;

  if (entity && previousChapterEnding.toLowerCase().includes(entity.name.toLowerCase())) {
    relevance += 0.4; // High relevance if in previous ending
  }

  // Check if entity is protagonist
  if (entity && entity.isProtagonist) {
    relevance += 0.3; // Protagonists always relevant
  }

  // Check if entity is mentioned in active plot threads
  const entityName = entity?.name || '';
  const mentionedInThreads = activePlotThreads.some(thread =>
    thread.toLowerCase().includes(entityName.toLowerCase())
  );
  
  if (mentionedInThreads) {
    relevance += 0.2;
  }

  // Check recent updates
  if (entity) {
    const stateTracker = getEntityStateTracker();
    const history = stateTracker.getEntityHistory('character', entityId);
    
    if (history.length > 0) {
      const lastUpdate = history[history.length - 1];
      const chaptersSinceUpdate = state.chapters.length - lastUpdate.chapterNumber;
      
      // More recent updates = higher relevance
      if (chaptersSinceUpdate <= 2) {
        relevance += 0.1;
      }
    }
  }

  return Math.min(1.0, relevance);
}

/**
 * Cross-entity consistency check
 */
export function checkCrossEntityConsistency(
  state: NovelState,
  chapterNumber: number
): {
  issues: Array<{
    type: string;
    severity: 'critical' | 'warning' | 'info';
    message: string;
    entities: string[];
  }>;
} {
  const issues: Array<{
    type: string;
    severity: 'critical' | 'warning' | 'info';
    message: string;
    entities: string[];
  }> = [];

  const graphService = getKnowledgeGraphService();
  const powerSystem = getPowerLevelSystem();

  // Check power level relationships between characters
  state.characterCodex.forEach(char1 => {
    const level1 = graphService.getCharacterPowerLevel(char1.id) || char1.currentCultivation;
    if (!level1 || level1 === 'Unknown') return;

    char1.relationships?.forEach(rel => {
      const char2 = state.characterCodex.find(c => c.id === rel.characterId);
      if (!char2) return;

      const level2 = graphService.getCharacterPowerLevel(char2.id) || char2.currentCultivation;
      if (!level2 || level2 === 'Unknown') return;

      const comparison = powerSystem.comparePowerLevels(level1, level2);

      // Check if relationship type matches power level difference
      if (rel.type === 'Enemy' && comparison < -2) {
        // Character 1 is much weaker than enemy
        issues.push({
          type: 'power_relationship_mismatch',
          severity: 'warning',
          message: `${char1.name} is significantly weaker than enemy ${char2.name}. Ensure conflict is realistic.`,
          entities: [char1.id, char2.id],
        });
      }

      if (rel.type === 'Ally' && Math.abs(comparison) > 3) {
        // Large power gap between allies
        issues.push({
          type: 'power_relationship_mismatch',
          severity: 'info',
          message: `Large power gap between allies ${char1.name} and ${char2.name}. Consider implications.`,
          entities: [char1.id, char2.id],
        });
      }
    });
  });

  return { issues };
}
