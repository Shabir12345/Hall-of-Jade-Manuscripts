/**
 * Helper utilities for querying and managing items and techniques
 * Provides convenient functions for common operations
 */

import { NovelItem, NovelTechnique, Character, CharacterItemPossession, CharacterTechniqueMastery, ItemCategory, TechniqueCategory, TechniqueType } from '../types';

/**
 * Get all items possessed by a character (filtered by status)
 */
export function getCharacterItems(
  character: Character,
  novelItems: NovelItem[],
  status?: 'active' | 'archived' | 'lost' | 'destroyed'
): Array<{ item: NovelItem; possession: CharacterItemPossession }> {
  if (!character.itemPossessions || !novelItems) {
    return [];
  }

  const possessions = status 
    ? character.itemPossessions.filter(p => p.status === status)
    : character.itemPossessions;

  return possessions
    .map(poss => {
      const item = novelItems.find(i => i.id === poss.itemId);
      return item ? { item, possession: poss } : null;
    })
    .filter((result): result is { item: NovelItem; possession: CharacterItemPossession } => result !== null);
}

/**
 * Get all techniques mastered by a character (filtered by status)
 */
export function getCharacterTechniques(
  character: Character,
  novelTechniques: NovelTechnique[],
  status?: 'active' | 'archived' | 'forgotten' | 'mastered'
): Array<{ technique: NovelTechnique; mastery: CharacterTechniqueMastery }> {
  if (!character.techniqueMasteries || !novelTechniques) {
    return [];
  }

  const masteries = status 
    ? character.techniqueMasteries.filter(m => m.status === status)
    : character.techniqueMasteries;

  return masteries
    .map(mast => {
      const technique = novelTechniques.find(t => t.id === mast.techniqueId);
      return technique ? { technique, mastery: mast } : null;
    })
    .filter((result): result is { technique: NovelTechnique; mastery: CharacterTechniqueMastery } => result !== null);
}

/**
 * Get items by category
 */
export function getItemsByCategory(
  novelItems: NovelItem[],
  category: ItemCategory
): NovelItem[] {
  return novelItems.filter(item => item.category === category);
}

/**
 * Get techniques by category and/or type
 */
export function getTechniquesByCategory(
  novelTechniques: NovelTechnique[],
  category?: TechniqueCategory,
  type?: TechniqueType
): NovelTechnique[] {
  return novelTechniques.filter(tech => {
    if (category && tech.category !== category) return false;
    if (type && tech.type !== type) return false;
    return true;
  });
}

/**
 * Get all characters who possess a specific item
 */
export function getItemOwners(
  itemId: string,
  characters: Character[]
): Array<{ character: Character; possession: CharacterItemPossession }> {
  return characters
    .map(char => {
      const possession = char.itemPossessions?.find(p => p.itemId === itemId);
      return possession ? { character: char, possession } : null;
    })
    .filter((result): result is { character: Character; possession: CharacterItemPossession } => result !== null);
}

/**
 * Get all characters who master a specific technique
 */
export function getTechniqueMasters(
  techniqueId: string,
  characters: Character[]
): Array<{ character: Character; mastery: CharacterTechniqueMastery }> {
  return characters
    .map(char => {
      const mastery = char.techniqueMasteries?.find(m => m.techniqueId === techniqueId);
      return mastery ? { character: char, mastery } : null;
    })
    .filter((result): result is { character: Character; mastery: CharacterTechniqueMastery } => result !== null);
}

/**
 * Get items/techniques that appear in a specific chapter range
 */
export function getItemsInChapterRange(
  novelItems: NovelItem[],
  startChapter: number,
  endChapter: number
): NovelItem[] {
  return novelItems.filter(item => {
    const firstAppeared = item.firstAppearedChapter || 0;
    const lastReferenced = item.lastReferencedChapter || 0;
    return (firstAppeared >= startChapter && firstAppeared <= endChapter) ||
           (lastReferenced >= startChapter && lastReferenced <= endChapter) ||
           (firstAppeared <= startChapter && lastReferenced >= endChapter);
  });
}

export function getTechniquesInChapterRange(
  novelTechniques: NovelTechnique[],
  startChapter: number,
  endChapter: number
): NovelTechnique[] {
  return novelTechniques.filter(tech => {
    const firstAppeared = tech.firstAppearedChapter || 0;
    const lastReferenced = tech.lastReferencedChapter || 0;
    return (firstAppeared >= startChapter && firstAppeared <= endChapter) ||
           (lastReferenced >= startChapter && lastReferenced <= endChapter) ||
           (firstAppeared <= startChapter && lastReferenced >= endChapter);
  });
}

/**
 * Search items/techniques by name (fuzzy search)
 */
export function searchItemsByName(
  novelItems: NovelItem[],
  searchTerm: string
): NovelItem[] {
  if (!searchTerm || !searchTerm.trim()) {
    return [];
  }

  const normalizedSearch = searchTerm.toLowerCase().trim();
  
  return novelItems.filter(item => {
    return item.name.toLowerCase().includes(normalizedSearch) ||
           item.canonicalName.includes(normalizedSearch) ||
           item.description.toLowerCase().includes(normalizedSearch) ||
           item.powers.some(p => p.toLowerCase().includes(normalizedSearch));
  });
}

export function searchTechniquesByName(
  novelTechniques: NovelTechnique[],
  searchTerm: string
): NovelTechnique[] {
  if (!searchTerm || !searchTerm.trim()) {
    return [];
  }

  const normalizedSearch = searchTerm.toLowerCase().trim();
  
  return novelTechniques.filter(tech => {
    return tech.name.toLowerCase().includes(normalizedSearch) ||
           tech.canonicalName.includes(normalizedSearch) ||
           tech.description.toLowerCase().includes(normalizedSearch) ||
           tech.functions.some(f => f.toLowerCase().includes(normalizedSearch));
  });
}

/**
 * Get items/techniques sorted by last referenced (most recent first)
 */
export function getItemsSortedByLastReferenced(
  novelItems: NovelItem[]
): NovelItem[] {
  return [...novelItems].sort((a, b) => {
    const aRef = a.lastReferencedChapter || a.firstAppearedChapter || 0;
    const bRef = b.lastReferencedChapter || b.firstAppearedChapter || 0;
    return bRef - aRef;
  });
}

export function getTechniquesSortedByLastReferenced(
  novelTechniques: NovelTechnique[]
): NovelTechnique[] {
  return [...novelTechniques].sort((a, b) => {
    const aRef = a.lastReferencedChapter || a.firstAppearedChapter || 0;
    const bRef = b.lastReferencedChapter || b.firstAppearedChapter || 0;
    return bRef - aRef;
  });
}

/**
 * Get items/techniques that haven't been referenced recently (candidates for archiving)
 */
export function getItemsNeedingArchive(
  novelItems: NovelItem[],
  currentChapter: number,
  threshold: number = 10
): NovelItem[] {
  return novelItems.filter(item => {
    const lastRef = item.lastReferencedChapter || item.firstAppearedChapter || 0;
    return lastRef > 0 && (currentChapter - lastRef) >= threshold;
  });
}

export function getTechniquesNeedingArchive(
  novelTechniques: NovelTechnique[],
  currentChapter: number,
  threshold: number = 10
): NovelTechnique[] {
  return novelTechniques.filter(tech => {
    const lastRef = tech.lastReferencedChapter || tech.firstAppearedChapter || 0;
    return lastRef > 0 && (currentChapter - lastRef) >= threshold;
  });
}
