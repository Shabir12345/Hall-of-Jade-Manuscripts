/**
 * Auto-Correction System
 * 
 * Suggests auto-corrections for minor inconsistencies.
 * Presents corrections to user for approval.
 */

import { NovelState, Character, Chapter } from '../types';
import { ConsistencyIssue } from './postGenerationConsistencyChecker';
import { getKnowledgeGraphService } from './knowledgeGraphService';
import { getPowerLevelSystem } from './powerLevelSystem';

export interface AutoCorrection {
  issueId: string;
  type: 'power_level' | 'location' | 'status' | 'relationship';
  originalValue: any;
  suggestedValue: any;
  reason: string;
  confidence: number; // 0-1
  action: 'update' | 'add' | 'remove';
  entityId: string;
  entityName: string;
}

export interface CorrectionResult {
  applied: AutoCorrection[];
  rejected: AutoCorrection[];
  requiresApproval: AutoCorrection[];
}

export class ConsistencyAutoCorrector {
  /**
   * Generate auto-corrections for issues
   */
  generateCorrections(
    state: NovelState,
    issues: ConsistencyIssue[]
  ): AutoCorrection[] {
    const corrections: AutoCorrection[] = [];
    const graphService = getKnowledgeGraphService();
    const powerSystem = getPowerLevelSystem();

    issues.forEach((issue, index) => {
      // Only suggest corrections for certain types
      if (issue.severity === 'critical' || issue.confidence < 0.7) {
        return; // Skip critical issues or low-confidence issues
      }

      switch (issue.type) {
        case 'power_level_mismatch':
        case 'sudden_jump':
          if (issue.entityId && issue.entityName) {
            const character = state.characterCodex.find(c => c.id === issue.entityId);
            if (character) {
              const currentLevel = graphService.getCharacterPowerLevel(character.id) || 
                                  character.currentCultivation;
              
              // Suggest keeping current level if extraction shows higher level without justification
              corrections.push({
                issueId: `issue_${index}`,
                type: 'power_level',
                originalValue: issue.evidence[1] || 'unknown',
                suggestedValue: currentLevel,
                reason: `Maintain current power level "${currentLevel}" to avoid sudden progression. Add breakthrough event if progression is intended.`,
                confidence: 0.8,
                action: 'update',
                entityId: character.id,
                entityName: character.name,
              });
            }
          }
          break;

        case 'character_state_inconsistency':
          if (issue.entityId && issue.entityName) {
            const character = state.characterCodex.find(c => c.id === issue.entityId);
            if (character && issue.message.includes('Deceased')) {
              // Suggest keeping deceased status unless resurrection is explicit
              corrections.push({
                issueId: `issue_${index}`,
                type: 'status',
                originalValue: 'Alive',
                suggestedValue: 'Deceased',
                reason: 'Character was marked as Deceased. Keep this status unless resurrection is explicitly described.',
                confidence: 0.9,
                action: 'update',
                entityId: character.id,
                entityName: character.name,
              });
            }
          }
          break;

        case 'regression':
          if (issue.entityId && issue.entityName) {
            const character = state.characterCodex.find(c => c.id === issue.entityId);
            if (character) {
              const currentLevel = graphService.getCharacterPowerLevel(character.id) || 
                                  character.currentCultivation;
              
              // Suggest correcting regression
              corrections.push({
                issueId: `issue_${index}`,
                type: 'power_level',
                originalValue: issue.evidence[1] || 'unknown',
                suggestedValue: currentLevel,
                reason: 'Power level regression detected. Correct to maintain current level unless regression is explicitly justified.',
                confidence: 0.85,
                action: 'update',
                entityId: character.id,
                entityName: character.name,
              });
            }
          }
          break;
      }
    });

    return corrections;
  }

  /**
   * Apply corrections (with user approval for critical ones)
   */
  applyCorrections(
    state: NovelState,
    corrections: AutoCorrection[],
    autoApproveLowRisk: boolean = true
  ): CorrectionResult {
    const result: CorrectionResult = {
      applied: [],
      rejected: [],
      requiresApproval: [],
    };

    corrections.forEach(correction => {
      // Auto-approve low-risk corrections
      if (autoApproveLowRisk && correction.confidence >= 0.9 && correction.type !== 'status') {
        this.applyCorrection(state, correction);
        result.applied.push(correction);
      } else {
        // Require approval for others
        result.requiresApproval.push(correction);
      }
    });

    return result;
  }

  /**
   * Apply a single correction
   */
  private applyCorrection(state: NovelState, correction: AutoCorrection): void {
    switch (correction.type) {
      case 'power_level':
        const character = state.characterCodex.find(c => c.id === correction.entityId);
        if (character) {
          character.currentCultivation = correction.suggestedValue;
          
          // Update knowledge graph
          const graphService = getKnowledgeGraphService();
          const currentChapter = state.chapters[state.chapters.length - 1];
          if (currentChapter) {
            graphService.updatePowerLevel(
              character.id,
              correction.suggestedValue,
              currentChapter.id,
              currentChapter.number,
              'gradual',
              'Auto-corrected to maintain consistency'
            );
          }
        }
        break;

      case 'status':
        const char = state.characterCodex.find(c => c.id === correction.entityId);
        if (char) {
          char.status = correction.suggestedValue as 'Alive' | 'Deceased' | 'Unknown';
        }
        break;
    }
  }

  /**
   * Format corrections for user review
   */
  formatCorrectionsForReview(corrections: AutoCorrection[]): string {
    if (corrections.length === 0) {
      return 'No corrections suggested.';
    }

    const sections: string[] = [];
    sections.push(`Found ${corrections.length} suggested correction(s):\n`);

    corrections.forEach((correction, index) => {
      sections.push(`${index + 1}. ${correction.entityName} (${correction.type})`);
      sections.push(`   Current: ${correction.originalValue}`);
      sections.push(`   Suggested: ${correction.suggestedValue}`);
      sections.push(`   Reason: ${correction.reason}`);
      sections.push(`   Confidence: ${Math.round(correction.confidence * 100)}%`);
      sections.push('');
    });

    return sections.join('\n');
  }
}

// Singleton instance
let correctorInstance: ConsistencyAutoCorrector | null = null;

export function getConsistencyAutoCorrector(): ConsistencyAutoCorrector {
  if (!correctorInstance) {
    correctorInstance = new ConsistencyAutoCorrector();
  }
  return correctorInstance;
}
