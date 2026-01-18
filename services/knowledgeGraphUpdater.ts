/**
 * Knowledge Graph Updater
 * 
 * Updates knowledge graph after chapter extraction.
 * Adds new entities, updates states, creates/updates relationships,
 * and updates power level progression timeline.
 */

import { NovelState, Chapter, Character } from '../types';
import { PostChapterExtraction } from './aiService';
import { getKnowledgeGraphService } from './knowledgeGraphService';
import { getEntityStateTracker } from './entityStateTracker';
import { getPowerLevelSystem } from './powerLevelSystem';

export interface GraphUpdateResult {
  entitiesAdded: number;
  entitiesUpdated: number;
  relationshipsCreated: number;
  relationshipsUpdated: number;
  powerLevelsUpdated: number;
  conflicts: Array<{
    type: string;
    entityId: string;
    message: string;
  }>;
}

export class KnowledgeGraphUpdater {
  /**
   * Update knowledge graph after chapter extraction
   */
  updateGraph(
    state: NovelState,
    chapter: Chapter,
    extraction: PostChapterExtraction
  ): GraphUpdateResult {
    const graphService = getKnowledgeGraphService();
    const stateTracker = getEntityStateTracker();
    const powerSystem = getPowerLevelSystem();

    // Initialize graph if needed
    if (!graphService.getGraph()) {
      graphService.initializeGraph(state);
    }

    const result: GraphUpdateResult = {
      entitiesAdded: 0,
      entitiesUpdated: 0,
      relationshipsCreated: 0,
      relationshipsUpdated: 0,
      powerLevelsUpdated: 0,
      conflicts: [],
    };

    // Update characters
    if (extraction.characterUpserts) {
      extraction.characterUpserts.forEach(upsert => {
        const existingChar = state.characterCodex.find(c =>
          c.name.toLowerCase() === upsert.name.toLowerCase()
        );

        if (existingChar) {
          // Update existing character
          const previousChar = { ...existingChar };
          
          // Update power level if changed
          if (upsert.set?.currentCultivation) {
            const newLevel = upsert.set.currentCultivation;
            const currentLevel = graphService.getCharacterPowerLevel(existingChar.id) ||
                               existingChar.currentCultivation;

            if (newLevel !== currentLevel && currentLevel !== 'Unknown') {
              // Determine progression type (enhanced logic)
              const comparison = powerSystem.comparePowerLevels(newLevel, currentLevel);
              let progressionType: 'breakthrough' | 'gradual' | 'regression' | 'stable' = 'stable';

              if (comparison < 0) {
                progressionType = 'regression';
              } else if (comparison > 0) {
                // Check if it's a stage jump (breakthrough) or gradual
                const parsedCurrent = powerSystem.parsePowerLevel(currentLevel);
                const parsedNew = powerSystem.parsePowerLevel(newLevel);
                
                if (parsedCurrent && parsedNew) {
                  const stageJump = parsedNew.order - parsedCurrent.order;
                  
                  if (stageJump > 1) {
                    // Multiple stage jump - definitely breakthrough
                    progressionType = 'breakthrough';
                  } else if (stageJump === 1) {
                    // Single stage jump - check for breakthrough keywords
                    const chapterText = (chapter.content || chapter.summary || '').toLowerCase();
                    const breakthroughKeywords = [
                      'breakthrough', 'ascended', 'transcended', 'realm breakthrough',
                      'stage breakthrough', 'level breakthrough', 'cultivation breakthrough'
                    ];
                    
                    progressionType = breakthroughKeywords.some(kw => chapterText.includes(kw))
                      ? 'breakthrough'
                      : 'gradual';
                  } else if (stageJump === 0 && parsedNew.subStage && parsedCurrent.subStage) {
                    // Same stage, different sub-stage
                    progressionType = 'gradual';
                  } else {
                    progressionType = 'gradual';
                  }
                } else {
                  progressionType = 'gradual';
                }
              }

              graphService.updatePowerLevel(
                existingChar.id,
                newLevel,
                chapter.id,
                chapter.number,
                progressionType,
                `Updated from extraction in Chapter ${chapter.number}`
              );

              result.powerLevelsUpdated++;
            }
          }

          // Update relationships
          if (upsert.relationships && upsert.relationships.length > 0) {
            upsert.relationships.forEach(rel => {
              const targetChar = state.characterCodex.find(c =>
                c.name.toLowerCase() === rel.targetName.toLowerCase()
              );

              if (targetChar) {
                graphService.addOrUpdateRelationship(
                  existingChar.id,
                  targetChar.id,
                  rel.type,
                  rel.history || 'Karma link recorded in chronicle.',
                  rel.impact || 'Fate has shifted.',
                  chapter.number
                );

                // Check if this is new or update
                const existingRel = existingChar.relationships?.find(r => r.characterId === targetChar.id);
                if (existingRel) {
                  result.relationshipsUpdated++;
                } else {
                  result.relationshipsCreated++;
                }
              }
            });
          }

          // Track state change
          stateTracker.trackCharacterState(
            existingChar,
            chapter.id,
            chapter.number,
            previousChar
          );

          result.entitiesUpdated++;
        } else if (upsert.name) {
          // New character - will be added to codex by chapter processing
          // Graph will be updated when character is added to state
          result.entitiesAdded++;
        }
      });
    }

    // Detect conflicts
    result.conflicts = this.detectConflicts(state, chapter, extraction, graphService, powerSystem);

    return result;
  }

