/**
 * Chapter Rollback Service
 * 
 * Performs smart incremental rollback of all changes made during chapter generation
 * when a chapter is deleted. Handles entity updates, deletions, and complex merges.
 */

import { NovelState, Character, WorldEntry, Territory, NovelItem, NovelTechnique, Antagonist, Arc, Chapter } from '../types';
import { ChapterStateSnapshot } from '../types/chapterSnapshot';
import { getChapterSnapshot } from './chapterStateSnapshotService';
import { logger } from './loggingService';

/**
 * Rollback all changes made during a chapter's generation
 */
export async function rollbackChapterChanges(
  currentState: NovelState,
  chapterId: string,
  snapshot: ChapterStateSnapshot
): Promise<NovelState> {
  logger.info('Starting chapter rollback', 'chapterRollback', {
    chapterId,
    chapterNumber: snapshot.chapterNumber,
    novelId: snapshot.novelId,
  });

  const rolledBackState = { ...currentState };
  const rollbackSteps: { step: string; success: boolean; entitiesAffected?: number }[] = [];

  try {
    // Step 1: Rollback characters
    const characterResult = rollbackCharacters(
      rolledBackState,
      snapshot,
      chapterId
    );
    rolledBackState.characterCodex = characterResult.characters;
    rollbackSteps.push({
      step: 'characters',
      success: true,
      entitiesAffected: characterResult.deletedCount + characterResult.updatedCount,
    });
    logger.info('Characters rolled back', 'chapterRollback', {
      chapterId,
      deleted: characterResult.deletedCount,
      updated: characterResult.updatedCount,
    });

    // Step 2: Rollback world bible
    const worldBibleResult = rollbackWorldBible(
      rolledBackState,
      snapshot,
      chapterId
    );
    rolledBackState.worldBible = worldBibleResult.worldBible;
    rolledBackState.realms = worldBibleResult.realms;
    rolledBackState.currentRealmId = worldBibleResult.currentRealmId;
    rollbackSteps.push({
      step: 'worldBible',
      success: true,
      entitiesAffected: worldBibleResult.deletedCount + worldBibleResult.updatedCount,
    });
    logger.info('World Bible rolled back', 'chapterRollback', {
      chapterId,
      deleted: worldBibleResult.deletedCount,
      updated: worldBibleResult.updatedCount,
    });

    // Step 3: Rollback territories
    const territoryResult = rollbackTerritories(
      rolledBackState,
      snapshot,
      chapterId
    );
    rolledBackState.territories = territoryResult.territories;
    rollbackSteps.push({
      step: 'territories',
      success: true,
      entitiesAffected: territoryResult.deletedCount + territoryResult.updatedCount,
    });
    logger.info('Territories rolled back', 'chapterRollback', {
      chapterId,
      deleted: territoryResult.deletedCount,
      updated: territoryResult.updatedCount,
    });

    // Step 4: Rollback items
    const itemResult = rollbackItems(
      rolledBackState,
      snapshot,
      chapterId
    );
    rolledBackState.novelItems = itemResult.items;
    // Also clean up character-item relationships
    rolledBackState.characterCodex.forEach(char => {
      if (char.itemPossessions) {
        char.itemPossessions = char.itemPossessions.filter(
          p => p.acquiredChapter !== snapshot.chapterNumber
        );
      }
    });
    rollbackSteps.push({
      step: 'items',
      success: true,
      entitiesAffected: itemResult.deletedCount + itemResult.updatedCount,
    });
    logger.info('Items rolled back', 'chapterRollback', {
      chapterId,
      deleted: itemResult.deletedCount,
      updated: itemResult.updatedCount,
    });

    // Step 5: Rollback techniques
    const techniqueResult = rollbackTechniques(
      rolledBackState,
      snapshot,
      chapterId
    );
    rolledBackState.novelTechniques = techniqueResult.techniques;
    // Also clean up character-technique relationships
    rolledBackState.characterCodex.forEach(char => {
      if (char.techniqueMasteries) {
        char.techniqueMasteries = char.techniqueMasteries.filter(
          m => m.learnedChapter !== snapshot.chapterNumber
        );
      }
    });
    rollbackSteps.push({
      step: 'techniques',
      success: true,
      entitiesAffected: techniqueResult.deletedCount + techniqueResult.updatedCount,
    });
    logger.info('Techniques rolled back', 'chapterRollback', {
      chapterId,
      deleted: techniqueResult.deletedCount,
      updated: techniqueResult.updatedCount,
    });

    // Step 6: Rollback antagonists
    const antagonistResult = rollbackAntagonists(
      rolledBackState,
      snapshot,
      chapterId
    );
    rolledBackState.antagonists = antagonistResult.antagonists;
    rollbackSteps.push({
      step: 'antagonists',
      success: true,
      entitiesAffected: antagonistResult.deletedCount + antagonistResult.updatedCount,
    });
    logger.info('Antagonists rolled back', 'chapterRollback', {
      chapterId,
      deleted: antagonistResult.deletedCount,
      updated: antagonistResult.updatedCount,
    });

    // Step 7: Rollback arc progress
    const arcResult = rollbackArcProgress(
      rolledBackState,
      snapshot,
      chapterId
    );
    rolledBackState.plotLedger = arcResult.arcs;
    rollbackSteps.push({
      step: 'arcProgress',
      success: true,
      entitiesAffected: arcResult.revertedCount,
    });
    logger.info('Arc progress rolled back', 'chapterRollback', {
      chapterId,
      reverted: arcResult.revertedCount,
    });

    // Update timestamp
    rolledBackState.updatedAt = Date.now();

    const totalAffected = rollbackSteps.reduce(
      (sum, step) => sum + (step.entitiesAffected || 0),
      0
    );

    logger.info('Chapter rollback completed', 'chapterRollback', {
      chapterId,
      steps: rollbackSteps.map(s => s.step),
      totalEntitiesAffected: totalAffected,
    });

    return rolledBackState;
  } catch (error) {
    logger.error('Chapter rollback failed', 'chapterRollback', {
      chapterId,
      error: error instanceof Error ? error : new Error(String(error)),
      steps: rollbackSteps,
    });
    throw error;
  }
}

