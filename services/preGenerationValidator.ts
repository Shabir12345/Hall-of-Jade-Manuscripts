/**
 * Pre-Generation Validator
 * 
 * Validates state before building prompt for chapter generation.
 * Ensures all characters, power levels, relationships, and world state are consistent.
 */

import { NovelState, Chapter, Character } from '../types';
import { getKnowledgeGraphService } from './knowledgeGraphService';
import { getEntityStateTracker } from './entityStateTracker';
import { getPowerLevelSystem } from './powerLevelSystem';
import { getSemanticContextRetriever } from './semanticContextRetriever';

export interface ValidationIssue {
  type: 'missing_state' | 'inconsistent_power' | 'missing_relationship' | 'world_rule_violation' | 'outdated_data';
  severity: 'critical' | 'warning' | 'info';
  entityType: 'character' | 'location' | 'relationship' | 'power_level' | 'world_rule';
  entityId?: string;
  entityName?: string;
  message: string;
  suggestion: string;
  autoFixable: boolean;
  autoFix?: () => void;
}

export interface ValidationReport {
  valid: boolean;
  issues: ValidationIssue[];
  summary: {
    total: number;
    critical: number;
    warnings: number;
    info: number;
  };
  contextCompleteness: {
    charactersReady: number;
    charactersTotal: number;
    powerLevelsReady: number;
    relationshipsReady: number;
  };
}

