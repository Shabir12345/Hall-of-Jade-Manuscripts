/**
 * Entity Chapter Tracker Utility
 * 
 * Utility functions to mark entities with chapter references
 * for tracking which chapter created or updated them.
 */

import { PostChapterExtraction } from '../services/aiService';
import { NovelState, Character, WorldEntry, Territory, NovelItem, NovelTechnique, Antagonist } from '../types';
import { ChapterStateSnapshot } from '../types/chapterSnapshot';
import { updateSnapshotChangeSummary } from '../services/chapterStateSnapshotService';

/**
 * Mark entities with chapter references after post-chapter processing
 */
export function markEntitiesWithChapter(
  chapterId: string,
  chapterNumber: number,
  extraction: PostChapterExtraction,
  updatedNovel: NovelState
): void {
  const changeSummary: Partial<ChapterStateSnapshot['changeSummary']> = {
    charactersCreated: [],
    charactersUpdated: [],
    worldEntriesCreated: [],
    worldEntriesUpdated: [],
    territoriesCreated: [],
    territoriesUpdated: [],
    itemsCreated: [],
    itemsUpdated: [],
    techniquesCreated: [],
    techniquesUpdated: [],
    antagonistsCreated: [],
    antagonistsUpdated: [],
  };

  // Mark characters
  if (extraction.characterUpserts) {
    extraction.characterUpserts.forEach((upsert: any) => {
      const character = updatedNovel.characterCodex.find(
        c => c.name.toLowerCase() === String(upsert.name || '').toLowerCase().trim()
      );
      
      if (character) {
        // Check if character existed before (by checking if it has update history or was created earlier)
        const wasCreated = !character.updateHistory || character.updateHistory.length === 0;
        
        if (wasCreated) {
          character.createdByChapterId = chapterId;
          changeSummary.charactersCreated?.push(character.id);
        } else {
          character.lastUpdatedByChapterId = chapterId;
          if (!changeSummary.charactersUpdated?.includes(character.id)) {
            changeSummary.charactersUpdated?.push(character.id);
          }
          
          // Update history
          if (!character.updateHistory) {
            character.updateHistory = [];
          }
          const changedFields: string[] = [];
          if (upsert.set?.age) changedFields.push('age');
          if (upsert.set?.personality) changedFields.push('personality');
          if (upsert.set?.currentCultivation) changedFields.push('cultivation');
          if (upsert.set?.status) changedFields.push('status');
          if (upsert.set?.appearance) changedFields.push('appearance');
          if (upsert.set?.background) changedFields.push('background');
          if (upsert.set?.goals) changedFields.push('goals');
          if (upsert.set?.flaws) changedFields.push('flaws');
          if (upsert.set?.notes) changedFields.push('notes');
          if (upsert.addSkills?.length) changedFields.push('skills');
          if (upsert.addItems?.length) changedFields.push('items');
          
          character.updateHistory.push({
            chapterId,
            chapterNumber,
            changes: changedFields,
          });
        }
      }
    });
  }

  // Mark world entries
  if (extraction.worldEntryUpserts) {
    extraction.worldEntryUpserts.forEach((upsert: any) => {
      if (upsert.isNewRealm) {
        // Realm creation is handled separately
        return;
      }
      
      const entry = updatedNovel.worldBible.find(
        w => w.title.toLowerCase() === String(upsert.title || '').toLowerCase().trim() &&
             w.realmId === updatedNovel.currentRealmId
      );
      
      if (entry) {
        const wasCreated = !entry.createdByChapterId;
        if (wasCreated) {
          entry.createdByChapterId = chapterId;
          changeSummary.worldEntriesCreated?.push(entry.id);
        } else {
          entry.lastUpdatedByChapterId = chapterId;
          if (!changeSummary.worldEntriesUpdated?.includes(entry.id)) {
            changeSummary.worldEntriesUpdated?.push(entry.id);
          }
        }
      }
    });
  }

  // Mark territories
  if (extraction.territoryUpserts) {
    extraction.territoryUpserts.forEach((upsert: any) => {
      const territory = updatedNovel.territories.find(
        t => t.name.toLowerCase() === String(upsert.name || '').toLowerCase().trim() &&
             t.realmId === updatedNovel.currentRealmId
      );
      
      if (territory) {
        const wasCreated = !territory.createdByChapterId;
        if (wasCreated) {
          territory.createdByChapterId = chapterId;
          changeSummary.territoriesCreated?.push(territory.id);
        } else {
          territory.lastUpdatedByChapterId = chapterId;
          if (!changeSummary.territoriesUpdated?.includes(territory.id)) {
            changeSummary.territoriesUpdated?.push(territory.id);
          }
        }
      }
    });
  }

  // Mark items
  if (extraction.itemUpdates) {
    extraction.itemUpdates.forEach((update: any) => {
      const item = updatedNovel.novelItems?.find(
        i => i.name.toLowerCase() === String(update.name || '').toLowerCase().trim()
      );
      
      if (item) {
        const wasCreated = !item.createdByChapterId;
        if (wasCreated) {
          item.createdByChapterId = chapterId;
          changeSummary.itemsCreated?.push(item.id);
        } else {
          item.lastUpdatedByChapterId = chapterId;
          if (!changeSummary.itemsUpdated?.includes(item.id)) {
            changeSummary.itemsUpdated?.push(item.id);
          }
        }
      }
    });
  }

  // Mark techniques
  if (extraction.techniqueUpdates) {
    extraction.techniqueUpdates.forEach((update: any) => {
      const technique = updatedNovel.novelTechniques?.find(
        t => t.name.toLowerCase() === String(update.name || '').toLowerCase().trim()
      );
      
      if (technique) {
        const wasCreated = !technique.createdByChapterId;
        if (wasCreated) {
          technique.createdByChapterId = chapterId;
          changeSummary.techniquesCreated?.push(technique.id);
        } else {
          technique.lastUpdatedByChapterId = chapterId;
          if (!changeSummary.techniquesUpdated?.includes(technique.id)) {
            changeSummary.techniquesUpdated?.push(technique.id);
          }
        }
      }
    });
  }

  // Mark antagonists
  if (extraction.antagonistUpdates) {
    extraction.antagonistUpdates.forEach((update: any) => {
      const antagonist = updatedNovel.antagonists?.find(
        a => a.name.toLowerCase() === String(update.name || '').toLowerCase().trim()
      );
      
      if (antagonist) {
        const wasCreated = !antagonist.createdByChapterId;
        if (wasCreated) {
          antagonist.createdByChapterId = chapterId;
          changeSummary.antagonistsCreated?.push(antagonist.id);
        } else {
          antagonist.lastUpdatedByChapterId = chapterId;
          if (!changeSummary.antagonistsUpdated?.includes(antagonist.id)) {
            changeSummary.antagonistsUpdated?.push(antagonist.id);
          }
        }
      }
    });
  }

  // Mark systems
  if (extraction.systemUpdates) {
    extraction.systemUpdates.forEach((update: any) => {
      const system = updatedNovel.characterSystems?.find(
        s => s.name.toLowerCase() === String(update.name || '').toLowerCase().trim()
      );
      
      if (system) {
        const wasCreated = !system.createdByChapterId;
        if (wasCreated) {
          system.createdByChapterId = chapterId;
          if (!changeSummary.systemsCreated) changeSummary.systemsCreated = [];
          changeSummary.systemsCreated.push(system.id);
        } else {
          system.lastUpdatedByChapterId = chapterId;
          if (!changeSummary.systemsUpdated) changeSummary.systemsUpdated = [];
          if (!changeSummary.systemsUpdated.includes(system.id)) {
            changeSummary.systemsUpdated.push(system.id);
          }
        }
      }
    });
  }

  // Update snapshot change summary
  updateSnapshotChangeSummary(chapterId, changeSummary).catch(error => {
    console.error('Failed to update snapshot change summary:', error);
  });
}

/**
 * Track arc checklist completions for a chapter
 */
export function trackArcChecklistCompletions(
  chapterId: string,
  chapterNumber: number,
  extraction: PostChapterExtraction,
  updatedNovel: NovelState
): void {
  if (extraction.arcChecklistProgress?.completedItemIds) {
    const completedItems = extraction.arcChecklistProgress.completedItemIds.map(itemId => ({
      arcId: extraction.arcChecklistProgress!.arcId,
      itemId,
    }));

    updateSnapshotChangeSummary(chapterId, {
      arcChecklistCompleted: completedItems,
    }).catch(error => {
      console.error('Failed to update arc checklist completion tracking:', error);
    });
  }
}

/**
 * Track realm changes for a chapter
 */
export function trackRealmChanges(
  chapterId: string,
  chapterNumber: number,
  oldRealmId: string | undefined,
  newRealmId: string | undefined,
  realmCreated: boolean
): void {
  if (realmCreated && newRealmId) {
    updateSnapshotChangeSummary(chapterId, {
      realmChanges: {
        newRealmCreated: true,
        oldRealmId,
        newRealmId,
      },
    }).catch(error => {
      console.error('Failed to update realm change tracking:', error);
    });
  }
}