/**
 * Rollback character changes
 */
function rollbackCharacters(
  currentState: NovelState,
  snapshot: ChapterStateSnapshot,
  chapterId: string
): {
  characters: Character[];
  deletedCount: number;
  updatedCount: number;
} {
  const preChapterChars = snapshot.preChapterState.characterCodex;
  const currentChars = currentState.characterCodex;
  const preChapterCharMap = new Map(preChapterChars.map(c => [c.id, c]));
  const currentCharMap = new Map(currentChars.map(c => [c.id, c]));

  const rolledBackChars: Character[] = [];
  let deletedCount = 0;
  let updatedCount = 0;

  // Process characters that existed before chapter
  preChapterCharMap.forEach((preChar, charId) => {
    const currentChar = currentCharMap.get(charId);
    
    if (!currentChar) {
      // Character was deleted after chapter, shouldn't happen but restore it
      rolledBackChars.push({ ...preChar });
      updatedCount++;
    } else if (currentChar.lastUpdatedByChapterId === chapterId) {
      // Character was updated in this chapter - restore to pre-chapter state
      rolledBackChars.push({ ...preChar });
      updatedCount++;
    } else {
      // Character wasn't changed by this chapter - keep current state
      rolledBackChars.push({ ...currentChar });
    }
  });

  // Remove characters created in this chapter
  currentCharMap.forEach((currentChar, charId) => {
    if (!preChapterCharMap.has(charId)) {
      // New character created in this chapter
      if (currentChar.createdByChapterId === chapterId) {
        deletedCount++;
        // Don't add to rolledBackChars - it's deleted
      } else {
        // Character created elsewhere, keep it
        rolledBackChars.push({ ...currentChar });
      }
    }
  });

  return {
    characters: rolledBackChars,
    deletedCount,
    updatedCount,
  };
}

/**
 * Rollback world bible changes
 */