export class PreGenerationValidator {
  /**
   * Validate state before chapter generation
   */
  validateBeforeGeneration(state: NovelState, nextChapterNumber: number): ValidationReport {
    const issues: ValidationIssue[] = [];
    const graphService = getKnowledgeGraphService();
    const stateTracker = getEntityStateTracker();
    const powerSystem = getPowerLevelSystem();

    // Initialize graph if needed
    if (!graphService.getGraph()) {
      graphService.initializeGraph(state);
    }

    // Get previous chapter
    const previousChapter = state.chapters[state.chapters.length - 1];
    
    // Extract characters from previous chapter ending (enhanced extraction)
    const charactersInEnding = previousChapter
      ? this.extractCharactersFromText(previousChapter.content.slice(-1500), state.characterCodex) // Increased from 1000 to 1500
      : [];
    
    // Also include characters mentioned in the last scene
    if (previousChapter && previousChapter.scenes && previousChapter.scenes.length > 0) {
      const lastScene = previousChapter.scenes[previousChapter.scenes.length - 1];
      const sceneCharacters = this.extractCharactersFromText(
        lastScene.content || lastScene.summary || '',
        state.characterCodex
      );
      charactersInEnding.push(...sceneCharacters.filter(id => !charactersInEnding.includes(id)));
    }

    // Validate each character that will likely appear
    const charactersToValidate = charactersInEnding.length > 0
      ? charactersInEnding
      : state.characterCodex.filter(c => c.isProtagonist).map(c => c.id);

    const contextCompleteness = {
      charactersReady: 0,
      charactersTotal: charactersToValidate.length,
      powerLevelsReady: 0,
      relationshipsReady: 0,
    };

    charactersToValidate.forEach(characterId => {
      const character = state.characterCodex.find(c => c.id === characterId);
      if (!character) return;

      // Check if character state is current
      const currentState = stateTracker.getCurrentState('character', characterId);
      if (!currentState) {
        issues.push({
          type: 'missing_state',
          severity: 'critical',
          entityType: 'character',
          entityId: characterId,
          entityName: character.name,
          message: `Character "${character.name}" has no tracked state. State tracking may be missing.`,
          suggestion: 'Ensure entity state tracker is initialized and tracking this character.',
          autoFixable: false,
        });
      } else {
        contextCompleteness.charactersReady++;
      }

      // Check power level is current
      const graphPowerLevel = graphService.getCharacterPowerLevel(characterId);
      const characterPowerLevel = character.currentCultivation;
      
      if (!graphPowerLevel && !characterPowerLevel) {
        issues.push({
          type: 'missing_state',
          severity: 'warning',
          entityType: 'power_level',
          entityId: characterId,
          entityName: character.name,
          message: `Character "${character.name}" has no power level set.`,
          suggestion: 'Set a power level for this character before generating the next chapter.',
          autoFixable: false,
        });
      } else {
        contextCompleteness.powerLevelsReady++;
      }

      // Validate power level progression
      const progression = graphService.getPowerProgression(characterId);
      if (progression && progression.progression.length > 0) {
        const lastProgression = progression.progression[progression.progression.length - 1];
        const chaptersSinceChange = nextChapterNumber - lastProgression.chapterNumber;
        
        const validation = powerSystem.validateProgression(
          lastProgression.powerLevel,
          progression.currentLevel,
          chaptersSinceChange,
          !!lastProgression.eventDescription
        );

        if (!validation.valid) {
          validation.issues.forEach(issue => {
            issues.push({
              type: 'inconsistent_power',
              severity: 'critical',
              entityType: 'power_level',
              entityId: characterId,
              entityName: character.name,
              message: issue,
              suggestion: 'Review power level progression and ensure it follows established rules.',
              autoFixable: false,
            });
          });
        }

        validation.warnings.forEach(warning => {
          issues.push({
            type: 'inconsistent_power',
            severity: 'warning',
            entityType: 'power_level',
            entityId: characterId,
            entityName: character.name,
            message: warning,
            suggestion: 'Consider adjusting power progression or adding justification.',
            autoFixable: false,
          });
        });
      }

      // Check relationships are current
      const relationships = graphService.getCharacterRelationships(characterId);
      if (relationships.length > 0) {
        contextCompleteness.relationshipsReady += relationships.length;
      }
    });

    // Validate world state consistency
    const currentRealm = state.realms.find(r => r.id === state.currentRealmId);
    if (!currentRealm) {
      issues.push({
        type: 'missing_state',
        severity: 'critical',
        entityType: 'location',
        message: 'No current realm is set. World state may be inconsistent.',
        suggestion: 'Set a current realm before generating the next chapter.',
        autoFixable: false,
      });
    }

    // Check for outdated data
    const outdatedCharacters = state.characterCodex.filter(char => {
      if (!char.lastUpdatedByChapterId) return false;
      const lastChapter = state.chapters.find(c => c.id === char.lastUpdatedByChapterId);
      if (!lastChapter) return false;
      return nextChapterNumber - lastChapter.number > 10;
    });

    outdatedCharacters.forEach(char => {
      issues.push({
        type: 'outdated_data',
        severity: 'info',
        entityType: 'character',
        entityId: char.id,
        entityName: char.name,
        message: `Character "${char.name}" hasn't been updated in ${nextChapterNumber - (state.chapters.find(c => c.id === char.lastUpdatedByChapterId)?.number || 0)} chapters.`,
        suggestion: 'Consider updating character state if they appear in the next chapter.',
        autoFixable: false,
      });
    });

    // Calculate summary
    const critical = issues.filter(i => i.severity === 'critical').length;
    const warnings = issues.filter(i => i.severity === 'warning').length;
    const info = issues.filter(i => i.severity === 'info').length;

    return {
      valid: critical === 0,
      issues,
      summary: {
        total: issues.length,
        critical,
        warnings,
        info,
      },
      contextCompleteness,
    };
  }

  /**
   * Auto-fix minor issues
   */
  autoFixIssues(issues: ValidationIssue[]): {
    fixed: ValidationIssue[];
    remaining: ValidationIssue[];
  } {
    const fixed: ValidationIssue[] = [];
    const remaining: ValidationIssue[] = [];

    issues.forEach(issue => {
      if (issue.autoFixable && issue.autoFix) {
        try {
          issue.autoFix();
          fixed.push(issue);
        } catch (error) {
          remaining.push(issue);
        }
      } else {
        remaining.push(issue);
      }
    });

    return { fixed, remaining };
  }

  /**
   * Extract character IDs from text
   */
  private extractCharactersFromText(text: string, characters: Character[]): string[] {
    const found: string[] = [];
    const textLower = text.toLowerCase();

    characters.forEach(char => {
      if (textLower.includes(char.name.toLowerCase())) {
        found.push(char.id);
      }
    });

    return found;
  }
}

// Singleton instance
let validatorInstance: PreGenerationValidator | null = null;

export function getPreGenerationValidator(): PreGenerationValidator {
  if (!validatorInstance) {
    validatorInstance = new PreGenerationValidator();
  }
  return validatorInstance;
}