  /**
   * Detect conflicts between extraction and current state
   */
  private detectConflicts(
    state: NovelState,
    chapter: Chapter,
    extraction: PostChapterExtraction,
    graphService: ReturnType<typeof getKnowledgeGraphService>,
    powerSystem: ReturnType<typeof getPowerLevelSystem>
  ): GraphUpdateResult['conflicts'] {
    const conflicts: GraphUpdateResult['conflicts'] = [];

    if (extraction.characterUpserts) {
      extraction.characterUpserts.forEach(upsert => {
        const character = state.characterCodex.find(c =>
          c.name.toLowerCase() === upsert.name.toLowerCase()
        );

        if (!character) return;

        // Check power level conflicts
        if (upsert.set?.currentCultivation) {
          const extractedLevel = upsert.set.currentCultivation;
          const currentLevel = graphService.getCharacterPowerLevel(character.id) ||
                             character.currentCultivation;

          if (currentLevel && currentLevel !== 'Unknown') {
            const comparison = powerSystem.comparePowerLevels(extractedLevel, currentLevel);

            if (comparison < 0) {
              // Regression
              conflicts.push({
                type: 'power_regression',
                entityId: character.id,
                message: `Power level regression: ${currentLevel} → ${extractedLevel}. This may be intentional (injury, curse) or an error.`,
              });
            } else if (comparison > 0) {
              // Check if progression is too fast
              const progression = graphService.getPowerProgression(character.id);
              if (progression && progression.progression.length > 0) {
                const lastProg = progression.progression[progression.progression.length - 1];
                const chaptersSince = chapter.number - lastProg.chapterNumber;

                if (chaptersSince < 2) {
                  conflicts.push({
                    type: 'rapid_progression',
                    entityId: character.id,
                    message: `Rapid power progression: ${lastProg.powerLevel} → ${extractedLevel} in ${chaptersSince} chapter(s). Ensure this is well-justified.`,
                  });
                }
              }
            }
          }
        }

        // Check status conflicts
        if (upsert.set?.status) {
          const extractedStatus = upsert.set.status;
          const currentStatus = character.status;

          if (currentStatus === 'Deceased' && extractedStatus !== 'Deceased') {
            conflicts.push({
              type: 'status_conflict',
              entityId: character.id,
              message: `Character was Deceased but extraction shows ${extractedStatus}. This may be a resurrection scene or an error.`,
            });
          }
        }
      });
    }

    return conflicts;
  }

  /**
   * Merge duplicate entities (if detected)
   */
  mergeDuplicates(
    state: NovelState,
    entityType: 'character' | 'item' | 'technique',
    duplicates: Array<{ id: string; name: string }>
  ): void {
    // This would implement duplicate merging logic
    // For now, it's a placeholder
    console.log(`Merging ${duplicates.length} duplicate ${entityType}(s)`);
  }
}

// Singleton instance
let updaterInstance: KnowledgeGraphUpdater | null = null;

export function getKnowledgeGraphUpdater(): KnowledgeGraphUpdater {
  if (!updaterInstance) {
    updaterInstance = new KnowledgeGraphUpdater();
  }
  return updaterInstance;
}
