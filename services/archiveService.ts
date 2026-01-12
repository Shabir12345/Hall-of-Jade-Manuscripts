/**
 * Archive Service
 * Detects items and techniques that haven't been referenced recently
 * and suggests archiving them. Also provides manual archive/restore operations.
 */

import { NovelItem, NovelTechnique, SystemLog, CharacterItemPossession, CharacterTechniqueMastery, PossessionStatus, MasteryStatus } from '../types';

export interface ArchiveSuggestion {
  type: 'item' | 'technique';
  entityId: string;
  name: string;
  lastReferencedChapter: number;
  currentChapter: number;
  chaptersSinceLastReference: number;
  characterId?: string; // If this is a character-specific suggestion
}

export interface ArchiveDetectionResult {
  suggestions: ArchiveSuggestion[];
  logs: SystemLog[];
}

/**
 * Default threshold: items/techniques not referenced in 10+ chapters may be archived
 */
const DEFAULT_ARCHIVE_THRESHOLD = 10;

/**
 * Detects items and techniques that should be suggested for archiving
 * @param items - All items in the novel
 * @param techniques - All techniques in the novel
 * @param characterPossessions - Character-item relationships
 * @param characterMasteries - Character-technique relationships
 * @param currentChapter - Current chapter number
 * @param threshold - Number of chapters since last reference to trigger suggestion (default 10)
 * @returns ArchiveDetectionResult with suggestions and system logs
 */
export function detectArchiveCandidates(
  items: NovelItem[],
  techniques: NovelTechnique[],
  characterPossessions: CharacterItemPossession[],
  characterMasteries: CharacterTechniqueMastery[],
  currentChapter: number,
  threshold: number = DEFAULT_ARCHIVE_THRESHOLD
): ArchiveDetectionResult {
  const suggestions: ArchiveSuggestion[] = [];
  const logs: SystemLog[] = [];

  // Check items
  for (const item of items) {
    const lastRef = item.lastReferencedChapter || item.firstAppearedChapter || 0;
    const chaptersSince = currentChapter - lastRef;

    if (chaptersSince >= threshold && lastRef > 0) {
      // Check if any character still actively possesses this item
      const activePossessions = characterPossessions.filter(
        p => p.itemId === item.id && p.status === 'active'
      );

      if (activePossessions.length > 0) {
        // Suggest archiving for each character who hasn't used it recently
        for (const possession of activePossessions) {
          suggestions.push({
            type: 'item',
            entityId: item.id,
            name: item.name,
            lastReferencedChapter: lastRef,
            currentChapter,
            chaptersSinceLastReference: chaptersSince,
            characterId: possession.characterId
          });

          logs.push({
            id: crypto.randomUUID(),
            message: `Item "${item.name}" hasn't been referenced in ${chaptersSince} chapters (since Chapter ${lastRef}). Consider archiving.`,
            type: 'update',
            timestamp: Date.now()
          });
        }
      } else {
        // Item is not actively possessed, suggest archiving the item itself
        suggestions.push({
          type: 'item',
          entityId: item.id,
          name: item.name,
          lastReferencedChapter: lastRef,
          currentChapter,
          chaptersSinceLastReference: chaptersSince
        });

        logs.push({
          id: crypto.randomUUID(),
          message: `Item "${item.name}" hasn't been referenced in ${chaptersSince} chapters (since Chapter ${lastRef}). Consider archiving.`,
          type: 'update',
          timestamp: Date.now()
        });
      }
    }
  }

  // Check techniques
  for (const technique of techniques) {
    const lastRef = technique.lastReferencedChapter || technique.firstAppearedChapter || 0;
    const chaptersSince = currentChapter - lastRef;

    if (chaptersSince >= threshold && lastRef > 0) {
      // Check if any character still actively masters this technique
      const activeMasteries = characterMasteries.filter(
        m => m.techniqueId === technique.id && m.status === 'active'
      );

      if (activeMasteries.length > 0) {
        // Suggest archiving for each character who hasn't used it recently
        for (const mastery of activeMasteries) {
          suggestions.push({
            type: 'technique',
            entityId: technique.id,
            name: technique.name,
            lastReferencedChapter: lastRef,
            currentChapter,
            chaptersSinceLastReference: chaptersSince,
            characterId: mastery.characterId
          });

          logs.push({
            id: crypto.randomUUID(),
            message: `Technique "${technique.name}" hasn't been referenced in ${chaptersSince} chapters (since Chapter ${lastRef}). Consider archiving.`,
            type: 'update',
            timestamp: Date.now()
          });
        }
      } else {
        // Technique is not actively mastered, suggest archiving the technique itself
        suggestions.push({
          type: 'technique',
          entityId: technique.id,
          name: technique.name,
          lastReferencedChapter: lastRef,
          currentChapter,
          chaptersSinceLastReference: chaptersSince
        });

        logs.push({
          id: crypto.randomUUID(),
          message: `Technique "${technique.name}" hasn't been referenced in ${chaptersSince} chapters (since Chapter ${lastRef}). Consider archiving.`,
          type: 'update',
          timestamp: Date.now()
        });
      }
    }
  }

  return { suggestions, logs };
}

