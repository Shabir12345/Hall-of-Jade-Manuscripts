/**
 * Delta Applicator Service
 * 
 * Applies Clerk deltas to the Lore Bible, transforming the state based on
 * the structured updates returned by the Clerk agent.
 */

import {
  LoreBible,
  ProtagonistState,
  CharacterStateSnapshot,
  WorldStateSnapshot,
  NarrativeAnchors,
  ConflictState,
  KarmaDebt,
  PowerSystemState,
  TechniqueMasteryState,
  ItemPossessionState,
  PromiseRecord,
} from '../../types/loreBible';
import {
  ClerkDelta,
  TechniqueUpdate,
  InventoryUpdate,
  CharacterStateUpdate,
  ConflictUpdate,
  KarmaDebtUpdate,
  PromiseUpdate,
  ProtagonistUpdate,
  PowerSystemUpdate,
} from '../../types/clerk';
import { logger } from '../loggingService';
import { generateUUID } from '../../utils/uuid';

/**
 * Result of applying a delta to the Lore Bible
 */
export interface DeltaApplyResult {
  success: boolean;
  updatedBible: LoreBible;
  changesApplied: string[];
  errors: string[];
}

/**
 * Apply a Clerk delta to the Lore Bible
 */
export function applyClerkDelta(
  bible: LoreBible,
  delta: ClerkDelta
): DeltaApplyResult {
  const changesApplied: string[] = [];
  const errors: string[] = [];

  // Deep clone the bible to avoid mutations
  const updatedBible: LoreBible = JSON.parse(JSON.stringify(bible));

  try {
    // Apply protagonist updates
    if (delta.updates.protagonist) {
      const result = applyProtagonistUpdate(updatedBible.protagonist, delta.updates.protagonist, delta.chapterNumber);
      changesApplied.push(...result.changes);
      errors.push(...result.errors);
    }

    // Apply character updates
    if (delta.updates.characters && delta.updates.characters.length > 0) {
      const result = applyCharacterUpdates(updatedBible.majorCharacters, delta.updates.characters);
      changesApplied.push(...result.changes);
      errors.push(...result.errors);
      updatedBible.majorCharacters = result.characters;
    }

    // Apply world state updates
    if (delta.updates.worldState) {
      const result = applyWorldStateUpdate(updatedBible.worldState, delta.updates.worldState);
      changesApplied.push(...result.changes);
    }

    // Apply narrative anchor updates
    if (delta.updates.narrativeAnchors) {
      const result = applyNarrativeAnchorsUpdate(
        updatedBible.narrativeAnchors,
        delta.updates.narrativeAnchors,
        delta.chapterNumber
      );
      changesApplied.push(...result.changes);
    }

    // Apply conflict updates
    if (delta.updates.activeConflicts && delta.updates.activeConflicts.length > 0) {
      const result = applyConflictUpdates(
        updatedBible.activeConflicts,
        delta.updates.activeConflicts,
        delta.chapterNumber
      );
      changesApplied.push(...result.changes);
      updatedBible.activeConflicts = result.conflicts;
    }

    // Apply karma debt updates
    if (delta.updates.karmaDebts && delta.updates.karmaDebts.length > 0) {
      const result = applyKarmaDebtUpdates(
        updatedBible.karmaDebts,
        delta.updates.karmaDebts,
        delta.chapterNumber
      );
      changesApplied.push(...result.changes);
      updatedBible.karmaDebts = result.karmaDebts;
    }

    // Apply power system updates
    if (delta.updates.powerSystem) {
      const result = applyPowerSystemUpdate(
        updatedBible.powerSystem,
        delta.updates.powerSystem,
        delta.chapterNumber
      );
      changesApplied.push(...result.changes);
    }

    // Update metadata
    updatedBible.asOfChapter = delta.chapterNumber;
    updatedBible.updatedAt = Date.now();
    updatedBible.version += 1;

    logger.info('Applied Clerk delta to Lore Bible', 'clerk', {
      chapterNumber: delta.chapterNumber,
      changesCount: changesApplied.length,
      errorCount: errors.length,
      newVersion: updatedBible.version,
    });

    return {
      success: errors.length === 0,
      updatedBible,
      changesApplied,
      errors,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to apply Clerk delta', 'clerk', error instanceof Error ? error : undefined);
    
    return {
      success: false,
      updatedBible: bible, // Return original on failure
      changesApplied,
      errors: [...errors, `Fatal error: ${errorMessage}`],
    };
  }
}

/**
 * Apply protagonist updates
 */
function applyProtagonistUpdate(
  protagonist: ProtagonistState,
  update: ProtagonistUpdate,
  chapterNumber: number
): { changes: string[]; errors: string[] } {
  const changes: string[] = [];
  const errors: string[] = [];

  // Apply cultivation updates
  if (update.cultivation) {
    if (update.cultivation.realm) {
      protagonist.cultivation.realm = update.cultivation.realm;
      changes.push(`Cultivation realm: ${update.cultivation.realm}`);
    }
    if (update.cultivation.stage) {
      protagonist.cultivation.stage = update.cultivation.stage;
      changes.push(`Cultivation stage: ${update.cultivation.stage}`);
    }
    if (update.cultivation.foundationQuality) {
      protagonist.cultivation.foundationQuality = update.cultivation.foundationQuality;
      changes.push(`Foundation quality: ${update.cultivation.foundationQuality}`);
    }
    if (update.cultivation.physique) {
      protagonist.cultivation.physique = update.cultivation.physique;
      changes.push(`Physique: ${update.cultivation.physique}`);
    }
    if (update.cultivation.specialConditions) {
      protagonist.cultivation.specialConditions = update.cultivation.specialConditions;
      changes.push(`Special conditions updated`);
    }
  }

  // Apply technique updates
  if (update.techniques && update.techniques.length > 0) {
    for (const techUpdate of update.techniques) {
      const result = applyTechniqueUpdate(protagonist.techniques, techUpdate, chapterNumber);
      changes.push(...result.changes);
      errors.push(...result.errors);
    }
  }

  // Apply inventory updates
  if (update.inventory && update.inventory.length > 0) {
    for (const invUpdate of update.inventory) {
      const result = applyInventoryUpdate(protagonist.inventory, invUpdate, chapterNumber);
      changes.push(...result.changes);
      errors.push(...result.errors);
    }
  }

  // Apply simple state updates
  if (update.emotionalState) {
    protagonist.emotionalState = update.emotionalState;
    changes.push(`Emotional state: ${update.emotionalState}`);
  }

  if (update.physicalState) {
    protagonist.physicalState = update.physicalState;
    changes.push(`Physical state: ${update.physicalState}`);
  }

  if (update.location) {
    protagonist.location = update.location;
    changes.push(`Location: ${update.location}`);
  }

  // Apply identity updates
  if (update.identity) {
    if (update.identity.newAlias && !protagonist.identity.aliases.includes(update.identity.newAlias)) {
      protagonist.identity.aliases.push(update.identity.newAlias);
      changes.push(`New alias: ${update.identity.newAlias}`);
    }
    if (update.identity.newTitle) {
      protagonist.identity.title = update.identity.newTitle;
      changes.push(`New title: ${update.identity.newTitle}`);
    }
    if (update.identity.sectChange) {
      protagonist.identity.sect = update.identity.sectChange;
      changes.push(`Sect changed: ${update.identity.sectChange}`);
    }
  }

  protagonist.lastUpdatedChapter = chapterNumber;

  return { changes, errors };
}

/**
 * Apply a single technique update
 */
function applyTechniqueUpdate(
  techniques: TechniqueMasteryState[],
  update: TechniqueUpdate,
  chapterNumber: number
): { changes: string[]; errors: string[] } {
  const changes: string[] = [];
  const errors: string[] = [];

  const existingIndex = techniques.findIndex(
    t => t.name.toLowerCase() === update.name.toLowerCase()
  );

  switch (update.action) {
    case 'add':
      if (existingIndex >= 0) {
        // Update existing instead
        techniques[existingIndex].masteryLevel = update.masteryLevel || techniques[existingIndex].masteryLevel;
        changes.push(`Updated technique: ${update.name} to ${update.masteryLevel}`);
      } else {
        techniques.push({
          name: update.name,
          masteryLevel: update.masteryLevel || 'Beginner',
          description: update.description,
          acquiredChapter: chapterNumber,
        });
        changes.push(`Learned technique: ${update.name}`);
      }
      break;

    case 'update':
      if (existingIndex >= 0) {
        if (update.masteryLevel) {
          techniques[existingIndex].masteryLevel = update.masteryLevel;
        }
        if (update.description) {
          techniques[existingIndex].description = update.description;
        }
        changes.push(`Updated technique: ${update.name}`);
      } else {
        errors.push(`Cannot update unknown technique: ${update.name}`);
      }
      break;

    case 'remove':
      if (existingIndex >= 0) {
        techniques.splice(existingIndex, 1);
        changes.push(`Lost technique: ${update.name}`);
      }
      break;
  }

  return { changes, errors };
}

/**
 * Apply a single inventory update
 */
function applyInventoryUpdate(
  inventory: { equipped: ItemPossessionState[]; storageRing: ItemPossessionState[] },
  update: InventoryUpdate,
  chapterNumber: number
): { changes: string[]; errors: string[] } {
  const changes: string[] = [];
  const errors: string[] = [];

  // Determine which inventory list to work with
  const targetList = update.category === 'equipped' ? inventory.equipped : inventory.storageRing;
  const existingIndex = targetList.findIndex(
    i => i.name.toLowerCase() === update.name.toLowerCase()
  );

  switch (update.action) {
    case 'add':
      if (existingIndex >= 0) {
        // Update quantity if exists
        const existing = targetList[existingIndex];
        existing.quantity = (existing.quantity || 1) + (update.quantity || 1);
        changes.push(`Gained more ${update.name} (now ${existing.quantity})`);
      } else {
        targetList.push({
          name: update.name,
          category: update.category,
          quantity: update.quantity,
          description: update.description,
          acquiredChapter: chapterNumber,
        });
        changes.push(`Gained item: ${update.name}`);
      }
      break;

    case 'consume':
      if (existingIndex >= 0) {
        const existing = targetList[existingIndex];
        const consumed = update.quantityConsumed || 1;
        const currentQty = existing.quantity || 1;
        
        if (currentQty <= consumed) {
          targetList.splice(existingIndex, 1);
          changes.push(`Consumed all ${update.name}`);
        } else {
          existing.quantity = currentQty - consumed;
          changes.push(`Consumed ${consumed} ${update.name} (${existing.quantity} remaining)`);
        }
      } else {
        errors.push(`Cannot consume unknown item: ${update.name}`);
      }
      break;

    case 'lose':
      if (existingIndex >= 0) {
        targetList.splice(existingIndex, 1);
        changes.push(`Lost item: ${update.name}`);
      }
      break;

    case 'upgrade':
      if (existingIndex >= 0) {
        if (update.description) {
          targetList[existingIndex].description = update.description;
        }
        changes.push(`Upgraded item: ${update.name}`);
      } else {
        errors.push(`Cannot upgrade unknown item: ${update.name}`);
      }
      break;

    case 'move':
      // Move between equipped and storage
      const otherList = update.category === 'equipped' ? inventory.storageRing : inventory.equipped;
      const sourceIndex = otherList.findIndex(
        i => i.name.toLowerCase() === update.name.toLowerCase()
      );
      
      if (sourceIndex >= 0) {
        const item = otherList.splice(sourceIndex, 1)[0];
        item.category = update.category;
        targetList.push(item);
        changes.push(`Moved ${update.name} to ${update.category}`);
      } else if (existingIndex < 0) {
        errors.push(`Cannot find item to move: ${update.name}`);
      }
      break;
  }

  return { changes, errors };
}

/**
 * Apply character updates
 */
function applyCharacterUpdates(
  characters: CharacterStateSnapshot[],
  updates: CharacterStateUpdate[]
): { characters: CharacterStateSnapshot[]; changes: string[]; errors: string[] } {
  const changes: string[] = [];
  const errors: string[] = [];
  const result = [...characters];

  for (const update of updates) {
    const existingIndex = result.findIndex(
      c => c.name.toLowerCase() === update.name.toLowerCase() ||
           (update.characterId && c.id === update.characterId)
    );

    switch (update.action) {
      case 'add':
        if (existingIndex < 0) {
          result.push({
            id: update.characterId || generateUUID(),
            name: update.name,
            status: update.updates.status || 'Alive',
            cultivation: update.updates.cultivation,
            location: update.updates.location,
            relationshipToProtagonist: update.updates.relationshipToProtagonist,
            currentRole: update.updates.currentRole,
            keyTraits: update.updates.keyTraits || [],
          });
          changes.push(`Added character: ${update.name}`);
        } else {
          // Update existing instead
          Object.assign(result[existingIndex], update.updates);
          changes.push(`Updated character: ${update.name}`);
        }
        break;

      case 'update':
        if (existingIndex >= 0) {
          const char = result[existingIndex];
          if (update.updates.status) char.status = update.updates.status;
          if (update.updates.cultivation) char.cultivation = update.updates.cultivation;
          if (update.updates.location) char.location = update.updates.location;
          if (update.updates.relationshipToProtagonist) {
            char.relationshipToProtagonist = update.updates.relationshipToProtagonist;
          }
          if (update.updates.currentRole) char.currentRole = update.updates.currentRole;
          if (update.updates.keyTraits) char.keyTraits = update.updates.keyTraits;
          changes.push(`Updated character: ${update.name}`);
        } else {
          errors.push(`Cannot update unknown character: ${update.name}`);
        }
        break;

      case 'remove':
        if (existingIndex >= 0) {
          result.splice(existingIndex, 1);
          changes.push(`Removed character: ${update.name}`);
        }
        break;
    }
  }

  return { characters: result, changes, errors };
}

/**
 * Apply world state updates
 */
function applyWorldStateUpdate(
  worldState: WorldStateSnapshot,
  update: Partial<WorldStateSnapshot>
): { changes: string[] } {
  const changes: string[] = [];

  if (update.currentRealm) {
    worldState.currentRealm = update.currentRealm;
    changes.push(`Current realm: ${update.currentRealm}`);
  }

  if (update.currentLocation) {
    worldState.currentLocation = update.currentLocation;
    changes.push(`Current location: ${update.currentLocation}`);
  }

  if (update.timeContext) {
    worldState.timeContext = update.timeContext;
    changes.push(`Time context: ${update.timeContext}`);
  }

  if (update.currentSituation) {
    worldState.currentSituation = update.currentSituation;
    changes.push(`Situation updated`);
  }

  if (update.environmentalConditions) {
    worldState.environmentalConditions = update.environmentalConditions;
    changes.push(`Environmental conditions updated`);
  }

  return { changes };
}

/**
 * Apply narrative anchor updates
 */
function applyNarrativeAnchorsUpdate(
  anchors: NarrativeAnchors,
  update: ClerkDelta['updates']['narrativeAnchors'],
  chapterNumber: number
): { changes: string[] } {
  const changes: string[] = [];

  if (!update) return { changes };

  if (update.lastMajorEvent) {
    anchors.lastMajorEvent = update.lastMajorEvent;
    anchors.lastMajorEventChapter = chapterNumber;
    changes.push(`Last major event: ${update.lastMajorEvent}`);
  }

  if (update.currentObjective) {
    anchors.currentObjective = update.currentObjective;
    changes.push(`Current objective: ${update.currentObjective}`);
  }

  if (update.longTermGoal) {
    anchors.longTermGoal = update.longTermGoal;
    changes.push(`Long-term goal: ${update.longTermGoal}`);
  }

  if (update.activeQuests) {
    anchors.activeQuests = update.activeQuests;
    changes.push(`Active quests updated (${update.activeQuests.length})`);
  }

  // Apply promise updates
  if (update.promiseUpdates && update.promiseUpdates.length > 0) {
    for (const promiseUpdate of update.promiseUpdates) {
      applyPromiseUpdate(anchors.pendingPromises, promiseUpdate, chapterNumber);
      changes.push(`Promise update: ${promiseUpdate.description || promiseUpdate.promiseId}`);
    }
  }

  return { changes };
}

/**
 * Apply a single promise update
 */
function applyPromiseUpdate(
  promises: PromiseRecord[],
  update: PromiseUpdate,
  chapterNumber: number
): void {
  const existingIndex = promises.findIndex(
    p => p.id === update.promiseId ||
         p.description.toLowerCase().includes((update.description || '').toLowerCase())
  );

  switch (update.action) {
    case 'add':
      if (existingIndex < 0) {
        promises.push({
          id: update.promiseId || generateUUID(),
          description: update.description || 'New promise',
          madeToCharacter: update.madeToCharacter,
          madeInChapter: chapterNumber,
          deadline: update.deadline,
          status: 'pending',
        });
      }
      break;

    case 'update':
      if (existingIndex >= 0) {
        if (update.description) promises[existingIndex].description = update.description;
        if (update.deadline) promises[existingIndex].deadline = update.deadline;
      }
      break;

    case 'fulfill':
      if (existingIndex >= 0) {
        promises[existingIndex].status = 'fulfilled';
        promises[existingIndex].fulfillmentChapter = chapterNumber;
      }
      break;

    case 'break':
      if (existingIndex >= 0) {
        promises[existingIndex].status = 'broken';
        promises[existingIndex].fulfillmentChapter = chapterNumber;
      }
      break;
  }
}

/**
 * Apply conflict updates
 */
function applyConflictUpdates(
  conflicts: ConflictState[],
  updates: ConflictUpdate[],
  chapterNumber: number
): { conflicts: ConflictState[]; changes: string[] } {
  const changes: string[] = [];
  const result = [...conflicts];

  for (const update of updates) {
    const existingIndex = result.findIndex(
      c => c.id === update.conflictId ||
           (update.description && c.description.toLowerCase().includes(update.description.toLowerCase()))
    );

    switch (update.action) {
      case 'add':
        if (existingIndex < 0 && update.description) {
          result.push({
            id: update.conflictId || generateUUID(),
            description: update.description,
            parties: update.parties || [],
            type: update.type || 'personal',
            status: update.status || 'active',
            protagonistStance: update.protagonistStance,
            urgency: update.urgency || 'medium',
            introducedChapter: chapterNumber,
            lastUpdatedChapter: chapterNumber,
          });
          changes.push(`New conflict: ${update.description}`);
        }
        break;

      case 'update':
        if (existingIndex >= 0) {
          const conflict = result[existingIndex];
          if (update.status) conflict.status = update.status;
          if (update.urgency) conflict.urgency = update.urgency;
          if (update.protagonistStance) conflict.protagonistStance = update.protagonistStance;
          if (update.parties) conflict.parties = update.parties;
          conflict.lastUpdatedChapter = chapterNumber;
          changes.push(`Updated conflict: ${conflict.description}`);
        }
        break;

      case 'resolve':
        if (existingIndex >= 0) {
          result[existingIndex].status = 'resolving';
          result[existingIndex].lastUpdatedChapter = chapterNumber;
          changes.push(`Resolving conflict: ${result[existingIndex].description}`);
        }
        break;

      case 'escalate':
        if (existingIndex >= 0) {
          result[existingIndex].status = 'escalating';
          const urgencyOrder: ConflictState['urgency'][] = ['low', 'medium', 'high', 'critical'];
          const currentIndex = urgencyOrder.indexOf(result[existingIndex].urgency);
          if (currentIndex < urgencyOrder.length - 1) {
            result[existingIndex].urgency = urgencyOrder[currentIndex + 1];
          }
          result[existingIndex].lastUpdatedChapter = chapterNumber;
          changes.push(`Escalated conflict: ${result[existingIndex].description}`);
        }
        break;
    }
  }

  return { conflicts: result, changes };
}

/**
 * Apply karma debt updates
 */
function applyKarmaDebtUpdates(
  karmaDebts: KarmaDebt[],
  updates: KarmaDebtUpdate[],
  chapterNumber: number
): { karmaDebts: KarmaDebt[]; changes: string[] } {
  const changes: string[] = [];
  const result = [...karmaDebts];

  for (const update of updates) {
    const existingIndex = result.findIndex(
      k => k.id === update.karmaId ||
           (update.target && k.target.toLowerCase() === update.target.toLowerCase())
    );

    switch (update.action) {
      case 'add':
        if (existingIndex < 0 && update.target) {
          result.push({
            id: update.karmaId || generateUUID(),
            target: update.target,
            action: update.actionDescription || 'Unknown action',
            targetStatus: update.targetStatus || 'Unknown',
            consequence: update.consequence || 'Consequences pending',
            threatLevel: update.threatLevel || 'moderate',
            introducedChapter: chapterNumber,
          });
          changes.push(`New karma debt: ${update.target}`);
        }
        break;

      case 'update':
        if (existingIndex >= 0) {
          const debt = result[existingIndex];
          if (update.targetStatus) debt.targetStatus = update.targetStatus;
          if (update.consequence) debt.consequence = update.consequence;
          if (update.threatLevel) debt.threatLevel = update.threatLevel;
          changes.push(`Updated karma debt: ${debt.target}`);
        }
        break;

      case 'resolve':
        if (existingIndex >= 0) {
          result[existingIndex].resolvedChapter = chapterNumber;
          changes.push(`Resolved karma debt: ${result[existingIndex].target}`);
        }
        break;

      case 'escalate':
        if (existingIndex >= 0) {
          const threatOrder: KarmaDebt['threatLevel'][] = ['minor', 'moderate', 'severe', 'existential'];
          const currentIndex = threatOrder.indexOf(result[existingIndex].threatLevel);
          if (currentIndex < threatOrder.length - 1) {
            result[existingIndex].threatLevel = threatOrder[currentIndex + 1];
          }
          changes.push(`Escalated karma debt: ${result[existingIndex].target}`);
        }
        break;
    }
  }

  return { karmaDebts: result, changes };
}

/**
 * Apply power system updates
 */
function applyPowerSystemUpdate(
  powerSystem: PowerSystemState,
  update: PowerSystemUpdate,
  chapterNumber: number
): { changes: string[] } {
  const changes: string[] = [];

  if (update.currentProtagonistRank) {
    powerSystem.currentProtagonistRank = update.currentProtagonistRank;
    changes.push(`Protagonist rank: ${update.currentProtagonistRank}`);
  }

  if (update.newLevelsDiscovered && update.newLevelsDiscovered.length > 0) {
    for (const level of update.newLevelsDiscovered) {
      if (!powerSystem.knownLevelHierarchy.includes(level)) {
        powerSystem.knownLevelHierarchy.push(level);
        changes.push(`Discovered power level: ${level}`);
      }
    }
  }

  if (update.powerGapsUpdated && update.powerGapsUpdated.length > 0) {
    powerSystem.powerGaps = update.powerGapsUpdated;
    changes.push(`Power gaps updated`);
  }

  if (update.recentBreakthroughs && update.recentBreakthroughs.length > 0) {
    if (!powerSystem.recentBreakthroughs) {
      powerSystem.recentBreakthroughs = [];
    }
    
    for (const breakthrough of update.recentBreakthroughs) {
      powerSystem.recentBreakthroughs.push({
        character: breakthrough.character,
        fromLevel: breakthrough.fromLevel,
        toLevel: breakthrough.toLevel,
        chapter: chapterNumber,
      });
      changes.push(`Breakthrough: ${breakthrough.character} to ${breakthrough.toLevel}`);
    }

    // Keep only recent breakthroughs (last 10)
    if (powerSystem.recentBreakthroughs.length > 10) {
      powerSystem.recentBreakthroughs = powerSystem.recentBreakthroughs.slice(-10);
    }
  }

  return { changes };
}