function rollbackWorldBible(
  currentState: NovelState,
  snapshot: ChapterStateSnapshot,
  chapterId: string
): {
  worldBible: WorldEntry[];
  realms: typeof currentState.realms;
  currentRealmId: string;
  deletedCount: number;
  updatedCount: number;
} {
  const preChapterWorldBible = snapshot.preChapterState.worldBible;
  const currentWorldBible = currentState.worldBible;
  const preChapterWorldMap = new Map(preChapterWorldBible.map(w => [w.id, w]));
  const currentWorldMap = new Map(currentWorldBible.map(w => [w.id, w]));

  const rolledBackWorldBible: WorldEntry[] = [];
  let deletedCount = 0;
  let updatedCount = 0;

  // Process world entries that existed before chapter
  preChapterWorldMap.forEach((preEntry, entryId) => {
    const currentEntry = currentWorldMap.get(entryId);
    
    if (!currentEntry) {
      // Entry was deleted after chapter, restore it
      rolledBackWorldBible.push({ ...preEntry });
      updatedCount++;
    } else if (currentEntry.lastUpdatedByChapterId === chapterId) {
      // Entry was updated in this chapter - restore to pre-chapter state
      rolledBackWorldBible.push({ ...preEntry });
      updatedCount++;
    } else {
      // Entry wasn't changed by this chapter - keep current state
      rolledBackWorldBible.push({ ...currentEntry });
    }
  });

  // Remove entries created in this chapter
  currentWorldMap.forEach((currentEntry, entryId) => {
    if (!preChapterWorldMap.has(entryId)) {
      if (currentEntry.createdByChapterId === chapterId) {
        deletedCount++;
      } else {
        rolledBackWorldBible.push({ ...currentEntry });
      }
    }
  });

  // Rollback realm changes if any
  let realms = [...currentState.realms];
  let currentRealmId = currentState.currentRealmId;
  
  if (snapshot.changeSummary.realmChanges?.newRealmCreated) {
    // Restore old realm state
    const oldRealmId = snapshot.changeSummary.realmChanges.oldRealmId;
    if (oldRealmId) {
      realms = snapshot.preChapterState.realms.map(r => ({ ...r }));
      currentRealmId = oldRealmId;
      
      // Restore old realms' status
      realms.forEach(r => {
        if (r.id === oldRealmId) {
          r.status = 'current';
        } else if (snapshot.preChapterState.realms.find(pr => pr.id === r.id)?.status === 'archived') {
          r.status = 'archived';
        }
      });
    }
  }

  return {
    worldBible: rolledBackWorldBible,
    realms,
    currentRealmId,
    deletedCount,
    updatedCount,
  };
}

/**
 * Rollback territory changes
 */
function rollbackTerritories(
  currentState: NovelState,
  snapshot: ChapterStateSnapshot,
  chapterId: string
): {
  territories: Territory[];
  deletedCount: number;
  updatedCount: number;
} {
  const preChapterTerritories = snapshot.preChapterState.territories;
  const currentTerritories = currentState.territories;
  const preChapterTerritoryMap = new Map(preChapterTerritories.map(t => [t.id, t]));
  const currentTerritoryMap = new Map(currentTerritories.map(t => [t.id, t]));

  const rolledBackTerritories: Territory[] = [];
  let deletedCount = 0;
  let updatedCount = 0;

  preChapterTerritoryMap.forEach((preTerritory, territoryId) => {
    const currentTerritory = currentTerritoryMap.get(territoryId);
    
    if (!currentTerritory) {
      rolledBackTerritories.push({ ...preTerritory });
      updatedCount++;
    } else if (currentTerritory.lastUpdatedByChapterId === chapterId) {
      rolledBackTerritories.push({ ...preTerritory });
      updatedCount++;
    } else {
      rolledBackTerritories.push({ ...currentTerritory });
    }
  });

  currentTerritoryMap.forEach((currentTerritory, territoryId) => {
    if (!preChapterTerritoryMap.has(territoryId)) {
      if (currentTerritory.createdByChapterId === chapterId) {
        deletedCount++;
      } else {
        rolledBackTerritories.push({ ...currentTerritory });
      }
    }
  });

  return {
    territories: rolledBackTerritories,
    deletedCount,
    updatedCount,
  };
}

