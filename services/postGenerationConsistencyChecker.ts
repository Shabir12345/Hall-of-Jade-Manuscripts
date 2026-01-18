/**
 * Post-Generation Consistency Checker
 * 
 * After chapter generation, extracts and validates:
 * - Power levels mentioned match current state
 * - Character states are consistent
 * - Relationships are respected
 * - World rules are followed
 * Compares extracted data against knowledge graph.
 */

import { NovelState, Chapter, Character } from '../types';
import { PostChapterExtraction } from './aiService';
import { getKnowledgeGraphService } from './knowledgeGraphService';
import { getPowerLevelSystem } from './powerLevelSystem';
import { getEntityStateTracker } from './entityStateTracker';

export interface ConsistencyIssue {
  type: 'power_level_mismatch' | 'character_state_inconsistency' | 'relationship_violation' | 
        'world_rule_violation' | 'regression' | 'sudden_jump';
  severity: 'critical' | 'warning' | 'info';
  entityId?: string;
  entityName?: string;
  chapterNumber: number;
  message: string;
  evidence: string[];
  suggestion: string;
  confidence: number; // 0-1
}

export interface ConsistencyReport {
  valid: boolean;
  issues: ConsistencyIssue[];
  summary: {
    total: number;
    critical: number;
    warnings: number;
    info: number;
    overallScore: number; // 0-100
  };
  recommendations: string[];
}