/**
 * Archives a character's possession of an item
 */
export function archivePossession(
  possession: CharacterItemPossession,
  currentChapter: number
): CharacterItemPossession {
  return {
    ...possession,
    status: 'archived' as PossessionStatus,
    archivedChapter: currentChapter,
    updatedAt: Date.now()
  };
}

/**
 * Archives a character's mastery of a technique
 */
export function archiveMastery(
  mastery: CharacterTechniqueMastery,
  currentChapter: number
): CharacterTechniqueMastery {
  return {
    ...mastery,
    status: 'archived' as MasteryStatus,
    archivedChapter: currentChapter,
    updatedAt: Date.now()
  };
}

/**
 * Restores a character's possession of an item
 */
export function restorePossession(
  possession: CharacterItemPossession
): CharacterItemPossession {
  return {
    ...possession,
    status: 'active' as PossessionStatus,
    archivedChapter: undefined,
    updatedAt: Date.now()
  };
}

/**
 * Restores a character's mastery of a technique
 */
export function restoreMastery(
  mastery: CharacterTechniqueMastery
): CharacterTechniqueMastery {
  return {
    ...mastery,
    status: 'active' as MasteryStatus,
    archivedChapter: undefined,
    updatedAt: Date.now()
  };
}

/**
 * Marks an item possession as lost
 */
export function markPossessionLost(
  possession: CharacterItemPossession,
  currentChapter: number
): CharacterItemPossession {
  return {
    ...possession,
    status: 'lost' as PossessionStatus,
    archivedChapter: currentChapter,
    updatedAt: Date.now()
  };
}

/**
 * Marks an item possession as destroyed
 */
export function markPossessionDestroyed(
  possession: CharacterItemPossession,
  currentChapter: number
): CharacterItemPossession {
  return {
    ...possession,
    status: 'destroyed' as PossessionStatus,
    archivedChapter: currentChapter,
    updatedAt: Date.now()
  };
}

/**
 * Marks a technique mastery as forgotten
 */
export function markMasteryForgotten(
  mastery: CharacterTechniqueMastery,
  currentChapter: number
): CharacterTechniqueMastery {
  return {
    ...mastery,
    status: 'forgotten' as MasteryStatus,
    archivedChapter: currentChapter,
    updatedAt: Date.now()
  };
}

/**
 * Marks a technique mastery as mastered (fully learned)
 */
export function markMasteryMastered(
  mastery: CharacterTechniqueMastery,
  masteryLevel: string = 'Master'
): CharacterTechniqueMastery {
  return {
    ...mastery,
    status: 'mastered' as MasteryStatus,
    masteryLevel,
    updatedAt: Date.now()
  };
}