/**
 * Rollback item changes
 */
function rollbackItems(
  currentState: NovelState,
  snapshot: ChapterStateSnapshot,
  chapterId: string
): {
  items: NovelItem[];
  deletedCount: number;
  updatedCount: number;
} {
  const preChapterItems = snapshot.preChapterState.novelItems;
  const currentItems = currentState.novelItems;
  const preChapterItemMap = new Map(preChapterItems.map(i => [i.id, i]));
  const currentItemMap = new Map(currentItems.map(i => [i.id, i]));

  const rolledBackItems: NovelItem[] = [];
  let deletedCount = 0;
  let updatedCount = 0;

  preChapterItemMap.forEach((preItem, itemId) => {
    const currentItem = currentItemMap.get(itemId);
    
    if (!currentItem) {
      rolledBackItems.push({ ...preItem });
      updatedCount++;
    } else if (currentItem.lastUpdatedByChapterId === chapterId) {
      rolledBackItems.push({ ...preItem });
      updatedCount++;
    } else {
      rolledBackItems.push({ ...currentItem });
    }
  });

  currentItemMap.forEach((currentItem, itemId) => {
    if (!preChapterItemMap.has(itemId)) {
      if (currentItem.createdByChapterId === chapterId) {
        deletedCount++;
      } else {
        rolledBackItems.push({ ...currentItem });
      }
    }
  });

  return {
    items: rolledBackItems,
    deletedCount,
    updatedCount,
  };
}

/**
 * Rollback technique changes
 */
function rollbackTechniques(
  currentState: NovelState,
  snapshot: ChapterStateSnapshot,
  chapterId: string
): {
  techniques: NovelTechnique[];
  deletedCount: number;
  updatedCount: number;
} {
  const preChapterTechniques = snapshot.preChapterState.novelTechniques;
  const currentTechniques = currentState.novelTechniques;
  const preChapterTechniqueMap = new Map(preChapterTechniques.map(t => [t.id, t]));
  const currentTechniqueMap = new Map(currentTechniques.map(t => [t.id, t]));

  const rolledBackTechniques: NovelTechnique[] = [];
  let deletedCount = 0;
  let updatedCount = 0;

  preChapterTechniqueMap.forEach((preTechnique, techniqueId) => {
    const currentTechnique = currentTechniqueMap.get(techniqueId);
    
    if (!currentTechnique) {
      rolledBackTechniques.push({ ...preTechnique });
      updatedCount++;
    } else if (currentTechnique.lastUpdatedByChapterId === chapterId) {
      rolledBackTechniques.push({ ...preTechnique });
      updatedCount++;
    } else {
      rolledBackTechniques.push({ ...currentTechnique });
    }
  });

  currentTechniqueMap.forEach((currentTechnique, techniqueId) => {
    if (!preChapterTechniqueMap.has(techniqueId)) {
      if (currentTechnique.createdByChapterId === chapterId) {
        deletedCount++;
      } else {
        rolledBackTechniques.push({ ...currentTechnique });
      }
    }
  });

  return {
    techniques: rolledBackTechniques,
    deletedCount,
    updatedCount,
  };
}

/**
 * Rollback antagonist changes
 */