export class PostGenerationConsistencyChecker {
  /**
   * Check consistency after chapter generation
   */
  checkConsistency(
    state: NovelState,
    newChapter: Chapter,
    extraction: PostChapterExtraction
  ): ConsistencyReport {
    const issues: ConsistencyIssue[] = [];
    const graphService = getKnowledgeGraphService();
    const powerSystem = getPowerLevelSystem();
    const stateTracker = getEntityStateTracker();

    // Initialize graph if needed
    if (!graphService.getGraph()) {
      graphService.initializeGraph(state);
    }

    // Check character updates
    if (extraction.characterUpserts) {
      extraction.characterUpserts.forEach(upsert => {
        const character = state.characterCodex.find(c => 
          c.name.toLowerCase() === upsert.name.toLowerCase()
        );

        if (!character) {
          // New character - no consistency issues
          return;
        }

        // Check power level consistency
        if (upsert.set?.currentCultivation) {
          const extractedLevel = upsert.set.currentCultivation;
          const currentLevel = graphService.getCharacterPowerLevel(character.id) || 
                              character.currentCultivation;

          if (currentLevel && currentLevel !== 'Unknown') {
            const comparison = powerSystem.comparePowerLevels(extractedLevel, currentLevel);

            if (comparison < 0) {
              // Regression detected - check if justified
              const chapterText = (newChapter.content || newChapter.summary || '').toLowerCase();
              const regressionKeywords = [
                'injured', 'wounded', 'hurt', 'damaged',
                'cursed', 'sealed', 'suppressed',
                'lost', 'depleted', 'exhausted',
                'weakened', 'drained', 'broken',
                'cultivation damage', 'meridian damage', 'dantian damage'
              ];
              
              const hasJustification = regressionKeywords.some(keyword => 
                chapterText.includes(keyword)
              );
              
              issues.push({
                type: 'regression',
                severity: hasJustification ? 'warning' : 'critical',
                entityId: character.id,
                entityName: character.name,
                chapterNumber: newChapter.number,
                message: `Power level regression detected: ${character.name} went from ${currentLevel} to ${extractedLevel}.`,
                evidence: [
                  `Previous level: ${currentLevel}`,
                  `Extracted level: ${extractedLevel}`,
                  hasJustification ? 'Regression appears to be justified in chapter text' : 'No justification found in chapter text',
                ],
                suggestion: hasJustification 
                  ? 'Regression is justified but should be explicitly explained and temporary.'
                  : 'Power levels should not regress unless explicitly justified (e.g., injury, curse, cultivation damage).',
                confidence: hasJustification ? 0.7 : 0.9,
              });
            } else if (comparison > 0) {
              // Progression - check if it's realistic
              const progression = graphService.getPowerProgression(character.id);
              if (progression && progression.progression.length > 0) {
                const lastProgression = progression.progression[progression.progression.length - 1];
                const chaptersSinceChange = newChapter.number - lastProgression.chapterNumber;

                const validation = powerSystem.validateProgression(
                  lastProgression.powerLevel,
                  extractedLevel,
                  chaptersSinceChange,
                  false // We'll check if breakthrough is mentioned
                );

                if (!validation.valid) {
                  validation.issues.forEach(issue => {
                    issues.push({
                      type: 'sudden_jump',
                      severity: 'critical',
                      entityId: character.id,
                      entityName: character.name,
                      chapterNumber: newChapter.number,
                      message: issue,
                      evidence: [
                        `Previous: ${lastProgression.powerLevel} (Ch ${lastProgression.chapterNumber})`,
                        `New: ${extractedLevel} (Ch ${newChapter.number})`,
                        `Chapters since last change: ${chaptersSinceChange}`,
                      ],
                      suggestion: 'Add a breakthrough event or slow down the progression.',
                      confidence: 0.85,
                    });
                  });
                }

                validation.warnings.forEach(warning => {
                  issues.push({
                    type: 'sudden_jump',
                    severity: 'warning',
                    entityId: character.id,
                    entityName: character.name,
                    chapterNumber: newChapter.number,
                    message: warning,
                    evidence: [
                      `Previous: ${lastProgression.powerLevel}`,
                      `New: ${extractedLevel}`,
                    ],
                    suggestion: 'Ensure progression is well-justified in the narrative.',
                    confidence: 0.7,
                  });
                });
              }
            }
          }
        }

        // Check status consistency
        if (upsert.set?.status) {
          const extractedStatus = upsert.set.status;
          const currentStatus = character.status;

          if (currentStatus === 'Deceased' && extractedStatus !== 'Deceased') {
            issues.push({
              type: 'character_state_inconsistency',
              severity: 'critical',
              entityId: character.id,
              entityName: character.name,
              chapterNumber: newChapter.number,
              message: `Character "${character.name}" was marked as Deceased but extraction shows status "${extractedStatus}".`,
              evidence: [
                `Previous status: ${currentStatus}`,
                `Extracted status: ${extractedStatus}`,
              ],
              suggestion: 'Either this is a resurrection scene (which should be explicit) or the status update is incorrect.',
              confidence: 0.95,
            });
          }
        }

        // Check relationship consistency
        if (upsert.relationships && upsert.relationships.length > 0) {
          upsert.relationships.forEach(rel => {
            const targetChar = state.characterCodex.find(c =>
              c.name.toLowerCase() === rel.targetName.toLowerCase()
            );

            if (targetChar) {
              // Check if relationship already exists and is consistent
              const existingRel = character.relationships.find(r => r.characterId === targetChar.id);
              
              if (existingRel && existingRel.type !== rel.type) {
                issues.push({
                  type: 'relationship_violation',
                  severity: 'warning',
                  entityId: character.id,
                  entityName: character.name,
                  chapterNumber: newChapter.number,
                  message: `Relationship between "${character.name}" and "${targetChar.name}" changed from "${existingRel.type}" to "${rel.type}".`,
                  evidence: [
                    `Previous: ${existingRel.type}`,
                    `New: ${rel.type}`,
                  ],
                  suggestion: 'Ensure relationship changes are gradual and well-justified in the narrative.',
                  confidence: 0.8,
                });
              }
            }
          });
        }
      });
    }

    // Check world rule violations (basic - would need more sophisticated checking)
    if (extraction.worldEntryUpserts) {
      extraction.worldEntryUpserts.forEach(entry => {
        // Check if entry contradicts existing world rules
        const existingEntry = state.worldBible.find(e =>
          e.title.toLowerCase() === entry.title.toLowerCase() &&
          e.category === entry.category
        );

        if (existingEntry && existingEntry.content !== entry.content) {
          // Check for contradictions (simplified)
          const contradictions = this.detectWorldRuleContradictions(
            existingEntry.content,
            entry.content
          );

          if (contradictions.length > 0) {
            issues.push({
              type: 'world_rule_violation',
              severity: 'warning',
              chapterNumber: newChapter.number,
              message: `World entry "${entry.title}" may contradict existing rules.`,
              evidence: contradictions,
              suggestion: 'Review world entry for consistency with established rules.',
              confidence: 0.6,
            });
          }
        }
      });
    }

    // Calculate summary
    const critical = issues.filter(i => i.severity === 'critical').length;
    const warnings = issues.filter(i => i.severity === 'warning').length;
    const info = issues.filter(i => i.severity === 'info').length;

    // Calculate overall score
    const criticalPenalty = critical * 20;
    const warningPenalty = warnings * 5;
    const infoPenalty = info * 1;
    const overallScore = Math.max(0, 100 - criticalPenalty - warningPenalty - infoPenalty);

    // Generate recommendations
    const recommendations: string[] = [];

    if (critical > 0) {
      recommendations.push(`Address ${critical} critical consistency issue(s) immediately.`);
    }

    if (warnings > 0) {
      recommendations.push(`Review ${warnings} warning(s) to maintain story coherence.`);
    }

    if (overallScore >= 90) {
      recommendations.push('Excellent consistency! The chapter maintains good continuity.');
    } else if (overallScore >= 75) {
      recommendations.push('Good consistency with minor issues to review.');
    } else if (overallScore >= 60) {
      recommendations.push('Moderate consistency issues detected. Review recommended.');
    } else {
      recommendations.push('Significant consistency issues found. Review and fix before continuing.');
    }

    return {
      valid: critical === 0,
      issues,
      summary: {
        total: issues.length,
        critical,
        warnings,
        info,
        overallScore,
      },
      recommendations,
    };
  }

  /**
   * Detect contradictions in world rules (simplified)
   */
  private detectWorldRuleContradictions(existing: string, newContent: string): string[] {
    const contradictions: string[] = [];

    // Simple keyword-based contradiction detection
    // This is a simplified version - could be enhanced with NLP
    const existingLower = existing.toLowerCase();
    const newLower = newContent.toLowerCase();

    // Check for direct negations
    const negationPatterns = [
      { positive: 'can', negative: 'cannot' },
      { positive: 'allows', negative: 'forbids' },
      { positive: 'requires', negative: 'prohibits' },
    ];

    negationPatterns.forEach(pattern => {
      if (existingLower.includes(pattern.positive) && newLower.includes(pattern.negative)) {
        contradictions.push(`Contradiction detected: "${pattern.positive}" vs "${pattern.negative}"`);
      }
    });

    return contradictions;
  }
}

// Singleton instance
let checkerInstance: PostGenerationConsistencyChecker | null = null;

export function getPostGenerationConsistencyChecker(): PostGenerationConsistencyChecker {
  if (!checkerInstance) {
    checkerInstance = new PostGenerationConsistencyChecker();
  }
  return checkerInstance;
}
