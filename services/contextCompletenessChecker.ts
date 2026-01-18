/**
 * Context Completeness Checker
 * 
 * Verifies that context being sent to LLM includes all necessary information:
 * - Current power level for each character that will appear
 * - Current relationship states
 * - Relevant world rules
 * - Recent progression milestones
 */

import { NovelState, Character } from '../types';
import { CompiledContext } from './contextCompiler';
import { RetrievedContext } from './semanticContextRetriever';

export interface CompletenessCheck {
  characterId: string;
  characterName: string;
  checks: {
    powerLevel: boolean;
    location: boolean;
    status: boolean;
    activeRelationships: boolean;
    items: boolean;
    techniques: boolean;
  };
  missing: string[];
  warnings: string[];
}

export interface CompletenessReport {
  complete: boolean;
  characterChecks: CompletenessCheck[];
  summary: {
    totalCharacters: number;
    completeCharacters: number;
    missingPowerLevels: number;
    missingRelationships: number;
    missingWorldRules: number;
  };
  recommendations: string[];
}

export class ContextCompletenessChecker {
  /**
   * Check context completeness for characters
   */
  checkCompleteness(
    state: NovelState,
    compiledContext: CompiledContext,
    retrievedContext: RetrievedContext,
    charactersToCheck: string[] // Character IDs
  ): CompletenessReport {
    const characterChecks: CompletenessCheck[] = [];
    let completeCharacters = 0;
    let missingPowerLevels = 0;
    let missingRelationships = 0;

    charactersToCheck.forEach(characterId => {
      const character = state.characterCodex.find(c => c.id === characterId);
      if (!character) return;

      const check: CompletenessCheck = {
        characterId: character.id,
        characterName: character.name,
        checks: {
          powerLevel: false,
          location: false,
          status: false,
          activeRelationships: false,
          items: false,
          techniques: false,
        },
        missing: [],
        warnings: [],
      };

      const contextText = compiledContext.criticalState.toLowerCase();
      const charNameLower = character.name.toLowerCase();

      // Check power level
      if (character.currentCultivation && contextText.includes(charNameLower)) {
        // Check if power level is mentioned near character name
        const charIndex = contextText.indexOf(charNameLower);
        const contextAroundChar = contextText.substring(
          Math.max(0, charIndex - 200),
          Math.min(contextText.length, charIndex + 200)
        );
        
        if (contextAroundChar.includes('power') || 
            contextAroundChar.includes('cultivation') ||
            contextAroundChar.includes(character.currentCultivation.toLowerCase())) {
          check.checks.powerLevel = true;
        } else {
          check.missing.push('Power level not clearly stated in context');
          missingPowerLevels++;
        }
      } else if (!character.currentCultivation) {
        check.warnings.push('Character has no power level set');
      } else {
        check.checks.powerLevel = true;
      }

      // Check status
      if (contextText.includes(charNameLower) && 
          (contextText.includes(`status: ${character.status.toLowerCase()}`) ||
           contextText.includes(character.status.toLowerCase()))) {
        check.checks.status = true;
      } else {
        check.missing.push('Status not clearly stated');
      }

      // Check relationships
      const characterRelationships = retrievedContext.relationships.filter(
        r => r.character1Id === characterId || r.character2Id === characterId
      );
      
      if (characterRelationships.length > 0) {
        check.checks.activeRelationships = true;
      } else if (character.relationships && character.relationships.length > 0) {
        check.missing.push('Active relationships not included in context');
        missingRelationships++;
      }

      // Check items
      if (character.itemPossessions && character.itemPossessions.length > 0) {
        const activeItems = character.itemPossessions.filter(p => p.status === 'active');
        if (activeItems.length > 0) {
          const hasItemsInContext = activeItems.some(p => {
            const item = state.novelItems?.find(i => i.id === p.itemId);
            return item && contextText.includes(item.name.toLowerCase());
          });
          check.checks.items = hasItemsInContext;
          if (!hasItemsInContext) {
            check.warnings.push('Active items not included in context');
          }
        }
      }

      // Check techniques
      if (character.techniqueMasteries && character.techniqueMasteries.length > 0) {
        const activeTechniques = character.techniqueMasteries.filter(m => m.status === 'active');
        if (activeTechniques.length > 0) {
          const hasTechniquesInContext = activeTechniques.some(m => {
            const technique = state.novelTechniques?.find(t => t.id === m.techniqueId);
            return technique && contextText.includes(technique.name.toLowerCase());
          });
          check.checks.techniques = hasTechniquesInContext;
          if (!hasTechniquesInContext) {
            check.warnings.push('Active techniques not included in context');
          }
        }
      }

      // Check location (basic - would need location tracking)
      check.checks.location = true; // Placeholder

      // Determine if character is complete
      const allCriticalChecks = check.checks.powerLevel && 
                                check.checks.status && 
                                check.checks.activeRelationships;
      
      if (allCriticalChecks && check.missing.length === 0) {
        completeCharacters++;
      }

      characterChecks.push(check);
    });

    // Generate recommendations
    const recommendations: string[] = [];
    
    if (missingPowerLevels > 0) {
      recommendations.push(`Add power levels for ${missingPowerLevels} character(s) to context.`);
    }
    
    if (missingRelationships > 0) {
      recommendations.push(`Include relationship context for ${missingRelationships} character(s).`);
    }

    if (compiledContext.worldRules.length === 0) {
      recommendations.push('Include relevant world rules in context.');
    }

    if (compiledContext.recentContext.length === 0) {
      recommendations.push('Include recent chapter context for continuity.');
    }

    return {
      complete: completeCharacters === charactersToCheck.length && 
                missingPowerLevels === 0 && 
                missingRelationships === 0,
      characterChecks,
      summary: {
        totalCharacters: charactersToCheck.length,
        completeCharacters,
        missingPowerLevels,
        missingRelationships,
        missingWorldRules: compiledContext.worldRules.length === 0 ? 1 : 0,
      },
      recommendations,
    };
  }

  /**
   * Generate checklist for a character
   */
  generateCharacterChecklist(character: Character, state: NovelState): string[] {
    const checklist: string[] = [];

    checklist.push(`Character: ${character.name}`);
    checklist.push(`✓ Power Level: ${character.currentCultivation || 'Not set'}`);
    checklist.push(`✓ Status: ${character.status}`);
    checklist.push(`✓ Location: ${state.currentRealmId ? 'Current realm' : 'Not set'}`);
    
    if (character.relationships && character.relationships.length > 0) {
      checklist.push(`✓ Relationships: ${character.relationships.length} active`);
    } else {
      checklist.push(`⚠ Relationships: None tracked`);
    }

    if (character.itemPossessions && character.itemPossessions.length > 0) {
      const activeItems = character.itemPossessions.filter(p => p.status === 'active');
      checklist.push(`✓ Items: ${activeItems.length} active`);
    }

    if (character.techniqueMasteries && character.techniqueMasteries.length > 0) {
      const activeTechniques = character.techniqueMasteries.filter(m => m.status === 'active');
      checklist.push(`✓ Techniques: ${activeTechniques.length} active`);
    }

    return checklist;
  }
}

// Singleton instance
let checkerInstance: ContextCompletenessChecker | null = null;

export function getContextCompletenessChecker(): ContextCompletenessChecker {
  if (!checkerInstance) {
    checkerInstance = new ContextCompletenessChecker();
  }
  return checkerInstance;
}