function rollbackAntagonists(
  currentState: NovelState,
  snapshot: ChapterStateSnapshot,
  chapterId: string
): {
  antagonists: Antagonist[];
  deletedCount: number;
  updatedCount: number;
} {
  const preChapterAntagonists = snapshot.preChapterState.antagonists;
  const currentAntagonists = currentState.antagonists || [];
  const preChapterAntagonistMap = new Map(preChapterAntagonists.map(a => [a.id, a]));
  const currentAntagonistMap = new Map(currentAntagonists.map(a => [a.id, a]));

  const rolledBackAntagonists: Antagonist[] = [];
  let deletedCount = 0;
  let updatedCount = 0;

  preChapterAntagonistMap.forEach((preAntagonist, antagonistId) => {
    const currentAntagonist = currentAntagonistMap.get(antagonistId);
    
    if (!currentAntagonist) {
      rolledBackAntagonists.push({ ...preAntagonist });
      updatedCount++;
    } else if (currentAntagonist.lastUpdatedByChapterId === chapterId) {
      rolledBackAntagonists.push({ ...preAntagonist });
      updatedCount++;
    } else {
      rolledBackAntagonists.push({ ...currentAntagonist });
    }
  });

  currentAntagonistMap.forEach((currentAntagonist, antagonistId) => {
    if (!preChapterAntagonistMap.has(antagonistId)) {
      if (currentAntagonist.createdByChapterId === chapterId) {
        deletedCount++;
      } else {
        rolledBackAntagonists.push({ ...currentAntagonist });
      }
    }
  });

  return {
    antagonists: rolledBackAntagonists,
    deletedCount,
    updatedCount,
  };
}

/**
 * Helper to handle complex merged content (like appended notes)
 * Removes content appended in a specific chapter
 */
function removeAppendedContent(
  originalContent: string,
  currentContent: string,
  chapterNumber: number
): string {
  // If content was appended using mergeAppend format, remove the appended portion
  // Format: "Original content\n\n--- Chapter N ---\nAppended content"
  const chapterMarker = `--- Chapter ${chapterNumber} ---`;
  const markerIndex = currentContent.indexOf(chapterMarker);
  
  if (markerIndex > 0) {
    // Content was appended - return original content
    return originalContent;
  }
  
  // If content matches original exactly, return original
  if (currentContent === originalContent) {
    return originalContent;
  }
  
  // If current content starts with original content, assume rest was appended
  // This is a heuristic and might not catch all cases
  if (currentContent.startsWith(originalContent)) {
    const appended = currentContent.substring(originalContent.length);
    // If appended content looks like it was added in this chapter (heuristic)
    // Return original content
    if (appended.trim().length > 0) {
      return originalContent;
    }
  }
  
  // Default: return original content if we can't determine what was appended
  return originalContent;
}

/**
 * Rollback arc checklist progress
 */
function rollbackArcProgress(
  currentState: NovelState,
  snapshot: ChapterStateSnapshot,
  chapterId: string
): {
  arcs: Arc[];
  revertedCount: number;
} {
  const preChapterArcs = snapshot.preChapterState.plotLedger;
  const currentArcs = currentState.plotLedger;
  const preChapterArcMap = new Map(preChapterArcs.map(a => [a.id, a]));
  
  let revertedCount = 0;

  const rolledBackArcs = currentArcs.map(currentArc => {
    const preArc = preChapterArcMap.get(currentArc.id);
    
    if (!preArc) {
      // Arc didn't exist before chapter - keep it but might need cleanup
      return { ...currentArc };
    }

    // Check if checklist items were completed in this chapter
    const currentChecklist = currentArc.checklist || [];
    const preChecklist = preArc.checklist || [];
    
    // Create a map of pre-chapter checklist state
    const preChecklistMap = new Map(preChecklist.map(item => [item.id, item]));
    
    // Revert checklist items that were completed in this chapter
    const rolledBackChecklist = currentChecklist.map(currentItem => {
      const preItem = preChecklistMap.get(currentItem.id);
      
      if (preItem) {
        // Item existed before - restore its previous state
        if (currentItem.completed && !preItem.completed && 
            currentItem.sourceChapterNumber === snapshot.chapterNumber) {
          // Item was completed in this chapter - revert it
          revertedCount++;
          return {
            ...preItem,
          };
        }
        // Item wasn't completed in this chapter or was already completed - keep current
        return { ...currentItem };
      } else {
        // New checklist item added in this chapter - keep it for now
        // (we could remove it if it was added in this chapter, but that's not tracked)
        return { ...currentItem };
      }
    });

    return {
      ...currentArc,
      checklist: rolledBackChecklist,
    };
  });

  return {
    arcs: rolledBackArcs,
    revertedCount,
  };
}
