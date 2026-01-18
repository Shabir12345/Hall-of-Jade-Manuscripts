/**
 * Power Level Progression Validator
 * 
 * Validates power level progression before chapter generation.
 * Ensures logical progression, no sudden jumps, and proper breakthrough documentation.
 */

import { NovelState, Character } from '../types';
import { getKnowledgeGraphService } from './knowledgeGraphService';
import { getPowerLevelSystem } from './powerLevelSystem';

export interface PowerProgressionWarning {
  characterId: string;
  characterName: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  suggestion: string;
  currentLevel: string;
  expectedLevel?: string;
  chaptersSinceLastChange: number;
}

export interface PowerProgressionReport {
  valid: boolean;
  warnings: PowerProgressionWarning[];
  summary: {
    totalCharacters: number;
    validated: number;
    withWarnings: number;
    withCriticalIssues: number;
  };
  recommendations: string[];
}

export class PowerProgressionValidator {
  /**
   * Validate power progression for characters that will appear
   */
  validateProgression(
    state: NovelState,
    characterIds: string[],
    nextChapterNumber: number
  ): PowerProgressionReport {
    const warnings: PowerProgressionWarning[] = [];
    const graphService = getKnowledgeGraphService();
    const powerSystem = getPowerLevelSystem();

    // Initialize graph if needed
    if (!graphService.getGraph()) {
      graphService.initializeGraph(state);
    }

    let validated = 0;
    let withWarnings = 0;
    let withCriticalIssues = 0;

    characterIds.forEach(characterId => {
      const character = state.characterCodex.find(c => c.id === characterId);
      if (!character) return;

      const progression = graphService.getPowerProgression(characterId);
      if (!progression || progression.progression.length === 0) {
        // No progression history - check if power level is set
        if (!character.currentCultivation || character.currentCultivation === 'Unknown') {
          warnings.push({
            characterId: character.id,
            characterName: character.name,
            severity: 'warning',
            message: `Character "${character.name}" has no power level progression tracked and no current power level set.`,
            suggestion: 'Set an initial power level for this character before generating the next chapter.',
            currentLevel: 'Unknown',
            chaptersSinceLastChange: 0,
          });
          withWarnings++;
        } else {
          validated++;
        }
        return;
      }

      const currentLevel = progression.currentLevel;
      const lastProgression = progression.progression[progression.progression.length - 1];
      const chaptersSinceChange = nextChapterNumber - lastProgression.chapterNumber;

      // Validate progression
      const validation = powerSystem.validateProgression(
        lastProgression.powerLevel,
        currentLevel,
        chaptersSinceChange,
        !!lastProgression.eventDescription
      );

      if (!validation.valid) {
        validation.issues.forEach(issue => {
          warnings.push({
            characterId: character.id,
            characterName: character.name,
            severity: 'critical',
            message: issue,
            suggestion: 'Review power level progression and ensure it follows established rules. Add breakthrough event if needed.',
            currentLevel,
            chaptersSinceLastChange,
          });
        });
        withCriticalIssues++;
      } else {
        validated++;
      }

      if (validation.warnings.length > 0) {
        validation.warnings.forEach(warning => {
          warnings.push({
            characterId: character.id,
            characterName: character.name,
            severity: 'warning',
            message: warning,
            suggestion: 'Consider adjusting power progression or adding justification.',
            currentLevel,
            chaptersSinceLastChange,
          });
        });
        withWarnings++;
      }

      // Check if power level is in context
      // This would be checked by context completeness checker
      // But we can warn if progression suggests a change might be needed
      if (chaptersSinceChange > 5 && lastProgression.progressionType !== 'stable') {
        const nextStage = powerSystem.getNextStage(currentLevel);
        if (nextStage) {
          warnings.push({
            characterId: character.id,
            characterName: character.name,
            severity: 'info',
            message: `Character "${character.name}" has been at ${currentLevel} for ${chaptersSinceChange} chapters. Consider progression to ${nextStage}.`,
            suggestion: `If character appears in next chapter, consider showing progression or adding a breakthrough event.`,
            currentLevel,
            expectedLevel: nextStage,
            chaptersSinceLastChange,
          });
        }
      }
    });

    // Generate recommendations
    const recommendations: string[] = [];

    if (withCriticalIssues > 0) {
      recommendations.push(`Fix ${withCriticalIssues} critical power progression issue(s) before generating.`);
    }

    if (withWarnings > 0) {
      recommendations.push(`Review ${withWarnings} power progression warning(s).`);
    }

    if (warnings.length === 0) {
      recommendations.push('All power progressions are valid. Ready for generation.');
    }

    return {
      valid: withCriticalIssues === 0,
      warnings,
      summary: {
        totalCharacters: characterIds.length,
        validated,
        withWarnings,
        withCriticalIssues,
      },
      recommendations,
    };
  }

  /**
   * Check if character's current power level is appropriate for next chapter
   */
  checkLevelAppropriateness(
    character: Character,
    nextChapterNumber: number,
    state: NovelState
  ): {
    appropriate: boolean;
    message?: string;
    suggestion?: string;
  } {
    const graphService = getKnowledgeGraphService();
    const progression = graphService.getPowerProgression(character.id);

    if (!progression || progression.progression.length === 0) {
      return {
        appropriate: true, // No history to compare
      };
    }

    const currentLevel = progression.currentLevel;
    const lastProgression = progression.progression[progression.progression.length - 1];
    const chaptersSinceChange = nextChapterNumber - lastProgression.chapterNumber;

    // If character hasn't progressed in many chapters, suggest progression
    if (chaptersSinceChange > 8) {
      const powerSystem = getPowerLevelSystem();
      const nextStage = powerSystem.getNextStage(currentLevel);
      
      if (nextStage) {
        return {
          appropriate: true,
          message: `Character has been at ${currentLevel} for ${chaptersSinceChange} chapters.`,
          suggestion: `Consider showing progression to ${nextStage} in the next chapter.`,
        };
      }
    }

    return {
      appropriate: true,
    };
  }
}

// Singleton instance
let validatorInstance: PowerProgressionValidator | null = null;

export function getPowerProgressionValidator(): PowerProgressionValidator {
  if (!validatorInstance) {
    validatorInstance = new PowerProgressionValidator();
  }
  return validatorInstance;
}
